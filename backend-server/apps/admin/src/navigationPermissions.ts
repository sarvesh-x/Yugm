import type { Admin } from "./api.js";

export type ViewKey =
  | "dashboard"
  | "users"
  | "reports"
  | "queue"
  | "trustVerifications"
  | "creatorKyc"
  | "payoutReviews"
  | "rooms"
  | "pk"
  | "messages"
  | "wallet"
  | "payments"
  | "gifts"
  | "cosmetics"
  | "assets"
  | "badges"
  | "reactions"
  | "notifications"
  | "campaigns"
  | "growth"
  | "support"
  | "dmReviews"
  | "referrals"
  | "analytics"
  | "fraud"
  | "config"
  | "audit"
  | "admins"
  | "settings";

/** Views that require an explicit admin permission. Server RBAC remains authoritative. */
export const VIEW_PERMISSIONS: Partial<Record<ViewKey, string>> = {
  trustVerifications: "trust_verification.read",
  creatorKyc: "creator_kyc.read",
  payoutReviews: "payout_review.read",
  assets: "cosmetics.write",
  badges: "cosmetics.write",
  reactions: "cosmetics.write",
  campaigns: "notifications.send",
  dmReviews: "dm_reviews.review",
};

export function canAccessView(
  admin: Pick<Admin, "isSuperAdmin" | "permissions">,
  view: ViewKey
): boolean {
  const required = VIEW_PERMISSIONS[view];
  return !required || admin.isSuperAdmin || admin.permissions.includes(required);
}
