import mongoose from "mongoose";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Report } from "../models/Report.js";
import { User } from "../models/User.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";

export async function runWithdrawalFraudChecks(userId: string, amountCoins: number) {
  const [user, pendingReports, recentGiftAgg, pendingWithdrawals] = await Promise.all([
    User.findById(userId).select("isBlocked suspendedUntil moderationStrikes").lean(),
    Report.countDocuments({ targetUserId: userId, status: "PENDING" }),
    GiftTransaction.aggregate([
      { $match: { receiverId: new mongoose.Types.ObjectId(userId), createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
      { $group: { _id: null, total: { $sum: "$coinAmount" }, count: { $sum: 1 } } }
    ]),
    WithdrawalRequest.countDocuments({ userId, status: "PENDING_REVIEW" })
  ]);

  const flags: string[] = [];
  let riskScore = 0;
  if (!user || user.isBlocked) {
    flags.push("USER_BLOCKED");
    riskScore += 100;
  }
  if (user?.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
    flags.push("USER_SUSPENDED");
    riskScore += 80;
  }
  if ((user?.moderationStrikes ?? 0) >= 3) {
    flags.push("MODERATION_STRIKES");
    riskScore += 30;
  }
  if (pendingReports > 0) {
    flags.push("PENDING_REPORTS");
    riskScore += Math.min(40, pendingReports * 10);
  }
  if (pendingWithdrawals > 0) {
    flags.push("PENDING_WITHDRAWAL_EXISTS");
    riskScore += 25;
  }

  const recentGiftTotal = recentGiftAgg[0]?.total ?? 0;
  if (amountCoins > Math.max(1000, recentGiftTotal * 0.9)) {
    flags.push("HIGH_WITHDRAWAL_VS_RECENT_EARNINGS");
    riskScore += 20;
  }

  return {
    walletSafe: !flags.includes("PENDING_WITHDRAWAL_EXISTS"),
    reportsSafe: pendingReports === 0,
    fraudSafe: riskScore < 60,
    riskScore,
    riskFlags: flags
  };
}
