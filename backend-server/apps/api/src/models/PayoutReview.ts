import mongoose, { Schema } from "mongoose";

export const payoutReviewStatuses = ["PENDING", "APPROVED", "REJECTED", "NEEDS_MANUAL_REVIEW", "BLOCKED"] as const;

const payoutReviewSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    withdrawalRequestId: { type: Schema.Types.ObjectId, ref: "WithdrawalRequest", required: true, unique: true, index: true },
    trustVerificationId: { type: Schema.Types.ObjectId, ref: "TrustVerification" },
    creatorPayoutKycId: { type: Schema.Types.ObjectId, ref: "CreatorPayoutKyc" },
    status: { type: String, enum: payoutReviewStatuses, default: "PENDING", index: true },
    trustVerified: { type: Boolean, default: false },
    kycVerified: { type: Boolean, default: false },
    walletSafe: { type: Boolean, default: false },
    reportsSafe: { type: Boolean, default: false },
    fraudSafe: { type: Boolean, default: false },
    riskScore: Number,
    riskFlags: { type: Schema.Types.Mixed, default: [] },
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    adminNotes: String,
    rejectionReason: String,
    reviewedAt: Date
  },
  { timestamps: true }
);

payoutReviewSchema.index({ status: 1, createdAt: -1 });

export const PayoutReview = mongoose.model("PayoutReview", payoutReviewSchema);
