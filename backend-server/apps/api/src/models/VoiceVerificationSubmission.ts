import mongoose, { Schema } from "mongoose";
import { verificationSubmissionStatuses } from "./FaceVerificationSubmission.js";

const voiceVerificationSubmissionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    verificationId: { type: Schema.Types.ObjectId, ref: "TrustVerification", required: true, index: true },
    audioUrl: String,
    transcriptText: String,
    promptText: { type: String, required: true },
    voiceLivenessScore: Number,
    voiceMatchScore: Number,
    audioQualityScore: Number,
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

voiceVerificationSubmissionSchema.index({ userId: 1, createdAt: -1 });

export const VoiceVerificationSubmission = mongoose.model("VoiceVerificationSubmission", voiceVerificationSubmissionSchema);
