import mongoose, { type ClientSession } from "mongoose";
import { CreatorPayoutKyc } from "../models/CreatorPayoutKyc.js";
import { PayoutReview, payoutReviewStatuses } from "../models/PayoutReview.js";
import { TrustVerification } from "../models/TrustVerification.js";
import { User } from "../models/User.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { decryptSensitiveField } from "./cryptoFields.js";
import { getPayoutProvider } from "./payouts.js";

export type PayoutReviewStatus = typeof payoutReviewStatuses[number];

const allowedTransitions: Record<PayoutReviewStatus, readonly PayoutReviewStatus[]> = {
  PENDING: ["APPROVED", "REJECTED", "NEEDS_MANUAL_REVIEW"],
  NEEDS_MANUAL_REVIEW: ["APPROVED", "REJECTED"],
  APPROVED: ["PAID"],
  REJECTED: [],
  BLOCKED: [],
  PAID: []
};

export function canTransitionPayoutReview(from: PayoutReviewStatus, to: PayoutReviewStatus) {
  return from === to || allowedTransitions[from].includes(to);
}

function assertPayoutReviewTransition(from: PayoutReviewStatus, to: PayoutReviewStatus) {
  if (!canTransitionPayoutReview(from, to)) {
    throw new HttpError(409, `Payout review cannot transition from ${from} to ${to}`, ErrorCode.CONFLICT);
  }
}

async function assertPayoutEligibility(review: any, session: ClientSession) {
  const userId = review.userId.toString();
  const [user, trust, kyc, frozenWallet] = await Promise.all([
    User.findById(userId).select("isBlocked suspendedUntil").session(session).lean(),
    TrustVerification.findOne({
      _id: review.trustVerificationId,
      userId,
      status: "VERIFIED",
      creatorTrustEnabled: true
    }).session(session).lean(),
    CreatorPayoutKyc.findOne({
      _id: review.creatorPayoutKycId,
      userId,
      kycStatus: "VERIFIED",
      payoutStatus: "ENABLED"
    }).session(session).lean(),
    UserSafetyStatus.exists({ userId, isWalletFrozen: true }).session(session)
  ]);

  if (!user || user.isBlocked || (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now())) {
    throw new HttpError(409, "Creator account is no longer eligible for payout", ErrorCode.CONFLICT);
  }
  if (!trust) throw new HttpError(409, "Trust verification is no longer valid", ErrorCode.CONFLICT);
  if (!kyc) throw new HttpError(409, "Creator payout verification is no longer valid", ErrorCode.CONFLICT);
  if (frozenWallet) throw new HttpError(409, "Creator wallet is frozen", ErrorCode.CONFLICT);
}

export function publicPayoutReview(review: any) {
  return {
    id: review?._id?.toString?.() ?? review?.id,
    userId: review?.userId?.toString?.() ?? review?.userId,
    withdrawalRequestId: review?.withdrawalRequestId?.toString?.() ?? review?.withdrawalRequestId,
    trustVerificationId: review?.trustVerificationId?.toString?.() ?? review?.trustVerificationId ?? null,
    creatorPayoutKycId: review?.creatorPayoutKycId?.toString?.() ?? review?.creatorPayoutKycId ?? null,
    status: review?.status ?? "PENDING",
    trustVerified: Boolean(review?.trustVerified),
    kycVerified: Boolean(review?.kycVerified),
    walletSafe: Boolean(review?.walletSafe),
    reportsSafe: Boolean(review?.reportsSafe),
    fraudSafe: Boolean(review?.fraudSafe),
    riskScore: review?.riskScore ?? null,
    riskFlags: review?.riskFlags ?? [],
    adminNotes: review?.adminNotes ?? null,
    rejectionReason: review?.rejectionReason ?? null,
    reviewedAt: review?.reviewedAt ?? null,
    createdAt: review?.createdAt ?? null
  };
}

export async function approvePayoutReview(id: string, adminId: string, notes?: string) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const review = await PayoutReview.findById(id).session(session);
      if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
      const withdrawal = await WithdrawalRequest.findById(review.withdrawalRequestId).session(session);
      if (!withdrawal) throw new HttpError(409, "Withdrawal request is missing", ErrorCode.CONFLICT);
      if (review.status === "APPROVED" && withdrawal.status === "APPROVED") {
        result = review;
        return;
      }
      assertPayoutReviewTransition(review.status as PayoutReviewStatus, "APPROVED");
      if (withdrawal.status !== "PENDING_REVIEW") {
        throw new HttpError(409, `Withdrawal cannot be approved from ${withdrawal.status}`, ErrorCode.CONFLICT);
      }
      await assertPayoutEligibility(review, session);
      review.status = "APPROVED";
      review.reviewedByAdminId = adminId as any;
      review.reviewedAt = new Date();
      review.adminNotes = notes;
      review.rejectionReason = undefined;
      withdrawal.status = "APPROVED";
      withdrawal.approvedAt = new Date();
      withdrawal.reviewedByAdminId = adminId as any;
      withdrawal.rejectedAt = undefined;
      withdrawal.rejectionReason = undefined;
      await Promise.all([review.save({ session }), withdrawal.save({ session })]);
      result = review;
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function rejectPayoutReview(id: string, adminId: string, reason: string, notes?: string) {
  const session = await mongoose.startSession();
  let result: any;
  try {
    await session.withTransaction(async () => {
      const review = await PayoutReview.findById(id).session(session);
      if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
      const withdrawal = await WithdrawalRequest.findById(review.withdrawalRequestId).session(session);
      if (!withdrawal) throw new HttpError(409, "Withdrawal request is missing", ErrorCode.CONFLICT);
      if (review.status === "REJECTED" && withdrawal.status === "REJECTED") {
        result = review;
        return;
      }
      assertPayoutReviewTransition(review.status as PayoutReviewStatus, "REJECTED");
      if (withdrawal.status !== "PENDING_REVIEW") {
        throw new HttpError(409, `Withdrawal cannot be rejected from ${withdrawal.status}`, ErrorCode.CONFLICT);
      }
      review.status = "REJECTED";
      review.reviewedByAdminId = adminId as any;
      review.reviewedAt = new Date();
      review.rejectionReason = reason;
      review.adminNotes = notes;
      withdrawal.status = "REJECTED";
      withdrawal.activeLock = false;
      withdrawal.rejectedAt = new Date();
      withdrawal.reviewedByAdminId = adminId as any;
      withdrawal.rejectionReason = reason;
      await Promise.all([review.save({ session }), withdrawal.save({ session })]);
      result = review;
    });
    return result;
  } finally {
    await session.endSession();
  }
}

export async function markPayoutReviewManual(id: string, adminId: string, notes?: string) {
  const review = await PayoutReview.findById(id);
  if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
  if (review.status === "NEEDS_MANUAL_REVIEW") return review;
  assertPayoutReviewTransition(review.status as PayoutReviewStatus, "NEEDS_MANUAL_REVIEW");
  const withdrawal = await WithdrawalRequest.exists({ _id: review.withdrawalRequestId, status: "PENDING_REVIEW" });
  if (!withdrawal) throw new HttpError(409, "Withdrawal is no longer pending review", ErrorCode.CONFLICT);
  review.status = "NEEDS_MANUAL_REVIEW";
  review.reviewedByAdminId = adminId as any;
  review.reviewedAt = new Date();
  review.adminNotes = notes;
  await review.save();
  return review;
}

export async function markWithdrawalPaid(reviewId: string, adminId: string, payoutReference?: string, notes?: string) {
  const session = await mongoose.startSession();
  let result: { review: any; withdrawal: any } | undefined;
  try {
    await session.withTransaction(async () => {
      const review = await PayoutReview.findById(reviewId).session(session);
      if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
      const withdrawal = await WithdrawalRequest.findById(review.withdrawalRequestId).session(session);
      if (!withdrawal) throw new HttpError(409, "Withdrawal request is missing", ErrorCode.CONFLICT);
      if (review.status === "PAID" && withdrawal.status === "PAID") {
        result = { review, withdrawal };
        return;
      }
      assertPayoutReviewTransition(review.status as PayoutReviewStatus, "PAID");
      if (withdrawal.status !== "APPROVED") {
        throw new HttpError(409, `Withdrawal cannot be paid from ${withdrawal.status}`, ErrorCode.CONFLICT);
      }
      await assertPayoutEligibility(review, session);

      const kyc = await CreatorPayoutKyc.findOne({ userId: review.userId, kycStatus: "VERIFIED", payoutStatus: "ENABLED" }).session(session).lean();
      if (!kyc) throw new HttpError(409, "Creator payout KYC is no longer valid", ErrorCode.CONFLICT);

      const amountInr = withdrawal.amountInr ?? 0;
      let providerRef = payoutReference;

      if (amountInr > 0) {
        const provider = getPayoutProvider();
        const upiId = decryptSensitiveField(kyc.upiIdEncrypted);
        const bankAccountNumber = decryptSensitiveField(kyc.bankAccountEncrypted);
        const payoutResult = await provider.transfer({
          userId: review.userId.toString(),
          legalFullName: kyc.legalFullName ?? "Creator",
          upiId: upiId || undefined,
          ...(bankAccountNumber && kyc.bankIfsc && kyc.bankHolderName
            ? { bankAccount: { accountNumber: bankAccountNumber, ifsc: kyc.bankIfsc, holderName: kyc.bankHolderName } }
            : {})
        }, amountInr, notes);
        if (!payoutResult.success) {
          throw new HttpError(502, `Payout execution failed: ${payoutResult.errorMessage ?? "Unknown error"}`, ErrorCode.VALIDATION);
        }
        providerRef = payoutResult.reference;
      }

      review.status = "PAID";
      review.reviewedByAdminId = adminId as any;
      review.reviewedAt = new Date();
      review.adminNotes = notes ?? review.adminNotes;
      withdrawal.status = "PAID";
      withdrawal.activeLock = false;
      withdrawal.paidAt = new Date();
      withdrawal.payoutReference = providerRef;
      withdrawal.reviewedByAdminId = adminId as any;
      withdrawal.metadata = { ...(withdrawal.metadata ?? {}), paidNotes: notes };
      await Promise.all([review.save({ session }), withdrawal.save({ session })]);
      result = { review, withdrawal };
    });
    if (!result) throw new HttpError(500, "Payout transition did not complete", ErrorCode.INTERNAL);
    return result;
  } finally {
    await session.endSession();
  }
}
