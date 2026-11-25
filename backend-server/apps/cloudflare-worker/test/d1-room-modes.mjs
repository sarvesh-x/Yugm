import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1RoomModes(db, request, host, guest, outsider) {
  const roomId = id();
  const hostId = host.user.id;
  const guestId = guest.user.id;
  const time = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
      max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
      VALUES (?, 'Room mode fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PRIVATE', 8, 1, 0, ?, 0, 0, 0)`)
      .bind(roomId, hostId, `mode-${roomId}`),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
      moderator_muted, camera_enabled, joined_at) VALUES (?, ?, ?, 'HOST', 0, 0, 0, ?)`).bind(id(), roomId, hostId, time)
  ]);
  const root = `/api/rooms/${roomId}`;
  const as = (account, path, status, body) => request(path, status, { accessToken: account.accessToken, body });
  const set = (account, status) => as(account, `${root}/mode`, status, { mode: "truth_or_dare" });
  const state = (account, status) => as(account, `${root}/mode-state`, status);
  const action = (account, status, name, fields = {}) => as(account, `${root}/mode/action`, status, { action: name, ...fields });
  const catalog = (await request("/api/rooms/modes", 200)).data.modes;
  assert.equal(catalog.length, 5);
  assert.deepEqual((await state(host, 200)).data, { mode: null, modeState: null });
  await state(outsider, 403);
  await set(host, 400);
  await set(guest, 403);
  await db.batch([
    db.prepare("UPDATE rooms SET visibility = 'PUBLIC', participant_count = 2 WHERE source_id = ?").bind(roomId),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
      moderator_muted, camera_enabled, joined_at) VALUES (?, ?, ?, 'AUDIENCE', 0, 0, 0, ?)`).bind(id(), roomId, guestId, time)
  ]);

  const starts = await Promise.all([set(host, [200, 409]), set(host, [200, 409])]);
  assert.equal(starts.filter(result => result.ok).length, 1);
  const setResult = starts.find(result => result.ok).data;
  assert.equal(setResult.room.mode, "truth_or_dare");
  assert.deepEqual([...setResult.modeState.participants].sort(), [hostId, guestId].sort());
  assert.equal(setResult.modeState.status, "WAITING");
  assert.equal((await state(guest, 200)).data.mode, "truth_or_dare");
  await action(guest, 403, "start");
  await action(host, 400, "next_round");

  const started = (await action(host, 200, "start")).data.modeState;
  assert.equal(started.status, "ACTIVE");
  assert.equal(started.currentQuestion, "Truth or Dare?");
  assert.equal(Date.parse(started.roundEndTime) - Date.parse(started.roundStartTime), 60_000);
  await action(outsider, 403, "submit_answer", { answer: "Outside the game" });
  await action(host, 400, "vote", { targetUserId: outsider.user.id });
  assert.equal((await action(guest, 200, "submit_dare", { data: { dare: "Sing a song" } }))
    .data.modeState.metadata.currentDare, "Sing a song");
  const votes = await Promise.all([
    action(guest, 200, "vote", { targetUserId: hostId, value: 2 }),
    action(host, 200, "vote", { data: { targetUserId: hostId, value: 3 } })
  ]);
  assert.equal(Math.max(...votes.map(result => result.data.modeState.scores[hostId])), 5);
  await Promise.all([
    action(guest, 200, "submit_answer", { answer: "Guest answer" }),
    action(host, 200, "submit_answer", { data: { answer: "Host answer" } })
  ]);
  const complete = (await state(host, 200)).data.modeState;
  assert.equal(complete.status, "ROUND_END");
  assert.deepEqual(complete.metadata.answers, { [hostId]: "Host answer", [guestId]: "Guest answer" });
  const next = (await action(host, 200, "next_round")).data.modeState;
  assert.equal(next.round, 2);
  assert.notEqual(next.currentTurnUserId, started.currentTurnUserId);
  assert.equal(next.metadata.answers, undefined);
  assert.equal(next.metadata.currentDare, undefined);

  const random = (await as(guest, "/api/rooms/mode/random", 200, {})).data;
  assert.ok(catalog.some(mode => mode.key === random.mode));
  assert.ok(random.rooms.length <= 20);
  assert.ok(random.rooms.every(item => item.visibility === "PUBLIC" && item.status === "LIVE"));
  await action(guest, 403, "end");
  assert.equal((await action(host, 200, "end")).data.modeState.status, "FINISHED");
  assert.equal((await state(host, 200)).data.mode, null);
  await action(guest, 400, "vote", { targetUserId: hostId });
}
