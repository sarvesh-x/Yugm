import mongoose, { Schema } from "mongoose";

const reportSchema = new Schema(
  {
    reporterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User" },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    reason: { type: String, required: true },
    description: String,
    evidence: { type: Schema.Types.Mixed, default: {} },
    riskScore: { type: Number, default: 0 },
    autoFlagged: { type: Boolean, default: false },
    autoActionTaken: String,
    moderatorNote: String,
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User" },
    reviewedAt: Date,
    status: {
      type: String,
      enum: ["PENDING", "REVIEWED", "ACTION_TAKEN", "DISMISSED"],
      default: "PENDING"
    }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

reportSchema.index({ status: 1, createdAt: -1 });

export const Report = mongoose.model("Report", reportSchema);
