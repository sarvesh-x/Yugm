import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { writeSnapshotManifest } from "./export.js";
import { FileSystemSnapshotStore } from "./snapshot.js";
import type { CollectionSnapshot, SourceRecord } from "./types.js";
import { deriveMetricsFromSnapshot } from "./metricsFromSnapshot.js";

const BINARY = "A".repeat(200);

async function fixture() {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-metrics-"));
  const store = new FileSystemSnapshotStore(directory);
  const records: SourceRecord[] = [
    { _id: "u1", name: "Small", avatarData: BINARY },
    { _id: "u2", name: "A slightly longer name for row sizing" },
  ];
  const batch = await store.writeCollection("users", 0, records);
  const collections: CollectionSnapshot[] = [
    { name: "users", count: records.length, batches: [{ index: 0, count: records.length, ...batch }] },
  ];
  await writeSnapshotManifest(store, {
    snapshotId: "snap-metrics",
    sourceDatabase: "YugmFixtureLabel",
    watermark: "2026-11-22T00:00:00.000Z",
    toolVersion: "test",
  }, collections);
  return { directory, batch };
}

test("derives label fields and leaves owner-only fields null with provenance", async () => {
  const { directory } = await fixture();
  try {
    const report = await deriveMetricsFromSnapshot(directory);
    assert.equal(report.metrics.snapshotId, "snap-metrics");
    assert.equal(report.metrics.sourceEnvironment, "YugmFixtureLabel");
    assert.equal(report.metrics.collectedAt, "2026-11-22T00:00:00.000Z");
    for (const field of ["workersPaid", "indexBytes", "projected12MonthTotalBytes", "p99QueryDurationMs"] as const) {
      assert.equal(report.metrics[field], null);
    }
    const provenance = report.provenance.find((entry) => entry.field === "indexBytes");
    assert.equal(provenance?.status, "not-derivable");
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reconciles recomputed full bytes with the manifest batch bytes", async () => {
  const { directory, batch } = await fixture();
  try {
    const report = await deriveMetricsFromSnapshot(directory);
    assert.equal(report.reconciliation.recomputedFullBytes, batch.bytes);
    assert.equal(report.reconciliation.manifestBytes, batch.bytes);
    assert.equal(report.reconciliation.recordCount, 2);
    assert.equal(report.reconciliation.collectionCount, 1);
    assert.ok(report.metrics.largestRowBytes !== null && report.metrics.largestRowBytes > 0);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("reports binary-looking fields but does not strip them by default", async () => {
  const { directory } = await fixture();
  try {
    const report = await deriveMetricsFromSnapshot(directory);
    assert.equal(report.binaryCandidates.length, 1);
    assert.equal(report.binaryCandidates[0].kind, "base64-string");
    assert.equal(report.binaryCandidates[0].path, "users.avatarData");
    assert.equal(report.reconciliation.binaryBytesStripped, 0);
    assert.equal(report.metrics.relationalBytes, report.reconciliation.manifestBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("strips an explicitly supplied field and reduces relational bytes", async () => {
  const { directory } = await fixture();
  try {
    const report = await deriveMetricsFromSnapshot(directory, { stripFields: ["users.avatarData"] });
    assert.ok(report.reconciliation.binaryBytesStripped > 0);
    assert.ok(report.metrics.relationalBytes !== null && report.metrics.relationalBytes < report.reconciliation.manifestBytes);
    assert.ok(report.metrics.largestRowBytes !== null && report.metrics.largestRowBytes < report.reconciliation.manifestBytes / 2);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("detectBinaryLike auto-strips candidates when explicitly enabled", async () => {
  const { directory } = await fixture();
  try {
    const report = await deriveMetricsFromSnapshot(directory, { detectBinaryLike: true });
    assert.ok(report.reconciliation.binaryBytesStripped > 0);
    assert.ok(report.metrics.relationalBytes !== null && report.metrics.relationalBytes < report.reconciliation.manifestBytes);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
