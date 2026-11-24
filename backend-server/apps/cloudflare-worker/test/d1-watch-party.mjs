import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1WatchParty(db, request, owner, visitor) {
  const root = "/api/rooms";
  const roomId = id();
  const time = new Date().toISOString();
  await db.prepare(`INSERT INTO rooms
    (source_id, title, type, host_id, category, tags, language, status, visibility, max_speakers,
     participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only,
     created_at, updated_at)
    VALUES (?, 'Watch party fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PUBLIC', 8, 1, 0, ?, 0, 0, 0, ?, ?)`)
    .bind(roomId, owner.user.id, `wp-${roomId}`, time, time).run();

  const path = `${root}/${roomId}/watch-party`;
  const as = (account, target, status, options = {}) =>
    request(target, status, { accessToken: account.accessToken, ...options });
  const get = (account, status) => as(account, path, status);
  const start = (account, status, body) => as(account, path, status, { body });
  const sync = (account, status, body) => as(account, `${path}/sync`, status, { method: "PATCH", body });
  const stop = account => as(account, path, 200, { method: "DELETE" });
  const row = () => db.prepare("SELECT * FROM watch_parties WHERE room_id = ?").bind(roomId).first();

  await request(path, 401);
  await get(owner, 404);
  await start(visitor, 403, { title: "Visitor party", mediaUrl: "https://example.com/v.mp4" });
  await start(owner, 422, { title: "", mediaUrl: "not-a-url" });
  assert.equal(await row(), null);

  const started = (await start(owner, 200, { title: "Host party", mediaUrl: "https://example.com/a.mp4" })).data.watchParty;
  assert.equal(started.roomId, roomId);
  assert.equal(started.hostId, owner.user.id);
  assert.equal(started.title, "Host party");
  assert.equal(started.mediaUrl, "https://example.com/a.mp4");
  assert.equal(started.position, 0);
  assert.equal(started.isPlaying, true);
  assert.equal(started._id.length, 24);
  assert.equal((await get(visitor, 200)).data.watchParty._id, started._id);

  await sync(visitor, 403, { position: 5, isPlaying: false });
  const synced = (await sync(owner, 200, { position: 42.5, isPlaying: false })).data.watchParty;
  assert.equal(synced.position, 42.5);
  assert.equal(synced.isPlaying, false);
  assert.equal(synced._id, started._id);
  const stored = await row();
  assert.equal(stored.position, 42.5);
  assert.equal(stored.is_playing, 0);

  // Starting again replaces the single per-room record, like findOneAndDelete + create.
  const replaced = (await start(owner, 200, { title: "Second party", mediaUrl: "https://example.com/b.mp4" })).data.watchParty;
  assert.notEqual(replaced._id, started._id);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM watch_parties WHERE room_id = ?").bind(roomId).first("count"), 1);
  assert.equal((await get(owner, 200)).data.watchParty.title, "Second party");

  await as(visitor, path, 404, { method: "DELETE" });
  assert.equal((await stop(owner)).data.deleted, true);
  await get(owner, 404);
  await as(owner, path, 404, { method: "DELETE" });
  assert.equal(await row(), null);

  await as(owner, `${root}/not-an-object-id/watch-party`, 400);
}
