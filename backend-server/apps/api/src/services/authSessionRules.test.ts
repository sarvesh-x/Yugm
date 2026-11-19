import { test } from "node:test";
import assert from "node:assert/strict";
import { hasFirebaseIdentityConflict, isSessionGenerationCurrent } from "./authSessionRules.js";

test("Firebase identity can be retried for the same account but not linked across identities", () => {
  assert.equal(hasFirebaseIdentityConflict(undefined, "firebase-user"), false);
  assert.equal(hasFirebaseIdentityConflict("firebase-user", "firebase-user"), false);
  assert.equal(hasFirebaseIdentityConflict("other-user", "firebase-user"), true);
});

test("refresh accepts the current generation and legacy sessions, but rejects revoked generations", () => {
  assert.equal(isSessionGenerationCurrent(undefined, 3), true);
  assert.equal(isSessionGenerationCurrent(3, 3), true);
  assert.equal(isSessionGenerationCurrent(2, 3), false);
});
