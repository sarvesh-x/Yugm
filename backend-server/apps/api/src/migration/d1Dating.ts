import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { relationshipXpEvents } from "@yugm/shared";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { calculateCompatibility } from "../services/datingCompatibility.js";
import { datingPreferenceSchema } from "../services/datingPreferences.js";
import { calculateRelationshipLevel, getRelationshipStatus, relationshipPairKey, relationshipStreak } from "../services/relationshipPresentation.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";
import { noD1Presence, type D1PresencePort } from "./d1Presence.js";
import { person, personJson, visiblePerson } from "./d1People.js";

type MatchRow = {
  source_id: string; created_at: string | null; partner_id: string; person_json: string;
  vip_tier: string | null; vip_started_at: string | null; vip_expires_at: string | null;
  interests_json: string; languages_json: string; xp: number; level: number;
  streak_days: number; last_interaction_at: string | null;
};

type LikeRow = { source_id: string; liker_id: string; liked_id: string; type: string; created_at: string | null };
type NewMatchRow = { source_id: string; users_json: string; created_at: string | null; updated_at: string | null };
type RelationshipState = {
  source_id: string; xp: number; level: number; streak_days: number;
  last_streak_at: string | null; last_interaction_at: string | null;
};
type ExploreActor = {
  interested_in: string | null; looking_for: string | null; city: string | null;
  dating_age_min: number | null; dating_age_max: number | null; dating_verified_only: number;
  is_verified: number; interests_json: string; languages_json: string;
};
type ExploreRow = {
  source_id: string; person_json: string; age: number | null; gender: string | null;
  vibe_line: string | null; role: string | null; looking_for: string | null; is_verified: number;
  interests_json: string; languages_json: string;
  vip_tier: string | null; vip_level: number | null; vip_exp: number | null;
  vip_started_at: string | null; vip_expires_at: string | null;
  vip_frozen: number; vip_freeze_started_at: string | null;
};

const matches = `SELECT m.source_id, m.created_at,
  (SELECT peer.value FROM match_users AS peer WHERE peer.matches_id = m.source_id AND peer.value <> ?1
   ORDER BY peer.position, peer.source_id LIMIT 1) AS partner_id
  FROM matches AS m
  WHERE EXISTS (SELECT 1 FROM match_users WHERE matches_id = m.source_id AND value = ?1)`;
const fromMatches = `FROM matched JOIN users AS peer ON peer.source_id = matched.partner_id
  WHERE ${visiblePerson("peer", "?1")}`;
const pairKey = "MIN(?1, peer.source_id) || ':' || MAX(?1, peer.source_id)";

const parseStrings = (value: string | null | undefined) => JSON.parse(value ?? "[]") as string[];

function likeView(row: LikeRow) {
  return {
    _id: row.source_id,
    likerId: row.liker_id,
    likedId: row.liked_id,
    type: row.type,
    createdAt: row.created_at ?? undefined
  };
}

function matchView(row: NewMatchRow) {
  return {
    _id: row.source_id,
    users: parseStrings(row.users_json),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

export function createD1DatingRouter(db: D1Database, presence: D1PresencePort = noD1Presence) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");

  router.get("/preferences", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const row = await db.prepare(`SELECT interested_in, looking_for, dating_age_min, dating_age_max, dating_verified_only
      FROM users WHERE source_id = ?`).bind(user.id).first<{
      interested_in: string | null; looking_for: string | null; dating_age_min: number | null;
      dating_age_max: number | null; dating_verified_only: number;
    }>();
    sendOk(res, { preferences: {
      interestedIn: row?.interested_in ?? "Everyone", lookingFor: row?.looking_for ?? "Friendship",
      datingAgeMin: row?.dating_age_min ?? 18, datingAgeMax: row?.dating_age_max ?? 35,
      verifiedOnly: Boolean(row?.dating_verified_only)
    } });
  }));

  router.put("/preferences", asyncHandler(async (req, res, next) => {
    res.locals.claims = (await requireHttpSession(req.headers.authorization, access)).claims;
    next();
  }), validateBody(datingPreferenceSchema), asyncHandler(async (req, res) => {
    const claims = res.locals.claims;
    const time = new Date().toISOString();
    const editToken = randomBytes(16).toString("hex");
    const fields = JSON.stringify(Object.keys(req.body).map(field => field === "verifiedOnly" ? "datingVerifiedOnly" : field));
    const keep = `WHERE value NOT IN (SELECT value FROM json_each(?))`;
    const [claim, updated] = await db.batch([
      db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, missing_fields, edit_token)
        SELECT u.source_id, '[]', '[]', ? FROM users AS u
        WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL
        ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token,
          null_fields = (SELECT json_group_array(value) FROM json_each(null_fields) ${keep}),
          missing_fields = (SELECT json_group_array(value) FROM json_each(missing_fields) ${keep})`)
        .bind(editToken, ...bindD1LiveUser(claims, time), fields, fields),
      db.prepare(`UPDATE users SET interested_in = ?, looking_for = ?, dating_age_min = ?, dating_age_max = ?,
        dating_verified_only = COALESCE(?, dating_verified_only), updated_at = ?
        WHERE source_id = ? AND EXISTS (
          SELECT 1 FROM user_auth_profile WHERE source_id = users.source_id AND edit_token = ?
        )`).bind(req.body.interestedIn, req.body.lookingFor, req.body.datingAgeMin, req.body.datingAgeMax,
        req.body.verifiedOnly === undefined ? null : Number(req.body.verifiedOnly), time, claims.sub, editToken)
    ]);
    if (!claim.meta.changes || !updated.meta.changes) {
      await requireHttpSession(req.headers.authorization, access);
      throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    }
    sendOk(res, { preferences: req.body });
  }));

  router.get("/matches", asyncHandler(async (req, res) => {
    const { claims, user } = await requireHttpSession(req.headers.authorization, access);
    const now = new Date();
    const time = now.toISOString();
    const xp = relationshipXpEvents.MATCH_CREATED;
    const actor = bindD1LiveUser(claims, time);
    const pairKeys = `SELECT DISTINCT ${pairKey} AS pair_key ${fromMatches}`;
    const activeActor = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL)`;
    const [, , listed] = await db.batch<MatchRow>([
      // Keep lazy creation of relationships for older matches. A D1 batch
      // serializes concurrent requests, including the normalized member writes.
      db.prepare(`WITH matched AS (${matches}), pairs AS (${pairKeys})
        INSERT INTO relationships (source_id, pair_key, xp, level, level_title,
          streak_days, last_streak_at, last_interaction_at, created_at, updated_at)
        SELECT lower(hex(randomblob(12))), pairs.pair_key, ?2, 2, ?3, 1, ?4, ?5, ?5, ?5 FROM pairs
        WHERE NOT EXISTS (SELECT 1 FROM relationships AS previous WHERE previous.pair_key = pairs.pair_key)
          AND ${activeActor}`)
        .bind(user.id, xp, calculateRelationshipLevel(xp).title, startOfUtcDay(now).toISOString(), time, ...actor),
      db.prepare(`WITH matched AS (${matches}), pairs AS (${pairKeys}),
        members AS (
          SELECT relationship.source_id AS relationship_id, positions.position,
            CASE positions.position WHEN 0 THEN substr(relationship.pair_key, 1, instr(relationship.pair_key, ':') - 1)
              ELSE substr(relationship.pair_key, instr(relationship.pair_key, ':') + 1) END AS user_id
          FROM pairs JOIN relationships AS relationship ON relationship.pair_key = pairs.pair_key
          CROSS JOIN (SELECT 0 AS position UNION ALL SELECT 1) AS positions
        )
        INSERT INTO relationship_users (source_id, value, relationships_id, position)
        SELECT relationship_id || ':users:' || position, user_id, relationship_id, position FROM members
        WHERE ${activeActor} AND NOT EXISTS (SELECT 1 FROM relationship_users AS member
          WHERE member.relationships_id = members.relationship_id AND member.position = members.position)
        ON CONFLICT (source_id) DO NOTHING`).bind(user.id, ...actor),
      db.prepare(`WITH matched AS (${matches})
        SELECT matched.*, ${personJson("peer", true)} AS person_json, peer.vip_tier, peer.vip_started_at, peer.vip_expires_at,
          (SELECT json_group_array(value) FROM (SELECT value FROM user_interests WHERE users_id = peer.source_id ORDER BY position)) AS interests_json,
          (SELECT json_group_array(value) FROM (SELECT value FROM user_languages WHERE users_id = peer.source_id ORDER BY position)) AS languages_json,
          relationship.xp, relationship.level, relationship.streak_days, relationship.last_interaction_at
        FROM matched JOIN users AS peer ON peer.source_id = matched.partner_id
        JOIN relationships AS relationship ON relationship.source_id = (
          SELECT source_id FROM relationships WHERE pair_key = ${pairKey} ORDER BY source_id LIMIT 1
        )
        WHERE ${visiblePerson("peer", "?1")} AND ${activeActor}
        ORDER BY matched.created_at DESC, matched.source_id DESC`).bind(user.id, ...actor)
    ]);
    sendOk(res, { matches: listed.results.map(row => ({
      _id: row.source_id, id: row.source_id, matchDate: row.created_at ?? undefined,
      relationship: getRelationshipStatus({
        xp: row.xp, level: row.level, streakDays: row.streak_days, lastInteractionAt: row.last_interaction_at
      }),
      partner: {
        ...person(row.person_json), id: row.partner_id,
        interests: JSON.parse(row.interests_json), languages: JSON.parse(row.languages_json),
        ...getVipStatus({ vipTier: row.vip_tier, vipStartedAt: row.vip_started_at, vipExpiresAt: row.vip_expires_at })
      }
    })) });
  }));
  const requireSafeActor = async (authorization?: string) => {
    const session = await requireHttpSession(authorization, access);
    const shadow = await db.prepare(`SELECT 1 FROM user_safety_statuses
      WHERE user_id = ? AND is_shadow_banned = 1`).bind(session.user.id).first();
    if (shadow) throw new HttpError(403, "Account restricted", ErrorCode.FORBIDDEN);
    return session;
  };

  router.get("/explore", asyncHandler(async (req, res) => {
    const { user } = await requireSafeActor(req.headers.authorization);
    const queryMinAge = req.query.minAge ? Number(req.query.minAge) : undefined;
    const queryMaxAge = req.query.maxAge ? Number(req.query.maxAge) : undefined;
    const onlineOnly = req.query.onlineOnly === "true";
    const sharedOnly = req.query.sharedInterests === "true";
    const mode = String(req.query.mode ?? "FOR_YOU").toUpperCase();
    const actor = await db.prepare(`SELECT u.interested_in, u.looking_for, u.city, u.dating_age_min,
      u.dating_age_max, u.dating_verified_only, u.is_verified,
      (SELECT json_group_array(value) FROM (SELECT value FROM user_interests
        WHERE users_id = u.source_id ORDER BY position)) AS interests_json,
      (SELECT json_group_array(value) FROM (SELECT value FROM user_languages
        WHERE users_id = u.source_id ORDER BY position)) AS languages_json
      FROM users AS u WHERE u.source_id = ?`).bind(user.id).first<ExploreActor>();
    if (!actor) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const actorInterests = parseStrings(actor.interests_json);
    const actorLanguages = parseStrings(actor.languages_json);

    // An empty live-presence set preserves the legacy empty shape. Shared
    // interests with no actor interests cannot overlap either.
    const onlineIds = onlineOnly ? await presence.getOnlineUserIds() : [];
    if ((onlineOnly && onlineIds.length === 0) || (sharedOnly && actorInterests.length === 0)) {
      return sendOk(res, { candidates: [] });
    }

    const filters = [
      "u.source_id <> ?1",
      visiblePerson("u", "?1"),
      "NOT EXISTS (SELECT 1 FROM likes WHERE liker_id = ?1 AND liked_id = u.source_id)",
      "NOT EXISTS (SELECT 1 FROM user_safety_statuses WHERE user_id = u.source_id AND is_shadow_banned = 1)"
    ];
    const values: unknown[] = [user.id];
    let nextBinding = 2;
    const addFilter = (sql: string, value: unknown) => {
      filters.push(sql.replace("?", `?${nextBinding}`));
      values.push(value);
      nextBinding += 1;
    };

    const interestedIn = actor.interested_in;
    const gender = interestedIn === "Women" ? "Female"
      : interestedIn === "Men" ? "Male"
        : interestedIn && interestedIn !== "Everyone" ? "Non-binary" : undefined;
    if (gender) addFilter("u.gender = ?", gender);
    if (queryMinAge || queryMaxAge) {
      addFilter("u.age >= ?", queryMinAge || 18);
      addFilter("u.age <= ?", queryMaxAge || 80);
    } else if (actor.dating_age_min || actor.dating_age_max) {
      addFilter("u.age >= ?", actor.dating_age_min || 18);
      addFilter("u.age <= ?", actor.dating_age_max || 80);
    }
    if (actor.dating_verified_only || mode === "VERIFIED") filters.push("u.is_verified = 1");
    if (mode === "NEARBY" && actor.city?.trim()) addFilter("u.city = ?", actor.city);
    if (sharedOnly) {
      addFilter(`EXISTS (SELECT 1 FROM json_each(?) AS wanted
        JOIN user_interests AS interest ON interest.users_id = u.source_id AND interest.value = wanted.value)`,
      JSON.stringify(actorInterests));
    }
    if (onlineOnly) {
      const placeholders = onlineIds.map(() => `?${nextBinding++}`).join(", ");
      filters.push(`u.source_id IN (${placeholders})`);
      values.push(...onlineIds);
    }

    const rows = await db.prepare(`SELECT u.source_id, ${personJson("u", true)} AS person_json,
      u.age, u.gender, u.vibe_line, u.role, u.looking_for, u.is_verified,
      u.vip_tier, u.vip_level, u.vip_exp, u.vip_started_at, u.vip_expires_at,
      u.vip_frozen, u.vip_freeze_started_at,
      (SELECT json_group_array(value) FROM (SELECT value FROM user_interests
        WHERE users_id = u.source_id ORDER BY position)) AS interests_json,
      (SELECT json_group_array(value) FROM (SELECT value FROM user_languages
        WHERE users_id = u.source_id ORDER BY position)) AS languages_json
      FROM users AS u WHERE ${filters.join(" AND ")} ORDER BY RANDOM() LIMIT 40`)
      .bind(...values).all<ExploreRow>();
    sendOk(res, { candidates: await Promise.all(rows.results.map(async row => {
      const candidateInterests = parseStrings(row.interests_json);
      const candidateLanguages = parseStrings(row.languages_json);
      const base = person(row.person_json) as Record<string, unknown>;
      const candidateCity = typeof base.city === "string" ? base.city : undefined;
      delete base.xp;
      delete base.level;
      delete base.levelTitle;
      const compatibility = calculateCompatibility({
        city: actor.city ?? undefined, languages: actorLanguages, interests: actorInterests,
        lookingFor: actor.looking_for ?? undefined, isVerified: Boolean(actor.is_verified)
      }, {
        city: candidateCity, languages: candidateLanguages, interests: candidateInterests,
        lookingFor: row.looking_for ?? undefined, isVerified: Boolean(row.is_verified)
      });
      return {
        ...base,
        id: row.source_id,
        age: row.age ?? undefined,
        gender: row.gender ?? undefined,
        vibeLine: row.vibe_line ?? undefined,
        role: row.role ?? undefined,
        interests: candidateInterests,
        languages: candidateLanguages,
        ...getVipStatus({
          vipTier: row.vip_tier, vipLevel: row.vip_level, vipExp: row.vip_exp,
          vipStartedAt: row.vip_started_at, vipExpiresAt: row.vip_expires_at,
          vipFrozen: row.vip_frozen, vipFreezeStartedAt: row.vip_freeze_started_at
        }),
        vibeScore: compatibility.score,
        matchReasons: compatibility.reasons,
        sharedInterests: compatibility.sharedInterests,
        sharedLanguages: compatibility.sharedLanguages,
        isOnline: await presence.isUserOnline(row.source_id)
      };
    })) });
  }));

  router.post("/like", asyncHandler(async (req, res) => {
    const { claims, user } = await requireSafeActor(req.headers.authorization);
    const actorId = user.id;
    const body = req.body as { likedId?: unknown; type?: unknown };
    const rawLikedId = typeof body.likedId === "string" ? body.likedId : "";
    if (!rawLikedId || !isValidObjectId(rawLikedId)) {
      throw new HttpError(400, "Invalid likedId", ErrorCode.VALIDATION);
    }
    if (actorId === rawLikedId) throw new HttpError(400, "You cannot like yourself", ErrorCode.VALIDATION);
    const likedId = rawLikedId.toLowerCase();

    const blocked = await db.prepare(`SELECT 1 FROM blocks WHERE
      (blocker_id = ? AND blocked_user_id = ?) OR (blocker_id = ? AND blocked_user_id = ?) LIMIT 1`)
      .bind(actorId, likedId, likedId, actorId).first();
    if (blocked) throw new HttpError(403, "Cannot like this user", ErrorCode.FORBIDDEN);
    const existing = await db.prepare("SELECT 1 FROM likes WHERE liker_id = ? AND liked_id = ?")
      .bind(actorId, likedId).first();
    if (existing) throw new HttpError(400, "Already swiped on this user", ErrorCode.VALIDATION);
    const type = body.type === undefined ? "LIKE" : String(body.type);
    if (type !== "LIKE" && type !== "SUPER_LIKE" && type !== "PASS") {
      throw new HttpError(400, `Like validation failed: type: \`${type}\` is not a valid enum value for path \`type\`.`, ErrorCode.VALIDATION);
    }

    const mutual = await db.prepare(`SELECT source_id, type FROM likes WHERE liker_id = ? AND liked_id = ?
      AND type IN ('LIKE', 'SUPER_LIKE') ORDER BY created_at, source_id LIMIT 1`)
      .bind(likedId, actorId).first<{ source_id: string; type: string }>();
    const isMatch = Boolean(mutual && (type === "LIKE" || type === "SUPER_LIKE"));
    const pair = relationshipPairKey(actorId, likedId);
    const existingMatch = await db.prepare(`SELECT m.source_id FROM matches AS m WHERE m.pair_key = ?
      OR EXISTS (SELECT 1 FROM match_users AS a WHERE a.matches_id = m.source_id AND a.value = ?
        AND EXISTS (SELECT 1 FROM match_users AS b WHERE b.matches_id = m.source_id AND b.value = ?)) LIMIT 1`)
      .bind(pair, actorId, likedId).first();
    const relationship = await db.prepare(`SELECT source_id, xp, level, streak_days, last_streak_at, last_interaction_at
      FROM relationships WHERE pair_key = ? ORDER BY source_id LIMIT 1`).bind(pair).first<RelationshipState>();

    const now = new Date();
    const time = now.toISOString();
    const likeId = newId();
    const matchId = newId();
    const relationshipId = newId();
    const actorValues = bindD1LiveUser(claims, time);
    const claimed = "EXISTS (SELECT 1 FROM likes WHERE source_id = ? AND liker_id = ? AND liked_id = ?)";
    const claimValues = [likeId, actorId, likedId];
    const newMatch = `NOT EXISTS (SELECT 1 FROM matches WHERE pair_key = ?)
      AND NOT EXISTS (SELECT 1 FROM match_users AS a WHERE a.value = ?
        AND EXISTS (SELECT 1 FROM match_users AS b WHERE b.matches_id = a.matches_id AND b.value = ?))`;
    const version = relationship
      ? JSON.stringify([relationship.source_id, relationship.xp, relationship.level, relationship.streak_days, relationship.last_streak_at])
      : null;
    const relationGuard = `(SELECT json_array(source_id, xp, level, streak_days, last_streak_at)
      FROM relationships WHERE pair_key = ?) IS ?`;
    const statements = [db.prepare(`INSERT INTO likes (source_id, liker_id, liked_id, type, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ? FROM users AS u
      WHERE NOT EXISTS (SELECT 1 FROM likes WHERE liker_id = ? AND liked_id = ?)
        AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = ? AND blocked_user_id = ?)
          OR (blocker_id = ? AND blocked_user_id = ?))
        AND NOT EXISTS (SELECT 1 FROM user_safety_statuses WHERE user_id = ? AND is_shadow_banned = 1)
        AND ${d1LiveUserFilter}`)
      .bind(likeId, actorId, likedId, type, time, time, actorId, likedId, actorId, likedId, likedId, actorId,
        actorId, ...actorValues)];

    if (isMatch && !existingMatch) {
      const event = type === "SUPER_LIKE" || mutual?.type === "SUPER_LIKE" ? "SUPER_LIKE_MATCH" : "MATCH_CREATED";
      const awarded = relationshipXpEvents[event];
      const xp = (relationship?.xp ?? 0) + awarded;
      const streak = relationshipStreak(relationship?.last_streak_at, relationship?.streak_days ?? 0, now);
      const status = getRelationshipStatus({ xp, level: relationship?.level, streakDays: streak.streakDays, lastInteractionAt: time });
      const priorLevel = relationship?.level ?? 1;
      const lastStreak = new Date(streak.lastStreakAt).toISOString();
      const versionAfter = JSON.stringify([relationship?.source_id ?? relationshipId, xp, status.level,
        streak.streakDays, lastStreak]);

      if (relationship) {
        statements.push(db.prepare(`UPDATE relationships SET xp = ?, level = ?, level_title = ?, streak_days = ?,
          last_streak_at = ?, last_interaction_at = ?, updated_at = ? WHERE source_id = ?
          AND ${relationGuard} AND ${newMatch} AND ${claimed}`)
          .bind(xp, status.level, status.title, streak.streakDays, lastStreak, time, time, relationship.source_id,
            pair, version, pair, actorId, likedId, ...claimValues));
      } else {
        statements.push(db.prepare(`INSERT INTO relationships (source_id, pair_key, xp, level, level_title,
          streak_days, last_streak_at, last_interaction_at, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${relationGuard} AND ${newMatch} AND ${claimed}`)
          .bind(relationshipId, pair, xp, status.level, status.title, streak.streakDays, lastStreak, time, time, time,
            pair, version, pair, actorId, likedId, ...claimValues));
        for (const [position, member] of [actorId, likedId].entries()) {
          statements.push(db.prepare(`INSERT INTO relationship_users (source_id, value, relationships_id, position)
            SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM relationships WHERE source_id = ?) AND ${claimed}`)
            .bind(`${relationshipId}:users:${position}`, member, relationshipId, position, relationshipId, ...claimValues));
        }
      }
      if (status.level > priorLevel) {
        for (const userId of [actorId, likedId]) {
          statements.push(db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
            SELECT ?, ?, 'SYSTEM', ?, ?, ?, 0, ?, ? WHERE ${relationGuard} AND ${newMatch} AND ${claimed}`)
            .bind(newId(), userId, "Relationship level up!", `Your bond reached Level ${status.level}: ${status.title}.`,
              JSON.stringify({ type: "RELATIONSHIP_LEVEL_UP", partnerIds: [actorId, likedId], level: status.level }),
              time, time, pair, versionAfter, pair, actorId, likedId, ...claimValues));
        }
      }
      if (streak.streakDays > 1 && streak.streakDays % 7 === 0) {
        for (const userId of [actorId, likedId]) {
          statements.push(db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
            SELECT ?, ?, 'SYSTEM', ?, ?, ?, 0, ?, ? WHERE ${relationGuard} AND ${newMatch} AND ${claimed}`)
            .bind(newId(), userId, "Duo streak!", `You have a ${streak.streakDays}-day relationship streak.`,
              JSON.stringify({ type: "RELATIONSHIP_STREAK", partnerIds: [actorId, likedId], streakDays: streak.streakDays }),
              time, time, pair, versionAfter, pair, actorId, likedId, ...claimValues));
        }
      }

      statements.push(db.prepare(`INSERT INTO matches (source_id, pair_key, created_at, updated_at)
        SELECT ?, ?, ?, ? WHERE ${newMatch} AND ${claimed}`)
        .bind(matchId, pair, time, time, pair, actorId, likedId, ...claimValues));
      for (const [position, member] of [actorId, likedId].entries()) {
        statements.push(db.prepare(`INSERT INTO match_users (source_id, value, matches_id, position)
          SELECT ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM matches WHERE source_id = ?) AND ${claimed}
          ON CONFLICT (matches_id, value) DO NOTHING`)
          .bind(`${matchId}:users:${position}`, member, matchId, position, matchId, ...claimValues));
      }

      const actorName = await db.prepare("SELECT name FROM users WHERE source_id = ?").bind(actorId).first<string>("name");
      const otherName = await db.prepare("SELECT name FROM users WHERE source_id = ?").bind(likedId).first<string>("name");
      const notices = [
        { userId: likedId, body: `You matched with ${actorName ?? "someone"}! Start chatting now.`, partnerId: actorId },
        { userId: actorId, body: `You matched with ${otherName ?? "someone"}! Start chatting now.`, partnerId: likedId }
      ];
      for (const notice of notices) {
        statements.push(db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
          SELECT ?, ?, 'SYSTEM', ?, ?, ?, 0, ?, ? WHERE EXISTS (SELECT 1 FROM matches WHERE source_id = ?) AND ${claimed}`)
          .bind(newId(), notice.userId, "It's a Yugm!", notice.body,
            JSON.stringify({ type: "MATCH", matchId, partnerId: notice.partnerId }), time, time, matchId, ...claimValues));
      }
    }

    try {
      await db.batch(statements);
    } catch (error) {
      const stored = await db.prepare("SELECT 1 FROM likes WHERE liker_id = ? AND liked_id = ?")
        .bind(actorId, likedId).first();
      if (stored) throw new HttpError(400, "Already swiped on this user", ErrorCode.VALIDATION);
      throw error;
    }
    const like = await db.prepare("SELECT source_id, liker_id, liked_id, type, created_at FROM likes WHERE source_id = ?")
      .bind(likeId).first<LikeRow>();
    if (!like) throw new HttpError(400, "Already swiped on this user", ErrorCode.VALIDATION);
    const match = isMatch
      ? await db.prepare(`SELECT m.source_id, m.created_at, m.updated_at,
          (SELECT json_group_array(value) FROM (SELECT value FROM match_users WHERE matches_id = m.source_id ORDER BY position)) AS users_json
          FROM matches AS m WHERE m.source_id = ?`).bind(matchId).first<NewMatchRow>()
      : null;
    sendOk(res, { like: likeView(like), isMatch, match: match ? matchView(match) : null });
  }));

  router.post("/pass", asyncHandler(async (req, res) => {
    const { claims, user } = await requireSafeActor(req.headers.authorization);
    const actorId = user.id;
    const body = req.body as { likedId?: unknown };
    const rawLikedId = typeof body.likedId === "string" ? body.likedId : "";
    if (!rawLikedId || !isValidObjectId(rawLikedId)) {
      throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
    }
    const likedId = rawLikedId.toLowerCase();
    const existing = await db.prepare("SELECT 1 FROM likes WHERE liker_id = ? AND liked_id = ?")
      .bind(actorId, likedId).first();
    if (existing) throw new HttpError(400, "Already swiped on this user", ErrorCode.VALIDATION);

    const time = new Date().toISOString();
    const passId = newId();
    const actorValues = bindD1LiveUser(claims, time);
    try {
      await db.batch([db.prepare(`INSERT INTO likes (source_id, liker_id, liked_id, type, created_at, updated_at)
        SELECT ?, ?, ?, 'PASS', ?, ? FROM users AS u
        WHERE NOT EXISTS (SELECT 1 FROM likes WHERE liker_id = ? AND liked_id = ?)
          AND NOT EXISTS (SELECT 1 FROM user_safety_statuses WHERE user_id = ? AND is_shadow_banned = 1)
          AND ${d1LiveUserFilter}`)
        .bind(passId, actorId, likedId, time, time, actorId, likedId, actorId, ...actorValues)]);
    } catch (error) {
      const stored = await db.prepare("SELECT 1 FROM likes WHERE liker_id = ? AND liked_id = ?")
        .bind(actorId, likedId).first();
      if (stored) throw new HttpError(400, "Already swiped on this user", ErrorCode.VALIDATION);
      throw error;
    }
    const pass = await db.prepare("SELECT source_id, liker_id, liked_id, type, created_at FROM likes WHERE source_id = ?")
      .bind(passId).first<LikeRow>();
    if (!pass) throw new HttpError(400, "Already swiped on this user", ErrorCode.VALIDATION);
    sendOk(res, { pass: likeView(pass) });
  }));

  return router;
}
