import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";

const { buildPublicStorageUrl, managedAvatarKeyFromUrl } = await import("./storage.js");

test("public storage URLs prefer the configured public base", () => {
  assert.equal(
    buildPublicStorageUrl("avatars/user_1.jpg", {
      publicBaseUrl: "https://cdn.example.test/",
      bucket: "yugm-media",
      region: "auto"
    }),
    "https://cdn.example.test/avatars/user_1.jpg"
  );
});

test("custom S3-compatible endpoints require a public base URL", () => {
  assert.throws(
    () => buildPublicStorageUrl("avatars/user_1.jpg", {
      endpoint: "https://account.r2.cloudflarestorage.com",
      bucket: "yugm-media",
      region: "auto"
    }),
    /S3_PUBLIC_BASE_URL/
  );
});

test("standard S3 keeps the virtual-hosted fallback", () => {
  assert.equal(
    buildPublicStorageUrl("avatars/user_1.jpg", { bucket: "yugm-media", region: "ap-south-1" }),
    "https://yugm-media.s3.ap-south-1.amazonaws.com/avatars/user_1.jpg"
  );
});

test("managed avatar keys only match the configured public base and avatar prefix", () => {
  const base = "https://cdn.example.test";

  assert.equal(
    managedAvatarKeyFromUrl("https://cdn.example.test/avatars/user_1.jpg", base),
    "avatars/user_1.jpg"
  );
  assert.equal(
    managedAvatarKeyFromUrl("https://cdn.example.test/avatars/user_1.jpg?v=2", base),
    "avatars/user_1.jpg"
  );
  assert.equal(managedAvatarKeyFromUrl("https://cdn.example.test/covers/user_1.jpg", base), null);
  assert.equal(managedAvatarKeyFromUrl("https://other.example.test/avatars/user_1.jpg", base), null);
  assert.equal(managedAvatarKeyFromUrl("https://cdn.example.test/avatars/../secrets.txt", base), null);
  assert.equal(managedAvatarKeyFromUrl("data:image/jpeg;base64,AAAA", base), null);
  assert.equal(managedAvatarKeyFromUrl(null, base), null);
  assert.equal(managedAvatarKeyFromUrl("https://cdn.example.test/avatars/user_1.jpg", undefined), null);
});
