import mongoose, { Schema } from "mongoose";

const userSafetyStatusSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true, index: true },
    trustScore: { type: Number, default: 100, min: 0, max: 100 },
    riskLevel: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "LOW", index: true },
    warningCount: { type: Number, default: 0 },
    reportCount: { type: Number, default: 0 },
    suspensionCount: { type: Number, default: 0 },
    isShadowBanned: { type: Boolean, default: false },
    isChatRestricted: { type: Boolean, default: false },
    isRoomRestricted: { type: Boolean, default: false },
    isWalletFrozen: { type: Boolean, default: false },
    lastReviewedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    lastReviewedAt: Date
  },
  { timestamps: true }
);

export const UserSafetyStatus = mongoose.model("UserSafetyStatus", userSafetyStatusSchema);
