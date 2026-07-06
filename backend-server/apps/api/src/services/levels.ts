import type { XpEvent } from "@yugm/shared";
import { levelMilestones, xpEvents } from "@yugm/shared";
import { User } from "../models/User.js";
import { creditWallet } from "./wallet.js";

type LevelUser = {
  _id?: unknown;
  id?: string;
  xp?: number;
  level?: number;
  levelTitle?: string;
  lastDailyCheckInAt?: Date | string;
};

type LevelMilestone = (typeof levelMilestones)[number];

const firstMilestone: LevelMilestone = levelMilestones[0];

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isSameUtcDay(a?: Date | string, b = new Date()) {
  if (!a) return false;
  const date = new Date(a);
  return startOfUtcDay(date).getTime() === startOfUtcDay(b).getTime();
}

export function calculateLevel(xp = 0) {
  let current: LevelMilestone = firstMilestone;
  for (const milestone of levelMilestones) {
    if (xp >= milestone.requiredXp) current = milestone;
  }
  return current;
}

export function getLevelStatus(user?: LevelUser | null) {
  const xp = Math.max(0, Number(user?.xp ?? 0));
  const current = calculateLevel(xp);
  const next = levelMilestones.find((milestone) => milestone.level > current.level);
  const currentRequiredXp = current.requiredXp;
  const nextRequiredXp = next?.requiredXp ?? current.requiredXp;
  const requiredXp = Math.max(0, nextRequiredXp - currentRequiredXp);
  const progressXp = Math.max(0, xp - currentRequiredXp);

  return {
    xp,
    level: Math.max(Number(user?.level ?? current.level), current.level),
    title: current.title,
    currentLevelXp: currentRequiredXp,
    nextLevel: next?.level,
    nextLevelXp: next?.requiredXp,
    progressXp,
    requiredXp,
    progress: requiredXp > 0 ? Math.min(1, progressXp / requiredXp) : 1,
    canDailyCheckIn: !isSameUtcDay(user?.lastDailyCheckInAt),
    dailyCheckInXp: xpEvents.DAILY_CHECKIN
  };
}

export async function grantXp(userId: string, event: XpEvent, metadata: Record<string, unknown> = {}) {
  const xpAwarded = xpEvents[event];
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { xp: xpAwarded } },
    { new: true }
  ).select("xp level levelTitle lastDailyCheckInAt").lean();
  if (!updated) return undefined;

  const status = getLevelStatus(updated);
  const promoted = await User.findOneAndUpdate(
    {
      _id: userId,
      $or: [
        { level: { $lt: status.level } },
        { level: { $exists: false } }
      ]
    },
    { $set: { level: status.level, levelTitle: status.title } },
    { new: false }
  ).select("level").lean();

  let levelUpReward = 0;
  let levelsGained: number[] = [];
  if (promoted) {
    const previousLevel = Number(promoted.level ?? 1);
    const rewards = levelMilestones.filter((milestone) => milestone.level > previousLevel && milestone.level <= status.level);
    levelUpReward = rewards.reduce((sum, milestone) => sum + milestone.coinReward, 0);
    levelsGained = rewards.map((milestone) => milestone.level);
    if (levelUpReward > 0) {
      await creditWallet(userId, levelUpReward, "LEVEL_REWARD", { event, levels: levelsGained, ...metadata });
    }
  }

  const fresh = await User.findById(userId).select("xp level levelTitle lastDailyCheckInAt walletBalance").lean();
  return {
    xpAwarded,
    levelUpReward,
    levelsGained,
    level: getLevelStatus(fresh ?? updated),
    walletBalance: fresh?.walletBalance
  };
}

export function dailyCheckInStart() {
  return startOfUtcDay();
}
