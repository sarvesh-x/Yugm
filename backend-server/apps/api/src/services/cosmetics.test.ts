import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";

const { toPublicCosmetic } = await import("./cosmetics.js");

const legacyCosmetic = {
  _id: "avatar_nova_static",
  type: "AVATAR_ASSET",
  name: "Nova Static Avatar",
  coinPrice: 299,
  rarity: "RARE",
  preview: "avatar_nova",
  isActive: true,
  assetKind: "STATIC",
  assetUrl: "https://api.dicebear.com/9.x/adventurer/png?seed=YugmNova",
  assetRef: undefined
};

const publishedAsset = {
  id: "asset-1",
  ownerType: "cosmetic" as const,
  ownerId: "avatar_nova_static",
  status: "published" as const,
  version: 2,
  originalName: "nova.png",
  mimeType: "image/png",
  bytes: 1024,
  width: 512,
  height: 512,
  sha256: "abc",
  publicUrl: "https://cdn.example.com/assets/nova_v2_full.webp",
  variants: [
    {
      name: "full",
      key: "assets/nova_v2_full.webp",
      url: "https://cdn.example.com/assets/nova_v2_full.webp",
      contentType: "image/webp",
      bytes: 900,
      width: 512,
      height: 512
    },
    {
      name: "preview",
      key: "assets/nova_v2_preview.webp",
      url: "https://cdn.example.com/assets/nova_v2_preview.webp",
      contentType: "image/webp",
      bytes: 200,
      width: 256,
      height: 256
    }
  ],
  createdBy: "admin-1",
  createdAt: new Date("2026-01-01T00:00:00.000Z"),
  updatedAt: new Date("2026-01-01T00:00:00.000Z")
};

test("legacy cosmetic resolves from assetUrl without managed asset metadata", () => {
  const dto = toPublicCosmetic(legacyCosmetic);
  assert.equal(dto.id, "avatar_nova_static");
  assert.equal(dto.assetUrl, legacyCosmetic.assetUrl);
  assert.equal(dto.assetKind, "STATIC");
  assert.equal(dto.assetId, undefined);
  assert.equal(dto.assetVersion, undefined);
  assert.equal(dto.assetVariants, undefined);
});

test("published asset overrides legacy URL and exposes immutable version and variants", () => {
  const dto = toPublicCosmetic({ ...legacyCosmetic, assetRef: publishedAsset.id }, publishedAsset);
  assert.equal(dto.assetUrl, publishedAsset.publicUrl);
  assert.equal(dto.assetId, "asset-1");
  assert.equal(dto.assetVersion, 2);
  assert.equal(dto.assetVariants?.length, 2);
  assert.equal(dto.assetVariants?.[1].name, "preview");
  assert.equal(dto.assetVariants?.[1].url, publishedAsset.variants[1].url);
  assert.equal(dto.assetVariants?.[0].width, 512);
});

test("full variant URL is used when publicUrl is absent", () => {
  const dto = toPublicCosmetic({ ...legacyCosmetic, assetRef: publishedAsset.id }, {
    ...publishedAsset,
    publicUrl: undefined
  });
  assert.equal(dto.assetUrl, publishedAsset.variants[0].url);
});

test("incomplete or unpublished asset falls back to the legacy URL", () => {
  const dto = toPublicCosmetic({ ...legacyCosmetic, assetRef: publishedAsset.id }, {
    ...publishedAsset,
    status: "staging",
    publicUrl: undefined,
    variants: []
  });
  assert.equal(dto.assetUrl, legacyCosmetic.assetUrl);
});

test("a missing cosmetic URL stays absent", () => {
  const dto = toPublicCosmetic({ ...legacyCosmetic, assetUrl: undefined });
  assert.equal(dto.assetUrl, undefined);
  assert.equal(dto.preview, "avatar_nova");
});
