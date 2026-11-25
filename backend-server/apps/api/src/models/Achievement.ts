import mongoose, { Schema } from "mongoose";

import { badgeTiers, badgeMetrics, badgeIcons, type AchievementTier } from "../modules/admin/badgeDefinition.js";
export { badgeTiers, badgeMetrics, badgeIcons, honorMetrics, type AchievementTier } from "../modules/admin/badgeDefinition.js";

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
  imageUrl?: string;
  imageData?: Buffer;
  imageMime?: string;
  /** Published AssetObject id. Legacy imageData/imageUrl remain untouched until an approved cutover. */
  assetRef?: string;
  kind?: "ACHIEVEMENT" | "HONOR";
  metric?: typeof badgeMetrics[number];
  weeklyTarget?: number;
  hidden: boolean;
  tiers: IAchievementTier[];
  order: number;
}

const tierSchema = new Schema<IAchievementTier>({
  tier: { type: String, enum: badgeTiers, required: true },
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
  imageUrl: String,
  imageData: { type: Buffer, select: false },
  imageMime: String,
  assetRef: { type: String },
  kind: { type: String, enum: ["ACHIEVEMENT", "HONOR"], default: "ACHIEVEMENT" },
  metric: { type: String, enum: badgeMetrics },
  weeklyTarget: Number,
  hidden: { type: Boolean, default: false },
  tiers: { type: [tierSchema], required: true },
  order: { type: Number, default: 0 }
}, { timestamps: true });

export const Achievement = mongoose.model<IAchievement>("Achievement", achievementSchema);

export const ACHIEVEMENT_TIER_ORDER: Record<AchievementTier, number> = {
  BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3, DIAMOND: 4, MASTER: 5
};

export function nextTier(current: AchievementTier | null): AchievementTier | null {
  if (!current) return "BRONZE";
  const order = ACHIEVEMENT_TIER_ORDER[current];
  return badgeTiers[order + 1] ?? null;
}

export function tierIndex(tier: AchievementTier): number {
  return ACHIEVEMENT_TIER_ORDER[tier];
}
