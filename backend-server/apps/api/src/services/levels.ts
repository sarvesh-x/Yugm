import type { XpEvent } from "@yugm/shared";
import mongoose from "mongoose";
import { getLevelMilestone, getLevelMilestoneForXp, xpDailyCaps, xpEvents } from "@yugm/shared";
import { User } from "../models/User.js";
import { createNotification } from "./notifications.js";
import { creditWallet } from "./wallet.js";
import { XpDailyCap } from "../models/XpDailyCap.js";
import { XpGrant } from "../models/XpGrant.js";
import { addBattlePassXp } from "./battlePass.js";

type LevelUser = {
  _id?: unknown;
  id?: string;
  xp?: number;
  level?: number;
  levelTitle?: string;
  lastDailyCheckInAt?: Date | string;
};

export const dailyXpCaps = xpDailyCaps;

async function syncBattlePassXpWithRetry(userId: string, xpAwarded: number, event: XpEvent, actionKey?: string) {
  const maxAttempts = 3;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await addBattlePassXp(userId, xpAwarded, actionKey ? `${event}:${actionKey}` : undefined);
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt === maxAttempts) {
        console.warn(JSON.stringify({
          metric: "battle_pass_xp_sync_failed",
          event,
          attemptCount: attempt,
          error: message
        }));
        return;
      }
      console.warn(JSON.stringify({
        metric: "battle_pass_xp_sync_retry",
        event,
        attempt,
        error: message
      }));
      await new Promise((resolve) => setTimeout(resolve, 100 * (2 ** (attempt - 1))));
    }
  }
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

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

export async function grantXp(userId: string, event: XpEvent, metadata: Record<string, unknown> = {}, amountOverride?: number) {
  const startedAt = Date.now();
  let xpAwarded: number = Math.max(0, Math.floor(amountOverride ?? xpEvents[event]));
  let capInfo: { cap: number; earnedToday: number } | undefined;
  if (xpAwarded <= 0) return { event, xpAwarded: 0, levelUpReward: 0, levelsGained: [], levelUp: false, level: getLevelStatus(null) };
  const actionKey = typeof metadata.idempotencyKey === "string" ? metadata.idempotencyKey.trim() : "";
  let grantRecordId: mongoose.Types.ObjectId | undefined;
  if (actionKey) {
    try {
      const [grant] = await XpGrant.create([{
        userId,
        event,
        actionKey,
        status: "PROCESSING",
        requestedXp: xpAwarded
      }]);
      grantRecordId = grant._id;
    } catch (error) {
      if ((error as { code?: number })?.code !== 11000) throw error;
      const existing = await XpGrant.findOne({ userId, event, actionKey }).lean();
      if (existing?.status === "COMPLETE" && existing.receipt) return { ...(existing.receipt as Record<string, unknown>), duplicate: true };
      const currentUser = await User.findById(userId).select("xp level levelTitle lastDailyCheckInAt").lean();
      return { event, xpAwarded: 0, duplicate: true, inProgress: true, level: getLevelStatus(currentUser) };
    }
  }
  const finish = async <T extends Record<string, unknown>>(receipt: T): Promise<T> => {
    if (grantRecordId) await XpGrant.updateOne({ _id: grantRecordId, status: "PROCESSING" }, { $set: { status: "COMPLETE", receipt } });
    const level = receipt.level as { level?: number } | undefined;
    const metric = {
      metric: "xp_granted",
      event,
      xpAwarded: Number(receipt.xpAwarded ?? 0),
      capped: Boolean(receipt.capped),
      ...(receipt.cap !== undefined ? { cap: receipt.cap } : {}),
      ...(receipt.earnedToday !== undefined ? { earnedToday: receipt.earnedToday } : {}),
      ...(level?.level !== undefined ? { level: level.level } : {}),
      latencyMs: Date.now() - startedAt
    };
    console.info(JSON.stringify(metric));
    if (metric.capped) console.info(JSON.stringify({ metric: "xp_cap_hit", event, cap: receipt.cap, earnedToday: receipt.earnedToday }));
    const levelsGained = receipt.levelsGained;
    if (Array.isArray(levelsGained) && levelsGained.length > 0) {
      console.info(JSON.stringify({ metric: "level_up", event, fromLevel: levelsGained[0] - 1, toLevel: level?.level, rewards: receipt.levelUpReward }));
    }
    return receipt;
  };
  const cap = dailyXpCaps[event];
  if (cap !== undefined) {
    const day = startOfUtcDay();
    const userObjectId = new mongoose.Types.ObjectId(userId);
    let awarded = false;

    // A compare-and-set counter keeps the cap correct across API instances and
    // process restarts. The unique index also makes first-use creation safe.
    for (let attempt = 0; attempt < 6 && !awarded; attempt += 1) {
      const entry = await XpDailyCap.findOne({ userId: userObjectId, event, day }).select("amount").lean();
      const current = entry?.amount ?? 0;
      const allowed = Math.min(xpAwarded, Math.max(0, cap - current));
      if (allowed <= 0) {
        capInfo = { cap, earnedToday: current };
        break;
      }

      if (!entry) {
        try {
          await XpDailyCap.create({ userId: userObjectId, event, day, amount: allowed });
          xpAwarded = allowed;
          capInfo = { cap, earnedToday: current + allowed };
          awarded = true;
        } catch (error) {
          if ((error as { code?: number })?.code !== 11000) throw error;
        }
      } else {
        const updatedCounter = await XpDailyCap.findOneAndUpdate(
          { userId: userObjectId, event, day, amount: current },
          { $inc: { amount: allowed } },
          { new: true }
        ).select("amount").lean();
        if (updatedCounter) {
          xpAwarded = allowed;
          capInfo = { cap, earnedToday: updatedCounter.amount };
          awarded = true;
        }
      }
    }

    if (!awarded) {
      const user = await User.findById(userId).select("xp level levelTitle lastDailyCheckInAt walletBalance").lean();
      return finish({
        event,
        xpAwarded: 0,
        capped: capInfo?.earnedToday === cap,
        cap: capInfo?.cap,
        earnedToday: capInfo?.earnedToday,
        remainingToday: capInfo ? Math.max(0, capInfo.cap - capInfo.earnedToday) : undefined,
        levelUpReward: 0,
        levelsGained: [],
        levelUp: false,
        level: getLevelStatus(user),
        walletBalance: user?.walletBalance
      });
    }
  }
  const updated = await User.findByIdAndUpdate(
    userId,
    { $inc: { xp: xpAwarded } },
    { new: true }
  ).select("xp level levelTitle lastDailyCheckInAt").lean();
  if (!updated) return undefined;

  await syncBattlePassXpWithRetry(userId, xpAwarded, event, actionKey || undefined);

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
    ({ levelUpReward, levelsGained } = getLevelPromotion(previousLevel, status.level));
    if (levelUpReward > 0) {
      await creditWallet(userId, levelUpReward, "LEVEL_REWARD", { event, levels: levelsGained, ...metadata });
    }
    await createNotification(userId, "SYSTEM", "Level up!", `You reached Level ${status.level}: ${status.title}.`, { type: "LEVEL_UP", level: status.level, reward: levelUpReward });
  }

  const fresh = await User.findById(userId).select("xp level levelTitle lastDailyCheckInAt walletBalance").lean();
  return finish({
    event,
    xpAwarded,
    ...(capInfo ? {
      capped: capInfo.earnedToday >= capInfo.cap,
      cap: capInfo.cap,
      earnedToday: capInfo.earnedToday,
      remainingToday: Math.max(0, capInfo.cap - capInfo.earnedToday)
    } : { capped: false }),
    levelUpReward,
    levelsGained,
    levelUp: levelsGained.length > 0,
    level: getLevelStatus(fresh ?? updated),
    walletBalance: fresh?.walletBalance
  });
}

export function dailyCheckInStart(date?: Date) {
  return startOfUtcDay(date);
}
