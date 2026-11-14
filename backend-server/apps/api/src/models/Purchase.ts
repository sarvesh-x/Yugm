import mongoose, { Schema } from "mongoose";

export type PurchaseAssetCurrency = "COINS" | "DIAMONDS";

export interface IPurchase extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  provider: "RAZORPAY" | "GOOGLE_PLAY";
  status: "PENDING" | "PAID" | "FAILED" | "CREDITED" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED";
  packId: string;
  assetCurrency: PurchaseAssetCurrency;
  coinAmount: number;
  diamondAmount: number;
  amountInr: number;
  currency: "INR";
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSignature?: string;
  productId?: string;
  purchaseToken?: string;
  googleOrderId?: string;
  creditedTransactionId?: mongoose.Types.ObjectId;
  creditedDiamondTransactionId?: mongoose.Types.ObjectId;
  refundTransactionId?: mongoose.Types.ObjectId;
  refundProviderId?: string;
  refundedAt?: Date;
  metadata: Record<string, unknown>;
  creditedAt?: Date;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["RAZORPAY", "GOOGLE_PLAY"], required: true },
    status: { type: String, enum: ["PENDING", "PAID", "FAILED", "CREDITED", "REFUND_PENDING", "REFUNDED", "REFUND_FAILED"], default: "PENDING", index: true },
    packId: { type: String, required: true },
    assetCurrency: { type: String, enum: ["COINS", "DIAMONDS"], default: "COINS" },
    coinAmount: { type: Number, required: true, default: 0 },
    diamondAmount: { type: Number, required: true, default: 0 },
    amountInr: { type: Number, required: true },
    currency: { type: String, enum: ["INR"], default: "INR" },
    providerOrderId: { type: String, index: true },
    providerPaymentId: { type: String, index: true },
    providerSignature: String,
    productId: { type: String, index: true },
    purchaseToken: { type: String, index: true },
    googleOrderId: String,
    creditedTransactionId: { type: Schema.Types.ObjectId, ref: "WalletTransaction" },
    creditedDiamondTransactionId: { type: Schema.Types.ObjectId, ref: "DiamondTransaction" },
    refundTransactionId: { type: Schema.Types.ObjectId, ref: "WalletTransaction" },
    refundProviderId: { type: String, index: true },
    refundedAt: Date,
    metadata: { type: Schema.Types.Mixed, default: {} },
    creditedAt: Date
  },
  { timestamps: true }
);

purchaseSchema.index({ provider: 1, providerOrderId: 1 }, { sparse: true });
purchaseSchema.index({ provider: 1, purchaseToken: 1 }, { unique: true, sparse: true });

export const Purchase = mongoose.model<IPurchase>("Purchase", purchaseSchema);
