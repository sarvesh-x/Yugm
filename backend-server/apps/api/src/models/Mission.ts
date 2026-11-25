import mongoose, { Schema } from "mongoose";

export interface IMission extends mongoose.Document {
  key: string;
  type: "daily" | "weekly" | "monthly" | "seasonal";
  title: string;
  description: string;
  requirements: {
    action: string;
    target: number;
    unit: string;
  };
  rewards: {
    xp: number;
    coins: number;
    diamonds: number;
    cosmeticId?: string;
    titleId?: string;
  };
  badge?: { icon: string; color: string };
  seasonId?: mongoose.Types.ObjectId;
  startDate?: Date;
  endDate?: Date;
  active: boolean;
}

const missionSchema = new Schema<IMission>(
  {
    key: { type: String, required: true, unique: true },
    type: { type: String, enum: ["daily", "weekly", "monthly", "seasonal"], required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    requirements: {
      action: { type: String, required: true },
      target: { type: Number, required: true },
      unit: { type: String, default: "count" }
    },
    rewards: {
      xp: { type: Number, default: 0 },
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 },
      cosmeticId: String,
      titleId: String
    },
    badge: { icon: String, color: String },
    seasonId: { type: Schema.Types.ObjectId, ref: "Season" },
    startDate: Date,
    endDate: Date,
    active: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Mission = mongoose.model<IMission>("Mission", missionSchema);

export { missionSeeds } from "../data/missionSeeds.js";
