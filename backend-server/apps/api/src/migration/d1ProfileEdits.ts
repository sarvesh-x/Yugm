import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { profileSchema } from "@yugm/shared";
import { Router, type Request } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { isProfileCompleted } from "../services/profileCompletion.js";
import { profilePatch } from "../services/profilePatch.js";
import { serializePublicProfile } from "../services/profilePresentation.js";
import { getVipStatus, vipPrivacySchema } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { AUTH_PROFILE_ARRAYS, AVATAR_PART_KEYS } from "./authProfileFields.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { prepareD1ProfileCompletion, profileEditClaim, type ProfileStatement } from "./d1ProfileCompletion.js";
import { prepareD1Profile, restoreD1Profile, type ProfileRow } from "./d1ProfileReads.js";

type SqlValue = string | number | null;
const editableLists = ["interests", "hobbies", "languages"] as const;
type VipPrivacy = { mysterious_visitors: number; vip_chat_privacy: "EVERYONE" | "FOLLOWERS" };
type VipPrivacyAccount = VipPrivacy & { vip_tier: string | null; vip_level: number; vip_expires_at: string | null; vip_frozen: number };

function presentVipPrivacy(row: VipPrivacy) {
  return { mysteriousVisitors: Boolean(row.mysterious_visitors), chatPrivacy: row.vip_chat_privacy ?? "EVERYONE" };
}

function serializeEditedProfile(row: ProfileRow) {
  const nulls: string[] = JSON.parse(String(row.null_fields ?? "[]"));
  const restored = restoreD1Profile(row, true);
  const user = {
    ...restored, id: row.source_id,
    role: restored.role === undefined ? "USER" : restored.role,
    walletBalance: restored.walletBalance === undefined ? 0 : restored.walletBalance,
    interests: restored.interests === undefined ? [] : restored.interests,
    hobbies: restored.hobbies === undefined ? [] : restored.hobbies,
    languages: restored.languages === undefined ? [] : restored.languages,
    ownedCosmeticIds: restored.ownedCosmeticIds === undefined ? [] : restored.ownedCosmeticIds,
    profileMedia: restored.profileMedia === undefined ? [] : restored.profileMedia,
    friendsCount: undefined, verificationLevel: undefined, isFollowing: undefined, isBonded: undefined,
    followersCount: row.stored_followers_count, followingCount: row.stored_following_count,
    email: nulls.includes("email") ? null : row.email ?? undefined, emailVerified: Boolean(row.email_verified)
  };
  const profile = serializePublicProfile(user, false);
  return {
    ...profile,
    // The Mongo PATCH serializes these nested model paths as empty objects
    // when the source row has no fields, while preserving an explicit null.
    avatarParts: restored.avatarParts === undefined ? {} : restored.avatarParts,
    activeCosmetics: restored.activeCosmetics === undefined ? {} : restored.activeCosmetics,
    bondsCount: row.bonds_count, email: user.email, emailVerified: user.emailVerified
  };
}

function prepareColumnPatch(update: Record<string, unknown>) {
  const columns: Record<string, SqlValue> = {};
  const lists: Array<{ field: (typeof editableLists)[number]; values: string[] }> = [];
  for (const field of editableLists) {
    if (Array.isArray(update[field])) lists.push({ field, values: update[field] as string[] });
  }
  for (const [field, value] of Object.entries(update)) {
    if (field === "avatarParts") {
      const parts = value as Record<string, number> | null;
      for (const part of AVATAR_PART_KEYS) columns[`avatar_parts_${part}`] = parts?.[part] ?? null;
    } else if (typeof value === "string" || typeof value === "number" || value === null) {
      columns[field.replace(/[A-Z]/g, character => `_${character.toLowerCase()}`)] = value;
    }
  }
  return { columns, lists };
}

export async function updateD1Profile(db: D1Database, header: string | undefined, body: Record<string, unknown>) {
  const access = createD1AccessSessionReader(db, "http");
  for (let attempt = 0; attempt < 4; attempt++) {
    const { user, claims } = await requireHttpSession(header, access);
    const userId = user.id;
    const row = await prepareD1Profile(db, userId, userId).first<ProfileRow>();
    if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

    const now = new Date();
    const time = now.toISOString();
    const editToken = randomBytes(16).toString("hex");
    const write: ProfileStatement = (sql, ...values) => db.prepare(sql).bind(...values, userId, editToken);
    const update = profilePatch(body);
    if (body.acceptTerms === true && !row.terms_accepted_at) update.termsAcceptedAt = time;
    const profile = { ...restoreD1Profile(row, true), ...update };
    const completion = !row.profile_completed_at && isProfileCompleted(profile)
      ? await prepareD1ProfileCompletion(db, row, now, write)
      : undefined;
    if (completion) update.profileCompletedAt = time;

    const patch = prepareColumnPatch(update);
    const columns: Record<string, SqlValue> = { ...patch.columns, ...completion?.columns, updated_at: time };
    const changedFields = new Set(Object.keys(update));
    if (columns.wallet_balance !== undefined) changedFields.add("walletBalance");
    const keepField = (field: string) => !changedFields.has(field.split(".")[0]);
    const nulls: string[] = JSON.parse(String(row.null_fields ?? "[]")).filter(keepField);
    const missing: string[] = JSON.parse(String(row.missing_fields ?? "[]")).filter(keepField);
    for (const [field, value] of Object.entries(update)) if (value === null) nulls.push(field);

    // Claim the exact snapshot and live session before changing any row. A request
    // that loses the claim retries against the winner's committed state.
    const generation = claims.tokenVersion ?? null;
    const claim = db.prepare(`UPDATE user_auth_profile SET edit_token = ?, null_fields = ?, missing_fields = ?
      WHERE source_id = ? AND edit_token IS ? AND null_fields IS ? AND missing_fields IS ? AND EXISTS (
        SELECT 1 FROM users AS u JOIN auth_sessions AS s ON s.user_id = u.source_id
        WHERE u.source_id = ? AND u.updated_at IS ? AND u.xp = ? AND u.level = ? AND u.wallet_balance IS ?
          AND u.profile_completed_at IS ? AND u.terms_accepted_at IS ? AND u.is_blocked = 0
          AND (u.suspended_until IS NULL OR u.suspended_until <= ?)
          AND s.source_id = ? AND s.revoked_at IS NULL AND s.expires_at > ?
          AND COALESCE(CASE WHEN s.token_version_present = 0 THEN 0 ELSE s.token_version END, ?) IS ?
          AND (? IS NULL OR u.token_version = ?)
      )`).bind(editToken, JSON.stringify(nulls), JSON.stringify(missing), userId, row.edit_token, row.null_fields,
      row.missing_fields, userId, row.updated_at, row.xp, row.stored_level, row.wallet_balance, row.profile_completed_at,
      row.terms_accepted_at, time, claims.sid, time, generation, generation, generation, generation);
    const statements = [claim, write(`UPDATE users SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")}
      WHERE source_id = ? AND ${profileEditClaim}`, ...Object.values(columns), userId)];
    for (const { field, values } of patch.lists) {
      const table = AUTH_PROFILE_ARRAYS[field];
      statements.push(
        write(`DELETE FROM ${table} WHERE users_id = ? AND ${profileEditClaim}`, userId),
        write(`INSERT INTO ${table} (source_id, value, users_id, position)
          SELECT ? || ':' || element.key, element.value, ?, element.key FROM json_each(?) AS element
          WHERE ${profileEditClaim}`, `${userId}:${field}`, userId, JSON.stringify(values))
      );
    }
    statements.push(...(completion?.statements ?? []), prepareD1Profile(db, userId, userId));

    try {
      const results = await db.batch<ProfileRow>(statements);
      if (results[0].meta.changes === 0) continue;
      const committed = results.at(-1)?.results[0];
      if (!committed) throw new HttpError(500, "Committed profile unavailable", ErrorCode.INTERNAL);
      return { user: serializeEditedProfile(committed), xpGrant: completion?.xpGrant };
    } catch (error) {
      if (error instanceof Error && error.message.includes("UNIQUE constraint failed: users.username")) {
        throw new HttpError(409, "That username is already taken. Choose another one.", ErrorCode.CONFLICT);
      }
      throw error;
    }
  }
  await requireHttpSession(header, access);
  throw new HttpError(409, "Profile changed. Please try again.", ErrorCode.CONFLICT);
}

export function createD1ProfileEditRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, _res, next) => {
    await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const loadVipPrivacy = async (req: Request) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const now = new Date();
    const time = now.toISOString();
    const session = bindD1LiveUser(claims, time);
    const row = await db.prepare(`SELECT vip_tier, vip_level, vip_expires_at, vip_frozen, mysterious_visitors, vip_chat_privacy
      FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL`).bind(...session).first<VipPrivacyAccount>();
    if (!row) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    if (!getVipStatus({ vipTier: row.vip_tier, vipLevel: row.vip_level, vipExpiresAt: row.vip_expires_at, vipFrozen: row.vip_frozen }, now).isVip) {
      throw new HttpError(403, "VIP membership required", ErrorCode.FORBIDDEN);
    }
    return { row, session, time };
  };
  router.patch("/me", authenticate, validateBody(profileSchema.partial()), asyncHandler(async (req, res) => {
    sendOk(res, await updateD1Profile(db, req.headers.authorization, req.body));
  }));
  router.get("/me/vip-privacy", asyncHandler(async (req, res) => {
    sendOk(res, presentVipPrivacy((await loadVipPrivacy(req)).row));
  }));
  router.patch("/me/vip-privacy", authenticate, validateBody(vipPrivacySchema), asyncHandler(async (req, res) => {
    const { row, session, time } = await loadVipPrivacy(req);
    const { mysteriousVisitors, chatPrivacy } = req.body;
    const updated = await db.prepare(`UPDATE users AS u SET mysterious_visitors = COALESCE(?, mysterious_visitors),
      vip_chat_privacy = COALESCE(?, vip_chat_privacy), updated_at = ? WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL
      AND vip_tier IS ? AND vip_level IS ? AND vip_expires_at IS ? AND vip_frozen IS ?
      RETURNING mysterious_visitors, vip_chat_privacy`).bind(mysteriousVisitors === undefined ? null : Number(mysteriousVisitors),
      chatPrivacy ?? null, time, ...session, row.vip_tier, row.vip_level, row.vip_expires_at, row.vip_frozen).first<VipPrivacy>();
    if (!updated) throw new HttpError(409, "VIP membership changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, presentVipPrivacy(updated));
  }));
  return router;
}
