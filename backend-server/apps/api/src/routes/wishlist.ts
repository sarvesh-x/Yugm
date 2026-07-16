import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { WishlistItem } from "../models/WishlistItem.js";
import { Gift } from "../models/Gift.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { debitWallet, creditWallet, creatorShare } from "../services/wallet.js";

export const wishlistRouter = Router();

const addSchema = z.object({
  giftId: z.string().min(1),
  message: z.string().max(200).optional(),
  isPublic: z.boolean().default(true),
});

wishlistRouter.post("/wishlist", requireAuth, validateBody(addSchema), asyncHandler(async (req: AuthRequest, res) => {
  const gift = await Gift.findById(req.body.giftId);
  if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);

  const existing = await WishlistItem.findOne({ userId: req.user!._id, giftId: req.body.giftId });
  if (existing) throw new HttpError(409, "Gift already in wishlist", ErrorCode.CONFLICT);

  const item = await WishlistItem.create({
    userId: req.user!._id,
    giftId: req.body.giftId,
    message: req.body.message,
    isPublic: req.body.isPublic,
  });

  const populated = await item.populate("giftId", "name icon coinPrice");
  sendOk(res, { item: populated });
}));

wishlistRouter.get("/wishlist/:userId", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const items = await WishlistItem.find({ userId: req.params.userId, isPublic: true })
    .populate("giftId", "name icon coinPrice")
    .sort({ createdAt: -1 })
    .lean();
  sendOk(res, { items });
}));

wishlistRouter.get("/wishlist/me", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const items = await WishlistItem.find({ userId: req.user!._id })
    .populate("giftId", "name icon coinPrice")
    .sort({ createdAt: -1 })
    .lean();
  sendOk(res, { items });
}));

wishlistRouter.delete("/wishlist/:itemId", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const item = await WishlistItem.findOneAndDelete({ _id: req.params.itemId, userId: req.user!._id });
  if (!item) throw new HttpError(404, "Wishlist item not found", ErrorCode.NOT_FOUND);
  sendOk(res, { deleted: true });
}));

wishlistRouter.post("/wishlist/:itemId/send", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const item = await WishlistItem.findById(req.params.itemId).populate("giftId");
  if (!item) throw new HttpError(404, "Wishlist item not found", ErrorCode.NOT_FOUND);
  if (!item.isPublic && item.userId.toString() !== req.user!._id.toString()) {
    throw new HttpError(403, "This wishlist item is private", ErrorCode.FORBIDDEN);
  }

  const gift = item.giftId as any;
  const coinAmount = gift.coinPrice;
  if (typeof coinAmount !== "number") throw new HttpError(400, "Invalid gift data", ErrorCode.VALIDATION);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(req.user!.id, coinAmount, "GIFT_SENT", { giftId: gift._id.toString(), wishlistItemId: item._id.toString() }, session);
    const receiverCredit = creatorShare(coinAmount);
    await creditWallet(item.userId.toString(), receiverCredit, "GIFT_RECEIVED", { giftId: gift._id.toString(), senderId: req.user!.id, wishlistItemId: item._id.toString(), platformFee: coinAmount - receiverCredit }, session);

    await GiftTransaction.create([{
      senderId: req.user!._id,
      receiverId: item.userId,
      giftId: gift._id,
      coinAmount,
    }], { session });

    await session.commitTransaction();
    session.endSession();
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    throw error;
  }

  await WishlistItem.findByIdAndDelete(item._id);
  sendOk(res, { sent: true, giftName: gift.name });
}));
