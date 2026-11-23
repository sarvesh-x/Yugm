import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeSnapshotManifest } from "./export.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import { auditWatermark, readWatermarkInput, type WatermarkAuditOptions } from "./watermarkAudit.js";
import type { SourceRecord } from "./types.js";

const options: WatermarkAuditOptions = { field: "updatedAt" };
const located = (records: SourceRecord[]) => records.map((record) => ({ collection: "users", record }));

test("accepts a unique parseable composite cursor", () => {
  const report = auditWatermark(
    located([
      { _id: "507f1f77bcf86cd799439011", updatedAt: "2026-11-22T00:00:00.000Z" },
      { _id: "507f1f77bcf86cd799439012", updatedAt: "2026-11-23T00:00:00.000Z" },
    ]),
    "fixture",
    options
  );

  assert.equal(report.viable, true);
  assert.equal(report.alreadySorted, true);
  assert.equal(report.covered, 2);
  assert.equal(report.duplicateCompositeKeys, 0);
  assert.equal(report.minValue, "2026-11-22T00:00:00.000Z");
  assert.equal(report.maxValue, "2026-11-23T00:00:00.000Z");
});

test("reports missing and invalid watermark values", () => {
  const report = auditWatermark(
    located([
      { _id: "507f1f77bcf86cd799439011" },
      { _id: "507f1f77bcf86cd799439012", updatedAt: {} },
      { name: "missing id", updatedAt: "2026-11-23T00:00:00.000Z" },
    ]),
    "fixture",
    options
  );

  assert.equal(report.viable, false);
  assert.equal(report.missing, 1);
  assert.equal(report.invalid, 1);
  assert.equal(report.covered, 1);
  assert.deepEqual(report.missingIdExamples, ["507f1f77bcf86cd799439011", "<missing _id>"]);
  assert.deepEqual(report.invalidValueExamples, ["507f1f77bcf86cd799439012"]);
});

test("rejects duplicate composite keys", () => {
  const report = auditWatermark(
    located([
      { _id: "507f1f77bcf86cd799439011", updatedAt: "2026-11-23T00:00:00.000Z" },
      { _id: "507f1f77bcf86cd799439011", updatedAt: "2026-11-23T00:00:00.000Z" },
    ]),
    "fixture",
    options
  );

  assert.equal(report.viable, false);
  assert.equal(report.duplicateCompositeKeys, 1);
});

test("distinguishes input order from cursor viability", () => {
  const records = located([
    { _id: "507f1f77bcf86cd799439012", updatedAt: "2026-11-23T00:00:00.000Z" },
    { _id: "507f1f77bcf86cd799439011", updatedAt: "2026-11-22T00:00:00.000Z" },
  ]);
  const report = auditWatermark(records, "fixture", options);

  assert.equal(report.viable, true);
  assert.equal(report.alreadySorted, false);
  assert.equal(report.inversions, 1);
});

test("digest is stable and field changes alter it", () => {
  const records = located([{ _id: "507f1f77bcf86cd799439011", updatedAt: "2026-11-23T00:00:00.000Z" }]);
  const first = auditWatermark(records, "fixture", options);
  const repeated = auditWatermark(records, "fixture", options);
  const other = auditWatermark(records, "fixture", { field: "createdAt" });

  assert.equal(first.digest, repeated.digest);
  assert.notEqual(first.digest, other.digest);
});

test("reads a copied snapshot directory", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-watermark-snapshot-"));
  try {
    const store = new FileSystemSnapshotStore(directory);
    const batch = await store.writeCollection("users", 0, [
      { _id: "507f1f77bcf86cd799439011", updatedAt: "2026-11-23T00:00:00.000Z" },
    ]);
    await writeSnapshotManifest(
      store,
      { snapshotId: "watermark-snapshot", sourceDatabase: "fixture", watermark: "2026-11-23T00:00:00.000Z", toolVersion: "test" },
      [{ name: "users", count: 1, batches: [{ index: 0, count: 1, ...batch }] }]
    );

    const input = await readWatermarkInput({ snapshot: directory });
    const report = auditWatermark(input.records, input.source, options);

    assert.equal(input.source, "watermark-snapshot");
    assert.equal(report.covered, 1);
    assert.equal(report.viable, true);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("requires exactly one input mode and a non-empty field", async () => {
  await assert.rejects(() => readWatermarkInput({}), /exactly one of/);
  await assert.rejects(
    () => readWatermarkInput({ input: "a.jsonl", snapshot: "b" }),
    /exactly one of/
  );
  assert.throws(() => auditWatermark([], "fixture", { field: "" }), /field must be a non-empty string/);
});
