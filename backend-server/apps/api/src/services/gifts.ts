import mongoose from "mongoose";
import { Gift } from "../models/Gift.js";
import { GiftCollection } from "../models/GiftCollection.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { GiftInventory } from "../models/GiftInventory.js";
import { debitWallet, creditWallet, creatorShare } from "./wallet.js";
import { grantXp } from "./levels.js";
import { HttpError, ErrorCode } from "../utils/http.js";

export async function getGiftsV2(category?: string, rarity?: string, page = 1, limit = 20) {
  const filter: Record<string, unknown> = { isActive: true };
  if (category) filter.category = category;
  if (rarity) filter.rarity = rarity;

  const [gifts, total] = await Promise.all([
    Gift.find(filter).sort({ coinPrice: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    Gift.countDocuments(filter)
  ]);

  return { gifts, total, page, limit };
}

export async function getCollections() {
  const collections = await GiftCollection.find({ isActive: true }).populate("gifts").lean();
  return { collections };
}

export async function comboGift(roomId: string, giftId: string, participants: string[], senderId: string) {
  const gift = await Gift.findById(giftId).lean();
  if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
  if (!gift.isActive) throw new HttpError(400, "Gift is not active", ErrorCode.VALIDATION);

  const comboCount = participants.length;
  const multi = gift.comboMultiplier ?? 1;
  const totalValue = gift.coinPrice * comboCount * multi;
  const perPersonCost = Math.ceil(totalValue / comboCount);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    for (const pid of participants) {
      const meta = { giftId: giftId, roomId, comboCount };
      if (pid === senderId) {
        const reduced = Math.floor(perPersonCost * 0.5);
        await debitWallet(pid, reduced, "GIFT_SENT", meta, session);
      } else {
        await debitWallet(pid, perPersonCost, "GIFT_SENT", meta, session);
      }
    }

    for (const pid of participants) {
      const share = Math.floor(creatorShare(totalValue) / comboCount);
      await creditWallet(pid, share, "GIFT_RECEIVED", { giftId, roomId, comboCount }, session);
      await grantXp(pid, "GIFT_SENT", { giftId, roomId, comboCount });
    }

    const transaction = await GiftTransaction.create([{
      roomId,
      senderId,
      receiverId: participants[0],
      giftId,
      coinAmount: totalValue,
      type: "combo",
      comboCount,
      totalValue,
      effect: "combo_bonus"
    }], { session });

    await session.commitTransaction();
    return { comboCount, totalValue, perPersonCost, multiplier: multi, transaction: transaction[0] };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}

export async function roomWideGift(roomId: string, giftId: string, senderId: string, receiverIds: string[]) {
  const MAX_RECEIVERS = 100;
  if (receiverIds.length > MAX_RECEIVERS) {
    throw new HttpError(400, `Cannot send room-wide gift to more than ${MAX_RECEIVERS} recipients`, ErrorCode.VALIDATION);
  }

  const gift = await Gift.findById(giftId).lean();
  if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);

  const totalCost = gift.coinPrice * receiverIds.length;

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(senderId, totalCost, "GIFT_SENT", { giftId, roomId, type: "room_wide" }, session);

    const txns = [];
    for (const rid of receiverIds) {
      const share = Math.floor(creatorShare(gift.coinPrice));
      await creditWallet(rid, share, "GIFT_RECEIVED", { giftId, roomId, type: "room_wide" }, session);
      await grantXp(rid, "GIFT_RECEIVED", { giftId, roomId });

      const txn = await GiftTransaction.create([{
        roomId,
        senderId,
        receiverId: rid,
        giftId,
        coinAmount: gift.coinPrice,
        type: "room_wide",
        totalValue: gift.coinPrice,
        effect: "room_wide"
      }], { session });
      txns.push(txn[0]);
    }

    await grantXp(senderId, "GIFT_SENT", { giftId, roomId, type: "room_wide", count: receiverIds.length });

    await session.commitTransaction();
    return { totalCost, receiverCount: receiverIds.length, transactions: txns };
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

  const pool = await Gift.find({ rarity: { $in: allowedRarities }, isActive: true }).lean();
  if (pool.length === 0) throw new HttpError(500, "No gifts available in this tier");

  const randomGift = pool[Math.floor(Math.random() * pool.length)];

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
  const invItem = await GiftInventory.findById(inventoryId).lean();
  if (!invItem) throw new HttpError(404, "Inventory item not found", ErrorCode.NOT_FOUND);
  if (invItem.userId.toString() !== userId) throw new HttpError(403, "Not your item", ErrorCode.FORBIDDEN);

  const gift = await Gift.findById(invItem.giftId).lean();
  if (!gift || !gift.upgradeable) throw new HttpError(400, "Gift is not upgradeable", ErrorCode.VALIDATION);
  if (!gift.upgradePath || gift.upgradePath.length === 0) throw new HttpError(400, "No upgrade path", ErrorCode.VALIDATION);

  const upgradeCost = Math.floor(gift.coinPrice * 1.5);
  await debitWallet(userId, upgradeCost, "GIFT_UPGRADE", { inventoryId, fromGiftId: gift._id });

  const nextGiftId = gift.upgradePath[0];
  await GiftInventory.findByIdAndDelete(inventoryId);

  await GiftInventory.findOneAndUpdate(
    { userId, giftId: nextGiftId },
    { $inc: { quantity: 1 }, $setOnInsert: { userId, giftId: nextGiftId, source: "upgrade", tradable: true } },
    { upsert: true }
  );

  const upgradedGift = await Gift.findById(nextGiftId).lean();

  return { upgradeCost, fromGift: gift, upgradedGift };
}

export async function getInventory(userId: string) {
  const items = await GiftInventory.find({ userId }).populate("giftId").lean();
  return { items: items.map((i) => ({ id: i._id, gift: i.giftId, quantity: i.quantity, tradable: i.tradable, source: i.source })) };
}

export async function tradeGift(userId: string, targetUserId: string, offerItems: string[], requestItems: string[]) {
  if (userId === targetUserId) throw new HttpError(400, "Cannot trade with yourself", ErrorCode.VALIDATION);

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const offerInvs = await GiftInventory.find({ _id: { $in: offerItems }, userId }).session(session).lean();
    if (offerInvs.length !== offerItems.length) throw new HttpError(404, "Some offer items not found", ErrorCode.NOT_FOUND);
    if (offerInvs.some((i) => !i.tradable)) throw new HttpError(400, "Some offer items are not tradable", ErrorCode.VALIDATION);

    const requestInvs = await GiftInventory.find({ _id: { $in: requestItems }, userId: targetUserId }).session(session).lean();
    if (requestInvs.length !== requestItems.length) throw new HttpError(404, "Some request items not found", ErrorCode.NOT_FOUND);
    if (requestInvs.some((i) => !i.tradable)) throw new HttpError(400, "Some request items are not tradable", ErrorCode.VALIDATION);

    for (const inv of offerInvs) {
      if (inv.quantity > 1) {
        await GiftInventory.findByIdAndUpdate(inv._id, { $inc: { quantity: -1 } }, { session });
        await GiftInventory.findOneAndUpdate(
          { userId: targetUserId, giftId: inv.giftId },
          { $inc: { quantity: 1 }, $setOnInsert: { userId: targetUserId, giftId: inv.giftId, source: "trade", tradable: true } },
          { upsert: true, session }
        );
      } else {
        await GiftInventory.findByIdAndUpdate(inv._id, { userId: targetUserId }, { session });
      }
      await GiftTransaction.create([{
        senderId: userId,
        receiverId: targetUserId,
        giftId: inv.giftId,
        coinAmount: 0,
        type: "trade",
        metadata: { tradeType: "offer" }
      }], { session });
    }

    for (const inv of requestInvs) {
      if (inv.quantity > 1) {
        await GiftInventory.findByIdAndUpdate(inv._id, { $inc: { quantity: -1 } }, { session });
        await GiftInventory.findOneAndUpdate(
          { userId, giftId: inv.giftId },
          { $inc: { quantity: 1 }, $setOnInsert: { userId, giftId: inv.giftId, source: "trade", tradable: true } },
          { upsert: true, session }
        );
      } else {
        await GiftInventory.findByIdAndUpdate(inv._id, { userId }, { session });
      }
      await GiftTransaction.create([{
        senderId: targetUserId,
        receiverId: userId,
        giftId: inv.giftId,
        coinAmount: 0,
        type: "trade",
        metadata: { tradeType: "request" }
      }], { session });
    }

    await session.commitTransaction();
    return { traded: true, offeredCount: offerItems.length, receivedCount: requestItems.length };
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    session.endSession();
  }
}
