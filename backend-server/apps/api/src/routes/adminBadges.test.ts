import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";

const { assertBadgeAssetTarget } = await import("./adminBadges.js");

function badgeAsset(overrides: Record<string, unknown> = {}) {
  return {
    ownerType: "badge",
    ownerId: "level_5",
    status: "published",
    publicUrl: "https://cdn.example.com/assets/badge_level_5_v3_full.webp",
    variants: [{ name: "full", url: "https://cdn.example.com/assets/badge_level_5_v3_full.webp" }],
    ...overrides
  } as never;
}

test("badge asset validation accepts published art owned by the badge", () => {
  assert.doesNotThrow(() => assertBadgeAssetTarget(badgeAsset(), "level_5"));
});

test("badge asset validation rejects art owned by another badge or owner type", () => {
  assert.throws(() => assertBadgeAssetTarget(badgeAsset({ ownerId: "host_3" }), "level_5"), /does not belong/);
  assert.throws(() => assertBadgeAssetTarget(badgeAsset({ ownerType: "cosmetic" }), "level_5"), /does not belong/);
});

test("badge asset validation rejects unpublished art or art without a usable URL", () => {
  assert.throws(() => assertBadgeAssetTarget(badgeAsset({ status: "staging" }), "level_5"), /not published/);
  assert.throws(() => assertBadgeAssetTarget(badgeAsset({ status: "archived" }), "level_5"), /not published/);
  assert.throws(() => assertBadgeAssetTarget(badgeAsset({ publicUrl: undefined, variants: [] }), "level_5"), /not published/);
});
