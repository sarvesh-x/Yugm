import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Referrals(db, request, referrer, claimant) {
  const referrerId = referrer.user.id;
  const claimantId = claimant.user.id;
  const time = new Date().toISOString();
  const deviceId = id();

  await db.batch([
    db.prepare("DELETE FROM referrals WHERE referrer_id IN (?, ?) OR referred_user_id IN (?, ?)")
      .bind(referrerId, claimantId, referrerId, claimantId),
    db.prepare("UPDATE users SET referral_code = NULL, referred_by = NULL, wallet_balance = 5000 WHERE source_id IN (?, ?)")
      .bind(referrerId, claimantId),
    db.prepare("DELETE FROM wallet_transactions WHERE user_id IN (?, ?) AND source = 'REFERRAL_BONUS'")
      .bind(referrerId, claimantId),
    db.prepare("DELETE FROM notifications WHERE user_id IN (?, ?) AND title = 'Referral reward'")
      .bind(referrerId, claimantId),
    db.prepare("DELETE FROM device_tokens WHERE source_id = ?").bind(deviceId),
    db.prepare(`INSERT INTO device_tokens (source_id, user_id, token, platform, last_seen_at)
      VALUES (?, ?, 'fixture-referral-device', 'android', ?)`).bind(deviceId, referrerId, time)
  ]);

  await request("/api/referrals/code", 401, { body: {} });
  await request("/api/referrals/code", 401);
  await request("/api/referrals/stats", 401);
  await request("/api/referrals/claim", 401, { body: { code: "abcdef" } });
  assert.equal((await request("/api/referrals/claim", 422, {
    accessToken: claimant.accessToken, body: { code: "abc" }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/referrals/claim", 422, {
    accessToken: claimant.accessToken, body: { code: "A".repeat(21) }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/referrals/claim", 404, {
    accessToken: claimant.accessToken, body: { code: "NOPECODE" }
  })).error.message, "Invalid referral code");

  const created = await request("/api/referrals/code", 200, { accessToken: referrer.accessToken, body: {} });
  assert.match(created.data.referralCode, /^[A-Z0-9]{10}$/);
  const code = created.data.referralCode;
  assert.equal((await db.prepare("SELECT referral_code FROM users WHERE source_id = ?").bind(referrerId).first("referral_code")), code);
  assert.equal((await request("/api/referrals/code", 200, { accessToken: referrer.accessToken })).data.referralCode, code);
  assert.equal((await request("/api/referrals/code", 200, { accessToken: referrer.accessToken, body: {} })).data.referralCode, code);
  assert.equal((await request("/api/referrals/claim", 400, {
    accessToken: referrer.accessToken, body: { code }
  })).error.message, "Cannot refer yourself");

  const completedId = id();
  await db.batch([
    db.prepare(`INSERT INTO referrals (source_id, referrer_id, referred_user_id, referral_code, status,
      reward_coins, completed_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'COMPLETED', 0, ?, ?, ?)`)
      .bind(completedId, referrerId, claimantId, code, time, time, time),
    db.prepare("UPDATE users SET referred_by = ? WHERE source_id = ?").bind(referrerId, claimantId)
  ]);
  assert.equal((await request("/api/referrals/claim", 409, {
    accessToken: claimant.accessToken, body: { code }
  })).error.message, "A referral claim is already recorded for this account");
  await db.batch([
    db.prepare("DELETE FROM referrals WHERE source_id = ?").bind(completedId),
    db.prepare("UPDATE users SET referred_by = NULL, wallet_balance = 5000 WHERE source_id = ?").bind(claimantId)
  ]);

  const claimed = await request("/api/referrals/claim", 200, {
    accessToken: claimant.accessToken, body: { code: code.toLowerCase() }
  });
  assert.deepEqual(claimed.data, { reward: 100, message: "Referral code applied" });
  assert.equal((await db.prepare("SELECT referred_by FROM users WHERE source_id = ?").bind(claimantId).first("referred_by")), referrerId);
  const balances = await db.prepare("SELECT source_id, wallet_balance FROM users WHERE source_id IN (?, ?) ORDER BY source_id")
    .bind(referrerId, claimantId).all();
  assert.deepEqual(balances.results.map(row => row.wallet_balance), [5100, 5100]);

  const referral = await db.prepare(`SELECT source_id, referrer_id, referred_user_id, referral_code, status,
    reward_coins, completed_at, rewarded_at, ip_address FROM referrals
    WHERE referred_user_id = ?`).bind(claimantId).first();
  assert.equal(referral.referrer_id, referrerId);
  assert.equal(referral.referral_code, code);
  assert.equal(referral.status, "REWARDED");
  assert.equal(referral.reward_coins, 100);
  assert.ok(referral.completed_at && referral.rewarded_at);
  // Express supplies req.ip; Miniflare does not. The legacy field is optional.
  assert.ok(referral.ip_address === null || referral.ip_address === "127.0.0.1");

  const ledgers = await db.prepare(`SELECT user_id, amount, balance_before, balance_after, metadata
    FROM wallet_transactions WHERE source = 'REFERRAL_BONUS' AND json_extract(metadata, '$.referralId') = ?
    ORDER BY user_id`).bind(referral.source_id).all();
  assert.equal(ledgers.results.length, 2);
  for (const row of ledgers.results) {
    assert.equal(row.amount, 100);
    assert.equal(row.balance_before, 5000);
    assert.equal(row.balance_after, 5100);
  }
  assert.deepEqual(ledgers.results.map(row => JSON.parse(row.metadata).idempotencyKey).sort(), [
    `referral:${referral.source_id}:claimant`, `referral:${referral.source_id}:referrer`
  ]);

  const notification = await db.prepare("SELECT user_id, type, title, body, data FROM notifications WHERE title = 'Referral reward'")
    .first();
  assert.equal(notification.user_id, referrerId);
  assert.equal(notification.type, "SYSTEM");
  assert.equal(notification.body.includes("joined using your code"), true);
  assert.equal(JSON.parse(notification.data).rewardCoins, 100);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS count FROM notification_push_jobs
    WHERE notification_id = (SELECT source_id FROM notifications WHERE title = 'Referral reward') AND device_id = ?`)
    .bind(deviceId).first("count")), 1);

  const replay = await request("/api/referrals/claim", 200, {
    accessToken: claimant.accessToken, body: { code }
  });
  assert.deepEqual(replay.data, { reward: 100, message: "Referral code applied" });
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM referrals WHERE referred_user_id = ?").bind(claimantId).first("count")), 1);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM wallet_transactions WHERE source = 'REFERRAL_BONUS'").first("count")), 2);
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(claimantId).first("wallet_balance")), 5100);

  const stats = await request("/api/referrals/stats", 200, { accessToken: referrer.accessToken });
  assert.deepEqual(stats.data.stats, { total: 1, completed: 1, rewarded: 1, totalCoins: 100 });
  assert.equal(stats.data.referrals.length, 1);
  assert.equal(stats.data.referrals[0]._id, referral.source_id);
  assert.equal(stats.data.referrals[0].referredUserId._id, claimantId);
  assert.ok(stats.data.referrals[0].referredUserId.avatarParts);
  const isolation = await request("/api/referrals/stats", 200, { accessToken: claimant.accessToken });
  assert.deepEqual(isolation.data.stats, { total: 0, completed: 0, rewarded: 0, totalCoins: 0 });
  assert.deepEqual(isolation.data.referrals, []);
}
