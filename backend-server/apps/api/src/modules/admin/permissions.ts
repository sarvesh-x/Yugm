export const adminRoles = [
  "SUPER_ADMIN",
  "ADMIN",
  "MODERATOR",
  "FINANCE_MANAGER",
  "SUPPORT_AGENT",
  "CONTENT_REVIEWER",
  "ROOM_MODERATOR",
  "ANALYST"
] as const;

export type AdminRole = typeof adminRoles[number];

export const adminPermissions = [
  "users.read",
  "users.update",
  "users.suspend",
  "users.ban",
  "users.delete",
  "profiles.review",
  "profiles.verify",
  "rooms.read",
  "rooms.end",
  "rooms.feature",
  "rooms.moderate",
  "reports.read",
  "reports.resolve",
  "messages.read",
  "messages.read_private",
  "messages.delete",
  "wallet.read",
  "wallet.adjust",
  "payments.read",
  "payments.refund",
  "withdrawals.read",
  "withdrawals.approve",
  "withdrawals.reject",
  "gifts.manage",
  "cosmetics.read",
  "cosmetics.write",
  "notifications.send",
  "support.read",
  "support.reply",
  "audit.read",
  "analytics.read",
  "settings.manage",
  "trust_verification.read",
  "trust_verification.review",
  "trust_verification.media.read",
  "trust_verification.approve",
  "trust_verification.reject",
  "creator_kyc.read",
  "creator_kyc.review",
  "creator_kyc.approve",
  "creator_kyc.reject",
  "creator_kyc.sensitive.read",
  "payout_review.read",
  "payout_review.approve",
  "payout_review.reject",
  "dm_reviews.review"
] as const;

export type AdminPermission = typeof adminPermissions[number];

const all = [...adminPermissions];

export const rolePermissions: Record<AdminRole, AdminPermission[]> = {
  SUPER_ADMIN: all,
  ADMIN: all.filter((permission) => permission !== "users.delete"),
  MODERATOR: [
    "users.read",
    "users.suspend",
    "users.ban",
    "profiles.review",
    "rooms.read",
    "rooms.end",
    "rooms.moderate",
    "reports.read",
    "reports.resolve",
    "messages.read",
    "messages.delete",
    "dm_reviews.review",
    "support.read",
    "audit.read",
    "analytics.read"
  ],
  FINANCE_MANAGER: [
    "users.read",
    "wallet.read",
    "wallet.adjust",
    "payments.read",
    "payments.refund",
    "withdrawals.read",
    "withdrawals.approve",
    "withdrawals.reject",
    "creator_kyc.read",
    "creator_kyc.review",
    "creator_kyc.approve",
    "creator_kyc.reject",
    "creator_kyc.sensitive.read",
    "payout_review.read",
    "payout_review.approve",
    "payout_review.reject",
    "audit.read",
    "analytics.read"
  ],
  SUPPORT_AGENT: ["users.read", "reports.read", "support.read", "support.reply", "notifications.send"],
  CONTENT_REVIEWER: ["users.read", "profiles.review", "profiles.verify", "trust_verification.read", "trust_verification.review", "trust_verification.media.read", "trust_verification.approve", "trust_verification.reject", "reports.read", "reports.resolve", "messages.read", "messages.delete", "dm_reviews.review"],
  ROOM_MODERATOR: ["users.read", "rooms.read", "rooms.end", "rooms.moderate", "reports.read", "reports.resolve"],
  ANALYST: ["users.read", "rooms.read", "wallet.read", "payments.read", "audit.read", "analytics.read"]
};

export function permissionsFor(role: AdminRole, extra: string[] = [], isSuperAdmin = false) {
  if (isSuperAdmin || role === "SUPER_ADMIN") return all;
  return Array.from(new Set([...(rolePermissions[role] ?? []), ...extra])) as AdminPermission[];
}
