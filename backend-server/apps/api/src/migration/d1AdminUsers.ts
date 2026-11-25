import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { AVATAR_PART_KEYS, ACTIVE_COSMETIC_KEYS } from "./authProfileFields.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";
import { endD1UnavailableBonds } from "./d1Bonds.js";

type Row = Record<string, string | number | null>;
type ChildArrays = {
  interests: string[];
  hobbies: string[];
  languages: string[];
  ownedCosmeticIds: string[];
  ownedTitles: string[];
  claimedAchievementIds: string[];
  claimedAchievementTiers: Array<{ achievementId: string; tier: string; claimedAt?: string }>;
  showcasedBadgeIds: string[];
  badgeGrants: Array<{ badgeId: string; tier?: string; earnedAt: string; expiresAt?: string }>;
  profileMedia: Array<{ url: string; type: string; caption?: string; createdAt?: string }>;
};

function bool(value: unknown) { return Boolean(value); }
function text(value: unknown) { return value === null || value === undefined ? undefined : String(value); }
function num(value: unknown, fallback = 0) { return value === null || value === undefined ? fallback : Number(value); }
function date(value: unknown) { return value === null || value === undefined ? undefined : String(value); }

function presentParts(row: Row) {
  const parts = Object.fromEntries(AVATAR_PART_KEYS.map((key) => [key, row[`avatar_parts_${key}`]]));
  return Object.values(parts).some((value) => value !== null && value !== undefined) ? parts : undefined;
}

function presentActiveCosmetics(row: Row) {
  const result: Record<string, string | null> = {};
  for (const key of ACTIVE_COSMETIC_KEYS) {
    const column = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    const value = row[`active_cosmetics_${column}`];
    result[key] = typeof value === "string" ? value : null;
  }
  return result;
}

async function readChildArrays(db: D1Database, userId: string): Promise<ChildArrays> {
  const [interests, hobbies, languages, ownedCosmetics, ownedTitles, claimedAchievements, claimedTiers, showcased, badgeGrants, profileMedia] = await Promise.all([
    db.prepare("SELECT value FROM user_interests WHERE users_id = ? ORDER BY position").bind(userId).all<{ value: string | null }>(),
    db.prepare("SELECT value FROM user_hobbies WHERE users_id = ? ORDER BY position").bind(userId).all<{ value: string | null }>(),
    db.prepare("SELECT value FROM user_languages WHERE users_id = ? ORDER BY position").bind(userId).all<{ value: string | null }>(),
    db.prepare("SELECT value FROM user_owned_cosmetics WHERE users_id = ? ORDER BY position").bind(userId).all<{ value: string | null }>(),
    db.prepare("SELECT value FROM user_owned_titles WHERE users_id = ? ORDER BY position").bind(userId).all<{ value: string | null }>(),
    db.prepare("SELECT value FROM user_claimed_achievements WHERE users_id = ? ORDER BY position").bind(userId).all<{ value: string | null }>(),
    db.prepare("SELECT achievement_id, tier, claimed_at FROM user_claimed_achievement_tiers WHERE users_id = ? ORDER BY position").bind(userId).all<{ achievement_id: string; tier: string; claimed_at: string | null }>(),
    db.prepare("SELECT value FROM user_showcased_badges WHERE users_id = ? ORDER BY position").bind(userId).all<{ value: string | null }>(),
    db.prepare("SELECT badge_id, tier, earned_at, expires_at FROM user_badge_grants WHERE users_id = ? ORDER BY position").bind(userId).all<{ badge_id: string; tier: string | null; earned_at: string; expires_at: string | null }>(),
    db.prepare("SELECT url, type, caption, created_at FROM user_profile_media WHERE users_id = ? ORDER BY position").bind(userId).all<{ url: string; type: string; caption: string | null; created_at: string | null }>()
  ]);
  return {
    interests: interests.results.map((row) => String(row.value)),
    hobbies: hobbies.results.map((row) => String(row.value)),
    languages: languages.results.map((row) => String(row.value)),
    ownedCosmeticIds: ownedCosmetics.results.map((row) => String(row.value)),
    ownedTitles: ownedTitles.results.map((row) => String(row.value)),
    claimedAchievementIds: claimedAchievements.results.map((row) => String(row.value)),
    claimedAchievementTiers: claimedTiers.results.map((row) => ({
      achievementId: row.achievement_id,
      tier: row.tier,
      claimedAt: row.claimed_at ?? undefined
    })),
    showcasedBadgeIds: showcased.results.map((row) => String(row.value)),
    badgeGrants: badgeGrants.results.map((row) => ({
      badgeId: row.badge_id,
      tier: row.tier ?? undefined,
      earnedAt: row.earned_at,
      expiresAt: row.expires_at ?? undefined
    })),
    profileMedia: profileMedia.results.map((row) => ({
      url: row.url,
      type: row.type,
      caption: row.caption ?? undefined,
      createdAt: row.created_at ?? undefined
    }))
  };
}

async function readUserRow(db: D1Database, userId: string) {
  return db.prepare("SELECT * FROM users WHERE source_id = ?").bind(userId.toLowerCase()).first<Row>();
}

function riskLevelFromTrustScore(score: number) {
  if (score >= 80) return "LOW";
  if (score >= 50) return "MEDIUM";
  if (score >= 20) return "HIGH";
  return "CRITICAL";
}

export async function refreshSafetyStatus(db: D1Database, userId: string, reviewedBy?: string) {
  const [reportCount, actionCount] = await Promise.all([
    db.prepare("SELECT COUNT(*) AS count FROM reports WHERE target_user_id = ?").bind(userId).first<{ count: number }>(),
    db.prepare(`SELECT COUNT(*) AS count FROM admin_moderation_actions
      WHERE target_user_id = ? AND action_type IN ('USER_SUSPENDED', 'USER_BANNED', 'MESSAGE_DELETED', 'PROFILE_HIDDEN', 'WALLET_FROZEN')`)
      .bind(userId).first<{ count: number }>()
  ]);
  const reports = reportCount?.count ?? 0;
  const actions = actionCount?.count ?? 0;
  const trustScore = Math.max(0, 100 - reports * 5 - actions * 15);
  const riskLevel = riskLevelFromTrustScore(trustScore);
  const time = new Date().toISOString();
  const existing = await db.prepare("SELECT source_id FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<{ source_id: string }>();
  if (existing) {
    await db.prepare(`UPDATE user_safety_statuses SET trust_score = ?, risk_level = ?, report_count = ?,
      last_reviewed_by = ?, last_reviewed_at = ?, updated_at = ? WHERE user_id = ?`)
      .bind(trustScore, riskLevel, reports, reviewedBy ?? null, reviewedBy ? time : null, time, userId).run();
  } else {
    await db.prepare(`INSERT INTO user_safety_statuses
      (source_id, user_id, trust_score, risk_level, warning_count, report_count, suspension_count,
       is_shadow_banned, is_chat_restricted, is_room_restricted, is_wallet_frozen, last_reviewed_by,
       last_reviewed_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, 0, ?, 0, 0, 0, 0, 0, ?, ?, ?, ?)`)
      .bind(newId(), userId, trustScore, riskLevel, reports, reviewedBy ?? null, reviewedBy ? time : null, time, time).run();
  }
  return db.prepare("SELECT * FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<Row>();
}

export async function flagSafetyState(db: D1Database, userId: string, update: Record<string, unknown>, reviewedBy?: string) {
  const status = await refreshSafetyStatus(db, userId, reviewedBy);
  const time = new Date().toISOString();
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(update)) {
    const column = key.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
    fields.push(`${column} = ?`);
    values.push(typeof value === "boolean" ? (value ? 1 : 0) : value);
  }
  fields.push("trust_score = ?", "risk_level = ?", "last_reviewed_by = ?", "last_reviewed_at = ?", "updated_at = ?");
  values.push(status?.trust_score, status?.risk_level, reviewedBy ?? null, reviewedBy ? time : null, time, userId);
  await db.prepare(`UPDATE user_safety_statuses SET ${fields.join(", ")} WHERE user_id = ?`).bind(...values).run();
  return db.prepare("SELECT * FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<Row>();
}

function presentSafety(row: Row | null | undefined) {
  if (!row) return undefined;
  return {
    _id: row.source_id,
    userId: row.user_id,
    trustScore: num(row.trust_score),
    riskLevel: row.risk_level,
    warningCount: num(row.warning_count),
    reportCount: num(row.report_count),
    suspensionCount: num(row.suspension_count),
    isShadowBanned: bool(row.is_shadow_banned),
    isChatRestricted: bool(row.is_chat_restricted),
    isRoomRestricted: bool(row.is_room_restricted),
    isWalletFrozen: bool(row.is_wallet_frozen),
    lastReviewedBy: text(row.last_reviewed_by),
    lastReviewedAt: date(row.last_reviewed_at),
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at)
  };
}

function presentModerationAction(row: Row) {
  return {
    _id: row.source_id,
    adminId: row.admin_id,
    queueId: text(row.queue_id),
    reportId: text(row.report_id),
    targetType: row.target_type,
    targetId: text(row.target_id),
    targetUserId: text(row.target_user_id),
    actionType: row.action_type,
    reason: text(row.reason),
    durationHours: row.duration_hours === null ? undefined : Number(row.duration_hours),
    metadata: row.metadata ? JSON.parse(String(row.metadata)) : {},
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at)
  };
}

export async function createModerationAction(db: D1Database, adminId: string, input: {
  actionType: string;
  targetType: string;
  targetId?: string;
  targetUserId?: string;
  reason?: string;
  durationHours?: number;
  metadata?: Record<string, unknown>;
  queueId?: string;
  reportId?: string;
}) {
  const time = new Date().toISOString();
  await db.prepare(`INSERT INTO admin_moderation_actions
    (source_id, admin_id, queue_id, report_id, target_type, target_id, target_user_id, action_type, reason, duration_hours, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(newId(), adminId, input.queueId ?? null, input.reportId ?? null, input.targetType, input.targetId ?? null,
      input.targetUserId ?? null, input.actionType, input.reason ?? null, input.durationHours ?? null,
      JSON.stringify(input.metadata ?? {}), time, time).run();
}

export async function createNotification(db: D1Database, userId: string, type: string, title: string, body: string, data: Record<string, unknown> = {}) {
  const time = new Date().toISOString();
  await db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`)
    .bind(newId(), userId, type, title, body, JSON.stringify(data), time, time).run();
}

function presentUser(row: Row, arrays: ChildArrays) {
  return {
    _id: row.source_id,
    name: row.name,
    username: row.username,
    email: text(row.email),
    phone: text(row.phone),
    firebaseUid: text(row.firebase_uid),
    avatar: text(row.avatar),
    avatarMediaId: text(row.avatar_media_id),
    avatarType: text(row.avatar_type),
    avatarParts: presentParts(row),
    gender: text(row.gender),
    age: row.age === null ? undefined : Number(row.age),
    bondVersion: num(row.bond_version),
    bondInvitations: bool(row.bond_invitations),
    bondNotifications: bool(row.bond_notifications),
    city: text(row.city),
    state: text(row.state),
    bio: text(row.bio),
    vibeLine: text(row.vibe_line),
    interests: arrays.interests,
    hobbies: arrays.hobbies,
    languages: arrays.languages,
    profileMedia: arrays.profileMedia,
    clanId: text(row.clan_id),
    role: row.role,
    isVerified: bool(row.is_verified),
    emailVerified: bool(row.email_verified),
    isBlocked: bool(row.is_blocked),
    followersCount: num(row.followers_count),
    followingCount: num(row.following_count),
    walletBalance: num(row.wallet_balance),
    diamondBalance: num(row.diamond_balance),
    xp: num(row.xp),
    wealthExp: num(row.wealth_exp),
    charmExp: num(row.charm_exp),
    level: num(row.level),
    levelTitle: text(row.level_title),
    lastDailyCheckInAt: date(row.last_daily_check_in_at),
    streakCount: num(row.streak_count),
    profileCompletedAt: date(row.profile_completed_at),
    deletionRequestedAt: date(row.deletion_requested_at),
    termsAcceptedAt: date(row.terms_accepted_at),
    ownedCosmeticIds: arrays.ownedCosmeticIds,
    ownedTitles: arrays.ownedTitles,
    claimedAchievementIds: arrays.claimedAchievementIds,
    claimedAchievementTiers: arrays.claimedAchievementTiers,
    showcasedBadgeIds: arrays.showcasedBadgeIds,
    badgeRevision: row.badge_revision === null ? undefined : Number(row.badge_revision),
    badgeGrants: arrays.badgeGrants,
    activeCosmetics: presentActiveCosmetics(row),
    vipTier: text(row.vip_tier),
    vipLevel: num(row.vip_level),
    vipExp: num(row.vip_exp),
    vipStartedAt: date(row.vip_started_at),
    vipExpiresAt: date(row.vip_expires_at),
    vipFrozen: bool(row.vip_frozen),
    vipFreezeStartedAt: date(row.vip_freeze_started_at),
    mysteriousVisitors: bool(row.mysterious_visitors),
    vipChatPrivacy: text(row.vip_chat_privacy),
    moderationStrikes: num(row.moderation_strikes),
    mutedUntil: date(row.muted_until),
    suspendedUntil: date(row.suspended_until),
    moderationReason: text(row.moderation_reason),
    tokenVersion: num(row.token_version),
    notificationPreferences: {
      roomInvites: bool(row.notification_preferences_room_invites),
      messages: bool(row.notification_preferences_messages),
      gifts: bool(row.notification_preferences_gifts),
      follows: bool(row.notification_preferences_follows),
      hostGoingLive: bool(row.notification_preferences_host_going_live),
      wallet: bool(row.notification_preferences_wallet),
      safety: bool(row.notification_preferences_safety),
      marketing: bool(row.notification_preferences_marketing)
    },
    interestedIn: text(row.interested_in),
    lookingFor: text(row.looking_for),
    datingAgeMin: row.dating_age_min === null ? undefined : Number(row.dating_age_min),
    datingAgeMax: row.dating_age_max === null ? undefined : Number(row.dating_age_max),
    datingVerifiedOnly: bool(row.dating_verified_only),
    referralCode: text(row.referral_code),
    referredBy: text(row.referred_by),
    referralRewardsClaimed: num(row.referral_rewards_claimed),
    createdAt: date(row.created_at),
    updatedAt: date(row.updated_at)
  };
}

const reasonSchema = z.object({ reason: z.string().min(3).max(500), durationHours: z.number().int().min(1).max(8760).optional() });

export function createD1AdminUsersRouter(db: D1Database, adminJwtSecret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, adminJwtSecret);

  router.get("/users", guard("users.read"), asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const clauses: string[] = [];
    const params: unknown[] = [];
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      const escaped = `%${search.toLowerCase()}%`;
      clauses.push("(instr(lower(name), ?) > 0 OR instr(lower(username), ?) > 0 OR instr(lower(COALESCE(email, '')), ?) > 0 OR instr(lower(COALESCE(phone, '')), ?) > 0 OR instr(lower(COALESCE(city, '')), ?) > 0)");
      params.push(escaped, escaped, escaped, escaped, escaped);
    }
    if (typeof req.query.role === "string" && req.query.role) {
      params.push(req.query.role);
      clauses.push("role = ?");
    }
    if (typeof req.query.city === "string" && req.query.city) {
      params.push(`%${req.query.city.toLowerCase()}%`);
      clauses.push("instr(lower(COALESCE(city, '')), ?) > 0");
    }
    if (typeof req.query.gender === "string" && req.query.gender) {
      params.push(req.query.gender);
      clauses.push("gender = ?");
    }
    if (req.query.status === "banned") clauses.push("is_blocked = 1");
    if (req.query.status === "suspended") {
      params.push(new Date().toISOString());
      clauses.push("suspended_until IS NOT NULL AND suspended_until > ?");
    }
    if (req.query.ageMin) {
      params.push(Number(req.query.ageMin));
      clauses.push("age >= ?");
    }
    if (req.query.ageMax) {
      params.push(Number(req.query.ageMax));
      clauses.push("age <= ?");
    }
    const createdFrom = req.query.createdFrom ? new Date(String(req.query.createdFrom)) : undefined;
    if (createdFrom && !Number.isNaN(createdFrom.getTime())) {
      params.push(createdFrom.toISOString());
      clauses.push("created_at >= ?");
    }
    const createdTo = req.query.createdTo ? new Date(String(req.query.createdTo)) : undefined;
    if (createdTo && !Number.isNaN(createdTo.getTime())) {
      params.push(createdTo.toISOString());
      clauses.push("created_at <= ?");
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const sortMap: Record<string, string> = {
      createdAt: "created_at", name: "name", username: "username", city: "city",
      xp: "xp", level: "level", walletBalance: "wallet_balance", followersCount: "followers_count",
      role: "role", isBlocked: "is_blocked"
    };
    const sortBy = sortMap[String(req.query.sortBy || "createdAt")] || "created_at";
    const sortOrder = String(req.query.sortOrder || "desc").toLowerCase() === "asc" ? "ASC" : "DESC";
    const [rows, total] = await Promise.all([
      db.prepare(`SELECT * FROM users ${where} ORDER BY ${sortBy} ${sortOrder}, source_id ${sortOrder} LIMIT ? OFFSET ?`)
        .bind(...params, limit, skip).all<Row>(),
      db.prepare(`SELECT COUNT(*) AS count FROM users ${where}`).bind(...params).first<{ count: number }>()
    ]);
    const users = [];
    for (const row of rows.results) {
      users.push(presentUser(row, await readChildArrays(db, String(row.source_id))));
    }
    adminOk(res, users, paginationMeta(page, limit, total?.count ?? 0));
  }));

  router.get("/users/:userId", guard("users.read"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const [userRow, safety, reportsReceived, reportsSubmitted, walletSummary, matchCount, blockCount, actions] = await Promise.all([
      readUserRow(db, userId),
      db.prepare("SELECT * FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<Row>(),
      db.prepare("SELECT COUNT(*) AS count FROM reports WHERE target_user_id = ?").bind(userId).first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) AS count FROM reports WHERE reporter_id = ?").bind(userId).first<{ count: number }>(),
      db.prepare(`SELECT type, SUM(amount) AS amount, COUNT(*) AS count FROM wallet_transactions WHERE user_id = ? GROUP BY type`).bind(userId).all<Row>(),
      db.prepare("SELECT COUNT(*) AS count FROM match_users WHERE value = ?").bind(userId).first<{ count: number }>(),
      db.prepare("SELECT COUNT(*) AS count FROM blocks WHERE blocker_id = ? OR blocked_user_id = ?").bind(userId, userId).first<{ count: number }>(),
      db.prepare("SELECT * FROM admin_moderation_actions WHERE target_user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 25").bind(userId).all<Row>()
    ]);
    if (!userRow) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "user.viewed", entityType: "user", entityId: userId, targetUserId: userId, req });
    adminOk(res, {
      user: presentUser(userRow, await readChildArrays(db, userId)),
      safety: safety ? presentSafety(safety) : undefined,
      reportsReceived: reportsReceived?.count ?? 0,
      reportsSubmitted: reportsSubmitted?.count ?? 0,
      walletSummary: walletSummary.results.map((row) => ({ _id: row.type, amount: num(row.amount), count: num(row.count) })),
      matchCount: matchCount?.count ?? 0,
      blockCount: blockCount?.count ?? 0,
      actions: actions.results.map(presentModerationAction)
    });
  }));

  router.patch("/users/:userId", guard("users.update"), validateBody(z.object({
    name: z.string().min(1).max(120).optional(),
    username: z.string().min(3).max(40).optional(),
    bio: z.string().max(500).optional(),
    city: z.string().max(80).optional(),
    isVerified: z.boolean().optional(),
    role: z.enum(["USER", "HOST", "MODERATOR", "ADMIN"]).optional()
  })), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const before = await readUserRow(db, userId);
    if (!before) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const body = req.body as Record<string, unknown>;
    const sets: string[] = [];
    const values: unknown[] = [];
    const map: Record<string, string> = { name: "name", username: "username", bio: "bio", city: "city", isVerified: "is_verified", role: "role" };
    for (const [key, column] of Object.entries(map)) {
      if (body[key] !== undefined) {
        sets.push(`${column} = ?`);
        values.push(typeof body[key] === "boolean" ? (body[key] ? 1 : 0) : body[key]);
      }
    }
    const time = new Date().toISOString();
    sets.push("updated_at = ?");
    values.push(time, userId);
    await db.prepare(`UPDATE users SET ${sets.join(", ")} WHERE source_id = ?`).bind(...values).run();
    const user = await readUserRow(db, userId);
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "user.updated", entityType: "user", entityId: userId, targetUserId: userId, metadata: { before: presentUser(before, await readChildArrays(db, userId)), after: presentUser(user!, await readChildArrays(db, userId)) }, req });
    adminOk(res, { user: presentUser(user!, await readChildArrays(db, userId)) });
  }));

  const reasonSchema = z.object({ reason: z.string().min(3).max(500), durationHours: z.number().int().min(1).max(8760).optional() });

  router.post("/users/:userId/warn", guard("users.suspend"), validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const user = await readUserRow(db, userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const body = req.body as { reason: string };
    await createNotification(db, userId, "SYSTEM", "Community warning", body.reason, { type: "ADMIN_WARNING" });
    await createModerationAction(db, adminFrom(res).id, { actionType: "WARNING_SENT", targetType: "USER", targetId: userId, targetUserId: userId, reason: body.reason });
    const time = new Date().toISOString();
    const safetyRow = await db.prepare("SELECT source_id FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<{ source_id: string }>();
    if (safetyRow) await db.prepare("UPDATE user_safety_statuses SET warning_count = warning_count + 1, last_reviewed_by = ?, last_reviewed_at = ?, updated_at = ? WHERE user_id = ?").bind(adminFrom(res).id, time, time, userId).run();
    else await db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level, warning_count, report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted, is_wallet_frozen, last_reviewed_by, last_reviewed_at, created_at, updated_at) VALUES (?, ?, 100, 'LOW', 1, 0, 0, 0, 0, 0, 0, ?, ?, ?, ?)`).bind(newId(), userId, adminFrom(res).id, time, time, time).run();
    await refreshSafetyStatus(db, userId, adminFrom(res).id);
    adminOk(res, { warned: true });
  }));

  router.post("/users/:userId/suspend", guard("users.suspend"), validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const user = await readUserRow(db, userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const body = req.body as { reason: string; durationHours?: number };
    const suspendedUntil = new Date(Date.now() + (body.durationHours ?? 24) * 60 * 60 * 1000).toISOString();
    const time = new Date().toISOString();
    await db.prepare("UPDATE users SET suspended_until = ?, moderation_reason = ?, moderation_strikes = moderation_strikes + 1, updated_at = ? WHERE source_id = ?").bind(suspendedUntil, body.reason, time, userId).run();
    await createModerationAction(db, adminFrom(res).id, { actionType: "USER_SUSPENDED", targetType: "USER", targetId: userId, targetUserId: userId, reason: body.reason, durationHours: body.durationHours });
    await refreshSafetyStatus(db, userId, adminFrom(res).id);
    const safetyRow = await db.prepare("SELECT source_id FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<{ source_id: string }>();
    if (safetyRow) await db.prepare("UPDATE user_safety_statuses SET suspension_count = suspension_count + 1, last_reviewed_by = ?, last_reviewed_at = ?, updated_at = ? WHERE user_id = ?").bind(adminFrom(res).id, time, time, userId).run();
    const updated = await readUserRow(db, userId);
    adminOk(res, { user: presentUser(updated!, await readChildArrays(db, userId)) });
  }));

  router.post("/users/:userId/ban", guard("users.ban"), validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const user = await readUserRow(db, userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const body = req.body as { reason: string };
    const time = new Date().toISOString();
    await db.prepare("UPDATE users SET is_blocked = 1, moderation_reason = ?, moderation_strikes = moderation_strikes + 1, token_version = token_version + 1, updated_at = ? WHERE source_id = ?").bind(body.reason, time, userId).run();
    await endD1UnavailableBonds(db, userId, "TERMINATED_BY_MODERATION");
    await createModerationAction(db, adminFrom(res).id, { actionType: "USER_BANNED", targetType: "USER", targetId: userId, targetUserId: userId, reason: body.reason });
    await refreshSafetyStatus(db, userId, adminFrom(res).id);
    const updated = await readUserRow(db, userId);
    adminOk(res, { user: presentUser(updated!, await readChildArrays(db, userId)) });
  }));

  router.post("/users/:userId/unban", guard("users.ban"), validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const user = await readUserRow(db, userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    await db.prepare("UPDATE users SET is_blocked = 0, moderation_reason = NULL, suspended_until = NULL, muted_until = NULL, updated_at = ? WHERE source_id = ?").bind(time, userId).run();
    await createModerationAction(db, adminFrom(res).id, { actionType: "USER_UNBANNED", targetType: "USER", targetId: userId, targetUserId: userId, reason: (req.body as { reason?: string }).reason });
    const updated = await readUserRow(db, userId);
    adminOk(res, { user: presentUser(updated!, await readChildArrays(db, userId)) });
  }));

  for (const [path, field, auditAction, enabled] of [
    ["shadow-ban", "isShadowBanned", "user.shadow_banned", true],
    ["remove-shadow-ban", "isShadowBanned", "user.shadow_ban.removed", false],
    ["restrict-chat", "isChatRestricted", "user.chat_restricted", true],
    ["restrict-rooms", "isRoomRestricted", "user.rooms_restricted", true],
    ["freeze-wallet", "isWalletFrozen", "user.wallet_frozen", true],
    ["unfreeze-wallet", "isWalletFrozen", "user.wallet_unfrozen", false]
  ] as const) {
    router.post(`/users/:userId/${path}`, guard("users.suspend"), validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req, res) => {
      const userId = req.params.userId.toLowerCase();
      if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
      const user = await readUserRow(db, userId);
      if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      const safety = await flagSafetyState(db, userId, { [field]: enabled }, adminFrom(res).id);
      await createModerationAction(db, adminFrom(res).id, { actionType: field === "isWalletFrozen" ? (enabled ? "WALLET_FROZEN" : "WALLET_FROZEN") : "USER_SUSPENDED", targetType: "USER", targetId: userId, targetUserId: userId, reason: (req.body as { reason?: string }).reason, metadata: { [field]: enabled } });
      await insertD1AdminAudit(db, adminFrom(res), { action: auditAction, entityType: "user_safety_status", entityId: safety?.source_id ? String(safety.source_id) : undefined, targetUserId: userId, metadata: { reason: (req.body as { reason?: string }).reason, [field]: enabled }, req });
      adminOk(res, { safety: presentSafety(safety) });
    }));
  }

  router.get("/users/:userId/activity", guard("users.read"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const [rooms, messages, transactions, reports] = await Promise.all([
      db.prepare("SELECT * FROM rooms WHERE host_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 50").bind(userId).all<Row>(),
      db.prepare("SELECT * FROM chat_messages WHERE sender_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 50").bind(userId).all<Row>(),
      db.prepare("SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 50").bind(userId).all<Row>(),
      db.prepare("SELECT * FROM reports WHERE reporter_id = ? OR target_user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 50").bind(userId, userId).all<Row>()
    ]);
    adminOk(res, { rooms: rooms.results, messages: messages.results, transactions: transactions.results, reports: reports.results });
  }));

  router.get("/users/:userId/reports", guard("reports.read"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const { results } = await db.prepare("SELECT * FROM reports WHERE target_user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 100").bind(userId).all<Row>();
    adminOk(res, results);
  }));

  router.get("/users/:userId/wallet", guard("wallet.read"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const [user, safety, transactions] = await Promise.all([
      db.prepare("SELECT source_id, name, username, wallet_balance FROM users WHERE source_id = ?").bind(userId).first<Row>(),
      db.prepare("SELECT * FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<Row>(),
      db.prepare("SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 50").bind(userId).all<Row>()
    ]);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    adminOk(res, { user, safety: presentSafety(safety), transactions: transactions.results });
  }));

  router.get("/users/:userId/rooms", guard("rooms.read"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const { results } = await db.prepare("SELECT * FROM rooms WHERE host_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 100").bind(userId).all<Row>();
    adminOk(res, results);
  }));

  router.get("/users/:userId/chats", guard("messages.read_private"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const messages = await db.prepare("SELECT * FROM direct_messages WHERE sender_id = ? OR receiver_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 100").bind(userId, userId).all<Row>();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "private_chat.viewed", entityType: "direct_message", targetUserId: userId, metadata: { count: messages.results.length }, req });
    adminOk(res, messages.results);
  }));

  router.get("/users/:userId/audit", guard("audit.read"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const { results } = await db.prepare("SELECT * FROM admin_audit_logs WHERE target_user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 100").bind(userId).all<Row>();
    adminOk(res, results);
  }));

  router.get("/profiles/pending-review", guard("profiles.review"), asyncHandler(async (_req, res) => {
    const { results } = await db.prepare("SELECT * FROM users WHERE profile_completed_at IS NOT NULL AND is_verified = 0 AND is_blocked = 0 ORDER BY profile_completed_at DESC, source_id DESC LIMIT 100").all<Row>();
    const users = [];
    for (const row of results) users.push(presentUser(row, await readChildArrays(db, String(row.source_id))));
    adminOk(res, users);
  }));

  router.get("/profiles/:userId", guard("profiles.review"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const user = await readUserRow(db, userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const safety = await db.prepare("SELECT * FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<Row>();
    adminOk(res, { user: presentUser(user, await readChildArrays(db, userId)), safety: presentSafety(safety) });
  }));

  router.post("/profiles/:userId/approve", guard("profiles.review"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const user = await readUserRow(db, userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    await db.prepare("UPDATE users SET is_verified = 1, updated_at = ? WHERE source_id = ?").bind(time, userId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "profile.approved", entityType: "user", entityId: userId, targetUserId: userId, req });
    const updated = await readUserRow(db, userId);
    adminOk(res, { user: presentUser(updated!, await readChildArrays(db, userId)) });
  }));

  router.post("/profiles/:userId/reject", guard("profiles.review"), validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const body = req.body as { reason: string };
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "profile.rejected", entityType: "user", entityId: userId, targetUserId: userId, metadata: { reason: body.reason }, req });
    adminOk(res, { rejected: true });
  }));

  router.post("/profiles/:userId/verify", guard("profiles.verify"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const user = await readUserRow(db, userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    await db.prepare("UPDATE users SET is_verified = 1, updated_at = ? WHERE source_id = ?").bind(time, userId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "profile.verified", entityType: "user", entityId: userId, targetUserId: userId, req });
    const updated = await readUserRow(db, userId);
    adminOk(res, { user: presentUser(updated!, await readChildArrays(db, userId)) });
  }));

  router.post("/profiles/:userId/remove-verification", guard("profiles.verify"), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const user = await readUserRow(db, userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    await db.prepare("UPDATE users SET is_verified = 0, updated_at = ? WHERE source_id = ?").bind(time, userId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "profile.verification_removed", entityType: "user", entityId: userId, targetUserId: userId, req });
    const updated = await readUserRow(db, userId);
    adminOk(res, { user: presentUser(updated!, await readChildArrays(db, userId)) });
  }));

  router.post("/profiles/:userId/hide-photo", guard("profiles.review"), validateBody(z.object({ photoUrl: z.string().url().optional(), reason: z.string().min(3).max(500) })), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const body = req.body as { photoUrl?: string; reason: string };
    const admin = adminFrom(res);
    await createModerationAction(db, admin.id, { actionType: "PROFILE_HIDDEN", targetType: "PHOTO", targetUserId: userId, reason: body.reason, metadata: { photoUrl: body.photoUrl } });
    await insertD1AdminAudit(db, admin, { action: "profile.photo_hidden", entityType: "user", entityId: userId, targetUserId: userId, metadata: { photoUrl: body.photoUrl, reason: body.reason }, req });
    adminOk(res, { hidden: true });
  }));

  router.post("/profiles/:userId/remove-photo", guard("profiles.review"), validateBody(z.object({ photoUrl: z.string().url().optional(), reason: z.string().min(3).max(500) })), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const body = req.body as { photoUrl?: string; reason: string };
    const admin = adminFrom(res);
    await createModerationAction(db, admin.id, { actionType: "PHOTO_REMOVED", targetType: "PHOTO", targetUserId: userId, reason: body.reason, metadata: { photoUrl: body.photoUrl } });
    await insertD1AdminAudit(db, admin, { action: "profile.photo_removed", entityType: "user", entityId: userId, targetUserId: userId, metadata: { photoUrl: body.photoUrl, reason: body.reason }, req });
    adminOk(res, { removed: true });
  }));

  router.post("/profiles/:userId/request-changes", guard("profiles.review"), validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const userId = req.params.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user id", ErrorCode.VALIDATION);
    const body = req.body as { reason: string };
    await createNotification(db, userId, "SYSTEM", "Profile changes requested", body.reason, { type: "PROFILE_REVIEW" });
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "profile.changes_requested", entityType: "user", entityId: userId, targetUserId: userId, metadata: { reason: body.reason }, req });
    adminOk(res, { requested: true });
  }));

  return router;
}