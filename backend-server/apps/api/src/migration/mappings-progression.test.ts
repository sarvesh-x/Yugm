import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const A = "507f1f77bcf86cd799439011";
const B = "507f1f77bcf86cd799439012";
const SEASON = "507f1f77bcf86cd799439013";
const MISSION = "507f1f77bcf86cd799439014";
const GIFT = "507f1f77bcf86cd799439015";
const QUESTION = "507f1f77bcf86cd799439016";

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-progression");
  const result = applyMapping(collection, record, context);
  context.assertAccountedFor();
  return { context, result };
}

function table(result: { writes: Array<{ table: string; rows: TargetRow[] }> }, name: string): TargetRow[] {
  return result.writes.find((write) => write.table === name)?.rows ?? [];
}

function assertColumns(result: { writes: Array<{ table: string; rows: TargetRow[] }> }) {
  for (const write of result.writes) {
    for (const row of write.rows) {
      for (const key of Object.keys(row)) {
        assert.match(key, /^[A-Za-z_][A-Za-z0-9_]*$/, `${write.table}.${key}`);
      }
    }
  }
}

test("achievements keep six tiers, provenance and soft-quarantine inline binary", () => {
  const { result, context } = map("achievements", {
    _id: A, id: "badge-host", title: "Host", description: "Host three rooms",
    category: "SOCIAL", icon: "radio", imageUrl: "https://cdn.test/badge.png",
    imageData: Buffer.from("binary"), imageMime: "image/png", assetRef: "asset-1",
    kind: "ACHIEVEMENT", metric: "host_3", weeklyTarget: 3, hidden: false,
    tiers: [
      { tier: "MASTER", target: 10, rewardCoins: 500, rewardCosmetic: "frame_gold" },
      { tier: "BRONZE", target: 1, rewardCoins: 0 }
    ],
    order: 2, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "achievements")[0];
  const tiers = table(result, "achievement_tiers");
  assert.equal(result.rejected, false);
  assert.equal(row.id, "badge-host");
  assert.equal(row.category, "SOCIAL");
  assert.equal("image_data" in row, false);
  assert.equal(row.asset_ref, "asset-1");
  assert.equal(row.hidden, 0);
  assert.equal(tiers.length, 2);
  assert.equal(tiers[0].tier, "MASTER");
  assert.equal(tiers[0].reward_coins, 500);
  assert.equal(tiers[0].achievements_id, A);
  assert.equal(tiers[0].position, 0);
  assert.equal(tiers[1].reward_cosmetic, null);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["INVALID_REFERENCE"]);
  assertColumns(result);

  const bad = map("achievements", {
    _id: A, id: "x", title: "x", description: "x", tiers: [{ tier: "LEGENDARY", target: 1 }]
  });
  assert.equal(bad.result.rejected, false);
  assert.deepEqual(table(bad.result, "achievement_tiers"), []);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("battle passes promote the season object and keep reward claim state", () => {
  const { result } = map("battle_passes", {
    _id: A, season: { id: SEASON, name: "Season 1" }, userId: B, tier: "premium",
    level: 7, xp: 340, premium: true, expiresAt: "2026-03-31T00:00:00Z",
    rewards: [
      { level: 1, claimed: true, freeClaimed: true, premiumClaimed: false, rewardId: GIFT },
      { level: 5, claimed: false, freeClaimed: false, premiumClaimed: false }
    ],
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "battle_passes")[0];
  const rewards = table(result, "battle_pass_rewards");
  assert.equal(result.rejected, false);
  assert.equal(row.season_id, SEASON);
  assert.equal(row.season_name, "Season 1");
  assert.equal(row.user_id, B);
  assert.equal(row.tier, "premium");
  assert.equal(row.level, 7);
  assert.equal(row.premium, 1);
  assert.equal(rewards.length, 2);
  assert.equal(rewards[0].reward_id, GIFT);
  assert.equal(rewards[0].claimed, 1);
  assert.equal(rewards[0].battle_passes_id, A);
  assert.equal(rewards[1].reward_id, null);
  assertColumns(result);

  const bad = map("battle_passes", { _id: A, season: {}, userId: B, expiresAt: "2026-03-31T00:00:00Z" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["INVALID_ID", "MISSING_REQUIRED"]);
});

test("battle pass XP grants reject non-positive XP", () => {
  const good = map("battle_pass_xp_grants", {
    _id: A, userId: B, seasonId: SEASON, actionKey: "room_host", xpGained: 25,
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(good.result, "battle_pass_xp_grants")[0];
  assert.equal(good.result.rejected, false);
  assert.equal(row.action_key, "room_host");
  assert.equal(row.xp_gained, 25);

  const bad = map("battle_pass_xp_grants", { _id: A, userId: B, seasonId: SEASON, actionKey: "x", xpGained: 0 });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["OUT_OF_RANGE"]);
});

test("seasons keep integer config and deterministic reward JSON children", () => {
  const { result } = map("seasons", {
    _id: SEASON, key: "season_1", name: "Voyage", description: "Inaugural",
    startDate: "2025-01-01T00:00:00Z", endDate: "2025-03-31T00:00:00Z",
    maxLevel: 50, xpPerLevel: 100, premiumPrice: 999, active: true,
    rewards: [
      { level: 1, freeReward: { type: "coins", amount: 100 }, premiumReward: { type: "diamonds", amount: 50 } },
      { level: 5 }
    ],
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "seasons")[0];
  const rewards = table(result, "season_rewards");
  assert.equal(result.rejected, false);
  assert.equal(row.key, "season_1");
  assert.equal(row.active, 1);
  assert.equal(row.premium_price, 999);
  assert.equal(rewards.length, 2);
  assert.equal(rewards[0].free_reward, '{"amount":100,"type":"coins"}');
  assert.equal(rewards[0].premium_reward, '{"amount":50,"type":"diamonds"}');
  assert.equal(rewards[0].seasons_id, SEASON);
  assert.equal(rewards[1].free_reward, null);
  assertColumns(result);
});

test("missions flatten requirements/rewards/badge and preserve the season reference", () => {
  const { result } = map("missions", {
    _id: MISSION, key: "daily_host_2", type: "daily", title: "Host", description: "Host two rooms",
    requirements: { action: "room_host", target: 2, unit: "count" },
    rewards: { xp: 250, coins: 125, diamonds: 10, cosmeticId: "frame_gold", titleId: "title_host" },
    badge: { icon: "star", color: "#FFD700" }, seasonId: SEASON,
    startDate: "2026-01-01T00:00:00Z", active: true, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "missions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.requirements_action, "room_host");
  assert.equal(row.requirements_target, 2);
  assert.equal(row.requirements_unit, "count");
  assert.equal(row.rewards_xp, 250);
  assert.equal(row.rewards_diamonds, 10);
  assert.equal(row.rewards_cosmetic_id, "frame_gold");
  assert.equal(row.badge_color, "#FFD700");
  assert.equal(row.season_id, SEASON);
  assert.equal(row.active, 1);
  assertColumns(result);

  const bad = map("missions", { _id: MISSION, key: "x", type: "hourly", title: "x", description: "x", requirements: {} });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "MISSING_REQUIRED", "NON_INTEGER"]);
});

test("user missions and daily questions/answers keep progress and visibility", () => {
  const um = map("user_missions", {
    _id: A, userId: B, missionId: MISSION, progress: 4, completed: true,
    completedAt: "2026-01-02T03:04:05Z", claimed: false, streakDay: 3
  });
  const umRow = table(um.result, "user_missions")[0];
  assert.equal(um.result.rejected, false);
  assert.equal(umRow.mission_id, MISSION);
  assert.equal(umRow.progress, 4);
  assert.equal(umRow.completed, 1);
  assert.equal(umRow.streak_day, 3);

  const dq = map("daily_questions", {
    _id: QUESTION, question: "Favourite colour?", category: "general",
    date: "2026-01-02T00:00:00Z", isActive: true
  });
  assert.equal(dq.result.rejected, false);
  assert.equal(table(dq.result, "daily_questions")[0].is_active, 1);

  const ans = map("user_daily_answers", {
    _id: A, userId: B, questionId: QUESTION, answer: "Blue", isPublic: false
  });
  const ansRow = table(ans.result, "user_daily_answers")[0];
  assert.equal(ans.result.rejected, false);
  assert.equal(ansRow.question_id, QUESTION);
  assert.equal(ansRow.is_public, 0);
});

test("mini-game challenges and scores keep enums, score bounds and JSON metadata", () => {
  const challenge = map("mini_game_challenges", {
    _id: A, challengerId: B, targetUserId: A, clanId: null, gameId: "vibe_tap",
    score: 4200, scoreId: B, message: "beat this", expiresAt: "2026-02-01T00:00:00Z",
    createdAt: "2026-01-02T03:04:05Z"
  });
  const cRow = table(challenge.result, "mini_game_challenges")[0];
  assert.equal(challenge.result.rejected, false);
  assert.equal(cRow.game_id, "vibe_tap");
  assert.equal(cRow.score, 4200);
  assert.equal(cRow.target_user_id, A);
  assert.equal(cRow.clan_id, null);
  assertColumns(challenge.result);

  const score = map("mini_game_scores", {
    _id: B, userId: B, gameId: "reflex_ring", score: 900, durationMs: 45000,
    rounds: 5, metadata: { z: 1, a: 2 }, createdAt: "2026-01-02T03:04:05Z"
  });
  const sRow = table(score.result, "mini_game_scores")[0];
  assert.equal(score.result.rejected, false);
  assert.equal(sRow.duration_ms, 45000);
  assert.equal(sRow.rounds, 5);
  assert.equal(sRow.metadata, '{"a":2,"z":1}');

  const bad = map("mini_game_scores", { _id: B, userId: B, gameId: "chess", score: 1 });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("cosmetics keep string IDs, integer price and asset provenance", () => {
  const { result } = map("cosmetics", {
    _id: "frame_gold", type: "avatarFrame", name: "Gold Frame", coinPrice: 499,
    rarity: "LEGENDARY", preview: "", isActive: true, rewardOnly: false,
    assetKind: "STATIC", assetUrl: "https://cdn.test/f.png", assetRef: "asset-2",
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "cosmetics")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.source_id, "frame_gold");
  assert.equal(row.coin_price, 499);
  assert.equal(row.rarity, "LEGENDARY");
  assert.equal(row.preview, "");
  assert.equal(row.asset_ref, "asset-2");
  assertColumns(result);

  const bad = map("cosmetics", { _id: "x", type: "t", name: "n", coinPrice: -1 });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["OUT_OF_RANGE"]);
});

test("immersive themes keep color JSON, animation JSON and promoted price", () => {
  const { result } = map("immersive_themes", {
    _id: SEASON, key: "theme_aurora", name: "Aurora", type: "room_background",
    category: "space", colors: ["#00F2FE", "#4FACFE"],
    animation: { type: "particles", config: { count: 80 } }, ambientSound: "ambience_lofi",
    price: { coins: 999, diamonds: 0 }, premium: false, available: true
  });
  const row = table(result, "immersive_themes")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.colors, '["#00F2FE","#4FACFE"]');
  assert.equal(row.animation, '{"config":{"count":80},"type":"particles"}');
  assert.equal(row.price_coins, 999);
  assert.equal(row.price_diamonds, 0);
  assert.equal(row.available, 1);
  assertColumns(result);
});

test("gift collections keep bonus config and gift child rows", () => {
  const { result } = map("gift_collections", {
    _id: A, name: "Romance", description: "For close friends", icon: "heart",
    bonus: { description: "+10% XP", xpMultiplier: 1.1, coinMultiplier: 0.5 },
    gifts: [GIFT, "bad-id"], isActive: true, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "gift_collections")[0];
  const items = table(result, "gift_collection_items");
  assert.equal(result.rejected, false);
  assert.equal(row.bonus_description, "+10% XP");
  assert.equal(row.bonus_xp_multiplier, 1.1);
  assert.equal(row.bonus_coin_multiplier, 0.5);
  assert.equal(items.length, 1);
  assert.equal(items[0].value, GIFT);
  assert.equal(items[0].gift_collections_id, A);
  assert.equal(items[0].position, 0);
  assertColumns(result);
});

test("gift collection multipliers reject non-finite and negative values", () => {
  const { result, context } = map("gift_collections", {
    _id: A, name: "Invalid", description: "Invalid multipliers", icon: "heart",
    bonus: { description: "+10% XP", xpMultiplier: Number.NaN, coinMultiplier: -1 },
    gifts: [], isActive: true
  });

  assert.equal(result.rejected, true);
  assert.deepEqual(
    context.quarantine.map((entry) => `${entry.field}:${entry.reason}`),
    ["bonus.xpMultiplier:NON_FINITE_NUMBER", "bonus.coinMultiplier:OUT_OF_RANGE"]
  );
});

test("gift inventories and wishlist items keep authoritative quantities and refs", () => {
  const inv = map("gift_inventories", {
    _id: A, userId: B, giftId: GIFT, quantity: 3, source: "received",
    upgradeLevel: 2, tradable: true, createdAt: "2026-01-02T03:04:05Z"
  });
  const invRow = table(inv.result, "gift_inventories")[0];
  assert.equal(inv.result.rejected, false);
  assert.equal(invRow.quantity, 3);
  assert.equal(invRow.source, "received");
  assert.equal(invRow.upgrade_level, 2);
  assert.equal(invRow.tradable, 1);

  const wish = map("wishlist_items", {
    _id: A, userId: B, giftId: GIFT, message: "please", isPublic: true
  });
  const wishRow = table(wish.result, "wishlist_items")[0];
  assert.equal(wish.result.rejected, false);
  assert.equal(wishRow.gift_id, GIFT);
  assert.equal(wishRow.message, "please");
  assert.equal(wishRow.is_public, 1);

  const bad = map("gift_inventories", { _id: A, userId: B, giftId: GIFT, quantity: 0 });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["OUT_OF_RANGE"]);
});

test("progression mappings are reachable through the registry", () => {
  for (const collection of [
    "achievements", "battle_passes", "battle_pass_xp_grants", "seasons", "missions",
    "user_missions", "daily_questions", "user_daily_answers", "mini_game_challenges",
    "mini_game_scores", "cosmetics", "immersive_themes", "gift_collections",
    "gift_inventories", "wishlist_items"
  ]) {
    assert.equal(typeof getMapping(collection), "function", collection);
  }
});
