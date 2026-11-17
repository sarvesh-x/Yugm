import mongoose, { Schema } from "mongoose";
import { walletSources } from "@yugm/shared";

const walletTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    source: {
      type: String,
      enum: walletSources,
      required: true
    },
    amount: { type: Number, required: true, min: 1 },
    balanceBefore: { type: Number, required: true },
    balanceAfter: { type: Number, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} },
    purchaseToken: String,
    productId: String,
    platform: String,
    verificationStatus: String,
    creditedAt: Date
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

walletTransactionSchema.index({ userId: 1, createdAt: -1 });
walletTransactionSchema.index(
  { userId: 1, "metadata.idempotencyKey": 1 },
  { unique: true, partialFilterExpression: { "metadata.idempotencyKey": { $type: "string" } } }
);
walletTransactionSchema.index(
  { userId: 1, source: 1, "metadata.day": 1 },
  {
    unique: true,
    partialFilterExpression: {
      source: "DAILY_REWARD",
      "metadata.day": { $type: "string" }
    }
  }
);

export const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);
