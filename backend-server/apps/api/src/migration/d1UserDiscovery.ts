import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { getLevelStatus } from "../services/levelPresentation.js";
import { serializePublicProfile } from "../services/profilePresentation.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";
import { noD1Presence, type D1PresencePort } from "./d1Presence.js";
import { d1UserId } from "./d1People.js";
import { prepareD1Profile, restoreD1Profile, type ProfileRow } from "./d1ProfileReads.js";
import { pkBattleJoins, pkBattleProjection, presentPkBattle, type BattleRow } from "./d1RoomPkHistory.js";

const profileMediaSchema = z.object({
  url: z.string().url(),
  type: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
  caption: z.string().max(140).optional()
});

type UserListRow = {
  source_id: string;
  name: string | null;
  username: string | null;
  avatar: string | null;
  avatar_type: string | null;
  avatar_parts_background: number | null;
  avatar_parts_clothes: number | null;
  avatar_parts_head: number | null;
  avatar_parts_mouth: number | null;
  avatar_parts_eyes: number | null;
  avatar_parts_top: number | null;
  city: string | null;
  followers_count: number | null;
  role: string | null;
  xp: number | null;
  level: number | null;
  level_title: string | null;
  vip_tier: string | null;
  vip_started_at: string | null;
  vip_expires_at: string | null;
  last_daily_check_in_at: string | null;
  active_cosmetics_avatar_asset: string | null;
  active_cosmetics_avatar_frame: string | null;
  active_cosmetics_speaking_wave: string | null;
  active_cosmetics_profile_theme: string | null;
  active_cosmetics_entrance_effect: string | null;
  active_cosmetics_profile_badge: string | null;
  active_cosmetics_name_style: string | null;
  active_cosmetics_room_entry: string | null;
  active_cosmetics_mood_status: string | null;
  active_cosmetics_profile_music: string | null;
  active_cosmetics_voice_badge: string | null;
  active_cosmetics_room_theme: string | null;
  active_cosmetics_avatar_decoration: string | null;
  active_cosmetics_reaction_pack: string | null;
  active_cosmetics_profile_layout: string | null;
  active_cosmetics_profile_banner: string | null;
  active_cosmetics_intro_card: string | null;
  active_cosmetics_collectible_title: string | null;
  active_cosmetics_gift_shelf: string | null;
  active_cosmetics_chat_bubble: string | null;
  active_cosmetics_seasonal_event: string | null;
  active_cosmetics_video_call_overlay: string | null;
  active_cosmetics_room_badge: string | null;
  active_cosmetics_room_ambience: string | null;
};

function likeTerm(q: string) {
  return `%${q.replace(/[\\%_]/g, "\\$&")}%`;
}

function optionalParts(row: UserListRow) {
  const parts = {
    background: row.avatar_parts_background ?? undefined,
    clothes: row.avatar_parts_clothes ?? undefined,
    head: row.avatar_parts_head ?? undefined,
    mouth: row.avatar_parts_mouth ?? undefined,
    eyes: row.avatar_parts_eyes ?? undefined,
    top: row.avatar_parts_top ?? undefined
  };
  return Object.values(parts).some(value => value !== undefined) ? parts : undefined;
}

function optionalCosmetics(row: UserListRow) {
  const cosmetics: Record<string, string | undefined> = {
    avatarAsset: row.active_cosmetics_avatar_asset ?? undefined,
    avatarFrame: row.active_cosmetics_avatar_frame ?? undefined,
    speakingWave: row.active_cosmetics_speaking_wave ?? undefined,
    profileTheme: row.active_cosmetics_profile_theme ?? undefined,
    entranceEffect: row.active_cosmetics_entrance_effect ?? undefined,
    profileBadge: row.active_cosmetics_profile_badge ?? undefined,
    nameStyle: row.active_cosmetics_name_style ?? undefined,
    roomEntry: row.active_cosmetics_room_entry ?? undefined,
    moodStatus: row.active_cosmetics_mood_status ?? undefined,
    profileMusic: row.active_cosmetics_profile_music ?? undefined,
    voiceBadge: row.active_cosmetics_voice_badge ?? undefined,
    roomTheme: row.active_cosmetics_room_theme ?? undefined,
    avatarDecoration: row.active_cosmetics_avatar_decoration ?? undefined,
    reactionPack: row.active_cosmetics_reaction_pack ?? undefined,
    profileLayout: row.active_cosmetics_profile_layout ?? undefined,
    profileBanner: row.active_cosmetics_profile_banner ?? undefined,
    introCard: row.active_cosmetics_intro_card ?? undefined,
    collectibleTitle: row.active_cosmetics_collectible_title ?? undefined,
    giftShelf: row.active_cosmetics_gift_shelf ?? undefined,
    chatBubble: row.active_cosmetics_chat_bubble ?? undefined,
    seasonalEvent: row.active_cosmetics_seasonal_event ?? undefined,
    videoCallOverlay: row.active_cosmetics_video_call_overlay ?? undefined,
    roomBadge: row.active_cosmetics_room_badge ?? undefined,
    roomAmbience: row.active_cosmetics_room_ambience ?? undefined
  };
  return Object.fromEntries(Object.entries(cosmetics).filter(([, value]) => value != null));
}

async function interestsForUsers(db: D1Database, userIds: string[]) {
  if (userIds.length === 0) return new Map<string, string[]>();
  const placeholders = userIds.map(() => "?").join(",");
  const { results } = await db.prepare(
    `SELECT users_id, value FROM user_interests WHERE users_id IN (${placeholders}) ORDER BY users_id, position`
  ).bind(...userIds).all<{ users_id: string; value: string }>();
  const map = new Map<string, string[]>();
  for (const row of results) {
    const list = map.get(row.users_id) ?? [];
    list.push(row.value);
    map.set(row.users_id, list);
  }
  return map;
}

function listUser(row: UserListRow, interests: string[], isFollowing: boolean) {
  const user = {
    _id: row.source_id,
    name: row.name ?? undefined,
    username: row.username ?? undefined,
    avatar: row.avatar ?? undefined,
    avatarType: row.avatar_type ?? undefined,
    avatarParts: optionalParts(row),
    city: row.city ?? undefined,
    followersCount: row.followers_count ?? 0,
    interests,
    role: row.role ?? undefined,
    activeCosmetics: optionalCosmetics(row),
    vipTier: row.vip_tier ?? undefined,
    vipStartedAt: row.vip_started_at ?? undefined,
    vipExpiresAt: row.vip_expires_at ?? undefined,
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    levelTitle: row.level_title ?? undefined,
    lastDailyCheckInAt: row.last_daily_check_in_at ?? undefined
  };
  const vip = getVipStatus(user);
  const level = getLevelStatus(user);
  return { ...user, ...vip, xp: level.xp, level: level.level, levelTitle: level.title, levelStatus: level, isFollowing };
}

// The legacy recommended-chat projection is narrower than the user search DTO:
// it omits city/followers/interests/role and marks every returned user online
// because the candidate set comes from live presence.
function recommendedChatUser(row: UserListRow) {
  const user = {
    _id: row.source_id,
    name: row.name ?? undefined,
    username: row.username ?? undefined,
    avatar: row.avatar ?? undefined,
    avatarType: row.avatar_type ?? undefined,
    avatarParts: optionalParts(row),
    activeCosmetics: optionalCosmetics(row),
    vipTier: row.vip_tier ?? undefined,
    vipExpiresAt: row.vip_expires_at ?? undefined,
    xp: row.xp ?? 0,
    level: row.level ?? 1,
    levelTitle: row.level_title ?? undefined
  };
  const vip = getVipStatus(user);
  const level = getLevelStatus(user);
  return { ...user, ...vip, xp: level.xp, level: level.level, levelTitle: level.title,
    isOnline: true, isFollowing: false };
}

const USER_LIST_SELECT = `u.source_id, u.name, u.username, u.avatar, u.avatar_type,
  u.avatar_parts_background, u.avatar_parts_clothes, u.avatar_parts_head, u.avatar_parts_mouth, u.avatar_parts_eyes, u.avatar_parts_top,
  u.city, u.followers_count, u.role, u.xp, u.level, u.level_title,
  u.vip_tier, u.vip_started_at, u.vip_expires_at, u.last_daily_check_in_at,
  u.active_cosmetics_avatar_asset, u.active_cosmetics_avatar_frame, u.active_cosmetics_speaking_wave,
  u.active_cosmetics_profile_theme, u.active_cosmetics_entrance_effect, u.active_cosmetics_profile_badge,
  u.active_cosmetics_name_style, u.active_cosmetics_room_entry, u.active_cosmetics_mood_status,
  u.active_cosmetics_profile_music, u.active_cosmetics_voice_badge, u.active_cosmetics_room_theme,
  u.active_cosmetics_avatar_decoration, u.active_cosmetics_reaction_pack, u.active_cosmetics_profile_layout,
  u.active_cosmetics_profile_banner, u.active_cosmetics_intro_card, u.active_cosmetics_collectible_title,
  u.active_cosmetics_gift_shelf, u.active_cosmetics_chat_bubble, u.active_cosmetics_seasonal_event,
  u.active_cosmetics_video_call_overlay, u.active_cosmetics_room_badge, u.active_cosmetics_room_ambience`;

export function createD1UserDiscoveryRouter(db: D1Database, presence: D1PresencePort = noD1Presence) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: import("express").Request) => requireHttpSession(req.headers.authorization, access);

  router.get("/search", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const q = String(req.query.q || "").trim();
    if (!q || q.length < 2) throw new HttpError(400, "Query must be at least 2 characters", ErrorCode.VALIDATION);
    const term = likeTerm(q);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const scope = String(req.query.scope || "");
    const searchWhere = scope === "username"
      ? "u.username LIKE ?1 ESCAPE '\\'"
      : `(u.name LIKE ?1 ESCAPE '\\' OR u.username LIKE ?1 ESCAPE '\\' OR u.city LIKE ?1 ESCAPE '\\'
          OR EXISTS (SELECT 1 FROM user_interests ui WHERE ui.users_id = u.source_id AND ui.value LIKE ?1 ESCAPE '\\'))`;
    const { results } = await db.prepare(`SELECT ${USER_LIST_SELECT} FROM users u
      WHERE ${searchWhere}
        AND u.is_blocked = 0
        AND u.source_id != ?2
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?2 AND b.blocked_user_id = u.source_id) OR (b.blocker_id = u.source_id AND b.blocked_user_id = ?2))
      ORDER BY CASE WHEN u.vip_expires_at IS NULL THEN 1 ELSE 0 END, u.vip_expires_at DESC,
               u.level DESC, u.followers_count DESC, u.created_at DESC, u.source_id DESC
      LIMIT ?3`).bind(term, user.id, limit).all<UserListRow>();
    const ids = results.map(row => row.source_id);
    const interests = await interestsForUsers(db, ids);
    let followingIds = new Set<string>();
    if (ids.length > 0) {
      const placeholders = ids.map(() => "?").join(",");
      const rows = await db.prepare(`SELECT following_id FROM follows WHERE follower_id = ? AND following_id IN (${placeholders})`)
        .bind(user.id, ...ids).all<{ following_id: string }>();
      followingIds = new Set(rows.results.map(row => row.following_id));
    }
    sendOk(res, { users: results.map(row => listUser(row, interests.get(row.source_id) ?? [], followingIds.has(row.source_id))) });
  }));

  router.get("/hosts/suggested", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const { results } = await db.prepare(`SELECT ${USER_LIST_SELECT} FROM users u
      WHERE u.source_id != ?1
        AND u.is_blocked = 0
        AND u.role IN ('HOST', 'MODERATOR', 'ADMIN')
        AND NOT EXISTS (SELECT 1 FROM follows f WHERE f.follower_id = ?1 AND f.following_id = u.source_id)
        AND NOT EXISTS (SELECT 1 FROM blocks b WHERE (b.blocker_id = ?1 AND b.blocked_user_id = u.source_id) OR (b.blocker_id = u.source_id AND b.blocked_user_id = ?1))
      ORDER BY CASE WHEN u.vip_expires_at IS NULL THEN 1 ELSE 0 END, u.vip_expires_at DESC,
               u.level DESC, u.followers_count DESC, u.created_at DESC, u.source_id DESC
      LIMIT ?2`).bind(user.id, limit).all<UserListRow>();
    const interests = await interestsForUsers(db, results.map(row => row.source_id));
    sendOk(res, { users: results.map(row => listUser(row, interests.get(row.source_id) ?? [], false)) });
  }));

  router.get("/recommended-chat", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const onlineIds = await presence.getOnlineUserIds();
    if (onlineIds.length === 0) return sendOk(res, { users: [] });
    const limit = Math.min(Number(req.query.limit) || 30, 60);
    const placeholders = onlineIds.map((_, index) => `?${index + 2}`).join(", ");
    const { results } = await db.prepare(`SELECT ${USER_LIST_SELECT} FROM users AS u
      WHERE u.source_id <> ?1 AND u.source_id IN (${placeholders})
        AND u.is_blocked = 0 AND u.deletion_requested_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM blocks AS b
          WHERE (b.blocker_id = ?1 AND b.blocked_user_id = u.source_id)
            OR (b.blocker_id = u.source_id AND b.blocked_user_id = ?1))
      ORDER BY RANDOM() LIMIT ?${onlineIds.length + 2}`)
      .bind(user.id, ...onlineIds, limit).all<UserListRow>();
    sendOk(res, { users: results.map(recommendedChatUser) });
  }));

  router.get("/:userId/pk-history", asyncHandler(async (req, res) => {
    await authenticate(req);
    const userId = d1UserId(req.params.userId);
    const { results } = await db.prepare(`WITH matching AS (
      SELECT source_id FROM pk_battles
        WHERE left_host_id = ?1 AND status IN ('ENDED', 'FORCE_ENDED')
      UNION
      SELECT source_id FROM pk_battles
        WHERE right_host_id = ?1 AND status IN ('ENDED', 'FORCE_ENDED')
    )
    SELECT ${pkBattleProjection} FROM matching AS m
    JOIN pk_battles AS b ON b.source_id = m.source_id ${pkBattleJoins}
    ORDER BY b.created_at DESC, b.source_id DESC LIMIT 50`).bind(userId).all<BattleRow>();
    const now = Date.now();
    sendOk(res, { battles: results.map(row => presentPkBattle(row, now)) });
  }));

  router.post("/me/profile-media", asyncHandler(async (req, res, next) => {
    res.locals.profileMediaSession = await authenticate(req);
    next();
  }), validateBody(profileMediaSchema), asyncHandler(async (req, res) => {
    const { user } = res.locals.profileMediaSession as Awaited<ReturnType<typeof authenticate>>;
    const body = req.body as z.infer<typeof profileMediaSchema>;
    const caption = body.caption ? sanitizeText(body.caption) : undefined;
    const id = newId();
    const time = new Date().toISOString();
    const max = 24;
    const statements = [
      db.prepare("UPDATE user_profile_media SET position = position + 1 WHERE users_id = ?").bind(user.id),
      db.prepare(`INSERT INTO user_profile_media (source_id, url, type, caption, created_at, users_id, position)
        VALUES (?, ?, ?, ?, ?, ?, 0)`).bind(id, body.url, body.type, caption ?? null, time, user.id),
      db.prepare("DELETE FROM user_profile_media WHERE users_id = ? AND position >= ?").bind(user.id, max)
    ];
    await db.batch(statements);

    const row = await prepareD1Profile(db, user.id, user.id).first<ProfileRow>();
    if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const profile = serializePublicProfile(restoreD1Profile(row, true), false);
    const media = { _id: id, url: body.url, type: body.type, createdAt: time, ...(caption ? { caption } : {}) };
    sendOk(res, { user: profile, media }, 201);
  }));

  router.delete("/me/profile-media/:mediaId", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    if (!isValidObjectId(req.params.mediaId)) throw new HttpError(400, "Invalid media ID", ErrorCode.VALIDATION);
    const mediaId = req.params.mediaId.toLowerCase();
    await db.batch([
      db.prepare("DELETE FROM user_profile_media WHERE source_id = ? AND users_id = ?").bind(mediaId, user.id),
    ]);
    // Re-pack positions to keep order contiguous.
    const { results } = await db.prepare(
      "SELECT source_id FROM user_profile_media WHERE users_id = ? ORDER BY position ASC, created_at DESC, source_id DESC"
    ).bind(user.id).all<{ source_id: string }>();
    if (results.length > 0) {
      await db.batch(results.map((row, index) =>
        db.prepare("UPDATE user_profile_media SET position = ? WHERE source_id = ? AND users_id = ?").bind(index, row.source_id, user.id)
      ));
    }

    const row = await prepareD1Profile(db, user.id, user.id).first<ProfileRow>();
    if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    sendOk(res, { user: serializePublicProfile(restoreD1Profile(row, true), false) });
  }));

  return router;
}
