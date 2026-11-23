import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildMediaQuery,
  buildQuotaReconciliation,
  buildSessionQuery,
  toAdminMediaDto,
  toAdminQuotaDto,
  toAdminSessionDto,
} from "./adminMedia.js";

test("builds bounded media registry filters and ignores unknown enums", () => {
  assert.deepEqual(
    buildMediaQuery({
      ownerType: "USER",
      ownerId: "user-1",
      category: "AVATAR",
      visibility: "PRIVATE",
      status: "READY",
      deleted: true,
    }),
    {
      ownerType: "USER",
      ownerId: "user-1",
      category: "AVATAR",
      visibility: "PRIVATE",
      processingStatus: "READY",
      deletedAt: { $exists: true, $ne: null },
    }
  );

  assert.deepEqual(buildMediaQuery({ category: "NOT_A_CATEGORY" }), {});
  assert.deepEqual(buildMediaQuery({ deleted: false }), { deletedAt: null });
});

test("builds bounded upload-session filters", () => {
  assert.deepEqual(
    buildSessionQuery({ userId: "user-1", status: "PENDING", category: "GALLERY" }),
    { userId: "user-1", status: "PENDING", category: "GALLERY" }
  );
  assert.deepEqual(buildSessionQuery({ status: "UNKNOWN" }), {});
});

test("media DTO exposes registry metadata without signed URLs", () => {
  const dto = toAdminMediaDto({
    _id: "media-1",
    ownerType: "ROOM",
    ownerId: "room-1",
    mediaType: "IMAGE",
    category: "CHAT_IMAGE",
    bucket: "private-media",
    storageKey: "rooms/room-1/a.webp",
    checksum: "hash",
    fileSize: 100,
    visibility: "PRIVATE",
    processingStatus: "READY",
    moderationStatus: "APPROVED",
    version: 2,
    variants: [{ name: "thumb" }],
    deletedAt: null,
    createdAt: new Date("2026-11-23T00:00:00.000Z"),
    signedUrl: "must-not-be-emitted",
  });

  assert.equal(dto.id, "media-1");
  assert.equal(dto.variantCount, 1);
  assert.equal(dto.storageKey, "rooms/room-1/a.webp");
  assert.equal(dto.createdAt, "2026-11-23T00:00:00.000Z");
  assert.ok(!JSON.stringify(dto).includes("must-not-be-emitted"));
});

test("session and quota DTOs expose only aggregate state", () => {
  const session = toAdminSessionDto({
    _id: "session-1",
    userId: "user-1",
    category: "AVATAR",
    status: "PENDING",
    expectedBytes: 100,
    ownerType: "USER",
    ownerId: "user-1",
    expiresAt: new Date("2026-11-24T00:00:00.000Z"),
    quotaReserved: false,
    signedUrl: "must-not-be-emitted",
  });
  const quota = toAdminQuotaDto({ _id: "user-1", bytes: 100, updatedAt: new Date("2026-11-23T00:00:00.000Z") });

  assert.equal(session.quotaReserved, false);
  assert.equal(session.expiresAt, "2026-11-24T00:00:00.000Z");
  assert.ok(!JSON.stringify(session).includes("must-not-be-emitted"));
  assert.deepEqual(quota, { userId: "user-1", bytes: 100, updatedAt: "2026-11-23T00:00:00.000Z" });
});

test("quota reconciliation reports drift and missing counters deterministically", () => {
  const first = buildQuotaReconciliation(
    [
      { userId: "ok", bytes: 100 },
      { userId: "over", bytes: 300 },
      { userId: "under", bytes: 50 },
    ],
    [
      { userId: "ok", bytes: 100 },
      { userId: "over", bytes: 200 },
      { userId: "under", bytes: 150 },
      { userId: "missing", bytes: 75 },
    ],
    2,
    "2026-11-23T00:00:00.000Z"
  );
  const second = buildQuotaReconciliation(
    [
      { userId: "ok", bytes: 100 },
      { userId: "over", bytes: 300 },
      { userId: "under", bytes: 50 },
    ],
    [
      { userId: "ok", bytes: 100 },
      { userId: "over", bytes: 200 },
      { userId: "under", bytes: 150 },
      { userId: "missing", bytes: 75 },
    ],
    2,
    "2026-11-23T01:00:00.000Z"
  );

  assert.equal(first.generatedAt, "2026-11-23T00:00:00.000Z");
  assert.equal(first.counterCount, 3);
  assert.equal(first.driftCount, 3);
  assert.equal(first.staleSessions, 2);
  assert.equal(first.rows.find((row) => row.userId === "ok")?.status, "OK");
  assert.equal(first.rows.find((row) => row.userId === "over")?.status, "OVER_RESERVED");
  assert.equal(first.rows.find((row) => row.userId === "under")?.status, "UNDER_RESERVED");
  assert.equal(first.rows.find((row) => row.userId === "missing")?.status, "MISSING_COUNTER");
  assert.equal(first.digest, second.digest);
  assert.equal(first.rows[0].userId, "over");
});
