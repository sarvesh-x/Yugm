import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Missions(db, request, owner, visitor) {
  const userId = owner.user.id;
  const now = new Date().toISOString();
  const past = new Date(Date.now() - 86_400_000).toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const missionId = id();
  const expiredId = id();
  const futureId = id();
  const inactiveId = id();
  const fixtureRows = [
    [missionId, "fixture_mission", 3, now, null, 1],
    [expiredId, "fixture_expired", 3, past, past, 1],
    [futureId, "fixture_future", 3, future, null, 1],
    [inactiveId, "fixture_inactive", 3, null, null, 0]
  ];

  // No other fixture owns missions, so start empty and exercise the lazy catalog seed.
  await db.batch([
    db.prepare("DELETE FROM user_missions"),
    db.prepare("DELETE FROM missions")
  ]);

  await request("/api/missions", 401);
  await request("/api/missions/active", 401);
  await request("/api/missions/progress", 401, { body: { action: "fixture_action" } });
  await request("/api/missions/claim", 401, { body: { missionId } });
  assert.equal((await request("/api/missions/progress", 422, {
    accessToken: owner.accessToken, body: { action: "" }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/missions/claim", 422, {
    accessToken: owner.accessToken, body: {}
  })).error.code, "VALIDATION");

  const catalog = await request("/api/missions", 200, { accessToken: owner.accessToken });
  assert.ok(catalog.data.missions.some(mission => mission.key === "daily_voice_10"));
  assert.equal(catalog.data.missions.length, 14);

  await db.batch(fixtureRows.map(([rowId, key, target, startDate, endDate, active]) => db.prepare(`INSERT INTO missions
    (source_id, key, type, title, description, requirements_action, requirements_target, requirements_unit,
     rewards_xp, rewards_coins, rewards_diamonds, active, created_at, updated_at, start_date, end_date)
    VALUES (?, ?, 'daily', ?, ?, 'fixture_action', ?, 'count', 40, 25, 0, ?, ?, ?, ?, ?)`)
    .bind(rowId, key, `Fixture ${key}`, "Complete the fixture mission", target, active, now, now, startDate, endDate)));

  const daily = await request("/api/missions?type=daily", 200, { accessToken: owner.accessToken });
  assert.ok(daily.data.missions.every(mission => mission.type === "daily"));
  // GET /missions filters only on active, unlike /missions/active which applies the date window.
  assert.ok(daily.data.missions.some(mission => mission.key === "fixture_expired"));

  const active = await request("/api/missions/active", 200, { accessToken: owner.accessToken });
  const mine = active.data.daily.find(mission => mission._id === missionId);
  assert.ok(mine);
  assert.equal(mine.progress, 0);
  assert.equal(mine.completed, false);
  assert.equal(mine.claimed, false);
  assert.equal(active.data.weekly.length > 0, true);
  assert.equal(active.data.monthly.length > 0, true);
  assert.equal(active.data.seasonal.length, 0);
  for (const excluded of [expiredId, futureId, inactiveId]) {
    assert.ok(!active.data.daily.some(mission => mission._id === excluded));
  }

  const progressed = await request("/api/missions/progress", 200, {
    accessToken: owner.accessToken, body: { action: "fixture_action", delta: 2 }
  });
  assert.deepEqual(progressed.data.results.find(result => result.missionId === missionId), {
    missionId, key: "fixture_mission", completed: false, progress: 2, target: 3
  });
  assert.ok(!progressed.data.results.some(result => [expiredId, futureId, inactiveId].includes(result.missionId)));
  const completed = await request("/api/missions/progress", 200, {
    accessToken: owner.accessToken, body: { action: "fixture_action", delta: 2 }
  });
  assert.deepEqual(completed.data.results.find(result => result.missionId === missionId), {
    missionId, key: "fixture_mission", completed: true, progress: 3, target: 3
  });
  const stored = await db.prepare("SELECT progress, completed FROM user_missions WHERE user_id = ? AND mission_id = ?")
    .bind(userId, missionId).first();
  assert.equal(stored.progress, 4);
  assert.equal(stored.completed, 1);

  assert.equal((await request("/api/missions/claim", 400, {
    accessToken: owner.accessToken, body: { missionId: "not-an-id" }
  })).error.message, "Invalid mission ID");
  assert.equal((await request("/api/missions/claim", 404, {
    accessToken: owner.accessToken, body: { missionId: id() }
  })).error.message, "Mission not found");
  assert.equal((await request("/api/missions/claim", 409, {
    accessToken: owner.accessToken, body: { missionId: inactiveId }
  })).error.message, "Mission not completed");
  assert.equal((await request("/api/missions/claim", 409, {
    accessToken: visitor.accessToken, body: { missionId }
  })).error.message, "Mission not completed");

  await db.prepare(`UPDATE users SET xp = 0, level = 1, wallet_balance = 1000, last_daily_check_in_at = NULL
    WHERE source_id = ?`).bind(userId).run();
  const claimed = await request("/api/missions/claim", 200, {
    accessToken: owner.accessToken, body: { missionId }
  });
  assert.deepEqual(claimed.data, { missionId, key: "fixture_mission", rewards: { xp: 40, coins: 25 } });
  const grant = await db.prepare(`SELECT event, action_key, status, receipt FROM xp_grants
    WHERE user_id = ? AND action_key = ?`).bind(userId, `mission:${userId}:${missionId}`).first();
  assert.equal(grant.event, "MISSION_REWARD");
  assert.equal(grant.status, "COMPLETE");
  assert.equal(JSON.parse(grant.receipt).xpAwarded, 40);
  const account = await db.prepare("SELECT xp, wallet_balance FROM users WHERE source_id = ?").bind(userId).first();
  assert.equal(account.xp, 40);
  assert.equal(account.wallet_balance, 1025);
  const ledger = await db.prepare(`SELECT amount, balance_before, balance_after, metadata FROM wallet_transactions
    WHERE user_id = ? AND source = 'MISSION_REWARD'`).bind(userId).all();
  assert.equal(ledger.results.length, 1);
  assert.equal(ledger.results[0].amount, 25);
  assert.equal(ledger.results[0].balance_before, 1000);
  assert.equal(ledger.results[0].balance_after, 1025);
  assert.equal(JSON.parse(ledger.results[0].metadata).idempotencyKey, `mission:${userId}:${missionId}:coins`);
  assert.equal((await db.prepare("SELECT claimed FROM user_missions WHERE user_id = ? AND mission_id = ?")
    .bind(userId, missionId).first()).claimed, 1);
  assert.equal((await request("/api/missions/claim", 409, {
    accessToken: owner.accessToken, body: { missionId }
  })).error.message, "Mission already claimed");

  const visitorActive = await request("/api/missions/active", 200, { accessToken: visitor.accessToken });
  assert.deepEqual(visitorActive.data.daily.find(mission => mission._id === missionId)?.progress ?? 0, 0);
}
