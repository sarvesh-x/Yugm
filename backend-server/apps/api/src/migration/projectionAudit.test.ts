import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeSnapshotManifest } from "./export.js";
import { auditProjection } from "./projectionAudit.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import type { SourceRecord } from "./types.js";

async function snapshot(id: string, watermark: string, records: SourceRecord[]): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-projection-"));
  const store = new FileSystemSnapshotStore(directory);
  const batch = await store.writeCollection("users", 0, records);
  await writeSnapshotManifest(
    store,
    { snapshotId: id, sourceDatabase: "fixture", watermark, toolVersion: "test" },
    [{ name: "users", count: records.length, batches: [{ index: 0, count: records.length, ...batch }] }]
  );
  return directory;
}

async function metrics(template: Record<string, unknown>): Promise<string> {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-projection-metrics-"));
  const file = path.join(directory, "metrics.json");
  await writeFile(file, JSON.stringify(template), "utf8");
  return file;
}

const baseMetrics = {
  snapshotId: "projection-metrics",
  sourceEnvironment: "approved-metrics",
  collectedAt: "2026-11-23T00:00:00.000Z",
  workersPaid: true,
  relationalBytes: 200,
  indexBytes: 0,
  projected12MonthTotalBytes: 900_000,
  largestRowBytes: 1,
  binariesInD1Bytes: 0,
  largestStatementBytes: 1,
  maxBoundParameters: 1,
  largestQueryResultBytes: 1,
  p99QueryDurationMs: 1,
  averageWriteDurationMs: 1,
  peakWritesPerSecond: 1,
  peakQueriesPerInvocation: 1,
};

test("compares declared projection with growth observed between snapshots", async () => {
  const before = await snapshot("before", "2026-11-22T00:00:00.000Z", [{ _id: "u1", name: "Aarav" }]);
  const after = await snapshot("after", "2026-11-22T01:00:00.000Z", [
    { _id: "u1", name: "Aarav" },
    { _id: "u2", name: "Meera" },
  ]);
  const metricsFile = await metrics(baseMetrics);
  try {
    const report = await auditProjection(before, after, metricsFile);

    assert.equal(report.windowHours, 1);
    assert.ok(report.afterBytes > report.beforeBytes);
    assert.equal(report.currentTotalBytes, 200);
    assert.equal(report.projectedFromGrowthBytes, 200 + report.growthBytesPerHour! * 24 * 365);
    assert.equal(report.declaredAtLeastObserved, true);
    assert.ok(report.declaredToObservedRatio !== null && report.declaredToObservedRatio > 0);
    assert.equal(report.metricsMinusSnapshotBytes, 200 - report.afterBytes);
    assert.equal(report.reviewItems.length, 4);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
    await rm(path.dirname(metricsFile), { recursive: true, force: true });
  }
});

test("flags a projection below observed growth", async () => {
  const before = await snapshot("small-before", "2026-11-22T00:00:00.000Z", [{ _id: "u1", name: "Aarav" }]);
  const after = await snapshot("small-after", "2026-11-22T01:00:00.000Z", [
    { _id: "u1", name: "Aarav" },
    { _id: "u2", name: "Meera" },
  ]);
  const metricsFile = await metrics({ ...baseMetrics, projected12MonthTotalBytes: 1 });
  try {
    const report = await auditProjection(before, after, metricsFile);

    assert.equal(report.declaredAtLeastObserved, false);
    assert.match(report.digest, /^[a-f0-9]{64}$/);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
    await rm(path.dirname(metricsFile), { recursive: true, force: true });
  }
});

test("reports an invalid watermark window without projecting", async () => {
  const before = await snapshot("bad-before", "not-a-date", [{ _id: "u1" }]);
  const after = await snapshot("bad-after", "2026-11-22T01:00:00.000Z", [{ _id: "u1", extra: true }]);
  const metricsFile = await metrics(baseMetrics);
  try {
    const report = await auditProjection(before, after, metricsFile);

    assert.equal(report.windowHours, null);
    assert.equal(report.growthBytesPerHour, null);
    assert.equal(report.projectedFromGrowthBytes, null);
    assert.equal(report.declaredAtLeastObserved, null);
  } finally {
    await rm(before, { recursive: true, force: true });
    await rm(after, { recursive: true, force: true });
    await rm(path.dirname(metricsFile), { recursive: true, force: true });
  }
});
