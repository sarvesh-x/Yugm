import { relationshipLevelMilestones } from "@yugm/shared";
import { startOfUtcDay } from "./dailyWalletReward.js";

export const dailyRelationshipMessageXpCap = 120;
export const dailyRelationshipRoomDmXpCap = 80;
export const dailyRelationshipGiftXpCap = 300;

export function relationshipStreak(lastStreakAt: Date | string | null | undefined, currentStreak: number, now = new Date()) {
  const today = startOfUtcDay(now);
  if (!lastStreakAt) return { streakDays: 1, lastStreakAt: today };
  const previous = startOfUtcDay(new Date(lastStreakAt));
  const days = Math.round((today.getTime() - previous.getTime()) / 86_400_000);
  if (days === 0) return { streakDays: currentStreak, lastStreakAt };
  return { streakDays: days === 1 ? currentStreak + 1 : 1, lastStreakAt: today };
}

type RelationshipLike = {
  xp?: number;
  level?: number;
  levelTitle?: string;
  streakDays?: number;
  lastStreakAt?: Date | string | null;
  lastInteractionAt?: Date | string | null;
};

type RelationshipMilestone = (typeof relationshipLevelMilestones)[number];

const firstMilestone: RelationshipMilestone = relationshipLevelMilestones[0];

export function relationshipPairKey(userA: string, userB: string) {
  return [userA, userB].map(String).sort().join(":");
}

export function calculateRelationshipLevel(xp = 0) {
  let current: RelationshipMilestone = firstMilestone;
  for (const milestone of relationshipLevelMilestones) {
    if (xp >= milestone.requiredXp) current = milestone;
  }
  return current;
}

export function getRelationshipStatus(relationship?: RelationshipLike | null) {
  const xp = Math.max(0, Number(relationship?.xp ?? 0));
  const current = calculateRelationshipLevel(xp);
  const next = relationshipLevelMilestones.find((milestone) => milestone.level > current.level);
  const currentLevelXp = current.requiredXp;
  const nextLevelXp = next?.requiredXp ?? current.requiredXp;
  const requiredXp = Math.max(0, nextLevelXp - currentLevelXp);
  const progressXp = Math.max(0, xp - currentLevelXp);

  return {
    xp,
    level: Math.max(Number(relationship?.level ?? current.level), current.level),
    title: current.title,
    currentLevelXp,
    nextLevel: next?.level,
    nextLevelXp: next?.requiredXp,
    progressXp,
    requiredXp,
    progress: requiredXp > 0 ? Math.min(1, progressXp / requiredXp) : 1,
    perks: relationshipLevelMilestones.filter((milestone) => milestone.level <= current.level).map((milestone) => milestone.perk),
    nextPerk: next?.perk,
    streakDays: relationship?.streakDays ?? 0,
    lastInteractionAt: relationship?.lastInteractionAt
  };
}
