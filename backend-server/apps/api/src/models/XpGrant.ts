import mongoose, { Schema } from "mongoose";

const xpGrantSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    event: { type: String, required: true },
    actionKey: { type: String, required: true },
    status: { type: String, enum: ["PROCESSING", "COMPLETE"], default: "PROCESSING", required: true },
    requestedXp: { type: Number, required: true },
    receipt: { type: Schema.Types.Mixed }
  },
  { timestamps: true }
);

xpGrantSchema.index({ userId: 1, event: 1, actionKey: 1 }, { unique: true });
xpGrantSchema.index({ status: 1, updatedAt: 1 });
xpGrantSchema.index({ createdAt: -1, event: 1, status: 1 });

export const XpGrant = mongoose.model("XpGrant", xpGrantSchema);
