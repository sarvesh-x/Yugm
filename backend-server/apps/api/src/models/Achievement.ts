import mongoose, { Schema } from "mongoose";

export type AchievementTier = "BRONZE" | "SILVER" | "GOLD" | "PLATINUM";

export interface IAchievementTier {
  tier: AchievementTier;
  target: number;
  rewardCoins: number;
  rewardCosmetic?: string;
}

export interface IAchievement extends mongoose.Document {
  id: string;
  title: string;
  description: string;
  category: "SOCIAL" | "CONTENT" | "ENGAGEMENT" | "LOYALTY" | "MISC";
  icon: string;
  hidden: boolean;
  tiers: IAchievementTier[];
  order: number;
}

const tierSchema = new Schema<IAchievementTier>({
  tier: { type: String, enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"], required: true },
  target: { type: Number, required: true },
  rewardCoins: { type: Number, default: 0 },
  rewardCosmetic: String
}, { _id: false });

const achievementSchema = new Schema<IAchievement>({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  description: { type: String, required: true },
  category: { type: String, enum: ["SOCIAL", "CONTENT", "ENGAGEMENT", "LOYALTY", "MISC"], default: "MISC" },
  icon: { type: String, default: "trophy" },
  hidden: { type: Boolean, default: false },
  tiers: { type: [tierSchema], required: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

export const Achievement = mongoose.model<IAchievement>("Achievement", achievementSchema);

export const ACHIEVEMENT_TIER_ORDER: Record<AchievementTier, number> = {
  BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3
};

export function nextTier(current: AchievementTier | null): AchievementTier | null {
  if (!current) return "BRONZE";
  const order = ACHIEVEMENT_TIER_ORDER[current];
  const tiers: AchievementTier[] = ["BRONZE", "SILVER", "GOLD", "PLATINUM"];
  return order < tiers.length - 1 ? tiers[order + 1] : null;
}

export function tierIndex(tier: AchievementTier): number {
  return ACHIEVEMENT_TIER_ORDER[tier];
}
