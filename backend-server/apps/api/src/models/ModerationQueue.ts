import mongoose, { Schema } from "mongoose";

const moderationQueueSchema = new Schema(
  {
    reportId: { type: Schema.Types.ObjectId, ref: "Report", index: true },
    targetType: {
      type: String,
      enum: ["USER", "PROFILE", "ROOM", "MESSAGE", "PHOTO", "VIDEO_ROOM", "VOICE_ROOM", "CHAT", "WITHDRAWAL", "PAYMENT"],
      required: true,
      index: true
    },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    priority: { type: String, enum: ["LOW", "MEDIUM", "HIGH", "CRITICAL"], default: "MEDIUM", index: true },
    status: { type: String, enum: ["PENDING", "IN_REVIEW", "ESCALATED", "ACTION_TAKEN", "DISMISSED", "AUTO_RESOLVED"], default: "PENDING", index: true },
    assignedTo: { type: Schema.Types.ObjectId, ref: "AdminUser" },
    reason: String,
    aiScore: Number,
    notes: String,
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: "AdminUser" }
  },
  { timestamps: true }
);

moderationQueueSchema.index({ status: 1, priority: 1, createdAt: -1 });

export const ModerationQueue = mongoose.model("ModerationQueue", moderationQueueSchema);
