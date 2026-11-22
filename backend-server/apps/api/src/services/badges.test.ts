import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";

const { badgePublicArt, publicBadge } = await import("./badges.js");

const publishedAsset = {
  id: "asset-badge-1",
  version: 3,
  publicUrl: "https://cdn.example.com/assets/badge_level_5_v3_full.webp",
  variants: [
    {
      name: "full",
      key: "assets/badge_level_5_v3_full.webp",
      url: "https://cdn.example.com/assets/badge_level_5_v3_full.webp",
      contentType: "image/webp",
      bytes: 900,
      width: 512,
      height: 512
    },
    {
      name: "preview",
      key: "assets/badge_level_5_v3_preview.webp",
      url: "https://cdn.example.com/assets/badge_level_5_v3_preview.webp",
      contentType: "image/webp",
      bytes: 200,
      width: 256,
      height: 256
    }
  ]
};

const definition = {
  id: "level_5",
  title: "Level Five",
  description: "Reach level five",
  category: "ENGAGEMENT" as const,
  icon: "trophy",
  kind: "ACHIEVEMENT" as const,
  imageUrl: "/api/badge-art/level_5/legacy",
  assetRef: publishedAsset.id,
  metric: "level_5" as const,
  tiers: [{ tier: "BRONZE" as const, target: 5, rewardCoins: 0 }],
  order: 1
};

test("legacy badge art is returned unchanged without managed asset metadata", () => {
  const art = badgePublicArt({ imageUrl: definition.imageUrl });
  assert.equal(art.imageUrl, definition.imageUrl);
  assert.equal((art as { assetId?: string }).assetId, undefined);
  assert.equal((art as { assetVariants?: unknown }).assetVariants, undefined);
});

test("published badge asset overrides the legacy image URL and exposes registry variants", () => {
  const art = badgePublicArt({ imageUrl: definition.imageUrl, asset: publishedAsset });
  assert.equal(art.imageUrl, publishedAsset.publicUrl);
  assert.equal(art.assetId, publishedAsset.id);
  assert.equal(art.assetVersion, 3);
  assert.equal(art.assetVariants?.length, 2);
  assert.equal(art.assetVariants?.[1].name, "preview");
  assert.equal(art.assetVariants?.[1].width, 256);
});

test("full variant URL is used when a published asset has no publicUrl", () => {
  const art = badgePublicArt({ imageUrl: definition.imageUrl, asset: { ...publishedAsset, publicUrl: undefined } });
  assert.equal(art.imageUrl, publishedAsset.variants[0].url);
});

test("public badge DTO carries managed art alongside earned state", () => {
  const badge = publicBadge({ ...definition, asset: publishedAsset }, {
    badgeId: "level_5",
    tier: "BRONZE",
    earnedAt: new Date("2026-01-01T00:00:00.000Z")
  }, new Date("2026-01-02T00:00:00.000Z"));
  assert.equal(badge.unlocked, true);
  assert.equal(badge.tier, "BRONZE");
  assert.equal(badge.imageUrl, publishedAsset.publicUrl);
  assert.equal(badge.assetId, publishedAsset.id);
  assert.equal(badge.assetVersion, 3);
});
