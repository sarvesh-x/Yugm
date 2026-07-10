import mongoose, { Schema } from "mongoose";

export const verificationSubmissionStatuses = ["SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED", "NEEDS_RETRY"] as const;

const faceVerificationSubmissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    verificationId: { type: Schema.Types.ObjectId, ref: "TrustVerification", required: true, index: true },
    selfieImageUrl: String,
    selfieVideoUrl: String,
    livenessVideoUrl: String,
    faceMatchScore: Number,
    livenessScore: Number,
    qualityScore: Number,
    provider: String,
    providerReferenceId: String,
    providerResponse: { type: Schema.Types.Mixed },
    status: { type: String, enum: verificationSubmissionStatuses, default: "SUBMITTED", index: true },
    failureReason: String,
    reviewedAt: Date,
    reviewedByAdminId: { type: Schema.Types.ObjectId, ref: "AdminUser" }
  },
  { timestamps: true }
);

faceVerificationSubmissionSchema.index({ userId: 1, createdAt: -1 });

export const FaceVerificationSubmission = mongoose.model("FaceVerificationSubmission", faceVerificationSubmissionSchema);
