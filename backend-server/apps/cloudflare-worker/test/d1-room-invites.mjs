import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1RoomInvites(db, request, host, guest) {
  const room = id();
  const hostId = host.user.id;
  const guestId = guest.user.id;
  const deviceId = id();
  const time = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
      max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
      VALUES (?, 'Invite fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PRIVATE', 8, 1, 0, ?, 0, 0, 0)`)
      .bind(room, hostId, `invite-${room}`),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
      moderator_muted, camera_enabled, joined_at) VALUES (?, ?, ?, 'HOST', 0, 0, 0, ?)`).bind(id(), room, hostId, time),
    db.prepare(`INSERT INTO device_tokens (source_id, user_id, platform, token, last_seen_at)
      VALUES (?, ?, 'android', ?, ?)`).bind(deviceId, guestId, `room-invite-${room}`, time)
  ]);
  const root = `/api/rooms/${room}`;
  const path = `${root}/invites`;
  const as = (account, target, status, body) => request(target, status, { accessToken: account.accessToken, body });
  const send = (status, body = { userId: guestId }) => as(host, path, status, body);
  const respond = (account, key, status, accept) => as(account, `/api/rooms/invites/${key}/respond`, status, { accept });
  const deliveries = () => db.prepare(`SELECT
    (SELECT COUNT(*) FROM room_invites WHERE room_id = ?1) AS invites,
    (SELECT COUNT(*) FROM notifications WHERE type = 'ROOM_INVITE' AND json_extract(data, '$.roomId') = ?1) AS notifications,
    (SELECT COUNT(*) FROM direct_messages WHERE room_id = ?1) AS messages,
    (SELECT COUNT(*) FROM room_activities WHERE room_id = ?1 AND type = 'INVITE') AS activities`).bind(room).first();
  const none = { invites: 0, notifications: 0, messages: 0, activities: 0 };

  await request(path, 401, { body: {} });
  await as(guest, path, 403, { userId: hostId });
  await as(guest, root, 403);
  await send(400, { userId: hostId.toUpperCase() });
  await send(403, { userIds: [guestId, id()] });
  for (const [blocker, blocked] of [[guestId, hostId], [hostId, guestId]]) {
    const block = id();
    await db.prepare("INSERT INTO blocks (source_id, blocker_id, blocked_user_id) VALUES (?, ?, ?)").bind(block, blocker, blocked).run();
    await send(403);
    await db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(block).run();
  }
  const mutedUntil = new Date(Date.now() + 60_000).toISOString();
  await db.prepare("UPDATE users SET muted_until = ? WHERE source_id = ?").bind(mutedUntil, hostId).run();
  assert.match((await send(403)).error.message, /Account muted until/);
  await db.prepare("UPDATE users SET muted_until = NULL WHERE source_id = ?").bind(hostId).run();
  assert.deepEqual(await deliveries(), none);

  await db.prepare(`CREATE TRIGGER fixture_invite_message_failure BEFORE INSERT ON direct_messages
    WHEN NEW.message LIKE 'ROOM_INVITE:%' BEGIN SELECT RAISE(ABORT, 'fixture invite rollback'); END`).run();
  try {
    await send(500);
    assert.deepEqual(await deliveries(), none);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notification_push_jobs WHERE device_id = ?")
      .bind(deviceId).first("count"), 0);
  } finally {
    await db.prepare("DROP TRIGGER fixture_invite_message_failure").run();
  }

  const repeated = await Promise.all([send(201, { userIds: [guestId], userId: guestId.toUpperCase() }), send(201)]);
  const [invite] = repeated[0].data.invites;
  assert.equal(repeated[0].data.invites.length, 1);
  assert.equal(repeated[1].data.invites[0]._id, invite._id);
  assert.equal(invite.status, "PENDING");
  assert.equal(invite.roomId, room);
  assert.deepEqual(await deliveries(), { invites: 1, notifications: 2, messages: 2, activities: 2 });
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notification_push_jobs WHERE device_id = ?")
    .bind(deviceId).first("count"), 2);
  const notifications = (await as(guest, "/api/notifications?limit=100", 200)).data.notifications;
  assert.ok(notifications.some(item => item.type === "ROOM_INVITE" && item.data.inviteId === invite._id && item.data.roomId === room));
  const chat = (await as(guest, `/api/users/messages/${hostId}?markRead=false`, 200)).data.messages;
  assert.ok(chat.some(message => message.message === `ROOM_INVITE:${room}` && message.roomId === room));

  await as(guest, root, 200);
  await respond(host, invite._id, 404, true);
  assert.deepEqual((await respond(guest, invite._id, 200, false)).data, { accepted: false });
  await as(guest, root, 403);
  await as(guest, `${root}/join`, 403, {});
  const next = (await send(201)).data.invites[0];
  assert.notEqual(next._id, invite._id);
  const responses = await Promise.all([respond(guest, next._id, [200, 404], true), respond(guest, next._id, [200, 404], true)]);
  assert.deepEqual(responses.filter(result => result.ok).map(result => result.data), [{ accepted: true, roomId: room }]);
  await as(guest, root, 200);
  assert.equal((await as(guest, `${root}/join`, 200, {})).data.joined, true);
  await db.prepare("DELETE FROM device_tokens WHERE source_id = ?").bind(deviceId).run();
}
