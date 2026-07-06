import mongoose, { Schema } from "mongoose";

const walletTransactionSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    type: { type: String, enum: ["CREDIT", "DEBIT"], required: true },
    source: {
      type: String,
      enum: ["RECHARGE", "GIFT_SENT", "GIFT_RECEIVED", "GIFT_SENT_DM", "GIFT_RECEIVED_DM", "VIP_PURCHASE", "ADMIN_ADJUSTMENT", "RAZORPAY_PURCHASE", "GOOGLE_PLAY_PURCHASE"],
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

export const WalletTransaction = mongoose.model("WalletTransaction", walletTransactionSchema);
