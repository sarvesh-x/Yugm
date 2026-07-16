import mongoose, { Schema } from "mongoose";

export interface IReferral extends mongoose.Document {
  referrerId: mongoose.Types.ObjectId;
  referredUserId?: mongoose.Types.ObjectId;
  referralCode: string;
  status: "PENDING" | "COMPLETED" | "REWARDED" | "EXPIRED";
  rewardCoins?: number;
  rewardCosmeticId?: string;
  completedAt?: Date;
  rewardedAt?: Date;
  ipAddress?: string;
}

const referralSchema = new Schema<IReferral>(
  {
    referrerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    referredUserId: { type: Schema.Types.ObjectId, ref: "User" },
    referralCode: { type: String, required: true, index: true },
    status: { type: String, enum: ["PENDING", "COMPLETED", "REWARDED", "EXPIRED"], default: "PENDING" },
    rewardCoins: Number,
    rewardCosmeticId: String,
    completedAt: Date,
    rewardedAt: Date,
    ipAddress: String
  },
  { timestamps: true }
);

referralSchema.index({ referralCode: 1 }, { unique: true });

export const Referral = mongoose.model<IReferral>("Referral", referralSchema);
