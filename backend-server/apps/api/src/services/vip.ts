import { vipPlans } from "@yugm/shared";

export function findVipPlan(planId: string) {
  return vipPlans.find((plan) => plan.id === planId);
}

export function getVipStatus(user: any, now = new Date()) {
  const expiresAt = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : undefined;
  const isVip = Boolean(expiresAt && expiresAt.getTime() > now.getTime());
  const daysRemaining = isVip && expiresAt ? Math.max(1, Math.ceil((expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))) : 0;
  return {
    isVip,
    vipTier: isVip ? user?.vipTier ?? "VIP" : undefined,
    vipStartedAt: user?.vipStartedAt,
    vipExpiresAt: isVip ? expiresAt : undefined,
    daysRemaining
  };
}

export function addVipDays(user: any, durationDays: number, now = new Date()) {
  const currentExpiry = user?.vipExpiresAt ? new Date(user.vipExpiresAt) : undefined;
  const base = currentExpiry && currentExpiry.getTime() > now.getTime() ? currentExpiry : now;
  return new Date(base.getTime() + durationDays * 24 * 60 * 60 * 1000);
}
