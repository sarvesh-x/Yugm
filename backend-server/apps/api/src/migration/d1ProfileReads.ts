import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { serializePublicProfile } from "../services/profilePresentation.js";
import { ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { responseError } from "../utils/responseError.js";
import { AUTH_PROFILE_ARRAYS, PROFILE_NESTED_FIELDS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";

type SqlValue = string | number | null;
export type ProfileRow = Record<string, SqlValue> & {
  source_id: string;
  followers_count: number;
  following_count: number;
  friends_count: number;
  bonds_count: number;
  viewer_follows: number;
  viewer_bonded: number;
  viewer_hides_visits: number;
  stored_level: number;
  xp: number;
  wallet_balance: number | null;
  stored_followers_count: number;
  stored_following_count: number;
};

const fields = [
  "name", "username", "role", "avatar", "avatarType", "xp", "lastDailyCheckInAt", "isVerified", "clanId", "streakCount",
  "vipTier", "vipLevel", "vipExp", "vipStartedAt", "vipExpiresAt", "vipFrozen", "vipFreezeStartedAt",
  "profileCompletedAt", "termsAcceptedAt", "city", "state", "bio", "vibeLine", "gender", "age",
  "interestedIn", "lookingFor", "datingAgeMin", "datingAgeMax"
] as const;
const arrays = Object.entries({ ...AUTH_PROFILE_ARRAYS, showcasedBadgeIds: "user_showcased_badges" });
const unsupportedRoots = new Set(["friend-match", "search", "recommended-chat", "messages"]);

function column(field: string) {
  return field.replace(/[A-Z]/g, character => `_${character.toLowerCase()}`);
}

const columns = ["source_id", ...fields.map(column), ...PROFILE_NESTED_FIELDS.flatMap(([field, keys]) =>
  keys.map(key => `${column(field)}_${column(key)}`))];
const orderedArrays = arrays.map(([field, table]) => `(
  SELECT json_group_array(value)
  FROM (SELECT value FROM ${table} WHERE users_id = u.source_id ORDER BY position)
) AS ${column(field)}_json`);
const noBlock = `NOT EXISTS (
  SELECT 1 FROM blocks WHERE (blocker_id = u.source_id AND blocked_user_id = viewer.source_id)
  OR (blocker_id = viewer.source_id AND blocked_user_id = u.source_id)
)`;
const readProfile = `SELECT ${columns.map(name => `u.${name}`).join(", ")},
  p.null_fields, p.missing_fields, p.edit_token, u.updated_at, u.level AS stored_level,
  u.followers_count AS stored_followers_count, u.following_count AS stored_following_count,
  CASE WHEN u.source_id = viewer.source_id THEN u.email END AS email,
  CASE WHEN u.source_id = viewer.source_id THEN u.email_verified END AS email_verified,
  ${orderedArrays.join(", ")},
  CASE WHEN u.source_id = viewer.source_id THEN u.wallet_balance END AS wallet_balance,
  (SELECT json_group_array(json_object('source_id', source_id, 'url', url, 'type', type,
      'caption', caption, 'created_at', created_at, 'position', position))
   FROM (SELECT * FROM user_profile_media WHERE users_id = u.source_id ORDER BY position)) AS media_json,
  (SELECT COUNT(*) FROM follows WHERE following_id = u.source_id) AS followers_count,
  (SELECT COUNT(*) FROM follows WHERE follower_id = u.source_id) AS following_count,
  (SELECT COUNT(*) FROM friendships WHERE status = 'ACCEPTED'
     AND (user_id = u.source_id OR friend_id = u.source_id)) AS friends_count,
  (SELECT COUNT(DISTINCT b.source_id) FROM bond_users AS member JOIN bonds AS b ON b.source_id = member.bonds_id
     WHERE member.value = u.source_id AND b.status = 'ACTIVE') AS bonds_count,
  EXISTS (SELECT 1 FROM follows WHERE follower_id = viewer.source_id AND following_id = u.source_id) AS viewer_follows,
  EXISTS (SELECT 1 FROM bond_users AS member JOIN bonds AS b ON b.source_id = member.bonds_id
     JOIN bond_users AS peer ON peer.bonds_id = b.source_id
     WHERE member.value = u.source_id AND peer.value = viewer.source_id AND b.status = 'ACTIVE') AS viewer_bonded,
  (SELECT level FROM trust_verifications WHERE user_id = u.source_id LIMIT 1) AS trust_level,
  viewer.mysterious_visitors AS viewer_hides_visits
FROM users AS u JOIN users AS viewer ON viewer.source_id = ?2
LEFT JOIN user_auth_profile AS p ON p.source_id = u.source_id`;

export function prepareD1Profile(db: D1Database, identifier: string, viewerId: string, byUsername = false) {
  const field = byUsername ? "username" : "source_id";
  return db.prepare(`${readProfile} WHERE u.${field} = ?1 AND u.is_blocked = 0 AND ${noBlock}`).bind(identifier, viewerId);
}

export function restoreD1Profile(row: ProfileRow, isSelf: boolean) {
  const nulls = new Set<string>(JSON.parse(String(row.null_fields ?? "[]")));
  const missing = new Set<string>(JSON.parse(String(row.missing_fields ?? "[]")));
  const profile: Record<string, unknown> = {
    _id: row.source_id,
    followersCount: row.followers_count, followingCount: row.following_count,
    friendsCount: row.friends_count, bondsCount: row.bonds_count,
    isFollowing: !isSelf && Boolean(row.viewer_follows), isBonded: !isSelf && Boolean(row.viewer_bonded),
    verificationLevel: row.is_verified ? (row.trust_level === "ADVANCED" ? "ADVANCED" : "BASIC") : "NONE"
  };
  const value = (field: string, stored: unknown) => missing.has(field) ? undefined
    : nulls.has(field) ? null : stored ?? undefined;
  for (const field of fields) profile[field] = value(field, row[column(field)]);
  if (isSelf) profile.walletBalance = value("walletBalance", row.wallet_balance);
  for (const [field] of arrays) {
    profile[field] = value(field, JSON.parse(String(row[`${column(field)}_json`])));
  }
  for (const [field, keys] of PROFILE_NESTED_FIELDS) {
    profile[field] = value(field, Object.fromEntries(keys.flatMap(key => {
      const stored = value(`${field}.${key}`, row[`${column(field)}_${column(key)}`]);
      return stored === undefined ? [] : [[key, stored]];
    })));
  }
  const media: Array<{ source_id: string; url: string; type: string; caption: string | null; created_at: string; position: number }> =
    JSON.parse(String(row.media_json));
  profile.profileMedia = value("profileMedia", media.map(item => ({
    _id: isValidObjectId(item.source_id) ? item.source_id : undefined,
    url: item.url, type: item.type, createdAt: item.created_at,
    caption: value(`profileMedia.${item.position}.caption`, item.caption)
  })));
  return profile;
}

function recordVisit(db: D1Database, profileId: string, visitorId: string) {
  return db.prepare(`
    INSERT INTO profile_visits (source_id, profile_id, visitor_id, last_visited_at, created_at, updated_at)
    SELECT ?3, u.source_id, viewer.source_id, ?4, ?4, ?4
    FROM users AS u JOIN users AS viewer ON viewer.source_id = ?2
    WHERE u.source_id = ?1 AND u.is_blocked = 0 AND viewer.is_blocked = 0
      AND viewer.mysterious_visitors = 0 AND ${noBlock}
    ON CONFLICT (profile_id, visitor_id) DO UPDATE SET
      last_visited_at = excluded.last_visited_at, updated_at = excluded.updated_at
    WHERE excluded.last_visited_at >= profile_visits.last_visited_at
  `).bind(profileId, visitorId, randomBytes(12).toString("hex"), new Date().toISOString()).run();
}

/** Returns undefined for routes outside the local Profile read slice. */
export async function readD1ProfileRequest(
  db: D1Database, request: Request, trackVisit: (promise: Promise<unknown>) => void
): Promise<Response | undefined> {
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const path = /^\/api\/users\/(?:(public|by-username)\/)?([^/]+)\/?$/i.exec(new URL(request.url).pathname);
  if (!path || (!path[1] && unsupportedRoots.has(path[2].toLowerCase()))) return;

  const reply = (body: object, status = 200) => request.method === "HEAD"
    ? new Response(null, { status, headers: { "Content-Type": "application/json" } })
    : Response.json(body, { status });
  try {
    // The mounted legacy app requires auth even for the `public` aliases.
    const { user: viewer } = await requireHttpSession(request.headers.get("Authorization"), createD1AccessSessionReader(db, "http"));
    const byUsername = path[1]?.toLowerCase() === "by-username";
    const value = decodeURIComponent(path[2]).toLowerCase();
    const identifier = byUsername ? value.trim().replace(/^@/, "") : !path[1] && value === "me" ? viewer.id : value;
    if (!byUsername && !isValidObjectId(identifier)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
    const row = await prepareD1Profile(db, identifier, viewer.id, byUsername).first<ProfileRow>();
    if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

    const isSelf = row.source_id === viewer.id;
    if (!isSelf && !row.viewer_hides_visits) {
      trackVisit(recordVisit(db, row.source_id, viewer.id).catch(() => console.error("D1 profile visit failed")));
    }
    return reply({ ok: true, data: { user: serializePublicProfile(restoreD1Profile(row, isSelf), false) } });
  } catch (error) {
    if (error instanceof URIError) return reply({ ok: false, error: {
      message: "Invalid profile path", code: ErrorCode.VALIDATION, requestId: crypto.randomUUID()
    } }, 400);
    const { status, message, code } = responseError(error);
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("D1 profile read failed", requestId, error instanceof Error ? error.name : "Error");
    return reply({ ok: false, error: { message: status >= 500 ? "Unexpected server error" : message, code, requestId } }, status);
  }
}
