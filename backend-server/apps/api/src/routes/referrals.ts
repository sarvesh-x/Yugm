import crypto from "node:crypto";
import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { createLimiter } from "../middleware/rateLimit.js";
import { Referral } from "../models/Referral.js";
import { User } from "../models/User.js";
import { claimReferral } from "../services/referrals.js";
import { createNotification } from "../services/notifications.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";

export const referralsRouter = Router();

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
  const result = await claimReferral({ userId: req.user!.id, code: req.body.code, ipAddress: req.ip });
  if (!result.alreadyClaimed) {
    void createNotification(result.referrerId, "SYSTEM", "Referral reward", `${result.claimantName} joined using your code — you earned ${result.reward} coins!`, { rewardCoins: result.reward })
      .catch((error) => console.warn("Referral notification failed after commit:", error instanceof Error ? error.message : String(error)));
  }
  sendOk(res, { reward: result.reward, message: "Referral code applied" });
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
    .populate("referredUserId", "name username avatar avatarType avatarParts")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  sendOk(res, {
    stats: { total, completed, rewarded, totalCoins: rewardAgg[0]?.totalCoins ?? 0 },
    referrals
  });
}));
