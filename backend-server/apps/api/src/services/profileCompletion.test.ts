import { test } from "node:test";
import assert from "node:assert/strict";
import { isProfileCompleted } from "./profileCompletion.js";

test("profile completion accepts the server-required fields", () => {
  assert.equal(isProfileCompleted({
    name: "A User",
    username: "a_user",
    bio: "Hello",
    city: "Pune",
    interests: ["Music"]
  }), true);
});

test("profile completion rejects missing or blank required fields", () => {
  assert.equal(isProfileCompleted({ name: "A User", username: "a_user", bio: "Hello", city: "Pune", interests: [] }), false);
  assert.equal(isProfileCompleted({ name: " ", username: "a_user", bio: "Hello", city: "Pune", interests: ["Music"] }), false);
});

test("a persisted completion timestamp remains authoritative for legacy profiles", () => {
  assert.equal(isProfileCompleted({ profileCompletedAt: new Date(), interests: [] }), true);
});
