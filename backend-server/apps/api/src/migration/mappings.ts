/**
 * Per-collection MongoDB -> D1 transform mappings.
 *
 * These are design-time transforms only: they operate on already-exported
 * records, never connect to a database, and quarantine bad values instead of
 * coercing them. The enum lists and column names mirror the current Mongoose
 * models and the generated draft in migrations/d1/0001_initial.sql; both must
 * be reviewed against docs/database/mongo-to-relational-mapping.md before use.
 */
import { stableStringify } from "./snapshot.js";
import { ACTIVE_COSMETIC_KEYS, AVATAR_PART_KEYS, authProfileNullFields, missingProfileFields } from "./authProfileFields.js";
import {
  toBoolean,
  toEnum,
  toFiniteNumber,
  toInteger,
  toIntegerMinorUnits,
  toOpaqueId,
  toRequiredString,
  toSourceId,
  toUtcIso,
  TransformContext,
  type TransformField
} from "./transform.js";
import type { MappedRecord, SourceRecord, TargetRow, TargetWrite } from "./types.js";

export type RecordMapping = (record: SourceRecord, context: TransformContext) => MappedRecord;

const USER_ROLES = ["USER", "HOST", "MODERATOR", "ADMIN"] as const;
const AVATAR_TYPES = ["UPLOADED", "GENERATED", "DEFAULT"] as const;
const ACHIEVEMENT_TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM"] as const;
const VIP_CHAT_PRIVACY = ["EVERYONE", "FOLLOWERS"] as const;
const ADMIN_ROLES = [
  "SUPER_ADMIN", "ADMIN", "MODERATOR", "FINANCE_MANAGER", "SUPPORT_AGENT",
  "CONTENT_REVIEWER", "ROOM_MODERATOR", "ANALYST"
] as const;
const ADMIN_STATUSES = ["ACTIVE", "SUSPENDED", "DISABLED", "INVITED"] as const;
const WALLET_TYPES = ["CREDIT", "DEBIT"] as const;
const WALLET_SOURCES = [
  "BOND_HOLD", "BOND_RELEASE", "RECHARGE", "GIFT_SENT", "GIFT_RECEIVED",
  "GIFT_SENT_DM", "GIFT_RECEIVED_DM", "VIP_PURCHASE", "PROFILE_COSMETIC_PURCHASE",
  "COSMETIC_BUNDLE_PURCHASE", "COSMETIC_GIFT_SENT", "COSMETIC_GIFT_RECEIVED",
  "LEVEL_REWARD", "STREAK_BONUS", "DAILY_REWARD", "ADMIN_ADJUSTMENT",
  "RAZORPAY_PURCHASE", "GOOGLE_PLAY_PURCHASE", "PAYMENT_REFUND", "REFERRAL_BONUS",
  "STORY_REWARD", "SUBSCRIPTION", "SURPRISE_BOX", "GIFT_UPGRADE", "GIFT_PURCHASE",
  "BATTLE_PASS_PURCHASE", "BATTLE_PASS_REWARD", "MISSION_REWARD"
] as const;
const MEDIA_OWNER_TYPES = ["USER", "ROOM", "CLAN", "MESSAGE", "COSMETIC", "ACHIEVEMENT", "EVENT", "APPLICATION"] as const;
const MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO", "FILE"] as const;
const MEDIA_CATEGORIES = [
  "AVATAR", "COVER", "GALLERY", "CHAT_IMAGE", "CHAT_VIDEO", "VOICE_MESSAGE",
  "ATTACHMENT", "BADGE", "COSMETIC", "STICKER", "APPLICATION_ART"
] as const;
const R2_BUCKETS = ["assets", "public-media", "private-media", "originals", "staging"] as const;
const MEDIA_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
const PROCESSING_STATUSES = ["PENDING", "PROCESSING", "READY", "FAILED"] as const;
const MODERATION_STATUSES = ["PENDING", "APPROVED", "REJECTED"] as const;
const UPLOAD_STATUSES = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "EXPIRED", "FAILED"] as const;
const BOND_STATUSES = [
  "ACTIVE", "ENDED", "TERMINATED_BY_BLOCK", "TERMINATED_BY_MODERATION", "TERMINATED_BY_ACCOUNT_REMOVAL"
] as const;
const BOND_REQUEST_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "CANCELLED", "EXPIRED", "INVALIDATED"] as const;
const BOND_PREFERENCE_VISIBILITIES = ["PRIVATE", "FRIENDS", "PUBLIC"] as const;
const CLAN_INVITE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"] as const;
const GROUP_MESSAGE_MEDIA_TYPES = ["", "IMAGE", "VIDEO", "AUDIO"] as const;
const KYC_STATUSES = ["NOT_SUBMITTED", "PENDING", "VERIFIED", "REJECTED", "NEEDS_RETRY", "EXPIRED", "MANUAL_REVIEW"] as const;
const CREATOR_PAYOUT_STATUSES = ["DISABLED", "ENABLED", "FROZEN", "MANUAL_REVIEW"] as const;
const FRIEND_MATCH_STATUSES = ["WAITING", "PAIRING", "MATCHED", "CANCELLED"] as const;
const GIFT_CATEGORIES = ["normal", "premium", "limited", "seasonal", "mythology", "space", "dragon", "luxury", "vip", "bonds"] as const;
const GIFT_BOND_PURPOSES = ["INVITATION", "PROGRESSION", "ANNIVERSARY", "COSMETIC"] as const;
const GIFT_RARITIES = ["common", "rare", "epic", "legendary", "mythic"] as const;
const NOTIFICATION_TYPES = [
  "FOLLOW", "GIFT", "ROOM_INVITE", "ROOM_LIVE", "SPEAKER_APPROVED", "MESSAGE",
  "MOMENT", "COMMENT", "SYSTEM", "FRIEND_REQUEST", "FRIEND_ACCEPT", "SUBSCRIPTION", "WAVE"
] as const;
const CAMPAIGN_SEGMENTS = ["all", "hosts", "city", "vip", "custom"] as const;
const CAMPAIGN_STATUSES = ["DRAFT", "SCHEDULED", "SENDING", "SENT", "CANCELLED"] as const;
const PAYOUT_REVIEW_STATUSES = ["PENDING", "APPROVED", "REJECTED", "NEEDS_MANUAL_REVIEW", "BLOCKED", "PAID"] as const;
const PK_MODES = ["GIFT", "VOTE", "REACTION", "MIXED"] as const;
const PK_STATUSES = [
  "INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN", "ACTIVE", "FINAL_CRUNCH",
  "FINALIZING", "COMPLETED", "CLOSED", "ABORTED", "ENDED", "CANCELLED", "DECLINED",
  "EXPIRED", "FORCE_ENDED"
] as const;
const PK_BATTLE_TYPES = ["VOICE", "VIDEO"] as const;
const PK_FORMATS = ["PLAYER", "TEAM", "ROOM", "LIVESTREAM"] as const;
const PK_SCOPES = ["SAME_ROOM", "CROSS_ROOM"] as const;
const PK_SIDES_WITH_DRAW = ["LEFT", "RIGHT", "DRAW"] as const;
const PK_SIDES = ["LEFT", "RIGHT"] as const;
const PK_RESULT_TYPES = ["WIN", "DRAW", "FORFEIT", "CANCELLED", "TECHNICAL"] as const;
const PK_EVENT_TYPES = [
  "PK_CREATED", "PK_READY", "PK_COUNTDOWN", "PK_FINAL_CRUNCH", "PK_FINALIZING",
  "PK_COMPLETED", "PK_CLOSED", "PK_CANCELLED", "PK_ABORTED", "PK_INVITE_SENT",
  "PK_INVITE_ACCEPTED", "PK_INVITE_REJECTED", "PK_INVITE_EXPIRED", "PK_STARTED",
  "GIFT_SENT", "REACTION_SENT", "VOTE_CAST", "SCORE_UPDATED", "LEAD_CHANGED",
  "PK_ENDED", "PK_FORCE_ENDED", "PK_REMATCH_REQUESTED"
] as const;
const PK_INVITE_STATUSES = ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"] as const;
const PK_PARTICIPANT_ROLES = ["HOST", "SPEAKER", "AUDIENCE", "MODERATOR"] as const;
const PK_TEAM_NAMES = ["A", "B"] as const;

const NOTIFICATION_KEYS = [
  "roomInvites", "messages", "gifts", "follows", "hostGoingLive", "wallet", "safety", "marketing"
] as const;

function field(collection: string, name: string, rowId: string, context: TransformContext): TransformField {
  return { collection, field: name, rowId, context };
}

function snake(name: string): string {
  return name.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
}

function optString(value: unknown, f: TransformField): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === "string") return value;
  return f.context.reject(f, "MISSING_REQUIRED", "expected a string or null") ?? null;
}

function optDate(value: unknown, f: TransformField): string | null {
  if (value === undefined || value === null) return null;
  return toUtcIso(value, f) ?? null;
}

function optInteger(value: unknown, f: TransformField, options: { min?: number; max?: number } = {}): number | null {
  if (value === undefined || value === null) return null;
  return toInteger(value, f, options) ?? null;
}

function optBoolean(value: unknown, f: TransformField): number | null {
  if (value === undefined || value === null) return null;
  return toBoolean(value, f) ?? null;
}

function optEnum<T extends string>(value: unknown, allowed: readonly T[], f: TransformField): T | null {
  if (value === undefined || value === null) return null;
  return toEnum(value, allowed, f) ?? null;
}

/** Optional ObjectId reference; preserved as a canonical source_id string. */
function optReference(value: unknown, f: TransformField): string | null {
  if (value === undefined || value === null) return null;
  return toSourceId(value, f) ?? null;
}

interface ChildBuilder {
  collection: string;
  table: string;
  parentTable: string;
  parentId: string | undefined;
  fieldName: string;
  elements: unknown;
  context: TransformContext;
  build: (element: Record<string, unknown>, f: TransformField, sourceId: string) => TargetRow | undefined;
}

/** Stable child-table rows with deterministic synthetic keys and positions. */
function childRows(spec: ChildBuilder): TargetWrite {
  const rows: TargetRow[] = [];
  const elements = Array.isArray(spec.elements) ? spec.elements : [];
  const parentId = spec.parentId ?? "";
  elements.forEach((element, position) => {
    const raw: Record<string, unknown> = element !== null && typeof element === "object"
      ? element as Record<string, unknown>
      : { value: element };
    const rawId = raw._id;
    const elementId = typeof rawId === "string" || typeof rawId === "number" ? String(rawId) : undefined;
    const sourceId = elementId ?? `${parentId}:${spec.fieldName}:${position}`;
    const f: TransformField = {
      ...field(spec.collection, `${spec.fieldName}[${position}]`, spec.parentId ?? "<unknown>", spec.context),
      soft: true
    };
    const built = spec.build(raw, f, sourceId);
    if (built) rows.push({ source_id: sourceId, ...built, [`${spec.parentTable}_id`]: parentId, position });
  });
  return { table: spec.table, rows };
}

function primitiveChildren(
  collection: string,
  table: string,
  parentTable: string,
  parentId: string | undefined,
  fieldName: string,
  elements: unknown,
  context: TransformContext
): TargetWrite {
  return childRows({
    collection, table, parentTable, parentId, fieldName, elements, context,
    build: (raw, f) => {
      const value = toRequiredString(raw.value, f);
      return value ? { value } : undefined;
    }
  });
}

/** Numeric primitive arrays stored in INTEGER child-table value columns. */
function integerChildren(
  collection: string,
  table: string,
  parentTable: string,
  parentId: string | undefined,
  fieldName: string,
  elements: unknown,
  context: TransformContext
): TargetWrite {
  return childRows({
    collection, table, parentTable, parentId, fieldName, elements, context,
    build: (raw, f) => {
      const value = toInteger(raw.value, f);
      return value === undefined ? undefined : { value };
    }
  });
}

function rejected(fields: readonly unknown[]): boolean {
  return fields.some((value) => value === undefined);
}

function mapUser(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "users";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const name = toRequiredString(record.name, f("name"));
  const username = toRequiredString(record.username, f("username"));
  const role = toEnum(record.role ?? "USER", USER_ROLES, f("role"));
  const critical = [sourceId, name, username, role];

  const row: TargetRow = {
    source_id: sourceId ?? null,
    name: name ?? null,
    username: username ?? null,
    role: role ?? null,
    email: optString(record.email, f("email")),
    phone: optString(record.phone, f("phone")),
    firebase_uid: optString(record.firebaseUid, f("firebaseUid")),
    avatar: optString(record.avatar, f("avatar")),
    avatar_media_id: optString(record.avatarMediaId, f("avatarMediaId")),
    avatar_type: optEnum(record.avatarType, AVATAR_TYPES, f("avatarType")),
    gender: optString(record.gender, f("gender")),
    age: optInteger(record.age, f("age")),
    city: optString(record.city, f("city")),
    state: optString(record.state, f("state")),
    bio: optString(record.bio, f("bio")),
    vibe_line: optString(record.vibeLine, f("vibeLine")),
    clan_id: optReference(record.clanId, f("clanId")),
    level_title: toRequiredString(record.levelTitle ?? "New Vibe", f("levelTitle")) ?? "New Vibe",
    interested_in: optString(record.interestedIn, f("interestedIn")),
    looking_for: optString(record.lookingFor, f("lookingFor")),
    referral_code: optString(record.referralCode, f("referralCode")),
    referred_by: optReference(record.referredBy, f("referredBy")),
    moderation_reason: optString(record.moderationReason, f("moderationReason")),
    vip_tier: optString(record.vipTier, f("vipTier")),
    vip_chat_privacy: toEnum(record.vipChatPrivacy ?? "EVERYONE", VIP_CHAT_PRIVACY, f("vipChatPrivacy")) ?? "EVERYONE",
    last_daily_check_in_at: optDate(record.lastDailyCheckInAt, f("lastDailyCheckInAt")),
    profile_completed_at: optDate(record.profileCompletedAt, f("profileCompletedAt")),
    deletion_requested_at: optDate(record.deletionRequestedAt, f("deletionRequestedAt")),
    terms_accepted_at: optDate(record.termsAcceptedAt, f("termsAcceptedAt")),
    vip_started_at: optDate(record.vipStartedAt, f("vipStartedAt")),
    vip_expires_at: optDate(record.vipExpiresAt, f("vipExpiresAt")),
    vip_freeze_started_at: optDate(record.vipFreezeStartedAt, f("vipFreezeStartedAt")),
    muted_until: optDate(record.mutedUntil, f("mutedUntil")),
    suspended_until: optDate(record.suspendedUntil, f("suspendedUntil")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };

  const avatarParts = (record.avatarParts ?? {}) as Record<string, unknown>;
  for (const key of AVATAR_PART_KEYS) {
    row[`avatar_parts_${key}`] = optInteger(avatarParts[key], f(`avatarParts.${key}`), { min: 0, max: 47 });
  }

  row.is_verified = toBoolean(record.isVerified ?? false, f("isVerified")) ?? 0;
  row.email_verified = toBoolean(record.emailVerified ?? false, f("emailVerified")) ?? 0;
  row.is_blocked = toBoolean(record.isBlocked ?? false, f("isBlocked")) ?? 0;
  row.bond_version = toInteger(record.bondVersion ?? 0, f("bondVersion"), { min: 0 }) ?? 0;
  row.bond_invitations = toBoolean(record.bondInvitations ?? true, f("bondInvitations")) ?? 1;
  row.bond_notifications = toBoolean(record.bondNotifications ?? true, f("bondNotifications")) ?? 1;
  row.followers_count = toInteger(record.followersCount ?? 0, f("followersCount"), { min: 0 }) ?? 0;
  row.following_count = toInteger(record.followingCount ?? 0, f("followingCount"), { min: 0 }) ?? 0;
  row.wallet_balance = toIntegerMinorUnits(record.walletBalance ?? 0, f("walletBalance")) ?? 0;
  row.diamond_balance = toIntegerMinorUnits(record.diamondBalance ?? 0, f("diamondBalance")) ?? 0;
  row.xp = toInteger(record.xp ?? 0, f("xp"), { min: 0 }) ?? 0;
  row.wealth_exp = toInteger(record.wealthExp ?? 0, f("wealthExp"), { min: 0 }) ?? 0;
  row.charm_exp = toInteger(record.charmExp ?? 0, f("charmExp"), { min: 0 }) ?? 0;
  row.level = toInteger(record.level ?? 1, f("level"), { min: 1 }) ?? 1;
  row.streak_count = toInteger(record.streakCount ?? 0, f("streakCount"), { min: 0 }) ?? 0;
  row.badge_revision = optInteger(record.badgeRevision, f("badgeRevision"));
  row.vip_level = toInteger(record.vipLevel ?? 0, f("vipLevel"), { min: 0, max: 7 }) ?? 0;
  row.vip_exp = toInteger(record.vipExp ?? 0, f("vipExp")) ?? 0;
  row.vip_frozen = toBoolean(record.vipFrozen ?? false, f("vipFrozen")) ?? 0;
  row.mysterious_visitors = toBoolean(record.mysteriousVisitors ?? false, f("mysteriousVisitors")) ?? 0;
  row.moderation_strikes = toInteger(record.moderationStrikes ?? 0, f("moderationStrikes"), { min: 0 }) ?? 0;
  row.token_version = toInteger(record.tokenVersion ?? 0, f("tokenVersion"), { min: 0 }) ?? 0;
  row.dating_age_min = optInteger(record.datingAgeMin, f("datingAgeMin"));
  row.dating_age_max = optInteger(record.datingAgeMax, f("datingAgeMax"));
  row.dating_verified_only = toBoolean(record.datingVerifiedOnly ?? false, f("datingVerifiedOnly")) ?? 0;
  row.referral_rewards_claimed = toInteger(record.referralRewardsClaimed ?? 0, f("referralRewardsClaimed"), { min: 0 }) ?? 0;

  const cosmetics = (record.activeCosmetics ?? {}) as Record<string, unknown>;
  for (const key of ACTIVE_COSMETIC_KEYS) {
    row[`active_cosmetics_${snake(key)}`] = optString(cosmetics[key], f(`activeCosmetics.${key}`));
  }
  const notifications = (record.notificationPreferences ?? {}) as Record<string, unknown>;
  for (const key of NOTIFICATION_KEYS) {
    const defaultValue = key === "marketing" ? 0 : 1;
    row[`notification_preferences_${snake(key)}`] = optBoolean(notifications[key] ?? defaultValue, f(`notificationPreferences.${key}`)) ?? defaultValue;
  }

  const primitive = (name: string, table: string, values: unknown) =>
    primitiveChildren(collection, table, "users", sourceId, name, values, context);
  const writes: TargetWrite[] = [
    { table: "users", rows: [row] },
    { table: "user_auth_profile", rows: [{
      source_id: sourceId ?? null, null_fields: JSON.stringify(authProfileNullFields(record)),
      missing_fields: JSON.stringify(missingProfileFields(record))
    }] },
    primitive("interests", "user_interests", record.interests),
    primitive("hobbies", "user_hobbies", record.hobbies),
    primitive("languages", "user_languages", record.languages),
    primitive("ownedCosmeticIds", "user_owned_cosmetics", record.ownedCosmeticIds),
    primitive("ownedTitles", "user_owned_titles", record.ownedTitles),
    primitive("claimedAchievementIds", "user_claimed_achievements", record.claimedAchievementIds),
    primitive("showcasedBadgeIds", "user_showcased_badges", record.showcasedBadgeIds),
    childRows({
      collection, table: "user_badge_grants", parentTable: "users", parentId: sourceId,
      fieldName: "badgeGrants", elements: record.badgeGrants, context,
      build: (element, f) => {
        const badgeId = toRequiredString(element.badgeId, { ...f, field: "badgeGrants.badgeId" });
        const earnedAt = toUtcIso(element.earnedAt, { ...f, field: "badgeGrants.earnedAt" });
        if (!badgeId || !earnedAt) return undefined;
        return {
          badge_id: badgeId,
          tier: optString(element.tier, { ...f, field: "badgeGrants.tier" }),
          earned_at: earnedAt,
          expires_at: optDate(element.expiresAt, { ...f, field: "badgeGrants.expiresAt" })
        };
      }
    }),
    childRows({
      collection, table: "user_claimed_achievement_tiers", parentTable: "users", parentId: sourceId,
      fieldName: "claimedAchievementTiers", elements: record.claimedAchievementTiers, context,
      build: (element, f) => {
        const achievementId = toRequiredString(element.achievementId, { ...f, field: "claimedAchievementTiers.achievementId" });
        const tier = toEnum(element.tier, ACHIEVEMENT_TIERS, { ...f, field: "claimedAchievementTiers.tier" });
        const claimedAt = toUtcIso(element.claimedAt, { ...f, field: "claimedAchievementTiers.claimedAt" });
        if (!achievementId || !tier || !claimedAt) return undefined;
        return { achievement_id: achievementId, tier, claimed_at: claimedAt };
      }
    }),
    childRows({
      collection, table: "user_profile_media", parentTable: "users", parentId: sourceId,
      fieldName: "profileMedia", elements: record.profileMedia, context,
      build: (element, f) => {
        const url = toRequiredString(element.url, { ...f, field: "profileMedia.url" });
        const type = toEnum(element.type ?? "IMAGE", ["IMAGE", "VIDEO"] as const, { ...f, field: "profileMedia.type" });
        const createdAt = toUtcIso(element.createdAt, { ...f, field: "profileMedia.createdAt" });
        if (!url || !type || !createdAt) return undefined;
        return {
          url,
          type,
          caption: optString(element.caption, { ...f, field: "profileMedia.caption" }),
          created_at: createdAt
        };
      }
    })
  ];
  // All fields are validated above, so the quarantine report is complete even
  // when a critical field failed and the whole row must be withheld.
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes, rejected: false };
}

function mapAuthSession(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "auth_sessions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const familyId = toRequiredString(record.familyId, f("familyId"));
  const refreshHash = toRequiredString(record.refreshHash, f("refreshHash"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  const tokenVersion = record.tokenVersion == null ? null : toInteger(record.tokenVersion, f("tokenVersion"), { min: 0 });
  const lastUsedAt = toUtcIso(record.lastUsedAt, f("lastUsedAt"));
  if (rejected([sourceId, userId, familyId, refreshHash, expiresAt, tokenVersion, lastUsedAt])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId,
    user_id: userId,
    family_id: familyId,
    refresh_hash: refreshHash,
    token_version: tokenVersion,
    token_version_present: Object.hasOwn(record, "tokenVersion") && record.tokenVersion !== undefined ? 1 : 0,
    expires_at: expiresAt,
    last_used_at: lastUsedAt,
    revoked_at: optDate(record.revokedAt, f("revokedAt")),
    replaced_by_hash: optString(record.replacedByHash, f("replacedByHash")),
    ip: optString(record.ip, f("ip")),
    user_agent: optString(record.userAgent, f("userAgent")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapWalletTransaction(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "wallet_transactions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const type = toEnum(record.type, WALLET_TYPES, f("type"));
  const source = toEnum(record.source, WALLET_SOURCES, f("source"));
  const amount = toIntegerMinorUnits(record.amount, f("amount"));
  const balanceBefore = toIntegerMinorUnits(record.balanceBefore, f("balanceBefore"));
  const balanceAfter = toIntegerMinorUnits(record.balanceAfter, f("balanceAfter"));
  const metadata = toRequiredString(
    record.metadata === undefined || record.metadata === null ? "{}" : stableStringify(record.metadata),
    f("metadata")
  );
  const critical = [sourceId, userId, type, source, amount, balanceBefore, balanceAfter, metadata];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    type: type ?? null,
    source: source ?? null,
    amount: amount ?? null,
    balance_before: balanceBefore ?? null,
    balance_after: balanceAfter ?? null,
    metadata: metadata ?? null,
    purchase_token: optString(record.purchaseToken, f("purchaseToken")),
    product_id: optString(record.productId, f("productId")),
    platform: optString(record.platform, f("platform")),
    verification_status: optString(record.verificationStatus, f("verificationStatus")),
    credited_at: optDate(record.creditedAt, f("creditedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapAdminUser(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "admin_users";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const email = toRequiredString(record.email, f("email"));
  const displayName = toRequiredString(record.displayName, f("displayName"));
  const role = toEnum(record.role, ADMIN_ROLES, f("role"));
  const status = toEnum(record.status ?? "ACTIVE", ADMIN_STATUSES, f("status"));
  if (rejected([sourceId, email, displayName, role, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId,
    user_id: optReference(record.userId, f("userId")),
    firebase_uid: optString(record.firebaseUid, f("firebaseUid")),
    email,
    display_name: displayName,
    avatar_url: optString(record.avatarUrl, f("avatarUrl")),
    role,
    status,
    is_super_admin: toBoolean(record.isSuperAdmin ?? false, f("isSuperAdmin")) ?? 0,
    // Secrets are preserved verbatim for parity only; migration artifacts must stay access-controlled.
    password_hash: optString(record.passwordHash, f("passwordHash")),
    two_factor_enabled: toBoolean(record.twoFactorEnabled ?? false, f("twoFactorEnabled")) ?? 0,
    two_factor_secret: optString(record.twoFactorSecret, f("twoFactorSecret")),
    two_factor_temp_secret: optString(record.twoFactorTempSecret, f("twoFactorTempSecret")),
    last_login_at: optDate(record.lastLoginAt, f("lastLoginAt")),
    last_login_ip: optString(record.lastLoginIp, f("lastLoginIp")),
    created_by: optReference(record.createdBy, f("createdBy")),
    invitation_token_hash: optString(record.invitationTokenHash, f("invitationTokenHash")),
    invitation_expires_at: optDate(record.invitationExpiresAt, f("invitationExpiresAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return {
    writes: [
      { table: "admin_users", rows: [row] },
      primitiveChildren(collection, "admin_role_permissions", "admin_users", sourceId, "permissions", record.permissions, context)
    ],
    rejected: false
  };
}

function mapMediaObject(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "media_objects";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toOpaqueId(record._id, f("_id"));
  const ownerType = toEnum(record.ownerType, MEDIA_OWNER_TYPES, f("ownerType"));
  const ownerId = toRequiredString(record.ownerId, f("ownerId"));
  const mediaType = toEnum(record.mediaType, MEDIA_TYPES, f("mediaType"));
  const category = toEnum(record.category, MEDIA_CATEGORIES, f("category"));
  const bucket = toEnum(record.bucket, R2_BUCKETS, f("bucket"));
  const storageKey = toRequiredString(record.storageKey, f("storageKey"));
  const contentType = toRequiredString(record.contentType, f("contentType"));
  const fileSize = toInteger(record.fileSize, f("fileSize"), { min: 1 });
  const checksum = toRequiredString(record.checksum, f("checksum"));
  const visibility = toEnum(record.visibility, MEDIA_VISIBILITIES, f("visibility"));
  const processingStatus = toEnum(record.processingStatus ?? "PENDING", PROCESSING_STATUSES, f("processingStatus"));
  const moderationStatus = toEnum(record.moderationStatus ?? "PENDING", MODERATION_STATUSES, f("moderationStatus"));
  const version = toInteger(record.version, f("version"), { min: 1 });
  const createdBy = toRequiredString(record.createdBy, f("createdBy"));
  if (rejected([
    sourceId, ownerType, ownerId, mediaType, category, bucket, storageKey,
    contentType, fileSize, checksum, visibility, processingStatus, moderationStatus, version, createdBy
  ])) return { writes: [], rejected: true };

  const row: TargetRow = {
    source_id: sourceId,
    owner_type: ownerType,
    owner_id: ownerId,
    media_type: mediaType,
    category,
    bucket,
    storage_key: storageKey,
    content_type: contentType,
    file_size: fileSize,
    width: optInteger(record.width, f("width"), { min: 0 }),
    height: optInteger(record.height, f("height"), { min: 0 }),
    duration: optInteger(record.duration, f("duration"), { min: 0 }),
    checksum,
    visibility,
    processing_status: processingStatus,
    moderation_status: moderationStatus,
    version,
    created_by: createdBy,
    superseded_by_id: optString(record.supersededById, f("supersededById")),
    deleted_at: optDate(record.deletedAt, f("deletedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return {
    writes: [
      { table: "media_objects", rows: [row] },
      childRows({
        collection, table: "media_variants", parentTable: "media_objects", parentId: sourceId,
        fieldName: "variants", elements: record.variants, context,
        build: (element, f) => {
          const name = toRequiredString(element.name, { ...f, field: "variants.name" });
          const variantBucket = toEnum(element.bucket, R2_BUCKETS, { ...f, field: "variants.bucket" });
          const key = toRequiredString(element.key, { ...f, field: "variants.key" });
          const variantContentType = toRequiredString(element.contentType, { ...f, field: "variants.contentType" });
          const bytes = toInteger(element.bytes, { ...f, field: "variants.bytes" }, { min: 0 });
          if (!name || !variantBucket || !key || !variantContentType || bytes === undefined) return undefined;
          return {
            name,
            bucket: variantBucket,
            key,
            // Derived delivery URLs are not persisted as authoritative values.
            url: optString(element.url, { ...f, field: "variants.url" }),
            content_type: variantContentType,
            bytes,
            width: optInteger(element.width, { ...f, field: "variants.width" }, { min: 0 }),
            height: optInteger(element.height, { ...f, field: "variants.height" }, { min: 0 })
          };
        }
      })
    ],
    rejected: false
  };
}

function mapMediaUploadSession(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "media_upload_sessions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toOpaqueId(record._id, f("_id"));
  const userId = toRequiredString(record.userId, f("userId"));
  const category = toEnum(record.category, MEDIA_CATEGORIES, f("category"));
  const expectedContentType = toRequiredString(record.expectedContentType, f("expectedContentType"));
  const expectedBytes = toInteger(record.expectedBytes, f("expectedBytes"), { min: 1 });
  const ownerType = toRequiredString(record.ownerType, f("ownerType"));
  const ownerId = toRequiredString(record.ownerId, f("ownerId"));
  const bucket = toEnum(record.bucket ?? "staging", ["staging"] as const, f("bucket"));
  const stagingKey = toRequiredString(record.stagingKey, f("stagingKey"));
  const status = toEnum(record.status ?? "PENDING", UPLOAD_STATUSES, f("status"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  const attempts = toInteger(record.attempts ?? 0, f("attempts"), { min: 0 });
  const quotaReserved = toBoolean(record.quotaReserved ?? true, f("quotaReserved"));
  if (rejected([
    sourceId, userId, category, expectedContentType, expectedBytes, ownerType, ownerId,
    bucket, stagingKey, status, expiresAt, attempts, quotaReserved
  ])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId,
    user_id: userId,
    category,
    expected_content_type: expectedContentType,
    expected_bytes: expectedBytes,
    owner_type: ownerType,
    owner_id: ownerId,
    bucket,
    staging_key: stagingKey,
    status,
    expires_at: expiresAt,
    completed_at: optDate(record.completedAt, f("completedAt")),
    media_id: optString(record.mediaId, f("mediaId")),
    attempts,
    quota_reserved: quotaReserved,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: "media_upload_sessions", rows: [row] }], rejected: false };
}

function mapMediaQuotaReservation(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "media_quota_reservations";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toOpaqueId(record._id, f("_id"));
  const bytes = toInteger(record.bytes ?? 0, f("bytes"), { min: 0 });
  if (rejected([sourceId, bytes])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId,
    bytes,
    updated_at: optDate(record.updatedAt, f("updatedAt")),
    created_at: optDate(record.createdAt, f("createdAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function jsonMetadata(value: unknown, f: TransformField): string {
  return toRequiredString(value === undefined || value === null ? "{}" : stableStringify(value), f) ?? "{}";
}

const DIAMOND_TYPES = ["CREDIT", "DEBIT"] as const;
const DIAMOND_SOURCES = [
  "ADMIN_ADJUSTMENT", "GIFT_SENT", "GIFT_RECEIVED", "RAZORPAY_PURCHASE",
  "GOOGLE_PLAY_PURCHASE", "REWARD", "REFUND"
] as const;
const PURCHASE_PROVIDERS = ["RAZORPAY", "GOOGLE_PLAY"] as const;
const PURCHASE_STATUSES = [
  "PENDING", "PAID", "FAILED", "CREDITED", "REFUND_PENDING", "REFUNDED", "REFUND_FAILED"
] as const;
const CURRENCIES = ["COINS", "DIAMONDS"] as const;
const GIFT_TYPES = ["send", "combo", "room_wide", "trade", "auction"] as const;
const WITHDRAWAL_STATUSES = ["PENDING_REVIEW", "APPROVED", "REJECTED", "PAID", "CANCELLED", "BLOCKED"] as const;
const SUBSCRIPTION_PLANS = ["MONTHLY", "YEARLY"] as const;
const SUBSCRIPTION_PROVIDERS = ["GOOGLE_PLAY"] as const;
const SUBSCRIPTION_STATUSES = ["ACTIVE", "IN_GRACE_PERIOD", "CANCELLED", "EXPIRED", "ON_HOLD", "PENDING"] as const;
const DEVICE_PLATFORMS = ["android", "ios", "web"] as const;
const ASSET_OWNER_TYPES = ["cosmetic", "badge", "gift"] as const;
const ASSET_STATUSES = ["staging", "published", "archived"] as const;

function mapAdminSession(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "admin_sessions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const adminId = toSourceId(record.adminId, f("adminId"));
  const refreshTokenHash = toRequiredString(record.refreshTokenHash, f("refreshTokenHash"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  const critical = [sourceId, adminId, refreshTokenHash, expiresAt];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    admin_id: adminId ?? null,
    refresh_token_hash: refreshTokenHash ?? null,
    expires_at: expiresAt ?? null,
    ip_address: optString(record.ipAddress, f("ipAddress")),
    user_agent: optString(record.userAgent, f("userAgent")),
    revoked_at: optDate(record.revokedAt, f("revokedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapDeviceToken(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "device_tokens";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const token = toRequiredString(record.token, f("token"));
  const platform = toEnum(record.platform, DEVICE_PLATFORMS, f("platform"));
  const lastSeenAt = toUtcIso(record.lastSeenAt, f("lastSeenAt"));
  const critical = [sourceId, userId, token, platform, lastSeenAt];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    token: token ?? null,
    platform: platform ?? null,
    last_seen_at: lastSeenAt ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapDiamondTransaction(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "diamond_transactions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const type = toEnum(record.type, DIAMOND_TYPES, f("type"));
  const source = toEnum(record.source, DIAMOND_SOURCES, f("source"));
  const amount = toIntegerMinorUnits(record.amount, f("amount"));
  const balanceBefore = toIntegerMinorUnits(record.balanceBefore, f("balanceBefore"));
  const balanceAfter = toIntegerMinorUnits(record.balanceAfter, f("balanceAfter"));
  const metadata = jsonMetadata(record.metadata, f("metadata"));
  const critical = [sourceId, userId, type, source, amount, balanceBefore, balanceAfter, metadata];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    type: type ?? null,
    source: source ?? null,
    amount: amount ?? null,
    balance_before: balanceBefore ?? null,
    balance_after: balanceAfter ?? null,
    metadata: metadata ?? null,
    idempotency_key: optString(record.idempotencyKey, f("idempotencyKey")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPurchase(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "purchases";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const provider = toEnum(record.provider, PURCHASE_PROVIDERS, f("provider"));
  const status = toEnum(record.status ?? "PENDING", PURCHASE_STATUSES, f("status"));
  const packId = toRequiredString(record.packId, f("packId"));
  const assetCurrency = toEnum(record.assetCurrency ?? "COINS", CURRENCIES, f("assetCurrency"));
  const coinAmount = toIntegerMinorUnits(record.coinAmount ?? 0, f("coinAmount"));
  const diamondAmount = toIntegerMinorUnits(record.diamondAmount ?? 0, f("diamondAmount"));
  const amountInr = toIntegerMinorUnits(record.amountInr, f("amountInr"));
  const currency = toEnum(record.currency ?? "INR", ["INR"] as const, f("currency"));
  const metadata = jsonMetadata(record.metadata, f("metadata"));
  const critical = [sourceId, userId, provider, status, packId, assetCurrency, coinAmount, diamondAmount, amountInr, currency, metadata];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    provider: provider ?? null,
    status: status ?? null,
    pack_id: packId ?? null,
    asset_currency: assetCurrency ?? null,
    coin_amount: coinAmount ?? null,
    diamond_amount: diamondAmount ?? null,
    amount_inr: amountInr ?? null,
    currency: currency ?? null,
    provider_order_id: optString(record.providerOrderId, f("providerOrderId")),
    provider_payment_id: optString(record.providerPaymentId, f("providerPaymentId")),
    provider_signature: optString(record.providerSignature, f("providerSignature")),
    product_id: optString(record.productId, f("productId")),
    purchase_token: optString(record.purchaseToken, f("purchaseToken")),
    google_order_id: optString(record.googleOrderId, f("googleOrderId")),
    credited_transaction_id: optReference(record.creditedTransactionId, f("creditedTransactionId")),
    credited_diamond_transaction_id: optReference(record.creditedDiamondTransactionId, f("creditedDiamondTransactionId")),
    refund_transaction_id: optReference(record.refundTransactionId, f("refundTransactionId")),
    refund_provider_id: optString(record.refundProviderId, f("refundProviderId")),
    refunded_at: optDate(record.refundedAt, f("refundedAt")),
    metadata: metadata ?? null,
    credited_at: optDate(record.creditedAt, f("creditedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapGiftTransaction(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "gift_transactions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const senderId = toSourceId(record.senderId, f("senderId"));
  const receiverId = toSourceId(record.receiverId, f("receiverId"));
  const giftId = toSourceId(record.giftId, f("giftId"));
  const coinAmount = toIntegerMinorUnits(record.coinAmount ?? 0, f("coinAmount"));
  const diamondAmount = toIntegerMinorUnits(record.diamondAmount ?? 0, f("diamondAmount"));
  const currency = toEnum(record.currency ?? "COINS", CURRENCIES, f("currency"));
  const type = toEnum(record.type ?? "send", GIFT_TYPES, f("type"));
  const comboCount = toInteger(record.comboCount ?? 1, f("comboCount"), { min: 1 });
  const totalValue = toIntegerMinorUnits(record.totalValue ?? 0, f("totalValue"));
  const effect = optString(record.effect ?? "", f("effect")) ?? "";
  const metadata = jsonMetadata(record.metadata, f("metadata"));
  const critical = [sourceId, senderId, receiverId, giftId, coinAmount, diamondAmount, currency, type, comboCount, totalValue, effect, metadata];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: optReference(record.roomId, f("roomId")),
    sender_id: senderId ?? null,
    receiver_id: receiverId ?? null,
    gift_id: giftId ?? null,
    coin_amount: coinAmount ?? null,
    diamond_amount: diamondAmount ?? null,
    currency: currency ?? null,
    type: type ?? null,
    combo_count: comboCount ?? null,
    total_value: totalValue ?? null,
    effect: effect ?? null,
    metadata: metadata ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapWithdrawalRequest(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "withdrawal_requests";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const amountCoins = toIntegerMinorUnits(record.amountCoins, f("amountCoins"));
  const amountInr = optInteger(record.amountInr, f("amountInr"), { min: 0 });
  const status = toEnum(record.status ?? "PENDING_REVIEW", WITHDRAWAL_STATUSES, f("status"));
  const activeLock = toBoolean(record.activeLock ?? false, f("activeLock"));
  const metadata = jsonMetadata(record.metadata, f("metadata"));
  const critical = [sourceId, userId, amountCoins, status, activeLock, metadata];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    amount_coins: amountCoins ?? null,
    amount_inr: amountInr,
    status: status ?? null,
    active_lock: activeLock ?? null,
    locked_at: optDate(record.lockedAt, f("lockedAt")),
    approved_at: optDate(record.approvedAt, f("approvedAt")),
    rejected_at: optDate(record.rejectedAt, f("rejectedAt")),
    paid_at: optDate(record.paidAt, f("paidAt")),
    reviewed_by_admin_id: optReference(record.reviewedByAdminId, f("reviewedByAdminId")),
    rejection_reason: optString(record.rejectionReason, f("rejectionReason")),
    payout_reference: optString(record.payoutReference, f("payoutReference")),
    metadata: metadata ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapSubscription(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "subscriptions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const subscriberId = toSourceId(record.subscriberId, f("subscriberId"));
  const creatorId = toSourceId(record.creatorId, f("creatorId"));
  const plan = toEnum(record.plan, SUBSCRIPTION_PLANS, f("plan"));
  const coinAmount = toIntegerMinorUnits(record.coinAmount, f("coinAmount"));
  const active = toBoolean(record.active ?? true, f("active"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  const autoRenewing = toBoolean(record.autoRenewing ?? false, f("autoRenewing"));
  const status = toEnum(record.status ?? "ACTIVE", SUBSCRIPTION_STATUSES, f("status"));
  const creatorCoinAmount = toIntegerMinorUnits(record.creatorCoinAmount ?? 0, f("creatorCoinAmount"));
  const platformFeeCoins = toIntegerMinorUnits(record.platformFeeCoins ?? 0, f("platformFeeCoins"));
  const renewalCount = toInteger(record.renewalCount ?? 0, f("renewalCount"), { min: 0 });
  const critical = [sourceId, subscriberId, creatorId, plan, coinAmount, active, expiresAt, autoRenewing, status, creatorCoinAmount, platformFeeCoins, renewalCount];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    subscriber_id: subscriberId ?? null,
    creator_id: creatorId ?? null,
    plan: plan ?? null,
    coin_amount: coinAmount ?? null,
    active: active ?? null,
    expires_at: expiresAt ?? null,
    provider: optEnum(record.provider, SUBSCRIPTION_PROVIDERS, f("provider")),
    provider_purchase_token: optString(record.providerPurchaseToken, f("providerPurchaseToken")),
    provider_order_id: optString(record.providerOrderId, f("providerOrderId")),
    auto_renewing: autoRenewing ?? null,
    status: status ?? null,
    last_verified_at: optDate(record.lastVerifiedAt, f("lastVerifiedAt")),
    last_credited_expiry: optDate(record.lastCreditedExpiry, f("lastCreditedExpiry")),
    creator_coin_amount: creatorCoinAmount ?? null,
    platform_fee_coins: platformFeeCoins ?? null,
    renewal_count: renewalCount ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapAssetObject(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "assets";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toOpaqueId(record._id, f("_id"));
  const ownerType = toEnum(record.ownerType, ASSET_OWNER_TYPES, f("ownerType"));
  const ownerId = toRequiredString(record.ownerId, f("ownerId"));
  const kind = toEnum(record.kind ?? "IMAGE", ["IMAGE"] as const, f("kind"));
  const status = toEnum(record.status ?? "staging", ASSET_STATUSES, f("status"));
  const version = toInteger(record.version, f("version"), { min: 1 });
  const originalName = toRequiredString(record.originalName, f("originalName"));
  const mimeType = toRequiredString(record.mimeType, f("mimeType"));
  const bytes = toInteger(record.bytes, f("bytes"), { min: 1 });
  const width = toInteger(record.width, f("width"), { min: 1 });
  const height = toInteger(record.height, f("height"), { min: 1 });
  const sha256 = toRequiredString(record.sha256, f("sha256"));
  const stagingKey = toRequiredString(record.stagingKey, f("stagingKey"));
  const stagingUrl = toRequiredString(record.stagingUrl, f("stagingUrl"));
  const createdBy = toRequiredString(record.createdBy, f("createdBy"));
  const critical = [sourceId, ownerType, ownerId, kind, status, version, originalName, mimeType, bytes, width, height, sha256, stagingKey, stagingUrl, createdBy];
  const row: TargetRow = {
    source_id: sourceId ?? null,
    owner_type: ownerType ?? null,
    owner_id: ownerId ?? null,
    kind: kind ?? null,
    status: status ?? null,
    version: version ?? null,
    original_name: originalName ?? null,
    mime_type: mimeType ?? null,
    bytes: bytes ?? null,
    width: width ?? null,
    height: height ?? null,
    sha256: sha256 ?? null,
    staging_key: stagingKey ?? null,
    staging_url: stagingUrl ?? null,
    public_key: optString(record.publicKey, f("publicKey")),
    public_url: optString(record.publicUrl, f("publicUrl")),
    created_by: createdBy ?? null,
    published_at: optDate(record.publishedAt, f("publishedAt")),
    archived_at: optDate(record.archivedAt, f("archivedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  if (rejected(critical)) return { writes: [], rejected: true };
  context.keep(collection);
  return {
    writes: [
      { table: collection, rows: [row] },
      childRows({
        collection, table: "asset_variants", parentTable: "assets", parentId: sourceId,
        fieldName: "variants", elements: record.variants, context,
        build: (element, f) => {
          const name = toRequiredString(element.name, { ...f, field: "variants.name" });
          const key = toRequiredString(element.key, { ...f, field: "variants.key" });
          // Published asset URLs are provenance, not signed delivery URLs; never persist signed URLs.
          const url = toRequiredString(element.url, { ...f, field: "variants.url" });
          const contentType = toRequiredString(element.contentType, { ...f, field: "variants.contentType" });
          const variantBytes = toInteger(element.bytes, { ...f, field: "variants.bytes" }, { min: 0 });
          if (!name || !key || !url || !contentType || variantBytes === undefined) return undefined;
          return {
            name, key, url, content_type: contentType, bytes: variantBytes,
            width: optInteger(element.width, { ...f, field: "variants.width" }, { min: 0 }),
            height: optInteger(element.height, { ...f, field: "variants.height" }, { min: 0 })
          };
        }
      })
    ],
    rejected: false
  };
}

const FRIENDSHIP_STATUSES = ["PENDING", "ACCEPTED", "BLOCKED"] as const;
const CLAN_PRIVACY = ["PUBLIC", "PRIVATE"] as const;
const CLAN_ROLES_LOCAL = ["LEADER", "CO_LEADER", "OFFICER", "MEMBER"] as const;
const DM_MEDIA_TYPES = ["", "IMAGE", "VIDEO", "AUDIO"] as const;
const DM_REACTION_TYPES = ["heart", "fire", "laugh", "clap", "wow", "crown", "stars", "party"] as const;
const CHAT_MESSAGE_TYPES = ["TEXT", "SYSTEM", "GIFT", "REACTION"] as const;
const STORY_MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO"] as const;
const STORY_STATUSES = ["ACTIVE", "EXPIRED", "HIDDEN"] as const;

/** Soft child/nested failures are reported but never reject their parent row. */
function softField(collection: string, name: string, rowId: string | undefined, context: TransformContext): TransformField {
  return { ...field(collection, name, rowId ?? "<unknown>", context), soft: true };
}

function softString(value: unknown, fallback: string, f: TransformField): string {
  return optString(value, f) ?? fallback;
}

function softReference(value: unknown, f: TransformField): string | null {
  if (value === undefined || value === null) return null;
  return toSourceId(value, f) ?? null;
}

/** Canonical ObjectId list for a JSON TEXT column; bad entries are soft-quarantined. */
function canonicalIdList(value: unknown, collection: string, name: string, rowId: string | undefined, context: TransformContext): string {
  const elements = Array.isArray(value) ? value : [];
  if (value !== undefined && value !== null && !Array.isArray(value)) {
    context.reject(softField(collection, name, rowId, context), "INVALID_REFERENCE", "expected an array");
  }
  const ids = elements
    .map((element, index) => toSourceId(element, softField(collection, `${name}[${index}]`, rowId, context)))
    .filter((id): id is string => typeof id === "string");
  return stableStringify(ids);
}

function mapFriendship(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "friendships";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const friendId = toSourceId(record.friendId, f("friendId"));
  const status = toEnum(record.status ?? "PENDING", FRIENDSHIP_STATUSES, f("status"));
  if (rejected([sourceId, userId, friendId, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    friend_id: friendId ?? null,
    status: status ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapBlock(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "blocks";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const blockerId = toSourceId(record.blockerId, f("blockerId"));
  const blockedUserId = toSourceId(record.blockedUserId, f("blockedUserId"));
  if (rejected([sourceId, blockerId, blockedUserId])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    blocker_id: blockerId ?? null,
    blocked_user_id: blockedUserId ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapFollow(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "follows";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const followerId = toSourceId(record.followerId, f("followerId"));
  const followingId = toSourceId(record.followingId, f("followingId"));
  if (rejected([sourceId, followerId, followingId])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    follower_id: followerId ?? null,
    following_id: followingId ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapClan(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "clans";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const ownerId = toSourceId(record.ownerId, f("ownerId"));
  const name = toRequiredString(record.name, f("name"));
  const slug = toRequiredString(record.slug, f("slug"));
  const privacy = toEnum(record.privacy ?? "PUBLIC", CLAN_PRIVACY, f("privacy"));
  const familyLabel = toRequiredString(record.familyLabel ?? "Family", f("familyLabel"));
  const memberCount = toInteger(record.memberCount ?? 1, f("memberCount"), { min: 0 });
  // These columns are JSON TEXT in the current draft; the triage proposal would
  // normalize them into child tables after owner approval.
  const memberIds = canonicalIdList(record.memberIds, collection, "memberIds", sourceId, context);
  const roles = Array.isArray(record.memberRoles) ? record.memberRoles : [];
  if (record.memberRoles !== undefined && record.memberRoles !== null && !Array.isArray(record.memberRoles)) {
    context.reject(softField(collection, "memberRoles", sourceId, context), "INVALID_REFERENCE", "expected an array");
  }
  const memberRoles = stableStringify(roles.flatMap((element, index) => {
    const nested = softField(collection, `memberRoles[${index}]`, sourceId, context);
    const raw = element !== null && typeof element === "object" ? element as Record<string, unknown> : {};
    const userId = toSourceId(raw.userId, { ...nested, field: "memberRoles.userId" });
    const role = toEnum(raw.role ?? "MEMBER", CLAN_ROLES_LOCAL, { ...nested, field: "memberRoles.role" });
    return userId && role ? [{ userId, role }] : [];
  }));
  const critical = [sourceId, ownerId, name, slug, privacy, familyLabel, memberCount, memberIds, memberRoles];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    owner_id: ownerId ?? null,
    name: name ?? null,
    slug: slug ?? null,
    description: optString(record.description, f("description")),
    avatar: optString(record.avatar, f("avatar")),
    privacy: privacy ?? null,
    family_label: familyLabel ?? null,
    member_ids: memberIds,
    member_roles: memberRoles,
    member_count: memberCount ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapDirectMessage(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "direct_messages";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const senderId = toSourceId(record.senderId, f("senderId"));
  const receiverId = toSourceId(record.receiverId, f("receiverId"));
  const message = toRequiredString(record.message, f("message"));
  const mediaUrl = optString(record.mediaUrl ?? "", f("mediaUrl")) ?? "";
  const mediaType = toEnum(record.mediaType ?? "", DM_MEDIA_TYPES, f("mediaType"));
  const duration = toInteger(record.duration ?? 0, f("duration"), { min: 0 });
  const forwarded = toBoolean(record.forwarded ?? false, f("forwarded"));
  const isEdited = toBoolean(record.isEdited ?? false, f("isEdited"));
  const read = toBoolean(record.read ?? false, f("read"));
  // replyTo is promoted to columns per the approved triage.
  let replyToMessageId: string | null = null;
  let replyToAuthor = "";
  let replyToAuthorId: string | null = null;
  let replyToText = "";
  let replyToMediaUrl = "";
  if (record.replyTo !== undefined && record.replyTo !== null) {
    const raw = record.replyTo as Record<string, unknown>;
    const nested = (name: string) => softField(collection, `replyTo.${name}`, sourceId, context);
    const messageId = softReference(raw.messageId, nested("messageId"));
    if (messageId) {
      replyToMessageId = messageId;
      replyToAuthor = softString(raw.author, "", nested("author"));
      replyToAuthorId = softReference(raw.authorId, nested("authorId"));
      replyToText = softString(raw.text, "", nested("text"));
      replyToMediaUrl = softString(raw.mediaUrl, "", nested("mediaUrl"));
    }
  }
  const critical = [sourceId, senderId, receiverId, message, mediaUrl, mediaType, duration, forwarded, isEdited, read];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    sender_id: senderId ?? null,
    receiver_id: receiverId ?? null,
    room_id: optReference(record.roomId, f("roomId")),
    message: message ?? null,
    media_url: mediaUrl ?? null,
    media_type: mediaType ?? null,
    duration: duration ?? null,
    reply_to_message_id: replyToMessageId,
    reply_to_author: replyToAuthor,
    reply_to_author_id: replyToAuthorId,
    reply_to_text: replyToText,
    reply_to_media_url: replyToMediaUrl,
    forwarded: forwarded ?? null,
    is_edited: isEdited ?? null,
    edited_at: optDate(record.editedAt, f("editedAt")),
    read: read ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  const writes: TargetWrite[] = [
    { table: collection, rows: [row] },
    childRows({
      collection, table: "message_hidden_for", parentTable: "direct_messages", parentId: sourceId,
      fieldName: "hiddenFor", elements: record.hiddenFor, context,
      build: (element, f) => {
        const userId = toSourceId(element.value, f);
        return userId ? { value: userId } : undefined;
      }
    }),
    childRows({
      collection, table: "direct_message_reactions", parentTable: "direct_messages", parentId: sourceId,
      fieldName: "reactions", elements: record.reactions, context,
      build: (element, f) => {
        const userId = toSourceId(element.userId, { ...f, field: "reactions.userId" });
        const type = toEnum(element.type, DM_REACTION_TYPES, { ...f, field: "reactions.type" });
        const createdAt = toUtcIso(element.createdAt, { ...f, field: "reactions.createdAt" });
        if (!userId || !type || !createdAt) return undefined;
        return { user_id: userId, type, created_at: createdAt };
      }
    })
  ];
  context.keep(collection);
  return { writes, rejected: false };
}

function mapChatMessage(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "chat_messages";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const senderId = toSourceId(record.senderId, f("senderId"));
  const message = toRequiredString(record.message, f("message"));
  const type = toEnum(record.type ?? "TEXT", CHAT_MESSAGE_TYPES, f("type"));
  if (rejected([sourceId, roomId, senderId, message, type])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    sender_id: senderId ?? null,
    message: message ?? null,
    type: type ?? null,
    media_url: optString(record.mediaUrl, f("mediaUrl")),
    media_type: optEnum(record.mediaType, ["IMAGE"] as const, f("mediaType")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapConversationMute(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "conversation_mutes";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const ownerId = toSourceId(record.ownerId, f("ownerId"));
  const partnerId = toSourceId(record.partnerId, f("partnerId"));
  const muted = toBoolean(record.muted ?? true, f("muted"));
  const updatedAt = toUtcIso(record.updatedAt, f("updatedAt"));
  if (rejected([sourceId, ownerId, partnerId, muted, updatedAt])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    owner_id: ownerId ?? null,
    partner_id: partnerId ?? null,
    muted: muted ?? null,
    updated_at: updatedAt ?? null
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapStory(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "stories";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const mediaUrl = toRequiredString(record.mediaUrl, f("mediaUrl"));
  const mediaType = toEnum(record.mediaType, STORY_MEDIA_TYPES, f("mediaType"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  const status = toEnum(record.status ?? "ACTIVE", STORY_STATUSES, f("status"));
  const likeCount = toInteger(record.likeCount ?? 0, f("likeCount"), { min: 0 });
  const replyCount = toInteger(record.replyCount ?? 0, f("replyCount"), { min: 0 });
  if (rejected([sourceId, userId, mediaUrl, mediaType, expiresAt, status, likeCount, replyCount])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    media_url: mediaUrl ?? null,
    media_type: mediaType ?? null,
    caption: optString(record.caption, f("caption")),
    background_color: optString(record.backgroundColor, f("backgroundColor")),
    text_color: optString(record.textColor, f("textColor")),
    font: optString(record.font, f("font")),
    sticker: optString(record.sticker, f("sticker")),
    link_url: optString(record.linkUrl, f("linkUrl")),
    duration: optInteger(record.duration, f("duration"), { min: 1, max: 300 }),
    transcript: optString(record.transcript, f("transcript")),
    like_count: likeCount ?? null,
    reply_count: replyCount ?? null,
    expires_at: expiresAt ?? null,
    status: status ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  const writes: TargetWrite[] = [
    { table: collection, rows: [row] },
    childRows({
      collection, table: "story_views", parentTable: "stories", parentId: sourceId,
      fieldName: "viewedBy", elements: record.viewedBy, context,
      build: (element, f) => {
        const userId = toSourceId(element.value, f);
        return userId ? { value: userId } : undefined;
      }
    })
  ];
  context.keep(collection);
  return { writes, rejected: false };
}

function mapStoryHighlight(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "story_highlights";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const title = toRequiredString(record.title, f("title"));
  const elements = Array.isArray(record.storyIds) ? record.storyIds : [];
  if (record.storyIds !== undefined && record.storyIds !== null && !Array.isArray(record.storyIds)) {
    context.reject(softField(collection, "storyIds", sourceId, context), "INVALID_REFERENCE", "expected an array");
  }
  const stories = childRows({
    collection, table: "story_highlight_stories", parentTable: "story_highlights", parentId: sourceId,
    fieldName: "storyIds", elements, context,
    build: (raw, f) => {
      const value = toSourceId(raw.value, f);
      return value ? { value } : undefined;
    }
  });
  if (rejected([sourceId, userId, title])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    title: title ?? null,
    cover_media_url: optString(record.coverMediaUrl, f("coverMediaUrl")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, stories], rejected: false };
}

const ROOM_TYPES = ["VOICE", "VIDEO"] as const;
const ROOM_STATUSES = ["LIVE", "ENDED", "SCHEDULED"] as const;
const ROOM_VISIBILITIES = ["PUBLIC", "PRIVATE"] as const;
const ROOM_MODES = ["coffee_date", "blind_date", "truth_or_dare", "never_have_i_ever", "would_you_rather"] as const;
const ROOM_PARTICIPANT_ROLES = ["HOST", "SPEAKER", "AUDIENCE", "MODERATOR"] as const;
const INVITE_STATUSES = ["PENDING", "ACCEPTED", "DECLINED"] as const;
const ROOM_MODE_STATUSES = ["WAITING", "ACTIVE", "ROUND_END", "FINISHED"] as const;
const REACTION_ASSET_KINDS = ["STATIC", "ANIMATED"] as const;
const REACTION_ACCESSES = ["EVERYONE", "VIP_EXCLUSIVE"] as const;
const RECORDING_STATUSES = ["PROCESSING", "PUBLISHED", "FAILED"] as const;

function canonicalStringList(value: unknown, collection: string, name: string, rowId: string | undefined, context: TransformContext): string {
  const elements = Array.isArray(value) ? value : [];
  if (value !== undefined && value !== null && !Array.isArray(value)) {
    context.reject(softField(collection, name, rowId, context), "INVALID_REFERENCE", "expected an array");
  }
  const strings = elements
    .map((element, index) => toRequiredString(element, softField(collection, `${name}[${index}]`, rowId, context)))
    .filter((item): item is string => typeof item === "string");
  return stableStringify(strings);
}

function canonicalIntegerList(
  value: unknown, collection: string, name: string, rowId: string | undefined,
  context: TransformContext, options: { min?: number; max?: number } = {}
): string {
  const elements = Array.isArray(value) ? value : [];
  if (value !== undefined && value !== null && !Array.isArray(value)) {
    context.reject(softField(collection, name, rowId, context), "INVALID_REFERENCE", "expected an array");
  }
  const integers = elements
    .map((element, index) => toInteger(element, softField(collection, `${name}[${index}]`, rowId, context), options))
    .filter((item): item is number => typeof item === "number");
  return stableStringify(integers);
}

/** Map<string, number> exported as a JS Map or plain object -> deterministic JSON. */
function canonicalScoreMap(value: unknown, collection: string, name: string, rowId: string | undefined, context: TransformContext): string {
  let source: Record<string, unknown> = {};
  if (value instanceof Map) {
    source = Object.fromEntries([...value.entries()].map(([key, entry]) => [String(key), entry]));
  } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    source = value as Record<string, unknown>;
  } else if (value !== undefined && value !== null) {
    context.reject(softField(collection, name, rowId, context), "INVALID_REFERENCE", "expected a Map or object");
  }
  const scores: Record<string, number> = {};
  for (const [key, raw] of Object.entries(source)) {
    const score = toInteger(raw, softField(collection, `${name}.${key}`, rowId, context));
    if (score !== undefined) scores[key] = score;
  }
  return stableStringify(scores);
}

function mapRoom(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "rooms";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const title = toRequiredString(record.title, f("title"));
  const type = toEnum(record.type, ROOM_TYPES, f("type"));
  const hostId = toSourceId(record.hostId, f("hostId"));
  const category = toRequiredString(record.category, f("category"));
  const language = toRequiredString(record.language, f("language"));
  const status = toEnum(record.status ?? "LIVE", ROOM_STATUSES, f("status"));
  const visibility = toEnum(record.visibility ?? "PUBLIC", ROOM_VISIBILITIES, f("visibility"));
  const maxSpeakers = toInteger(record.maxSpeakers ?? 8, f("maxSpeakers"), { min: 0 });
  const participantCount = toInteger(record.participantCount ?? 0, f("participantCount"), { min: 0 });
  const isDuet = toBoolean(record.isDuet ?? false, f("isDuet"));
  const livekitRoomName = toRequiredString(record.livekitRoomName, f("livekitRoomName"));
  const allowAudienceMicRequests = toBoolean(record.allowAudienceMicRequests ?? true, f("allowAudienceMicRequests"));
  const micLocked = toBoolean(record.micLocked ?? false, f("micLocked"));
  const vipOnly = toBoolean(record.vipOnly ?? false, f("vipOnly"));
  // JSON TEXT in the current draft; triage proposes child tables for the ID arrays.
  const tags = canonicalStringList(record.tags, collection, "tags", sourceId, context);
  const speakerIds = canonicalIdList(record.speakerIds, collection, "speakerIds", sourceId, context);
  const moderatorIds = canonicalIdList(record.moderatorIds, collection, "moderatorIds", sourceId, context);
  const roomAdminIds = canonicalIdList(record.roomAdminIds, collection, "roomAdminIds", sourceId, context);
  const coHostIds = canonicalIdList(record.coHostIds, collection, "coHostIds", sourceId, context);
  const lockedSeatIndices = canonicalIntegerList(record.lockedSeatIndices, collection, "lockedSeatIndices", sourceId, context, { min: 0 });
  const critical = [sourceId, title, type, hostId, category, language, status, visibility, maxSpeakers,
    participantCount, isDuet, livekitRoomName, allowAudienceMicRequests, micLocked, vipOnly,
    tags, speakerIds, moderatorIds, roomAdminIds, coHostIds, lockedSeatIndices];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    title: title ?? null,
    description: optString(record.description, f("description")),
    type: type ?? null,
    host_id: hostId ?? null,
    cover_image: optString(record.coverImage, f("coverImage")),
    category: category ?? null,
    tags,
    language: language ?? null,
    status: status ?? null,
    visibility: visibility ?? null,
    max_speakers: maxSpeakers ?? null,
    participant_count: participantCount ?? null,
    speaker_ids: speakerIds,
    moderator_ids: moderatorIds,
    room_admin_ids: roomAdminIds,
    active_pk_id: optReference(record.activePkId, f("activePkId")),
    co_host_ids: coHostIds,
    is_duet: isDuet ?? null,
    livekit_room_name: livekitRoomName ?? null,
    allow_audience_mic_requests: allowAudienceMicRequests ?? null,
    mic_locked: micLocked ?? null,
    locked_seat_indices: lockedSeatIndices,
    theme: optString(record.theme, f("theme")),
    vip_only: vipOnly ?? null,
    badge: optString(record.badge, f("badge")),
    ambience: optString(record.ambience, f("ambience")),
    scheduled_for: optDate(record.scheduledFor, f("scheduledFor")),
    started_at: optDate(record.startedAt, f("startedAt")),
    ended_at: optDate(record.endedAt, f("endedAt")),
    mode: optEnum(record.mode, ROOM_MODES, f("mode")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapRoomParticipant(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "room_participants";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const userId = toSourceId(record.userId, f("userId"));
  const role = toEnum(record.role ?? "AUDIENCE", ROOM_PARTICIPANT_ROLES, f("role"));
  const micEnabled = toBoolean(record.micEnabled ?? true, f("micEnabled"));
  const moderatorMuted = toBoolean(record.moderatorMuted ?? false, f("moderatorMuted"));
  const cameraEnabled = toBoolean(record.cameraEnabled ?? true, f("cameraEnabled"));
  const joinedAt = toUtcIso(record.joinedAt, f("joinedAt"));
  if (rejected([sourceId, roomId, userId, role, micEnabled, moderatorMuted, cameraEnabled, joinedAt])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    user_id: userId ?? null,
    role: role ?? null,
    mic_enabled: micEnabled ?? null,
    moderator_muted: moderatorMuted ?? null,
    seat_index: optInteger(record.seatIndex, f("seatIndex"), { min: 0 }),
    camera_enabled: cameraEnabled ?? null,
    joined_at: joinedAt ?? null,
    left_at: optDate(record.leftAt, f("leftAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapRoomInvite(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "room_invites";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const inviterId = toSourceId(record.inviterId, f("inviterId"));
  const inviteeId = toSourceId(record.inviteeId, f("inviteeId"));
  const status = toEnum(record.status ?? "PENDING", INVITE_STATUSES, f("status"));
  if (rejected([sourceId, roomId, inviterId, inviteeId, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    inviter_id: inviterId ?? null,
    invitee_id: inviteeId ?? null,
    status: status ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapRoomFollow(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "room_follows";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const userId = toSourceId(record.userId, f("userId"));
  if (rejected([sourceId, roomId, userId])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    user_id: userId ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapRoomModeState(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "room_mode_states";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const mode = toEnum(record.mode, ROOM_MODES, f("mode"));
  const round = toInteger(record.round ?? 1, f("round"), { min: 1 });
  const status = toEnum(record.status ?? "WAITING", ROOM_MODE_STATUSES, f("status"));
  // Mongoose Map wildcard paths are suppressed by the generator, so the canonical
  // JSON column is the only "scores" column in the draft.
  const scores = canonicalScoreMap(record.scores, collection, "scores", sourceId, context);
  const currentOptions = canonicalStringList(record.currentOptions, collection, "currentOptions", sourceId, context);
  const metadata = jsonMetadata(record.metadata, f("metadata"));
  const critical = [sourceId, roomId, mode, round, status, scores, currentOptions, metadata];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    mode: mode ?? null,
    round: round ?? null,
    status: status ?? null,
    scores,
    current_turn_user_id: optReference(record.currentTurnUserId, f("currentTurnUserId")),
    current_question: optString(record.currentQuestion, f("currentQuestion")),
    current_options: currentOptions,
    round_start_time: optDate(record.roundStartTime, f("roundStartTime")),
    round_end_time: optDate(record.roundEndTime, f("roundEndTime")),
    metadata,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  const writes: TargetWrite[] = [
    { table: collection, rows: [row] },
    childRows({
      collection, table: "room_mode_participants", parentTable: "room_mode_states", parentId: sourceId,
      fieldName: "participants", elements: record.participants, context,
      build: (element, f) => {
        const userId = toSourceId(element.value, f);
        return userId ? { value: userId } : undefined;
      }
    })
  ];
  context.keep(collection);
  return { writes, rejected: false };
}

function mapRoomReaction(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "room_reactions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toOpaqueId(record._id, f("_id"));
  const label = toRequiredString(record.label, f("label"));
  const emoji = optString(record.emoji ?? "", f("emoji")) ?? "";
  const assetKind = toEnum(record.assetKind ?? "STATIC", REACTION_ASSET_KINDS, f("assetKind"));
  const access = toEnum(record.access ?? "EVERYONE", REACTION_ACCESSES, f("access"));
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  const sortOrder = toInteger(record.sortOrder ?? 0, f("sortOrder"));
  if (rejected([sourceId, label, emoji, assetKind, access, isActive, sortOrder])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    label: label ?? null,
    emoji,
    asset_url: optString(record.assetUrl, f("assetUrl")),
    asset_storage_key: optString(record.assetStorageKey, f("assetStorageKey")),
    asset_kind: assetKind ?? null,
    mime_type: optString(record.mimeType, f("mimeType")),
    access: access ?? null,
    is_active: isActive ?? null,
    sort_order: sortOrder ?? null,
    created_by: optReference(record.createdBy, f("createdBy")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapRoomActivity(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "room_activities";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const type = toRequiredString(record.type, f("type"));
  const label = toRequiredString(record.label, f("label"));
  const metadata = jsonMetadata(record.metadata, f("metadata"));
  if (rejected([sourceId, roomId, type, label, metadata])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    user_id: optReference(record.userId, f("userId")),
    type: type ?? null,
    label: label ?? null,
    metadata,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapRoomRecording(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "room_recordings";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const hostId = toSourceId(record.hostId, f("hostId"));
  const title = toRequiredString(record.title, f("title"));
  const recordingUrl = toRequiredString(record.recordingUrl, f("recordingUrl"));
  const duration = toInteger(record.duration ?? 0, f("duration"), { min: 0 });
  const viewCount = toInteger(record.viewCount ?? 0, f("viewCount"), { min: 0 });
  const status = toEnum(record.status ?? "PROCESSING", RECORDING_STATUSES, f("status"));
  if (rejected([sourceId, roomId, hostId, title, recordingUrl, duration, viewCount, status])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    host_id: hostId ?? null,
    title: title ?? null,
    recording_url: recordingUrl ?? null,
    duration: duration ?? null,
    view_count: viewCount ?? null,
    status: status ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapSpeakerRequest(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "speaker_requests";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const userId = toSourceId(record.userId, f("userId"));
  const status = toEnum(record.status ?? "PENDING", INVITE_STATUSES, f("status"));
  if (rejected([sourceId, roomId, userId, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    user_id: userId ?? null,
    status: status ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPoll(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "polls";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const createdBy = toSourceId(record.createdBy, f("createdBy"));
  const question = toRequiredString(record.question, f("question"));
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  const elements = Array.isArray(record.options) ? record.options : [];
  if (record.options !== undefined && record.options !== null && !Array.isArray(record.options)) {
    context.reject(softField(collection, "options", sourceId, context), "INVALID_REFERENCE", "expected an array");
  }
  const optionRows = childRows({
    collection, table: "poll_options", parentTable: "polls", parentId: sourceId,
    fieldName: "options", elements, context,
    build: (raw, f) => {
      const text = toRequiredString(raw.text, { ...f, field: "options.text" });
      const votes = toInteger(raw.votes ?? 0, { ...f, field: "options.votes" }, { min: 0 });
      if (!text || votes === undefined) return undefined;
      return { text, votes };
    }
  });
  const critical = [sourceId, roomId, createdBy, question, isActive];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    created_by: createdBy ?? null,
    question: question ?? null,
    is_active: isActive ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  const writes: TargetWrite[] = [
    { table: collection, rows: [row] },
    optionRows,
    childRows({
      collection, table: "poll_votes", parentTable: "polls", parentId: sourceId,
      fieldName: "voters", elements: record.voters, context,
      build: (element, f) => {
        const userId = toSourceId(element.value, f);
        return userId ? { value: userId } : undefined;
      }
    })
  ];
  context.keep(collection);
  return { writes, rejected: false };
}

function mapVoicePoll(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "voice_polls";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const question = toRequiredString(record.question, f("question"));
  const audioUrl = optString(record.audioUrl ?? "", f("audioUrl")) ?? "";
  const duration = toInteger(record.duration ?? 0, f("duration"), { min: 0 });
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  const elements = Array.isArray(record.options) ? record.options : [];
  if (record.options !== undefined && record.options !== null && !Array.isArray(record.options)) {
    context.reject(softField(collection, "options", sourceId, context), "INVALID_REFERENCE", "expected an array");
  }
  const optionRows = childRows({
    collection, table: "voice_poll_options", parentTable: "voice_polls", parentId: sourceId,
    fieldName: "options", elements, context,
    build: (raw, f) => {
      const text = toRequiredString(raw.text, { ...f, field: "options.text" });
      const votes = toInteger(raw.votes ?? 0, { ...f, field: "options.votes" }, { min: 0 });
      if (!text || votes === undefined) return undefined;
      const audio = softString(raw.audioUrl, "", { ...f, field: "options.audioUrl" });
      return { text, audio_url: audio, votes };
    }
  });
  const critical = [sourceId, userId, question, audioUrl, duration, isActive];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    question: question ?? null,
    audio_url: audioUrl,
    duration: duration ?? null,
    is_active: isActive ?? null,
    expires_at: optDate(record.expiresAt, f("expiresAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  const writes: TargetWrite[] = [
    { table: collection, rows: [row] },
    optionRows,
    childRows({
      collection, table: "voice_poll_votes", parentTable: "voice_polls", parentId: sourceId,
      fieldName: "voters", elements: record.voters, context,
      build: (element, f) => {
        const userId = toSourceId(element.value, f);
        return userId ? { value: userId } : undefined;
      }
    }),
    childRows({
      collection, table: "voice_poll_ballots", parentTable: "voice_polls", parentId: sourceId,
      fieldName: "ballots", elements: record.ballots, context,
      build: (element, f) => {
        const userId = toSourceId(element.userId, { ...f, field: "ballots.userId" });
        const optionIndex = toInteger(element.optionIndex, { ...f, field: "ballots.optionIndex" }, { min: 0 });
        if (!userId || optionIndex === undefined) return undefined;
        return { user_id: userId, option_index: optionIndex };
      }
    })
  ];
  context.keep(collection);
  return { writes, rejected: false };
}

const ACHIEVEMENT_CATEGORIES = ["SOCIAL", "CONTENT", "ENGAGEMENT", "LOYALTY", "MISC"] as const;
const ACHIEVEMENT_KINDS = ["ACHIEVEMENT", "HONOR"] as const;
const BADGE_TIERS = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER"] as const;
const BADGE_METRICS = [
  "profile_complete", "daily_streak_3", "follow_10", "host_3", "gift_5", "chat_25",
  "level_5", "room_join_10", "game_plays_10", "gift_received_5"
] as const;
const BATTLE_PASS_TIERS = ["free", "premium"] as const;
const MISSION_TYPES = ["daily", "weekly", "monthly", "seasonal"] as const;
const MINI_GAME_IDS = ["vibe_tap", "memory_match", "reflex_ring"] as const;
const COSMETIC_RARITIES = ["COMMON", "RARE", "EPIC", "LEGENDARY"] as const;
const THEME_TYPES = ["room_background", "profile_theme", "entrance_effect", "border"] as const;
const GIFT_INVENTORY_SOURCES = ["purchased", "received", "reward", "mystery", "upgrade", "trade"] as const;

/** Nested object helper for promoted/collapsed embedded documents. */
function embedded(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

/** Mixed/JSON column that preserves explicit null instead of substituting {}. */
function jsonOrNull(value: unknown, f: TransformField): string | null {
  if (value === undefined || value === null) return null;
  return toRequiredString(stableStringify(value), f) ?? null;
}

function mapAchievement(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "achievements";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const badgeId = toRequiredString(record.id, f("id"));
  const title = toRequiredString(record.title, f("title"));
  const description = toRequiredString(record.description, f("description"));
  const category = toEnum(record.category ?? "MISC", ACHIEVEMENT_CATEGORIES, f("category"));
  const icon = toRequiredString(record.icon ?? "trophy", f("icon"));
  const kind = toEnum(record.kind ?? "ACHIEVEMENT", ACHIEVEMENT_KINDS, f("kind"));
  const hidden = toBoolean(record.hidden ?? false, f("hidden"));
  const order = toInteger(record.order ?? 0, f("order"));
  // Legacy inline bytes are deliberately not migrated into D1; the published
  // AssetObject id and imageUrl remain as provenance for a separate blob step.
  if (record.imageData !== undefined && record.imageData !== null) {
    context.reject(softField(collection, "imageData", sourceId, context), "INVALID_REFERENCE",
      "inline binary is not migrated to D1; use legacy provenance and an approved R2 blob operation");
  }
  const elements = Array.isArray(record.tiers) ? record.tiers : [];
  const tiers = elements.flatMap((element, index) => {
    const nested = softField(collection, `tiers[${index}]`, sourceId, context);
    const raw = embedded(element);
    const tier = toEnum(raw.tier, BADGE_TIERS, { ...nested, field: "tiers.tier" });
    const target = toInteger(raw.target, { ...nested, field: "tiers.target" });
    if (!tier || target === undefined) return [];
    const rewardCoins = toInteger(raw.rewardCoins ?? 0, { ...nested, field: "tiers.rewardCoins" }, { min: 0 });
    if (rewardCoins === undefined) return [];
    return [{ tier, target, reward_coins: rewardCoins, reward_cosmetic: optString(raw.rewardCosmetic, { ...nested, field: "tiers.rewardCosmetic" }) }];
  });
  const critical = [sourceId, badgeId, title, description, category, icon, kind, hidden, order];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    id: badgeId ?? null,
    title: title ?? null,
    description: description ?? null,
    category: category ?? null,
    icon: icon ?? null,
    image_url: optString(record.imageUrl, f("imageUrl")),
    image_mime: optString(record.imageMime, f("imageMime")),
    asset_ref: optString(record.assetRef, f("assetRef")),
    kind: kind ?? null,
    metric: optEnum(record.metric, BADGE_METRICS, f("metric")),
    weekly_target: optInteger(record.weeklyTarget, f("weeklyTarget")),
    hidden: hidden ?? null,
    order: order ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  const writes: TargetWrite[] = [
    { table: collection, rows: [row] },
    { table: "achievement_tiers", rows: tiers.map((tier, position) => ({
      source_id: `${sourceId}:tiers:${position}`,
      ...tier,
      achievements_id: sourceId ?? null,
      position
    })) }
  ];
  context.keep(collection);
  return { writes, rejected: false };
}

function mapBattlePass(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "battle_passes";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const season = embedded(record.season);
  const seasonId = toSourceId(season.id, f("season.id"));
  const seasonName = toRequiredString(season.name, f("season.name"));
  const userId = toSourceId(record.userId, f("userId"));
  const tier = toEnum(record.tier ?? "free", BATTLE_PASS_TIERS, f("tier"));
  const level = toInteger(record.level ?? 1, f("level"), { min: 0 });
  const xp = toInteger(record.xp ?? 0, f("xp"), { min: 0 });
  const premium = toBoolean(record.premium ?? false, f("premium"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  const rewards = childRows({
    collection, table: "battle_pass_rewards", parentTable: collection, parentId: sourceId,
    fieldName: "rewards", elements: record.rewards, context,
    build: (element, f) => {
      const level = toInteger(element.level, { ...f, field: "rewards.level" });
      const claimed = toBoolean(element.claimed ?? false, { ...f, field: "rewards.claimed" });
      const freeClaimed = toBoolean(element.freeClaimed ?? false, { ...f, field: "rewards.freeClaimed" });
      const premiumClaimed = toBoolean(element.premiumClaimed ?? false, { ...f, field: "rewards.premiumClaimed" });
      if (level === undefined || claimed === undefined || freeClaimed === undefined || premiumClaimed === undefined) return undefined;
      return {
        level, claimed, free_claimed: freeClaimed, premium_claimed: premiumClaimed,
        reward_id: optReference(element.rewardId, { ...f, field: "rewards.rewardId" })
      };
    }
  });
  const critical = [sourceId, seasonId, seasonName, userId, tier, level, xp, premium, expiresAt];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    season_id: seasonId ?? null,
    season_name: seasonName ?? null,
    user_id: userId ?? null,
    tier: tier ?? null,
    level: level ?? null,
    xp: xp ?? null,
    premium: premium ?? null,
    expires_at: expiresAt ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, rewards], rejected: false };
}

function mapBattlePassXpGrant(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "battle_pass_xp_grants";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const seasonId = toSourceId(record.seasonId, f("seasonId"));
  const actionKey = toRequiredString(record.actionKey, f("actionKey"));
  const xpGained = toInteger(record.xpGained, f("xpGained"), { min: 1 });
  if (rejected([sourceId, userId, seasonId, actionKey, xpGained])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    season_id: seasonId ?? null,
    action_key: actionKey ?? null,
    xp_gained: xpGained ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapSeason(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "seasons";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const key = toRequiredString(record.key, f("key"));
  const name = toRequiredString(record.name, f("name"));
  const description = toRequiredString(record.description, f("description"));
  const startDate = toUtcIso(record.startDate, f("startDate"));
  const endDate = toUtcIso(record.endDate, f("endDate"));
  const maxLevel = toInteger(record.maxLevel ?? 50, f("maxLevel"), { min: 0 });
  const xpPerLevel = toInteger(record.xpPerLevel ?? 100, f("xpPerLevel"), { min: 0 });
  const premiumPrice = toInteger(record.premiumPrice ?? 999, f("premiumPrice"), { min: 0 });
  const active = toBoolean(record.active ?? true, f("active"));
  const rewards = childRows({
    collection, table: "season_rewards", parentTable: collection, parentId: sourceId,
    fieldName: "rewards", elements: record.rewards, context,
    build: (element, f) => {
      const level = toInteger(element.level, { ...f, field: "rewards.level" });
      if (level === undefined) return undefined;
      return {
        level,
        free_reward: jsonOrNull(element.freeReward, { ...f, field: "rewards.freeReward" }),
        premium_reward: jsonOrNull(element.premiumReward, { ...f, field: "rewards.premiumReward" })
      };
    }
  });
  const critical = [sourceId, key, name, description, startDate, endDate, maxLevel, xpPerLevel, premiumPrice, active];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    key: key ?? null,
    name: name ?? null,
    description: description ?? null,
    start_date: startDate ?? null,
    end_date: endDate ?? null,
    max_level: maxLevel ?? null,
    xp_per_level: xpPerLevel ?? null,
    premium_price: premiumPrice ?? null,
    active: active ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, rewards], rejected: false };
}

function mapMission(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "missions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const key = toRequiredString(record.key, f("key"));
  const type = toEnum(record.type, MISSION_TYPES, f("type"));
  const title = toRequiredString(record.title, f("title"));
  const description = toRequiredString(record.description, f("description"));
  const requirements = embedded(record.requirements);
  const rewards = embedded(record.rewards);
  const badge = embedded(record.badge);
  const reqAction = toRequiredString(requirements.action, f("requirements.action"));
  const reqTarget = toInteger(requirements.target, f("requirements.target"));
  const reqUnit = toRequiredString(requirements.unit ?? "count", f("requirements.unit"));
  const rewardXp = toInteger(rewards.xp ?? 0, f("rewards.xp"), { min: 0 });
  const rewardCoins = toInteger(rewards.coins ?? 0, f("rewards.coins"), { min: 0 });
  const rewardDiamonds = toInteger(rewards.diamonds ?? 0, f("rewards.diamonds"), { min: 0 });
  const active = toBoolean(record.active ?? true, f("active"));
  const critical = [sourceId, key, type, title, description, reqAction, reqTarget, reqUnit,
    rewardXp, rewardCoins, rewardDiamonds, active];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    key: key ?? null,
    type: type ?? null,
    title: title ?? null,
    description: description ?? null,
    requirements_action: reqAction ?? null,
    requirements_target: reqTarget ?? null,
    requirements_unit: reqUnit ?? null,
    rewards_xp: rewardXp ?? null,
    rewards_coins: rewardCoins ?? null,
    rewards_diamonds: rewardDiamonds ?? null,
    rewards_cosmetic_id: optString(rewards.cosmeticId, f("rewards.cosmeticId")),
    rewards_title_id: optString(rewards.titleId, f("rewards.titleId")),
    badge_icon: optString(badge.icon, f("badge.icon")),
    badge_color: optString(badge.color, f("badge.color")),
    season_id: optReference(record.seasonId, f("seasonId")),
    start_date: optDate(record.startDate, f("startDate")),
    end_date: optDate(record.endDate, f("endDate")),
    active: active ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapUserMission(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "user_missions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const missionId = toSourceId(record.missionId, f("missionId"));
  const progress = toInteger(record.progress ?? 0, f("progress"), { min: 0 });
  const completed = toBoolean(record.completed ?? false, f("completed"));
  const claimed = toBoolean(record.claimed ?? false, f("claimed"));
  const streakDay = toInteger(record.streakDay ?? 1, f("streakDay"), { min: 0 });
  if (rejected([sourceId, userId, missionId, progress, completed, claimed, streakDay])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    mission_id: missionId ?? null,
    progress: progress ?? null,
    completed: completed ?? null,
    completed_at: optDate(record.completedAt, f("completedAt")),
    claimed: claimed ?? null,
    streak_day: streakDay ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapDailyQuestion(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "daily_questions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const question = toRequiredString(record.question, f("question"));
  const category = toRequiredString(record.category ?? "general", f("category"));
  const date = toUtcIso(record.date, f("date"));
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  if (rejected([sourceId, question, category, date, isActive])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    question: question ?? null,
    category: category ?? null,
    date: date ?? null,
    is_active: isActive ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapUserDailyAnswer(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "user_daily_answers";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const questionId = toSourceId(record.questionId, f("questionId"));
  const answer = toRequiredString(record.answer, f("answer"));
  const isPublic = toBoolean(record.isPublic ?? true, f("isPublic"));
  if (rejected([sourceId, userId, questionId, answer, isPublic])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    question_id: questionId ?? null,
    answer: answer ?? null,
    is_public: isPublic ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapMiniGameChallenge(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "mini_game_challenges";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const challengerId = toSourceId(record.challengerId, f("challengerId"));
  const gameId = toEnum(record.gameId, MINI_GAME_IDS, f("gameId"));
  const score = toInteger(record.score, f("score"), { min: 0, max: 999999 });
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  if (rejected([sourceId, challengerId, gameId, score, expiresAt])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    challenger_id: challengerId ?? null,
    target_user_id: optReference(record.targetUserId, f("targetUserId")),
    clan_id: optReference(record.clanId, f("clanId")),
    game_id: gameId ?? null,
    score: score ?? null,
    score_id: optReference(record.scoreId, f("scoreId")),
    message: optString(record.message, f("message")),
    expires_at: expiresAt ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

const miniGameScoreColumns = new Set([
  "_id", "userId", "gameId", "score", "durationMs", "rounds", "metadata", "createdAt", "updatedAt"
]);

function mapMiniGameScore(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "mini_game_scores";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const gameId = toEnum(record.gameId, MINI_GAME_IDS, f("gameId"));
  const score = toInteger(record.score, f("score"), { min: 0, max: 999999 });
  const metadata = jsonMetadata(record.metadata, f("metadata"));
  if (rejected([sourceId, userId, gameId, score, metadata])) return { writes: [], rejected: true };
  // Catalog returns raw lean documents. Keep legacy fields such as __v, and
  // distinguish explicit null or empty metadata from omitted fields.
  const catalogFields = Object.fromEntries(Object.entries(record).filter(([key, value]) =>
    value !== undefined && (
      !miniGameScoreColumns.has(key) || value === null || (key === "metadata" && metadata === "{}")
    )
  ));
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    game_id: gameId ?? null,
    score: score ?? null,
    duration_ms: optInteger(record.durationMs, f("durationMs"), { min: 0, max: 300000 }),
    rounds: optInteger(record.rounds, f("rounds"), { min: 0, max: 1000 }),
    metadata,
    catalog_fields: stableStringify(catalogFields),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapCosmetic(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "cosmetics";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toOpaqueId(record._id, f("_id"));
  const type = toRequiredString(record.type, f("type"));
  const name = toRequiredString(record.name, f("name"));
  const coinPrice = toInteger(record.coinPrice, f("coinPrice"), { min: 0 });
  const rarity = toEnum(record.rarity ?? "COMMON", COSMETIC_RARITIES, f("rarity"));
  const preview = optString(record.preview ?? "", f("preview")) ?? "";
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  const rewardOnly = toBoolean(record.rewardOnly ?? false, f("rewardOnly"));
  if (rejected([sourceId, type, name, coinPrice, rarity, preview, isActive, rewardOnly])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    type: type ?? null,
    name: name ?? null,
    coin_price: coinPrice ?? null,
    rarity: rarity ?? null,
    preview: preview ?? null,
    is_active: isActive ?? null,
    reward_only: rewardOnly ?? null,
    asset_kind: optString(record.assetKind, f("assetKind")),
    asset_url: optString(record.assetUrl, f("assetUrl")),
    asset_ref: optString(record.assetRef, f("assetRef")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapImmersiveTheme(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "immersive_themes";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const key = toRequiredString(record.key, f("key"));
  const name = toRequiredString(record.name, f("name"));
  const type = toEnum(record.type, THEME_TYPES, f("type"));
  const category = toRequiredString(record.category, f("category"));
  const colors = canonicalStringList(record.colors, collection, "colors", sourceId, context);
  const price = embedded(record.price);
  const priceCoins = toInteger(price.coins ?? 0, f("price.coins"), { min: 0 });
  const priceDiamonds = toInteger(price.diamonds ?? 0, f("price.diamonds"), { min: 0 });
  const premium = toBoolean(record.premium ?? false, f("premium"));
  const available = toBoolean(record.available ?? true, f("available"));
  const critical = [sourceId, key, name, type, category, colors, priceCoins, priceDiamonds, premium, available];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    key: key ?? null,
    name: name ?? null,
    type: type ?? null,
    category: category ?? null,
    colors,
    animation: jsonOrNull(record.animation, f("animation")),
    ambient_sound: optString(record.ambientSound, f("ambientSound")),
    price_coins: priceCoins ?? null,
    price_diamonds: priceDiamonds ?? null,
    premium: premium ?? null,
    available: available ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapGiftCollection(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "gift_collections";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const name = toRequiredString(record.name, f("name"));
  const description = toRequiredString(record.description ?? "", f("description"));
  const icon = toRequiredString(record.icon ?? "", f("icon"));
  const bonus = embedded(record.bonus);
  const bonusDescription = toRequiredString(bonus.description ?? "", f("bonus.description"));
  // Multipliers are ratios, not money; preserve fractional values in REAL columns.
  const bonusXp = toFiniteNumber(bonus.xpMultiplier ?? 1, f("bonus.xpMultiplier"), { min: 0 });
  const bonusCoins = toFiniteNumber(bonus.coinMultiplier ?? 1, f("bonus.coinMultiplier"), { min: 0 });
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  const items = childRows({
    collection, table: "gift_collection_items", parentTable: collection, parentId: sourceId,
    fieldName: "gifts", elements: record.gifts, context,
    build: (element, f) => {
      const giftId = toSourceId(element.value, f);
      return giftId ? { value: giftId } : undefined;
    }
  });
  const critical = [sourceId, name, description, icon, bonusDescription, bonusXp, bonusCoins, isActive];
  if (rejected(critical)) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    name: name ?? null,
    description: description ?? null,
    icon: icon ?? null,
    bonus_description: bonusDescription ?? null,
    bonus_xp_multiplier: bonusXp ?? null,
    bonus_coin_multiplier: bonusCoins ?? null,
    is_active: isActive ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, items], rejected: false };
}

function mapGiftInventory(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "gift_inventories";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const giftId = toSourceId(record.giftId, f("giftId"));
  const quantity = toInteger(record.quantity, f("quantity"), { min: 1 });
  const source = toEnum(record.source ?? "purchased", GIFT_INVENTORY_SOURCES, f("source"));
  const upgradeLevel = toInteger(record.upgradeLevel ?? 1, f("upgradeLevel"), { min: 1 });
  const tradable = toBoolean(record.tradable ?? false, f("tradable"));
  if (rejected([sourceId, userId, giftId, quantity, source, upgradeLevel, tradable])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    gift_id: giftId ?? null,
    quantity: quantity ?? null,
    source: source ?? null,
    upgrade_level: upgradeLevel ?? null,
    tradable: tradable ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapWishlistItem(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "wishlist_items";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const giftId = toSourceId(record.giftId, f("giftId"));
  const isPublic = toBoolean(record.isPublic ?? true, f("isPublic"));
  if (rejected([sourceId, userId, giftId, isPublic])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    gift_id: giftId ?? null,
    message: optString(record.message, f("message")),
    is_public: isPublic ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

const REPORT_STATUSES = ["PENDING", "REVIEWED", "ACTION_TAKEN", "DISMISSED"] as const;
const QUEUE_TARGET_TYPES = [
  "USER", "PROFILE", "ROOM", "MESSAGE", "PHOTO", "VIDEO_ROOM", "VOICE_ROOM", "CHAT", "WITHDRAWAL", "PAYMENT"
] as const;
const QUEUE_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
const QUEUE_STATUSES = ["PENDING", "IN_REVIEW", "ESCALATED", "ACTION_TAKEN", "DISMISSED", "AUTO_RESOLVED"] as const;
const MODERATION_ACTIONS = ["WARN", "MUTE", "SUSPEND", "BAN", "UNBAN"] as const;
const ADMIN_MODERATION_ACTION_TYPES = [
  "WARNING_SENT", "USER_SUSPENDED", "USER_BANNED", "USER_UNBANNED", "PROFILE_HIDDEN",
  "PROFILE_RESTORED", "PHOTO_REMOVED", "MESSAGE_DELETED", "ROOM_ENDED", "ROOM_FEATURED",
  "ROOM_UNFEATURED", "CHAT_RESTRICTED", "WALLET_FROZEN", "WITHDRAWAL_REJECTED",
  "REPORT_DISMISSED", "ESCALATED", "NO_ACTION"
] as const;
const SUPPORT_CATEGORIES = ["General", "Account", "Payment", "Technical", "Report", "Content", "Other"] as const;
const SUPPORT_STATUSES = ["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"] as const;
const SUPPORT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
const SUPPORT_SENDER_TYPES = ["USER", "ADMIN", "SYSTEM"] as const;
const SUPPORT_TICKET_SENDER_ROLES = ["USER", "ADMIN"] as const;
const TRUST_VERIFICATION_STATUSES = [
  "NOT_STARTED", "INCOMPLETE", "PENDING_REVIEW", "VERIFIED", "REJECTED", "NEEDS_RETRY", "SUSPENDED", "EXPIRED"
] as const;
const TRUST_VERIFICATION_LEVELS = ["BASIC", "ADVANCED"] as const;
const TRUST_CHECK_STATUSES = [
  "NOT_SUBMITTED", "SUBMITTED", "PENDING_REVIEW", "VERIFIED", "REJECTED", "NEEDS_RETRY"
] as const;
const VERIFICATION_SUBMISSION_STATUSES = ["SUBMITTED", "PENDING_REVIEW", "APPROVED", "REJECTED", "NEEDS_RETRY"] as const;
const RISK_LEVELS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;

function mapReport(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "reports";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const reporterId = toSourceId(record.reporterId, f("reporterId"));
  const reason = toRequiredString(record.reason, f("reason"));
  const evidence = jsonMetadata(record.evidence ?? {}, f("evidence"));
  const riskScore = toInteger(record.riskScore ?? 0, f("riskScore"), { min: 0 });
  const autoFlagged = toBoolean(record.autoFlagged ?? false, f("autoFlagged"));
  const status = toEnum(record.status ?? "PENDING", REPORT_STATUSES, f("status"));
  if (rejected([sourceId, reporterId, reason, evidence, riskScore, autoFlagged, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    reporter_id: reporterId ?? null,
    target_user_id: optReference(record.targetUserId, f("targetUserId")),
    room_id: optReference(record.roomId, f("roomId")),
    reason: reason ?? null,
    description: optString(record.description, f("description")),
    evidence,
    risk_score: riskScore ?? null,
    auto_flagged: autoFlagged ?? null,
    auto_action_taken: optString(record.autoActionTaken, f("autoActionTaken")),
    moderator_note: optString(record.moderatorNote, f("moderatorNote")),
    reviewed_by: optReference(record.reviewedBy, f("reviewedBy")),
    reviewed_at: optDate(record.reviewedAt, f("reviewedAt")),
    status: status ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapModerationQueue(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "moderation_queues";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const targetType = toEnum(record.targetType, QUEUE_TARGET_TYPES, f("targetType"));
  const targetId = toSourceId(record.targetId, f("targetId"));
  const priority = toEnum(record.priority ?? "MEDIUM", QUEUE_PRIORITIES, f("priority"));
  const status = toEnum(record.status ?? "PENDING", QUEUE_STATUSES, f("status"));
  if (rejected([sourceId, targetType, targetId, priority, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    report_id: optReference(record.reportId, f("reportId")),
    target_type: targetType ?? null,
    target_id: targetId ?? null,
    target_user_id: optReference(record.targetUserId, f("targetUserId")),
    priority: priority ?? null,
    status: status ?? null,
    assigned_to: optReference(record.assignedTo, f("assignedTo")),
    reason: optString(record.reason, f("reason")),
    ai_score: optInteger(record.aiScore, f("aiScore")),
    notes: optString(record.notes, f("notes")),
    resolved_at: optDate(record.resolvedAt, f("resolvedAt")),
    resolved_by: optReference(record.resolvedBy, f("resolvedBy")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapModerationAction(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "moderation_actions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const targetUserId = toSourceId(record.targetUserId, f("targetUserId"));
  const action = toEnum(record.action, MODERATION_ACTIONS, f("action"));
  const reason = toRequiredString(record.reason, f("reason"));
  const automated = toBoolean(record.automated ?? false, f("automated"));
  if (rejected([sourceId, targetUserId, action, reason, automated])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    target_user_id: targetUserId ?? null,
    moderator_id: optReference(record.moderatorId, f("moderatorId")),
    report_id: optReference(record.reportId, f("reportId")),
    action: action ?? null,
    reason: reason ?? null,
    duration_hours: optInteger(record.durationHours, f("durationHours"), { min: 0 }),
    expires_at: optDate(record.expiresAt, f("expiresAt")),
    automated: automated ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapAdminAuditLog(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "admin_audit_logs";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const action = toRequiredString(record.action, f("action"));
  const entityType = toRequiredString(record.entityType, f("entityType"));
  const metadata = jsonMetadata(record.metadata ?? {}, f("metadata"));
  if (rejected([sourceId, action, entityType, metadata])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    admin_id: optReference(record.adminId, f("adminId")),
    action: action ?? null,
    entity_type: entityType ?? null,
    entity_id: optReference(record.entityId, f("entityId")),
    target_user_id: optReference(record.targetUserId, f("targetUserId")),
    metadata,
    ip_address: optString(record.ipAddress, f("ipAddress")),
    user_agent: optString(record.userAgent, f("userAgent")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapAdminModerationAction(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "admin_moderation_actions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const adminId = toSourceId(record.adminId, f("adminId"));
  const targetType = toRequiredString(record.targetType, f("targetType"));
  const actionType = toEnum(record.actionType, ADMIN_MODERATION_ACTION_TYPES, f("actionType"));
  const metadata = jsonMetadata(record.metadata ?? {}, f("metadata"));
  if (rejected([sourceId, adminId, targetType, actionType, metadata])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    admin_id: adminId ?? null,
    queue_id: optReference(record.queueId, f("queueId")),
    report_id: optReference(record.reportId, f("reportId")),
    target_type: targetType ?? null,
    target_id: optReference(record.targetId, f("targetId")),
    target_user_id: optReference(record.targetUserId, f("targetUserId")),
    action_type: actionType ?? null,
    reason: optString(record.reason, f("reason")),
    duration_hours: optInteger(record.durationHours, f("durationHours"), { min: 0 }),
    metadata,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapSupportTicket(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "support_tickets";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const category = toEnum(record.category ?? "General", SUPPORT_CATEGORIES, f("category"));
  const subject = toRequiredString(record.subject, f("subject"));
  const message = toRequiredString(record.message, f("message"));
  const status = toEnum(record.status ?? "OPEN", SUPPORT_STATUSES, f("status"));
  const priority = toEnum(record.priority ?? "MEDIUM", SUPPORT_PRIORITIES, f("priority"));
  const messages = childRows({
    collection, table: "support_ticket_messages", parentTable: collection, parentId: sourceId,
    fieldName: "messages", elements: record.messages, context,
    build: (element, childField) => {
      const senderId = toSourceId(element.senderId, { ...childField, field: "messages.senderId" });
      const senderRole = toEnum(element.senderRole, SUPPORT_TICKET_SENDER_ROLES, { ...childField, field: "messages.senderRole" });
      const text = toRequiredString(element.message, { ...childField, field: "messages.message" });
      const createdAt = toUtcIso(element.createdAt, { ...childField, field: "messages.createdAt" });
      if (!senderId || !senderRole || !text || !createdAt) return undefined;
      return { sender_id: senderId, sender_role: senderRole, message: text, created_at: createdAt };
    }
  });
  if (rejected([sourceId, category, subject, message, status, priority])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: optReference(record.userId, f("userId")),
    requester_email: optString(record.requesterEmail, f("requesterEmail")),
    assigned_to: optReference(record.assignedTo, f("assignedTo")),
    category: category ?? null,
    subject: subject ?? null,
    message: message ?? null,
    status: status ?? null,
    priority: priority ?? null,
    last_message_at: optDate(record.lastMessageAt, f("lastMessageAt")),
    closed_at: optDate(record.closedAt, f("closedAt")),
    resolved_at: optDate(record.resolvedAt, f("resolvedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, messages], rejected: false };
}

function mapSupportMessage(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "support_messages";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const ticketId = toSourceId(record.ticketId, f("ticketId"));
  const senderType = toEnum(record.senderType, SUPPORT_SENDER_TYPES, f("senderType"));
  const message = toRequiredString(record.message, f("message"));
  const attachments = jsonMetadata(record.attachments ?? [], f("attachments"));
  if (rejected([sourceId, ticketId, senderType, message, attachments])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    ticket_id: ticketId ?? null,
    sender_type: senderType ?? null,
    sender_user_id: optReference(record.senderUserId, f("senderUserId")),
    sender_admin_id: optReference(record.senderAdminId, f("senderAdminId")),
    message: message ?? null,
    attachments,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapTrustVerification(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "trust_verifications";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const status = toEnum(record.status ?? "NOT_STARTED", TRUST_VERIFICATION_STATUSES, f("status"));
  const level = toEnum(record.level ?? "BASIC", TRUST_VERIFICATION_LEVELS, f("level"));
  const faceStatus = toEnum(record.faceStatus ?? "NOT_SUBMITTED", TRUST_CHECK_STATUSES, f("faceStatus"));
  const voiceStatus = toEnum(record.voiceStatus ?? "NOT_SUBMITTED", TRUST_CHECK_STATUSES, f("voiceStatus"));
  const livenessStatus = toEnum(record.livenessStatus ?? "NOT_SUBMITTED", TRUST_CHECK_STATUSES, f("livenessStatus"));
  const verifiedBadgeEnabled = toBoolean(record.verifiedBadgeEnabled ?? false, f("verifiedBadgeEnabled"));
  const creatorTrustEnabled = toBoolean(record.creatorTrustEnabled ?? false, f("creatorTrustEnabled"));
  if (rejected([sourceId, userId, status, level, faceStatus, voiceStatus, livenessStatus,
    verifiedBadgeEnabled, creatorTrustEnabled])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    status: status ?? null,
    level: level ?? null,
    face_status: faceStatus ?? null,
    voice_status: voiceStatus ?? null,
    liveness_status: livenessStatus ?? null,
    verification_score: optInteger(record.verificationScore, f("verificationScore")),
    risk_score: optInteger(record.riskScore, f("riskScore")),
    verified_badge_enabled: verifiedBadgeEnabled ?? null,
    creator_trust_enabled: creatorTrustEnabled ?? null,
    submitted_at: optDate(record.submittedAt, f("submittedAt")),
    reviewed_at: optDate(record.reviewedAt, f("reviewedAt")),
    verified_at: optDate(record.verifiedAt, f("verifiedAt")),
    rejected_at: optDate(record.rejectedAt, f("rejectedAt")),
    reviewed_by_admin_id: optReference(record.reviewedByAdminId, f("reviewedByAdminId")),
    rejection_reason: optString(record.rejectionReason, f("rejectionReason")),
    admin_notes: optString(record.adminNotes, f("adminNotes")),
    consent_version: optString(record.consentVersion, f("consentVersion")),
    consent_accepted_at: optDate(record.consentAcceptedAt, f("consentAcceptedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapFaceVerificationSubmission(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "face_verification_submissions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const verificationId = toSourceId(record.verificationId, f("verificationId"));
  const status = toEnum(record.status ?? "SUBMITTED", VERIFICATION_SUBMISSION_STATUSES, f("status"));
  const providerResponse = jsonOrNull(record.providerResponse, f("providerResponse"));
  if (rejected([sourceId, userId, verificationId, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    verification_id: verificationId ?? null,
    selfie_image_url: optString(record.selfieImageUrl, f("selfieImageUrl")),
    selfie_video_url: optString(record.selfieVideoUrl, f("selfieVideoUrl")),
    liveness_video_url: optString(record.livenessVideoUrl, f("livenessVideoUrl")),
    face_match_score: optInteger(record.faceMatchScore, f("faceMatchScore")),
    liveness_score: optInteger(record.livenessScore, f("livenessScore")),
    quality_score: optInteger(record.qualityScore, f("qualityScore")),
    provider: optString(record.provider, f("provider")),
    provider_reference_id: optString(record.providerReferenceId, f("providerReferenceId")),
    provider_response: providerResponse,
    status: status ?? null,
    failure_reason: optString(record.failureReason, f("failureReason")),
    reviewed_at: optDate(record.reviewedAt, f("reviewedAt")),
    reviewed_by_admin_id: optReference(record.reviewedByAdminId, f("reviewedByAdminId")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapVoiceVerificationSubmission(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "voice_verification_submissions";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const verificationId = toSourceId(record.verificationId, f("verificationId"));
  const promptText = toRequiredString(record.promptText, f("promptText"));
  const status = toEnum(record.status ?? "SUBMITTED", VERIFICATION_SUBMISSION_STATUSES, f("status"));
  const providerResponse = jsonOrNull(record.providerResponse, f("providerResponse"));
  if (rejected([sourceId, userId, verificationId, promptText, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    verification_id: verificationId ?? null,
    audio_url: optString(record.audioUrl, f("audioUrl")),
    transcript_text: optString(record.transcriptText, f("transcriptText")),
    prompt_text: promptText ?? null,
    voice_liveness_score: optInteger(record.voiceLivenessScore, f("voiceLivenessScore")),
    voice_match_score: optInteger(record.voiceMatchScore, f("voiceMatchScore")),
    audio_quality_score: optInteger(record.audioQualityScore, f("audioQualityScore")),
    provider: optString(record.provider, f("provider")),
    provider_reference_id: optString(record.providerReferenceId, f("providerReferenceId")),
    provider_response: providerResponse,
    status: status ?? null,
    failure_reason: optString(record.failureReason, f("failureReason")),
    reviewed_at: optDate(record.reviewedAt, f("reviewedAt")),
    reviewed_by_admin_id: optReference(record.reviewedByAdminId, f("reviewedByAdminId")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapUserSafetyStatus(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "user_safety_statuses";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const trustScore = toInteger(record.trustScore ?? 100, f("trustScore"), { min: 0, max: 100 });
  const riskLevel = toEnum(record.riskLevel ?? "LOW", RISK_LEVELS, f("riskLevel"));
  const warningCount = toInteger(record.warningCount ?? 0, f("warningCount"), { min: 0 });
  const reportCount = toInteger(record.reportCount ?? 0, f("reportCount"), { min: 0 });
  const suspensionCount = toInteger(record.suspensionCount ?? 0, f("suspensionCount"), { min: 0 });
  const flags = ["isShadowBanned", "isChatRestricted", "isRoomRestricted", "isWalletFrozen"].map((name) =>
    toBoolean(record[name] ?? false, f(name)));
  if (rejected([sourceId, userId, trustScore, riskLevel, warningCount, reportCount, suspensionCount, ...flags])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    trust_score: trustScore ?? null,
    risk_level: riskLevel ?? null,
    warning_count: warningCount ?? null,
    report_count: reportCount ?? null,
    suspension_count: suspensionCount ?? null,
    is_shadow_banned: flags[0] ?? null,
    is_chat_restricted: flags[1] ?? null,
    is_room_restricted: flags[2] ?? null,
    is_wallet_frozen: flags[3] ?? null,
    last_reviewed_by: optReference(record.lastReviewedBy, f("lastReviewedBy")),
    last_reviewed_at: optDate(record.lastReviewedAt, f("lastReviewedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

const COUNTDOWN_TYPES = ["event", "festival", "special"] as const;
const EVENT_TYPES = ["ROOM", "TOURNAMENT", "SPECIAL", "WORKSHOP", "PARTY"] as const;
const EVENT_STATUSES = ["UPCOMING", "LIVE", "COMPLETED", "CANCELLED"] as const;
const EVENT_FESTIVALS = ["none", "diwali", "holi", "new_year", "valentines", "independence_day"] as const;
const XP_GRANT_STATUSES = ["PROCESSING", "COMPLETE"] as const;
const WAVE_NUDGE_TYPES = ["wave", "nudge", "vibe_ping"] as const;
const LIKE_TYPES = ["LIKE", "SUPER_LIKE", "PASS"] as const;
const REFERRAL_STATUSES = ["PENDING", "COMPLETED", "REWARDED", "EXPIRED"] as const;

/** String fields whose Mongoose schema supplies an empty or custom default. */
function defaultString(value: unknown, fallback: string, f: TransformField): string | undefined {
  const candidate = value === undefined || value === null ? fallback : value;
  if (typeof candidate === "string") return candidate;
  return f.context.reject(f, "MISSING_REQUIRED", "expected a string or null") ?? undefined;
}

/** Reference array elements are stored as canonical source IDs in child tables. */
function referenceChildren(
  collection: string,
  table: string,
  parentTable: string,
  parentId: string | undefined,
  fieldName: string,
  elements: unknown,
  context: TransformContext
): TargetWrite {
  return childRows({
    collection, table, parentTable, parentId, fieldName, elements, context,
    build: (raw, f) => {
      const value = toSourceId(raw.value, f);
      return value ? { value } : undefined;
    }
  });
}

function mapAppConfig(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "app_config";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const key = toRequiredString(record.key, f("key"));
  const valueField = f("value");
  const value = jsonOrNull(record.value, valueField);
  if (record.value === undefined || record.value === null) {
    valueField.context.reject(valueField, "MISSING_REQUIRED", "AppConfig.value is required");
    return { writes: [], rejected: true };
  }
  if (rejected([sourceId, key, value])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    key: key ?? null,
    value,
    description: optString(record.description, f("description")),
    updated_by: optReference(record.updatedBy, f("updatedBy")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapCountdownEvent(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "countdown_events";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const title = toRequiredString(record.title, f("title"));
  const description = defaultString(record.description, "", f("description"));
  const targetDate = toUtcIso(record.targetDate, f("targetDate"));
  const type = toEnum(record.type ?? "event", COUNTDOWN_TYPES, f("type"));
  const color = toRequiredString(record.color ?? "#E91E63", f("color"));
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  if (rejected([sourceId, title, description, targetDate, type, color, isActive])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    title: title ?? null,
    description: description ?? null,
    target_date: targetDate ?? null,
    type: type ?? null,
    cover_image: optString(record.coverImage, f("coverImage")),
    color: color ?? null,
    is_active: isActive ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapEvent(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "events";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const title = toRequiredString(record.title, f("title"));
  const hostId = toSourceId(record.hostId, f("hostId"));
  const category = toRequiredString(record.category, f("category"));
  const type = toEnum(record.type, EVENT_TYPES, f("type"));
  const eventDate = toUtcIso(record.eventDate, f("eventDate"));
  const maxParticipants = optInteger(record.maxParticipants, f("maxParticipants"), { min: 1 });
  const tags = jsonMetadata(record.tags ?? [], f("tags"));
  const status = toEnum(record.status ?? "UPCOMING", EVENT_STATUSES, f("status"));
  const festival = toEnum(record.festival ?? "none", EVENT_FESTIVALS, f("festival"));
  const featured = toBoolean(record.featured ?? false, f("featured"));
  const participants = referenceChildren(
    collection, "event_participants", collection, sourceId, "participantIds", record.participantIds, context
  );
  if (rejected([sourceId, title, hostId, category, type, eventDate, tags, status, festival, featured])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    title: title ?? null,
    description: optString(record.description, f("description")),
    host_id: hostId ?? null,
    cover_image: optString(record.coverImage, f("coverImage")),
    category: category ?? null,
    type: type ?? null,
    event_date: eventDate ?? null,
    event_end_date: optDate(record.eventEndDate, f("eventEndDate")),
    timezone: optString(record.timezone, f("timezone")),
    room_id: optReference(record.roomId, f("roomId")),
    max_participants: maxParticipants,
    tags,
    status: status ?? null,
    festival: festival ?? null,
    featured: featured ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, participants], rejected: false };
}

function mapXpDailyCap(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "xp_daily_caps";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const event = toRequiredString(record.event, f("event"));
  const day = toUtcIso(record.day, f("day"));
  const amount = toInteger(record.amount ?? 0, f("amount"));
  if (rejected([sourceId, userId, event, day, amount])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    event: event ?? null,
    day: day ?? null,
    amount: amount ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapXpGrant(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "xp_grants";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const event = toRequiredString(record.event, f("event"));
  const actionKey = toRequiredString(record.actionKey, f("actionKey"));
  const status = toEnum(record.status ?? "PROCESSING", XP_GRANT_STATUSES, f("status"));
  const requestedXp = toInteger(record.requestedXp, f("requestedXp"));
  const receipt = jsonOrNull(record.receipt, f("receipt"));
  if (receipt === null && record.receipt !== undefined && record.receipt !== null) {
    return { writes: [], rejected: true };
  }
  if (rejected([sourceId, userId, event, actionKey, status, requestedXp])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    event: event ?? null,
    action_key: actionKey ?? null,
    status: status ?? null,
    requested_xp: requestedXp ?? null,
    receipt,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapUserMood(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "user_moods";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const mood = defaultString(record.mood, "", f("mood"));
  const emoji = defaultString(record.emoji, "", f("emoji"));
  const activity = defaultString(record.activity, "", f("activity"));
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  if (rejected([sourceId, userId, mood, emoji, activity, isActive])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    mood: mood ?? null,
    emoji: emoji ?? null,
    activity: activity ?? null,
    activity_room_id: optReference(record.activityRoomId, f("activityRoomId")),
    is_active: isActive ?? null,
    expires_at: optDate(record.expiresAt, f("expiresAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapWaveNudge(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "wave_nudges";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const senderId = toSourceId(record.senderId, f("senderId"));
  const receiverId = toSourceId(record.receiverId, f("receiverId"));
  const type = toEnum(record.type, WAVE_NUDGE_TYPES, f("type"));
  const read = toBoolean(record.read ?? false, f("read"));
  if (rejected([sourceId, senderId, receiverId, type, read])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    sender_id: senderId ?? null,
    receiver_id: receiverId ?? null,
    type: type ?? null,
    read: read ?? null,
    room_id: optReference(record.roomId, f("roomId")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapProfileVisit(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "profile_visits";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const profileId = toSourceId(record.profileId, f("profileId"));
  const visitorId = toSourceId(record.visitorId, f("visitorId"));
  const lastVisitedAt = toUtcIso(record.lastVisitedAt ?? record.createdAt, f("lastVisitedAt"));
  if (rejected([sourceId, profileId, visitorId, lastVisitedAt])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    profile_id: profileId ?? null,
    visitor_id: visitorId ?? null,
    last_visited_at: lastVisitedAt ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapLike(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "likes";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const likerId = toSourceId(record.likerId, f("likerId"));
  const likedId = toSourceId(record.likedId, f("likedId"));
  const type = toEnum(record.type ?? "LIKE", LIKE_TYPES, f("type"));
  if (rejected([sourceId, likerId, likedId, type])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    liker_id: likerId ?? null,
    liked_id: likedId ?? null,
    type: type ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapReferral(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "referrals";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const referrerId = toSourceId(record.referrerId, f("referrerId"));
  const referralCode = toRequiredString(record.referralCode, f("referralCode"));
  const status = toEnum(record.status ?? "PENDING", REFERRAL_STATUSES, f("status"));
  if (rejected([sourceId, referrerId, referralCode, status])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    referrer_id: referrerId ?? null,
    referred_user_id: optReference(record.referredUserId, f("referredUserId")),
    referral_code: referralCode ?? null,
    status: status ?? null,
    reward_coins: optInteger(record.rewardCoins, f("rewardCoins"), { min: 0 }),
    reward_cosmetic_id: optString(record.rewardCosmeticId, f("rewardCosmeticId")),
    completed_at: optDate(record.completedAt, f("completedAt")),
    rewarded_at: optDate(record.rewardedAt, f("rewardedAt")),
    ip_address: optString(record.ipAddress, f("ipAddress")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapRelationship(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "relationships";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const pairKey = toRequiredString(record.pairKey, f("pairKey"));
  const xp = toInteger(record.xp ?? 0, f("xp"), { min: 0 });
  const level = toInteger(record.level ?? 1, f("level"), { min: 0 });
  const levelTitle = defaultString(record.levelTitle, "First Spark", f("levelTitle"));
  const streakDays = toInteger(record.streakDays ?? 0, f("streakDays"), { min: 0 });
  const users = referenceChildren(
    collection, "relationship_users", collection, sourceId, "users", record.users, context
  );
  if (rejected([sourceId, pairKey, xp, level, levelTitle, streakDays])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    pair_key: pairKey ?? null,
    xp: xp ?? null,
    level: level ?? null,
    level_title: levelTitle ?? null,
    streak_days: streakDays ?? null,
    last_streak_at: optDate(record.lastStreakAt, f("lastStreakAt")),
    last_interaction_at: optDate(record.lastInteractionAt, f("lastInteractionAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, users], rejected: false };
}

/** Bond.preferences is a Map keyed by actor ID. Preserve defaults in each actor's value. */
const BOND_PREFERENCE_DEFAULTS = {
  visibility: "PRIVATE",
  showDuration: true,
  showLevel: true,
  showBadge: true,
  leaderboard: false,
  showRanking: true,
  reminders: true,
  announcements: false
} as const;

function bondPreferenceRows(value: unknown, collection: string, rowId: string | undefined, context: TransformContext): TargetWrite {
  const entries: Array<[unknown, unknown]> = [];
  if (value instanceof Map) {
    entries.push(...value.entries());
  } else if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    entries.push(...Object.entries(value as Record<string, unknown>));
  } else if (value !== undefined && value !== null) {
    context.reject(softField(collection, "preferences", rowId, context), "INVALID_REFERENCE", "expected a Map or object");
  }

  const preferences = new Map<string, Record<string, unknown>>();
  for (const [rawKey, rawValue] of entries) {
    const key = toRequiredString(
      typeof rawKey === "string" || typeof rawKey === "number" ? String(rawKey) : "",
      softField(collection, "preferences.<key>", rowId, context)
    );
    if (!key) continue;
    if (preferences.has(key)) {
      context.reject(softField(collection, `preferences.${key}`, rowId, context), "INVALID_REFERENCE", "duplicate normalized preference key");
      continue;
    }

    let source: Record<string, unknown> | undefined;
    if (rawValue instanceof Map) {
      source = Object.fromEntries([...rawValue.entries()].map(([name, entry]) => [String(name), entry]));
    } else if (rawValue !== null && typeof rawValue === "object" && !Array.isArray(rawValue)) {
      source = rawValue as Record<string, unknown>;
    } else if (rawValue !== undefined && rawValue !== null) {
      context.reject(softField(collection, `preferences.${key}`, rowId, context), "INVALID_REFERENCE", "expected a preference object");
    }
    source ??= {};

    const prefField = (name: string) => softField(collection, `preferences.${key}.${name}`, rowId, context);
    preferences.set(key, {
      visibility: toEnum(source.visibility ?? BOND_PREFERENCE_DEFAULTS.visibility, BOND_PREFERENCE_VISIBILITIES, prefField("visibility"))
        ?? BOND_PREFERENCE_DEFAULTS.visibility,
      showDuration: toBoolean(source.showDuration ?? BOND_PREFERENCE_DEFAULTS.showDuration, prefField("showDuration"))
        ?? (BOND_PREFERENCE_DEFAULTS.showDuration ? 1 : 0),
      showLevel: toBoolean(source.showLevel ?? BOND_PREFERENCE_DEFAULTS.showLevel, prefField("showLevel"))
        ?? (BOND_PREFERENCE_DEFAULTS.showLevel ? 1 : 0),
      showBadge: toBoolean(source.showBadge ?? BOND_PREFERENCE_DEFAULTS.showBadge, prefField("showBadge"))
        ?? (BOND_PREFERENCE_DEFAULTS.showBadge ? 1 : 0),
      leaderboard: toBoolean(source.leaderboard ?? BOND_PREFERENCE_DEFAULTS.leaderboard, prefField("leaderboard"))
        ?? (BOND_PREFERENCE_DEFAULTS.leaderboard ? 1 : 0),
      showRanking: toBoolean(source.showRanking ?? BOND_PREFERENCE_DEFAULTS.showRanking, prefField("showRanking"))
        ?? (BOND_PREFERENCE_DEFAULTS.showRanking ? 1 : 0),
      reminders: toBoolean(source.reminders ?? BOND_PREFERENCE_DEFAULTS.reminders, prefField("reminders"))
        ?? (BOND_PREFERENCE_DEFAULTS.reminders ? 1 : 0),
      announcements: toBoolean(source.announcements ?? BOND_PREFERENCE_DEFAULTS.announcements, prefField("announcements"))
        ?? (BOND_PREFERENCE_DEFAULTS.announcements ? 1 : 0)
    });
  }
  const rows = [...preferences.keys()].sort().map((key, position) => ({
    source_id: `${rowId}:preferences:${key}`, bonds_id: rowId ?? "", key, position,
    value_json: stableStringify(preferences.get(key))
  }));
  return { table: "bond_preferences", rows };
}

function canonicalBondEntries(value: unknown, collection: string, rowId: string | undefined, context: TransformContext): string | undefined {
  if (!Array.isArray(value)) {
    context.reject(field(collection, "entries", rowId ?? "<unknown>", context), "MISSING_REQUIRED", "BondRankingSnapshot.entries is required");
    return undefined;
  }
  const entries = value.flatMap((element, index) => {
    const nested = softField(collection, `entries[${index}]`, rowId, context);
    const raw = element !== null && typeof element === "object" ? element as Record<string, unknown> : undefined;
    if (!raw) {
      context.reject(nested, "INVALID_REFERENCE", "expected an entry object");
      return [];
    }
    const bondId = toSourceId(raw.bondId, { ...nested, field: "entries.bondId" });
    if (!bondId) return [];
    const score = raw.score === undefined || raw.score === null
      ? null
      : toInteger(raw.score, { ...nested, field: "entries.score" }) ?? null;
    const rank = raw.rank === undefined || raw.rank === null
      ? null
      : toInteger(raw.rank, { ...nested, field: "entries.rank" }) ?? null;
    return [{ bondId, score, rank }];
  });
  return stableStringify(entries);
}

function mapBond(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "bonds";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const pairKey = toRequiredString(record.pairKey, f("pairKey"));
  const kind = toRequiredString(record.kind, f("kind"));
  const status = toEnum(record.status ?? "ACTIVE", BOND_STATUSES, f("status"));
  const activatedAt = toUtcIso(record.activatedAt, f("activatedAt"));
  const points = toInteger(record.points ?? 0, f("points"));
  const version = toInteger(record.version ?? 1, f("version"));
  if (record.milestoneDays != null && !Array.isArray(record.milestoneDays)) {
    context.reject(softField(collection, "milestoneDays", sourceId, context), "INVALID_REFERENCE", "expected an array");
  }
  const milestones = childRows({
    collection, table: "bond_milestones", parentTable: collection, parentId: sourceId,
    fieldName: "milestoneDays", elements: record.milestoneDays, context,
    build: (raw, entry) => {
      const day = toInteger(raw.value, entry);
      return day === undefined ? undefined : { day };
    }
  });
  const days = milestones.rows.map(row => row.day);
  if (new Set(days).size !== days.length) {
    context.reject(f("milestoneDays"), "INVALID_REFERENCE", "duplicate milestone day");
    return { writes: [], rejected: true };
  }
  const preferences = bondPreferenceRows(record.preferences, collection, sourceId, context);
  const usersValid = Array.isArray(record.users);
  const slotsValid = Array.isArray(record.slots);
  if (!usersValid) context.reject(f("users"), "MISSING_REQUIRED", "Bond.users is required");
  if (!slotsValid) context.reject(f("slots"), "MISSING_REQUIRED", "Bond.slots is required");
  const users = referenceChildren(collection, "bond_users", collection, sourceId, "users", record.users, context);
  const slots = integerChildren(collection, "bond_slots", collection, sourceId, "slots", record.slots, context);
  if (rejected([
    sourceId, pairKey, kind, status, activatedAt, points, version,
    usersValid ? true : undefined, slotsValid ? true : undefined
  ])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    pair_key: pairKey ?? null,
    kind: kind ?? null,
    status: status ?? null,
    activated_at: activatedAt ?? null,
    ended_at: optDate(record.endedAt, f("endedAt")),
    ended_by: optReference(record.endedBy, f("endedBy")),
    points: points ?? null,
    version: version ?? null,
    next_milestone_at: optDate(record.nextMilestoneAt, f("nextMilestoneAt")),
    anniversary_reminder_at: optDate(record.anniversaryReminderAt, f("anniversaryReminderAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, users, slots, milestones, preferences], rejected: false };
}

function mapBondPoint(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "bond_points";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const bondId = toSourceId(record.bondId, f("bondId"));
  const key = toRequiredString(record.key, f("key"));
  const kind = toRequiredString(record.kind, f("kind"));
  const points = toInteger(record.points, f("points"));
  const support = toInteger(record.support ?? 0, f("support"));
  if (rejected([sourceId, bondId, key, kind, points, support])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    bond_id: bondId ?? null,
    actor_id: optReference(record.actorId, f("actorId")),
    key: key ?? null,
    kind: kind ?? null,
    points: points ?? null,
    support: support ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapBondRankingSnapshot(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "bond_ranking_snapshots";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const period = toRequiredString(record.period, f("period"));
  const category = toRequiredString(record.category, f("category"));
  const finalizedAt = toUtcIso(record.finalizedAt, f("finalizedAt"));
  const entries = canonicalBondEntries(record.entries, collection, sourceId, context);
  if (rejected([sourceId, period, category, finalizedAt, entries])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    period: period ?? null,
    category: category ?? null,
    entries: entries ?? null,
    finalized_at: finalizedAt ?? null
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapBondRequest(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "bond_requests";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const pairKey = toRequiredString(record.pairKey, f("pairKey"));
  const senderId = toSourceId(record.senderId, f("senderId"));
  const recipientId = toSourceId(record.recipientId, f("recipientId"));
  const kind = toRequiredString(record.kind, f("kind"));
  const status = toEnum(record.status ?? "PENDING", BOND_REQUEST_STATUSES, f("status"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  const key = toRequiredString(record.key, f("key"));
  const price = toInteger(record.price ?? 0, f("price"));
  const giftPoints = toInteger(record.giftPoints ?? 0, f("giftPoints"));
  const version = toInteger(record.version ?? 1, f("version"));
  if (rejected([sourceId, pairKey, senderId, recipientId, kind, status, expiresAt, key, price, giftPoints, version])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    pair_key: pairKey ?? null,
    sender_id: senderId ?? null,
    recipient_id: recipientId ?? null,
    kind: kind ?? null,
    bond_id: optReference(record.bondId, f("bondId")),
    slot: optInteger(record.slot, f("slot")),
    gift_id: optReference(record.giftId, f("giftId")),
    gift_name: optString(record.giftName, f("giftName")),
    gift_icon: optString(record.giftIcon, f("giftIcon")),
    price: price ?? null,
    gift_points: giftPoints ?? null,
    message: optString(record.message, f("message")),
    status: status ?? null,
    expires_at: expiresAt ?? null,
    resolved_at: optDate(record.resolvedAt, f("resolvedAt")),
    key: key ?? null,
    version: version ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapBondReward(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "bond_rewards";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const bondId = toSourceId(record.bondId, f("bondId"));
  const userId = toSourceId(record.userId, f("userId"));
  const key = toRequiredString(record.key, f("key"));
  const itemId = toRequiredString(record.itemId, f("itemId"));
  const grantedAt = toUtcIso(record.grantedAt, f("grantedAt"));
  if (rejected([sourceId, bondId, userId, key, itemId, grantedAt])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    bond_id: bondId ?? null,
    user_id: userId ?? null,
    key: key ?? null,
    item_id: itemId ?? null,
    granted_at: grantedAt ?? null,
    expires_at: optDate(record.expiresAt, f("expiresAt")),
    expired_at: optDate(record.expiredAt, f("expiredAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapVibeGraph(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "vibe_graphs";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const city = defaultString(record.city, "", f("city"));
  const vibeScore = toInteger(record.vibeScore ?? 0, f("vibeScore"), { min: 0, max: 100 });
  const totalInteractions = toInteger(record.totalInteractions ?? 0, f("totalInteractions"));
  const lastVibeUpdate = toUtcIso(record.lastVibeUpdate, f("lastVibeUpdate"));
  if (rejected([sourceId, userId, city, vibeScore, totalInteractions, lastVibeUpdate])) {
    return { writes: [], rejected: true };
  }
  const interests = primitiveChildren(collection, "vibe_graph_interests", collection, sourceId, "interests", record.interests, context);
  const languages = primitiveChildren(collection, "vibe_graph_languages", collection, sourceId, "languages", record.languages, context);
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    city: city ?? null,
    vibe_score: vibeScore ?? null,
    total_interactions: totalInteractions ?? null,
    last_vibe_update: lastVibeUpdate ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, interests, languages], rejected: false };
}

function mapClanInvite(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "clan_invites";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const clanId = toSourceId(record.clanId, f("clanId"));
  const inviterId = toSourceId(record.inviterId, f("inviterId"));
  const inviteeId = toSourceId(record.inviteeId, f("inviteeId"));
  const status = toEnum(record.status ?? "PENDING", CLAN_INVITE_STATUSES, f("status"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  if (rejected([sourceId, clanId, inviterId, inviteeId, status, expiresAt])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    clan_id: clanId ?? null,
    inviter_id: inviterId ?? null,
    invitee_id: inviteeId ?? null,
    status: status ?? null,
    expires_at: expiresAt ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapClanMessage(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "clan_messages";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const clanId = toSourceId(record.clanId, f("clanId"));
  const senderId = toSourceId(record.senderId, f("senderId"));
  const message = toRequiredString(record.message, f("message"));
  if (rejected([sourceId, clanId, senderId, message])) return { writes: [], rejected: true };
  const reactions = childRows({
    collection, table: "clan_message_reactions", parentTable: collection, parentId: sourceId,
    fieldName: "reactions", elements: record.reactions, context,
    build: (element, nested) => {
      const userId = toSourceId(element.userId, { ...nested, field: "reactions.userId" });
      const type = toEnum(element.type, DM_REACTION_TYPES, { ...nested, field: "reactions.type" });
      const createdAt = toUtcIso(element.createdAt, { ...nested, field: "reactions.createdAt" });
      if (!userId || !type || !createdAt) return undefined;
      return { user_id: userId, type, created_at: createdAt };
    }
  });
  const row: TargetRow = {
    source_id: sourceId ?? null,
    clan_id: clanId ?? null,
    sender_id: senderId ?? null,
    message: message ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, reactions], rejected: false };
}

function mapGroupChat(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "group_chats";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const name = toRequiredString(record.name, f("name"));
  const createdBy = toSourceId(record.createdBy, f("createdBy"));
  const lastMessage = defaultString(record.lastMessage, "", f("lastMessage"));
  if (rejected([sourceId, name, createdBy, lastMessage])) return { writes: [], rejected: true };
  const participants = referenceChildren(
    collection, "conversation_participants", collection, sourceId, "participantIds", record.participantIds, context
  );
  const row: TargetRow = {
    source_id: sourceId ?? null,
    name: name ?? null,
    created_by: createdBy ?? null,
    last_message: lastMessage ?? null,
    last_message_at: optDate(record.lastMessageAt, f("lastMessageAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, participants], rejected: false };
}

function mapGroupMessage(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "group_messages";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const groupId = toSourceId(record.groupId, f("groupId"));
  const senderId = toSourceId(record.senderId, f("senderId"));
  const message = toRequiredString(record.message, f("message"));
  const mediaUrl = defaultString(record.mediaUrl, "", f("mediaUrl"));
  const mediaType = toEnum(record.mediaType ?? "", GROUP_MESSAGE_MEDIA_TYPES, f("mediaType"));
  const duration = toInteger(record.duration ?? 0, f("duration"));
  if (rejected([sourceId, groupId, senderId, message, mediaUrl, mediaType, duration])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    group_id: groupId ?? null,
    sender_id: senderId ?? null,
    message: message ?? null,
    media_url: mediaUrl ?? null,
    media_type: mediaType ?? null,
    duration: duration ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapStoryComment(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "story_comments";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const storyId = toSourceId(record.storyId, f("storyId"));
  const userId = toSourceId(record.userId, f("userId"));
  // Mongoose allows null for root comments; the draft DDL's NOT NULL is a schema issue.
  // A malformed optional parent is soft-quarantined so a valid comment is still retained.
  const parentId = optReference(record.parentId, { ...f("parentId"), soft: true });
  const text = toRequiredString(record.text, f("text"));
  if (rejected([sourceId, storyId, userId, text])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    story_id: storyId ?? null,
    user_id: userId ?? null,
    parent_id: parentId,
    text: text ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapWatchParty(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "watch_parties";
  const f = (name: string) => field(collection, name, String(record._id ?? "<unknown>"), context);
  const sourceId = toSourceId(record._id, f("_id"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const hostId = toSourceId(record.hostId, f("hostId"));
  const title = toRequiredString(record.title, f("title"));
  const mediaUrl = toRequiredString(record.mediaUrl, f("mediaUrl"));
  const position = toInteger(record.position ?? 0, f("position"));
  const isPlaying = toBoolean(record.isPlaying ?? false, f("isPlaying"));
  if (rejected([sourceId, roomId, hostId, title, mediaUrl, position, isPlaying])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    room_id: roomId ?? null,
    host_id: hostId ?? null,
    title: title ?? null,
    media_url: mediaUrl ?? null,
    position: position ?? null,
    is_playing: isPlaying ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapCreatorPayoutKyc(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "creator_payout_kycs";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const panVerified = toBoolean(record.panVerified ?? false, f("panVerified"));
  const kycStatus = toEnum(record.kycStatus ?? "NOT_SUBMITTED", KYC_STATUSES, f("kycStatus"));
  const payoutStatus = toEnum(record.payoutStatus ?? "DISABLED", CREATOR_PAYOUT_STATUSES, f("payoutStatus"));
  const metadata = jsonMetadata(record.metadata, s("metadata"));
  if (rejected([sourceId, userId, panVerified, kycStatus, payoutStatus])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    legal_full_name: optString(record.legalFullName, s("legalFullName")),
    date_of_birth: optDate(record.dateOfBirth, s("dateOfBirth")),
    pan_number_encrypted: optString(record.panNumberEncrypted, s("panNumberEncrypted")),
    pan_last4: optString(record.panLast4, s("panLast4")),
    pan_verified: panVerified ?? null,
    upi_id_encrypted: optString(record.upiIdEncrypted, s("upiIdEncrypted")),
    upi_id_masked: optString(record.upiIdMasked, s("upiIdMasked")),
    bank_account_encrypted: optString(record.bankAccountEncrypted, s("bankAccountEncrypted")),
    bank_account_last4: optString(record.bankAccountLast4, s("bankAccountLast4")),
    bank_ifsc: optString(record.bankIfsc, s("bankIfsc")),
    bank_holder_name: optString(record.bankHolderName, s("bankHolderName")),
    kyc_status: kycStatus ?? null,
    payout_status: payoutStatus ?? null,
    submitted_at: optDate(record.submittedAt, s("submittedAt")),
    verified_at: optDate(record.verifiedAt, s("verifiedAt")),
    rejected_at: optDate(record.rejectedAt, s("rejectedAt")),
    reviewed_by_admin_id: optReference(record.reviewedByAdminId, s("reviewedByAdminId")),
    rejection_reason: optString(record.rejectionReason, s("rejectionReason")),
    admin_notes: optString(record.adminNotes, s("adminNotes")),
    metadata,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapFriendMatchRequest(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "friend_match_requests";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const status = toEnum(record.status, FRIEND_MATCH_STATUSES, f("status"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  if (rejected([sourceId, userId, status, expiresAt])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    status: status ?? null,
    matched_user_id: optReference(record.matchedUserId, s("matchedUserId")),
    room_id: optReference(record.roomId, s("roomId")),
    expires_at: expiresAt ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapGift(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "gifts";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const limited = embedded(record.limitedEdition);
  const sourceId = toSourceId(record._id, f("_id"));
  const name = toRequiredString(record.name, f("name"));
  const icon = toRequiredString(record.icon, f("icon"));
  const coinPrice = toInteger(record.coinPrice, f("coinPrice"), { min: 1 });
  const pkPoints = toInteger(record.pkPoints ?? 0, f("pkPoints"), { min: 0 });
  const diamondPrice = toInteger(record.diamondPrice ?? 0, f("diamondPrice"));
  const isActive = toBoolean(record.isActive ?? true, f("isActive"));
  const interactive = toBoolean(record.interactive ?? false, f("interactive"));
  const comboMultiplier = toInteger(record.comboMultiplier ?? 1, f("comboMultiplier"));
  const category = toEnum(record.category ?? "normal", GIFT_CATEGORIES, f("category"));
  const bondPoints = toInteger(record.bondPoints ?? 0, f("bondPoints"), { min: 0 });
  const bondMinimumDays = toInteger(record.bondMinimumDays ?? 0, f("bondMinimumDays"), { min: 0 });
  const rarity = toEnum(record.rarity ?? "common", GIFT_RARITIES, f("rarity"));
  const limitedActive = toBoolean(limited.active ?? false, f("limitedEdition.active"));
  const limitedTotal = toInteger(limited.total ?? 0, f("limitedEdition.total"));
  const limitedRemaining = toInteger(limited.remaining ?? 0, f("limitedEdition.remaining"));
  const tradable = toBoolean(record.tradable ?? false, f("tradable"));
  const upgradeable = toBoolean(record.upgradeable ?? false, f("upgradeable"));
  const achievementGift = toBoolean(record.achievementGift ?? false, f("achievementGift"));
  const petGift = toBoolean(record.petGift ?? false, f("petGift"));
  const vehicleGift = toBoolean(record.vehicleGift ?? false, f("vehicleGift"));
  if (rejected([
    sourceId, name, icon, coinPrice, pkPoints, diamondPrice, isActive, interactive,
    comboMultiplier, category, bondPoints, bondMinimumDays, rarity, limitedActive,
    limitedTotal, limitedRemaining, tradable, upgradeable, achievementGift, petGift, vehicleGift
  ])) return { writes: [], rejected: true };
  const upgradePath = canonicalIdList(record.upgradePath, collection, "upgradePath", sourceId, context);
  const row: TargetRow = {
    source_id: sourceId ?? null,
    name: name ?? null,
    icon: icon ?? null,
    coin_price: coinPrice ?? null,
    pk_points: pkPoints ?? null,
    diamond_price: diamondPrice ?? null,
    is_active: isActive ?? null,
    effect3d: defaultString(record.effect3d, "", s("effect3d")) ?? null,
    interactive: interactive ?? null,
    animation_key: defaultString(record.animationKey, "", s("animationKey")) ?? null,
    // Mongoose defaults expiresAt/collectionId to null; the draft DDL's NOT NULL is a flagged schema issue.
    expires_at: optDate(record.expiresAt, s("expiresAt")),
    combo_multiplier: comboMultiplier ?? null,
    category: category ?? null,
    bond_purpose: optEnum(record.bondPurpose, GIFT_BOND_PURPOSES, s("bondPurpose")),
    bond_kind: optString(record.bondKind, s("bondKind")),
    bond_points: bondPoints ?? null,
    bond_minimum_days: bondMinimumDays ?? null,
    bond_cosmetic_id: optString(record.bondCosmeticId, s("bondCosmeticId")),
    theme: defaultString(record.theme, "", s("theme")) ?? null,
    rarity: rarity ?? null,
    limited_edition_active: limitedActive ?? null,
    limited_edition_total: limitedTotal ?? null,
    limited_edition_remaining: limitedRemaining ?? null,
    collection_id: optReference(record.collectionId, s("collectionId")),
    tradable: tradable ?? null,
    upgradeable: upgradeable ?? null,
    upgrade_path: upgradePath,
    achievement_gift: achievementGift ?? null,
    pet_gift: petGift ?? null,
    vehicle_gift: vehicleGift ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapMatch(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "matches";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  if (!sourceId) return { writes: [], rejected: true };
  if (!Array.isArray(record.users)) {
    context.reject(f("users"), "MISSING_REQUIRED", "Match.users must be an array");
    return { writes: [], rejected: true };
  }
  const users = referenceChildren(collection, "match_users", collection, sourceId, "users", record.users, context);
  const row: TargetRow = {
    source_id: sourceId,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }, users], rejected: false };
}

function mapNotification(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "notifications";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const type = toEnum(record.type, NOTIFICATION_TYPES, f("type"));
  const title = toRequiredString(record.title, f("title"));
  const body = toRequiredString(record.body, f("body"));
  const read = toBoolean(record.read ?? false, f("read"));
  if (rejected([sourceId, userId, type, title, body, read])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    type: type ?? null,
    title: title ?? null,
    body: body ?? null,
    data: jsonOrNull(record.data, s("data")),
    read: read ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapNotificationCampaign(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "notification_campaigns";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const title = toRequiredString(record.title, f("title"));
  const body = toRequiredString(record.body, f("body"));
  const segment = toEnum(record.segment, CAMPAIGN_SEGMENTS, f("segment"));
  const status = toEnum(record.status ?? "DRAFT", CAMPAIGN_STATUSES, f("status"));
  const sentCount = toInteger(record.sentCount ?? 0, f("sentCount"));
  const deliveredCount = toInteger(record.deliveredCount ?? 0, f("deliveredCount"));
  const openCount = toInteger(record.openCount ?? 0, f("openCount"));
  const clickCount = toInteger(record.clickCount ?? 0, f("clickCount"));
  const createdBy = toSourceId(record.createdBy, f("createdBy"));
  const filters = jsonOrNull(record.filters, s("filters"));
  if (rejected([
    sourceId, title, body, segment, status, sentCount, deliveredCount,
    openCount, clickCount, createdBy, filters
  ])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    title: title ?? null,
    body: body ?? null,
    segment: segment ?? null,
    segment_value: optString(record.segmentValue, s("segmentValue")),
    filters,
    status: status ?? null,
    scheduled_for: optDate(record.scheduledFor, s("scheduledFor")),
    sent_count: sentCount ?? null,
    delivered_count: deliveredCount ?? null,
    open_count: openCount ?? null,
    click_count: clickCount ?? null,
    created_by: createdBy ?? null,
    sent_at: optDate(record.sentAt, s("sentAt")),
    completed_at: optDate(record.completedAt, s("completedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPayoutReview(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "payout_reviews";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const userId = toSourceId(record.userId, f("userId"));
  const withdrawalRequestId = toSourceId(record.withdrawalRequestId, f("withdrawalRequestId"));
  const status = toEnum(record.status ?? "PENDING", PAYOUT_REVIEW_STATUSES, f("status"));
  const trustVerified = toBoolean(record.trustVerified ?? false, f("trustVerified"));
  const kycVerified = toBoolean(record.kycVerified ?? false, f("kycVerified"));
  const walletSafe = toBoolean(record.walletSafe ?? false, f("walletSafe"));
  const reportsSafe = toBoolean(record.reportsSafe ?? false, f("reportsSafe"));
  const fraudSafe = toBoolean(record.fraudSafe ?? false, f("fraudSafe"));
  const riskFlags = jsonMetadata(record.riskFlags, s("riskFlags"));
  const payoutRaw = record.payout && typeof record.payout === "object" && !Array.isArray(record.payout)
    ? record.payout as Record<string, unknown>
    : null;
  if (record.payout !== undefined && record.payout !== null && !payoutRaw) {
    context.reject(s("payout"), "MISSING_REQUIRED", "expected an object or null");
  }
  const payoutNested = (name: string) => softField(collection, `payout.${name}`, rowId, context);
  const providerPayoutId = payoutRaw ? optString(payoutRaw.providerPayoutId, payoutNested("providerPayoutId")) : null;
  const providerStatus = payoutRaw ? optString(payoutRaw.providerStatus, payoutNested("providerStatus")) : null;
  const processedAt = payoutRaw ? optDate(payoutRaw.processedAt, payoutNested("processedAt")) : null;
  const failureReason = payoutRaw ? optString(payoutRaw.failureReason, payoutNested("failureReason")) : null;
  if (rejected([
    sourceId, userId, withdrawalRequestId, status, trustVerified, kycVerified,
    walletSafe, reportsSafe, fraudSafe, riskFlags
  ])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    user_id: userId ?? null,
    withdrawal_request_id: withdrawalRequestId ?? null,
    trust_verification_id: optReference(record.trustVerificationId, s("trustVerificationId")),
    creator_payout_kyc_id: optReference(record.creatorPayoutKycId, s("creatorPayoutKycId")),
    status: status ?? null,
    trust_verified: trustVerified ?? null,
    kyc_verified: kycVerified ?? null,
    wallet_safe: walletSafe ?? null,
    reports_safe: reportsSafe ?? null,
    fraud_safe: fraudSafe ?? null,
    risk_score: optInteger(record.riskScore, s("riskScore")),
    risk_flags: riskFlags,
    provider_payout_id: providerPayoutId,
    provider_status: providerStatus,
    processed_at: processedAt,
    failure_reason: failureReason,
    reviewed_by_admin_id: optReference(record.reviewedByAdminId, s("reviewedByAdminId")),
    admin_notes: optString(record.adminNotes, s("adminNotes")),
    rejection_reason: optString(record.rejectionReason, s("rejectionReason")),
    reviewed_at: optDate(record.reviewedAt, s("reviewedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPkBattle(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "pk_battles";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const battleCode = toRequiredString(record.battleCode, f("battleCode"));
  const title = defaultString(record.title, "", f("title"));
  const mode = toEnum(record.mode, PK_MODES, f("mode"));
  const format = toEnum(record.format ?? "ROOM", PK_FORMATS, f("format"));
  const scope = toEnum(record.scope ?? "CROSS_ROOM", PK_SCOPES, f("scope"));
  const teamSize = toInteger(record.teamSize ?? 1, f("teamSize"), { min: 1, max: 5 });
  const status = toEnum(record.status ?? "INVITED", PK_STATUSES, f("status"));
  const battleType = toEnum(record.battleType, PK_BATTLE_TYPES, f("battleType"));
  const durationSeconds = toInteger(record.durationSeconds, f("durationSeconds"), { min: 30, max: 3600 });
  const inRoomBattle = toBoolean(record.inRoomBattle ?? false, f("inRoomBattle"));
  const stateVersion = toInteger(record.stateVersion ?? 1, f("stateVersion"), { min: 1 });
  const eventSequence = toInteger(record.eventSequence ?? 0, f("eventSequence"), { min: 0 });
  const terminationReason = defaultString(record.terminationReason, "", f("terminationReason"));
  const startedByUserId = toSourceId(record.startedByUserId, f("startedByUserId"));
  const leftRoomId = toSourceId(record.leftRoomId, f("leftRoomId"));
  const rightRoomId = toSourceId(record.rightRoomId, f("rightRoomId"));
  const leftHostId = toSourceId(record.leftHostId, f("leftHostId"));
  const rightHostId = toSourceId(record.rightHostId, f("rightHostId"));
  const leftScore = toInteger(record.leftScore ?? 0, f("leftScore"), { min: 0 });
  const rightScore = toInteger(record.rightScore ?? 0, f("rightScore"), { min: 0 });
  if (rejected([
    sourceId, battleCode, title, mode, format, scope, teamSize, status, battleType,
    durationSeconds, inRoomBattle, stateVersion, eventSequence, terminationReason,
    startedByUserId, leftRoomId, rightRoomId, leftHostId, rightHostId, leftScore, rightScore
  ])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    battle_code: battleCode ?? null,
    title: title ?? null,
    mode: mode ?? null,
    format: format ?? null,
    scope: scope ?? null,
    team_size: teamSize ?? null,
    status: status ?? null,
    battle_type: battleType ?? null,
    duration_seconds: durationSeconds ?? null,
    selected_gift_id: optReference(record.selectedGiftId, s("selectedGiftId")),
    in_room_battle: inRoomBattle ?? null,
    state_version: stateVersion ?? null,
    event_sequence: eventSequence ?? null,
    countdown_ends_at: optDate(record.countdownEndsAt, s("countdownEndsAt")),
    finalized_at: optDate(record.finalizedAt, s("finalizedAt")),
    closed_at: optDate(record.closedAt, s("closedAt")),
    result_type: optEnum(record.resultType, PK_RESULT_TYPES, s("resultType")),
    termination_reason: terminationReason ?? null,
    started_by_user_id: startedByUserId ?? null,
    left_room_id: leftRoomId ?? null,
    right_room_id: rightRoomId ?? null,
    left_host_id: leftHostId ?? null,
    right_host_id: rightHostId ?? null,
    left_score: leftScore ?? null,
    right_score: rightScore ?? null,
    winner_side: optEnum(record.winnerSide, PK_SIDES_WITH_DRAW, s("winnerSide")),
    winner_user_id: optReference(record.winnerUserId, s("winnerUserId")),
    started_at: optDate(record.startedAt, s("startedAt")),
    ended_at: optDate(record.endedAt, s("endedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPkEvent(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "pk_events";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const battleId = toSourceId(record.battleId, f("battleId"));
  const eventType = toEnum(record.eventType, PK_EVENT_TYPES, f("eventType"));
  const points = toInteger(record.points ?? 0, f("points"));
  const stateVersion = toInteger(record.stateVersion ?? 1, f("stateVersion"));
  const metadata = jsonMetadata(record.metadata, s("metadata"));
  if (rejected([sourceId, battleId, eventType, points, stateVersion])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    battle_id: battleId ?? null,
    room_id: optReference(record.roomId, s("roomId")),
    user_id: optReference(record.userId, s("userId")),
    event_type: eventType ?? null,
    side: optEnum(record.side, PK_SIDES_WITH_DRAW, s("side")),
    points: points ?? null,
    state_version: stateVersion ?? null,
    sequence: optInteger(record.sequence, s("sequence"), { min: 1 }),
    gift_transaction_id: optReference(record.giftTransactionId, s("giftTransactionId")),
    metadata,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPkInvite(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "pk_invites";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const battleId = toSourceId(record.battleId, f("battleId"));
  const inviterUserId = toSourceId(record.inviterUserId, f("inviterUserId"));
  const inviteeUserId = toSourceId(record.inviteeUserId, f("inviteeUserId"));
  const inviterRoomId = toSourceId(record.inviterRoomId, f("inviterRoomId"));
  const inviteeRoomId = toSourceId(record.inviteeRoomId, f("inviteeRoomId"));
  const status = toEnum(record.status ?? "PENDING", PK_INVITE_STATUSES, f("status"));
  const expiresAt = toUtcIso(record.expiresAt, f("expiresAt"));
  if (rejected([
    sourceId, battleId, inviterUserId, inviteeUserId, inviterRoomId, inviteeRoomId, status, expiresAt
  ])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    battle_id: battleId ?? null,
    inviter_user_id: inviterUserId ?? null,
    invitee_user_id: inviteeUserId ?? null,
    inviter_room_id: inviterRoomId ?? null,
    invitee_room_id: inviteeRoomId ?? null,
    status: status ?? null,
    expires_at: expiresAt ?? null,
    responded_at: optDate(record.respondedAt, s("respondedAt")),
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPkLeaderboardEntry(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "pk_leaderboard_entries";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const battleId = toSourceId(record.battleId, f("battleId"));
  const userId = toSourceId(record.userId, f("userId"));
  const side = toEnum(record.side, PK_SIDES, f("side"));
  const totalPoints = toInteger(record.totalPoints ?? 0, f("totalPoints"));
  const totalGiftsSent = toInteger(record.totalGiftsSent ?? 0, f("totalGiftsSent"));
  if (rejected([sourceId, battleId, userId, side, totalPoints, totalGiftsSent])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    battle_id: battleId ?? null,
    user_id: userId ?? null,
    side: side ?? null,
    total_points: totalPoints ?? null,
    total_gifts_sent: totalGiftsSent ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPkParticipant(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "pk_participants";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const s = (name: string) => softField(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const battleId = toSourceId(record.battleId, f("battleId"));
  const userId = toSourceId(record.userId, f("userId"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  const side = toEnum(record.side, PK_SIDES, f("side"));
  const role = toEnum(record.role, PK_PARTICIPANT_ROLES, f("role"));
  const isReady = toBoolean(record.isReady ?? false, f("isReady"));
  // Source default is Date.now; a missing value is not silently re-dated during migration.
  const joinedAt = toUtcIso(record.joinedAt, f("joinedAt"));
  if (rejected([sourceId, battleId, userId, roomId, side, role, isReady, joinedAt])) {
    return { writes: [], rejected: true };
  }
  const row: TargetRow = {
    source_id: sourceId ?? null,
    battle_id: battleId ?? null,
    user_id: userId ?? null,
    room_id: roomId ?? null,
    side: side ?? null,
    role: role ?? null,
    is_ready: isReady ?? null,
    team_name: optEnum(record.teamName, PK_TEAM_NAMES, s("teamName")),
    joined_at: joinedAt ?? null,
    left_at: optDate(record.leftAt, s("leftAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

function mapPkVote(record: SourceRecord, context: TransformContext): MappedRecord {
  const collection = "pk_votes";
  const rowId = String(record._id ?? "<unknown>");
  const f = (name: string) => field(collection, name, rowId, context);
  const sourceId = toSourceId(record._id, f("_id"));
  const battleId = toSourceId(record.battleId, f("battleId"));
  const voterId = toSourceId(record.voterId, f("voterId"));
  const side = toEnum(record.side, PK_SIDES, f("side"));
  const roomId = toSourceId(record.roomId, f("roomId"));
  if (rejected([sourceId, battleId, voterId, side, roomId])) return { writes: [], rejected: true };
  const row: TargetRow = {
    source_id: sourceId ?? null,
    battle_id: battleId ?? null,
    voter_id: voterId ?? null,
    side: side ?? null,
    room_id: roomId ?? null,
    created_at: optDate(record.createdAt, f("createdAt")),
    updated_at: optDate(record.updatedAt, f("updatedAt"))
  };
  context.keep(collection);
  return { writes: [{ table: collection, rows: [row] }], rejected: false };
}

/** Bump when any mapping's output changes; recorded in every id_map row. */
export const MAPPING_VERSION = "1";

/** Root target table for each reviewed collection (child tables are separate). */
export const ROOT_TABLES: Record<string, string> = {
  users: "users",
  auth_sessions: "auth_sessions",
  admin_sessions: "admin_sessions",
  device_tokens: "device_tokens",
  wallet_transactions: "wallet_transactions",
  diamond_transactions: "diamond_transactions",
  purchases: "purchases",
  gift_transactions: "gift_transactions",
  withdrawal_requests: "withdrawal_requests",
  subscriptions: "subscriptions",
  admin_users: "admin_users",
  assets: "assets",
  friendships: "friendships",
  blocks: "blocks",
  follows: "follows",
  clans: "clans",
  direct_messages: "direct_messages",
  chat_messages: "chat_messages",
  conversation_mutes: "conversation_mutes",
  stories: "stories",
  story_highlights: "story_highlights",
  rooms: "rooms",
  room_participants: "room_participants",
  room_invites: "room_invites",
  room_follows: "room_follows",
  room_mode_states: "room_mode_states",
  room_reactions: "room_reactions",
  room_activities: "room_activities",
  room_recordings: "room_recordings",
  speaker_requests: "speaker_requests",
  polls: "polls",
  voice_polls: "voice_polls",
  achievements: "achievements",
  battle_passes: "battle_passes",
  battle_pass_xp_grants: "battle_pass_xp_grants",
  seasons: "seasons",
  missions: "missions",
  user_missions: "user_missions",
  daily_questions: "daily_questions",
  user_daily_answers: "user_daily_answers",
  mini_game_challenges: "mini_game_challenges",
  mini_game_scores: "mini_game_scores",
  cosmetics: "cosmetics",
  immersive_themes: "immersive_themes",
  gift_collections: "gift_collections",
  gift_inventories: "gift_inventories",
  wishlist_items: "wishlist_items",
  reports: "reports",
  moderation_queues: "moderation_queues",
  moderation_actions: "moderation_actions",
  admin_audit_logs: "admin_audit_logs",
  admin_moderation_actions: "admin_moderation_actions",
  support_tickets: "support_tickets",
  support_messages: "support_messages",
  trust_verifications: "trust_verifications",
  face_verification_submissions: "face_verification_submissions",
  voice_verification_submissions: "voice_verification_submissions",
  user_safety_statuses: "user_safety_statuses",
  app_config: "app_config",
  countdown_events: "countdown_events",
  events: "events",
  xp_daily_caps: "xp_daily_caps",
  xp_grants: "xp_grants",
  user_moods: "user_moods",
  wave_nudges: "wave_nudges",
  profile_visits: "profile_visits",
  likes: "likes",
  referrals: "referrals",
  relationships: "relationships",
  bonds: "bonds",
  bond_points: "bond_points",
  bond_ranking_snapshots: "bond_ranking_snapshots",
  bond_requests: "bond_requests",
  bond_rewards: "bond_rewards",
  vibe_graphs: "vibe_graphs",
  clan_invites: "clan_invites",
  clan_messages: "clan_messages",
  group_chats: "group_chats",
  group_messages: "group_messages",
  story_comments: "story_comments",
  watch_parties: "watch_parties",
  creator_payout_kycs: "creator_payout_kycs",
  friend_match_requests: "friend_match_requests",
  gifts: "gifts",
  matches: "matches",
  notifications: "notifications",
  notification_campaigns: "notification_campaigns",
  payout_reviews: "payout_reviews",
  pk_battles: "pk_battles",
  pk_events: "pk_events",
  pk_invites: "pk_invites",
  pk_leaderboard_entries: "pk_leaderboard_entries",
  pk_participants: "pk_participants",
  pk_votes: "pk_votes",
  media_objects: "media_objects",
  media_upload_sessions: "media_upload_sessions",
  media_quota_reservations: "media_quota_reservations"
};

/** Registry keyed by source collection name. Only reviewed mappings belong here. */
export const MAPPINGS: Record<string, RecordMapping> = {
  users: mapUser,
  auth_sessions: mapAuthSession,
  admin_sessions: mapAdminSession,
  device_tokens: mapDeviceToken,
  wallet_transactions: mapWalletTransaction,
  diamond_transactions: mapDiamondTransaction,
  purchases: mapPurchase,
  gift_transactions: mapGiftTransaction,
  withdrawal_requests: mapWithdrawalRequest,
  subscriptions: mapSubscription,
  admin_users: mapAdminUser,
  assets: mapAssetObject,
  friendships: mapFriendship,
  blocks: mapBlock,
  follows: mapFollow,
  clans: mapClan,
  direct_messages: mapDirectMessage,
  chat_messages: mapChatMessage,
  conversation_mutes: mapConversationMute,
  stories: mapStory,
  story_highlights: mapStoryHighlight,
  rooms: mapRoom,
  room_participants: mapRoomParticipant,
  room_invites: mapRoomInvite,
  room_follows: mapRoomFollow,
  room_mode_states: mapRoomModeState,
  room_reactions: mapRoomReaction,
  room_activities: mapRoomActivity,
  room_recordings: mapRoomRecording,
  speaker_requests: mapSpeakerRequest,
  polls: mapPoll,
  voice_polls: mapVoicePoll,
  achievements: mapAchievement,
  battle_passes: mapBattlePass,
  battle_pass_xp_grants: mapBattlePassXpGrant,
  seasons: mapSeason,
  missions: mapMission,
  user_missions: mapUserMission,
  daily_questions: mapDailyQuestion,
  user_daily_answers: mapUserDailyAnswer,
  mini_game_challenges: mapMiniGameChallenge,
  mini_game_scores: mapMiniGameScore,
  cosmetics: mapCosmetic,
  immersive_themes: mapImmersiveTheme,
  gift_collections: mapGiftCollection,
  gift_inventories: mapGiftInventory,
  wishlist_items: mapWishlistItem,
  reports: mapReport,
  moderation_queues: mapModerationQueue,
  moderation_actions: mapModerationAction,
  admin_audit_logs: mapAdminAuditLog,
  admin_moderation_actions: mapAdminModerationAction,
  support_tickets: mapSupportTicket,
  support_messages: mapSupportMessage,
  trust_verifications: mapTrustVerification,
  face_verification_submissions: mapFaceVerificationSubmission,
  voice_verification_submissions: mapVoiceVerificationSubmission,
  user_safety_statuses: mapUserSafetyStatus,
  app_config: mapAppConfig,
  countdown_events: mapCountdownEvent,
  events: mapEvent,
  xp_daily_caps: mapXpDailyCap,
  xp_grants: mapXpGrant,
  user_moods: mapUserMood,
  wave_nudges: mapWaveNudge,
  profile_visits: mapProfileVisit,
  likes: mapLike,
  referrals: mapReferral,
  relationships: mapRelationship,
  bonds: mapBond,
  bond_points: mapBondPoint,
  bond_ranking_snapshots: mapBondRankingSnapshot,
  bond_requests: mapBondRequest,
  bond_rewards: mapBondReward,
  vibe_graphs: mapVibeGraph,
  clan_invites: mapClanInvite,
  clan_messages: mapClanMessage,
  group_chats: mapGroupChat,
  group_messages: mapGroupMessage,
  story_comments: mapStoryComment,
  watch_parties: mapWatchParty,
  creator_payout_kycs: mapCreatorPayoutKyc,
  friend_match_requests: mapFriendMatchRequest,
  gifts: mapGift,
  matches: mapMatch,
  notifications: mapNotification,
  notification_campaigns: mapNotificationCampaign,
  payout_reviews: mapPayoutReview,
  pk_battles: mapPkBattle,
  pk_events: mapPkEvent,
  pk_invites: mapPkInvite,
  pk_leaderboard_entries: mapPkLeaderboardEntry,
  pk_participants: mapPkParticipant,
  pk_votes: mapPkVote,
  media_objects: mapMediaObject,
  media_upload_sessions: mapMediaUploadSession,
  media_quota_reservations: mapMediaQuotaReservation
};

export function getMapping(collection: string): RecordMapping | undefined {
  return MAPPINGS[collection];
}

export function applyMapping(collection: string, record: SourceRecord, context: TransformContext): MappedRecord {
  const mapping = getMapping(collection);
  if (!mapping) throw new Error(`No reviewed transform mapping for collection ${collection}`);
  context.source(collection);
  return mapping(record, context);
}
