import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";
process.env.STORAGE_DRIVER = "s3";
process.env.R2_ACCOUNT_ID ??= "test-account";
process.env.R2_ASSETS_BUCKET ??= "yugm-assets";
process.env.R2_PUBLIC_MEDIA_BUCKET ??= "yugm-public-media";
process.env.R2_PRIVATE_MEDIA_BUCKET ??= "yugm-private-media";
process.env.R2_ORIGINALS_BUCKET ??= "yugm-originals";
process.env.R2_STAGING_BUCKET ??= "yugm-staging";
process.env.R2_ASSETS_PUBLIC_URL ??= "https://assets.example.test";
process.env.R2_MEDIA_PUBLIC_URL ??= "https://media.example.test";

const r2 = await import("./r2.js");

test("media keys are structured, immutable and derived only from server identifiers", () => {
  const key = r2.buildMediaKey({
    bucket: "public-media",
    ownerType: "USER",
    ownerId: "user_123",
    category: "AVATAR",
    versionId: "11111111-2222-4333-8444-555555555555",
    variant: "avatar_256",
    extension: "webp"
  });
  assert.equal(
    key,
    "users/user_123/avatars/11111111-2222-4333-8444-555555555555/avatar_256.webp"
  );
  assert.ok(!key.includes(".."));
  assert.throws(
    () => r2.buildMediaKey({
      bucket: "staging",
      ownerType: "USER",
      ownerId: "u",
      category: "AVATAR",
      versionId: "v",
      variant: "../secret",
      extension: "png"
    }),
    /Invalid media variant/
  );
});

test("staging keys cannot be supplied by the client", () => {
  assert.equal(r2.buildStagingKey("session_1", "png"), "staging/session_1/original.png");
  assert.throws(() => r2.buildStagingKey("../admin", "png"), /Invalid upload session/);
  assert.throws(() => r2.buildStagingKey("session_1", "../../secret"), /Invalid media extension/);
});

test("public URLs use configured CDNs and never expose private buckets", () => {
  const key = "users/u/avatars/v1/avatar_256.webp";
  assert.equal(r2.resolvePublicUrl("public-media", key), `https://media.example.test/${key}`);
  assert.equal(r2.resolvePublicUrl("assets", key), `https://assets.example.test/${key}`);
  assert.throws(() => r2.resolvePublicUrl("private-media", key), /no public URL/);
  assert.throws(() => r2.resolvePublicUrl("staging", key), /no public URL/);
});

test("checksums are deterministic content digests", () => {
  const digest = r2.calculateChecksum(Buffer.from("yugm-media"));
  assert.equal(digest.length, 64);
  assert.equal(digest, r2.calculateChecksum(Buffer.from("yugm-media")));
  assert.notEqual(digest, r2.calculateChecksum(Buffer.from("other-media")));
});
