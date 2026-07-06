import mongoose, { Schema } from "mongoose";

const moderationActionSchema = new Schema(
  {
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    moderatorId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    reportId: { type: Schema.Types.ObjectId, ref: "Report" },
    action: { type: String, enum: ["WARN", "MUTE", "SUSPEND", "BAN", "UNBAN"], required: true },
    reason: { type: String, required: true },
    durationHours: Number,
    expiresAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

moderationActionSchema.index({ targetUserId: 1, createdAt: -1 });
moderationActionSchema.index({ action: 1, createdAt: -1 });

export const ModerationAction = mongoose.model("ModerationAction", moderationActionSchema);
