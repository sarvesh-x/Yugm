import { test } from "node:test";
import assert from "node:assert/strict";
import { profileSchema } from "@yugm/shared";

test("profile schema enforces setup age bounds and canonical gender/looking-for values", () => {
  const base = {
    name: "A User",
    username: "a_user",
    age: 80,
    gender: "Female",
    lookingFor: "Friendship",
    bio: "Hello",
    city: "Pune",
    interests: ["Music"],
    acceptTerms: true
  };
  assert.equal(profileSchema.safeParse(base).success, true);
  assert.equal(profileSchema.safeParse({ ...base, age: 81 }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, age: 17 }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, gender: "Other" }).success, false);
  assert.equal(profileSchema.safeParse({ ...base, lookingFor: "Casual social" }).success, false);
});

test("profile terms consent accepts only an explicit true value when supplied", () => {
  const base = { name: "A User", username: "a_user" };
  assert.equal(profileSchema.safeParse({ ...base, acceptTerms: true }).success, true);
  assert.equal(profileSchema.safeParse({ ...base, acceptTerms: false }).success, false);
  assert.equal(profileSchema.safeParse(base).success, true);
});
