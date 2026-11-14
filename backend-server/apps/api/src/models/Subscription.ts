import mongoose, { Schema } from "mongoose";

export type SubscriptionStatus = "ACTIVE" | "IN_GRACE_PERIOD" | "CANCELLED" | "EXPIRED" | "ON_HOLD" | "PENDING";

export interface ISubscription extends mongoose.Document {
  subscriberId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  plan: "MONTHLY" | "YEARLY" | string;
  coinAmount: number;
  active: boolean;
  expiresAt: Date;
  provider?: "GOOGLE_PLAY";
  providerPurchaseToken?: string;
  providerOrderId?: string;
  autoRenewing?: boolean;
  status?: SubscriptionStatus;
  lastVerifiedAt?: Date;
  lastCreditedExpiry?: Date;
  creatorCoinAmount?: number;
  platformFeeCoins?: number;
  renewalCount?: number;
}

const subscriptionSchema = new Schema({
  subscriberId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  plan: { type: String, enum: ["MONTHLY", "YEARLY"], required: true },
  coinAmount: { type: Number, required: true },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
  provider: { type: String, enum: ["GOOGLE_PLAY"] },
  providerPurchaseToken: { type: String, index: true },
  providerOrderId: String,
  autoRenewing: { type: Boolean, default: false },
  status: { type: String, enum: ["ACTIVE", "IN_GRACE_PERIOD", "CANCELLED", "EXPIRED", "ON_HOLD", "PENDING"], default: "ACTIVE", index: true },
  lastVerifiedAt: Date,
  lastCreditedExpiry: Date,
  creatorCoinAmount: { type: Number, default: 0 },
  platformFeeCoins: { type: Number, default: 0 },
  renewalCount: { type: Number, default: 0 },
}, { timestamps: true });

subscriptionSchema.index({ subscriberId: 1, creatorId: 1 }, { unique: true });

export const Subscription = mongoose.model<ISubscription>("Subscription", subscriptionSchema);
