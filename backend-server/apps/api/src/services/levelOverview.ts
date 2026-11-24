import { getLevelMilestone, levelMilestones, streakCoinBonuses, streakCosmeticRewards, xpDailyCaps, xpEventDisplay,
  xpEvents, type XpEvent } from "@yugm/shared";
import type { getLevelStatus } from "./levelPresentation.js";
import { getProgressionTrack } from "./progressionPresentation.js";

const displayedEvents: XpEvent[] = ["DAILY_CHECKIN", "PROFILE_COMPLETE", "ROOM_CREATE", "ROOM_JOIN", "CHAT_MESSAGE",
  "GIFT_SENT", "GIFT_RECEIVED", "VIP_PURCHASE", "COSMETIC_PURCHASE", "FOLLOW_USER", "MINI_GAME_PLAY"];
const streakMilestones = Object.keys(streakCoinBonuses).map(Number).sort((a, b) => a - b);

export function nextStreakMilestone(streak: number) {
  return streakMilestones.find(milestone => milestone > streak) ?? null;
}

export function presentLevelOverview(
  level: ReturnType<typeof getLevelStatus>, streak: number, wealthExp: number, charmExp: number,
  capRows: Array<{ event: string; amount: number }>, leaderboardRank: number, leaderboard: unknown[]
) {
  const earned = new Map(capRows.map(({ event, amount }) => [event, amount]));
  const nextMilestone = nextStreakMilestone(streak);
  return {
    schemaVersion: 1, level, wealthLevel: getProgressionTrack(wealthExp), charmLevel: getProgressionTrack(charmExp),
    streak: {
      count: streak, canCheckIn: level.canDailyCheckIn, nextMilestone,
      nextMilestoneReward: nextMilestone ? streakCoinBonuses[nextMilestone] : 0,
      milestones: streakMilestones.map(streakDays => ({
        streakDays, rewardCoins: streakCoinBonuses[streakDays], cosmeticId: streakCosmeticRewards[streakDays] ?? "",
        reached: streak >= streakDays
      })),
      streakBonuses: streakCoinBonuses
    },
    leaderboardRank,
    milestones: level.level <= levelMilestones.length ? levelMilestones
      : Array.from({ length: 31 }, (_, index) => getLevelMilestone(Math.max(1, level.level - 10) + index)),
    xpEvents: Object.fromEntries(displayedEvents.map(event => [event, {
      ...xpEventDisplay[event], xp: xpEvents[event], cap: xpDailyCaps[event] ?? null, earnedToday: earned.get(event) ?? 0
    }])),
    todayXpEarned: capRows.reduce((total, row) => total + row.amount, 0),
    todayXpCap: Object.values(xpDailyCaps).reduce((total, cap) => total + (cap ?? 0), 0), leaderboard
  };
}
