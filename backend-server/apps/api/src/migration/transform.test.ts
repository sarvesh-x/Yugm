import assert from "node:assert/strict";
import { test } from "node:test";
import { advanceCheckpoint, batchId, completeCheckpoint, newCheckpoint, shouldApplyBatch } from "./checkpoint.js";
import {
  toEnum,
  toFiniteNumber,
  toIntegerMinorUnits,
  toRequiredString,
  toSourceId,
  toUtcIso,
  TransformContext,
  type TransformField
} from "./transform.js";
import { ValidationReportBuilder } from "./validate.js";

const ID = "507f1f77bcf86cd799439011";

function field(context: TransformContext, name = "value", rowId = ID): TransformField {
  return { collection: "users", field: name, rowId, context };
}

test("toSourceId preserves canonical ObjectIds and quarantines malformed or non-lowercase values", () => {
  const context = new TransformContext("snap-1");
  assert.equal(toSourceId(ID, field(context)), ID);
  assert.equal(toSourceId(ID.toUpperCase(), field(context)), undefined);
  assert.equal(toSourceId("not-an-id", field(context)), undefined);
  assert.equal(toSourceId({}, field(context)), undefined);
  assert.deepEqual(
    context.quarantine.map((entry) => entry.reason),
    ["INVALID_ID", "INVALID_ID", "INVALID_ID"]
  );
});

test("toUtcIso normalizes dates to UTC and rejects invalid timestamps", () => {
  const context = new TransformContext("snap-1");
  assert.equal(toUtcIso(new Date("2026-01-02T03:04:05.000Z"), field(context)), "2026-01-02T03:04:05.000Z");
  assert.equal(toUtcIso(1767323045000, field(context)), "2026-01-02T03:04:05.000Z");
  assert.equal(toUtcIso("bad-date", field(context)), undefined);
  assert.equal(toUtcIso(Number.NaN, field(context)), undefined);
  assert.equal(toUtcIso("", field(context)), undefined);
});

test("money conversion rejects fractions, unsafe integers and negatives without rounding", () => {
  const context = new TransformContext("snap-1");
  assert.equal(toIntegerMinorUnits(0, field(context)), 0);
  assert.equal(toIntegerMinorUnits(250, field(context)), 250);
  assert.equal(toIntegerMinorUnits(-5, field(context), { allowNegative: true }), -5);
  assert.equal(toIntegerMinorUnits(1.25, field(context)), undefined);
  assert.equal(toIntegerMinorUnits(Number.NaN, field(context)), undefined);
  assert.equal(toIntegerMinorUnits(Number.MAX_SAFE_INTEGER + 2, field(context)), undefined);
  assert.equal(toIntegerMinorUnits(-1, field(context)), undefined);
  assert.deepEqual(
    context.quarantine.map((entry) => entry.reason),
    ["NON_INTEGER_MONEY", "NON_INTEGER_MONEY", "MONEY_OVERFLOW", "NEGATIVE_MONEY"]
  );
});

test("finite-number transform preserves fractions and quarantines invalid or out-of-range values", () => {
  const context = new TransformContext("snap-1");
  assert.equal(toFiniteNumber(1.1, field(context), { min: 0 }), 1.1);
  assert.equal(toFiniteNumber(0, field(context), { min: 0 }), 0);
  assert.equal(toFiniteNumber(-0.5, field(context), { min: 0 }), undefined);
  assert.equal(toFiniteNumber(Number.NaN, field(context)), undefined);
  assert.equal(toFiniteNumber("1.1", field(context)), undefined);
  assert.deepEqual(
    context.quarantine.map((entry) => entry.reason),
    ["OUT_OF_RANGE", "NON_FINITE_NUMBER", "NON_FINITE_NUMBER"]
  );
});

test("enum and required-string transforms preserve values or quarantine explicitly", () => {
  const context = new TransformContext("snap-1");
  const allowed = ["PUBLIC", "PRIVATE"] as const;
  assert.equal(toEnum("PRIVATE", allowed, field(context)), "PRIVATE");
  assert.equal(toEnum("HIDDEN", allowed, field(context)), undefined);
  assert.equal(toRequiredString("  name ", field(context)), "  name ");
  assert.equal(toRequiredString("   ", field(context)), undefined);
  assert.deepEqual(
    context.quarantine.map((entry) => entry.reason),
    ["UNKNOWN_ENUM", "MISSING_REQUIRED"]
  );
});

test("transform report accounts for every source row and fails on silent discards", () => {
  const context = new TransformContext("snap-1");
  context.source("users");
  context.source("users");
  toSourceId(ID, field(context));
  toSourceId("bad", field(context));
  context.keep("users");
  context.assertAccountedFor();
  const report = context.report();
  assert.deepEqual(report.collections.users, { source: 2, transformed: 1, quarantined: 1 });

  const leaking = new TransformContext("snap-2");
  leaking.source("wallet_transactions");
  assert.throws(() => leaking.assertAccountedFor(), /Unaccounted records/);
});

test("checkpoints prevent replay and advance deterministically", () => {
  const checkpoint = newCheckpoint("snap-1", "import", "users");
  const id = batchId("snap-1", "import", "users", ID);
  assert.equal(shouldApplyBatch(checkpoint, id), true);
  const advanced = advanceCheckpoint(checkpoint, id, 1, ID, "abc");
  assert.equal(shouldApplyBatch(advanced, id), false);
  assert.equal(advanceCheckpoint(advanced, id, 1, ID, "abc"), advanced);
  assert.equal(completeCheckpoint(advanced, "def").status, "complete");
});

test("validation report detects count, uniqueness, orphan and balance failures", () => {
  const failing = new ValidationReportBuilder()
    .count("identity", "user count", 2, 1)
    .unique("identity", "firebase uid", [ID, ID])
    .referential("messaging", "message owner", ["missing"], [ID])
    .balance("finance", "wallet reconciliation", 100, 90)
    .report("snap-1");
  assert.equal(failing.passed, false);
  assert.equal(failing.checks.length, 4);
  assert.ok(failing.checks.every((check) => !check.passed));

  const passing = new ValidationReportBuilder()
    .count("identity", "user count", 1, 1)
    .unique("identity", "firebase uid", [ID, "507f1f77bcf86cd799439012"])
    .referential("messaging", "message owner", [ID], [ID])
    .balance("finance", "wallet reconciliation", 100, 100)
    .report("snap-1");
  assert.equal(passing.passed, true);
});

test("validation rejects floating point ledger reconciliation", () => {
  const report = new ValidationReportBuilder().balance("finance", "wallet", 10, 10.5).report("snap-1");
  assert.equal(report.passed, false);
  assert.match(report.checks[0].detail || "", /safe integers/);
});
