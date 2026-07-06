import { vipPlans } from "@yugm/shared";

export function findVipPlan(planId: string) {
  return vipPlans.find((plan) => plan.id === planId);
}

export function getVipStatus(user: any, now = new Date()) {
  const expiresAt = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : undefined;
  const isVip = Boolean(expiresAt && expiresAt.getTime() > now.getTime());
  return {
    isVip,
    vipTier: isVip ? user?.vipTier ?? "VIP" : undefined,
    vipStartedAt: user?.vipStartedAt,
    vipExpiresAt: isVip ? expiresAt : undefined
  };
}

export function addVipDays(user: any, durationDays: number, now = new Date()) {
  const currentExpiry = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : undefined;
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
}
