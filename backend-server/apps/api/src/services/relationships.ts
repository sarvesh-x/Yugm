import type { RelationshipXpEvent } from "@yugm/shared";
import { relationshipLevelMilestones, relationshipXpEvents } from "@yugm/shared";
import { Relationship } from "../models/Relationship.js";

type RelationshipLike = {
  xp?: number;
  level?: number;
  levelTitle?: string;
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
    lastInteractionAt: relationship?.lastInteractionAt
  };
}

export async function findRelationship(userA: string, userB: string) {
  const relationship = await Relationship.findOne({ pairKey: relationshipPairKey(userA, userB) }).lean();
  return relationship ? getRelationshipStatus(relationship) : undefined;
}

export async function grantRelationshipXp(userA: string, userB: string, event: RelationshipXpEvent, metadata: Record<string, unknown> = {}) {
  if (!userA || !userB || userA === userB) return undefined;
  const xpAwarded = relationshipXpEvents[event];
  const pairKey = relationshipPairKey(userA, userB);
  const relationship = await Relationship.findOneAndUpdate(
    { pairKey },
    {
      $setOnInsert: { users: pairKey.split(":") },
      $inc: { xp: xpAwarded },
      $set: { lastInteractionAt: new Date() }
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
  return {
    xpAwarded,
    relationship: getRelationshipStatus(fresh ?? relationship),
    levelsGained: promoted ? [status.level].filter((level) => level > Number(promoted.level ?? 1)) : [],
    metadata
  };
}
