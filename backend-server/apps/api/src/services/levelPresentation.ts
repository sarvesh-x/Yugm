import { getLevelMilestone, getLevelMilestoneForXp, xpEvents } from "@yugm/shared";
import { startOfUtcDay } from "./dailyWalletReward.js";

type LevelUser = {
  _id?: unknown;
  id?: string;
  xp?: number;
  level?: number;
  levelTitle?: string;
  lastDailyCheckInAt?: Date | string;
};

function isSameUtcDay(a?: Date | string, b = new Date()) {
  if (!a) return false;
  const date = new Date(a);
  return startOfUtcDay(date).getTime() === startOfUtcDay(b).getTime();
}

export function calculateLevel(xp = 0) {
  return getLevelMilestoneForXp(xp);
}

export function getLevelStatus(user?: LevelUser | null) {
  const xp = Math.max(0, Number(user?.xp ?? 0));
  const current = calculateLevel(xp);
  const next = getLevelMilestone(current.level + 1);
  const currentRequiredXp = current.requiredXp;
  const nextRequiredXp = next.requiredXp;
  const requiredXp = Math.max(0, nextRequiredXp - currentRequiredXp);
  const progressXp = Math.max(0, xp - currentRequiredXp);

  return {
    xp,
    level: current.level,
    title: current.title,
    currentLevelXp: currentRequiredXp,
    nextLevel: next.level,
    nextLevelXp: next.requiredXp,
    progressXp,
    requiredXp,
    progress: requiredXp > 0 ? Math.min(1, progressXp / requiredXp) : 1,
    canDailyCheckIn: !isSameUtcDay(user?.lastDailyCheckInAt),
    dailyCheckInXp: xpEvents.DAILY_CHECKIN
  };
}

export function getLevelPromotion(previousLevel: number, nextLevel: number) {
  const rewards = Array.from(
    { length: Math.max(0, nextLevel - previousLevel) },
    (_, index) => getLevelMilestone(previousLevel + index + 1)
  );
  return {
    levelUpReward: rewards.reduce((sum, milestone) => sum + milestone.coinReward, 0),
    levelsGained: rewards.map(milestone => milestone.level)
  };
}
