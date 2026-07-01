import mongoose, { Schema } from "mongoose";

const blockSchema = new Schema(
  {
    blockerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    blockedUserId: { type: Schema.Types.ObjectId, ref: "User", required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

blockSchema.index({ blockerId: 1, blockedUserId: 1 }, { unique: true });

export const Block = mongoose.model("Block", blockSchema);
