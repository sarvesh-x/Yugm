import mongoose, { Schema } from "mongoose";

export const creatorPayoutKycStatuses = ["NOT_SUBMITTED", "PENDING", "VERIFIED", "REJECTED", "NEEDS_RETRY", "EXPIRED", "MANUAL_REVIEW"] as const;
export const creatorPayoutStatuses = ["DISABLED", "ENABLED", "FROZEN", "MANUAL_REVIEW"] as const;

const creatorPayoutKycSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    legalFullName: String,
    dateOfBirth: Date,
    panNumberEncrypted: String,
    panLast4: String,
    panVerified: { type: Boolean, default: false },
    upiIdEncrypted: String,
    upiIdMasked: String,
    bankAccountEncrypted: String,
    bankAccountLast4: String,
    bankIfsc: String,
    bankHolderName: String,
    kycStatus: { type: String, enum: creatorPayoutKycStatuses, default: "NOT_SUBMITTED", index: true },
    payoutStatus: { type: String, enum: creatorPayoutStatuses, default: "DISABLED", index: true },
    submittedAt: Date,
    verifiedAt: Date,
    rejectedAt: Date,
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    rejectionReason: String,
    adminNotes: String,
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

creatorPayoutKycSchema.index({ kycStatus: 1, submittedAt: -1 });

export const CreatorPayoutKyc = mongoose.model("CreatorPayoutKyc", creatorPayoutKycSchema);
