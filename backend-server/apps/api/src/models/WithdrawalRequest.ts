import mongoose, { Schema } from "mongoose";

export const withdrawalStatuses = ["PENDING_REVIEW", "APPROVED", "REJECTED", "PAID", "CANCELLED", "BLOCKED"] as const;

const withdrawalRequestSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    amountCoins: { type: Number, required: true, min: 1 },
    amountInr: { type: Number, min: 0 },
    status: { type: String, enum: withdrawalStatuses, default: "PENDING_REVIEW", index: true },
    lockedAt: Date,
    approvedAt: Date,
    rejectedAt: Date,
    paidAt: Date,
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    rejectionReason: String,
    payoutReference: String,
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

withdrawalRequestSchema.index({ userId: 1, createdAt: -1 });

export const WithdrawalRequest = mongoose.model("WithdrawalRequest", withdrawalRequestSchema);
