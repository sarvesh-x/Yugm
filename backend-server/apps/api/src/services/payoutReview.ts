import { PayoutReview } from "../models/PayoutReview.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";
import { ErrorCode, HttpError } from "../utils/http.js";

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
  const review = await PayoutReview.findById(id);
  if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
  review.status = "APPROVED";
  review.reviewedByAdminId = adminId as any;
  review.reviewedAt = new Date();
  review.adminNotes = notes;
  await review.save();
  await WithdrawalRequest.findByIdAndUpdate(review.withdrawalRequestId, {
    status: "APPROVED",
    approvedAt: new Date(),
    reviewedByAdminId: adminId
  });
  return review;
}

export async function rejectPayoutReview(id: string, adminId: string, reason: string, notes?: string) {
  const review = await PayoutReview.findById(id);
  if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
  review.status = "REJECTED";
  review.reviewedByAdminId = adminId as any;
  review.reviewedAt = new Date();
  review.rejectionReason = reason;
  review.adminNotes = notes;
  await review.save();
  await WithdrawalRequest.findByIdAndUpdate(review.withdrawalRequestId, {
    status: "REJECTED",
    rejectedAt: new Date(),
    reviewedByAdminId: adminId,
    rejectionReason: reason
  });
  return review;
}

export async function markPayoutReviewManual(id: string, adminId: string, notes?: string) {
  const review = await PayoutReview.findById(id);
  if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
  review.status = "NEEDS_MANUAL_REVIEW";
  review.reviewedByAdminId = adminId as any;
  review.reviewedAt = new Date();
  review.adminNotes = notes;
  await review.save();
  await WithdrawalRequest.findByIdAndUpdate(review.withdrawalRequestId, { status: "PENDING_REVIEW", reviewedByAdminId: adminId });
  return review;
}

export async function markWithdrawalPaid(reviewId: string, adminId: string, payoutReference?: string, notes?: string) {
  const review = await PayoutReview.findById(reviewId);
  if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
  if (review.status !== "APPROVED") throw new HttpError(409, "Approve payout review before marking paid", ErrorCode.CONFLICT);
  const withdrawal = await WithdrawalRequest.findByIdAndUpdate(
    review.withdrawalRequestId,
    { status: "PAID", paidAt: new Date(), payoutReference, reviewedByAdminId: adminId, metadata: { paidNotes: notes } },
    { new: true }
  );
  return { review, withdrawal };
}
