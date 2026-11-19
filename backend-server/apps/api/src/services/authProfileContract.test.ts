import { test } from "node:test";
import assert from "node:assert/strict";
import { profileSchema } from "@yugm/shared";

test("profile setup accepts the server age bounds and permits optional gender", () => {
  const base = {
    name: "A User",
    username: "a_user",
    age: 80,
    bio: "Hello",
    city: "Pune",
    interests: ["Music"],
    acceptTerms: true
  };
  assert.equal(profileSchema.safeParse(base).success, true);
  assert.equal(profileSchema.safeParse({ ...base, age: 81 }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, age: 17 }).success, false);
});

test("profile terms consent accepts only an explicit true value when supplied", () => {
  const base = { name: "A User", username: "a_user" };
  assert.equal(profileSchema.safeParse({ ...base, acceptTerms: true }).success, true);
  assert.equal(profileSchema.safeParse({ ...base, acceptTerms: false }).success, false);
  assert.equal(profileSchema.safeParse(base).success, true);
});
