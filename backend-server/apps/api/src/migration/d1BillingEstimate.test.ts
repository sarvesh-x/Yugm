import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { D1_PAID_INCLUSIONS, estimateD1Billing, readBillingInputs } from "./d1BillingEstimate.js";
import { parseD1CapacityMetrics } from "./d1CapacityGate.js";

const metrics = parseD1CapacityMetrics({
  snapshotId: "billing-fixture",
  sourceEnvironment: "approved-metrics",
  collectedAt: "2026-11-23T00:00:00.000Z",
  workersPaid: true,
  relationalBytes: 2_000_000_000,
  indexBytes: 400_000_000,
  projected12MonthTotalBytes: 3_000_000_000,
  largestRowBytes: 1_000_000,
  binariesInD1Bytes: 0,
  largestStatementBytes: 1_000,
  maxBoundParameters: 1,
  largestQueryResultBytes: 1_000,
  p99QueryDurationMs: 10,
  averageWriteDurationMs: 4,
  peakWritesPerSecond: 10,
  peakQueriesPerInvocation: 10,
});

test("estimates monthly reads, writes and storage against Paid inclusions", () => {
  const report = estimateD1Billing(
    [
      { frequencyPerMinute: 60, rowsScanned: 10 },
      { frequencyPerMinute: 30, rowsScanned: 100 },
    ],
    metrics,
    "fixture"
  );

  assert.equal(report.rowsReadPerMonth, (600 + 3000) * 60 * 24 * 30);
  assert.equal(report.rowsWrittenPerMonthUpperBound, 10 * 60 * 24 * 30);
  assert.equal(report.currentStorageBytes, 2_400_000_000);
  assert.equal(report.withinIncludedReads, true);
  assert.equal(report.withinIncludedWrites, true);
  assert.equal(report.withinIncludedStorage, true);
  assert.equal(report.estimatedReadOverage, 0);
  assert.deepEqual(
    report.reviewItems.map((item) => item.id),
    ["peak-vs-average-writes", "read-amplification", "retention-storage"]
  );
});

test("reports overages when estimates exceed Paid inclusions", () => {
  const report = estimateD1Billing(
    [{ frequencyPerMinute: 60, rowsScanned: D1_PAID_INCLUSIONS.rowsReadPerMonth }],
    metrics,
    "over-limit"
  );

  assert.equal(report.withinIncludedReads, false);
  assert.equal(report.estimatedReadOverage, 60 * D1_PAID_INCLUSIONS.rowsReadPerMonth * 60 * 24 * 30 - D1_PAID_INCLUSIONS.rowsReadPerMonth);
  assert.match(report.digest, /^[a-f0-9]{64}$/);
});

test("reads query observations and metrics from local files", async () => {
  const directory = await mkdtemp(path.join(tmpdir(), "yugm-billing-estimate-"));
  const queries = path.join(directory, "queries.jsonl");
  const metricsFile = path.join(directory, "metrics.json");
  try {
    await writeFile(
      queries,
      `${JSON.stringify({
        id: "q1",
        pattern: "lookup user",
        frequencyPerMinute: 60,
        rowsScanned: 10,
        durationMs: 5,
        resultBytes: 100,
        statementBytes: 100,
        boundParameters: 1,
        usesIndex: true,
        fullCollectionScan: false,
      })}\n`,
      "utf8"
    );
    await writeFile(metricsFile, JSON.stringify(metrics), "utf8");

    const inputs = await readBillingInputs(queries, metricsFile);
    const report = estimateD1Billing(inputs.observations, inputs.metrics, inputs.source);

    assert.equal(inputs.source, "queries.jsonl");
    assert.equal(report.observationCount, 1);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
