import assert from "node:assert/strict";
import { test } from "node:test";
import {
  D1_HARD_LIMITS,
  evaluateD1CapacityGates,
  parseD1CapacityMetrics,
  type D1CapacityMetrics,
} from "./d1CapacityGate.js";

function metrics(overrides: Partial<D1CapacityMetrics> = {}): D1CapacityMetrics {
  return {
    snapshotId: "dcr2-fixture",
    sourceEnvironment: "approved-snapshot",
    collectedAt: "2026-11-23T00:00:00.000Z",
    workersPaid: true,
    relationalBytes: 1_000,
    indexBytes: 500,
    projected12MonthTotalBytes: 2_000,
    largestRowBytes: 1_000,
    binariesInD1Bytes: 0,
    largestStatementBytes: 1_000,
    maxBoundParameters: 10,
    largestQueryResultBytes: 1_000_000,
    p99QueryDurationMs: 500,
    averageWriteDurationMs: 5,
    peakWritesPerSecond: 100,
    peakQueriesPerInvocation: 20,
    ...overrides,
  };
}

test("screens documented hard limits and leaves DCR-2 review items open", () => {
  const report = evaluateD1CapacityGates(metrics());

  assert.equal(report.hardGatesPassed, true);
  assert.equal(report.passed, true);
  assert.equal(report.currentTotalBytes, 1_500);
  assert.equal(report.projectedTotalBytes, 2_000);
  assert.equal(report.estimatedWriteQps, 200);
  assert.equal(report.requiredWriteQps, 100);
  assert.equal(report.throughputRatio, 2);
  assert.equal(report.reviewItems.length, 5);
  assert.deepEqual(
    report.reviewItems.map((item) => item.id),
    ["size-comfort", "write-throughput-headroom", "indexed-query-shape", "growth-and-retention", "recovery-and-billing"]
  );
});

test("rejects malformed or negative metric input", () => {
  assert.throws(() => parseD1CapacityMetrics(null), /metrics must be a JSON object/);
  assert.throws(
    () => parseD1CapacityMetrics({ ...metrics(), relationalBytes: -1 }),
    /relationalBytes must be a finite, non-negative number/
  );
  assert.throws(
    () => parseD1CapacityMetrics({ ...metrics(), workersPaid: "yes" }),
    /workersPaid must be a boolean/
  );
  assert.throws(
    () => parseD1CapacityMetrics({ ...metrics(), sourceEnvironment: "" }),
    /sourceEnvironment must be a non-empty string/
  );
});

test("fails when the 10 GB hard limit or projection sanity check is exceeded", () => {
  const tooLarge = evaluateD1CapacityGates(
    metrics({ projected12MonthTotalBytes: D1_HARD_LIMITS.paidDatabaseBytes + 1 })
  );
  assert.equal(tooLarge.hardGatesPassed, false);
  assert.ok(tooLarge.checks.some((check) => check.name === "database-size-hard-limit" && !check.passed));

  const badProjection = evaluateD1CapacityGates(metrics({ projected12MonthTotalBytes: 1_499 }));
  assert.equal(badProjection.hardGatesPassed, false);
  assert.ok(badProjection.checks.some((check) => check.name === "projection-not-below-current" && !check.passed));
});

test("fails row, binary, statement, parameter, result, duration and invocation limit breaches", () => {
  const report = evaluateD1CapacityGates(
    metrics({
      largestRowBytes: D1_HARD_LIMITS.rowBytes + 1,
      binariesInD1Bytes: 1,
      largestStatementBytes: D1_HARD_LIMITS.statementBytes + 1,
      maxBoundParameters: D1_HARD_LIMITS.boundParameters + 1,
      largestQueryResultBytes: D1_HARD_LIMITS.queryResultBytes + 1,
      p99QueryDurationMs: D1_HARD_LIMITS.queryDurationMs + 1,
      peakQueriesPerInvocation: D1_HARD_LIMITS.queriesPerInvocationPaid + 1,
    })
  );

  const failed = report.checks.filter((check) => !check.passed).map((check) => check.name);
  assert.deepEqual(failed, [
    "row-size",
    "binary-data-in-r2-only",
    "statement-size",
    "bound-parameters",
    "query-result-size",
    "query-duration",
    "queries-per-invocation",
  ]);
});

test("uses Free limits when Workers Paid is false", () => {
  const report = evaluateD1CapacityGates(metrics({ workersPaid: false, peakQueriesPerInvocation: 100 }));

  assert.equal(report.hardGatesPassed, false);
  assert.ok(report.checks.some((check) => check.name === "workers-paid" && !check.passed));
  assert.ok(report.checks.some((check) => check.name === "queries-per-invocation" && !check.passed));
});

test("reports unmeasurable throughput as a review item rather than a hard failure", () => {
  const report = evaluateD1CapacityGates(metrics({ averageWriteDurationMs: 0 }));

  assert.equal(report.estimatedWriteQps, null);
  assert.equal(report.throughputRatio, null);
  assert.equal(report.hardGatesPassed, true);
  const item = report.reviewItems.find((entry) => entry.id === "write-throughput-headroom");
  assert.match(item?.measurement ?? "", /cannot be estimated/);
});
