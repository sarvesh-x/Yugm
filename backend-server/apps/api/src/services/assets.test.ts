import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";

const {
  assertAssetOwner,
  assertAssetOwnerId,
  assertAssetSize,
  assetExtensionFor,
  assetPublicKey,
  assetStagingFileName,
  assertNoPublishedReferences,
  toPublicAsset
} = await import("./assets.js");
const { assertAssetStagingFileName } = await import("./storage.js");

test("archive rejects an asset that a catalog item still references", () => {
  assert.doesNotThrow(() => assertNoPublishedReferences(0));
  assert.throws(() => assertNoPublishedReferences(1), /still referenced/);
  assert.throws(() => assertNoPublishedReferences(3), /still referenced/);
});

test("asset owner validation accepts catalogue owners only", () => {
  assert.equal(assertAssetOwner("cosmetic"), "cosmetic");
  assert.equal(assertAssetOwner("badge"), "badge");
  assert.equal(assertAssetOwner("gift"), "gift");
  assert.throws(() => assertAssetOwner("wallet"), /Unsupported asset owner/);
});

test("asset owner IDs are bounded and path-safe", () => {
  assert.equal(assertAssetOwnerId(" frame_gold "), "frame_gold");
  assert.equal(assertAssetOwnerId("badge_2026_v2"), "badge_2026_v2");
  assert.throws(() => assertAssetOwnerId("../secret"), /Invalid asset owner ID/);
  assert.throws(() => assertAssetOwnerId("a".repeat(65)), /Invalid asset owner ID/);
});

test("asset MIME allow-list and size cap reject unsupported uploads", () => {
  assert.equal(assetExtensionFor("image/PNG"), "png");
  assert.equal(assetExtensionFor("image/jpeg"), "jpg");
  assert.equal(assetExtensionFor("image/gif"), "gif");
  assert.throws(() => assetExtensionFor("application/pdf"), /JPEG, PNG, WebP and GIF/);
  assert.equal(assertAssetSize(1024), 1024);
  assert.throws(() => assertAssetSize(0), /between 1 byte/);
  assert.throws(() => assertAssetSize(9 * 1024 * 1024), /between 1 byte/);
});

test("staging names are private-route safe and versioned", () => {
  const name = assetStagingFileName("cosmetic", "frame_gold", 3, "png", "ab12cd34");
  assert.equal(name, "cosmetic_frame_gold_v3_ab12cd34.png");
  assert.equal(assertAssetStagingFileName(name), name);
  assert.throws(() => assertAssetStagingFileName("../../etc/passwd.png"), /Invalid asset staging reference/);
  assert.throws(() => assertAssetStagingFileName("bad name.png"), /Invalid asset staging reference/);
});

test("published keys are immutable and variant-specific", () => {
  assert.equal(
    assetPublicKey("badge", "first_date", 2, "preview"),
    "assets/badge_first_date_v2_preview.webp"
  );
  assert.notEqual(
    assetPublicKey("badge", "first_date", 2, "full"),
    assetPublicKey("badge", "first_date", 3, "full")
  );
});

test("public asset DTO reads lean document IDs and omits unpublished URLs", () => {
  const dto = toPublicAsset({
    _id: "asset-1",
    ownerType: "cosmetic",
    ownerId: "frame_gold",
    status: "staging",
    version: 1,
    originalName: "frame.png",
    mimeType: "image/png",
    bytes: 128,
    width: 64,
    height: 64,
    sha256: "abc",
    stagingKey: "assets-staging/cosmetic_frame_gold_v1_ab12cd34.png",
    stagingUrl: "/api/admin/assets/staging/cosmetic_frame_gold_v1_ab12cd34.png",
    variants: [],
    createdBy: "admin-1",
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
    updatedAt: new Date("2026-01-01T00:00:00.000Z")
  } as never);
  assert.equal(dto.id, "asset-1");
  assert.equal(dto.publicUrl, undefined);
  assert.deepEqual(dto.variants, []);
});
