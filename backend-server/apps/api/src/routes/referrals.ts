import crypto from "node:crypto";
import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { createLimiter } from "../middleware/rateLimit.js";
import { Referral } from "../models/Referral.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { creditWallet } from "../services/wallet.js";
import { createNotification } from "../services/notifications.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";

export const referralsRouter = Router();

const REFERRAL_REWARD_COINS = 100;

function generateReferralCode(name: string): string {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}${suffix}`;
}

referralsRouter.post("/referrals/code", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (req.user!.referralCode) {
    return sendOk(res, { referralCode: req.user!.referralCode });
  }
  let code = generateReferralCode(req.user!.name);
  while (await User.findOne({ referralCode: code })) {
    code = generateReferralCode(req.user!.name);
  }
  await req.user!.updateOne({ referralCode: code });
  sendOk(res, { referralCode: code });
}));

referralsRouter.get("/referrals/code", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!req.user!.referralCode) {
    let code = generateReferralCode(req.user!.name);
    while (await User.findOne({ referralCode: code })) {
      code = generateReferralCode(req.user!.name);
    }
    await req.user!.updateOne({ referralCode: code });
  }
  sendOk(res, { referralCode: req.user!.referralCode });
}));

referralsRouter.post("/referrals/claim", requireAuth, createLimiter, validateBody(z.object({ code: z.string().min(4).max(20) })), asyncHandler(async (req: AuthRequest, res) => {
  const { code } = req.body;
  const referrer = await User.findOne({ referralCode: code.toUpperCase() });
  if (!referrer) throw new HttpError(404, "Invalid referral code", ErrorCode.NOT_FOUND);
  if (referrer._id.equals(req.user!._id)) throw new HttpError(400, "Cannot refer yourself", ErrorCode.VALIDATION);

  const existing = await Referral.findOne({ referredUserId: req.user!._id, status: { $in: ["COMPLETED", "REWARDED"] } });
  if (existing) throw new HttpError(400, "Already claimed a referral code", ErrorCode.VALIDATION);

  const referral = await Referral.create({
    referrerId: referrer._id,
    referredUserId: req.user!._id,
    referralCode: code.toUpperCase(),
    status: "COMPLETED",
    completedAt: new Date(),
    ipAddress: req.ip
  });

  await req.user!.updateOne({ referredBy: referrer._id });

  await Promise.all([
    creditWallet(req.user!._id.toString(), REFERRAL_REWARD_COINS, "referral_bonus", { message: "Welcome bonus for using referral code", type: "referral" }),
    creditWallet(referrer._id.toString(), REFERRAL_REWARD_COINS, "referral_bonus", { message: `Referral reward for ${req.user!.name}`, type: "referral" })
  ]);

  referral.status = "REWARDED";
  referral.rewardCoins = REFERRAL_REWARD_COINS;
  referral.rewardedAt = new Date();
  await referral.save();

  await createNotification(referrer._id.toString(), "SYSTEM", "Referral reward", `${req.user!.name} joined using your code — you earned ${REFERRAL_REWARD_COINS} coins!`, { rewardCoins: REFERRAL_REWARD_COINS });

  sendOk(res, { reward: REFERRAL_REWARD_COINS, message: "Referral code applied" });
}));

referralsRouter.get("/referrals/stats", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const [total, completed, rewarded] = await Promise.all([
    Referral.countDocuments({ referrerId: req.user!._id }),
    Referral.countDocuments({ referrerId: req.user!._id, status: { $in: ["COMPLETED", "REWARDED"] } }),
    Referral.countDocuments({ referrerId: req.user!._id, status: "REWARDED" })
  ]);

  const rewardAgg = await Referral.aggregate([
    { $match: { referrerId: req.user!._id, status: "REWARDED" } },
    { $group: { _id: null, totalCoins: { $sum: "$rewardCoins" } } }
  ]);

  const referrals = await Referral.find({ referrerId: req.user!._id })
    .populate("referredUserId", "name username avatar")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  sendOk(res, {
    stats: { total, completed, rewarded, totalCoins: rewardAgg[0]?.totalCoins ?? 0 },
    referrals
  });
}));
