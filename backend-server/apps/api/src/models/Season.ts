import mongoose, { Schema } from "mongoose";

export interface ISeasonReward {
  level: number;
  freeReward?: { type: "xp" | "coins" | "cosmetic" | "title"; id?: string; amount?: number };
  premiumReward?: { type: "xp" | "coins" | "cosmetic" | "title" | "diamonds"; id?: string; amount?: number };
}

export interface ISeason extends mongoose.Document {
  key: string;
  name: string;
  description: string;
  startDate: Date;
  endDate: Date;
  maxLevel: number;
  xpPerLevel: number;
  rewards: ISeasonReward[];
  premiumPrice: number;
  active: boolean;
}

const seasonRewardSchema = new Schema<ISeasonReward>({
  level: { type: Number, required: true },
  freeReward: { type: Schema.Types.Mixed },
  premiumReward: { type: Schema.Types.Mixed }
}, { _id: false });

const seasonSchema = new Schema<ISeason>(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    description: { type: String, required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    maxLevel: { type: Number, default: 50 },
    xpPerLevel: { type: Number, default: 100 },
    rewards: [seasonRewardSchema],
    premiumPrice: { type: Number, default: 999 },
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Season = mongoose.model<ISeason>("Season", seasonSchema);
