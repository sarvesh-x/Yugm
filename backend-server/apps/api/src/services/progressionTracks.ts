import type { ClientSession } from "mongoose";
import { User } from "../models/User.js";

const MILESTONES = [0, 500, 1_000, 1_800, 3_000, 5_000, 8_000, 12_000, 18_000, 26_000, 36_000] as const;

function requiredExpForLevel(level: number) {
  if (level < MILESTONES.length) return MILESTONES[level];
  return Math.ceil(MILESTONES[MILESTONES.length - 1] * (1.35 ** (level - (MILESTONES.length - 1))));
}

export function getProgressionTrack(expValue: unknown) {
  const exp = Math.max(0, Math.floor(Number(expValue) || 0));
  let level = 0;
  while (level < 1_000 && exp >= requiredExpForLevel(level + 1)) level += 1;
  const currentLevelExp = requiredExpForLevel(level);
  const nextLevelExp = requiredExpForLevel(level + 1);
  const requiredExp = Math.max(1, nextLevelExp - currentLevelExp);
  return {
    level,
    exp,
    currentLevelExp,
    nextLevel: level + 1,
    nextLevelExp,
    requiredExp,
    progress: Math.max(0, Math.min(1, (exp - currentLevelExp) / requiredExp))
  };
}

export async function addWealthExp(userId: string, amount: number, session?: ClientSession) {
  if (!Number.isInteger(amount) || amount <= 0) return;
  await User.updateOne({ _id: userId }, { $inc: { wealthExp: amount } }, session ? { session } : undefined);
}

export async function addCharmExp(userId: string, amount: number, session?: ClientSession) {
  if (!Number.isInteger(amount) || amount <= 0) return;
  await User.updateOne({ _id: userId }, { $inc: { charmExp: amount } }, session ? { session } : undefined);
}
