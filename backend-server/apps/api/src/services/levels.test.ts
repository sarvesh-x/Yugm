import assert from "node:assert/strict";
import test from "node:test";
import { calculateLevel, getLevelStatus } from "./levels.js";

test("calculateLevel returns first milestone for 0 XP", () => {
  const result = calculateLevel(0);
  assert.equal(result.level, 1);
  assert.equal(result.title, "New Vibe");
});

test("calculateLevel progresses through milestones", () => {
  const level2 = calculateLevel(100);
  assert.ok(level2.level >= 2);

  const level5 = calculateLevel(2000);
  assert.ok(level5.level >= 5);
});

test("calculateLevel returns last milestone for very high XP", () => {
  const result = calculateLevel(1_000_000);
  assert.equal(result.level, 10);
  assert.equal(result.title, "Yugm Legend");
});

test("calculateLevel handles negative XP gracefully", () => {
  const result = calculateLevel(-100);
  assert.equal(result.level, 1);
});

test("getLevelStatus returns correct structure for new user", () => {
  const status = getLevelStatus({ xp: 0 });

  assert.equal(status.level, 1);
  assert.equal(status.title, "New Vibe");
  assert.equal(typeof status.progress, "number");
  assert.equal(status.progress, 0);
  assert.ok(status.canDailyCheckIn);
});

test("getLevelStatus handles null/undefined user", () => {
  const status = getLevelStatus(null);
  assert.equal(status.level, 1);
  assert.equal(status.xp, 0);
});

test("getLevelStatus reflects user XP correctly", () => {
  const status = getLevelStatus({ xp: 500, lastDailyCheckInAt: new Date() });
  assert.equal(status.xp, 500);
  assert.ok(status.level >= 2);
  assert.equal(typeof status.canDailyCheckIn, "boolean");
});

test("getLevelStatus handles user with level property", () => {
  const status = getLevelStatus({ xp: 1000, level: 4 });
  assert.ok(status.level >= 4);
  assert.equal(status.title, "Yugm Star");
});
