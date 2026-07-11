import mongoose from "mongoose";
import { CreatorPayoutKyc } from "../models/CreatorPayoutKyc.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { PayoutReview } from "../models/PayoutReview.js";
import { TrustVerification } from "../models/TrustVerification.js";
import { User } from "../models/User.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";
import { runWithdrawalFraudChecks } from "./fraudDetection.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export const CREATOR_COIN_TO_INR_RATE = 0.01;
export const activeWithdrawalStatuses = ["PENDING_REVIEW", "APPROVED"] as const;

export function creatorCoinsToInr(amountCoins: number) {
  return Math.round(amountCoins * CREATOR_COIN_TO_INR_RATE * 100) / 100;
}

function isDuplicateKeyError(error: unknown) {
  return Boolean(error && typeof error === "object" && "code" in error && (error as { code?: number }).code === 11000);
}

async function rollbackWithdrawalReservation(withdrawalId: string) {
  const deleted = await WithdrawalRequest.deleteOne({
    _id: withdrawalId,
    status: "PENDING_REVIEW",
    activeLock: true
  });
  if (deleted.deletedCount > 0) return;
  await WithdrawalRequest.updateOne(
    { _id: withdrawalId, status: "PENDING_REVIEW" },
    {
      $set: {
        status: "CANCELLED",
        activeLock: false,
        rejectionReason: "Withdrawal review creation failed"
      }
    }
  );
}

export function publicWithdrawal(withdrawal: any) {
  return {
    id: withdrawal?._id?.toString?.() ?? withdrawal?.id,
    userId: withdrawal?.userId?.toString?.() ?? withdrawal?.userId,
    amountCoins: withdrawal?.amountCoins ?? 0,
    amountInr: withdrawal?.amountInr ?? 0,
    status: withdrawal?.status ?? "PENDING_REVIEW",
    lockedAt: withdrawal?.lockedAt ?? null,
    approvedAt: withdrawal?.approvedAt ?? null,
    rejectedAt: withdrawal?.rejectedAt ?? null,
    paidAt: withdrawal?.paidAt ?? null,
    rejectionReason: withdrawal?.rejectionReason ?? null,
    payoutReference: withdrawal?.payoutReference ?? null,
    createdAt: withdrawal?.createdAt ?? null
  };
}

export async function creatorEarningBalance(userId: string) {
  const objectId = new mongoose.Types.ObjectId(userId);
  const [earned, withdrawals] = await Promise.all([
    GiftTransaction.aggregate([
      { $match: { receiverId: objectId } },
      { $group: { _id: null, total: { $sum: "$coinAmount" } } }
    ]),
    WithdrawalRequest.aggregate([
      { $match: { userId: objectId, status: { $in: ["PENDING_REVIEW", "APPROVED", "PAID"] } } },
      { $group: {
        _id: null,
        total: { $sum: "$amountCoins" },
        locked: { $sum: { $cond: [{ $in: ["$status", ["PENDING_REVIEW", "APPROVED"]] }, "$amountCoins", 0] } },
        withdrawn: { $sum: { $cond: [{ $eq: ["$status", "PAID"] }, "$amountCoins", 0] } }
      } }
    ])
  ]);
  const earnedCoins = earned[0]?.total ?? 0;
  const deductedCoins = withdrawals[0]?.total ?? 0;
  const lockedCoins = withdrawals[0]?.locked ?? 0;
  const withdrawnCoins = withdrawals[0]?.withdrawn ?? 0;
  return {
    earnedCoins,
    lockedCoins,
    withdrawnCoins,
    availableCoins: Math.max(0, earnedCoins - deductedCoins)
  };
}

export async function createWithdrawalRequest(userId: string, amountCoins: number) {
  const user = await User.findById(userId).select("role isBlocked suspendedUntil").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  if (user.role !== "HOST" && user.role !== "MODERATOR" && user.role !== "ADMIN") {
    throw new HttpError(403, "Withdrawals are available only to creators or hosts", ErrorCode.FORBIDDEN);
  }
  if (user.isBlocked || (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now())) {
    throw new HttpError(403, "Your wallet is temporarily restricted.", ErrorCode.FORBIDDEN);
  }

  const trust = await TrustVerification.findOne({ userId }).lean();
  if (!trust || trust.status !== "VERIFIED" || !trust.creatorTrustEnabled) {
    throw new HttpError(403, "Complete Yugm Trust Verification before withdrawing.", ErrorCode.FORBIDDEN);
  }

  const payoutKyc = await CreatorPayoutKyc.findOne({ userId }).lean();
  if (!payoutKyc || payoutKyc.kycStatus === "NOT_SUBMITTED") {
    throw new HttpError(403, "Complete Creator Payout KYC before withdrawing.", ErrorCode.FORBIDDEN);
  }
  if (payoutKyc.kycStatus === "PENDING" || payoutKyc.kycStatus === "MANUAL_REVIEW") {
    throw new HttpError(409, "Your payout KYC is under review.", ErrorCode.CONFLICT);
  }
  if (payoutKyc.kycStatus !== "VERIFIED" || payoutKyc.payoutStatus !== "ENABLED") {
    throw new HttpError(403, payoutKyc.payoutStatus === "FROZEN" ? "Your wallet is temporarily restricted." : "Complete Creator Payout KYC before withdrawing.", ErrorCode.FORBIDDEN);
  }

  const existingActiveWithdrawal = await WithdrawalRequest.exists({
    userId,
    $or: [
      { activeLock: true },
      { activeLock: { $exists: false }, status: { $in: activeWithdrawalStatuses } }
    ]
  });
  if (existingActiveWithdrawal) {
    throw new HttpError(409, "Complete the active withdrawal before requesting another.", ErrorCode.CONFLICT);
  }

  const balance = await creatorEarningBalance(userId);
  if (amountCoins > balance.availableCoins) throw new HttpError(402, "Insufficient creator earning balance", ErrorCode.INSUFFICIENT_FUNDS);

  const fraud = await runWithdrawalFraudChecks(userId, amountCoins);
  const reviewStatus = fraud.fraudSafe && fraud.walletSafe && fraud.reportsSafe ? "PENDING" : "NEEDS_MANUAL_REVIEW";
  let withdrawal: any;
  try {
    withdrawal = await WithdrawalRequest.create({
      userId,
      amountCoins,
      amountInr: creatorCoinsToInr(amountCoins),
      status: "PENDING_REVIEW",
      activeLock: true,
      lockedAt: new Date(),
      metadata: { coinToInrRate: CREATOR_COIN_TO_INR_RATE }
    });
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      throw new HttpError(409, "Complete the active withdrawal before requesting another.", ErrorCode.CONFLICT);
    }
    throw error;
  }

  let review: any;
  try {
    review = await PayoutReview.create({
      userId,
      withdrawalRequestId: withdrawal.id,
      trustVerificationId: trust._id,
      creatorPayoutKycId: payoutKyc._id,
      status: reviewStatus,
      trustVerified: true,
      kycVerified: true,
      walletSafe: fraud.walletSafe,
      reportsSafe: fraud.reportsSafe,
      fraudSafe: fraud.fraudSafe,
      riskScore: fraud.riskScore,
      riskFlags: fraud.riskFlags
    });
  } catch (error) {
    await rollbackWithdrawalReservation(withdrawal.id).catch((rollbackError) => {
      console.error("Failed to roll back withdrawal reservation:", rollbackError);
    });
    throw error;
  }

  return {
    withdrawal,
    review,
    balance: await creatorEarningBalance(userId),
    message: reviewStatus === "NEEDS_MANUAL_REVIEW" ? "Your withdrawal needs manual review." : "Withdrawal sent to finance review."
  };
}
