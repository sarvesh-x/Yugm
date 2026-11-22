import assert from "node:assert/strict";
import { test } from "node:test";
import { buildMediaInventory, type MediaInventoryRecord } from "./mediaInventory.js";

const records: MediaInventoryRecord[] = [
  {
    id: "m1",
    bucket: "public-media",
    storageKey: "users/u1/avatars/a.webp",
    category: "AVATAR",
    ownerType: "USER",
    mediaType: "IMAGE",
    visibility: "PUBLIC",
    processingStatus: "READY",
    moderationStatus: "APPROVED",
    fileSize: 100,
    checksum: "aa",
    variants: [
      { bucket: "assets", key: "users/u1/avatars/a-thumb.webp", bytes: 20 },
      { bucket: "assets", key: "users/u1/avatars/a-large.webp", bytes: 40 },
    ],
  },
  {
    id: "m2",
    bucket: "private-media",
    storageKey: "messages/c1/chat-images/b.jpg",
    category: "CHAT_IMAGE",
    ownerType: "MESSAGE",
    mediaType: "IMAGE",
    visibility: "PRIVATE",
    processingStatus: "READY",
    moderationStatus: "PENDING",
    fileSize: 250,
    checksum: "bb",
  },
  {
    id: "m3",
    bucket: "staging",
    storageKey: "users/u2/gallery/c.png",
    category: "GALLERY",
    ownerType: "USER",
    mediaType: "IMAGE",
    visibility: "PUBLIC",
    processingStatus: "FAILED",
    moderationStatus: "PENDING",
    fileSize: 0,
    deletedAt: "2026-11-22T00:00:00.000Z",
  },
];

test("aggregates counts, bytes and variants without asserting a bucket policy", () => {
  const report = buildMediaInventory(records);

  assert.equal(report.recordCount, 3);
  assert.equal(report.originalBytes, 350);
  assert.equal(report.variantBytes, 60);
  assert.equal(report.totalBytes, 410);

  assert.deepEqual(report.byCategory.AVATAR, { count: 1, bytes: 100, variants: 2, variantBytes: 60 });
  assert.equal(report.byBucket["public-media"].count, 1);
  assert.equal(report.byBucket["assets"].variants, 2);
  assert.equal(report.byVisibility.PRIVATE.bytes, 250);
  assert.equal(report.byOwnerType.MESSAGE.count, 1);
  assert.equal(report.byMediaType.IMAGE.count, 3);
  assert.equal(report.byBucketVisibility["private-media|PRIVATE"].count, 1);
  assert.equal(report.processingStatuses.FAILED, 1);
  assert.equal(report.moderationStatuses.PENDING, 2);
  assert.ok(report.byBucketVisibility["staging|PUBLIC"], "cross-tab reports staging instead of rejecting it");
});

test("reports objective data-quality problems", () => {
  const report = buildMediaInventory(records);

  assert.equal(report.dataQuality.missingChecksum, 1);
  assert.equal(report.dataQuality.nonPositiveBytes, 1);
  assert.equal(report.dataQuality.deletedRecords, 1);
  assert.deepEqual(report.dataQuality.duplicateStorageKeys, []);
});

test("detects duplicate original and variant storage keys", () => {
  const duplicate: MediaInventoryRecord = {
    ...records[0],
    id: "m4",
    variants: [{ bucket: "assets", key: "users/u1/avatars/a-thumb.webp", bytes: 20 }],
  };
  const report = buildMediaInventory([...records, duplicate]);

  assert.deepEqual(report.dataQuality.duplicateStorageKeys, [
    "assets/users/u1/avatars/a-thumb.webp",
    "public-media/users/u1/avatars/a.webp",
  ]);
});

test("digest is stable and independent of input order", () => {
  const first = buildMediaInventory(records);
  const reversed = buildMediaInventory([...records].reverse());

  assert.match(first.digest, /^[a-f0-9]{64}$/);
  assert.equal(first.digest, reversed.digest);
});

test("does not double count a variant stored in its original bucket", () => {
  const record: MediaInventoryRecord = {
    ...records[0],
    bucket: "assets",
    variants: [{ bucket: "assets", key: "users/u1/avatars/a-thumb.webp", bytes: 10 }],
  };
  const report = buildMediaInventory([record]);

  assert.deepEqual(report.byBucket.assets, { count: 1, bytes: 100, variants: 1, variantBytes: 10 });
  assert.equal(report.totalBytes, 110);
});

test("empty inventory is a valid zero report", () => {
  const report = buildMediaInventory([]);

  assert.equal(report.recordCount, 0);
  assert.equal(report.totalBytes, 0);
  assert.deepEqual(report.byCategory, {});
  assert.deepEqual(report.dataQuality.duplicateStorageKeys, []);
});
