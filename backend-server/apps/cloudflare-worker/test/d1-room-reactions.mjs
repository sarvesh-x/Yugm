import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1RoomReactions(db, request, host, guest) {
  const roomId = id();
  const hostId = host.user.id;
  const now = new Date().toISOString();
  const expires = new Date(Date.now() + 60_000).toISOString();
  const originalVip = await db.prepare("SELECT vip_level, vip_tier, vip_expires_at, vip_frozen FROM users WHERE source_id = ?")
    .bind(hostId).first();
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
      max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
      VALUES (?, 'Reactions fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PRIVATE', 8, 1, 0, ?, 0, 0, 0)`)
      .bind(roomId, hostId, `reactions-${roomId}`),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
      moderator_muted, camera_enabled, joined_at) VALUES (?, ?, ?, 'HOST', 0, 0, 0, ?)`).bind(id(), roomId, hostId, now),
    db.prepare(`INSERT INTO room_reactions (source_id, label, emoji, asset_kind, access, is_active, sort_order)
      VALUES ('heart', 'Custom heart', '', 'STATIC', 'EVERYONE', 1, 0),
             ('fire', 'Disabled fire', '🔥', 'STATIC', 'EVERYONE', 0, 1)`),
    db.prepare("UPDATE users SET vip_level = 0, vip_tier = NULL, vip_expires_at = NULL, vip_frozen = 0 WHERE source_id = ?").bind(hostId)
  ]);
  const root = `/api/rooms/${roomId}`;
  const as = (account, path, status, body) => request(path, status, { accessToken: account.accessToken, body });
  const send = (status, type) => as(host, `${root}/reactions`, status, { type });
  const missions = async () => (await as(host, `${root}/missions`, 200)).data.missions;
  const catalog = (await request("/api/reactions", 200)).data.reactions;
  assert.equal(catalog.find(reaction => reaction.id === "heart").label, "Custom heart");
  assert.equal(catalog.find(reaction => reaction.id === "heart").emoji, "❤️");
  assert.ok(!catalog.some(reaction => reaction.id === "fire"));
  assert.deepEqual((await request("/api/reactions", 200, { accessToken: "invalid" })).data.reactions, catalog);
  assert.equal(catalog.find(reaction => reaction.id === "vip_diamond").lockedReason, "VIP");
  await send(404, "fire");
  await send(403, "vip_diamond");
  await as(guest, `${root}/missions`, 403);
  await as(guest, `${root}/reactions`, 403, { type: "heart" });

  const reaction = (await send(201, "HEART")).data.reaction;
  assert.equal(reaction.userId, hostId);
  assert.equal(reaction.reactionId, "heart");
  assert.equal(reaction.label, "Custom heart");
  assert.deepEqual((await as(host, `${root}/activity`, 200)).data.activity[0].metadata, reaction);
  assert.deepEqual((await missions()).map(mission => mission.progress), [1, 0, 1]);

  const setVip = (level, tier, until, frozen) => db.prepare(`UPDATE users SET vip_level = ?, vip_tier = ?,
    vip_expires_at = ?, vip_frozen = ? WHERE source_id = ?`).bind(level, tier, until, frozen, hostId).run();
  await setVip(3, "VIP3", expires, 1);
  await send(403, "vip_diamond");
  await setVip(3, "VIP3", new Date(Date.now() - 60_000).toISOString(), 0);
  await send(403, "vip_diamond");
  await setVip(3, "VIP3", expires, 0);
  const unlocked = (await as(host, "/api/reactions", 200)).data.reactions.find(item => item.id === "vip_diamond");
  assert.equal(unlocked.usable, true);
  assert.equal(unlocked.lockedReason, null);
  assert.equal((await send(201, "vip_diamond")).data.reaction.access, "VIP_EXCLUSIVE");
  await setVip(originalVip.vip_level, originalVip.vip_tier, originalVip.vip_expires_at, originalVip.vip_frozen);

  const safetyId = id();
  await db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level, warning_count,
    report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted, is_wallet_frozen)
    VALUES (?, ?, 100, 'LOW', 0, 0, 0, 0, 1, 0, 0)`).bind(safetyId, hostId).run();
  await send(403, "heart");
  await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId).run();

  await db.prepare(`INSERT INTO room_activities (source_id, room_id, type, label, metadata, created_at)
    SELECT value, ?, CASE WHEN key < 10 THEN 'REACTION' ELSE 'GIFT' END, 'Fixture', '{}', ?
    FROM json_each(?)`).bind(roomId, now, JSON.stringify(Array.from({ length: 15 }, id))).run();
  assert.deepEqual((await missions()).map(({ progress, complete }) => [progress, complete]), [[10, true], [3, true], [1, false]]);
}
