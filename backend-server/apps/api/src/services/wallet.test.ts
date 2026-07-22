import assert from "node:assert/strict";
import test from "node:test";
import { platformFee, creatorShare, PLATFORM_FEE_PERCENTAGE } from "./wallet.js";

test("platformFee calculates 10% correctly", () => {
  assert.equal(platformFee(100), 10);
  assert.equal(platformFee(1000), 100);
  assert.equal(platformFee(50), 5);
});

test("platformFee floors fractional amounts", () => {
  assert.equal(platformFee(1), 0);
  assert.equal(platformFee(9), 0);
  assert.equal(platformFee(15), 1);
  assert.equal(platformFee(99), 9);
});

test("platformFee handles zero", () => {
  assert.equal(platformFee(0), 0);
});

test("platformFee handles large amounts", () => {
  assert.equal(platformFee(100000), 10000);
  assert.equal(platformFee(24990), 2499);
});

test("platformFee percentage is 10", () => {
  assert.equal(PLATFORM_FEE_PERCENTAGE, 10);
});

test("creatorShare returns amount minus platform fee", () => {
  assert.equal(creatorShare(100), 90);
  assert.equal(creatorShare(1000), 900);
  assert.equal(creatorShare(50), 45);
});

test("creatorShare + platformFee equals original amount", () => {
  const amounts = [1, 5, 10, 99, 100, 499, 1000, 24990];
  for (const amount of amounts) {
    assert.equal(platformFee(amount) + creatorShare(amount), amount);
  }
});

test("creatorShare handles zero", () => {
  assert.equal(creatorShare(0), 0);
});
