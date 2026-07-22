import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import {
  getGiftsV2,
  getCollections,
  comboGift,
  roomWideGift,
  surpriseBox,
  upgradeGift,
  getInventory,
  tradeGift
} from "../services/gifts.js";

export const giftsRouter = Router();
giftsRouter.use(requireAuth);

const comboGiftSchema = z.object({
  roomId: z.string().min(1),
  giftId: z.string().min(1),
  participants: z.array(z.string().min(1)).min(2).max(50)
});

const roomWideGiftSchema = z.object({
  roomId: z.string().min(1),
  giftId: z.string().min(1),
  receiverIds: z.array(z.string().min(1)).min(1).max(100)
});

const surpriseBoxSchema = z.object({
  roomId: z.string().min(1).optional(),
  tier: z.enum(["basic", "premium", "luxury"])
});

const upgradeGiftSchema = z.object({
  inventoryId: z.string().min(1)
});

const tradeGiftSchema = z.object({
  targetUserId: z.string().min(1),
  offerItems: z.array(z.string().min(1)).min(1).max(20),
  requestItems: z.array(z.string().min(1)).min(1).max(20)
});

giftsRouter.get("/gifts/v2", asyncHandler(async (req: AuthRequest, res) => {
  const category = req.query.category as string | undefined;
  const rarity = req.query.rarity as string | undefined;
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const result = await getGiftsV2(category, rarity, page, limit);
  sendOk(res, result);
}));

giftsRouter.get("/gifts/collections", asyncHandler(async (_req: AuthRequest, res) => {
  const result = await getCollections();
  sendOk(res, result);
}));

giftsRouter.post("/gifts/combo", validateBody(comboGiftSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { roomId, giftId, participants } = req.body;
  if (!isValidObjectId(giftId)) throw new HttpError(400, "Invalid giftId", ErrorCode.VALIDATION);
  const result = await comboGift(roomId, giftId, participants, req.user!.id);
  sendOk(res, result);
}));

giftsRouter.post("/gifts/room-wide", validateBody(roomWideGiftSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { roomId, giftId, receiverIds } = req.body;
  if (!isValidObjectId(giftId)) throw new HttpError(400, "Invalid giftId", ErrorCode.VALIDATION);
  const result = await roomWideGift(roomId, giftId, req.user!.id, receiverIds);
  sendOk(res, result);
}));

giftsRouter.post("/gifts/surprise-box", validateBody(surpriseBoxSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { tier } = req.body;
  const result = await surpriseBox(req.user!.id, tier);
  sendOk(res, result);
}));

giftsRouter.post("/gifts/upgrade", validateBody(upgradeGiftSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { inventoryId } = req.body;
  if (!isValidObjectId(inventoryId)) throw new HttpError(400, "Invalid inventoryId", ErrorCode.VALIDATION);
  const result = await upgradeGift(req.user!.id, inventoryId);
  sendOk(res, result);
}));

giftsRouter.get("/inventory", asyncHandler(async (req: AuthRequest, res) => {
  const result = await getInventory(req.user!.id);
  sendOk(res, result);
}));

giftsRouter.post("/inventory/trade", validateBody(tradeGiftSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { targetUserId, offerItems, requestItems } = req.body;
  if (!isValidObjectId(targetUserId)) throw new HttpError(400, "Invalid targetUserId", ErrorCode.VALIDATION);
  for (const id of [...offerItems, ...requestItems]) {
    if (!isValidObjectId(id)) throw new HttpError(400, "Invalid inventory item ID", ErrorCode.VALIDATION);
  }
  const result = await tradeGift(req.user!.id, targetUserId, offerItems, requestItems);
  sendOk(res, result);
}));
