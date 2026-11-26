import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1RoomPkHistory(db, request, host, opponent, adminSecret) {
  const [left, right, complete, active] = Array.from({ length: 4 }, id);
  const time = new Date().toISOString();
  const began = new Date(Date.now() - 90_000).toISOString();
  // Earlier fixtures can leave many ACTIVE battles. Give this one the newest
  // started_at so the admin live list, which is limited to 100 rows, includes it.
  const liveStart = new Date(Date.now() + 60_000).toISOString();
  const rooms = [[left, host.user.id, "PUBLIC"], [right, opponent.user.id, "PRIVATE"]];
  await db.batch([
    ...rooms.map(([room, owner, visibility]) => db.prepare(`INSERT INTO rooms
      (source_id, title, type, host_id, category, tags, language, status, visibility, max_speakers, participant_count,
        is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only)
      VALUES (?, 'PK history fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', ?, 8, 1, 0, ?, 0, 0, 0)`)
      .bind(room, owner, visibility, `pk-${room}`)),
    ...[[complete, "ENDED", began], [active, "ACTIVE", liveStart]].map(([battle, status, started]) => db.prepare(`INSERT INTO pk_battles
      (source_id, battle_code, title, mode, format, scope, team_size, status, battle_type, duration_seconds,
        in_room_battle, state_version, event_sequence, termination_reason, started_by_user_id, left_room_id,
        right_room_id, left_host_id, right_host_id, left_score, right_score, winner_side, started_at, created_at)
      VALUES (?, ?, 'Finished PK', 'GIFT', 'ROOM', 'CROSS_ROOM', 1, ?, 'VOICE', 30, 0, 2, 0, '', ?, ?, ?, ?, ?, 12, 3, 'LEFT', ?, ?)`)
      .bind(battle, `PK-${battle}`, status, host.user.id, left, right, host.user.id, opponent.user.id, started, time)),
    db.prepare(`INSERT INTO pk_participants (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at)
      VALUES (?, ?, ?, ?, 'RIGHT', 'HOST', 1, 'B', ?)`).bind(id(), complete, opponent.user.id, right, began)
  ]);
  const path = `/api/rooms/${left}/pk-history`;
  const as = (account, endpoint = path) => request(endpoint, 200, { accessToken: account.accessToken });
  await request(path, 401);
  assert.deepEqual((await as(host)).data.battles, []);
  await db.prepare(`INSERT INTO room_invites (source_id, room_id, inviter_id, invitee_id, status)
    VALUES (?, ?, ?, ?, 'ACCEPTED')`).bind(id(), right, opponent.user.id, host.user.id).run();
  const battles = (await as(host)).data.battles;
  assert.equal(battles.length, 1);
  const [battle] = battles;
  assert.equal(battle.battleId, complete);
  assert.equal(battle.status, "ENDED");
  assert.equal(battle.leader, "LEFT");
  assert.equal(battle.remainingSeconds, 0);
  assert.equal(battle.left.hostId, host.user.id);
  assert.equal(battle.right.roomId, right);
  assert.equal(battle.right.members[0].userId, opponent.user.id);
  assert.equal(battle.right.members[0].isReady, true);
  assert.deepEqual((await as(opponent, `/api/rooms/${right}/pk-history`)).data.battles, battles);

  const adminId = id();
  await db.prepare(`INSERT INTO admin_users (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled)
    VALUES (?, ?, 'PK fixture', 'ADMIN', 'ACTIVE', 0, 0)`).bind(adminId, `${adminId}@fixture.test`).run();
  const eventId = id();
  await db.prepare(`INSERT INTO pk_events (source_id, battle_id, event_type, points, state_version, metadata, created_at)
    VALUES (?, ?, 'PK_COMPLETED', 0, 2, '{"source":"fixture"}', ?)`).bind(eventId, complete, time).run();
  const accessToken = jwt.sign({ sub: adminId, type: "admin" }, adminSecret, { expiresIn: "15m" });
  const adminRoot = "/api/admin/pk/battles";
  const adminGet = path => request(adminRoot + path, 200, { accessToken });
  const result = (await adminGet("?status=ENDED")).data.find(item => item.id === complete);
  assert.deepEqual(result, battle);
  assert.equal((await adminGet("/live")).data.some(item => item.id === active), true);
  assert.equal((await adminGet(`/${complete}`)).data.battle.id, complete);
  const events = (await adminGet(`/${complete}/events`)).data;
  assert.deepEqual(events.find(item => item._id === eventId).metadata, { source: "fixture" });
  const flag = await request(`${adminRoot}/${complete}/flag`, 200, { accessToken, body: { reason: "Fixture review" } });
  assert.equal(flag.data.auditLog.entityId, complete);
  await db.prepare("UPDATE rooms SET active_pk_id = ? WHERE source_id IN (?, ?)").bind(active, left, right).run();
  const ended = await request(`${adminRoot}/${active}/end`, 200, { accessToken, body: { reason: "Fixture force end" } });
  assert.equal(ended.data.battle.status, "ABORTED");
  assert.equal((await adminGet(`/${active}`)).data.battle.status, "CLOSED");
  const attempt = await request(`${adminRoot}/${active}/end`, 200, { accessToken, body: { reason: "Fixture retry" } });
  assert.equal(attempt.data.battle.status, "CLOSED");
  assert.deepEqual(new Set((await adminGet(`/${active}/events`)).data.map(event => event.eventType)), new Set(["PK_ABORTED", "PK_CLOSED"]));
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM rooms WHERE active_pk_id = ?").bind(active).first("count"), 0);
}
