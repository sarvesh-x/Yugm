import { vipPlans } from "@yugm/shared";
import { z } from "zod";

export const vipPrivacySchema = z.object({
  mysteriousVisitors: z.boolean().optional(), chatPrivacy: z.enum(["EVERYONE", "FOLLOWERS"]).optional()
}).refine((data) => data.mysteriousVisitors !== undefined || data.chatPrivacy !== undefined, "A privacy setting is required");

export const VIP_LEVEL_REQUIREMENTS = [0, 1_000, 1_500, 2_500, 4_000, 6_000, 10_000, 25_000] as const;
export const VIP_LEVEL_COUNT = VIP_LEVEL_REQUIREMENTS.length - 1;
export const VIP_CYCLE_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

export function findVipPlan(planId: string) {
  return vipPlans.find((plan) => plan.id === planId);
}

function levelFromTier(tier: unknown, explicitLevel: unknown): number {
  const explicit = Number(explicitLevel);
  if (Number.isInteger(explicit) && explicit > 0 && explicit <= VIP_LEVEL_COUNT) return explicit;
  if (Number.isInteger(explicit) && explicit === 0 && !tier) return 0;
  const match = String(tier ?? "").match(/(?:VIP)?\s*(\d+)/i);
  return match ? Math.max(0, Math.min(VIP_LEVEL_COUNT, Number(match[1]))) : (tier ? 1 : 0);
}

export function getVipStatus(user: any, now = new Date()) {
  const expiresAt = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : undefined;
  const level = levelFromTier(user?.vipTier, user?.vipLevel);
  const frozen = Boolean(user?.vipFrozen);
  const isVip = Boolean(level > 0 && !frozen && expiresAt && expiresAt.getTime() > now.getTime());
  const daysRemaining = isVip && expiresAt ? Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / DAY_MS)) : 0;
  const vipExp = Math.max(0, Number(user?.vipExp) || 0);
  return {
    isVip,
    vipTier: isVip ? `VIP${level}` : undefined,
    vipLevel: isVip ? level : 0,
    vipExp,
    vipExpRequired: level > 0 ? VIP_LEVEL_REQUIREMENTS[level] : VIP_LEVEL_REQUIREMENTS[1],
    nextVipExpRequired: level < VIP_LEVEL_COUNT ? VIP_LEVEL_REQUIREMENTS[level + 1] : null,
    vipStartedAt: user?.vipStartedAt,
    vipExpiresAt: isVip ? expiresAt : undefined,
    daysRemaining,
    frozen,
    freezeDaysRemaining: frozen && user?.vipFreezeStartedAt
      ? Math.max(0, VIP_CYCLE_DAYS - Math.floor((now.getTime() - new Date(user.vipFreezeStartedAt).getTime()) / DAY_MS))
      : 0
  };
}

function setLevel(user: any, level: number, now: Date) {
  user.vipLevel = level;
  user.vipTier = level > 0 ? `VIP${level}` : undefined;
  user.vipExp = 0;
  user.vipStartedAt = level > 0 ? now : undefined;
  user.vipExpiresAt = level > 0 ? new Date(now.getTime() + VIP_CYCLE_DAYS * DAY_MS) : undefined;
}

/** Add or reverse VIP EXP and apply tier changes using cumulative level costs. */
export function changeVipExp(user: any, delta: number, now = new Date()) {
  if (user?.vipExpiresAt && new Date(user.vipExpiresAt).getTime() <= now.getTime()) rollVipCycle(user, now);
  const level = levelFromTier(user?.vipTier, user?.vipLevel);
  const previousExp = Number(user?.vipExp) || 0;
  let nextExp = previousExp + Math.trunc(delta);

  if (nextExp < 0) {
    user.vipExp = nextExp;
    user.vipFrozen = true;
    user.vipFreezeStartedAt = user.vipFreezeStartedAt ?? now;
    return getVipStatus(user, now);
  }
  if (user?.vipFrozen) {
    user.vipExp = nextExp;
    if (nextExp >= 0) {
      user.vipFrozen = false;
      user.vipFreezeStartedAt = undefined;
      if (level > 0) user.vipExpiresAt = new Date(now.getTime() + VIP_CYCLE_DAYS * DAY_MS);
    }
    if (nextExp === 0) return getVipStatus(user, now);
  }

  if (delta < 0 && nextExp >= 0 && level === 0) {
    user.vipExp = nextExp;
    return getVipStatus(user, now);
  }

  const oldLevel = level;
  let targetLevel = level;
  // Requirements are cumulative over all prior levels. A single large recharge may skip tiers.
  let cost = 0;
  for (let candidate = level + 1; candidate <= VIP_LEVEL_COUNT; candidate++) {
    cost += VIP_LEVEL_REQUIREMENTS[candidate];
    if (nextExp >= cost) targetLevel = candidate;
  }
  // For an active member, only spend enough EXP to climb from their current tier.
  if (level > 0) {
    let promotionCost = 0;
    targetLevel = level;
    for (let candidate = level + 1; candidate <= VIP_LEVEL_COUNT; candidate++) {
      promotionCost += VIP_LEVEL_REQUIREMENTS[candidate];
      if (nextExp >= promotionCost) targetLevel = candidate;
    }
    if (delta > 0 && targetLevel > level) {
      setLevel(user, targetLevel, now);
      return getVipStatus(user, now);
    }
    user.vipExp = nextExp;
    return getVipStatus(user, now);
  }
  if (targetLevel > oldLevel) {
    setLevel(user, targetLevel, now);
  } else {
    user.vipExp = nextExp;
  }
  return getVipStatus(user, now);
}

/** Notification payload for a 90-day review that changed the member's tier. */
export function vipCycleNotice(beforeLevel: number, afterLevel: number) {
  if (beforeLevel === afterLevel) return null;
  if (afterLevel === 0) return {
    title: "VIP membership ended",
    body: "Your VIP cycle review ended your membership.",
    data: { type: "VIP_CYCLE", fromLevel: beforeLevel, toLevel: 0 }
  };
  return {
    title: "VIP tier updated",
    body: `Your VIP cycle review set your tier to VIP${afterLevel}.`,
    data: { type: "VIP_CYCLE", fromLevel: beforeLevel, toLevel: afterLevel }
  };
}

/** Apply the 90-day review: keep the current tier if it was maintained, otherwise downgrade. */
export function rollVipCycle(user: any, now = new Date()) {
  const currentLevel = levelFromTier(user?.vipTier, user?.vipLevel);
  const exp = Math.max(0, Number(user?.vipExp) || 0);
  if (user?.vipFrozen) {
    const freezeStart = user.vipFreezeStartedAt ? new Date(user.vipFreezeStartedAt).getTime() : now.getTime();
    if (now.getTime() - freezeStart >= VIP_CYCLE_DAYS * DAY_MS) {
      user.vipFrozen = false;
      user.vipFreezeStartedAt = undefined;
      setLevel(user, 0, now);
    }
    return getVipStatus(user, now);
  }
  if (currentLevel === 0) {
    user.vipExp = 0;
    user.vipExpiresAt = undefined;
    return getVipStatus(user, now);
  }
  let maintainedLevel = 0;
  for (let candidate = 1; candidate <= currentLevel; candidate++) {
    if (exp >= VIP_LEVEL_REQUIREMENTS[candidate]) maintainedLevel = candidate;
  }
  setLevel(user, maintainedLevel, now);
  return getVipStatus(user, now);
}

export function addVipDays(user: any, durationDays: number, now = new Date()) {
  const currentExpiry = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : undefined;
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return new Date(base.getTime() + durationDays * DAY_MS);
}

/** Purchases are billed in INR; 83 INR is the configured USD conversion basis for VIP EXP. */
export function vipExpForPurchase(amountInr: number): number {
  return Math.max(0, Math.floor((Math.max(0, amountInr) / 83) * 10));
}
