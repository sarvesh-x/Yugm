import mongoose from "mongoose";
import type { FlattenMaps } from "mongoose";
import { BattlePass, type IBattlePass } from "../models/BattlePass.js";
import { Season, type ISeason } from "../models/Season.js";
import { debitWallet } from "./wallet.js";

export async function getBattlePass(userId: string) {
  const season = await Season.findOne({ active: true }).lean();
  if (!season) return null;

  let bp = await BattlePass.findOne({ userId, "season.id": season._id }).lean();
  if (!bp) {
    const doc = await BattlePass.create({
      season: { id: season._id, name: season.name },
      userId: new mongoose.Types.ObjectId(userId),
      tier: "free",
      level: 1,
      xp: 0,
      rewards: season.rewards.map((r) => ({ level: r.level, claimed: false })),
      premium: false,
      expiresAt: season.endDate
    });
    bp = JSON.parse(JSON.stringify(doc));
  }

  return { battlePass: bp, season };
}

export async function purchaseBattlePass(userId: string) {
  const season = await Season.findOne({ active: true }).lean();
  if (!season) throw new Error("No active season");

  const existing = await BattlePass.findOne({ userId, "season.id": season._id }).lean();
  if (existing?.premium) throw new Error("Battle pass already purchased");

  await debitWallet(userId, season.premiumPrice, "BATTLE_PASS_PURCHASE", { seasonId: season._id.toString() });

  await BattlePass.findOneAndUpdate(
    { userId, "season.id": season._id },
    { $set: { premium: true, tier: "premium" } },
    { upsert: true }
  );

  const updated = await BattlePass.findOne({ userId, "season.id": season._id }).lean();
  return { battlePass: updated, season };
}

export async function levelUpBattlePass(userId: string, xpGained: number) {
  const season = await Season.findOne({ active: true }).lean();
  if (!season) throw new Error("No active season");

  let bp = await BattlePass.findOne({ userId, "season.id": season._id }).lean();
  if (!bp) {
    const doc = await BattlePass.create({
      season: { id: season._id, name: season.name },
      userId: new mongoose.Types.ObjectId(userId),
      tier: "free",
      level: 1,
      xp: 0,
      rewards: season.rewards.map((r) => ({ level: r.level, claimed: false })),
      premium: false,
      expiresAt: season.endDate
    });
    bp = JSON.parse(JSON.stringify(doc));
  }

  const newXp = (bp!.xp ?? 0) + xpGained;
  const levelsToAdd = Math.floor(newXp / season.xpPerLevel);
  const newLevel = Math.min((bp!.level ?? 1) + levelsToAdd, season.maxLevel);
  const remainingXp = newXp % season.xpPerLevel;

  const updated = await BattlePass.findOneAndUpdate(
    { userId, "season.id": season._id },
    { $set: { level: newLevel, xp: remainingXp } },
    { new: true }
  ).lean();

  const newRewards = season.rewards.filter((r) => r.level <= newLevel && r.level > (bp?.level ?? 0));

  return { battlePass: updated, season, newRewards };
}
