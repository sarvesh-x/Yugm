import assert from "node:assert/strict";
import { test } from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";
process.env.STORAGE_DRIVER = "s3";
process.env.R2_PUBLIC_MEDIA_BUCKET ??= "yugm-public-media";
process.env.R2_MEDIA_PUBLIC_URL ??= "https://media.example.test";

const {
  assertImageSignature,
  assertStagedUpload,
  classifyCompletionFailure,
  exceedsUserQuota,
  mediaAccessDecision,
  toPublicMedia,
  validateUploadRequest
} = await import("./media.js");

test("managed upload validation rejects unsupported categories, MIME types, sizes and path-like names", () => {
  const valid = { category: "AVATAR", contentType: "image/jpeg", bytes: 1024, fileName: "photo.jpg", actorId: "user-1" };
  assert.deepEqual(validateUploadRequest(valid), { category: "AVATAR", contentType: "image/jpeg", extension: "jpg" });
  assert.throws(() => validateUploadRequest({ ...valid, category: "COVER" }), /not yet available/);
  assert.throws(() => validateUploadRequest({ ...valid, category: "../ADMIN" }), /Unsupported media category/);
  assert.throws(() => validateUploadRequest({ ...valid, contentType: "application/pdf" }), /content type/);
  assert.throws(() => validateUploadRequest({ ...valid, bytes: 1.5 }), /between 1 byte/);
  assert.throws(() => validateUploadRequest({ ...valid, bytes: 6 * 1024 * 1024 }), /between 1 byte/);
  assert.throws(() => validateUploadRequest({ ...valid, fileName: "photo.j p g" }), /file name/);
  assert.throws(() => validateUploadRequest({ ...valid, fileName: "../photo.jpg" }), /file name/);
  assert.throws(() => validateUploadRequest({ ...valid, fileName: "..\\photo.jpg" }), /file name/);
});

test("image signature verification rejects masquerading files", () => {
  assert.doesNotThrow(() => assertImageSignature(Buffer.from("89504e470d0a1a0a0000000d49484452", "hex")));
  assert.doesNotThrow(() => assertImageSignature(Buffer.from("ffd8ffe000104a46494600", "hex")));
  assert.throws(() => assertImageSignature(Buffer.from("not-an-image-at-all")), /not a supported image/);
});

test("public media DTO resolves canonical keys and never discloses a stored signed URL", () => {
  const key = "users/user-1/avatars/v1/avatar_256.webp";
  const media = {
    _id: "media-1",
    ownerType: "USER",
    ownerId: "user-1",
    mediaType: "IMAGE",
    category: "AVATAR",
    bucket: "public-media",
    storageKey: key,
    contentType: "image/webp",
    fileSize: 100,
    checksum: "a".repeat(64),
    visibility: "PUBLIC",
    processingStatus: "READY",
    moderationStatus: "APPROVED",
    version: 1,
    variants: [
      {
        name: "avatar_256",
        bucket: "public-media",
        key,
        contentType: "image/webp",
        bytes: 100,
        url: "https://media.example.test/signed?X-Amz-Signature=must-not-leak"
      },
      {
        name: "original",
        bucket: "originals",
        key: "users/user-1/avatars/v1/original.jpg",
        contentType: "image/jpeg",
        bytes: 200
      }
    ]
  };
  const dto = toPublicMedia(media as unknown as Parameters<typeof toPublicMedia>[0]);
  assert.equal(dto.variants.length, 1);
  assert.equal(dto.variants[0].url, `https://media.example.test/${key}`);
  const serialized = JSON.stringify(dto);
  assert.ok(!serialized.includes("X-Amz-Signature"));
  assert.ok(!serialized.includes("must-not-leak"));
  assert.ok(!serialized.includes("originals"));
});

test("quota checks include live reservations at the exact boundary", () => {
  const quota = 512 * 1024 * 1024;
  assert.equal(exceedsUserQuota(quota - 10, 10), false);
  assert.equal(exceedsUserQuota(quota - 9, 10), true);
});

test("staged upload validation rejects size mismatches and masquerading files", () => {
  const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
  assert.doesNotThrow(() => assertStagedUpload(png.length, { body: png, contentLength: png.length }));
  assert.throws(
    () => assertStagedUpload(png.length + 1, { body: png, contentLength: png.length }),
    /does not match/
  );
  assert.throws(
    () => assertStagedUpload(4, { body: Buffer.from("nope"), contentLength: 4 }),
    /not a supported image/
  );
});

test("completion failure classification keeps expiry and conflict semantics", () => {
  assert.deepEqual(classifyCompletionFailure(null), {
    status: 409,
    message: "Upload session is no longer pending"
  });
  assert.deepEqual(classifyCompletionFailure({ status: "PENDING" }), {
    status: 410,
    message: "Upload session has expired",
    markExpired: true
  });
  assert.deepEqual(classifyCompletionFailure({ status: "CANCELLED" }), {
    status: 409,
    message: "Upload session is no longer pending"
  });
  assert.deepEqual(classifyCompletionFailure({ status: "COMPLETED" }), {
    status: 409,
    message: "Upload session is no longer pending"
  });
});

test("private media access requires ownership or message participation", () => {
  const base = {
    ownerType: "MESSAGE",
    ownerId: "message-1",
    visibility: "PRIVATE",
    processingStatus: "READY",
    moderationStatus: "APPROVED"
  };
  assert.equal(mediaAccessDecision({ ...base, ownerType: "USER", ownerId: "user-1" }, "user-1", false), "owner");
  assert.equal(mediaAccessDecision(base, "user-2", true), "participant");
  assert.equal(mediaAccessDecision(base, "user-2", false), "deny");
  assert.equal(mediaAccessDecision({ ...base, visibility: "PUBLIC" }, "user-2", false), "public");
  assert.equal(mediaAccessDecision({ ...base, deletedAt: new Date() }, "user-2", true), "deny");
  assert.equal(mediaAccessDecision({ ...base, processingStatus: "FAILED" }, "user-2", true), "deny");
  assert.equal(mediaAccessDecision({ ...base, moderationStatus: "REJECTED" }, "user-2", true), "deny");
});
