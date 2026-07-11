import assert from "node:assert/strict";
import test from "node:test";
import { calculateCompatibility } from "./datingCompatibility.js";

test("compatibility is case-insensitive and explains shared signals", () => {
  const result = calculateCompatibility(
    { city: "Pune", languages: ["Hindi", "English"], interests: ["Music", "Travel"], lookingFor: "Friendship" },
    { city: "pune", languages: ["hindi"], interests: ["music", "Gaming"], lookingFor: "friendship", isVerified: true }
  );
  assert.equal(result.score, 82);
  assert.deepEqual(result.sharedInterests, ["music"]);
  assert.ok(result.reasons.some((reason) => reason.type === "LOCATION"));
  assert.ok(result.reasons.some((reason) => reason.type === "TRUST"));
});

test("compatibility is capped at 100", () => {
  const interests = ["Music", "Travel", "Gaming", "Food", "Dance"];
  const result = calculateCompatibility(
    { city: "Delhi", languages: ["Hindi", "English"], interests, lookingFor: "Dating" },
    { city: "Delhi", languages: ["Hindi", "English"], interests, lookingFor: "Dating", isVerified: true }
  );
  assert.equal(result.score, 100);
  assert.ok(result.reasons.length >= 4);
});
