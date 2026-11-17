import assert from "node:assert/strict";
import test from "node:test";
import mongoose from "mongoose";
import { assertRoomGiftReplayMatches, roomGiftLedgerKeys, type RoomGiftIntent } from "./giftReplay.js";
import { ErrorCode, HttpError } from "../utils/http.js";

const intent: RoomGiftIntent = {
  senderId: "aaaaaaaaaaaaaaaaaaaaaaaa",
  roomId: "bbbbbbbbbbbbbbbbbbbbbbbb",
  giftId: "cccccccccccccccccccccccc",
  receiverId: "dddddddddddddddddddddddd",
  currency: "COINS"
};
const stored = { ...intent, type: "send", metadata: { idempotencyKey: "client-key" }, coinAmount: 100 };

test("room gift replay accepts original input independently of catalog quote data", () => {
  assert.doesNotThrow(() => assertRoomGiftReplayMatches(stored, intent));
  // Stored value is the committed quote. The request contains no client-authoritative price.
  assert.doesNotThrow(() => assertRoomGiftReplayMatches({ ...stored, coinAmount: 200 } as typeof stored, intent));
});

test("room gift replay preserves legacy records without currency or command metadata", () => {
  assert.doesNotThrow(() => assertRoomGiftReplayMatches({ ...stored, currency: undefined, metadata: { idempotencyKey: "old-key" } }, intent));
});

test("room gift replay normalizes object IDs and valid hex case", () => {
  assert.doesNotThrow(() => assertRoomGiftReplayMatches({
    ...stored,
    senderId: new mongoose.Types.ObjectId(intent.senderId),
    roomId: new mongoose.Types.ObjectId(intent.roomId),
    giftId: { _id: new mongoose.Types.ObjectId(intent.giftId) },
    receiverId: new mongoose.Types.ObjectId(intent.receiverId)
  }, { ...intent, giftId: intent.giftId.toUpperCase() }));
});

for (const field of ["senderId", "roomId", "giftId", "receiverId", "currency"] as const) {
  test(`room gift replay rejects a changed ${field} with the same client key`, () => {
    const changed = { ...intent, [field]: field === "currency" ? "DIAMONDS" : "eeeeeeeeeeeeeeeeeeeeeeee" } as RoomGiftIntent;
    assert.throws(() => assertRoomGiftReplayMatches(stored, changed), (error: unknown) =>
      error instanceof HttpError && error.status === 409 && error.code === ErrorCode.CONFLICT);
  });
}

test("a PK, room-wide, or another command cannot be replayed as an ordinary room gift", () => {
  for (const previous of [
    { ...stored, metadata: { pkBattleId: "battle" } },
    { ...stored, type: "room_wide" },
    { ...stored, metadata: { command: "DIRECT_GIFT" } }
  ]) {
    assert.throws(() => assertRoomGiftReplayMatches(previous, intent), (error: unknown) => error instanceof HttpError && error.status === 409);
  }
});

test("ledger identities are isolated per transfer and debit/credit leg", () => {
  const first = roomGiftLedgerKeys("transfer-one");
  const second = roomGiftLedgerKeys("transfer-two");
  assert.equal(new Set([first.debit, first.credit, second.debit, second.credit]).size, 4);
  assert.deepEqual(roomGiftLedgerKeys("transfer-one"), first);
});
