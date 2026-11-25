import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import {
  chatMessageSchema, createPollSchema, createRoomSchema, directMessageSchema, roomModes, roomModesInfo,
  votePollSchema, xpDailyCaps, xpEvents
} from "@yugm/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { moderateContent } from "../services/contentModeration.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { applyModeAction, modeActionSchema, type ModeAction } from "../services/roomModeGame.js";
import { pickRandom } from "../services/roomModePrompts.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { chatRestricted, recordD1ChatModeration } from "./d1ChatModeration.js";
import { clearProfileMarkers } from "./d1Cosmetics.js";
import { sendD1DirectMessage } from "./d1MessageSend.js";
import { d1UserId, person, personJson, visiblePerson } from "./d1People.js";
import { roomAccessFor } from "./d1RoomAccess.js";
import { pollOpen, pollProjection, presentPoll } from "./d1RoomPolls.js";
import { createRoomMode, readRoomMode, readRoomModeRoster, updateRoomMode } from "./d1RoomModes.js";
import { readD1RoomPkHistory } from "./d1RoomPkHistory.js";
import { assertD1ThemeEntitlement, setThemeSchema, usableTheme } from "./d1Themes.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

type Row = Record<string, string | number | null>;
type ActorRow = {
  xp: number; level: number; wallet_balance: number; last_daily_check_in_at: string | null;
  name: string; muted_until: string | null; vip_expires_at: string | null; person_json: string;
  vip_level: number; vip_tier: string | null; vip_frozen: number;
  room_restricted: number; shadow_banned: number; chat_restricted: number;
};
const privilegedRoles = new Set(["HOST", "SPEAKER", "MODERATOR"]);
const ordered = "ORDER BY r.participant_count DESC, r.created_at DESC, r.source_id";
const livePublic = "r.visibility = 'PUBLIC' AND r.status = 'LIVE'";
const roomCreateEvent = "ROOM_CREATE";
const roomJoinEvent = "ROOM_JOIN";
const roomCreateXp = xpEvents[roomCreateEvent];
const roomCreateCap = xpDailyCaps[roomCreateEvent]!;
const roomJoinXp = xpEvents[roomJoinEvent];
const roomJoinCap = xpDailyCaps[roomJoinEvent]!;
const dailyEventXp = "SELECT COALESCE(SUM(amount), 0) AS amount FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ?";
const restrictedStatus = (column: string) =>
  `EXISTS (SELECT 1 FROM user_safety_statuses WHERE user_id = u.source_id AND ${column} = 1)`;
const actorQuery = `SELECT u.xp, u.level, u.wallet_balance, u.last_daily_check_in_at, u.name, u.muted_until,
  u.vip_expires_at, u.vip_level, u.vip_tier, u.vip_frozen,
  ${personJson("u")} AS person_json, ${restrictedStatus("is_room_restricted")} AS room_restricted,
  ${restrictedStatus("is_shadow_banned")} AS shadow_banned,
  ${restrictedStatus("is_chat_restricted")} AS chat_restricted
  FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL`;
const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  maxSpeakers: z.number().int().min(2).max(20).optional(),
  allowAudienceMicRequests: z.boolean().optional(),
  micLocked: z.boolean().optional(),
  coverImage: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  theme: z.string().optional(),
  vipOnly: z.boolean().optional(),
  badge: z.string().optional(),
  ambience: z.string().optional()
});
const roomPatchColumns: Record<string, [string, (value: unknown) => string | number | null]> = {
  title: ["title", value => String(value)], description: ["description", value => String(value)],
  tags: ["tags", value => JSON.stringify(value)], category: ["category", value => String(value)],
  visibility: ["visibility", value => String(value)], maxSpeakers: ["max_speakers", value => Number(value)],
  allowAudienceMicRequests: ["allow_audience_mic_requests", value => Number(value)],
  micLocked: ["mic_locked", value => Number(value)], coverImage: ["cover_image", value => String(value)],
  scheduledFor: ["scheduled_for", value => String(value)], theme: ["theme", value => String(value)],
  vipOnly: ["vip_only", value => Number(value)], badge: ["badge", value => String(value)],
  ambience: ["ambience", value => String(value)]
};
const adminSchema = z.object({ userId: z.string(), isAdmin: z.boolean().optional() });
const micLockSchema = z.object({ locked: z.boolean() });
const seatLockSchema = z.object({ seatIndex: z.number().int().min(0), locked: z.boolean() });
const micStateSchema = z.object({ enabled: z.boolean() });
const setModeSchema = z.object({ mode: z.enum(roomModes) });
const takeSeatSchema = z.object({ seatIndex: z.number().int().min(0).optional() });

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
const roomAccess = roomAccessFor("?2");
const roomByViewer = `SELECT ${roomProjection}, (${roomAccess}) AS can_read,
  (r.host_id = ?2) AS is_host,
  EXISTS (SELECT 1 FROM room_admins WHERE rooms_id = r.source_id AND value = ?2) AS is_room_admin,
  (SELECT role FROM users WHERE source_id = ?2) AS viewer_role
  ${fromRooms} WHERE r.source_id = ?1`;

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

function presentRoomMessage(row: Row) {
  return {
    _id: row.source_id, roomId: row.room_id, senderId: person(String(row.user_json)), message: row.message, type: row.type,
    mediaUrl: row.media_url ?? undefined, mediaType: row.media_type ?? undefined,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

function requireRoomChatActor(actor: ActorRow | null) {
  if (!actor) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
  safety(actor, { muted: true });
  if (actor.chat_restricted) throw new HttpError(403, "Chat access restricted", ErrorCode.FORBIDDEN);
  return actor;
}

function visible(row?: Row | null) {
  if (!row) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  if (!row.can_read) throw new HttpError(403, "This private room is invite only", ErrorCode.FORBIDDEN);
  return row;
}

function pageSize(value: unknown, fallback: number, max: number) {
  return Math.trunc(Math.min(Math.max(Number(value) || fallback, 1), max));
}

const newId = () => randomBytes(12).toString("hex");
const pollControl = "(r.host_id = u.source_id OR u.role = 'ADMIN') AND r.status = 'LIVE'";
const activeMember = "EXISTS (SELECT 1 FROM room_participants AS m WHERE m.room_id = p.room_id AND m.user_id = u.source_id AND m.left_at IS NULL)";

function activePollError() {
  return new HttpError(404, "Active poll not found", ErrorCode.NOT_FOUND);
}

function pollId(value: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid poll ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
}

function safety(actor: ActorRow, checks: { muted?: boolean; room?: boolean; shadow?: boolean } = {}) {
  if (checks.muted && actor.muted_until && Date.parse(actor.muted_until) > Date.now()) {
    throw new HttpError(403, `Account muted until ${actor.muted_until}`, ErrorCode.FORBIDDEN);
  }
  if (checks.room && actor.room_restricted) throw new HttpError(403, "Room access restricted", ErrorCode.FORBIDDEN);
  if (checks.shadow && actor.shadow_banned) throw new HttpError(403, "Account restricted", ErrorCode.FORBIDDEN);
}

function actorMetadata(actor: ActorRow) {
  const profile = person(actor.person_json) as {
    name?: string; avatar?: string; avatarType?: string; avatarParts?: Record<string, unknown>;
    activeCosmetics?: Record<string, unknown>;
  };
  return {
    userName: profile.name ?? actor.name, avatar: profile.avatar ?? "",
    avatarType: profile.avatarType ?? null, avatarParts: profile.avatarParts ?? null,
    roomEntry: profile.activeCosmetics?.roomEntry ?? "",
    entranceEffect: profile.activeCosmetics?.entranceEffect ?? ""
  };
}

async function readActor(db: D1Database, claims: Parameters<typeof bindD1LiveUser>[0], time: string) {
  return db.prepare(actorQuery).bind(...bindD1LiveUser(claims, time)).first<ActorRow>();
}

function control(row: Row, hostOnly = false) {
  const host = Boolean(row.is_host) || row.viewer_role === "ADMIN";
  if (hostOnly && !host) throw new HttpError(403, "Host control required", ErrorCode.FORBIDDEN);
  if (!hostOnly && !host && !row.is_room_admin) {
    throw new HttpError(403, "Room host or room admin control required", ErrorCode.FORBIDDEN);
  }
  return host;
}

function readRoom(row?: Row | null) {
  const value = visible(row);
  return value;
}

async function loadRoom(db: D1Database, id: string, viewer: string) {
  return db.prepare(roomByViewer).bind(id, viewer).first<Row>();
}

function micLimit(row: Row) {
  return Math.min(20, Math.max(2, Number(row.max_speakers) || 8));
}

async function occupiedSeats(db: D1Database, id: string, limit: number, excludeUserId?: string) {
  const { results } = await db.prepare(`SELECT seat_index, joined_at FROM room_participants
    WHERE room_id = ? AND left_at IS NULL AND role IN ('HOST', 'SPEAKER', 'MODERATOR')
    ${excludeUserId ? "AND user_id <> ?" : ""} ORDER BY joined_at, source_id`)
    .bind(...(excludeUserId ? [id, excludeUserId] : [id]))
    .all<{ seat_index: number | null; joined_at: string }>();
  const used = new Set<number>();
  for (const participant of results) {
    const seat = participant.seat_index;
    if (Number.isInteger(seat) && seat !== null && seat >= 0 && seat < limit) used.add(seat);
  }
  for (const participant of results) {
    if (Number.isInteger(participant.seat_index)) continue;
    for (let seat = 0; seat < limit; seat++) {
      if (!used.has(seat)) { used.add(seat); break; }
    }
  }
  return used;
}

function openSeat(row: Row, used: Set<number>, requested?: number) {
  const limit = micLimit(row);
  const locked = new Set<number>(JSON.parse(String(row.locked_seat_indices_json ?? "[]")) as number[]);
  if (requested !== undefined) {
    if (requested < 0 || requested >= limit) throw new HttpError(400, "Invalid mic seat", ErrorCode.VALIDATION);
    if (locked.has(requested)) throw new HttpError(423, "This mic seat is locked", ErrorCode.FORBIDDEN);
    if (used.has(requested)) throw new HttpError(409, "This mic seat is already occupied", ErrorCode.CONFLICT);
    return requested;
  }
  for (let seat = 0; seat < limit; seat++) {
    if (!used.has(seat) && !locked.has(seat)) return seat;
  }
  throw new HttpError(409, "No open mic seats are available", ErrorCode.CONFLICT);
}

function activityStatement(db: D1Database, roomId: string, userId: string | null, type: string,
  label: string, metadata: Record<string, unknown>, time: string
) {
  return db.prepare(`INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at, updated_at)
    SELECT ?, r.source_id, ?, ?, ?, ?, ?, ? FROM rooms AS r WHERE r.source_id = ?`)
    .bind(newId(), userId, type, label, JSON.stringify(metadata), time, time, roomId);
}

function capStatements(write: D1GuardedStatement, guard: string, userId: string, event: string,
  day: string, xpAwarded: number, time: string
) {
  return [
    write(`UPDATE xp_daily_caps SET amount = amount + ?, updated_at = ? WHERE source_id = (
      SELECT source_id FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ? ORDER BY source_id LIMIT 1
    ) AND ${guard}`, xpAwarded, time, userId, event, day),
    write(`INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
        SELECT 1 FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ?
      ) AND ${guard}`, newId(), userId, event, day, xpAwarded, time, time, userId, event, day)
  ];
}

export async function endD1Room(db: D1Database, id: string, time: string) {
  const room = await db.prepare("SELECT status, type, livekit_room_name FROM rooms WHERE source_id = ?").bind(id)
    .first<{ status: string; type: string; livekit_room_name: string }>();
  if (!room || room.status !== "LIVE" || (room.type === "VOICE" && room.livekit_room_name === "official-yugm-trending")) {
    return false;
  }
  const [ended] = await db.batch([
    db.prepare(`UPDATE rooms SET status = 'ENDED', ended_at = ?, participant_count = 0, updated_at = ?
      WHERE source_id = ? AND status = 'LIVE'`).bind(time, time, id),
    db.prepare(`DELETE FROM chat_messages WHERE room_id = ? AND EXISTS (
      SELECT 1 FROM rooms WHERE source_id = ? AND status = 'ENDED' AND ended_at = ?)`).bind(id, id, time),
    db.prepare(`UPDATE room_participants SET left_at = ?, mic_enabled = 0, camera_enabled = 0, seat_index = NULL
      WHERE room_id = ? AND left_at IS NULL AND EXISTS (
        SELECT 1 FROM rooms WHERE source_id = ? AND status = 'ENDED' AND ended_at = ?)`).bind(time, id, id, time),
    db.prepare(`UPDATE speaker_requests SET status = 'REJECTED', updated_at = ?
      WHERE room_id = ? AND status = 'PENDING' AND EXISTS (
        SELECT 1 FROM rooms WHERE source_id = ? AND status = 'ENDED' AND ended_at = ?)`).bind(time, id, id, time)
  ]);
  return Boolean(ended.meta.changes);
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

export function createD1RoomsRouter(db: D1Database, allowChat?: D1UserRateLimit) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, access);
  const authenticateChat = asyncHandler(async (req, res, next) => {
    const { claims } = await authenticate(req);
    requireRoomChatActor(await readActor(db, claims, new Date().toISOString()));
    res.locals.claims = claims;
    next();
  });
  const requirePollSession = asyncHandler(async (req, res, next) => {
    res.locals.pollSession = await authenticate(req);
    next();
  });
  const readPoll = (id: string, room: string) =>
    db.prepare(`SELECT ${pollProjection} FROM polls AS p WHERE p.source_id = ? AND p.room_id = ?`).bind(id, room);
  const requirePollHost = async (id: string, viewer: string) => {
    const row = await loadRoom(db, id, viewer);
    if (!row) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    control(row, true);
    if (row.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  };
  const lists = async (filter: string, ...values: Array<string | number | null>) =>
    (await db.prepare(`SELECT ${roomProjection} ${fromRooms} ${filter}`).bind(...values).all<Row>()).results;

  const authenticateMode = asyncHandler(async (req, res, next) => {
    res.locals.modeSession = await authenticate(req);
    next();
  });

  router.get("/modes", (_req, res) => { sendOk(res, { modes: roomModesInfo }); });

  router.get("/:roomId/pk-history", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = roomId(req.params.roomId);
    const battles = await readD1RoomPkHistory(db, id, user.id, roomAccessFor);
    sendOk(res, { battles });
  }));

  router.post("/mode/random", authenticateMode, asyncHandler(async (_req, res) => {
    const mode = pickRandom([...roomModes]);
    const matching = await lists(`WHERE ${livePublic} AND r.mode = ? ${ordered} LIMIT 20`, mode);
    const selected = matching.length > 0 ? matching : await lists(`WHERE ${livePublic} ${ordered} LIMIT 20`);
    const rooms = selected.map(room);
    sendOk(res, { mode: matching.length > 0 ? mode : pickRandom([...roomModes]), room: rooms[0] ?? null, rooms });
  }));

  router.post("/:id/mode", authenticateMode, validateBody(setModeSchema), asyncHandler(async (req, res) => {
    const { claims }: Awaited<ReturnType<typeof authenticate>> = res.locals.modeSession;
    const id = roomId(req.params.id);
    const current = await loadRoom(db, id, claims.sub);
    if (!current) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    control(current, true);
    if (current.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
    if (await readRoomMode(db, id)) throw new HttpError(409, "Room already has an active mode", ErrorCode.CONFLICT);
    const { mode } = req.body as z.infer<typeof setModeSchema>;
    const info = roomModesInfo.find(item => item.key === mode)!;
    const roster = await readRoomModeRoster(db, id);
    if (roster.length < info.minParticipants) {
      throw new HttpError(400, `Need at least ${info.minParticipants} participants for ${info.name}`, ErrorCode.VALIDATION);
    }
    if (!await createRoomMode(db, claims, id, mode, roster)) {
      await authenticate(req);
      throw new HttpError(409, "Room or mode changed. Please try again.", ErrorCode.CONFLICT);
    }
    const [updated, modeState] = await Promise.all([loadRoom(db, id, claims.sub), readRoomMode(db, id)]);
    if (!updated || !modeState) throw new HttpError(404, "Room mode not found", ErrorCode.NOT_FOUND);
    sendOk(res, { room: room(updated), modeState: modeState.state });
  }));

  router.get("/:id/mode-state", authenticateMode, asyncHandler(async (req, res) => {
    const { user }: Awaited<ReturnType<typeof authenticate>> = res.locals.modeSession;
    const id = roomId(req.params.id);
    const current = visible(await loadRoom(db, id, user.id));
    const found = await readRoomMode(db, id);
    sendOk(res, { mode: found ? current.mode ?? null : null, modeState: found?.state ?? null });
  }));

  router.post("/:id/mode/action", authenticateMode, validateBody(modeActionSchema), asyncHandler(async (req, res) => {
    const { claims }: Awaited<ReturnType<typeof authenticate>> = res.locals.modeSession;
    const id = roomId(req.params.id);
    const input = req.body as ModeAction;
    const hostOnly = input.action === "start" || input.action === "next_round" || input.action === "end";
    for (let attempt = 0; attempt < 5; attempt++) {
      const current = await loadRoom(db, id, claims.sub);
      if (!current) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
      if (hostOnly) control(current, true);
      else visible(current);
      if (current.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
      const found = await readRoomMode(db, id);
      if (!found) throw new HttpError(404, "No active mode for this room", ErrorCode.NOT_FOUND);
      if (!hostOnly && (!found.state.participants.includes(claims.sub) || !await activeParticipant(id, claims.sub))) {
        throw new HttpError(403, "You are not a participant in this room mode", ErrorCode.FORBIDDEN);
      }
      const now = new Date();
      applyModeAction(found.state, input, claims.sub, now);
      if (await updateRoomMode(db, claims, found.state, found.revision, hostOnly, now.toISOString())) {
        sendOk(res, { modeState: found.state });
        return;
      }
      await authenticate(req);
    }
    throw new HttpError(409, "Room mode changed. Please try again.", ErrorCode.CONFLICT);
  }));

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
    sendOk(res, { messages: messages.results.reverse().map(presentRoomMessage) });
  }));

  router.post("/:id/messages", authenticateChat, asyncHandler(async (_req, res, next) => {
    await enforceD1UserRateLimit(allowChat, (res.locals.claims as AccessClaims).sub, res, 10);
    next();
  }), validateBody(chatMessageSchema), asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    const input = req.body as z.infer<typeof chatMessageSchema>;
    const check = moderateContent(input.message);
    if (!check.isClean) {
      await recordD1ChatModeration(db, claims, new Date().toISOString(), check);
      if (check.action === "BLOCK") throw new HttpError(400, "Content was blocked by auto-moderation", ErrorCode.CONTENT_BLOCKED);
    }
    const id = roomId(req.params.id);
    const media = input.mediaUrl ?? null;
    const message = sanitizeText(input.message || (media ? "Shared a photo" : ""));
    if (!message && !media) throw new HttpError(400, "Message cannot be empty", ErrorCode.VALIDATION);
    const messageId = newId();
    const saved = "EXISTS (SELECT 1 FROM chat_messages WHERE source_id = ?)";
    const write: D1GuardedStatement = (sql, ...args) => db.prepare(sql).bind(...args, messageId);
    const event = "CHAT_MESSAGE";
    const award = xpEvents[event];
    const cap = xpDailyCaps[event]!;
    for (let attempt = 0; attempt < 5; attempt++) {
      const now = new Date();
      const time = now.toISOString();
      const day = startOfUtcDay(now).toISOString();
      const actor = requireRoomChatActor(await readActor(db, claims, time));
      const current = await db.prepare("SELECT status FROM rooms WHERE source_id = ?").bind(id).first<string>("status");
      if (!current) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
      if (current !== "LIVE") throw new HttpError(400, "Room is closed", ErrorCode.VALIDATION);
      if (!await activeParticipant(id, claims.sub)) {
        throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
      }
      if (media && getVipStatus({
        vipTier: actor.vip_tier, vipLevel: actor.vip_level, vipExpiresAt: actor.vip_expires_at, vipFrozen: Boolean(actor.vip_frozen)
      }, now).vipLevel < 4) {
        throw new HttpError(403, "Room image sharing unlocks at VIP 4", ErrorCode.FORBIDDEN);
      }
      const points = await xpForEvent(claims.sub, event, day, award, cap);
      const earned = points.earnedToday + points.xpAwarded;
      const progress = prepareD1XpGrant(write, saved, now, {
        userId: claims.sub, event, actionKey: `message:${messageId}`, requestedXp: award, xpAwarded: points.xpAwarded,
        previousXp: actor.xp, previousLevel: actor.level, balanceBefore: actor.wallet_balance,
        lastDailyCheckInAt: actor.last_daily_check_in_at ?? undefined,
        cap: { capped: earned >= cap, cap, earnedToday: earned, remainingToday: Math.max(0, cap - earned) }
      });
      const claim = db.prepare(`INSERT INTO chat_messages (source_id, room_id, sender_id, message, type, media_url, media_type, created_at, updated_at)
        SELECT ?, r.source_id, u.source_id, ?, 'TEXT', ?, ?, ?, ? FROM rooms AS r CROSS JOIN users AS u
        WHERE r.source_id = ? AND r.status = 'LIVE' AND ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL
          AND (u.muted_until IS NULL OR u.muted_until <= ?) AND NOT ${chatRestricted}
          AND EXISTS (SELECT 1 FROM room_participants WHERE room_id = r.source_id AND user_id = u.source_id AND left_at IS NULL)
          AND (? IS NULL OR (u.vip_tier IS ? AND u.vip_level = ? AND u.vip_frozen = 0 AND u.vip_expires_at IS ?
            AND u.vip_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
          AND u.xp = ? AND u.level = ? AND u.wallet_balance = ? AND u.last_daily_check_in_at IS ?
          AND (${dailyEventXp}) = ?`).bind(messageId, message, media, media ? "IMAGE" : null, time, time, id,
          ...bindD1LiveUser(claims, time), time, media, actor.vip_tier, actor.vip_level, actor.vip_expires_at,
          actor.xp, actor.level, actor.wallet_balance, actor.last_daily_check_in_at,
          claims.sub, event, day, points.earnedToday);
      const statements = [claim, ...progress.statements];
      if (points.xpAwarded > 0) {
        const entries = Object.entries(progress.columns);
        statements.push(...capStatements(write, saved, claims.sub, event, day, points.xpAwarded, time),
          write(`UPDATE users SET ${entries.map(([column]) => column + " = ?").join(", ")}, updated_at = ?
            WHERE source_id = ? AND ${saved}`, ...entries.map(([, value]) => value), time, claims.sub),
          clearProfileMarkers(db, claims.sub, ["xp", "level", "levelTitle", "walletBalance"], saved, messageId));
      }
      const [committed, ...results] = await db.batch<Row>([
        ...statements, db.prepare(`SELECT m.*, ${personJson("u")} AS user_json FROM chat_messages AS m
          JOIN users AS u ON u.source_id = m.sender_id WHERE m.source_id = ?`).bind(messageId)
      ]);
      if (committed.meta.changes) {
        sendOk(res, { message: presentRoomMessage(results.at(-1)!.results[0]) }, 201);
        return;
      }
    }
    throw new HttpError(409, "Room changed. Please try again.", ErrorCode.CONFLICT);
  }));

  router.post("/:id/messages/direct", authenticateChat, validateBody(directMessageSchema), asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    const id = roomId(req.params.id);
    const host = await db.prepare("SELECT host_id FROM rooms WHERE source_id = ?").bind(id).first<string>("host_id");
    if (!host) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    if (!await activeParticipant(id, claims.sub)) {
      throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
    }
    const receiver = host === claims.sub ? req.body.receiverId : host;
    if (!receiver || !isValidObjectId(receiver)) throw new HttpError(400, "Invalid receiver", ErrorCode.VALIDATION);
    const result = await sendD1DirectMessage<Row>(db, claims, receiver.toLowerCase(), req.body,
      key => db.prepare("SELECT * FROM direct_messages WHERE source_id = ?").bind(key), id);
    const row = result.message;
    sendOk(res, {
      message: {
        _id: row.source_id, senderId: row.sender_id, receiverId: row.receiver_id, roomId: row.room_id,
        message: row.message, mediaUrl: row.media_url, mediaType: row.media_type, duration: row.duration,
        forwarded: Boolean(row.forwarded), isEdited: Boolean(row.is_edited), read: Boolean(row.read), reactions: [],
        createdAt: row.created_at, updatedAt: row.updated_at
      },
      relationship: result.relationship, xpGrant: result.xpGrant
    }, 201);
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

  router.get("/:id/polls", requirePollSession, asyncHandler(async (req, res) => {
    const { user }: Awaited<ReturnType<typeof authenticate>> = res.locals.pollSession;
    const id = roomId(req.params.id);
    const [rooms, polls] = await db.batch<Row>([
      db.prepare(`SELECT (${roomAccess}) AS can_read FROM rooms AS r WHERE r.source_id = ?1`).bind(id, user.id),
      db.prepare(`SELECT ${pollProjection} FROM polls AS p JOIN rooms AS r ON r.source_id = p.room_id
        WHERE r.source_id = ?1 AND (${roomAccess}) AND EXISTS
          (SELECT 1 FROM room_participants WHERE room_id = r.source_id AND user_id = ?2 AND left_at IS NULL)
        ORDER BY p.created_at DESC, p.source_id DESC LIMIT 10`).bind(id, user.id)
    ]);
    visible(rooms.results[0]);
    sendOk(res, { polls: polls.results.map(presentPoll) });
  }));

  router.post("/:id/polls", requirePollSession, validateBody(createPollSchema), asyncHandler(async (req, res) => {
    const { claims }: Awaited<ReturnType<typeof authenticate>> = res.locals.pollSession;
    const id = roomId(req.params.id);
    await requirePollHost(id, claims.sub);
    const question = sanitizeText(req.body.question);
    const options = (req.body.options as string[]).map(text => ({ id: newId(), text: sanitizeText(text) }));
    if (!question || options.some(option => !option.text)) {
      throw new HttpError(400, "Poll question and options cannot be empty", ErrorCode.VALIDATION);
    }
    const key = newId();
    const time = new Date().toISOString();
    const [created, , , poll] = await db.batch<Row>([
      db.prepare(`INSERT INTO polls (source_id, room_id, created_by, question, is_active, created_at, updated_at)
        SELECT ?, r.source_id, u.source_id, ?, 1, ?, ? FROM rooms AS r CROSS JOIN users AS u
        WHERE r.source_id = ? AND ${pollControl} AND ${d1LiveUserFilter}`)
        .bind(key, question, time, time, id, ...bindD1LiveUser(claims, time)),
      db.prepare(`INSERT INTO poll_options (source_id, text, votes, polls_id, position)
        SELECT json_extract(o.value, '$.id'), json_extract(o.value, '$.text'), 0, p.source_id, o.key
        FROM polls AS p CROSS JOIN json_each(?) AS o WHERE p.source_id = ?`).bind(JSON.stringify(options), key),
      db.prepare(`INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at, updated_at)
        SELECT ?, p.room_id, u.source_id, 'POLL', u.name || ' started a poll', json_object('pollId', p.source_id), ?, ?
        FROM polls AS p JOIN users AS u ON u.source_id = p.created_by WHERE p.source_id = ?`)
        .bind(newId(), time, time, key),
      readPoll(key, id)
    ]);
    if (!created.meta.changes) {
      await authenticate(req);
      await requirePollHost(id, claims.sub);
      throw new HttpError(409, "Room changed. Please try again.", ErrorCode.CONFLICT);
    }
    sendOk(res, { poll: presentPoll(poll.results[0]) }, 201);
  }));

  router.post("/:id/polls/:pollId/vote", requirePollSession, validateBody(votePollSchema), asyncHandler(async (req, res) => {
    const { claims }: Awaited<ReturnType<typeof authenticate>> = res.locals.pollSession;
    const id = roomId(req.params.id);
    const key = pollId(req.params.pollId);
    const index: number = req.body.optionIndex;
    const vote = newId();
    const time = new Date().toISOString();
    const [claimed, , , poll] = await db.batch<Row>([
      db.prepare(`INSERT INTO poll_votes (source_id, value, polls_id, position)
        SELECT ?, u.source_id, p.source_id,
          COALESCE((SELECT MAX(position) + 1 FROM poll_votes WHERE polls_id = p.source_id), 0)
        FROM polls AS p JOIN poll_options AS o ON o.polls_id = p.source_id AND o.position = ?
        CROSS JOIN users AS u
        WHERE p.source_id = ? AND p.room_id = ? AND ${pollOpen} AND ${d1LiveUserFilter} AND ${activeMember}
          AND NOT EXISTS (SELECT 1 FROM poll_votes WHERE polls_id = p.source_id AND value = u.source_id)`)
        .bind(vote, index, key, id, ...bindD1LiveUser(claims, time)),
      db.prepare(`UPDATE poll_options SET votes = votes + 1 WHERE polls_id = ? AND position = ?
        AND EXISTS (SELECT 1 FROM poll_votes WHERE source_id = ?)`).bind(key, index, vote),
      db.prepare(`UPDATE polls SET updated_at = ? WHERE source_id = ?
        AND EXISTS (SELECT 1 FROM poll_votes WHERE source_id = ?)`).bind(time, key, vote),
      readPoll(key, id)
    ]);
    if (!claimed.meta.changes) {
      await authenticate(req);
      if (!await activeParticipant(id, claims.sub)) {
        throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
      }
      const row = poll.results[0];
      if (!row?.open) throw activePollError();
      if (!await db.prepare("SELECT 1 FROM poll_options WHERE polls_id = ? AND position = ?").bind(key, index).first()) {
        throw new HttpError(400, "Invalid option", ErrorCode.VALIDATION);
      }
      throw new HttpError(409, "You already voted", ErrorCode.CONFLICT);
    }
    sendOk(res, { poll: presentPoll(poll.results[0]) });
  }));

  router.post("/:id/polls/:pollId/close", requirePollSession, asyncHandler(async (req, res) => {
    const { claims }: Awaited<ReturnType<typeof authenticate>> = res.locals.pollSession;
    const id = roomId(req.params.id);
    await requirePollHost(id, claims.sub);
    const key = pollId(req.params.pollId);
    const time = new Date().toISOString();
    const [closed, poll] = await db.batch<Row>([
      db.prepare(`UPDATE polls AS p SET is_active = 0, updated_at = ?
        WHERE p.source_id = ? AND p.room_id = ? AND ${pollOpen} AND EXISTS (
          SELECT 1 FROM rooms AS r CROSS JOIN users AS u WHERE r.source_id = p.room_id
          AND ${pollControl} AND ${d1LiveUserFilter})`)
        .bind(time, key, id, ...bindD1LiveUser(claims, time)),
      readPoll(key, id)
    ]);
    if (!closed.meta.changes) {
      await authenticate(req);
      await requirePollHost(id, claims.sub);
      throw activePollError();
    }
    sendOk(res, { poll: presentPoll(poll.results[0]) });
  }));

  router.get("/:id/missions", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = visible(await db.prepare(`SELECT (${roomAccess}) AS can_read,
        (SELECT COUNT(*) FROM (SELECT 1 FROM room_activities WHERE room_id = r.source_id AND type = 'REACTION' LIMIT 10)) AS reactions,
        (SELECT COUNT(*) FROM (SELECT 1 FROM room_activities WHERE room_id = r.source_id AND type = 'GIFT' LIMIT 3)) AS gifts,
        (SELECT COUNT(*) FROM (SELECT 1 FROM room_participants WHERE room_id = r.source_id AND left_at IS NULL LIMIT 25)) AS participants
      FROM rooms AS r WHERE r.source_id = ?1`).bind(id, user.id).first<Row>());
    const missions = [
      { id: "react-10", title: "Spark 10 reactions", progress: Number(row.reactions), target: 10, reward: 25 },
      { id: "gift-3", title: "Send 3 gifts", progress: Number(row.gifts), target: 3, reward: 50 },
      { id: "crowd-25", title: "Bring 25 people together", progress: Number(row.participants), target: 25, reward: 100 }
    ].map(mission => ({ ...mission, complete: mission.progress >= mission.target }));
    sendOk(res, { missions });
  }));

  const ownedCosmetics = async (userId: string, fields: { theme?: string; badge?: string; ambience?: string }) => {
    const ids = [fields.theme, fields.badge, fields.ambience].filter(Boolean) as string[];
    if (!ids.length) return;
    const { results } = await db.prepare(`SELECT value FROM user_owned_cosmetics
      WHERE users_id = ? AND value IN (${ids.map(() => "?").join(", ")})`).bind(userId, ...ids).all<{ value: string }>();
    const owned = new Set(results.map(row => row.value));
    const missing = ids.filter(value => !owned.has(value));
    if (missing.length) {
      throw new HttpError(403, `You don't own these cosmetics: ${missing.join(", ")}`, ErrorCode.FORBIDDEN);
    }
  };

  const xpForEvent = async (userId: string, event: string, day: string, award: number, cap: number) => {
    const row = await db.prepare(dailyEventXp).bind(userId, event, day).first<{ amount: number }>();
    const earnedToday = row?.amount ?? 0;
    return { earnedToday, xpAwarded: Math.min(award, Math.max(0, cap - earnedToday)) };
  };

  const activeParticipant = (id: string, userId: string) => db.prepare(`SELECT source_id, role FROM room_participants
    WHERE room_id = ? AND user_id = ? AND left_at IS NULL ORDER BY joined_at, source_id LIMIT 1`)
    .bind(id, userId).first<{ source_id: string; role: string }>();

  const actorStateGuard = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}
    AND u.deletion_requested_at IS NULL AND u.xp = ? AND u.level = ? AND u.wallet_balance = ? AND u.last_daily_check_in_at IS ?)`;

  router.post("/", validateBody(createRoomSchema), asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const body = req.body as z.infer<typeof createRoomSchema>;
    const now = new Date();
    const time = now.toISOString();
    const day = startOfUtcDay(now).toISOString();
    const scheduledFor = body.scheduledFor ? new Date(body.scheduledFor) : undefined;
    const isScheduled = Boolean(scheduledFor && scheduledFor.getTime() > Date.now() + 60_000);
    let created: { roomId: string; xpGrant: ReturnType<typeof prepareD1XpGrant>["xpGrant"] } | undefined;
    for (let attempt = 0; attempt < 3 && !created; attempt++) {
      const actor = await readActor(db, claims, time);
      if (!actor) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
      safety(actor, { muted: true, room: true, shadow: true });
      await ownedCosmetics(claims.sub, body);
      const cap = await xpForEvent(claims.sub, roomCreateEvent, day, roomCreateXp, roomCreateCap);
      const id = newId();
      const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, id);
      const progress = prepareD1XpGrant(write, "EXISTS (SELECT 1 FROM rooms WHERE source_id = ?)", now, {
        userId: claims.sub, event: roomCreateEvent, actionKey: `room-create:${id}`, requestedXp: roomCreateXp,
        xpAwarded: cap.xpAwarded, previousXp: actor.xp, previousLevel: actor.level,
        lastDailyCheckInAt: actor.last_daily_check_in_at ?? undefined, balanceBefore: actor.wallet_balance,
        cap: {
          capped: cap.earnedToday + cap.xpAwarded >= roomCreateCap, cap: roomCreateCap,
          earnedToday: cap.earnedToday + cap.xpAwarded,
          remainingToday: Math.max(0, roomCreateCap - cap.earnedToday - cap.xpAwarded)
        }
      });
      const statements = [
        db.prepare(`INSERT INTO rooms (source_id, title, description, type, host_id, cover_image, category, tags, language,
            status, visibility, max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests,
            mic_locked, theme, vip_only, badge, ambience, scheduled_for, started_at, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?
          WHERE ${actorStateGuard}`)
          .bind(id, body.title, body.description ?? null, body.type, claims.sub, body.coverImage ?? null, body.category,
            JSON.stringify(body.tags), body.language, isScheduled ? "SCHEDULED" : "LIVE", body.visibility, body.maxSpeakers,
            isScheduled ? 0 : 1, `yugm-${Date.now()}-${randomBytes(3).toString("hex")}`, Number(body.allowAudienceMicRequests),
            body.theme ?? null, Number(body.vipOnly), body.badge ?? null, body.ambience ?? null,
            scheduledFor ? scheduledFor.toISOString() : null, isScheduled ? null : time, time, time,
            ...bindD1LiveUser(claims, time), actor.xp, actor.level, actor.wallet_balance, actor.last_daily_check_in_at),
        db.prepare(`INSERT INTO room_speakers (source_id, value, rooms_id, position)
          SELECT ?, ?, ?, 0 WHERE EXISTS (SELECT 1 FROM rooms WHERE source_id = ?)`)
          .bind(`${id}:speakerIds:0`, claims.sub, id, id),
        ...(isScheduled ? [] : [
          db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled, moderator_muted,
              seat_index, camera_enabled, joined_at)
            SELECT ?, ?, ?, 'HOST', 1, 0, 0, 1, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE source_id = ?)`)
            .bind(newId(), id, claims.sub, time, id),
          activityStatement(db, id, claims.sub, "MISSION", `${actor.name} started the room`, {}, time)
        ]),
        ...(body.visibility === "PUBLIC" ? [
          db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
            SELECT lower(hex(randomblob(12))), recipient.source_id, 'ROOM_LIVE', ? || ' ' || ?, ?,
              json_object('roomId', ?, 'actorId', ?, 'scheduled', json(?)), 0, ?, ?
            FROM (
              SELECT follower_id AS source_id FROM follows WHERE following_id = ?
              UNION SELECT friend_id FROM friendships WHERE status = 'ACCEPTED' AND user_id = ?
              UNION SELECT user_id FROM friendships WHERE status = 'ACCEPTED' AND friend_id = ?
            ) AS recipient
            WHERE recipient.source_id <> ? AND EXISTS (SELECT 1 FROM rooms WHERE source_id = ?)
              AND NOT EXISTS (SELECT 1 FROM blocks WHERE (blocker_id = recipient.source_id AND blocked_user_id = ?)
                OR (blocker_id = ? AND blocked_user_id = recipient.source_id))
            LIMIT 500`)
            .bind(actor.name, isScheduled ? "scheduled a room" : "started a room", body.title, id, claims.sub,
              isScheduled ? "true" : "false", time, time, claims.sub, claims.sub, claims.sub, claims.sub, id,
              claims.sub, claims.sub)
        ] : [])
      ];
      if (cap.xpAwarded > 0) {
        statements.push(...capStatements(write, "EXISTS (SELECT 1 FROM rooms WHERE source_id = ?)",
          claims.sub, roomCreateEvent, day, cap.xpAwarded, time));
      }
      statements.push(...progress.statements);
      const userFields = { ...progress.columns, updated_at: time };
      if (Object.keys(progress.columns).length) {
        statements.push(write(`UPDATE users SET ${Object.keys(userFields).map(key => `${key} = ?`).join(", ")}
          WHERE source_id = ? AND EXISTS (SELECT 1 FROM rooms WHERE source_id = ?)`,
        ...Object.values(userFields), claims.sub));
      }
      const [room] = await db.batch(statements);
      if (room.meta.changes) created = { roomId: id, xpGrant: progress.xpGrant };
    }
    if (!created) throw new HttpError(409, "Room creation changed. Please try again.", ErrorCode.CONFLICT);
    const row = await loadRoom(db, created.roomId, claims.sub);
    sendOk(res, { room: room(readRoom(row)), xpGrant: created.xpGrant }, 201);
  }));

  router.post("/:id/join", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const now = new Date();
    const time = now.toISOString();
    const day = startOfUtcDay(now).toISOString();
    let response: { joined: boolean; role: string; xpGrant?: unknown } | undefined;
    for (let attempt = 0; attempt < 3 && !response; attempt++) {
      const actor = await readActor(db, claims, time);
      if (!actor) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
      safety(actor, { room: true, shadow: true });
      const row = readRoom(await loadRoom(db, id, claims.sub));
      if (row.status === "SCHEDULED") throw new HttpError(400, "This room is scheduled for later", ErrorCode.VALIDATION);
      if (row.status !== "LIVE") throw new HttpError(400, "This room has ended", ErrorCode.VALIDATION);
      const isHost = Boolean(row.is_host);
      const isVip = Boolean(actor.vip_expires_at && Date.parse(actor.vip_expires_at) > Date.now());
      if (row.vip_only && !isHost && !isVip) {
        throw new HttpError(403, "This room is for VIP members only", ErrorCode.FORBIDDEN);
      }
      const blocked = await db.prepare("SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_user_id = ?")
        .bind(row.host_id, claims.sub).first();
      if (blocked) throw new HttpError(403, "You cannot join this room", ErrorCode.FORBIDDEN);
      const speaker = (JSON.parse(String(row.speaker_ids_json)) as string[]).includes(claims.sub);
      const moderator = (JSON.parse(String(row.moderator_ids_json)) as string[]).includes(claims.sub);
      const cohost = (JSON.parse(String(row.co_host_ids_json)) as string[]).includes(claims.sub);
      const role = isHost ? "HOST" : moderator || cohost ? "MODERATOR" : speaker ? "SPEAKER" : "AUDIENCE";
      const existing = await activeParticipant(id, claims.sub);
      if (existing) {
        const updates = [];
        if (role !== existing.role && role !== "AUDIENCE") {
          updates.push(db.prepare("UPDATE room_participants SET role = ? WHERE source_id = ? AND left_at IS NULL")
            .bind(role, existing.source_id));
        }
        if (row.visibility === "PRIVATE") {
          updates.push(db.prepare(`UPDATE room_invites SET status = 'ACCEPTED', updated_at = ?
            WHERE room_id = ? AND invitee_id = ? AND status = 'PENDING'`).bind(time, id, claims.sub));
        }
        if (updates.length) await db.batch(updates);
        response = { joined: true, role };
        break;
      }
      const cap = await xpForEvent(claims.sub, roomJoinEvent, day, roomJoinXp, roomJoinCap);
      const participantId = newId();
      const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, participantId);
      const progress = prepareD1XpGrant(write, "EXISTS (SELECT 1 FROM room_participants WHERE source_id = ?)", now, {
        userId: claims.sub, event: roomJoinEvent, actionKey: `room-join:${participantId}`, requestedXp: roomJoinXp,
        xpAwarded: cap.xpAwarded, previousXp: actor.xp, previousLevel: actor.level,
        lastDailyCheckInAt: actor.last_daily_check_in_at ?? undefined, balanceBefore: actor.wallet_balance,
        cap: {
          capped: cap.earnedToday + cap.xpAwarded >= roomJoinCap, cap: roomJoinCap,
          earnedToday: cap.earnedToday + cap.xpAwarded,
          remainingToday: Math.max(0, roomJoinCap - cap.earnedToday - cap.xpAwarded)
        }
      });
      const metadata = JSON.stringify(actorMetadata(actor));
      const statements = [
        db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled, moderator_muted,
            seat_index, camera_enabled, joined_at)
          SELECT ?, r.source_id, ?, ?, 1, 0, NULL, 1, ? FROM rooms AS r
          WHERE r.source_id = ? AND r.status = 'LIVE' AND (${roomAccessFor("?2")})
            AND NOT EXISTS (SELECT 1 FROM room_participants WHERE room_id = r.source_id AND user_id = ?2 AND left_at IS NULL)
            AND ${actorStateGuard}`)
          .bind(participantId, claims.sub, role, time, id,
            ...bindD1LiveUser(claims, time), actor.xp, actor.level, actor.wallet_balance, actor.last_daily_check_in_at),
        db.prepare(`UPDATE rooms SET participant_count = participant_count + 1, updated_at = ?
          WHERE source_id = ? AND EXISTS (SELECT 1 FROM room_participants WHERE source_id = ?)`)
          .bind(time, id, participantId),
        db.prepare(`UPDATE room_invites SET status = 'ACCEPTED', updated_at = ?
          WHERE room_id = ? AND invitee_id = ? AND status = 'PENDING'
            AND EXISTS (SELECT 1 FROM room_participants WHERE source_id = ?)`)
          .bind(time, id, claims.sub, participantId),
        db.prepare(`INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at, updated_at)
          SELECT ?, r.source_id, ?, 'JOIN', ?, ?, ?, ? FROM rooms AS r WHERE r.source_id = ?
            AND EXISTS (SELECT 1 FROM room_participants WHERE source_id = ?)`)
          .bind(newId(), claims.sub, `${actor.name} joined`, metadata, time, time, id, participantId)
      ];
      if (cap.xpAwarded > 0) {
        statements.push(...capStatements(write, "EXISTS (SELECT 1 FROM room_participants WHERE source_id = ?)",
          claims.sub, roomJoinEvent, day, cap.xpAwarded, time));
      }
      statements.push(...progress.statements);
      const userFields = { ...progress.columns, updated_at: time };
      if (Object.keys(progress.columns).length) {
        statements.push(write(`UPDATE users SET ${Object.keys(userFields).map(key => `${key} = ?`).join(", ")}
          WHERE source_id = ? AND EXISTS (SELECT 1 FROM room_participants WHERE source_id = ?)`,
        ...Object.values(userFields), claims.sub));
      }
      const [joined] = await db.batch(statements);
      if (joined.meta.changes) {
        response = { joined: true, role, xpGrant: progress.xpGrant };
      }
    }
    if (!response) {
      const existing = await activeParticipant(id, claims.sub);
      if (existing) response = { joined: true, role: existing.role };
    }
    if (!response) throw new HttpError(409, "Room join changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, response);
  }));

  router.post("/:id/leave", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const time = new Date().toISOString();
    const room = await db.prepare("SELECT host_id, status, type, livekit_room_name FROM rooms WHERE source_id = ?")
      .bind(id).first<{ host_id: string; status: string; type: string; livekit_room_name: string }>();
    const alwaysOnHost = Boolean(room && room.type === "VOICE" &&
      room.livekit_room_name === "official-yugm-trending" && room.host_id === claims.sub);
    if (room && room.status === "LIVE" && !alwaysOnHost) {
      const [exited] = await db.batch([
        db.prepare(`UPDATE room_participants SET left_at = ?, mic_enabled = 0, camera_enabled = 0, seat_index = NULL
          WHERE room_id = ? AND user_id = ? AND left_at IS NULL`).bind(time, id, claims.sub),
        db.prepare(`UPDATE speaker_requests SET status = 'REJECTED', updated_at = ?
          WHERE room_id = ? AND user_id = ? AND status = 'PENDING'
            AND EXISTS (SELECT 1 FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at = ?)`)
          .bind(time, id, claims.sub, id, claims.sub, time),
        db.prepare(`UPDATE rooms SET participant_count = CASE WHEN participant_count > 0 THEN participant_count - 1 ELSE 0 END,
            updated_at = ? WHERE source_id = ?
            AND EXISTS (SELECT 1 FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at = ?)`)
          .bind(time, id, id, claims.sub, time)
      ]);
      if (exited.meta.changes) {
        const remaining = await db.prepare("SELECT 1 FROM room_participants WHERE room_id = ? AND left_at IS NULL LIMIT 1")
          .bind(id).first();
        if (room.host_id === claims.sub || !remaining) await endD1Room(db, id, time);
      }
    }
    const actor = await readActor(db, claims, time);
    if (actor) {
      await activityStatement(db, id, claims.sub, "LEAVE", `${actor.name} left`, actorMetadata(actor), time)
        .run().catch(() => undefined);
    }
    sendOk(res, { left: true });
  }));

  router.post("/:id/end", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row);
    if (row.status !== "LIVE") throw new HttpError(409, "Room has already ended", ErrorCode.CONFLICT);
    const startedAt = String(row.started_at ?? row.created_at ?? new Date().toISOString());
    const [joined, messages, gifts, fans] = await db.batch([
      db.prepare("SELECT COUNT(*) AS total FROM room_participants WHERE room_id = ? AND joined_at >= ?").bind(id, startedAt),
      db.prepare("SELECT COUNT(*) AS total FROM chat_messages WHERE room_id = ? AND created_at >= ?").bind(id, startedAt),
      db.prepare(`SELECT COUNT(*) AS count, COALESCE(SUM(diamond_amount), 0) AS diamonds
        FROM gift_transactions WHERE room_id = ? AND created_at >= ?`).bind(id, startedAt),
      db.prepare("SELECT COUNT(*) AS total FROM follows WHERE following_id = ? AND created_at >= ?")
        .bind(row.host_id, startedAt)
    ]);
    const endedAt = new Date();
    const ended = await endD1Room(db, id, endedAt.toISOString());
    if (!ended) throw new HttpError(409, "Room has already ended", ErrorCode.CONFLICT);
    const giftStats = gifts.results[0] as { count: number; diamonds: number };
    sendOk(res, {
      roomId: id,
      summary: {
        durationMinutes: Math.max(0, Math.floor((endedAt.getTime() - new Date(startedAt).getTime()) / 60_000)),
        joined: (joined.results[0] as { total: number }).total,
        messages: (messages.results[0] as { total: number }).total,
        gifts: giftStats.count,
        newFans: (fans.results[0] as { total: number }).total,
        diamondGifts: giftStats.diamonds
      }
    });
  }));

  router.patch("/:id", validateBody(patchSchema), asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row);
    const patch = req.body as z.infer<typeof patchSchema>;
    await ownedCosmetics(claims.sub, patch);
    const entries = Object.entries(patch).filter(([, value]) => value !== undefined) as
      Array<[keyof typeof roomPatchColumns, unknown]>;
    if (entries.length) {
      const fields = entries.map(([key]) => `${roomPatchColumns[key][0]} = ?`);
      const values = entries.map(([key, value]) => roomPatchColumns[key][1](value));
      const time = new Date().toISOString();
      await db.prepare(`UPDATE rooms SET ${fields.join(", ")}, updated_at = ? WHERE source_id = ?`)
        .bind(...values, time, id).run();
    }
    sendOk(res, { room: room(row) });
  }));

  router.post("/:id/theme", asyncHandler(async (req, res, next) => {
    res.locals.themeSession = await authenticate(req);
    next();
  }), validateBody(setThemeSchema), asyncHandler(async (req, res) => {
    const { claims, user }: Awaited<ReturnType<typeof authenticate>> = res.locals.themeSession;
    const id = roomId(req.params.id);
    const key: string = req.body.themeKey;
    const current = await loadRoom(db, id, claims.sub);
    if (!current) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const cohosts = JSON.parse(String(current.co_host_ids_json)) as string[];
    if (current.host_id !== user.id && !cohosts.includes(user.id) && user.role !== "ADMIN") {
      throw new HttpError(403, "Host or co-host control required", ErrorCode.FORBIDDEN);
    }
    await assertD1ThemeEntitlement(db, user.id, key);
    const time = new Date().toISOString();
    const updated = await db.prepare(`UPDATE rooms AS r SET theme = ?, updated_at = ? WHERE r.source_id = ?
      AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND ${usableTheme}
        AND (r.host_id = u.source_id OR u.role = 'ADMIN' OR EXISTS (
          SELECT 1 FROM room_cohosts AS c WHERE c.rooms_id = r.source_id AND c.value = u.source_id)))`)
      .bind(key, time, id, ...bindD1LiveUser(claims, time), key).run();
    if (!updated.meta.changes) {
      await authenticate(req);
      throw new HttpError(403, "Theme or room control is no longer available", ErrorCode.FORBIDDEN);
    }
    const result = await loadRoom(db, id, claims.sub);
    if (!result) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    sendOk(res, { room: room(result) });
  }));

  router.post("/:id/mic-lock", validateBody(micLockSchema), asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row);
    await db.prepare("UPDATE rooms SET mic_locked = ?, updated_at = ? WHERE source_id = ?")
      .bind(Number(req.body.locked), new Date().toISOString(), id).run();
    sendOk(res, { micLocked: req.body.locked });
  }));

  router.post("/:id/seat-lock", validateBody(seatLockSchema), asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row);
    const { seatIndex, locked } = req.body;
    if (seatIndex >= micLimit(row)) throw new HttpError(400, "Invalid mic seat", ErrorCode.VALIDATION);
    if ((await occupiedSeats(db, id, micLimit(row))).has(seatIndex)) {
      throw new HttpError(409, "An occupied mic cannot be locked", ErrorCode.CONFLICT);
    }
    if (locked) {
      await db.prepare(`INSERT INTO room_locked_seats (source_id, value, rooms_id, position)
        SELECT ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM room_locked_seats WHERE rooms_id = ? AND value = ?)`)
        .bind(`${id}:lockedSeatIndices:${seatIndex}`, seatIndex, id, seatIndex, id, seatIndex).run();
    } else {
      await db.prepare("DELETE FROM room_locked_seats WHERE rooms_id = ? AND value = ?").bind(id, seatIndex).run();
    }
    sendOk(res, { seatIndex, locked });
  }));

  router.post("/:id/chat/clean", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row);
    await db.batch([
      db.prepare("DELETE FROM chat_messages WHERE room_id = ?").bind(id),
      db.prepare("DELETE FROM room_activities WHERE room_id = ?").bind(id)
    ]);
    sendOk(res, { cleared: true });
  }));

  router.post("/:id/request-speaker", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const time = new Date().toISOString();
    const actor = await readActor(db, claims, time);
    if (!actor) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    safety(actor, { muted: true });
    const row = readRoom(await loadRoom(db, id, claims.sub));
    if (row.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
    if (!row.allow_audience_mic_requests) throw new HttpError(400, "Mic requests are closed", ErrorCode.VALIDATION);
    const participant = await activeParticipant(id, claims.sub);
    if (!participant) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
    if (participant.role !== "AUDIENCE") throw new HttpError(409, "Only audience members can request the mic", ErrorCode.CONFLICT);
    const existing = await db.prepare("SELECT 1 FROM speaker_requests WHERE room_id = ? AND user_id = ? AND status = 'PENDING'")
      .bind(id, claims.sub).first();
    if (existing) throw new HttpError(409, "Speaker request already pending", ErrorCode.CONFLICT);
    const requestId = newId();
    const [created] = await db.batch([
      db.prepare(`INSERT INTO speaker_requests (source_id, room_id, user_id, status, created_at, updated_at)
        SELECT ?, r.source_id, ?, 'PENDING', ?, ? FROM rooms AS r
        WHERE r.source_id = ? AND r.status = 'LIVE'
          AND NOT EXISTS (SELECT 1 FROM speaker_requests WHERE room_id = r.source_id AND user_id = ? AND status = 'PENDING')`)
        .bind(requestId, claims.sub, time, time, id, claims.sub),
      activityStatement(db, id, claims.sub, "SPEAKER_REQUEST", `${actor.name} requested the mic`, {}, time)
    ]);
    if (!created.meta.changes) throw new HttpError(409, "Speaker request already pending", ErrorCode.CONFLICT);
    sendOk(res, {
      request: { _id: requestId, roomId: id, userId: claims.sub, status: "PENDING", createdAt: time, updatedAt: time }
    }, 201);
  }));

  router.post("/:id/approve-speaker", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const time = new Date().toISOString();
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row);
    if (row.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
    if (row.host_id === userId) throw new HttpError(400, "Cannot approve the room host", ErrorCode.VALIDATION);
    const participant = await activeParticipant(id, userId);
    if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
    if (participant.role !== "AUDIENCE") throw new HttpError(409, "User is already allowed to speak", ErrorCode.CONFLICT);
    const seatIndex = openSeat(row, await occupiedSeats(db, id, micLimit(row)));
    const request = await db.prepare("SELECT source_id FROM speaker_requests WHERE room_id = ? AND user_id = ? AND status = 'PENDING'")
      .bind(id, userId).first<{ source_id: string }>();
    if (!request) throw new HttpError(404, "Pending speaker request not found", ErrorCode.NOT_FOUND);
    const [approved] = await db.batch([
      db.prepare("UPDATE speaker_requests SET status = 'APPROVED', updated_at = ? WHERE source_id = ? AND status = 'PENDING'")
        .bind(time, request.source_id),
      db.prepare(`INSERT INTO room_speakers (source_id, value, rooms_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM room_speakers WHERE rooms_id = ?), 0)
        WHERE EXISTS (SELECT 1 FROM speaker_requests WHERE source_id = ? AND status = 'APPROVED')
          AND NOT EXISTS (SELECT 1 FROM room_speakers WHERE rooms_id = ? AND value = ?)`)
        .bind(newId(), userId, id, id, request.source_id, id, userId),
      db.prepare(`UPDATE room_participants SET role = 'SPEAKER', mic_enabled = 1, camera_enabled = 1,
          moderator_muted = 0, seat_index = ? WHERE source_id = ? AND left_at IS NULL
          AND EXISTS (SELECT 1 FROM speaker_requests WHERE source_id = ? AND status = 'APPROVED')`)
        .bind(seatIndex, participant.source_id, request.source_id)
    ]);
    if (!approved.meta.changes) throw new HttpError(404, "Pending speaker request not found", ErrorCode.NOT_FOUND);
    sendOk(res, { approved: true });
  }));

  router.post("/:id/take-seat", validateBody(takeSeatSchema), asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const time = new Date().toISOString();
    const row = readRoom(await loadRoom(db, id, claims.sub));
    if (row.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
    const participant = await activeParticipant(id, claims.sub);
    if (!participant) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
    if (!["AUDIENCE", "HOST", "SPEAKER", "MODERATOR"].includes(participant.role)) {
      throw new HttpError(409, "You cannot change seats right now", ErrorCode.CONFLICT);
    }
    const wasAudience = participant.role === "AUDIENCE";
    if (row.type === "VIDEO" && wasAudience) {
      throw new HttpError(403, "Ask the host to approve your call request", ErrorCode.FORBIDDEN);
    }
    const seatIndex = openSeat(row, await occupiedSeats(db, id, micLimit(row), claims.sub), req.body.seatIndex);
    if (wasAudience) {
      await db.batch([
        db.prepare(`INSERT INTO room_speakers (source_id, value, rooms_id, position)
          SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM room_speakers WHERE rooms_id = ?), 0)
          WHERE NOT EXISTS (SELECT 1 FROM room_speakers WHERE rooms_id = ? AND value = ?)`)
          .bind(newId(), claims.sub, id, id, id, claims.sub),
        db.prepare(`UPDATE room_participants SET role = 'SPEAKER', mic_enabled = 1, camera_enabled = 1,
            moderator_muted = 0, seat_index = ? WHERE source_id = ? AND left_at IS NULL AND role = 'AUDIENCE'`)
          .bind(seatIndex, participant.source_id),
        db.prepare(`UPDATE speaker_requests SET status = 'APPROVED', updated_at = ?
          WHERE room_id = ? AND user_id = ? AND status = 'PENDING'`).bind(time, id, claims.sub)
      ]);
    } else {
      await db.prepare("UPDATE room_participants SET seat_index = ? WHERE source_id = ? AND left_at IS NULL")
        .bind(seatIndex, participant.source_id).run();
    }
    sendOk(res, { seated: true, seatIndex, moved: !wasAudience });
  }));

  router.post("/:id/leave-seat", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = readRoom(await loadRoom(db, id, claims.sub));
    if (row.status !== "LIVE" || row.type !== "VOICE") {
      throw new HttpError(400, "This room has no live mic seats", ErrorCode.VALIDATION);
    }
    const participant = await activeParticipant(id, claims.sub);
    if (!participant) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
    const [left] = await db.batch([
      db.prepare(`UPDATE room_participants SET role = 'AUDIENCE', mic_enabled = 0, moderator_muted = 0, seat_index = NULL
        WHERE source_id = ? AND left_at IS NULL AND role IN ('HOST', 'SPEAKER', 'MODERATOR')`)
        .bind(participant.source_id),
      db.prepare(`DELETE FROM room_speakers WHERE rooms_id = ? AND value = ?
        AND EXISTS (SELECT 1 FROM room_participants WHERE source_id = ? AND role = 'AUDIENCE')`)
        .bind(id, claims.sub, participant.source_id)
    ]);
    if (!left.meta.changes) throw new HttpError(409, "You are not currently on a mic seat", ErrorCode.CONFLICT);
    sendOk(res, { leftSeat: true });
  }));

  router.post("/:id/invite-speaker", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const time = new Date().toISOString();
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row);
    if (row.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
    if (row.host_id === userId) throw new HttpError(400, "Cannot invite the room host", ErrorCode.VALIDATION);
    const participant = await activeParticipant(id, userId);
    if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
    if (participant.role !== "AUDIENCE") throw new HttpError(409, "User already has a speaker seat", ErrorCode.CONFLICT);
    const seatIndex = openSeat(row, await occupiedSeats(db, id, micLimit(row)));
    await db.batch([
      db.prepare(`INSERT INTO room_speakers (source_id, value, rooms_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM room_speakers WHERE rooms_id = ?), 0)
        WHERE NOT EXISTS (SELECT 1 FROM room_speakers WHERE rooms_id = ? AND value = ?)`)
        .bind(newId(), userId, id, id, id, userId),
      db.prepare(`UPDATE room_participants SET role = 'SPEAKER', mic_enabled = 1, camera_enabled = 1,
          moderator_muted = 0, seat_index = ? WHERE source_id = ? AND left_at IS NULL`)
        .bind(seatIndex, participant.source_id),
      db.prepare(`UPDATE speaker_requests SET status = 'APPROVED', updated_at = ?
        WHERE room_id = ? AND user_id = ? AND status = 'PENDING'`).bind(time, id, userId)
    ]);
    sendOk(res, { invited: true });
  }));

  router.post("/:id/reject-speaker", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row);
    if (row.host_id === userId) throw new HttpError(400, "Cannot reject the room host", ErrorCode.VALIDATION);
    const result = await db.prepare(`UPDATE speaker_requests SET status = 'REJECTED', updated_at = ?
      WHERE room_id = ? AND user_id = ? AND status = 'PENDING'`)
      .bind(new Date().toISOString(), id, userId).run();
    if (!result.meta.changes) throw new HttpError(404, "Pending speaker request not found", ErrorCode.NOT_FOUND);
    sendOk(res, { rejected: true });
  }));

  router.post("/:id/mute-user", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const row = readRoom(await loadRoom(db, id, claims.sub));
    const host = control(row);
    if (row.host_id === userId) throw new HttpError(400, "Cannot mute the room host", ErrorCode.VALIDATION);
    if (!host && (JSON.parse(String(row.room_admin_ids_json)) as string[]).includes(userId)) {
      throw new HttpError(403, "Room admins cannot mute each other", ErrorCode.FORBIDDEN);
    }
    const participant = await activeParticipant(id, userId);
    if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
    await db.prepare("UPDATE room_participants SET mic_enabled = 0, moderator_muted = 1 WHERE source_id = ? AND left_at IS NULL")
      .bind(participant.source_id).run();
    sendOk(res, { muted: true });
  }));

  router.post("/:id/unmute-user", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const row = readRoom(await loadRoom(db, id, claims.sub));
    const host = control(row);
    if (row.host_id === userId) throw new HttpError(400, "Cannot unmute the room host", ErrorCode.VALIDATION);
    if (!host && (JSON.parse(String(row.room_admin_ids_json)) as string[]).includes(userId)) {
      throw new HttpError(403, "Room admins cannot unmute each other", ErrorCode.FORBIDDEN);
    }
    const participant = await activeParticipant(id, userId);
    if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
    await db.prepare("UPDATE room_participants SET mic_enabled = 1, moderator_muted = 0 WHERE source_id = ? AND left_at IS NULL")
      .bind(participant.source_id).run();
    sendOk(res, { unmuted: true });
  }));

  router.post("/:id/mic-state", validateBody(micStateSchema), asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = await loadRoom(db, id, claims.sub);
    if (!row) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const participant = await db.prepare(`SELECT source_id, role, moderator_muted FROM room_participants
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL`).bind(id, claims.sub)
      .first<{ source_id: string; role: string; moderator_muted: number }>();
    if (!participant) throw new HttpError(403, "You are not an active room participant", ErrorCode.FORBIDDEN);
    if (!privilegedRoles.has(participant.role)) throw new HttpError(403, "You do not have an active mic seat", ErrorCode.FORBIDDEN);
    if (req.body.enabled && participant.moderator_muted) {
      throw new HttpError(423, "The host or an admin muted your microphone", ErrorCode.FORBIDDEN);
    }
    const enabled = Boolean(req.body.enabled);
    await db.prepare("UPDATE room_participants SET mic_enabled = ? WHERE source_id = ? AND left_at IS NULL")
      .bind(Number(enabled), participant.source_id).run();
    sendOk(res, { micEnabled: enabled, moderatorMuted: Boolean(participant.moderator_muted) });
  }));

  router.post("/:id/remove-speaker", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const row = readRoom(await loadRoom(db, id, claims.sub));
    const host = control(row);
    if (row.host_id === userId) throw new HttpError(400, "Cannot remove the room host from the mic", ErrorCode.VALIDATION);
    if (!host && (JSON.parse(String(row.room_admin_ids_json)) as string[]).includes(userId)) {
      throw new HttpError(403, "Room admins cannot remove each other from the mic", ErrorCode.FORBIDDEN);
    }
    const participant = await db.prepare(`SELECT source_id FROM room_participants
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL AND role IN ('SPEAKER', 'MODERATOR')`)
      .bind(id, userId).first<{ source_id: string }>();
    if (!participant) throw new HttpError(404, "Active speaker not found", ErrorCode.NOT_FOUND);
    await db.batch([
      db.prepare(`UPDATE room_participants SET role = 'AUDIENCE', mic_enabled = 0, moderator_muted = 0, seat_index = NULL
        WHERE source_id = ? AND left_at IS NULL`).bind(participant.source_id),
      db.prepare("DELETE FROM room_speakers WHERE rooms_id = ? AND value = ?").bind(id, userId),
      db.prepare("DELETE FROM room_moderators WHERE rooms_id = ? AND value = ?").bind(id, userId)
    ]);
    sendOk(res, { removedFromSeat: true });
  }));

  router.post("/:id/remove-user", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const time = new Date().toISOString();
    const row = readRoom(await loadRoom(db, id, claims.sub));
    const host = control(row);
    if (row.host_id === userId) throw new HttpError(400, "Cannot remove the room host", ErrorCode.VALIDATION);
    if (!host && (JSON.parse(String(row.room_admin_ids_json)) as string[]).includes(userId)) {
      throw new HttpError(403, "Room admins cannot remove each other", ErrorCode.FORBIDDEN);
    }
    const participant = await activeParticipant(id, userId);
    if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
    await db.batch([
      db.prepare("UPDATE room_participants SET left_at = ?, mic_enabled = 0, camera_enabled = 0, seat_index = NULL WHERE source_id = ? AND left_at IS NULL")
        .bind(time, participant.source_id),
      db.prepare(`UPDATE rooms SET participant_count = CASE WHEN participant_count > 0 THEN participant_count - 1 ELSE 0 END,
          updated_at = ? WHERE source_id = ?`).bind(time, id),
      db.prepare("DELETE FROM room_speakers WHERE rooms_id = ? AND value = ?").bind(id, userId),
      db.prepare("DELETE FROM room_moderators WHERE rooms_id = ? AND value = ?").bind(id, userId),
      db.prepare("DELETE FROM room_admins WHERE rooms_id = ? AND value = ?").bind(id, userId),
      db.prepare(`UPDATE speaker_requests SET status = 'REJECTED', updated_at = ?
        WHERE room_id = ? AND user_id = ? AND status = 'PENDING'`).bind(time, id, userId)
    ]);
    sendOk(res, { removed: true });
  }));

  router.post("/:id/admin", validateBody(adminSchema), asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body.userId));
    const row = readRoom(await loadRoom(db, id, claims.sub));
    control(row, true);
    if (row.host_id === userId) throw new HttpError(400, "Cannot promote the room host", ErrorCode.VALIDATION);
    const participant = await activeParticipant(id, userId);
    if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
    const isAdmin = req.body.isAdmin !== false;
    if (isAdmin) {
      await db.prepare(`INSERT INTO room_admins (source_id, value, rooms_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM room_admins WHERE rooms_id = ?), 0)
        WHERE NOT EXISTS (SELECT 1 FROM room_admins WHERE rooms_id = ? AND value = ?)`)
        .bind(newId(), userId, id, id, id, userId).run();
    } else {
      await db.prepare("DELETE FROM room_admins WHERE rooms_id = ? AND value = ?").bind(id, userId).run();
    }
    sendOk(res, { isRoomAdmin: isAdmin });
  }));

  router.post("/:id/co-host", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const row = readRoom(await loadRoom(db, id, claims.sub));
    if (row.host_id !== claims.sub) throw new HttpError(403, "Only host can add co-hosts", ErrorCode.FORBIDDEN);
    if (row.host_id === userId) throw new HttpError(400, "Cannot add host as co-host", ErrorCode.VALIDATION);
    if ((JSON.parse(String(row.co_host_ids_json)) as string[]).includes(userId)) {
      throw new HttpError(409, "User is already a co-host", ErrorCode.CONFLICT);
    }
    await db.batch([
      db.prepare(`INSERT INTO room_cohosts (source_id, value, rooms_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM room_cohosts WHERE rooms_id = ?), 0)
        WHERE NOT EXISTS (SELECT 1 FROM room_cohosts WHERE rooms_id = ? AND value = ?)`)
        .bind(newId(), userId, id, id, id, userId),
      db.prepare("UPDATE rooms SET is_duet = 1, updated_at = ? WHERE source_id = ?")
        .bind(new Date().toISOString(), id),
      db.prepare("UPDATE room_participants SET role = 'MODERATOR' WHERE room_id = ? AND user_id = ? AND left_at IS NULL")
        .bind(id, userId)
    ]);
    sendOk(res, { room: room(readRoom(await loadRoom(db, id, claims.sub))) });
  }));

  router.post("/:id/remove-co-host", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const userId = d1UserId(String(req.body?.userId ?? ""));
    const row = readRoom(await loadRoom(db, id, claims.sub));
    if (row.host_id !== claims.sub) throw new HttpError(403, "Only host can remove co-hosts", ErrorCode.FORBIDDEN);
    const time = new Date().toISOString();
    await db.batch([
      db.prepare("DELETE FROM room_cohosts WHERE rooms_id = ? AND value = ?").bind(id, userId),
      db.prepare(`UPDATE rooms SET is_duet = CASE WHEN EXISTS (SELECT 1 FROM room_cohosts WHERE rooms_id = ?) THEN 1 ELSE 0 END,
          updated_at = ? WHERE source_id = ?`).bind(id, time, id),
      db.prepare("UPDATE room_participants SET role = 'SPEAKER' WHERE room_id = ? AND user_id = ? AND left_at IS NULL")
        .bind(id, userId)
    ]);
    sendOk(res, { room: room(readRoom(await loadRoom(db, id, claims.sub))) });
  }));

  router.get("/:id/co-hosts", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const id = roomId(req.params.id);
    const row = await loadRoom(db, id, claims.sub);
    if (!row) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const { results } = await db.prepare(`SELECT ${personJson("u")} AS user_json FROM room_cohosts AS c
      JOIN users AS u ON u.source_id = c.value WHERE c.rooms_id = ? ORDER BY c.position, c.source_id`)
      .bind(id).all<{ user_json: string }>();
    sendOk(res, { coHosts: results.map(entry => person(entry.user_json)), isDuet: Boolean(row.is_duet) });
  }));

  return router;
}
