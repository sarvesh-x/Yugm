import assert from "node:assert/strict";
import { test } from "node:test";
import {
  assessDcr2Metrics,
  DCR2_METRIC_FIELDS,
  emptyDcr2MetricsTemplate,
  screenReadyMetrics,
} from "./dcr2MetricsIntake.js";

const valid = {
  snapshotId: "dcr2-intake",
  sourceEnvironment: "approved-metrics",
  collectedAt: "2026-11-23T00:00:00.000Z",
  workersPaid: true,
  relationalBytes: 2_000_000_000,
  indexBytes: 400_000_000,
  projected12MonthTotalBytes: 3_000_000_000,
  largestRowBytes: 1_000_000,
  binariesInD1Bytes: 0,
  largestStatementBytes: 80_000,
  maxBoundParameters: 80,
  largestQueryResultBytes: 40_000_000,
  p99QueryDurationMs: 1_200,
  averageWriteDurationMs: 4,
  peakWritesPerSecond: 120,
  peakQueriesPerInvocation: 200,
};

test("template contains every required field with null placeholders", () => {
  const template = emptyDcr2MetricsTemplate();
  const keys = Object.keys(template);

  assert.deepEqual(keys, DCR2_METRIC_FIELDS);
  assert.ok(keys.every((key) => template[key as keyof typeof template] === null));
});

test("reports missing, invalid and extra fields", () => {
  const report = assessDcr2Metrics({
    snapshotId: "partial",
    workersPaid: "yes",
    relationalBytes: -1,
    unknownField: 1,
  });

  assert.equal(report.ready, false);
  assert.ok(report.missing.includes("sourceEnvironment"));
  assert.ok(report.missing.includes("binariesInD1Bytes"));
  assert.deepEqual(report.invalid, ["workersPaid", "relationalBytes"]);
  assert.deepEqual(report.extra, ["unknownField"]);
});

test("screens a ready metrics object through the hard-limit gate", () => {
  const { intake, report } = screenReadyMetrics(valid);

  assert.equal(intake.ready, true);
  assert.ok(report);
  assert.equal(report.hardGatesPassed, true);
  assert.equal(report.reviewItems.length, 5);
});
