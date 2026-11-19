import { test } from "node:test";
import assert from "node:assert/strict";
import { isConsumedAppCheckToken } from "./appCheck.js";

test("App Check replay result rejects consumed tokens only", () => {
  assert.equal(isConsumedAppCheckToken({ alreadyConsumed: true }), true);
  assert.equal(isConsumedAppCheckToken({ alreadyConsumed: false }), false);
  assert.equal(isConsumedAppCheckToken({}), false);
});
