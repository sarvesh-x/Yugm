import assert from "node:assert/strict";
import test from "node:test";
import { bondLevel, rankingPeriod } from "./bondRules.js";

test("bond levels unlock exactly at configured thresholds", () => {
  assert.equal(bondLevel(0).level, 1);
  assert.equal(bondLevel(-3).level, 1);
  assert.equal(bondLevel(99).nextThreshold, 100);
  assert.equal(bondLevel(100).level, 2);
  assert.equal(bondLevel(1499).level, 3);
  assert.equal(bondLevel(50000).nextThreshold, null);
});

test("ranking resets are deterministic across week, month, quarter and year boundaries", () => {
  const instant = new Date("2026-12-31T23:59:59Z");
  assert.equal(rankingPeriod(instant, "WEEK").start.toISOString(), "2026-12-28T00:00:00.000Z");
  assert.equal(rankingPeriod(instant, "MONTH").end.toISOString(), "2027-01-01T00:00:00.000Z");
  assert.equal(rankingPeriod(instant, "SEASON").start.toISOString(), "2026-10-01T00:00:00.000Z");
  assert.equal(rankingPeriod(new Date("2027-01-01T00:00:00Z"), "SEASON").end.toISOString(), "2027-04-01T00:00:00.000Z");
});

