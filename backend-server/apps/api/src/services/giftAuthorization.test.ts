import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { Gift } from "../models/Gift.js";
import { GiftInventory } from "../models/GiftInventory.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { ErrorCode, HttpError } from "../utils/http.js";

// This suite never connects to Mongo or providers. Supplying explicit local
// configuration also prevents imported modules from selecting a developer URI.
process.env.NODE_ENV = "test";
process.env.MONGODB_URI = "mongodb://127.0.0.1:27017/yugm_gift_authorization_unit";
process.env.MONGODB_DB_NAME = "yugm_gift_authorization_unit";
process.env.REDIS_URL = "";

const { comboGift, tradeGift } = await import("./gifts.js");

const actorId = "507f1f77bcf86cd799439011";
const firstTargetId = "507f1f77bcf86cd799439012";
const secondTargetId = "507f1f77bcf86cd799439013";
const giftId = "507f1f77bcf86cd799439014";
const roomId = "507f1f77bcf86cd799439015";
const offerItemId = "507f1f77bcf86cd799439016";
const requestedItemId = "507f1f77bcf86cd799439017";

test("legacy group payments and bilateral trades fail before any database access", async (t) => {
  const unexpectedDatabaseAccess = () => {
    throw new Error("Consent rejection must happen before database access");
  };
  const guards = [
    t.mock.method(mongoose, "startSession", unexpectedDatabaseAccess),
    t.mock.method(Gift, "findById", unexpectedDatabaseAccess),
    t.mock.method(GiftInventory, "find", unexpectedDatabaseAccess),
    t.mock.method(GiftInventory, "findByIdAndUpdate", unexpectedDatabaseAccess),
    t.mock.method(GiftInventory, "findOneAndUpdate", unexpectedDatabaseAccess),
    t.mock.method(User, "findByIdAndUpdate", unexpectedDatabaseAccess),
    t.mock.method(User, "findOneAndUpdate", unexpectedDatabaseAccess),
    t.mock.method(WalletTransaction, "create", unexpectedDatabaseAccess),
    t.mock.method(GiftTransaction, "create", unexpectedDatabaseAccess)
  ];

  const requiresConsent = (error: unknown) => {
    assert.ok(error instanceof HttpError);
    assert.equal(error.status, 409);
    assert.equal(error.code, ErrorCode.CONFLICT);
    assert.match(error.message, /approval|acceptance/);
    return true;
  };

  await t.test("an actor cannot name other users as combo payers", async () => {
    await assert.rejects(comboGift(roomId, giftId, [firstTargetId, secondTargetId], actorId), requiresConsent);
  });

  await t.test("including the actor or duplicate IDs does not authorize other payers", async () => {
    await assert.rejects(comboGift(roomId, giftId, [actorId, firstTargetId], actorId), requiresConsent);
    await assert.rejects(comboGift(roomId, giftId, [firstTargetId, firstTargetId], actorId), requiresConsent);
  });

  await t.test("an offered item does not authorize taking target inventory", async () => {
    await assert.rejects(tradeGift(actorId, firstTargetId, [offerItemId], [requestedItemId]), requiresConsent);
    await assert.rejects(tradeGift(actorId, firstTargetId, [offerItemId, offerItemId], [requestedItemId]), requiresConsent);
  });

  await t.test("repeated concurrent unsupported commands cannot reach an asset mutation", async () => {
    await Promise.all(Array.from({ length: 100 }, (_, index) => assert.rejects(
      index % 2 === 0
        ? comboGift(roomId, giftId, [firstTargetId, secondTargetId], actorId)
        : tradeGift(actorId, firstTargetId, [offerItemId], [requestedItemId]),
      requiresConsent
    )));
  });

  for (const guard of guards) assert.equal(guard.mock.callCount(), 0);
});
