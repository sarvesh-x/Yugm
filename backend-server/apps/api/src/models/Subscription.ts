import mongoose, { Schema } from "mongoose";

export interface ISubscription extends mongoose.Document {
  subscriberId: mongoose.Types.ObjectId;
  creatorId: mongoose.Types.ObjectId;
  plan: "MONTHLY" | "YEARLY";
  coinAmount: number;
  active: boolean;
  expiresAt: Date;
}

const subscriptionSchema = new Schema({
  subscriberId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  creatorId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  plan: { type: String, enum: ["MONTHLY", "YEARLY"], required: true },
  coinAmount: { type: Number, required: true },
  active: { type: Boolean, default: true },
  expiresAt: { type: Date, required: true },
}, { timestamps: true });

subscriptionSchema.index({ subscriberId: 1, creatorId: 1 }, { unique: true });

export const Subscription = mongoose.model<ISubscription>("Subscription", subscriptionSchema);
