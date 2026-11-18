import mongoose from "mongoose";
import { randomInt } from "node:crypto";
import { Gift } from "../models/Gift.js";
import { GiftCollection } from "../models/GiftCollection.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { GiftInventory } from "../models/GiftInventory.js";
import { debitWallet, creditWallet, creatorShare } from "./wallet.js";
import { grantXp } from "./levels.js";
import { HttpError, ErrorCode } from "../utils/http.js";
import { User } from "../models/User.js";
import { getVipStatus } from "./vip.js";

async function assertVipGiftAccess(userId: string, gift: { category?: string }) {
  if (gift.category?.toLowerCase() !== "vip") return;
  const user = await User.findById(userId).select("vipTier vipLevel vipExp vipFrozen vipFreezeStartedAt vipExpiresAt").lean();
  if ((getVipStatus(user).vipLevel ?? 0) < 1) throw new HttpError(403, "VIP gifts unlock at VIP 1", ErrorCode.FORBIDDEN);
}

export async function getGiftsV2(category?: string, rarity?: string, page = 1, limit = 20) {
  const filter: Record<string, unknown> = { isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] };
  filter.category = category && category !== "bonds" ? category : { $ne: "bonds" };
  if (rarity) filter.rarity = rarity;

  const [gifts, total] = await Promise.all([
    Gift.find(filter).sort({ coinPrice: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Gift.countDocuments(filter)
  ]);

  return { gifts, total, page, limit };
}

export async function purchaseGift(userId: string, giftId: string) {
  const gift = await Gift.findOne({ _id: giftId, isActive: true, category: { $ne: "bonds" } }).lean();
  if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
  await assertVipGiftAccess(userId, gift);
  if (gift.coinPrice <= 0) throw new HttpError(400, "This gift cannot be purchased", ErrorCode.VALIDATION);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    // Enforce limited-edition stock atomically.
    if (gift.limitedEdition?.active) {
      const stockUpdate = await Gift.updateOne(
        { _id: gift._id, "limitedEdition.remaining": { $gt: 0 } },
        { $inc: { "limitedEdition.remaining": -1 } },
        { session }
      );
      if (stockUpdate.modifiedCount !== 1) throw new HttpError(409, "This limited-edition gift is sold out", ErrorCode.CONFLICT);
    }
    await debitWallet(userId, gift.coinPrice, "GIFT_PURCHASE", { giftId: gift._id }, session);
    await GiftInventory.findOneAndUpdate(
      { userId, giftId: gift._id },
      { $inc: { quantity: 1 }, $setOnInsert: { userId, giftId: gift._id, source: "purchased", tradable: gift.tradable ?? false } },
      { upsert: true, session }
    );
    await session.commitTransaction();
    return { gift, price: gift.coinPrice };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
}

export async function getCollections() {
  const collections = await GiftCollection.find({ isActive: true }).populate("gifts").lean();
  return { collections };
}

// The legacy request names payers but contains no authenticated participant approvals.
// Reject at the service boundary so alternative callers cannot bypass this policy.
export async function comboGift(_roomId: string, _giftId: string, _participants: string[], _senderId: string): Promise<never> {
  throw new HttpError(
    409,
    "Combo gifts require approval from every payer and are currently unavailable. Send an individual gift instead.",
    ErrorCode.CONFLICT
  );
}

export async function roomWideGift(roomId: string, giftId: string, senderId: string, receiverIds: string[]) {
  const MAX_RECEIVERS = 100;
  if (receiverIds.length > MAX_RECEIVERS) {
    throw new HttpError(400, `Cannot send room-wide gift to more than ${MAX_RECEIVERS} recipients`, ErrorCode.VALIDATION);
  }

  const gift = await Gift.findOne({ _id: giftId, category: { $ne: "bonds" } }).lean();
  if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
  await assertVipGiftAccess(senderId, gift);

  const totalCost = gift.coinPrice * receiverIds.length;
  const actionId = new mongoose.Types.ObjectId();

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(senderId, totalCost, "GIFT_SENT", { giftId, roomId, type: "room_wide" }, session);

    const txns = [];
    for (const rid of receiverIds) {
      const share = Math.floor(creatorShare(gift.coinPrice));
      await creditWallet(rid, share, "GIFT_RECEIVED", { giftId, roomId, type: "room_wide", platformFee: gift.coinPrice - share }, session);

      const txn = await GiftTransaction.create([{
        roomId,
        senderId,
        receiverId: rid,
        giftId,
        coinAmount: gift.coinPrice,
        type: "room_wide",
        totalValue: gift.coinPrice,
        effect: "room_wide",
        metadata: { idempotencyKey: `room-wide:${actionId}:${rid}` }
      }], { session, ordered: true });
      txns.push(txn[0]);
    }

    await session.commitTransaction();
    const receiverXpGrants: Array<Record<string, unknown> | undefined> = [];
    for (let index = 0; index < txns.length; index += 1) {
      const receipt = await grantXp(receiverIds[index], "GIFT_RECEIVED", { giftId, roomId, idempotencyKey: `room-wide:${txns[index]._id}:received` }).catch((error) => {
        console.warn("Room-wide received gift XP grant failed:", error instanceof Error ? error.message : String(error));
        return undefined;
      });
      receiverXpGrants.push(receipt as Record<string, unknown> | undefined);
    }
    const senderXpGrant = await grantXp(senderId, "GIFT_SENT", { giftId, roomId, type: "room_wide", count: receiverIds.length, idempotencyKey: `room-wide:${actionId}:sender` }).catch((error) => {
      console.warn("Room-wide sent gift XP grant failed:", error instanceof Error ? error.message : String(error));
      return undefined;
    });
    return { totalCost, receiverCount: receiverIds.length, transactions: txns, xpGrant: { sender: senderXpGrant, receivers: receiverXpGrants } };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function surpriseBox(userId: string, tier: "basic" | "premium" | "luxury") {
  const tierPricing: Record<string, number> = { basic: 500, premium: 2000, luxury: 10000 };
  const price = tierPricing[tier];
  if (!price) throw new HttpError(400, "Invalid tier", ErrorCode.VALIDATION);

  const rarities: Record<string, string[]> = {
    basic: ["common", "rare"],
    premium: ["rare", "epic"],
    luxury: ["epic", "legendary", "mythic"]
  };

  const allowedRarities = rarities[tier];

  const pool = await Gift.find({ rarity: { $in: allowedRarities }, isActive: true, category: { $ne: "bonds" } }).lean();
  if (pool.length === 0) throw new HttpError(500, "No gifts available in this tier");

  const randomGift = pool[randomInt(0, pool.length)];

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(userId, price, "SURPRISE_BOX", { tier }, session);

    const source = "mystery";
    await GiftInventory.findOneAndUpdate(
      { userId, giftId: randomGift._id },
      { $inc: { quantity: 1 }, $setOnInsert: { userId, giftId: randomGift._id, source, tradable: true } },
      { upsert: true, session }
    );

    await session.commitTransaction();
    return { tier, price, revealedGift: randomGift, source };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function upgradeGift(userId: string, inventoryId: string) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const invItem = await GiftInventory.findById(inventoryId).session(session).lean();
    if (!invItem) throw new HttpError(404, "Inventory item not found", ErrorCode.NOT_FOUND);
    if (invItem.userId.toString() !== userId) throw new HttpError(403, "Not your item", ErrorCode.FORBIDDEN);

    const gift = await Gift.findById(invItem.giftId).session(session).lean();
    if (!gift || !gift.upgradeable) throw new HttpError(400, "Gift is not upgradeable", ErrorCode.VALIDATION);
    if (!gift.upgradePath || gift.upgradePath.length === 0) throw new HttpError(400, "No upgrade path", ErrorCode.VALIDATION);
    const nextGiftId = gift.upgradePath[0];
    const upgradedGift = await Gift.findById(nextGiftId).session(session).lean();
    if (!upgradedGift || !upgradedGift.isActive) throw new HttpError(409, "The next gift in this upgrade path is unavailable", ErrorCode.CONFLICT);

    const upgradeCost = Math.floor(gift.coinPrice * 1.5);
    await debitWallet(userId, upgradeCost, "GIFT_UPGRADE", { inventoryId, fromGiftId: gift._id }, session);
    if (invItem.quantity > 1) {
      const consumed = await GiftInventory.updateOne(
        { _id: inventoryId, userId, quantity: { $gt: 0 } },
        { $inc: { quantity: -1 } },
        { session }
      );
      if (consumed.modifiedCount !== 1) throw new HttpError(409, "Gift inventory changed; try again", ErrorCode.CONFLICT);
    } else {
      await GiftInventory.deleteOne({ _id: inventoryId, userId }, { session });
    }
    await GiftInventory.findOneAndUpdate(
      { userId, giftId: nextGiftId },
      { $inc: { quantity: 1 }, $setOnInsert: { userId, giftId: nextGiftId, source: "upgrade", tradable: true } },
      { upsert: true, new: true, session }
    );

    await session.commitTransaction();
    return { upgradeCost, fromGift: gift, upgradedGift };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function getInventory(userId: string) {
  const items = await GiftInventory.find({ userId }).populate("giftId").lean();
  return { items: items.map((i: any) => ({
    id: i._id,
    gift: i.giftId ? { ...i.giftId, upgradeLevel: i.upgradeLevel ?? 1 } : i.giftId,
    quantity: i.quantity,
    tradable: i.tradable,
    source: i.source,
    upgradeLevel: i.upgradeLevel ?? 1,
    upgradeCost: i.giftId?.upgradeable ? Math.floor((i.giftId.coinPrice ?? 0) * 1.5) : 0
  })) };
}

// Immediate bilateral transfers have no target acceptance record. Keep the legacy
// endpoint fail-closed until an authenticated offer/accept workflow is available.
export async function tradeGift(_userId: string, _targetUserId: string, _offerItems: string[], _requestItems: string[]): Promise<never> {
  throw new HttpError(
    409,
    "Inventory trades require acceptance from both users and are currently unavailable. Your items have not moved.",
    ErrorCode.CONFLICT
  );
}
