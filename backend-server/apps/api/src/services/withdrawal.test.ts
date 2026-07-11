import assert from "node:assert/strict";
import test from "node:test";
import { canTransitionPayoutReview } from "./payoutReview.js";
import { creatorCoinsToInr } from "./withdrawal.js";

test("creator coin conversion uses the payout settlement rate", () => {
  assert.equal(creatorCoinsToInr(1), 0.01);
  assert.equal(creatorCoinsToInr(125), 1.25);
  assert.equal(creatorCoinsToInr(0), 0);
});

test("payout reviews only follow valid settlement transitions", () => {
  assert.equal(canTransitionPayoutReview("PENDING", "APPROVED"), true);
  assert.equal(canTransitionPayoutReview("APPROVED", "PAID"), true);
  assert.equal(canTransitionPayoutReview("REJECTED", "APPROVED"), false);
  assert.equal(canTransitionPayoutReview("PAID", "REJECTED"), false);
});
