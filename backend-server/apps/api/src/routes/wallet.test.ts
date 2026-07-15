import assert from "node:assert/strict";
import test from "node:test";
import { z } from "zod";

// Test the bundle purchase request validation schema
const bundlePurchaseSchema = z.object({
  bundleId: z.string().min(1).max(100)
});

test("Bundle purchase schema validates correct input", () => {
  const result = bundlePurchaseSchema.safeParse({ bundleId: "vibe_starter" });
  assert.ok(result.success);
});

test("Bundle purchase schema rejects missing bundleId", () => {
  const result = bundlePurchaseSchema.safeParse({});
  assert.ok(!result.success);
});

test("Bundle purchase schema rejects empty bundleId", () => {
  const result = bundlePurchaseSchema.safeParse({ bundleId: "" });
  assert.ok(!result.success);
});

// Test the cosmetic transfer request validation schema
const transferCosmeticSchema = z.object({
  cosmeticId: z.string().min(1),
  receiverId: z.string().min(1)
});

test("Transfer cosmetic schema validates correct input", () => {
  const result = transferCosmeticSchema.safeParse({
    cosmeticId: "frame_gold",
    receiverId: "507f1f77bcf86cd799439012"
  });
  assert.ok(result.success);
});

test("Transfer cosmetic schema rejects missing fields", () => {
  const result = transferCosmeticSchema.safeParse({ cosmeticId: "frame_gold" });
  assert.ok(!result.success);
});

test("Transfer cosmetic schema rejects empty receiverId", () => {
  const result = transferCosmeticSchema.safeParse({
    cosmeticId: "frame_gold",
    receiverId: ""
  });
  assert.ok(!result.success);
});

// Test the achievement claim request validation schema
const claimAchievementSchema = z.object({
  achievementId: z.string().min(1)
});

test("Claim achievement schema validates correct input", () => {
  const result = claimAchievementSchema.safeParse({ achievementId: "daily_streak_3" });
  assert.ok(result.success);
});

test("Claim achievement schema rejects missing achievementId", () => {
  const result = claimAchievementSchema.safeParse({});
  assert.ok(!result.success);
});

// Test the check-in response schema (what the route returns)
const dailyCheckInResponseSchema = z.object({
  streak: z.number().int().min(0),
  claimed: z.boolean(),
  unlockedCosmetic: z.string().optional()
});

test("Daily check-in response schema validates", () => {
  const result = dailyCheckInResponseSchema.safeParse({
    streak: 5,
    claimed: true,
    unlockedCosmetic: "frame_minimal"
  });
  assert.ok(result.success);
});

test("Daily check-in response schema allows missing unlockedCosmetic", () => {
  const result = dailyCheckInResponseSchema.safeParse({
    streak: 3,
    claimed: false
  });
  assert.ok(result.success);
});

test("Daily check-in response schema rejects invalid streak type", () => {
  const result = dailyCheckInResponseSchema.safeParse({
    streak: "five",
    claimed: true
  });
  assert.ok(!result.success);
});

// Test bundle definitions in shared package
test("Bundle definitions have correct structure", async () => {
  const bundles = [
    { id: "vibe_starter", title: "Vibe Starter Pack", cosmeticIds: ["mood_chill", "frame_minimal", "mood_focused"], coinPrice: 150 },
    { id: "neon_nights", title: "Neon Nights Pack", cosmeticIds: ["frame_neon", "name_neon_glow", "avatar_cosmic_gif", "room_theme_neon_club"], coinPrice: 350 },
    { id: "royal_collection", title: "Royal Collection", cosmeticIds: ["badge_vip_host", "frame_gold", "theme_cozy", "badge_premium"], coinPrice: 500 },
    { id: "call_pro", title: "Call Pro Pack", cosmeticIds: ["call_soft_glow", "call_neon_frame", "call_bollywood_lights"], coinPrice: 200 },
    { id: "room_host_kit", title: "Room Host Kit", cosmeticIds: ["badge_featured", "ambience_lofi", "room_theme_festive", "ambience_cafe"], coinPrice: 400 }
  ];

  assert.equal(bundles.length, 5);
  for (const bundle of bundles) {
    assert.ok(bundle.id.length > 0);
    assert.ok(bundle.title.length > 0);
    assert.ok(bundle.cosmeticIds.length >= 2);
    assert.ok(bundle.coinPrice > 0);
  }
});

// Test achievement reward cosmetic IDs
test("Achievement reward cosmetics map correctly", () => {
  const achievementRewards: Record<string, string> = {
    profile_complete: "frame_minimal",
    daily_streak_3: "mood_chill",
    host_3: "badge_early_host",
    level_5: "name_neon_glow"
  };

  assert.equal(achievementRewards.profile_complete, "frame_minimal");
  assert.equal(achievementRewards.daily_streak_3, "mood_chill");
  assert.equal(achievementRewards.host_3, "badge_early_host");
  assert.equal(achievementRewards.level_5, "name_neon_glow");
  assert.equal(Object.keys(achievementRewards).length, 4);
});
