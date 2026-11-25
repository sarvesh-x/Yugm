import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { getLevelStatus } from "../services/levelPresentation.js";
import { defaultNotificationPreferences } from "../services/notificationPreferences.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { ACTIVE_COSMETIC_KEYS, AVATAR_PART_KEYS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";
import { d1RoomProjection, presentD1Room } from "./d1Rooms.js";

type SqlValue = string | number | null;
type Row = Record<string, SqlValue>;
type UserRow = Row & {
  source_id: string;
  name: string;
  username: string;
  avatar: string | null;
  avatar_type: string | null;
  avatar_parts_background: number | null;
  avatar_parts_clothes: number | null;
  avatar_parts_head: number | null;
  avatar_parts_mouth: number | null;
  avatar_parts_eyes: number | null;
  avatar_parts_top: number | null;
  city: string | null;
  bio: string | null;
  last_daily_check_in_at: string | null;
  interests_json: string | null;
  languages_json: string | null;
  null_fields: string | null;
  followers_count: number;
  following_count: number;
  wallet_balance: number;
  xp: number;
  level: number;
  level_title: string;
  streak_count: number;
  vip_tier: string | null;
  vip_level: number;
  vip_exp: number;
  vip_started_at: string | null;
  vip_expires_at: string | null;
  vip_frozen: number;
  vip_freeze_started_at: string | null;
  muted_until: string | null;
  suspended_until: string | null;
  moderation_strikes: number;
  is_blocked: number;
  badge_revision: number | null;
  notification_preferences_room_invites: number;
  notification_preferences_messages: number;
  notification_preferences_gifts: number;
  notification_preferences_follows: number;
  notification_preferences_host_going_live: number;
  notification_preferences_wallet: number;
  notification_preferences_safety: number;
  notification_preferences_marketing: number;
};
type TierRow = {
  source_id: string;
  tier: string;
  target: number;
  reward_coins: number;
  reward_cosmetic: string | null;
  achievements_id: string;
  position: number;
};
type AchievementRow = Row & {
  source_id: string;
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  image_url: string | null;
  asset_ref: string | null;
  kind: string;
  metric: string | null;
  weekly_target: number | null;
  order: number;
  asset_id: string | null;
  asset_version: number | null;
  asset_public_url: string | null;
  asset_variants_json: string | null;
};
type AssetVariant = {
  name: string;
  url: string;
  contentType: string;
  width?: number;
  height?: number;
};
type BadgeAsset = { id: string; version: number; publicUrl?: string; variants: AssetVariant[] };
type Definition = {
  source_id: string;
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  image_url: string | null;
  kind: string;
  metric: string | null;
  weekly_target: number | null;
  order: number;
  tiers: TierRow[];
  asset?: BadgeAsset;
};
type ClaimTier = { achievementId: string; tier: string; claimedAt: string };
type BadgeGrant = {
  badgeId: string;
  tier?: string | null;
  earnedAt: string;
  expiresAt?: string | null;
};
type BadgeState = {
  revision: number | null;
  grants: BadgeGrant[];
  showcased: string[];
  claimedTiers: ClaimTier[];
  claimedIds: string[];
};
type ExperienceUser = {
  id: string;
  name: string;
  username: string;
  avatar?: string;
  avatarType: string | null;
  avatarParts: Record<string, unknown> | null;
  city?: string;
  bio?: string;
  interests: string[];
  languages: string[];
  followersCount: number;
  followingCount: number;
  activeCosmetics: Record<string, unknown>;
  xp: number;
  level: number;
  levelTitle: string;
  lastDailyCheckInAt?: string;
  streakCount: number;
  vipTier?: string | null;
  vipLevel: number;
  vipExp: number;
  vipStartedAt?: string;
  vipExpiresAt?: string;
  vipFrozen: boolean;
  vipFreezeStartedAt?: string;
  mutedUntil?: string;
  suspendedUntil?: string;
  moderationStrikes: number;
  isBlocked: boolean;
  notificationPreferences: typeof defaultNotificationPreferences;
};
type InboxRow = {
  source_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  read: number;
  created_at: string | null;
  updated_at: string | null;
};
type CompactUserRow = { source_id: string; user_json: string };
type BlockRow = {
  source_id: string;
  blocker_id: string;
  blocked_user_id: string;
  created_at: string | null;
  updated_at: string | null;
  user_json: string;
};
type InviteRow = {
  source_id: string;
  room_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  room_json: string | null;
  inviter_json: string;
};
type GiftRow = {
  source_id: string;
  sender_id: string;
  receiver_id: string;
  gift_id: string;
  room_id: string | null;
  coin_amount: number;
  diamond_amount: number;
  currency: string;
  type: string;
  combo_count: number;
  total_value: number;
  effect: string;
  metadata: string;
  created_at: string | null;
  updated_at: string | null;
  sender_json: string;
  gift_json: string | null;
  room_json: string | null;
};

const tierRank: Record<string, number> = {
  BRONZE: 0, SILVER: 1, GOLD: 2, PLATINUM: 3, DIAMOND: 4, MASTER: 5
};
const maxWornBadges = 5;
const weekMs = 7 * 86_400_000;
// Mirrors services/withdrawal.ts without importing its Mongoose-bound module.
const coinToInrRate = 0.01;

const column = (key: string) => key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
const present = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));
const parseArray = (value: string | null | undefined) => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};
const parseObject = (value: string | null | undefined) => {
  if (!value) return null;
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return null;
  }
};

// D1 limits the number of columns in a result set. The users table is wider
// than that limit, so only project the fields the experience DTOs actually use.
const userColumns = [
  "source_id", "name", "username", "avatar", "avatar_type",
  ...AVATAR_PART_KEYS.map(key => `avatar_parts_${key}`),
  "city", "bio", "last_daily_check_in_at", "followers_count", "following_count",
  "wallet_balance", "xp", "level", "level_title", "streak_count", "badge_revision",
  ...ACTIVE_COSMETIC_KEYS.map(key => `active_cosmetics_${column(key)}`),
  "vip_tier", "vip_level", "vip_exp", "vip_started_at", "vip_expires_at",
  "vip_frozen", "vip_freeze_started_at", "muted_until", "suspended_until",
  "moderation_strikes", "is_blocked",
  "notification_preferences_room_invites", "notification_preferences_messages",
  "notification_preferences_gifts", "notification_preferences_follows",
  "notification_preferences_host_going_live", "notification_preferences_wallet",
  "notification_preferences_safety", "notification_preferences_marketing"
];
const userSelect = `${userColumns.map(key => `u.${key}`).join(", ")}, p.null_fields AS null_fields,
  (SELECT json_group_array(value) FROM (
    SELECT value FROM user_interests WHERE users_id = u.source_id AND value IS NOT NULL ORDER BY position
  )) AS interests_json,
  (SELECT json_group_array(value) FROM (
    SELECT value FROM user_languages WHERE users_id = u.source_id AND value IS NOT NULL ORDER BY position
  )) AS languages_json`;
const fromUsers = "FROM users AS u LEFT JOIN user_auth_profile AS p ON p.source_id = u.source_id";

function compactUserJson(alias: string) {
  return `json_object('_id', ${alias}.source_id, 'name', ${alias}.name, 'username', ${alias}.username,
    'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
    'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}))`;
}

function parseCompactUser(record: string | null | undefined) {
  const parsed = parseObject(record);
  if (!parsed) return null;
  const { avatarParts, ...fields } = parsed;
  const parts = present((avatarParts ?? {}) as Record<string, unknown>);
  return {
    ...present(fields),
    ...(Object.keys(parts).length ? { avatarParts: parts } : {})
  };
}

function toUser(row: UserRow): ExperienceUser {
  const nulls = new Set<string>(parseArray(row.null_fields));
  const avatarParts = nulls.has("avatarParts") ? null : present(Object.fromEntries(
    AVATAR_PART_KEYS.map(key => [key, row[`avatar_parts_${key}`]])
  ));
  const activeCosmetics: Record<string, unknown> = {};
  if (!nulls.has("activeCosmetics")) {
    for (const key of ACTIVE_COSMETIC_KEYS) {
      const value = row[`active_cosmetics_${column(key)}`];
      if (nulls.has(`activeCosmetics.${key}`)) activeCosmetics[key] = null;
      else if (typeof value === "string") activeCosmetics[key] = value;
    }
  }
  return {
    id: row.source_id,
    name: row.name,
    username: row.username,
    avatar: row.avatar ?? undefined,
    avatarType: nulls.has("avatarType") ? null : row.avatar_type ?? null,
    avatarParts: avatarParts && Object.keys(avatarParts).length ? avatarParts : null,
    city: row.city ?? undefined,
    bio: row.bio ?? undefined,
    interests: parseArray(row.interests_json) as string[],
    languages: parseArray(row.languages_json) as string[],
    followersCount: row.followers_count,
    followingCount: row.following_count,
    activeCosmetics,
    xp: row.xp,
    level: row.level,
    levelTitle: row.level_title,
    lastDailyCheckInAt: row.last_daily_check_in_at ?? undefined,
    streakCount: row.streak_count,
    vipTier: row.vip_tier ?? undefined,
    vipLevel: row.vip_level,
    vipExp: row.vip_exp,
    vipStartedAt: row.vip_started_at ?? undefined,
    vipExpiresAt: row.vip_expires_at ?? undefined,
    vipFrozen: Boolean(row.vip_frozen),
    vipFreezeStartedAt: row.vip_freeze_started_at ?? undefined,
    mutedUntil: row.muted_until ?? undefined,
    suspendedUntil: row.suspended_until ?? undefined,
    moderationStrikes: row.moderation_strikes ?? 0,
    isBlocked: Boolean(row.is_blocked),
    notificationPreferences: {
      roomInvites: Boolean(row.notification_preferences_room_invites),
      messages: Boolean(row.notification_preferences_messages),
      gifts: Boolean(row.notification_preferences_gifts),
      follows: Boolean(row.notification_preferences_follows),
      hostGoingLive: Boolean(row.notification_preferences_host_going_live),
      wallet: Boolean(row.notification_preferences_wallet),
      safety: Boolean(row.notification_preferences_safety),
      marketing: Boolean(row.notification_preferences_marketing)
    }
  };
}

function readUser(db: D1Database, userId: string) {
  return db.prepare(`SELECT ${userSelect} ${fromUsers} WHERE u.source_id = ?`).bind(userId).first<UserRow>();
}

function publicUser(user: ExperienceUser | null) {
  if (!user) return null;
  const levelStatus = getLevelStatus(user);
  return {
    id: user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    avatarType: user.avatarType ?? null,
    avatarParts: user.avatarParts ?? null,
    city: user.city,
    interests: user.interests ?? [],
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    activeCosmetics: user.activeCosmetics ?? {},
    level: levelStatus.level,
    levelTitle: levelStatus.title,
    levelStatus,
    ...getVipStatus(user)
  };
}

function profileCompletion(user: ExperienceUser | null) {
  const checks = [
    { id: "name", label: "Name", done: Boolean(user?.name) },
    { id: "username", label: "Username", done: Boolean(user?.username) },
    { id: "avatar", label: "Avatar", done: Boolean(user?.avatar) },
    { id: "bio", label: "Bio", done: Boolean(user?.bio) },
    { id: "city", label: "City", done: Boolean(user?.city) },
    { id: "interests", label: "Interests", done: (user?.interests?.length ?? 0) >= 3 },
    { id: "languages", label: "Languages", done: (user?.languages?.length ?? 0) > 0 }
  ];
  const completed = checks.filter(item => item.done).length;
  return { checks, completed, total: checks.length, percent: Math.round((completed / checks.length) * 100) };
}

function streakEstimate(user: ExperienceUser | null, streakCount: number) {
  if (!user?.lastDailyCheckInAt) return 0;
  const last = new Date(user.lastDailyCheckInAt);
  const today = new Date();
  const lastUtcDay = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  const todayUtcDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dayGap = Math.floor((todayUtcDay - lastUtcDay) / 86_400_000);
  return dayGap <= 1 ? streakCount : 0;
}

async function readCatalog(db: D1Database) {
  const [rows, tierRows] = await db.batch<TierRow | AchievementRow>([
    db.prepare(`SELECT a.*, art.source_id AS asset_id, art.version AS asset_version, art.public_url AS asset_public_url,
      (SELECT json_group_array(json_object('name', name, 'url', url, 'contentType', content_type,
        'width', width, 'height', height)) FROM (
          SELECT name, url, content_type, width, height FROM asset_variants
          WHERE assets_id = art.source_id ORDER BY position
      )) AS asset_variants_json
      FROM achievements AS a LEFT JOIN assets AS art ON art.source_id = a.asset_ref
        AND art.status = 'published'
      WHERE a.hidden IS NULL OR a.hidden = 0 ORDER BY a."order", a.id`),
    db.prepare("SELECT * FROM achievement_tiers ORDER BY achievements_id, position")
  ]);
  const byParent = new Map<string, TierRow[]>();
  for (const tier of tierRows.results as TierRow[]) {
    const list = byParent.get(tier.achievements_id) ?? [];
    list.push(tier);
    byParent.set(tier.achievements_id, list);
  }
  return (rows.results as AchievementRow[]).map((row): Definition => {
    const variants = (parseArray(row.asset_variants_json) as AssetVariant[]).map(variant => ({
      name: String(variant.name),
      url: String(variant.url ?? ""),
      contentType: String(variant.contentType),
      ...(variant.width !== null && variant.width !== undefined ? { width: Number(variant.width) } : {}),
      ...(variant.height !== null && variant.height !== undefined ? { height: Number(variant.height) } : {})
    }));
    const definition: Definition = {
      source_id: row.source_id,
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      icon: row.icon,
      image_url: row.image_url ?? null,
      kind: row.kind,
      metric: row.metric ?? null,
      weekly_target: row.weekly_target ?? null,
      order: row.order,
      tiers: byParent.get(row.source_id) ?? []
    };
    if (row.asset_id) {
      const asset: BadgeAsset = {
        id: String(row.asset_id),
        version: Number(row.asset_version ?? 1),
        variants
      };
      if (row.asset_public_url) asset.publicUrl = String(row.asset_public_url);
      definition.asset = asset;
    }
    return definition;
  });
}

async function readBadgeState(db: D1Database, userId: string, requireUser = true) {
  const [user, grants, showcased, tiers, ids] = await db.batch<Row>([
    db.prepare("SELECT badge_revision FROM users WHERE source_id = ?").bind(userId),
    db.prepare(`SELECT badge_id, tier, earned_at, expires_at FROM user_badge_grants
      WHERE users_id = ? ORDER BY position`).bind(userId),
    db.prepare(`SELECT value FROM user_showcased_badges WHERE users_id = ? AND value IS NOT NULL ORDER BY position`).bind(userId),
    db.prepare(`SELECT achievement_id, tier, claimed_at FROM user_claimed_achievement_tiers
      WHERE users_id = ? ORDER BY position`).bind(userId),
    db.prepare(`SELECT value FROM user_claimed_achievements WHERE users_id = ? AND value IS NOT NULL ORDER BY position`).bind(userId)
  ]);
  const row = user.results[0] as { badge_revision: number | null } | undefined;
  if (!row) {
    if (requireUser) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    return { revision: null, grants: [], showcased: [], claimedTiers: [], claimedIds: [] } satisfies BadgeState;
  }
  return {
    revision: row.badge_revision ?? null,
    grants: (grants.results as Array<Record<string, string | null>>).map(grant => ({
      badgeId: String(grant.badge_id),
      tier: grant.tier ?? null,
      earnedAt: grant.earned_at ?? "",
      expiresAt: grant.expires_at ?? null
    })),
    showcased: (showcased.results as Array<{ value: string }>).map(item => item.value),
    claimedTiers: (tiers.results as Array<Record<string, string>>).map(item => ({
      achievementId: item.achievement_id,
      tier: item.tier,
      claimedAt: item.claimed_at
    })),
    claimedIds: (ids.results as Array<{ value: string }>).map(item => item.value)
  } satisfies BadgeState;
}

function grantsFor(state: BadgeState, definitions: Definition[]) {
  const grants = new Map<string, BadgeGrant>();
  for (const grant of state.grants) grants.set(grant.badgeId, grant);
  for (const claim of state.claimedTiers) {
    const existing = grants.get(claim.achievementId);
    if ((tierRank[claim.tier] ?? -1) > (tierRank[existing?.tier ?? ""] ?? -1)) {
      grants.set(claim.achievementId, {
        badgeId: claim.achievementId,
        tier: claim.tier,
        earnedAt: existing?.earnedAt ?? claim.claimedAt
      });
    }
  }
  for (const id of state.claimedIds) {
    const tier = definitions.find(def => def.id === id && def.kind !== "HONOR")?.tiers[0]?.tier;
    if (tier && !grants.has(id)) {
      grants.set(id, { badgeId: id, tier, earnedAt: "1970-01-01T00:00:00.000Z" });
    }
  }
  return grants;
}

function owned(definition: Definition, grant: BadgeGrant | undefined, now: Date) {
  if (!grant) return false;
  return definition.kind === "HONOR"
    ? Boolean(grant.expiresAt) && new Date(grant.expiresAt!).getTime() > now.getTime()
    : (tierRank[grant.tier ?? ""] ?? -1) >= 0 && !grant.expiresAt;
}

function badgePublicArt(definition: Definition) {
  const asset = definition.asset;
  const imageUrl = asset?.publicUrl
    ?? asset?.variants.find(variant => variant.name === "full")?.url
    ?? definition.image_url
    ?? "";
  return {
    imageUrl,
    ...(asset ? {
      assetId: asset.id,
      assetVersion: asset.version,
      assetVariants: asset.variants.map(variant => ({
        name: variant.name,
        url: variant.url,
        contentType: variant.contentType,
        ...(variant.width !== undefined ? { width: variant.width } : {}),
        ...(variant.height !== undefined ? { height: variant.height } : {})
      }))
    } : {})
  };
}

function publicBadge(definition: Definition, grant: BadgeGrant | undefined, now: Date) {
  const unlocked = owned(definition, grant, now);
  return {
    id: definition.id,
    title: definition.title,
    description: definition.description,
    icon: definition.icon,
    kind: definition.kind ?? "ACHIEVEMENT",
    category: definition.category,
    ...badgePublicArt(definition),
    unlocked,
    tier: unlocked ? grant?.tier ?? null : null,
    expiresAt: unlocked ? grant?.expiresAt : undefined,
    ...(definition.weekly_target !== null && definition.weekly_target !== undefined
      ? { weeklyTarget: definition.weekly_target }
      : {})
  };
}

function wornBadges(state: BadgeState, definitions: Definition[], now = new Date()) {
  const grants = grantsFor(state, definitions);
  const byId = new Map(definitions.map(def => [def.id, def]));
  return [...new Set(state.showcased)].flatMap(id => {
    const definition = byId.get(id);
    const grant = grants.get(id);
    return definition && owned(definition, grant, now) ? [publicBadge(definition, grant, now)] : [];
  }).slice(0, maxWornBadges);
}

async function syncBadgeState(
  db: D1Database,
  userId: string,
  definitions: Definition[],
  earned: BadgeGrant[],
  now: Date,
  selection?: string[]
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const state = await readBadgeState(db, userId);
    const grants = grantsFor(state, definitions);
    const newIds: string[] = [];
    for (const incoming of earned) {
      const previous = grants.get(incoming.badgeId);
      if (incoming.expiresAt) {
        if (previous?.expiresAt && previous.expiresAt >= incoming.expiresAt) continue;
        if (!previous?.expiresAt || previous.expiresAt <= now.toISOString()) newIds.push(incoming.badgeId);
      } else {
        if ((tierRank[previous?.tier ?? ""] ?? -1) >= (tierRank[incoming.tier ?? ""] ?? -1)) continue;
        if (!previous) newIds.push(incoming.badgeId);
      }
      grants.set(incoming.badgeId, {
        ...incoming,
        earnedAt: incoming.expiresAt ? incoming.earnedAt : previous?.earnedAt ?? incoming.earnedAt
      });
    }
    const nextGrants = [...grants.values()];
    const available = new Set(definitions.filter(def => owned(def, grants.get(def.id), now)).map(def => def.id));
    if (selection?.some(id => !available.has(id))) {
      throw new HttpError(400, "Only earned, active badges can be worn", ErrorCode.VALIDATION);
    }
    const wornIds = selection ?? [...new Set([...state.showcased, ...newIds])].filter(id => available.has(id)).slice(0, maxWornBadges);
    const serialize = (items: BadgeGrant[]) => items.map(item => ({
      badgeId: item.badgeId,
      tier: item.tier ?? null,
      earnedAt: item.earnedAt,
      expiresAt: item.expiresAt ?? null
    }));
    if (JSON.stringify(serialize(state.grants)) !== JSON.stringify(serialize(nextGrants)) ||
        JSON.stringify(state.showcased) !== JSON.stringify(wornIds)) {
      const guard = `EXISTS (SELECT 1 FROM users AS guard_user WHERE guard_user.source_id = ? AND guard_user.badge_revision IS ?)`;
      const revision = state.revision;
      const nextRevision = (revision ?? 0) + 1;
      const statements = [
        db.prepare(`DELETE FROM user_badge_grants WHERE users_id = ? AND ${guard}`)
          .bind(userId, userId, revision),
        ...nextGrants.map((grant, position) => db.prepare(`INSERT INTO user_badge_grants
          (source_id, badge_id, tier, earned_at, expires_at, users_id, position)
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`)
          .bind(`${userId}:badge:${position}`, grant.badgeId, grant.tier ?? null, grant.earnedAt,
            grant.expiresAt ?? null, userId, position, userId, revision)),
        db.prepare(`DELETE FROM user_showcased_badges WHERE users_id = ? AND ${guard}`)
          .bind(userId, userId, revision),
        ...wornIds.map((id, position) => db.prepare(`INSERT INTO user_showcased_badges
          (source_id, value, users_id, position) SELECT ?, ?, ?, ? WHERE ${guard}`)
          .bind(`${userId}:showcase:${position}`, id, userId, position, userId, revision)),
        db.prepare(`UPDATE users SET badge_revision = ?, updated_at = ? WHERE source_id = ? AND badge_revision IS ?`)
          .bind(nextRevision, now.toISOString(), userId, revision)
      ];
      const results = await db.batch(statements);
      if (!results[results.length - 1].meta.changes) continue;
    }
    return {
      wornIds,
      badges: definitions.map(def => publicBadge(def, grants.get(def.id), now))
    };
  }
  throw new HttpError(409, "Your badges changed. Refresh and try again.", ErrorCode.CONFLICT);
}

function weeklyHonorWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));
  return {
    from: new Date(start.getTime() - weekMs).toISOString(),
    start: start.toISOString(),
    expiresAt: new Date(start.getTime() + weekMs).toISOString()
  };
}

async function currentHonors(db: D1Database, userId: string, definitions: Definition[], now: Date) {
  const window = weeklyHonorWindow(now);
  const grants: BadgeGrant[] = [];
  for (const def of definitions.filter(item => item.kind === "HONOR" && item.weekly_target && item.metric)) {
    const target = Number(def.weekly_target);
    let count: number;
    if (def.metric === "host_3") {
      const row = await db.prepare(`SELECT COUNT(*) AS total FROM (
        SELECT 1 FROM rooms WHERE host_id = ? AND started_at >= ? AND started_at < ? LIMIT ?)`)
        .bind(userId, window.from, window.start, target).first<{ total: number }>();
      count = row?.total ?? 0;
    } else if (def.metric === "gift_5" || def.metric === "gift_received_5") {
      const actor = def.metric === "gift_5" ? "sender_id" : "receiver_id";
      const row = await db.prepare(`SELECT COUNT(*) AS total FROM (
        SELECT 1 FROM gift_transactions WHERE ${actor} = ? AND created_at >= ? AND created_at < ?
          AND type IN ('send', 'combo', 'room_wide') LIMIT ?)`)
        .bind(userId, window.from, window.start, target).first<{ total: number }>();
      count = row?.total ?? 0;
    } else {
      continue;
    }
    if (count >= target) {
      grants.push({ badgeId: def.id, earnedAt: window.start, expiresAt: window.expiresAt });
    }
  }
  return grants;
}

function buildTierInfo(achievement: Definition, currentProgress: number, claimedTiers: Set<string>) {
  const activeTier = achievement.tiers.slice().reverse().find(tier => currentProgress >= tier.target) ?? null;
  const nextTierData = achievement.tiers.find(tier => !claimedTiers.has(`${achievement.id}:${tier.tier}`)) ?? null;
  const tiers = achievement.tiers.map(tier => ({
    tier: tier.tier,
    target: tier.target,
    rewardCoins: tier.reward_coins,
    rewardCosmetic: tier.reward_cosmetic ?? undefined,
    reached: currentProgress >= tier.target,
    claimed: claimedTiers.has(`${achievement.id}:${tier.tier}`)
  }));
  let highestClaimedTier: string | null = null;
  for (const tier of achievement.tiers) {
    if (claimedTiers.has(`${achievement.id}:${tier.tier}`)) highestClaimedTier = tier.tier;
  }
  const allTiersClaimed = achievement.tiers.every(tier => claimedTiers.has(`${achievement.id}:${tier.tier}`));
  const canClaim = nextTierData !== null && currentProgress >= nextTierData.target;
  return {
    progress: Math.min(currentProgress, nextTierData?.target ?? activeTier?.target ?? 0),
    total: nextTierData?.target ?? (activeTier?.target ?? 0),
    currentTier: activeTier?.tier ?? null,
    highestClaimedTier,
    tiers,
    nextTier: nextTierData?.tier ?? null,
    canClaim,
    canUpgrade: activeTier !== null && canClaim,
    complete: allTiersClaimed
  };
}

async function buildAchievements(
  db: D1Database,
  userId: string,
  user: ExperienceUser | null,
  catalog: Definition[],
  state: BadgeState
) {
  const counts = await db.prepare(`SELECT
    (SELECT COUNT(*) FROM follows WHERE follower_id = ?1) AS following_count,
    (SELECT COUNT(*) FROM rooms WHERE host_id = ?1) AS hosted_rooms,
    (SELECT COUNT(*) FROM gift_transactions WHERE sender_id = ?1) AS sent_gifts,
    (SELECT COUNT(*) FROM chat_messages WHERE sender_id = ?1) AS chat_messages,
    (SELECT COUNT(DISTINCT room_id) FROM room_participants WHERE user_id = ?1) AS joined_rooms,
    (SELECT COUNT(*) FROM mini_game_scores WHERE user_id = ?1) AS games_played,
    (SELECT COUNT(*) FROM gift_transactions WHERE receiver_id = ?1) AS received_gifts`).bind(userId).first<Row>();
  const raw: Record<string, number> = {
    profile_complete: profileCompletion(user).percent,
    daily_streak_3: streakEstimate(user, user?.streakCount ?? 0),
    follow_10: Number(counts?.following_count ?? 0),
    host_3: Number(counts?.hosted_rooms ?? 0),
    gift_5: Number(counts?.sent_gifts ?? 0),
    chat_25: Number(counts?.chat_messages ?? 0),
    level_5: getLevelStatus(user).level,
    room_join_10: Number(counts?.joined_rooms ?? 0),
    game_plays_10: Number(counts?.games_played ?? 0),
    gift_received_5: Number(counts?.received_gifts ?? 0)
  };
  const claimed = new Set(state.claimedTiers.map(claim => `${claim.achievementId}:${claim.tier}`));
  return catalog.filter(achievement => achievement.kind !== "HONOR").map(achievement => {
    const progress = raw[achievement.metric ?? achievement.id] ?? 0;
    const tierInfo = buildTierInfo(achievement, progress, claimed);
    return {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      category: achievement.category,
      icon: achievement.icon,
      order: achievement.order,
      progress: tierInfo.progress,
      total: tierInfo.total,
      currentTier: tierInfo.currentTier,
      highestClaimedTier: tierInfo.highestClaimedTier,
      tiers: tierInfo.tiers,
      nextTier: tierInfo.nextTier,
      canClaim: tierInfo.canClaim,
      canUpgrade: tierInfo.canUpgrade,
      complete: tierInfo.complete
    };
  });
}

async function loadBadgeGallery(db: D1Database, userId: string, row: UserRow | null, catalog: Definition[]) {
  if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const user = toUser(row);
  const state = await readBadgeState(db, userId);
  const achievements = await buildAchievements(db, userId, user, catalog, state);
  const now = new Date();
  const earned: BadgeGrant[] = achievements.flatMap(item => item.currentTier
    ? [{ badgeId: item.id, tier: item.currentTier, earnedAt: now.toISOString() }]
    : []);
  const honors = await currentHonors(db, userId, catalog, now);
  const synced = await syncBadgeState(db, userId, catalog, [...earned, ...honors], now);
  const progress = new Map(achievements.map(item => [item.id, item]));
  return {
    user: {
      name: user.name,
      avatar: user.avatar,
      avatarType: user.avatarType ?? null,
      avatarParts: user.avatarParts ?? null
    },
    capacity: maxWornBadges,
    wornIds: synced.wornIds,
    badges: synced.badges.map(badge => ({ ...progress.get(badge.id), ...badge }))
  };
}

function presentNotification(row: InboxRow) {
  return {
    _id: row.source_id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    data: row.data === null ? undefined : parseObject(row.data) ?? undefined,
    read: Boolean(row.read),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    __v: 0
  };
}

function presentBlock(row: BlockRow) {
  return {
    _id: row.source_id,
    blockerId: row.blocker_id,
    blockedUserId: parseCompactUser(row.user_json),
    createdAt: row.created_at ?? undefined,
    __v: 0
  };
}

function presentInvite(row: InviteRow) {
  return {
    _id: row.source_id,
    roomId: parseObject(row.room_json),
    inviterId: parseCompactUser(row.inviter_json),
    inviteeId: row.invitee_id,
    status: row.status,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    __v: 0
  };
}

function presentGift(row: GiftRow) {
  return {
    _id: row.source_id,
    senderId: parseCompactUser(row.sender_json),
    receiverId: row.receiver_id,
    giftId: parseObject(row.gift_json),
    roomId: parseObject(row.room_json),
    coinAmount: row.coin_amount,
    diamondAmount: row.diamond_amount,
    currency: row.currency,
    type: row.type,
    comboCount: row.combo_count,
    totalValue: row.total_value,
    effect: row.effect,
    metadata: parseObject(row.metadata) ?? {},
    createdAt: row.created_at ?? undefined,
    __v: 0
  };
}

function presentExperienceRoom(row: Row, populateHost = true) {
  return { ...presentD1Room(row, populateHost), __v: 0 };
}

const notificationPreferenceSchema = z.object({
  roomInvites: z.boolean().default(true),
  messages: z.boolean().default(true),
  gifts: z.boolean().default(true),
  follows: z.boolean().default(true),
  hostGoingLive: z.boolean().default(true),
  wallet: z.boolean().default(true),
  safety: z.boolean().default(true),
  marketing: z.boolean().default(false)
});
const showcasedBadgeSchema = z.object({
  badgeIds: z.array(z.string().min(1).max(64)).max(maxWornBadges)
    .refine(ids => new Set(ids).size === ids.length, "Choose different badges for each slot")
});

const homeResponseCache = new Map<string, { payload: unknown; expiresAt: number }>();
const HOME_CACHE_TTL_MS = 20_000;

export function createD1ExperienceRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    res.locals.experienceUserId = user.id;
    next();
  });
  const userIdOf = (res: { locals: Record<string, unknown> }) => res.locals.experienceUserId as string;

  // Scope the guard to this router's paths so unrelated `/api/*` requests are
  // not challenged before later routers or the fallback get a chance to answer.
  router.use("/experience", authenticate);

  router.get("/experience/notification-preferences", asyncHandler(async (_req, res) => {
    const row = await readUser(db, userIdOf(res));
    sendOk(res, { preferences: { ...defaultNotificationPreferences, ...(row ? toUser(row).notificationPreferences : {}) } });
  }));

  router.put("/experience/notification-preferences", validateBody(notificationPreferenceSchema.partial()), asyncHandler(async (req, res) => {
    const userId = userIdOf(res);
    const row = await readUser(db, userId);
    const current = { ...defaultNotificationPreferences, ...(row ? toUser(row).notificationPreferences : {}) };
    const preferences = { ...current, ...req.body } as typeof defaultNotificationPreferences;
    await db.prepare(`UPDATE users SET notification_preferences_room_invites = ?,
      notification_preferences_messages = ?, notification_preferences_gifts = ?, notification_preferences_follows = ?,
      notification_preferences_host_going_live = ?, notification_preferences_wallet = ?, notification_preferences_safety = ?,
      notification_preferences_marketing = ?, updated_at = ? WHERE source_id = ?`)
      .bind(Number(preferences.roomInvites), Number(preferences.messages), Number(preferences.gifts),
        Number(preferences.follows), Number(preferences.hostGoingLive), Number(preferences.wallet),
        Number(preferences.safety), Number(preferences.marketing), new Date().toISOString(), userId).run();
    sendOk(res, { preferences });
  }));

  router.get("/experience/achievements", asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const [row, catalog, state] = await Promise.all([readUser(db, userId), readCatalog(db), readBadgeState(db, userId, false)]);
    const achievements = await buildAchievements(db, userId, row ? toUser(row) : null, catalog, state);
    sendOk(res, { schemaVersion: 1, achievements });
  }));

  router.post("/experience/achievements/claim", asyncHandler(async (req, res) => {
    const { achievementId } = z.object({ achievementId: z.string().min(1) }).parse(req.body);
    const userId = userIdOf(res);
    const row = await readUser(db, userId);
    if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const user = toUser(row);
    const catalog = await readCatalog(db);
    const achievement = catalog.find(def => def.id === achievementId && def.kind !== "HONOR");
    if (!achievement) throw new HttpError(404, "Achievement not found", ErrorCode.NOT_FOUND);
    const state = await readBadgeState(db, userId);
    const entry = (await buildAchievements(db, userId, user, catalog, state)).find(item => item.id === achievementId);
    if (!entry) throw new HttpError(404, "Achievement not found", ErrorCode.NOT_FOUND);

    // Legacy picks one tier from the user it read, then commits that exact tier
    // inside a transaction. Recomputing it on retry would advance past a replay.
    const claimedTiers = new Set(state.claimedTiers.map(claim => `${claim.achievementId}:${claim.tier}`));
    const nextTier = achievement.tiers.find(tier => !claimedTiers.has(`${achievement.id}:${tier.tier}`));
    if (!nextTier) throw new HttpError(409, "All tiers already claimed", ErrorCode.CONFLICT);
    if (entry.progress < nextTier.target) {
      throw new HttpError(400, `Reach ${nextTier.target} to unlock ${nextTier.tier}`, ErrorCode.VALIDATION);
    }

    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await readUser(db, userId);
      if (!current) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

      const time = new Date().toISOString();
      const balance = current.wallet_balance;
      const reward = nextTier.reward_coins;
      const claimGuard = "NOT EXISTS (SELECT 1 FROM user_claimed_achievement_tiers WHERE users_id = ? AND achievement_id = ? AND tier = ?)";
      const stateGuard = "EXISTS (SELECT 1 FROM users AS guard_user WHERE guard_user.source_id = ? AND guard_user.wallet_balance = ?)";
      const claimValues: Array<string | number | null> = [userId, achievementId, nextTier.tier];
      const stateValues: Array<string | number | null> = [userId, balance];
      const position = state.claimedTiers.length;
      // The first statement inserts the claim row. Later statements in the same
      // batch must not re-check that row or they would all skip. They use
      // deterministic source_ids instead, and the unchanged wallet balance is
      // the shared optimistic-concurrency guard.
      const markerId = `${userId}:achievement:${achievementId}`;
      const walletId = `${markerId}:${nextTier.tier}:wallet`;
      const cosmeticId = `${markerId}:${nextTier.tier}:cosmetic`;
      const statements = [
        db.prepare(`INSERT INTO user_claimed_achievement_tiers
          (source_id, achievement_id, tier, claimed_at, users_id, position)
          SELECT ?, ?, ?, ?, ?, ? WHERE ${claimGuard} AND ${stateGuard}`)
          .bind(newId(), achievementId, nextTier.tier, time, userId, position,
            ...claimValues, ...stateValues),
        db.prepare(`INSERT INTO user_claimed_achievements (source_id, value, users_id, position)
          SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM user_claimed_achievements WHERE source_id = ?)
            AND NOT EXISTS (SELECT 1 FROM user_claimed_achievements WHERE users_id = ? AND value = ?)
            AND ${stateGuard}`)
          .bind(markerId, achievementId, userId, position, markerId, userId, achievementId, ...stateValues)
      ];
      if (nextTier.reward_cosmetic) {
        statements.push(db.prepare(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
          SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM user_owned_cosmetics WHERE users_id = ?), 0)
          WHERE NOT EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE source_id = ?)
            AND NOT EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE users_id = ? AND value = ?)
            AND ${stateGuard}`)
          .bind(cosmeticId, nextTier.reward_cosmetic, userId, userId, cosmeticId,
            userId, nextTier.reward_cosmetic, ...stateValues));
      }
      if (reward > 0) {
        statements.push(db.prepare(`INSERT INTO wallet_transactions
          (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
          SELECT ?, ?, 'CREDIT', 'LEVEL_REWARD', ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?) AND ${stateGuard}`)
          .bind(walletId, userId, reward, balance, balance + reward,
            JSON.stringify({ achievementId, tier: nextTier.tier }), time, time, time,
            walletId, ...stateValues));
      }
      statements.push(db.prepare(`UPDATE users SET wallet_balance = ?, updated_at = ?
        WHERE source_id = ? AND wallet_balance = ?`)
        .bind(balance + reward, time, userId, balance));

      const results = await db.batch(statements);
      if (!results[0].meta.changes) {
        const replay = await db.prepare(`SELECT 1 FROM user_claimed_achievement_tiers
          WHERE users_id = ? AND achievement_id = ? AND tier = ?`).bind(...claimValues).first();
        if (replay) throw new HttpError(409, "This achievement tier has already been claimed", ErrorCode.CONFLICT);
        continue;
      }
      await db.prepare(`INSERT INTO notifications
        (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        VALUES (?, ?, 'SYSTEM', 'Achievement unlocked', ?, ?, 0, ?, ?)`)
        .bind(newId(), userId, `${achievement.title} · ${nextTier.tier}`,
          JSON.stringify({ type: "ACHIEVEMENT_UNLOCKED", achievementId, tier: nextTier.tier }), time, time)
        .run().catch(() => undefined);
      sendOk(res, {
        claimed: true,
        tier: nextTier.tier,
        rewardCoins: reward,
        rewardCosmetic: nextTier.reward_cosmetic ?? undefined
      });
      return;
    }
    throw new HttpError(409, "Achievement changed. Please try again.", ErrorCode.CONFLICT);
  }));

  router.post("/experience/achievements/:id/share", asyncHandler(async (req, res) => {
    const catalog = await readCatalog(db);
    const achievement = catalog.find(def => def.id === req.params.id && def.kind !== "HONOR");
    if (!achievement) throw new HttpError(404, "Achievement not found", ErrorCode.NOT_FOUND);
    const state = await readBadgeState(db, userIdOf(res), false);
    const highestTier = achievement.tiers.slice().reverse().find(tier =>
      state.claimedTiers.some(claim => claim.achievementId === achievement.id && claim.tier === tier.tier));
    if (!highestTier) throw new HttpError(403, "Claim this achievement before sharing it", ErrorCode.FORBIDDEN);
    sendOk(res, {
      shareText: `🏆 I earned "${achievement.title}" (${highestTier.tier}) on Yugm!\n${achievement.description}\n\nMatch the vibe.`,
      achievement: {
        id: achievement.id,
        title: achievement.title,
        tier: highestTier.tier,
        icon: achievement.icon
      }
    });
  }));

  router.get("/experience/badges", asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const [row, catalog] = await Promise.all([readUser(db, userId), readCatalog(db)]);
    sendOk(res, await loadBadgeGallery(db, userId, row, catalog));
  }));

  router.put("/experience/badges/showcase", validateBody(showcasedBadgeSchema), asyncHandler(async (req, res) => {
    const { badgeIds } = req.body as z.infer<typeof showcasedBadgeSchema>;
    const state = await syncBadgeState(db, userIdOf(res), await readCatalog(db), [], new Date(), badgeIds);
    sendOk(res, { badgeIds: state.wornIds });
  }));

  router.get("/experience/badges/showcase/:userId", asyncHandler(async (req, res) => {
    const userId = d1UserId(req.params.userId);
    if (userId === userIdOf(res)) {
      const gallery = await loadBadgeGallery(db, userId, await readUser(db, userId), await readCatalog(db));
      const badges = new Map(gallery.badges.map(badge => [badge.id, badge]));
      sendOk(res, {
        capacity: maxWornBadges,
        badges: gallery.wornIds.map(id => badges.get(id)).filter(Boolean)
      });
      return;
    }
    const [row, catalog] = await Promise.all([readBadgeState(db, userId), readCatalog(db)]);
    sendOk(res, { capacity: maxWornBadges, badges: wornBadges(row, catalog) });
  }));

  router.get("/experience/safety-center", asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const [row, blocked, reportsSent, unreadSafety] = await Promise.all([
      readUser(db, userId),
      db.prepare(`SELECT b.*, (SELECT ${compactUserJson("u")} FROM users AS u WHERE u.source_id = b.blocked_user_id) AS user_json
        FROM blocks AS b WHERE b.blocker_id = ? ORDER BY b.created_at DESC, b.source_id DESC LIMIT 20`).bind(userId).all<BlockRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM reports WHERE reporter_id = ?").bind(userId).first<{ total: number }>(),
      db.prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND type = 'SYSTEM' AND read = 0")
        .bind(userId).first<{ total: number }>()
    ]);
    const user = row ? toUser(row) : null;
    sendOk(res, {
      trust: {
        label: user?.isBlocked ? "Restricted" : user?.mutedUntil ? "Limited" : "Good standing",
        mutedUntil: user?.mutedUntil,
        suspendedUntil: user?.suspendedUntil,
        strikes: user?.moderationStrikes ?? 0
      },
      checklist: [
        { id: "block", title: "Block people who cross lines", done: blocked.results.length > 0 },
        { id: "report", title: "Report unsafe behavior", done: (reportsSent?.total ?? 0) > 0 },
        { id: "privacy", title: "Keep personal info private", done: true },
        { id: "alerts", title: "Review safety alerts", done: (unreadSafety?.total ?? 0) === 0 }
      ],
      blockedUsers: blocked.results.map(presentBlock)
    });
  }));

  router.get("/experience/creator-dashboard", asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const since = new Date(Date.now() - 30 * 86_400_000).toISOString();
    const [summaryRows, roomRows, hostedRows, participantRows, giftRows, scheduledRows, supporterRows] = await db.batch([
      db.prepare(`SELECT COALESCE(SUM(coin_amount), 0) AS coins, COUNT(*) AS count,
        COUNT(DISTINCT sender_id) AS supporters FROM gift_transactions WHERE receiver_id = ? AND created_at >= ?`)
        .bind(userId, since),
      db.prepare(`SELECT ${d1RoomProjection} ${fromRoomsJoin()} WHERE r.host_id = ? AND r.created_at >= ?
        ORDER BY r.created_at DESC, r.source_id DESC LIMIT 10`).bind(userId, since),
      db.prepare("SELECT COUNT(*) AS total FROM rooms WHERE host_id = ? AND created_at >= ?").bind(userId, since),
      db.prepare(`SELECT COUNT(*) AS visits, COUNT(DISTINCT user_id) AS people FROM room_participants
        WHERE joined_at >= ? AND room_id IN (SELECT source_id FROM rooms WHERE host_id = ? AND created_at >= ?)`)
        .bind(since, userId, since),
      db.prepare(`SELECT gt.*,
        (SELECT ${compactUserJson("u")} FROM users AS u WHERE u.source_id = gt.sender_id) AS sender_json,
        (SELECT json_object('_id', g.source_id, 'name', g.name, 'icon', g.icon, 'coinPrice', g.coin_price)
          FROM gifts AS g WHERE g.source_id = gt.gift_id) AS gift_json,
        (SELECT json_object('_id', r.source_id, 'title', r.title) FROM rooms AS r WHERE r.source_id = gt.room_id) AS room_json
        FROM gift_transactions AS gt WHERE gt.receiver_id = ? AND gt.created_at >= ?
        ORDER BY gt.created_at DESC, gt.source_id DESC LIMIT 8`).bind(userId, since),
      db.prepare(`SELECT ${d1RoomProjection} ${fromRoomsJoin()} WHERE r.host_id = ? AND r.status = 'SCHEDULED'
        AND r.scheduled_for >= ? ORDER BY r.scheduled_for ASC, r.source_id ASC LIMIT 8`).bind(userId, new Date().toISOString()),
      db.prepare(`SELECT sender_id, SUM(coin_amount) AS coins, COUNT(*) AS gifts FROM gift_transactions
        WHERE receiver_id = ? AND created_at >= ? GROUP BY sender_id ORDER BY coins DESC LIMIT 5`)
        .bind(userId, since)
    ]);
    const summary = summaryRows.results[0] as { coins: number; count: number; supporters: number };
    const participants = participantRows.results[0] as { visits: number; people: number };
    const hostedRooms = Number((hostedRows.results[0] as { total: number }).total);
    const supporters = supporterRows.results as Array<{ sender_id: string; coins: number; gifts: number }>;
    const supporterRowsData = supporters.length
      ? (await db.prepare(`SELECT ${userSelect} ${fromUsers} WHERE u.source_id IN (SELECT value FROM json_each(?))`)
        .bind(JSON.stringify(supporters.map(row => row.sender_id))).all<UserRow>()).results
      : [];
    const supporterMap = new Map(supporterRowsData.map(row => [row.source_id, parseCompactUser(JSON.stringify({
      _id: row.source_id, name: row.name, username: row.username, avatar: row.avatar,
      avatarType: row.avatar_type, avatarParts: Object.fromEntries(AVATAR_PART_KEYS.map(key => [key, row[`avatar_parts_${key}`]]))
    }))]));
    const scheduled = scheduledRows.results as Row[];
    const topSupporters = supporters.map(row => ({
      _id: row.sender_id,
      coins: row.coins,
      gifts: row.gifts,
      user: supporterMap.get(row.sender_id) ?? null
    }));
    const nextSteps = [
      ...(scheduled.length ? [] : ["Schedule one room for your strongest topic"]),
      ...(hostedRooms ? ["Invite followers before your next live room"] : ["Host your first room this month"]),
      ...(summary.count ? ["Thank your top supporters after the room"] : ["Create a repeatable room format supporters recognize"]),
      "Pin a poll in the first five minutes"
    ].slice(0, 4);
    sendOk(res, {
      windowDays: 30,
      summary: {
        giftCoins: summary.coins,
        giftCount: summary.count,
        uniqueSupporters: summary.supporters,
        hostedRooms,
        participants: participants.visits,
        uniqueParticipants: participants.people,
        averageParticipants: hostedRooms ? Math.round((participants.visits / hostedRooms) * 10) / 10 : 0,
        estimatedInr: Math.round(summary.coins * coinToInrRate * 100) / 100
      },
      rooms: (roomRows.results as Row[]).map(row => presentExperienceRoom(row, false)),
      scheduledRooms: scheduled.map(row => presentExperienceRoom(row, false)),
      gifts: (giftRows.results as GiftRow[]).map(presentGift),
      topSupporters,
      nextSteps
    });
  }));

  router.get("/experience/home", asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const cached = homeResponseCache.get(userId);
    if (cached && cached.expiresAt > Date.now()) return sendOk(res, cached.payload);

    const [row, blockedIds, followingRows, catalog, state] = await Promise.all([
      readUser(db, userId),
      db.prepare(`SELECT CASE WHEN blocker_id = ? THEN blocked_user_id ELSE blocker_id END AS other_id
        FROM blocks WHERE blocker_id = ? OR blocked_user_id = ?`).bind(userId, userId, userId).all<{ other_id: string }>(),
      db.prepare("SELECT following_id FROM follows WHERE follower_id = ?").bind(userId).all<{ following_id: string }>(),
      readCatalog(db),
      readBadgeState(db, userId, false)
    ]);
    const hiddenIds = blockedIds.results.map(item => item.other_id);
    const followingIds = followingRows.results.map(item => item.following_id);
    const excluded = JSON.stringify([userId, ...followingIds, ...hiddenIds]);
    const followingJson = JSON.stringify(followingIds);
    const now = new Date().toISOString();

    const [recommendedRows, scheduledRows, socialRows, suggestedRows, notifications, unread, invites] = await db.batch([
      db.prepare(`SELECT ${d1RoomProjection} ${fromRoomsJoin()} WHERE r.status = 'LIVE' AND r.visibility = 'PUBLIC'
        ORDER BY r.participant_count DESC, r.created_at DESC, r.source_id DESC LIMIT 8`),
      db.prepare(`SELECT ${d1RoomProjection} ${fromRoomsJoin()} WHERE r.status = 'SCHEDULED' AND r.visibility = 'PUBLIC'
        ORDER BY r.scheduled_for ASC, r.source_id ASC LIMIT 6`),
      db.prepare(`SELECT ${d1RoomProjection} ${fromRoomsJoin()} WHERE r.status = 'LIVE' AND r.visibility = 'PUBLIC'
        AND r.host_id IN (SELECT value FROM json_each(?)) ORDER BY r.participant_count DESC, r.created_at DESC, r.source_id DESC LIMIT 6`)
        .bind(followingJson),
      db.prepare(`SELECT ${userSelect} ${fromUsers}
        WHERE u.source_id NOT IN (SELECT value FROM json_each(?)) AND u.is_blocked = 0
        ORDER BY u.vip_expires_at DESC, u.level DESC, u.followers_count DESC, u.created_at DESC, u.source_id DESC LIMIT 8`)
        .bind(excluded),
      db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 5").bind(userId),
      db.prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read = 0").bind(userId),
      db.prepare(`SELECT i.source_id, i.room_id, i.inviter_id, i.invitee_id, i.status, i.created_at, i.updated_at,
        (SELECT json_object('_id', r.source_id, 'title', r.title, 'type', r.type, 'status', r.status, 'hostId', r.host_id)
          FROM rooms AS r WHERE r.source_id = i.room_id) AS room_json,
        (SELECT ${compactUserJson("u")} FROM users AS u WHERE u.source_id = i.inviter_id) AS inviter_json
        FROM room_invites AS i WHERE i.invitee_id = ? AND i.status = 'PENDING'
        ORDER BY i.created_at DESC, i.source_id DESC LIMIT 5`).bind(userId)
    ]);
    const user = row ? toUser(row) : null;
    const achievements = await buildAchievements(db, userId, user, catalog, state);
    const earned: BadgeGrant[] = achievements.flatMap(item => item.currentTier
      ? [{ badgeId: item.id, tier: item.currentTier, earnedAt: now }]
      : []);
    // Legacy leaves this badge sync non-blocking; the home response must not
    // wait for a write that is not part of its authoritative read set.
    if (user && earned.length) {
      void syncBadgeState(db, userId, catalog, earned, new Date()).catch(() => undefined);
    }
    const recommended = (recommendedRows.results as Row[]).map(row => presentExperienceRoom(row));
    const socialRowsData = socialRows.results as Row[];
    const social = socialRowsData.map(row => presentExperienceRoom(row));
    const hostNames = new Map(socialRowsData.map(row => {
      const host = parseObject(String(row.host_json));
      return [String(row.host_id), host && typeof host.name === "string" ? host.name : "A host"] as const;
    }));
    const suggested = (suggestedRows.results as UserRow[]).flatMap(item => {
      const presented = publicUser(toUser(item));
      return presented ? [presented] : [];
    });
    const payload = {
      schemaVersion: 1,
      user: publicUser(user),
      profileCompletion: profileCompletion(user),
      level: getLevelStatus(user),
      achievements,
      feed: [
        ...social.map(room => ({
          type: "FOLLOWING_LIVE",
          title: `${hostNames.get(String(room.hostId)) ?? "A host"} is live`,
          room
        })),
        ...recommended.map(room => ({ type: "TRENDING_ROOM", title: room.title, room })),
        ...suggested.slice(0, 4).map(host => ({ type: "SUGGESTED_HOST", title: `Meet ${host.name}`, user: host }))
      ].slice(0, 14),
      rooms: {
        live: recommended,
        scheduled: (scheduledRows.results as Row[]).map(row => presentExperienceRoom(row)),
        following: social
      },
      people: { suggestedHosts: suggested },
      notifications: {
        unreadCount: Number((unread.results[0] as { total: number }).total),
        recent: (notifications.results as InboxRow[]).map(presentNotification)
      },
      invites: (invites.results as InviteRow[]).map(presentInvite),
      quickActions: [
        { id: "create_room", title: "Host a room", route: "/room/create" },
        { id: "check_in", title: "Daily check-in", route: "/(tabs)/profile" },
        { id: "earnings", title: "Creator dashboard", route: "/(tabs)/grow" },
        { id: "safety", title: "Safety center", route: "/(tabs)/grow" }
      ]
    };
    homeResponseCache.set(userId, { payload, expiresAt: Date.now() + HOME_CACHE_TTL_MS });
    if (homeResponseCache.size > 500) {
      const oldest = homeResponseCache.keys().next().value;
      if (oldest) homeResponseCache.delete(oldest);
    }
    sendOk(res, payload);
  }));

  return router;
}

function fromRoomsJoin() {
  return "FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id";
}

function d1UserId(value: string) {
  // Mongoose also accepts a 12-character string, which still resolves to no D1 row.
  if (!isValidObjectId(value) && value.length !== 12) {
    throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  }
  return value;
}
