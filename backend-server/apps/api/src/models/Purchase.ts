import mongoose, { Schema } from "mongoose";

export interface IPurchase extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  provider: "RAZORPAY" | "GOOGLE_PLAY";
  status: "PENDING" | "PAID" | "FAILED" | "CREDITED";
  packId: string;
  coinAmount: number;
  amountInr: number;
  currency: "INR";
  providerOrderId?: string;
  providerPaymentId?: string;
  providerSignature?: string;
  productId?: string;
  purchaseToken?: string;
  googleOrderId?: string;
  creditedTransactionId?: mongoose.Types.ObjectId;
  metadata: Record<string, unknown>;
  creditedAt?: Date;
}

const purchaseSchema = new Schema<IPurchase>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    provider: { type: String, enum: ["RAZORPAY", "GOOGLE_PLAY"], required: true },
    status: { type: String, enum: ["PENDING", "PAID", "FAILED", "CREDITED"], default: "PENDING", index: true },
    packId: { type: String, required: true },
    coinAmount: { type: Number, required: true },
    amountInr: { type: Number, required: true },
    currency: { type: String, enum: ["INR"], default: "INR" },
    providerOrderId: { type: String, index: true },
    providerPaymentId: { type: String, index: true },
    providerSignature: String,
    productId: { type: String, index: true },
    purchaseToken: { type: String, index: true },
    googleOrderId: String,
    creditedTransactionId: { type: Schema.Types.ObjectId, ref: "WalletTransaction" },
    metadata: { type: Schema.Types.Mixed, default: {} },
    creditedAt: Date
  },
  { timestamps: true }
);

purchaseSchema.index({ provider: 1, providerOrderId: 1 }, { sparse: true });
purchaseSchema.index({ provider: 1, purchaseToken: 1 }, { unique: true, sparse: true });

export const Purchase = mongoose.model<IPurchase>("Purchase", purchaseSchema);
