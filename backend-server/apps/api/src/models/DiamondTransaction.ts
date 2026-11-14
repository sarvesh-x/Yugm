import mongoose, { Schema } from "mongoose";
import { diamondSources } from "@yugm/shared";

const diamondTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    source: { type: String, enum: [...diamondSources], required: true },
    amount: { type: Number, required: true, min: 1 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    idempotencyKey: { type: String, unique: true, sparse: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

diamondTransactionSchema.index({ userId: 1, createdAt: -1 });

export const DiamondTransaction = mongoose.model("DiamondTransaction", diamondTransactionSchema);
