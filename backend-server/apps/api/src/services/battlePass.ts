import mongoose from "mongoose";
import { BattlePass, type IBattlePass } from "../models/BattlePass.js";
import { BattlePassXpGrant } from "../models/BattlePassXpGrant.js";
import { Season, type ISeason, type ISeasonReward } from "../models/Season.js";
import { defaultSeason, monthlySeasonWindow } from "./seasonDefaults.js";
import { Cosmetic } from "../models/Cosmetic.js";
import { User } from "../models/User.js";
import { debitWallet, creditWallet } from "./wallet.js";
import { creditDiamonds } from "./diamonds.js";
import { ensureDefaultCosmetics } from "./cosmetics.js";
import { getLevelMilestoneForXp, getLevelMilestone } from "@yugm/shared";
import { HttpError, ErrorCode } from "../utils/http.js";

type SeasonForPass = Pick<ISeason, "name" | "rewards" | "endDate" | "xpPerLevel" | "maxLevel" | "premiumPrice"> & { _id: mongoose.Types.ObjectId };

export async function getActiveSeason() {
  const now = new Date();
  const active = await Season.findOne({ active: true, startDate: { $lte: now }, endDate: { $gt: now } })
    .sort({ startDate: -1 }).lean();
  if (active) return active;

  await Season.updateMany({ active: true }, { $set: { active: false } });
  const { key, name, startDate, endDate } = monthlySeasonWindow(now);
  try {
    return await Season.findOneAndUpdate(
      { key },
      {
        $set: { active: true, startDate, endDate, name },
        $setOnInsert: {
          description: defaultSeason.description,
          maxLevel: defaultSeason.maxLevel,
          xpPerLevel: defaultSeason.xpPerLevel,
          rewards: defaultSeason.rewards,
          premiumPrice: defaultSeason.premiumPrice
        }
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    ).lean();
  } catch (error) {
    if ((error as { code?: number })?.code !== 11000) throw error;
    const season = await Season.findOne({ key }).lean();
    if (!season) throw error;
    return season;
  }
}

async function ensureBattlePass(userId: string, season: SeasonForPass, session?: mongoose.ClientSession) {
  const query = BattlePass.findOneAndUpdate(
    { userId, "season.id": season._id },
    {
      $setOnInsert: {
        season: { id: season._id, name: season.name },
        userId: new mongoose.Types.ObjectId(userId),
        tier: "free",
        level: 1,
        xp: 0,
        rewards: season.rewards.map((reward) => ({ level: reward.level, claimed: false, freeClaimed: false, premiumClaimed: false })),
        premium: false,
        expiresAt: season.endDate
      }
    },
    { upsert: true, new: true, setDefaultsOnInsert: true, ...(session ? { session } : {}) }
  );
  try {
    return await query;
  } catch (error) {
    if ((error as { code?: number })?.code !== 11000) throw error;
    const existing = BattlePass.findOne({ userId, "season.id": season._id });
    if (session) existing.session(session);
    const battlePass = await existing;
    if (!battlePass) throw error;
    return battlePass;
  }
}

export async function getBattlePass(userId: string, includePreviousSummary = false) {
  const season = await getActiveSeason();
  const battlePass = await ensureBattlePass(userId, season);
  if (!includePreviousSummary) return { battlePass, season };

  const previousSeason = await Season.findOne({ active: false, endDate: { $lte: season.startDate } }).sort({ endDate: -1 }).lean();
  if (!previousSeason) return { battlePass, season };
  const previousPass = await BattlePass.findOne({ userId, "season.id": previousSeason._id }).lean();
  if (!previousPass) return { battlePass, season };
  const unclaimedRewards = previousSeason.rewards.reduce((count, reward) => {
    if (reward.level > previousPass.level) return count;
    const state = previousPass.rewards.find((item) => item.level === reward.level);
    const freeUnclaimed = Boolean(reward.freeReward) && state?.freeClaimed !== true && state?.claimed !== true;
    const premiumUnclaimed = previousPass.premium && Boolean(reward.premiumReward) && state?.premiumClaimed !== true;
    return count + Number(freeUnclaimed) + Number(premiumUnclaimed);
  }, 0);
  return {
    battlePass,
    season,
    previousSeasonSummary: {
      name: previousSeason.name,
      level: previousPass.level,
      maxLevel: previousSeason.maxLevel,
      premium: previousPass.premium,
      unclaimedRewards,
      endedAt: previousSeason.endDate
    }
  };
}

export async function purchaseBattlePass(userId: string) {
  const season = await getActiveSeason();
  const pass = await ensureBattlePass(userId, season);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const current = await BattlePass.findById(pass._id).session(session);
    if (!current) throw new HttpError(404, "Battle pass not found", ErrorCode.NOT_FOUND);
    if (current.premium) throw new HttpError(409, "Battle pass already purchased", ErrorCode.CONFLICT);
    await debitWallet(userId, season.premiumPrice, "BATTLE_PASS_PURCHASE", { seasonId: season._id.toString() }, session);
    const updated = await BattlePass.findOneAndUpdate(
      { _id: current._id, premium: false },
      { $set: { premium: true, tier: "premium" } },
      { new: true, session }
    );
    if (!updated) throw new HttpError(409, "Battle pass was purchased in another request", ErrorCode.CONFLICT);
    await session.commitTransaction();
    return { battlePass: updated, season };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}

export async function addBattlePassXp(userId: string, xpGained: number, actionKey?: string) {
  if (!Number.isInteger(xpGained) || xpGained <= 0) return;
  const { battlePass, season } = await getBattlePass(userId);
  if (battlePass.level >= season.maxLevel) return;

  if (actionKey) {
    const ledgerKey = { userId: new mongoose.Types.ObjectId(userId), seasonId: season._id, actionKey };
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        if (await BattlePassXpGrant.exists(ledgerKey).session(session)) return;
        await BattlePassXpGrant.create([{ ...ledgerKey, xpGained }], { session });
        const current = await BattlePass.findById(battlePass._id).session(session);
        if (!current || current.level >= season.maxLevel) return;
        const total = Math.max(0, current.xp) + xpGained;
        const levelsGained = Math.floor(total / season.xpPerLevel);
        const level = Math.min(season.maxLevel, current.level + levelsGained);
        current.level = level;
        current.xp = level >= season.maxLevel ? 0 : total - levelsGained * season.xpPerLevel;
        await current.save({ session });
      });
      return;
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      if (await BattlePassXpGrant.exists(ledgerKey)) return;
      throw error;
    } finally {
      await session.endSession();
    }
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const current = await BattlePass.findById(battlePass._id).select("level xp").lean();
    if (!current || current.level >= season.maxLevel) return;
    const total = Math.max(0, current.xp) + xpGained;
    const levelsGained = Math.floor(total / season.xpPerLevel);
    const level = Math.min(season.maxLevel, current.level + levelsGained);
    const xp = level >= season.maxLevel ? 0 : total - levelsGained * season.xpPerLevel;
    const updated = await BattlePass.findOneAndUpdate(
      { _id: current._id, level: current.level, xp: current.xp },
      { $set: { level, xp } },
      { new: true }
    );
    if (updated) return;
  }
  throw new Error("Battle pass XP could not be synchronized after concurrent updates");
}

export async function claimBattlePassReward(userId: string, level: number, track: "free" | "premium") {
  const { battlePass, season } = await getBattlePass(userId);
  if (level > battlePass.level) throw new HttpError(409, "Reach this level before claiming its reward", ErrorCode.CONFLICT);
  if (track === "premium" && !battlePass.premium) throw new HttpError(403, "Premium rewards require the premium pass", ErrorCode.FORBIDDEN);
  const seasonReward = season.rewards.find((item) => item.level === level);
  const reward = (track === "free" ? seasonReward?.freeReward : seasonReward?.premiumReward) as ISeasonReward["freeReward"] | ISeasonReward["premiumReward"];
  if (!seasonReward || !reward) throw new HttpError(404, "No reward is configured for this track", ErrorCode.NOT_FOUND);

  const field = track === "free" ? "freeClaimed" : "premiumClaimed";
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const updated = await BattlePass.findOneAndUpdate(
      {
        _id: battlePass._id,
        userId,
        level: { $gte: level },
        ...(track === "premium" ? { premium: true } : {}),
        rewards: { $elemMatch: { level, [field]: { $ne: true } } }
      },
      { $set: { [`rewards.$[reward].${field}`]: true } },
      { new: true, session, arrayFilters: [{ "reward.level": level }] }
    );
    if (!updated) throw new HttpError(409, "This reward has already been claimed", ErrorCode.CONFLICT);

    const metadata = { seasonId: season._id.toString(), level, track, rewardType: reward.type, rewardId: reward.id };
    if (reward.type === "coins" && (reward.amount ?? 0) > 0) {
      await creditWallet(userId, reward.amount!, "BATTLE_PASS_REWARD", metadata, session);
    } else if (reward.type === "diamonds" && (reward.amount ?? 0) > 0) {
      await creditDiamonds(userId, reward.amount!, "REWARD", metadata, { session, idempotencyKey: `bp:${season._id}:${userId}:${level}:${track}` });
    } else if (reward.type === "cosmetic" && reward.id) {
      await ensureDefaultCosmetics();
      if (!await Cosmetic.exists({ _id: reward.id }).session(session)) throw new HttpError(404, "Reward cosmetic is unavailable", ErrorCode.NOT_FOUND);
      await User.findByIdAndUpdate(userId, { $addToSet: { ownedCosmeticIds: reward.id } }, { session });
    } else if (reward.type === "title" && reward.id) {
      await User.findByIdAndUpdate(userId, { $addToSet: { ownedTitles: reward.id } }, { session });
    } else if (reward.type === "xp" && (reward.amount ?? 0) > 0) {
      const user = await User.findByIdAndUpdate(userId, { $inc: { xp: reward.amount } }, { new: true, session }).select("xp level").lean();
      if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      const milestone = getLevelMilestoneForXp(user.xp);
      const previousLevel = Math.max(user.level ?? 1, 1);
      if (milestone.level > previousLevel) {
        await User.updateOne({ _id: userId }, { $set: { level: milestone.level, levelTitle: milestone.title } }, { session });
        const bonus = Array.from({ length: Math.max(0, milestone.level - previousLevel) }, (_, index) => getLevelMilestone(previousLevel + index + 1)).reduce((sum, candidate) => sum + candidate.coinReward, 0);
        if (bonus > 0) await creditWallet(userId, bonus, "LEVEL_REWARD", { levels: [previousLevel + 1, milestone.level], source: "battle_pass" }, session);
      }
    } else {
      throw new HttpError(409, "This reward is not claimable yet", ErrorCode.CONFLICT);
    }

    await session.commitTransaction();
    return { battlePass: updated, season, claimedReward: reward, track };
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
}
