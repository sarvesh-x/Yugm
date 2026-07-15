import type { XpEvent } from "@yugm/shared";
import { levelMilestones, xpEvents } from "@yugm/shared";
import { User } from "../models/User.js";
import { createNotification } from "./notifications.js";
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
const dailyXpCaps: Partial<Record<XpEvent, number>> = {
  ROOM_CREATE: 200,
  ROOM_JOIN: 50,
  CHAT_MESSAGE: 100,
  GIFT_SENT: 300,
  GIFT_RECEIVED: 300,
  FOLLOW_USER: 50,
  COSMETIC_PURCHASE: 300,
  MINI_GAME_PLAY: 80,
  VIP_PURCHASE: 200
};
const dailyXpAwards = new Map<string, { amount: number; resetAt: number }>();

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
  let xpAwarded: number = xpEvents[event];
  const cap = dailyXpCaps[event];
  if (cap !== undefined) {
    const key = `${userId}:${event}`;
    const now = Date.now();
    const resetAt = startOfUtcDay(new Date(now + 24 * 60 * 60 * 1000)).getTime();
    const entry = dailyXpAwards.get(key);
    const current = entry && entry.resetAt > now ? entry.amount : 0;
    const allowed = Math.max(0, cap - current);
    if (allowed <= 0) {
      const user = await User.findById(userId).select("xp level levelTitle lastDailyCheckInAt walletBalance").lean();
      return {
        xpAwarded: 0,
        capped: true,
        levelUpReward: 0,
        levelsGained: [],
        level: getLevelStatus(user),
        walletBalance: user?.walletBalance
      };
    }
    xpAwarded = Math.min(xpAwarded, allowed);
    dailyXpAwards.set(key, { amount: current + xpAwarded, resetAt });
  }
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
    await createNotification(userId, "SYSTEM", "Level up!", `You reached Level ${status.level}: ${status.title}.`, { type: "LEVEL_UP", level: status.level, reward: levelUpReward });
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

export function dailyCheckInStart(date?: Date) {
  return startOfUtcDay(date);
}
