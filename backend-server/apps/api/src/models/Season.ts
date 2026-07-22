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

export const defaultSeason = {
  key: "season_1",
  name: "Voyage V1",
  description: "The inaugural Yugm season pass. Complete missions, earn XP, and unlock exclusive rewards.",
  startDate: new Date("2025-01-01"),
  endDate: new Date("2025-03-31"),
  maxLevel: 50,
  xpPerLevel: 100,
  rewards: Array.from({ length: 50 }, (_, i) => {
    const level = i + 1;
    const free: Record<number, unknown> = {
      1: { type: "coins", amount: 100 },
      5: { type: "cosmetic", id: "frame_minimal" },
      10: { type: "xp", amount: 500 },
      15: { type: "cosmetic", id: "mood_chill" },
      20: { type: "coins", amount: 500 },
      25: { type: "cosmetic", id: "bubble_rounded" },
      30: { type: "xp", amount: 1000 },
      35: { type: "cosmetic", id: "theme_cozy" },
      40: { type: "coins", amount: 1000 },
      45: { type: "cosmetic", id: "name_gold_shimmer" },
      50: { type: "title", id: "title_vibe_curator" }
    };
    const premium: Record<number, unknown> = {
      1: { type: "diamonds", amount: 50 },
      5: { type: "cosmetic", id: "frame_gold" },
      10: { type: "diamonds", amount: 100 },
      15: { type: "cosmetic", id: "theme_saffron" },
      20: { type: "diamonds", amount: 200 },
      25: { type: "cosmetic", id: "name_neon_glow" },
      30: { type: "diamonds", amount: 300 },
      35: { type: "cosmetic", id: "entrance_spark" },
      40: { type: "diamonds", amount: 500 },
      45: { type: "cosmetic", id: "theme_aurora" },
      50: { type: "cosmetic", id: "avatar_cosmic_gif" }
    };
    return {
      level,
      freeReward: free[level] ?? null,
      premiumReward: premium[level] ?? null
    };
  }),
  premiumPrice: 999,
  active: true
};
