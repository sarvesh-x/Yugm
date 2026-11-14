import { test } from "node:test";
import assert from "node:assert/strict";
import { equipProfileCosmeticSchema, purchaseProfileCosmeticSchema, transferCosmeticSchema } from "@yugm/shared";
import { getVipStatus } from "../services/vip.js";
import { calculateLevel, getLevelStatus } from "../services/levels.js";

test("equipProfileCosmeticSchema accepts valid cosmetic id", () => {
  const result = equipProfileCosmeticSchema.safeParse({
    type: "AVATAR_FRAME",
    cosmeticId: "frame_gold"
  });
  assert.equal(result.success, true);
});

test("equipProfileCosmeticSchema accepts empty string for unequipping", () => {
  const result = equipProfileCosmeticSchema.safeParse({
    type: "AVATAR_FRAME",
    cosmeticId: ""
  });
  assert.equal(result.success, true);
});

test("equipProfileCosmeticSchema accepts null for unequipping", () => {
  const result = equipProfileCosmeticSchema.safeParse({
    type: "AVATAR_FRAME",
    cosmeticId: null
  });
  assert.equal(result.success, true);
});

test("equipProfileCosmeticSchema accepts omitted cosmeticId for unequipping", () => {
  const result = equipProfileCosmeticSchema.safeParse({
    type: "AVATAR_FRAME"
  });
  assert.equal(result.success, true);
});

test("purchaseProfileCosmeticSchema accepts admin-created cosmetic ids", () => {
  const result = purchaseProfileCosmeticSchema.safeParse({
    cosmeticId: "custom_admin_frame_01"
  });
  assert.equal(result.success, true);
});

test("purchaseProfileCosmeticSchema rejects blank cosmetic ids", () => {
  const result = purchaseProfileCosmeticSchema.safeParse({ cosmeticId: "" });
  assert.equal(result.success, false);
});

test("transferCosmeticSchema accepts admin-created cosmetic ids", () => {
  const result = transferCosmeticSchema.safeParse({
    cosmeticId: "custom_admin_frame_01",
    receiverId: "507f1f77bcf86cd799439011"
  });
  assert.equal(result.success, true);
});

test("getVipStatus calculates daysRemaining correctly", () => {
  const now = new Date("2026-01-01T00:00:00Z");
  const expiresAt = new Date("2026-01-08T00:00:00Z");
  const user = { vipExpiresAt: expiresAt, vipTier: "VIP" };
  const status = getVipStatus(user, now);
  assert.equal(status.isVip, true);
  assert.equal(status.vipTier, "VIP");
  assert.equal(status.daysRemaining, 7);
});

test("getVipStatus returns 0 daysRemaining for expired or non-vip", () => {
  const now = new Date("2026-01-10T00:00:00Z");
  const expiresAt = new Date("2026-01-05T00:00:00Z");
  const user = { vipExpiresAt: expiresAt };
  const status = getVipStatus(user, now);
  assert.equal(status.isVip, false);
  assert.equal(status.daysRemaining, 0);
});

test("level status calculates progress correctly across levels", () => {
  const user = { xp: 400, level: 3 };
  const status = getLevelStatus(user);
  assert.equal(status.level, 3);
  assert.equal(status.nextLevel, 4);
  assert.equal(status.requiredXp, 250);
  assert.equal(status.progressXp, 150);
  assert.equal(status.progress, 0.6);
});
