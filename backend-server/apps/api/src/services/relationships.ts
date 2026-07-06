import type { RelationshipXpEvent } from "@yugm/shared";
import { relationshipLevelMilestones, relationshipXpEvents } from "@yugm/shared";
import { Relationship } from "../models/Relationship.js";
import { createNotification } from "./notifications.js";

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
const dailyRelationshipCaps: Partial<Record<RelationshipXpEvent, number>> = {
  MESSAGE_SENT: 120,
  ROOM_DM_SENT: 80,
  GIFT_SENT: 300
};
const relationshipDailyAwards = new Map<string, { amount: number; resetAt: number }>();

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function streakUpdate(lastStreakAt?: Date | string | null, currentStreak = 0) {
  const today = startOfUtcDay();
  if (!lastStreakAt) return { streakDays: 1, lastStreakAt: today };
  const previous = startOfUtcDay(new Date(lastStreakAt));
  const diffDays = Math.round((today.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
  if (diffDays === 0) return { streakDays: currentStreak, lastStreakAt };
  if (diffDays === 1) return { streakDays: currentStreak + 1, lastStreakAt: today };
  return { streakDays: 1, lastStreakAt: today };
}

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

export async function findRelationship(userA: string, userB: string) {
  const relationship = await Relationship.findOne({ pairKey: relationshipPairKey(userA, userB) }).lean();
  return relationship ? getRelationshipStatus(relationship) : undefined;
}

export async function ensureRelationshipForMatch(userA: string, userB: string, matchId?: string) {
  const pairKey = relationshipPairKey(userA, userB);
  const relationship = await Relationship.findOneAndUpdate(
    { pairKey },
    {
      $setOnInsert: {
        users: pairKey.split(":"),
        xp: relationshipXpEvents.MATCH_CREATED,
        level: 2,
        levelTitle: calculateRelationshipLevel(relationshipXpEvents.MATCH_CREATED).title,
        lastInteractionAt: new Date(),
        streakDays: 1,
        lastStreakAt: startOfUtcDay()
      }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();
  return {
    relationship: getRelationshipStatus(relationship),
    metadata: matchId ? { matchId } : undefined
  };
}

export async function grantRelationshipXp(userA: string, userB: string, event: RelationshipXpEvent, metadata: Record<string, unknown> = {}) {
  if (!userA || !userB || userA === userB) return undefined;
  let xpAwarded: number = relationshipXpEvents[event];
  const pairKey = relationshipPairKey(userA, userB);
  const cap = dailyRelationshipCaps[event];
  if (cap !== undefined) {
    const now = Date.now();
    const resetAt = startOfUtcDay(new Date(now + 24 * 60 * 60 * 1000)).getTime();
    const capKey = `${pairKey}:${event}`;
    const entry = relationshipDailyAwards.get(capKey);
    const current = entry && entry.resetAt > now ? entry.amount : 0;
    const allowed = Math.max(0, cap - current);
    if (allowed <= 0) {
      const currentRelationship = await Relationship.findOne({ pairKey }).lean();
      return {
        xpAwarded: 0,
        capped: true,
        relationship: getRelationshipStatus(currentRelationship),
        levelsGained: [],
        metadata
      };
    }
    xpAwarded = Math.min(xpAwarded, allowed);
    relationshipDailyAwards.set(capKey, { amount: current + xpAwarded, resetAt });
  }

  const existing = await Relationship.findOne({ pairKey }).select("streakDays lastStreakAt").lean();
  const streak = streakUpdate(existing?.lastStreakAt, existing?.streakDays ?? 0);
  const relationship = await Relationship.findOneAndUpdate(
    { pairKey },
    {
      $setOnInsert: { users: pairKey.split(":") },
      $inc: { xp: xpAwarded },
      $set: { lastInteractionAt: new Date(), streakDays: streak.streakDays, lastStreakAt: streak.lastStreakAt }
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

  const status = getRelationshipStatus(relationship);
  const promoted = await Relationship.findOneAndUpdate(
    {
      pairKey,
      $or: [
        { level: { $lt: status.level } },
        { level: { $exists: false } }
      ]
    },
    { $set: { level: status.level, levelTitle: status.title } },
    { new: false }
  ).select("level").lean();

  const fresh = await Relationship.findOne({ pairKey }).lean();
  if (promoted) {
    await Promise.all([userA, userB].map((userId) =>
      createNotification(userId, "SYSTEM", "Relationship level up!", `Your bond reached Level ${status.level}: ${status.title}.`, { type: "RELATIONSHIP_LEVEL_UP", partnerIds: [userA, userB], level: status.level })
    ));
  }
  if (streak.streakDays > 1 && streak.streakDays % 7 === 0) {
    await Promise.all([userA, userB].map((userId) =>
      createNotification(userId, "SYSTEM", "Duo streak!", `You have a ${streak.streakDays}-day relationship streak.`, { type: "RELATIONSHIP_STREAK", partnerIds: [userA, userB], streakDays: streak.streakDays })
    ));
  }
  return {
    xpAwarded,
    relationship: getRelationshipStatus(fresh ?? relationship),
    levelsGained: promoted ? [status.level].filter((level) => level > Number(promoted.level ?? 1)) : [],
    metadata
  };
}
