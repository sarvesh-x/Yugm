import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { Subscription } from "../models/Subscription.js";
import { User } from "../models/User.js";
import { debitWallet } from "../services/wallet.js";
import { createNotification } from "../services/notifications.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";

export const subscriptionRouter = Router();
subscriptionRouter.use(requireAuth);

const PRICES = { MONTHLY: 299, YEARLY: 2999 } as const;

const subscribeSchema = z.object({
  plan: z.enum(["MONTHLY", "YEARLY"]),
});

subscriptionRouter.post("/subscriptions/:creatorId", validateBody(subscribeSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { creatorId } = req.params;
  if (!isValidObjectId(creatorId)) throw new HttpError(400, "Invalid creator ID", ErrorCode.VALIDATION);
  if (creatorId === req.user!.id) throw new HttpError(400, "Cannot subscribe to yourself", ErrorCode.VALIDATION);

  const creator = await User.findById(creatorId).lean();
  if (!creator) throw new HttpError(404, "Creator not found", ErrorCode.NOT_FOUND);

  const existing = await Subscription.findOne({ subscriberId: req.user!._id, creatorId, active: true });
  if (existing) throw new HttpError(409, "Already subscribed to this creator", ErrorCode.CONFLICT);

  const plan = req.body.plan as "MONTHLY" | "YEARLY";
  const coinAmount = PRICES[plan];
  const expiresAt = new Date(Date.now() + (plan === "MONTHLY" ? 30 : 365) * 24 * 60 * 60 * 1000);

  await debitWallet(req.user!.id, coinAmount, "SUBSCRIPTION", { creatorId, plan });

  const subscription = await Subscription.create({
    subscriberId: req.user!._id,
    creatorId,
    plan,
    coinAmount,
    expiresAt,
  });

  await createNotification(creatorId, "SUBSCRIPTION", "New subscriber", `${req.user!.name} subscribed to you!`, { subscriberId: req.user!.id, plan });

  sendOk(res, { subscription }, 201);
}));

subscriptionRouter.delete("/subscriptions/:creatorId", asyncHandler(async (req: AuthRequest, res) => {
  const { creatorId } = req.params;
  if (!isValidObjectId(creatorId)) throw new HttpError(400, "Invalid creator ID", ErrorCode.VALIDATION);

  const subscription = await Subscription.findOneAndUpdate(
    { subscriberId: req.user!._id, creatorId, active: true },
    { $set: { active: false } },
    { new: true }
  );
  if (!subscription) throw new HttpError(404, "Active subscription not found", ErrorCode.NOT_FOUND);

  sendOk(res, { cancelled: true });
}));

subscriptionRouter.get("/subscriptions", asyncHandler(async (req: AuthRequest, res) => {
  const subscriptions = await Subscription.find({ subscriberId: req.user!._id })
    .populate("creatorId", "name username avatar")
    .sort({ createdAt: -1 })
    .lean();

  sendOk(res, { subscriptions });
}));

subscriptionRouter.get("/subscriptions/subscribers", asyncHandler(async (req: AuthRequest, res) => {
  const subscriptions = await Subscription.find({ creatorId: req.user!._id })
    .populate("subscriberId", "name username avatar")
    .sort({ createdAt: -1 })
    .lean();

  const subscribers = subscriptions.map((s) => ({ ...s, subscriber: s.subscriberId }));

  sendOk(res, { subscribers });
}));

subscriptionRouter.get("/subscriptions/check/:creatorId", asyncHandler(async (req: AuthRequest, res) => {
  const { creatorId } = req.params;
  if (!isValidObjectId(creatorId)) throw new HttpError(400, "Invalid creator ID", ErrorCode.VALIDATION);

  const subscription = await Subscription.findOne({ subscriberId: req.user!._id, creatorId, active: true }).lean();

  sendOk(res, { subscribed: !!subscription, subscription: subscription ?? undefined });
}));
