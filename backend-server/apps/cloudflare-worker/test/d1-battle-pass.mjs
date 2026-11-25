import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1BattlePass(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const now = new Date();
  const currentStart = new Date(now.getTime() - 1000).toISOString();
  const currentEnd = new Date(now.getTime() + 30 * 86_400_000).toISOString();
  const previousEnd = currentStart;
  const previousStart = new Date(now.getTime() - 60 * 86_400_000).toISOString();
  const stamp = now.toISOString();
  const seasonId = id();
  const previousSeasonId = id();
  const ownerPassId = id();
  const visitorPassId = id();
  const previousPassId = id();
  const safetyId = id();
  const bpKey = `bp:${seasonId}:${ownerId}`;
  const rewardJson = (reward) => JSON.stringify(reward);

  await db.batch([
    db.prepare("UPDATE seasons SET active = 0"),
    ...[seasonId, previousSeasonId].map(rowId => db.prepare("DELETE FROM seasons WHERE source_id = ?").bind(rowId)),
    db.prepare(`INSERT INTO seasons (source_id, key, name, description, start_date, end_date, max_level,
      xp_per_level, premium_price, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 50, 100, 999, 1, ?, ?)`)
      .bind(seasonId, "fixture_bp_current", "Fixture Current Season", "Fixture battle pass season", currentStart, currentEnd, stamp, stamp),
    db.prepare(`INSERT INTO seasons (source_id, key, name, description, start_date, end_date, max_level,
      xp_per_level, premium_price, active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 50, 100, 999, 0, ?, ?)`)
      .bind(previousSeasonId, "fixture_bp_previous", "Fixture Previous Season", "Fixture ended season", previousStart, previousEnd, stamp, stamp),
    ...[
      [seasonId, 1, { type: "coins", amount: 123 }, { type: "diamonds", amount: 50 }],
      [seasonId, 5, { type: "cosmetic", id: "frame_gold" }, null],
      [seasonId, 10, { type: "xp", amount: 500 }, null],
      [seasonId, 50, { type: "title", id: "title_vibe_curator" }, null],
      [previousSeasonId, 1, { type: "coins", amount: 100 }, { type: "diamonds", amount: 20 }],
      [previousSeasonId, 5, { type: "cosmetic", id: "frame_minimal" }, null]
    ].map(([parentId, level, freeReward, premiumReward], position) => db.prepare(`INSERT INTO season_rewards
      (source_id, level, free_reward, premium_reward, seasons_id, position) VALUES (?, ?, ?, ?, ?, ?)`)
      .bind(`${parentId}:reward:${level}`, level, rewardJson(freeReward), premiumReward && rewardJson(premiumReward), parentId, position)),
    ...[ownerPassId, visitorPassId, previousPassId].map(rowId => db.prepare("DELETE FROM battle_passes WHERE source_id = ?").bind(rowId)),
    db.prepare(`INSERT INTO battle_passes (source_id, season_id, season_name, user_id, tier, level, xp,
      premium, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'free', 50, 0, 0, ?, ?, ?)`)
      .bind(ownerPassId, seasonId, "Fixture Current Season", ownerId, currentEnd, stamp, stamp),
    db.prepare(`INSERT INTO battle_passes (source_id, season_id, season_name, user_id, tier, level, xp,
      premium, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'free', 1, 0, 0, ?, ?, ?)`)
      .bind(visitorPassId, seasonId, "Fixture Current Season", visitorId, currentEnd, stamp, stamp),
    db.prepare(`INSERT INTO battle_passes (source_id, season_id, season_name, user_id, tier, level, xp,
      premium, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, 'premium', 5, 0, 1, ?, ?, ?)`)
      .bind(previousPassId, previousSeasonId, "Fixture Previous Season", ownerId, previousEnd, stamp, stamp),
    db.prepare("DELETE FROM battle_pass_rewards WHERE battle_passes_id IN (?, ?, ?)")
      .bind(ownerPassId, visitorPassId, previousPassId),
    ...[ownerPassId, visitorPassId].flatMap(passId => [
      [1, 0, 0, 0], [5, 0, 0, 0], [10, 0, 0, 0], [50, 0, 0, 0]
    ].map(([level, claimed, freeClaimed, premiumClaimed], position) => db.prepare(`INSERT INTO battle_pass_rewards
      (source_id, level, claimed, free_claimed, premium_claimed, battle_passes_id, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(`${passId}:reward:${level}`, level, claimed, freeClaimed, premiumClaimed, passId, position))),
    ...[[1, 1, 0, 0], [5, 0, 0, 0]].map(([level, claimed, freeClaimed, premiumClaimed], position) => db.prepare(`INSERT INTO battle_pass_rewards
      (source_id, level, claimed, free_claimed, premium_claimed, battle_passes_id, position)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(`${previousPassId}:reward:${level}`, level, claimed, freeClaimed, premiumClaimed, previousPassId, position)),
    db.prepare(`UPDATE users SET wallet_balance = 5000, diamond_balance = 0, xp = 0, level = 1,
      level_title = 'New Vibe', last_daily_check_in_at = NULL WHERE source_id = ?`).bind(ownerId),
    db.prepare(`UPDATE users SET wallet_balance = 1000, diamond_balance = 0, xp = 0, level = 1 WHERE source_id = ?`).bind(visitorId),
    db.prepare("DELETE FROM user_safety_statuses WHERE user_id = ?").bind(ownerId),
    db.prepare("DELETE FROM user_owned_cosmetics WHERE users_id = ? AND value = 'frame_gold'").bind(ownerId),
    db.prepare("DELETE FROM user_owned_titles WHERE users_id = ? AND value = 'title_vibe_curator'").bind(ownerId),
    db.prepare("DELETE FROM diamond_transactions WHERE idempotency_key = ?").bind(`${bpKey}:1:premium`),
    db.prepare("DELETE FROM xp_grants WHERE user_id = ? AND action_key = ?").bind(ownerId, `${bpKey}:10:free:xp`),
    db.prepare("DELETE FROM battle_pass_xp_grants WHERE user_id = ? AND season_id = ?").bind(ownerId, seasonId)
  ]);

  await request("/api/battle-pass", 401);
  await request("/api/battle-pass/purchase", 401, { body: {} });
  await request("/api/battle-pass/claim", 401, { body: { level: 1, track: "free" } });
  assert.equal((await request("/api/battle-pass/claim", 422, {
    accessToken: owner.accessToken, body: { level: 0, track: "free" }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/battle-pass/claim", 422, {
    accessToken: owner.accessToken, body: { level: 1, track: "gold" }
  })).error.code, "VALIDATION");

  const initial = await request("/api/battle-pass", 200, { accessToken: owner.accessToken });
  assert.equal(initial.data.schemaVersion, 1);
  assert.equal(initial.data.battlePass._id, ownerPassId);
  assert.equal(initial.data.battlePass.level, 50);
  assert.equal(initial.data.battlePass.premium, false);
  assert.equal(initial.data.battlePass.season.id, seasonId);
  assert.equal(initial.data.season._id, seasonId);
  assert.equal(initial.data.season.rewards.length, 4);
  assert.deepEqual(initial.data.previousSeasonSummary, {
    name: "Fixture Previous Season",
    level: 5,
    maxLevel: 50,
    premium: true,
    unclaimedRewards: 2,
    endedAt: previousEnd
  });

  assert.equal((await request("/api/battle-pass/claim", 409, {
    accessToken: visitor.accessToken, body: { level: 5, track: "free" }
  })).error.message, "Reach this level before claiming its reward");
  assert.equal((await request("/api/battle-pass/claim", 403, {
    accessToken: owner.accessToken, body: { level: 1, track: "premium" }
  })).error.message, "Premium rewards require the premium pass");
  assert.equal((await request("/api/battle-pass/claim", 404, {
    accessToken: owner.accessToken, body: { level: 2, track: "free" }
  })).error.message, "No reward is configured for this track");

  await db.prepare("UPDATE users SET wallet_balance = 998 WHERE source_id = ?").bind(ownerId).run();
  assert.equal((await request("/api/battle-pass/purchase", 402, { accessToken: owner.accessToken, body: {} })).error.code, "INSUFFICIENT_FUNDS");
  assert.equal((await db.prepare("SELECT premium FROM battle_passes WHERE source_id = ?").bind(ownerPassId).first("premium")), 0);
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(ownerId).first("wallet_balance")), 998);

  await db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level,
    warning_count, report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted,
    is_wallet_frozen, created_at, updated_at) VALUES (?, ?, 100, 'LOW', 0, 0, 0, 0, 0, 0, 1, ?, ?)`)
    .bind(safetyId, ownerId, stamp, stamp).run();
  assert.equal((await request("/api/battle-pass/purchase", 403, { accessToken: owner.accessToken, body: {} })).error.message, "Wallet is frozen");
  await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId).run();

  await db.prepare("UPDATE users SET wallet_balance = 5000 WHERE source_id = ?").bind(ownerId).run();
  const purchased = await request("/api/battle-pass/purchase", 200, { accessToken: owner.accessToken, body: {} });
  assert.equal(purchased.data.battlePass.premium, true);
  assert.equal(purchased.data.battlePass.tier, "premium");
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(ownerId).first("wallet_balance")), 4001);
  const debit = await db.prepare(`SELECT amount, balance_before, balance_after, metadata FROM wallet_transactions
    WHERE user_id = ? AND source = 'BATTLE_PASS_PURCHASE' AND json_extract(metadata, '$.seasonId') = ?`)
    .bind(ownerId, seasonId).first();
  assert.deepEqual([debit.amount, debit.balance_before, debit.balance_after], [999, 5000, 4001]);
  assert.equal(JSON.parse(debit.metadata).idempotencyKey, `battle-pass-purchase:${seasonId}:${ownerId}`);
  assert.equal((await request("/api/battle-pass/purchase", 409, { accessToken: owner.accessToken, body: {} })).error.message, "Battle pass already purchased");
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(ownerId).first("wallet_balance")), 4001);

  const coins = await request("/api/battle-pass/claim", 200, {
    accessToken: owner.accessToken, body: { level: 1, track: "free" }
  });
  assert.deepEqual(coins.data.claimedReward, { type: "coins", amount: 123 });
  assert.equal(coins.data.track, "free");
  assert.equal(coins.data.battlePass.rewards.find(reward => reward.level === 1).freeClaimed, true);
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(ownerId).first("wallet_balance")), 4124);
  const coinLedger = await db.prepare(`SELECT amount, balance_before, balance_after, metadata FROM wallet_transactions
    WHERE user_id = ? AND source = 'BATTLE_PASS_REWARD' AND json_extract(metadata, '$.idempotencyKey') = ?`)
    .bind(ownerId, `${bpKey}:1:free:coins`).first();
  assert.deepEqual([coinLedger.amount, coinLedger.balance_before, coinLedger.balance_after], [123, 4001, 4124]);

  const diamonds = await request("/api/battle-pass/claim", 200, {
    accessToken: owner.accessToken, body: { level: 1, track: "premium" }
  });
  assert.deepEqual(diamonds.data.claimedReward, { type: "diamonds", amount: 50 });
  assert.equal(diamonds.data.battlePass.rewards.find(reward => reward.level === 1).premiumClaimed, true);
  const diamondLedger = await db.prepare(`SELECT amount, balance_before, balance_after FROM diamond_transactions
    WHERE user_id = ? AND idempotency_key = ?`).bind(ownerId, `${bpKey}:1:premium`).first();
  assert.deepEqual([diamondLedger.amount, diamondLedger.balance_before, diamondLedger.balance_after], [50, 0, 50]);
  assert.equal((await db.prepare("SELECT diamond_balance FROM users WHERE source_id = ?").bind(ownerId).first("diamond_balance")), 50);

  const cosmetic = await request("/api/battle-pass/claim", 200, {
    accessToken: owner.accessToken, body: { level: 5, track: "free" }
  });
  assert.deepEqual(cosmetic.data.claimedReward, { type: "cosmetic", id: "frame_gold" });
  assert.ok(await db.prepare("SELECT 1 FROM user_owned_cosmetics WHERE users_id = ? AND value = 'frame_gold'")
    .bind(ownerId).first());
  assert.equal(cosmetic.data.battlePass.rewards.find(reward => reward.level === 5).freeClaimed, true);

  const xp = await request("/api/battle-pass/claim", 200, {
    accessToken: owner.accessToken, body: { level: 10, track: "free" }
  });
  assert.deepEqual(xp.data.claimedReward, { type: "xp", amount: 500 });
  const account = await db.prepare("SELECT xp, level, level_title, wallet_balance FROM users WHERE source_id = ?")
    .bind(ownerId).first();
  assert.deepEqual([account.xp, account.level, account.level_title, account.wallet_balance], [500, 4, "Vibe Maker", 4274]);
  const grant = await db.prepare("SELECT event, status, receipt FROM xp_grants WHERE user_id = ? AND action_key = ?")
    .bind(ownerId, `${bpKey}:10:free:xp`).first();
  assert.equal(grant.event, "BATTLE_PASS_REWARD");
  assert.equal(grant.status, "COMPLETE");
  assert.equal(JSON.parse(grant.receipt).xpAwarded, 500);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS count FROM battle_pass_xp_grants
    WHERE user_id = ? AND season_id = ? AND action_key LIKE 'BATTLE_PASS_REWARD:%'`)
    .bind(ownerId, seasonId).first("count")), 0);
  const levelLedger = await db.prepare(`SELECT amount, balance_before, balance_after, metadata FROM wallet_transactions
    WHERE user_id = ? AND source = 'LEVEL_REWARD' AND json_extract(metadata, '$.idempotencyKey') = ?`)
    .bind(ownerId, `${bpKey}:10:free:xp`).first();
  assert.deepEqual([levelLedger.amount, levelLedger.balance_before, levelLedger.balance_after], [150, 4124, 4274]);
  assert.deepEqual(JSON.parse(levelLedger.metadata).levels, [2, 3, 4]);

  const title = await request("/api/battle-pass/claim", 200, {
    accessToken: owner.accessToken, body: { level: 50, track: "free" }
  });
  assert.deepEqual(title.data.claimedReward, { type: "title", id: "title_vibe_curator" });
  assert.ok(await db.prepare("SELECT 1 FROM user_owned_titles WHERE users_id = ? AND value = 'title_vibe_curator'")
    .bind(ownerId).first());
  assert.equal(title.data.battlePass.rewards.find(reward => reward.level === 50).freeClaimed, true);

  assert.equal((await request("/api/battle-pass/claim", 409, {
    accessToken: owner.accessToken, body: { level: 1, track: "free" }
  })).error.message, "This reward has already been claimed");
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(ownerId).first("wallet_balance")), 4274);

  const visitorView = await request("/api/battle-pass", 200, { accessToken: visitor.accessToken });
  assert.equal(visitorView.data.battlePass._id, visitorPassId);
  assert.equal(visitorView.data.battlePass.level, 1);
  assert.equal(visitorView.data.battlePass.premium, false);
  assert.equal(visitorView.data.previousSeasonSummary, undefined);
}
