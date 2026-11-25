import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1RoomMessages(db, request, host, guest) {
  const room = id();
  const seat = id();
  const hostId = host.user.id;
  const guestId = guest.user.id;
  const now = new Date();
  const time = now.toISOString();
  now.setUTCHours(0, 0, 0, 0);
  const day = now.toISOString();
  const pair = [hostId, guestId].sort().join(":");
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
      max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
      VALUES (?, 'Chat fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PUBLIC', 8, 1, 0, ?, 0, 0, 0)`)
      .bind(room, hostId, `chat-${room}`),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
      moderator_muted, camera_enabled, joined_at, left_at)
      VALUES (?, ?, ?, 'HOST', 0, 0, 0, ?, NULL), (?, ?, ?, 'AUDIENCE', 0, 0, 0, ?, ?)`)
      .bind(id(), room, hostId, time, seat, room, guestId, time, time),
    db.prepare("DELETE FROM xp_daily_caps WHERE user_id = ? AND event = 'CHAT_MESSAGE' AND day = ?").bind(hostId, day),
    db.prepare("INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount) VALUES (?, ?, 'CHAT_MESSAGE', ?, 95)")
      .bind(id(), hostId, day),
    db.prepare("INSERT INTO relationship_room_dm_xp_daily (pair_key, day, amount) VALUES (?, ?, 72)").bind(pair, day)
  ]);
  const path = `/api/rooms/${room}/messages`;
  const as = (account, target, status, body) => request(target, status, { accessToken: account.accessToken, body });
  const chat = (account, status, body) => as(account, path, status, body);
  const direct = (account, status, body) => as(account, `${path}/direct`, status, body);
  await request(path, 401, { body: {} });
  await chat(guest, 403, { message: "No seat" });
  await direct(host, 400, { receiverId: guestId, message: "No seat" });
  await db.prepare("UPDATE room_participants SET left_at = NULL WHERE source_id = ?").bind(seat).run();
  await db.prepare(`CREATE TRIGGER fixture_room_chat_xp_failure BEFORE INSERT ON xp_grants
    WHEN NEW.event = 'CHAT_MESSAGE' BEGIN SELECT RAISE(ABORT, 'fixture chat rollback'); END`).run();
  try {
    await chat(host, 500, { message: "Roll back chat" });
    assert.deepEqual((await chat(guest, 200)).data.messages, []);
  } finally {
    await db.prepare("DROP TRIGGER fixture_room_chat_xp_failure").run();
  }
  assert.equal((await chat(host, 201, { message: "<Hello room>" })).data.message.message, "Hello room");
  const chatRows = (await chat(guest, 200)).data.messages;
  assert.equal(chatRows[0].senderId._id, hostId);
  assert.equal(await db.prepare("SELECT amount FROM xp_daily_caps WHERE user_id = ? AND event = 'CHAT_MESSAGE' AND day = ?")
    .bind(hostId, day).first("amount"), 100);
  await direct(host, 400, { message: "Host needs a recipient" });
  const block = id();
  await db.prepare("INSERT INTO blocks (source_id, blocker_id, blocked_user_id) VALUES (?, ?, ?)").bind(block, hostId, guestId).run();
  await direct(guest, 403, { message: "Blocked" });
  await db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(block).run();

  const original = await db.prepare("SELECT xp FROM relationships WHERE pair_key = ?").bind(pair).first("xp");
  const messages = await Promise.all([
    direct(guest, 201, { message: "Send to host", receiverId: id() }),
    direct(host, 201, { message: "Reply from host", receiverId: guestId })
  ]);
  assert.equal(messages[0].data.message.receiverId, hostId);
  assert.equal(messages[1].data.message.receiverId, guestId);
  assert.equal(messages[0].data.message.roomId, room);
  assert.equal(await db.prepare("SELECT amount FROM relationship_room_dm_xp_daily WHERE pair_key = ? AND day = ?")
    .bind(pair, day).first("amount"), 80);
  assert.equal(await db.prepare("SELECT xp FROM relationships WHERE pair_key = ?").bind(pair).first("xp"), (original ?? 0) + 8);
  const history = (await as(guest, `/api/users/messages/${hostId}`, 200)).data.messages;
  assert.equal(history.filter(item => item.roomId === room).length, 2);
  const notice = (await as(guest, "/api/notifications?limit=100", 200)).data.notifications
    .find(item => item.type === "MESSAGE" && item.data.roomId === room);
  assert.equal(notice.data.messageId, messages[1].data.message._id);
  assert.equal((await chat(host, 200)).data.messages.length, 1);

  const mediaUrl = "https://example.test/room-photo.png";
  assert.equal((await chat(host, 403, { mediaUrl })).error.message, "Room image sharing unlocks at VIP 4");
  await db.prepare("UPDATE users SET vip_tier = 'VIP4', vip_level = 4, vip_expires_at = ? WHERE source_id = ?")
    .bind(new Date(Date.now() + 60_000).toISOString(), hostId).run();
  const photo = (await chat(host, 201, { mediaUrl })).data.message;
  assert.equal(photo.mediaUrl, mediaUrl);
  assert.equal(photo.mediaType, "IMAGE");
  assert.equal(photo.message, "Shared a photo");
  assert.equal((await chat(guest, 400, { message: "spam scam casino" })).error.code, "CONTENT_BLOCKED");
  await chat(guest, 403, { message: "Restricted sender" });
}
