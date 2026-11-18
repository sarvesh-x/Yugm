import { env } from "../config/env.js";
import { Gift } from "../models/Gift.js";
import { Cosmetic } from "../models/Cosmetic.js";

export const dayMs = 86_400_000;
export const anniversaryLeadMs = 7 * dayMs;

export function nextAnniversary(activatedAt: Date, after: Date) {
  for (let year = Math.max(activatedAt.getUTCFullYear() + 1, after.getUTCFullYear()); ; year++) {
    const next = new Date(activatedAt.getTime());
    const month = activatedAt.getUTCMonth();
    const lastDay = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    next.setUTCFullYear(year, month, Math.min(activatedAt.getUTCDate(), lastDay));
    if (next > after) return next;
  }
}
export const bondKinds = {
  BESTIE: { name: "Bestie", description: "A close friendship you both choose.", icon: "🤝" },
  SOULMATE: { name: "Soulmate", description: "A special connection you define together.", icon: "💞" }
} as const;
export type BondKind = keyof typeof bondKinds;
export const milestones = [1, 7, 30, 100, 180, 365] as const;
export const bondDefaults = {
  visibility: "PRIVATE" as const, showDuration: true, showLevel: true, showBadge: true, leaderboard: false,
  showRanking: true, reminders: true, announcements: false
};
export const bondLevels = [
  { threshold: 0, name: "New Bond" },
  { threshold: 100, name: "Growing Bond" },
  { threshold: 500, name: "Trusted Duo" },
  { threshold: 1500, name: "Strong Connection" },
  { threshold: 5000, name: "Unbreakable Bond" },
  { threshold: 15000, name: "Golden Bond" },
  { threshold: 50000, name: "Eternal Bond" }
] as const;
export const bondConfig = {
  get capacity() { return env.YUGM_BOND_SLOTS; },
  invitationHours: 24,
  freeInvitations: true,
  pairCooldownMs: 6 * 60 * 60 * 1000,
  dailyRequestLimit: 8,
  dailyCheckInPoints: 10,
  dailyGiftPoints: 300,
  milestonePoints: 25
};
export const bondRewardItems = { milestone: "bond_memory_badge", weekly: "bond_weekly_frame" } as const;

export function bondLevel(points: number) {
  const total = Number.isFinite(points) ? Math.max(0, points) : 0;
  const index = bondLevels.findIndex((entry) => total < entry.threshold);
  const level = index < 0 ? bondLevels.length : index;
  const current = bondLevels[level - 1];
  const next = bondLevels[level];
  return { level, levelName: current.name, levelStart: current.threshold, nextThreshold: next?.threshold ?? null };
}

export function weeklyPeriod(now: Date) {
  const start = new Date(now);
  start.setUTCHours(0, 0, 0, 0);
  start.setUTCDate(start.getUTCDate() - ((start.getUTCDay() + 6) % 7));
  return { id: start.toISOString().slice(0, 10), start, end: new Date(start.getTime() + 7 * dayMs) };
}

export const rankingWindows = ["WEEK", "MONTH", "SEASON"] as const;
export type RankingWindow = typeof rankingWindows[number];

export function rankingPeriod(now: Date, window: RankingWindow) {
  if (window === "WEEK") return weeklyPeriod(now);
  const months = window === "MONTH" ? 1 : 3;
  const month = Math.floor(now.getUTCMonth() / months) * months;
  const year = now.getUTCFullYear();
  const start = new Date(Date.UTC(year, month, 1));
  const end = new Date(Date.UTC(year, month + months, 1));
  return { id: `${window}:${start.toISOString().slice(0, 10)}`, start, end };
}

const giftSeeds = [
  { name: "Friendship Bracelet", icon: "🎀", coinPrice: 25, bondPurpose: "INVITATION", bondKind: "BESTIE", bondPoints: 15 },
  { name: "Moonlit Rose", icon: "🌹", coinPrice: 40, bondPurpose: "INVITATION", bondKind: "SOULMATE", bondPoints: 20 },
  { name: "Memory Lantern", icon: "🏮", coinPrice: 30, bondPurpose: "PROGRESSION", bondPoints: 20 },
  { name: "Silver Anniversary", icon: "🎊", coinPrice: 50, bondPurpose: "ANNIVERSARY", bondPoints: 25, bondMinimumDays: 30 },
  { name: "Garden Keepsake", icon: "🌿", coinPrice: 60, bondPurpose: "COSMETIC", bondPoints: 25, bondCosmeticId: bondRewardItems.milestone }
] as const;

let seedPromise: Promise<void> | undefined;
export function ensureBondCatalog() {
  seedPromise ??= (async () => {
    await Gift.bulkWrite(giftSeeds.map(gift => ({
      updateOne: { filter: { name: gift.name }, update: { $setOnInsert: { ...gift, category: "bonds" as const, isActive: true } }, upsert: true }
    })), { ordered: false });
    await Cosmetic.bulkWrite([
      { _id: bondRewardItems.milestone, name: "Shared Memories", type: "PROFILE_BADGE", preview: "✦", rarity: "RARE" },
      { _id: bondRewardItems.weekly, name: "Bonds Champion", type: "AVATAR_FRAME", preview: "✧", rarity: "EPIC" }
    ].map(item => ({
      updateOne: { filter: { _id: item._id }, update: { $setOnInsert: { ...item, coinPrice: 0, isActive: true, rewardOnly: true } }, upsert: true }
    })), { ordered: false });
  })().catch(error => { seedPromise = undefined; throw error; });
  return seedPromise;
}

