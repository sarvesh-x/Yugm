import mongoose, { Schema } from "mongoose";

export const trustVerificationStatuses = ["NOT_STARTED", "INCOMPLETE", "PENDING_REVIEW", "VERIFIED", "REJECTED", "NEEDS_RETRY", "SUSPENDED", "EXPIRED"] as const;
export const trustVerificationLevels = ["BASIC", "ADVANCED"] as const;
export const trustCheckStatuses = ["NOT_SUBMITTED", "SUBMITTED", "PENDING_REVIEW", "VERIFIED", "REJECTED", "NEEDS_RETRY"] as const;

const trustVerificationSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    status: { type: String, enum: trustVerificationStatuses, default: "NOT_STARTED", index: true },
    level: { type: String, enum: trustVerificationLevels, default: "BASIC" },
    faceStatus: { type: String, enum: trustCheckStatuses, default: "NOT_SUBMITTED" },
    voiceStatus: { type: String, enum: trustCheckStatuses, default: "NOT_SUBMITTED" },
    livenessStatus: { type: String, enum: trustCheckStatuses, default: "NOT_SUBMITTED" },
    verificationScore: Number,
    riskScore: Number,
    verifiedBadgeEnabled: { type: Boolean, default: false },
    creatorTrustEnabled: { type: Boolean, default: false },
    submittedAt: Date,
    reviewedAt: Date,
    verifiedAt: Date,
    rejectedAt: Date,
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    rejectionReason: String,
    adminNotes: String,
    consentVersion: String,
    consentAcceptedAt: Date
  },
  { timestamps: true }
);

trustVerificationSchema.index({ status: 1, submittedAt: -1 });

export const TrustVerification = mongoose.model("TrustVerification", trustVerificationSchema);
