import { test } from "node:test";
import assert from "node:assert/strict";
import { isProfileCompleted, normalizeProfileUpdate } from "./profileCompletion.js";

const completeProfile = {
  name: "A User", username: "a_user", age: 24, gender: "Non-Binary", bio: "Hello", city: "Pune",
  languages: ["Hindi"], interests: ["Music"], lookingFor: "Friendship", termsAcceptedAt: new Date()
};

test("profile completion accepts the server-required fields", () => {
  assert.equal(isProfileCompleted(completeProfile), true);
});

test("profile completion rejects missing or blank required fields", () => {
  assert.equal(isProfileCompleted({ ...completeProfile, lookingFor: "" }), false);
  assert.equal(isProfileCompleted({ ...completeProfile, gender: undefined }), false);
  assert.equal(isProfileCompleted({ ...completeProfile, age: 17 }), false);
  assert.equal(isProfileCompleted({ ...completeProfile, termsAcceptedAt: null }), false);
  assert.equal(isProfileCompleted({ ...completeProfile, languages: [" "] }), false);
  assert.equal(isProfileCompleted({ ...completeProfile, interests: [] }), false);
  assert.equal(isProfileCompleted({ ...completeProfile, name: " " }), false);
});

test("profile update normalization trims, lowercases and deduplicates values", () => {
  assert.deepEqual(normalizeProfileUpdate({
    username: "  A_User ", bio: " ", interests: [" Music ", "music", ""], languages: ["Hindi", " hindi "], lookingFor: " Friendship "
  }), { username: "a_user", interests: ["Music"], languages: ["Hindi"], lookingFor: "Friendship" });
});

test("a persisted completion timestamp remains authoritative for legacy profiles", () => {
  assert.equal(isProfileCompleted({ profileCompletedAt: new Date(), interests: [] }), true);
});
