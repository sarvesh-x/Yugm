import mongoose, { Schema } from "mongoose";

const adminModerationActionSchema = new Schema(
  {
    adminId: { type: Schema.Types.ObjectId, ref: "AdminUser", required: true, index: true },
    queueId: { type: Schema.Types.ObjectId, ref: "ModerationQueue" },
    reportId: { type: Schema.Types.ObjectId, ref: "Report" },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    actionType: {
      type: String,
      enum: [
        "WARNING_SENT",
        "USER_SUSPENDED",
        "USER_BANNED",
        "USER_UNBANNED",
        "PROFILE_HIDDEN",
        "PROFILE_RESTORED",
        "PHOTO_REMOVED",
        "MESSAGE_DELETED",
        "ROOM_ENDED",
        "ROOM_FEATURED",
        "ROOM_UNFEATURED",
        "CHAT_RESTRICTED",
        "WALLET_FROZEN",
        "WITHDRAWAL_REJECTED",
        "REPORT_DISMISSED",
        "ESCALATED",
        "NO_ACTION"
      ],
      required: true,
      index: true
    },
    reason: String,
    durationHours: Number,
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

adminModerationActionSchema.index({ createdAt: -1 });

export const AdminModerationAction = mongoose.model("AdminModerationAction", adminModerationActionSchema);
