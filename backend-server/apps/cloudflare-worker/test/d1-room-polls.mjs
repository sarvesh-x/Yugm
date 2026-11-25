import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

export async function verifyD1RoomPolls(db, request, host, guest) {
  const id = () => randomBytes(12).toString("hex");
  const room = id();
  const guestSeat = id();
  const now = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
      max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
      VALUES (?, 'Poll fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PRIVATE', 8, 1, 0, ?, 0, 0, 0)`)
      .bind(room, host.user.id, `poll-${room}`),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
      moderator_muted, camera_enabled, joined_at) VALUES (?, ?, ?, 'HOST', 0, 0, 0, ?)`)
      .bind(id(), room, host.user.id, now)
  ]);
  const root = `/api/rooms/${room}`;
  const path = `${root}/polls`;
  const as = (account, target, status, body) => request(target, status, { accessToken: account.accessToken, body });
  const create = (account, status) => as(account, path, status, { question: "<Music> next?", options: ["Pop", "Jazz"] });
  const vote = (account, key, status, optionIndex) => as(account, `${path}/${key}/vote`, status, { optionIndex });
  const close = (account, key, status) => as(account, `${path}/${key}/close`, status, {});

  await request(path, 401, { body: {} });
  await as(guest, path, 403);
  await create(guest, 403);
  const poll = (await create(host, 201)).data.poll;
  assert.equal(poll.roomId, room);
  assert.equal(poll.createdBy, host.user.id);
  assert.equal(poll.question, "Music next?");
  assert.equal(poll.isActive, true);
  assert.deepEqual(poll.options.map(({ text, votes }) => [text, votes]), [["Pop", 0], ["Jazz", 0]]);
  assert.deepEqual((await as(host, path, 200)).data.polls, [poll]);
  assert.deepEqual((await as(host, `${root}/activity`, 200)).data.activity[0].metadata, { pollId: poll._id });
  await vote(guest, poll._id, 403, 0);
  await db.batch([
    db.prepare("UPDATE rooms SET visibility = 'PUBLIC' WHERE source_id = ?").bind(room),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
      moderator_muted, camera_enabled, joined_at, left_at) VALUES (?, ?, ?, 'AUDIENCE', 0, 0, 0, ?, ?)`)
      .bind(guestSeat, room, guest.user.id, now, now)
  ]);
  assert.deepEqual((await as(guest, path, 200)).data.polls, []);
  await db.prepare("UPDATE room_participants SET left_at = NULL WHERE source_id = ?").bind(guestSeat).run();
  await vote(guest, poll._id, 400, 3);

  await db.prepare(`CREATE TRIGGER fixture_poll_tally_failure BEFORE UPDATE OF votes ON poll_options
    BEGIN SELECT RAISE(ABORT, 'fixture tally failure'); END`).run();
  await vote(guest, poll._id, 500, 1);
  await db.prepare("DROP TRIGGER fixture_poll_tally_failure").run();
  assert.deepEqual((await as(guest, path, 200)).data.polls, [poll]);

  const responses = await Promise.all([vote(guest, poll._id, [200, 409], 0), vote(guest, poll._id, [200, 409], 1)]);
  assert.equal(responses.filter(response => response.ok).length, 1);
  const list = (await as(guest, path, 200)).data.polls;
  assert.deepEqual(list[0].voters, [guest.user.id]);
  assert.equal(list[0].options.reduce((count, option) => count + option.votes, 0), 1);
  await close(guest, poll._id, 403);
  assert.equal((await close(host, poll._id, 200)).data.poll.isActive, false);
  await vote(guest, poll._id, 404, 0);

  const expired = (await create(host, 201)).data.poll;
  await db.prepare("UPDATE polls SET created_at = ? WHERE source_id = ?")
    .bind(new Date(Date.now() - 46_000).toISOString(), expired._id).run();
  const expiredList = (await as(host, path, 200)).data.polls;
  assert.equal(expiredList.find(item => item._id === expired._id).isActive, false);
  await vote(guest, expired._id, 404, 0);
  await close(host, expired._id, 404);
}
