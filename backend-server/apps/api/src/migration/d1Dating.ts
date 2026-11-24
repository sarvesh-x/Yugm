import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { relationshipXpEvents } from "@yugm/shared";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { datingPreferenceSchema } from "../services/datingPreferences.js";
import { calculateRelationshipLevel, getRelationshipStatus } from "../services/relationshipPresentation.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { person, personJson, visiblePerson } from "./d1People.js";

type MatchRow = {
  source_id: string; created_at: string | null; partner_id: string; person_json: string;
  vip_tier: string | null; vip_started_at: string | null; vip_expires_at: string | null;
  interests_json: string; languages_json: string; xp: number; level: number;
  streak_days: number; last_interaction_at: string | null;
};

const matches = `SELECT m.source_id, m.created_at,
  (SELECT peer.value FROM match_users AS peer WHERE peer.matches_id = m.source_id AND peer.value <> ?1
   ORDER BY peer.position, peer.source_id LIMIT 1) AS partner_id
  FROM matches AS m
  WHERE EXISTS (SELECT 1 FROM match_users WHERE matches_id = m.source_id AND value = ?1)`;
const fromMatches = `FROM matched JOIN users AS peer ON peer.source_id = matched.partner_id
  WHERE ${visiblePerson("peer", "?1")}`;
const pairKey = "MIN(?1, peer.source_id) || ':' || MAX(?1, peer.source_id)";

export function createD1DatingRouter(db: D1Database) {
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
  return router;
}
