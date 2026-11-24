import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Request } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { person, personJson, visiblePerson } from "./d1People.js";

type Row = Record<string, string | number | null>;
const privilegedRoles = new Set(["HOST", "SPEAKER", "MODERATOR"]);
const ordered = "ORDER BY r.participant_count DESC, r.created_at DESC, r.source_id";
const livePublic = "r.visibility = 'PUBLIC' AND r.status = 'LIVE'";

function snake(field: string) {
  return field.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
}

const roomArrays = {
  speakerIds: "room_speakers", moderatorIds: "room_moderators", roomAdminIds: "room_admins",
  coHostIds: "room_cohosts", lockedSeatIndices: "room_locked_seats"
} as const;
const roomValues = Object.entries(roomArrays).map(([field, table]) => `(SELECT json_group_array(value) FROM (
  SELECT value FROM ${table} WHERE rooms_id = r.source_id ORDER BY position)) AS ${snake(field)}_json`).join(", ");
const roomProjection = `r.*, ${personJson("host")} AS host_json, ${roomValues}`;
const fromRooms = "FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id";
const roomAccess = `r.visibility = 'PUBLIC' OR r.host_id = ?2 OR EXISTS (
  SELECT 1 FROM room_invites WHERE room_id = r.source_id AND invitee_id = ?2 AND status IN ('PENDING', 'ACCEPTED')
) OR ${[roomArrays.speakerIds, roomArrays.moderatorIds, roomArrays.roomAdminIds, roomArrays.coHostIds].map(table =>
  `EXISTS (SELECT 1 FROM ${table} WHERE rooms_id = r.source_id AND value = ?2)`).join(" OR ")}`;

function room(row: Row) {
  return {
    _id: row.source_id, title: row.title, description: row.description ?? undefined,
    type: row.type, hostId: person(String(row.host_json)), coverImage: row.cover_image ?? undefined,
    category: row.category, tags: JSON.parse(String(row.tags)), language: row.language,
    status: row.status, visibility: row.visibility, maxSpeakers: row.max_speakers,
    participantCount: row.participant_count, activePkId: row.active_pk_id ?? undefined, isDuet: Boolean(row.is_duet),
    livekitRoomName: row.livekit_room_name, allowAudienceMicRequests: Boolean(row.allow_audience_mic_requests),
    micLocked: Boolean(row.mic_locked), theme: row.theme ?? undefined, vipOnly: Boolean(row.vip_only),
    badge: row.badge ?? undefined, ambience: row.ambience ?? undefined, scheduledFor: row.scheduled_for ?? undefined,
    startedAt: row.started_at ?? undefined, endedAt: row.ended_at ?? undefined, mode: row.mode ?? undefined,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined,
    ...Object.fromEntries(Object.keys(roomArrays).map(field => [field, JSON.parse(String(row[`${snake(field)}_json`]))]))
  };
}

function roomId(value: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
}

function visible(row?: Row | null) {
  if (!row) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  if (!row.can_read) throw new HttpError(403, "This private room is invite only", ErrorCode.FORBIDDEN);
  return row;
}

function pageSize(value: unknown, fallback: number, max: number) {
  return Math.trunc(Math.min(Math.max(Number(value) || fallback, 1), max));
}

export async function readD1HostRooms(db: D1Database, hostId: string, viewer: string, limit: unknown) {
  const { results } = await db.prepare(`SELECT ${roomProjection} ${fromRooms}
    WHERE r.host_id = ?1 AND r.status = 'LIVE' AND (${roomAccess}) AND ${visiblePerson("host", "?2")}
    ORDER BY r.created_at DESC, r.source_id LIMIT ?3`)
    .bind(hostId, viewer, pageSize(limit, 20, 50)).all<Row>();
  return results.map(room);
}

function participants(rows: Row[], maxSpeakers: number) {
  // Legacy active speakers can have a missing saved seat. Preserve the existing roster fallback.
  const assigned = new Set(rows.filter(row => privilegedRoles.has(String(row.role)) && row.seat_index !== null)
    .map(row => Number(row.seat_index)));
  const maxSeats = Math.min(20, Math.max(2, maxSpeakers || 8));
  return rows.map(row => {
    let seat = row.seat_index ?? undefined;
    if (seat === undefined && privilegedRoles.has(String(row.role))) {
      for (let index = 0; index < maxSeats; index++) {
        if (assigned.has(index)) continue;
        assigned.add(index);
        seat = index;
        break;
      }
    }
    return {
      _id: row.source_id, roomId: row.room_id, userId: person(String(row.user_json)), role: row.role,
      micEnabled: Boolean(row.mic_enabled), moderatorMuted: Boolean(row.moderator_muted), cameraEnabled: Boolean(row.camera_enabled),
      isRoomAdmin: Boolean(row.is_room_admin), seatIndex: seat, joinedAt: row.joined_at
    };
  });
}

export function createD1RoomsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, access);
  const lists = async (filter: string, ...values: Array<string | number | null>) =>
    (await db.prepare(`SELECT ${roomProjection} ${fromRooms} ${filter}`).bind(...values).all<Row>()).results;

  router.get("/", asyncHandler(async (req, res) => {
    const type = typeof req.query.type === "string" ? req.query.type : null;
    const category = typeof req.query.category === "string" ? req.query.category : null;
    const rooms = await lists(`WHERE ${livePublic} AND (?1 IS NULL OR r.type = ?1)
      AND (?2 IS NULL OR r.category = ?2) ${ordered} LIMIT 50`, type, category);
    sendOk(res, { rooms: rooms.map(room) });
  }));

  router.get("/scheduled", asyncHandler(async (_req, res) => {
    const rooms = await lists("WHERE r.visibility = 'PUBLIC' AND r.status = 'SCHEDULED' ORDER BY r.scheduled_for, r.source_id LIMIT 30");
    sendOk(res, { rooms: rooms.map(room) });
  }));

  router.get("/trending", asyncHandler(async (_req, res) => {
    const rooms = await lists(`WHERE ${livePublic} ${ordered} LIMIT 12`);
    sendOk(res, { rooms: rooms.map(room) });
  }));

  router.get("/search", asyncHandler(async (req, res) => {
    const query = String(req.query.q ?? "").trim();
    if (query.length < 2) throw new HttpError(400, "Query must be at least 2 characters", ErrorCode.VALIDATION);
    const fields = ["title", "description", "category", "language"].map(field => `instr(lower(r.${field}), lower(?1)) > 0`);
    const rooms = await lists(`WHERE ${livePublic} AND (${fields.join(" OR ")}
      OR EXISTS (SELECT 1 FROM json_each(r.tags) AS tag WHERE instr(lower(tag.value), lower(?1)) > 0))
      ${ordered} LIMIT ?2`, query, pageSize(req.query.limit, 20, 50));
    sendOk(res, { rooms: rooms.map(room) });
  }));

  router.get("/followed", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const rooms = await lists(`JOIN room_follows AS f ON f.room_id = r.source_id AND f.user_id = ?
      WHERE r.visibility = 'PUBLIC' ORDER BY f.created_at DESC, f.source_id`, user.id);
    sendOk(res, { rooms: rooms.map(room) });
  }));

  router.get("/recommended", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const following = "EXISTS (SELECT 1 FROM follows WHERE follower_id = ?1 AND following_id = r.host_id)";
    const friend = `EXISTS (SELECT 1 FROM friendships WHERE status = 'ACCEPTED'
      AND ((user_id = ?1 AND friend_id = r.host_id) OR (friend_id = ?1 AND user_id = r.host_id)))`;
    const interests = "SELECT value FROM user_interests WHERE users_id = ?1";
    const languages = "SELECT value FROM user_languages WHERE users_id = ?1";
    const { results } = await db.prepare(`SELECT ${roomProjection}, ${following} AS host_followed, ${friend} AS host_friend,
      lower(r.category) IN (SELECT lower(value) FROM user_interests WHERE users_id = ?1) AS match_interest,
      lower(r.language) IN (SELECT lower(value) FROM user_languages WHERE users_id = ?1) AS match_language
      ${fromRooms} WHERE ${livePublic} AND (${following} OR ${friend}
        OR r.category IN (${interests}) OR r.language IN (${languages})
        OR EXISTS (SELECT 1 FROM json_each(r.tags) AS tag
          WHERE lower(tag.value) IN (SELECT lower(value) FROM user_interests WHERE users_id = ?1)))
      ${ordered} LIMIT 20`).bind(user.id).all<Row>();
    sendOk(res, { rooms: results.map(row => ({
      ...room(row),
      recommendationHints: [
        ...(row.host_friend ? ["Your friend is hosting"] : []),
        ...(row.host_followed ? ["You follow the host"] : []),
        ...(row.match_interest ? ["Matches your interests"] : []),
        ...(row.match_language ? ["Matches your language"] : [])
      ]
    })) });
  }));

  router.get("/leaderboard", asyncHandler(async (_req, res) => {
    const [rooms, hosts] = await db.batch<Row>([
      db.prepare(`SELECT ${roomProjection} ${fromRooms} WHERE ${livePublic} ${ordered} LIMIT 10`),
      db.prepare(`SELECT ${personJson("u")} AS user_json, u.followers_count FROM users AS u
        WHERE u.role IN ('HOST', 'USER') AND u.is_blocked = 0
        ORDER BY u.followers_count DESC, u.wallet_balance DESC, u.source_id LIMIT 10`)
    ]);
    sendOk(res, { topRooms: rooms.results.map(room), topHosts: hosts.results.map(row => ({
      ...person(String(row.user_json)), followersCount: row.followers_count
    })) });
  }));

  router.get("/:id/followers", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = roomId(req.params.id);
    const [rooms, followers] = await db.batch<Row>([
      db.prepare(`SELECT (${roomAccess}) AS can_read FROM rooms AS r WHERE r.source_id = ?1`).bind(id, user.id),
      db.prepare(`SELECT ${personJson("u")} AS user_json,
        EXISTS (SELECT 1 FROM follows WHERE follower_id = ?2 AND following_id = u.source_id) AS is_following
        FROM room_follows AS f JOIN users AS u ON u.source_id = f.user_id
        WHERE f.room_id = ?1 ORDER BY f.created_at DESC, f.source_id LIMIT 100`).bind(id, user.id)
    ]);
    visible(rooms.results[0]);
    sendOk(res, { users: followers.results.map(row => ({ ...person(String(row.user_json)), isFollowing: Boolean(row.is_following) })) });
  }));

  router.post("/:id/follow", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const time = new Date().toISOString();
    const [mutation, matched] = await db.batch([
      db.prepare(`INSERT INTO room_follows (source_id, room_id, user_id, created_at, updated_at)
        SELECT ?, r.source_id, u.source_id, ?, ? FROM users AS u
        JOIN rooms AS r ON r.source_id = ? AND r.visibility = 'PUBLIC' AND r.status <> 'ENDED'
        WHERE ${d1LiveUserFilter} AND NOT EXISTS (SELECT 1 FROM room_follows WHERE room_id = r.source_id AND user_id = u.source_id)`)
        .bind(randomBytes(12).toString("hex"), time, time, id, ...bindD1LiveUser(claims, time)),
      db.prepare("SELECT 1 FROM rooms WHERE source_id = ? AND visibility = 'PUBLIC' AND status <> 'ENDED'").bind(id)
    ]);
    if (!mutation.meta.changes) {
      await authenticate(req);
      if (!matched.results.length) throw new HttpError(404, "Public room not found", ErrorCode.NOT_FOUND);
    }
    sendOk(res, { following: true, roomId: id });
  }));

  router.delete("/:id/follow", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const time = new Date().toISOString();
    const result = await db.prepare(`DELETE FROM room_follows WHERE room_id = ? AND user_id = ?
      AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter})`)
      .bind(id, claims.sub, ...bindD1LiveUser(claims, time)).run();
    if (!result.meta.changes) await authenticate(req);
    sendOk(res, { following: false, roomId: id });
  }));

  router.get("/:id", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = roomId(req.params.id);
    const [rooms, members, speakers, cohosts] = await db.batch<Row>([
      db.prepare(`SELECT ${roomProjection}, (${roomAccess}) AS can_read ${fromRooms} WHERE r.source_id = ?1`).bind(id, user.id),
      db.prepare(`SELECT p.*, ${personJson("u")} AS user_json,
        EXISTS (SELECT 1 FROM room_admins WHERE rooms_id = p.room_id AND value = p.user_id) AS is_room_admin
        FROM room_participants AS p JOIN users AS u ON u.source_id = p.user_id
        WHERE p.room_id = ? AND p.left_at IS NULL ORDER BY p.joined_at, p.source_id`).bind(id),
      db.prepare(`SELECT s.*, ${personJson("u")} AS user_json FROM speaker_requests AS s JOIN users AS u ON u.source_id = s.user_id
        WHERE s.room_id = ? AND s.status = 'PENDING' ORDER BY s.created_at, s.source_id`).bind(id),
      db.prepare(`SELECT ${personJson("u")} AS user_json FROM room_cohosts AS c JOIN users AS u ON u.source_id = c.value
        WHERE c.rooms_id = ? ORDER BY c.position`).bind(id)
    ]);
    const data = visible(rooms.results[0]);
    sendOk(res, {
      room: { ...room(data), coHostIds: cohosts.results.map(row => person(String(row.user_json))) },
      participants: participants(members.results, Number(data.max_speakers)),
      speakerRequests: speakers.results.map(row => ({
        _id: row.source_id, roomId: row.room_id, userId: person(String(row.user_json)),
        status: row.status, createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
      }))
    });
  }));

  const membership = `(SELECT MIN(joined_at) FROM room_participants WHERE room_id = r.source_id AND user_id = ?2 AND left_at IS NULL)`;
  router.get("/:id/messages", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = roomId(req.params.id);
    const [rooms, messages] = await db.batch<Row>([
      db.prepare(`SELECT (${roomAccess}) AS can_read FROM rooms AS r WHERE r.source_id = ?1`).bind(id, user.id),
      db.prepare(`SELECT m.*, ${personJson("u")} AS user_json FROM chat_messages AS m
        JOIN rooms AS r ON r.source_id = m.room_id JOIN users AS u ON u.source_id = m.sender_id
        WHERE r.source_id = ?1 AND (${roomAccess}) AND r.status = 'LIVE'
          AND m.created_at >= ${membership} ORDER BY m.created_at DESC, m.source_id DESC LIMIT ?3`)
        .bind(id, user.id, pageSize(req.query.limit, 80, 200))
    ]);
    visible(rooms.results[0]);
    sendOk(res, { messages: messages.results.reverse().map(row => ({
      _id: row.source_id, roomId: row.room_id, senderId: person(String(row.user_json)), message: row.message, type: row.type,
      mediaUrl: row.media_url ?? undefined, mediaType: row.media_type ?? undefined,
      createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
    })) });
  }));

  router.get("/:id/activity", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = roomId(req.params.id);
    const [rooms, activities] = await db.batch<Row>([
      db.prepare(`SELECT (${roomAccess}) AS can_read FROM rooms AS r WHERE r.source_id = ?1`).bind(id, user.id),
      db.prepare(`SELECT a.* FROM room_activities AS a JOIN rooms AS r ON r.source_id = a.room_id
        WHERE r.source_id = ?1 AND (${roomAccess}) AND r.status = 'LIVE'
          AND a.created_at >= ${membership} ORDER BY a.created_at DESC, a.source_id DESC LIMIT ?3`)
        .bind(id, user.id, pageSize(req.query.limit, 40, 100))
    ]);
    visible(rooms.results[0]);
    sendOk(res, { activity: activities.results.reverse().map(row => ({
      _id: row.source_id, roomId: row.room_id, userId: row.user_id ?? undefined,
      type: row.type, label: row.label, metadata: JSON.parse(String(row.metadata)),
      createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
    })) });
  }));

  return router;
}
