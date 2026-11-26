import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Response } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { createNotification } from "./d1AdminUsers.js";
import { newId } from "./d1Cosmetics.js";
import { d1UserId } from "./d1People.js";
import { messageList, presentD1InboxMessage, type InboxMessage } from "./d1Inbox.js";
import { d1RoomProjection, presentD1Room } from "./d1Rooms.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

type Row = Record<string, string | number | null>;
type Session = { user: { id: string }; claims: AccessClaims };
type Actor = {
  name: string;
  muted_until: string | null;
  vip_tier: string | null;
  vip_expires_at: string | null;
  languages_json: string;
};

type MatchRequest = {
  source_id: string;
  status: string;
  matched_user_id: string | null;
  room_id: string | null;
};

const privateCallSchema = z.object({ type: z.enum(["VOICE", "VIDEO"]) });
const newRoomName = () => `yugm-private-${Date.now()}-${randomBytes(3).toString("hex")}`;

export function createD1UserMatchingRouter(db: D1Database, allowChat?: D1UserRateLimit) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.userSession = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const sessionFor = (res: Response) => res.locals.userSession as Session;
  const chatGate = asyncHandler(async (_req, res, next) => {
    const { claims } = sessionFor(res);
    await enforceD1UserRateLimit(allowChat, claims.sub, res, 10);
    next();
  });

  const loadRoom = (id: string) => db.prepare(`SELECT ${d1RoomProjection}
    FROM rooms AS r LEFT JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`)
    .bind(id).first<Row>();

  const readActor = (claims: AccessClaims, time: string) => db.prepare(`SELECT u.name, u.muted_until,
      u.vip_tier, u.vip_expires_at,
      (SELECT json_group_array(value) FROM (
        SELECT value FROM user_languages WHERE users_id = u.source_id ORDER BY position
      )) AS languages_json
    FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL`)
    .bind(...bindD1LiveUser(claims, time)).first<Actor>();

  const callActor = asyncHandler(async (_req, res, next) => {
    const { claims } = sessionFor(res);
    const now = new Date();
    const time = now.toISOString();
    const actor = await readActor(claims, time);
    if (!actor) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    if (actor.muted_until && Date.parse(actor.muted_until) > now.getTime()) {
      throw new HttpError(403, `Account muted until ${actor.muted_until}`, ErrorCode.FORBIDDEN);
    }
    res.locals.callActor = actor;
    res.locals.callTime = time;
    next();
  });

  router.get("/friend-match", authenticate, chatGate, asyncHandler(async (_req, res) => {
    const { user } = sessionFor(res);
    const now = new Date().toISOString();
    const request = await db.prepare(`SELECT source_id, status, matched_user_id, room_id, expires_at
      FROM friend_match_requests WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at ASC, source_id ASC LIMIT 1`).bind(user.id, now).first<MatchRequest>();
    if (!request) return sendOk(res, { status: "IDLE" });
    if (request.status !== "MATCHED" || !request.room_id || !request.matched_user_id) {
      return sendOk(res, { status: "WAITING" });
    }
    const live = await db.prepare("SELECT source_id FROM rooms WHERE source_id = ? AND status = 'LIVE'")
      .bind(request.room_id).first();
    if (!live) {
      await db.prepare("UPDATE friend_match_requests SET status = 'CANCELLED', expires_at = ? WHERE room_id = ? AND status = 'MATCHED'")
        .bind(now, request.room_id).run();
      return sendOk(res, { status: "IDLE" });
    }
    const room = await loadRoom(request.room_id);
    if (!room) {
      await db.prepare("UPDATE friend_match_requests SET status = 'CANCELLED', expires_at = ? WHERE room_id = ? AND status = 'MATCHED'")
        .bind(now, request.room_id).run();
      return sendOk(res, { status: "IDLE" });
    }
    sendOk(res, { status: "MATCHED", room: presentD1Room(room, false) });
  }));

  router.post("/friend-match/cancel", authenticate, chatGate, asyncHandler(async (_req, res) => {
    const { user } = sessionFor(res);
    await db.prepare("UPDATE friend_match_requests SET status = 'CANCELLED', expires_at = ? WHERE user_id = ? AND status = 'WAITING'")
      .bind(new Date().toISOString(), user.id).run();
    sendOk(res, { cancelled: true });
  }));

  router.post("/messages/:userId/call", authenticate, callActor, validateBody(privateCallSchema), asyncHandler(async (req, res) => {
    const { claims } = sessionFor(res);
    const actor = res.locals.callActor as Actor;
    const time = res.locals.callTime as string;
    const now = new Date(time);
    const callerId = claims.sub;
    const receiverId = d1UserId(req.params.userId);
    if (receiverId === callerId) throw new HttpError(400, "Cannot call yourself", ErrorCode.VALIDATION);

    const receiver = await db.prepare("SELECT source_id, name FROM users WHERE source_id = ?")
      .bind(receiverId).first<{ source_id: string; name: string }>();
    if (!receiver) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    // Legacy reads only tier/expiry/start fields for this route, so a frozen
    // flag is intentionally not applied here.
    if (!getVipStatus({ vipTier: actor.vip_tier, vipExpiresAt: actor.vip_expires_at }, now).isVip) {
      throw new HttpError(403, "Private voice and video calls are available to VIP members only", ErrorCode.FORBIDDEN);
    }
    const blocked = await db.prepare(`SELECT 1 FROM blocks
      WHERE (blocker_id = ?1 AND blocked_user_id = ?2) OR (blocker_id = ?2 AND blocked_user_id = ?1) LIMIT 1`)
      .bind(callerId, receiverId).first();
    if (blocked) throw new HttpError(403, "Cannot call this user", ErrorCode.FORBIDDEN);

    const { type } = privateCallSchema.parse(req.body);
    const roomId = newId();
    const messageId = newId();
    const languages = JSON.parse(actor.languages_json || "[]") as string[];
    const title = `${actor.name} and ${receiver.name}`;
    const message = `Private ${type.toLowerCase()} call started`;
    const cameraEnabled = Number(type === "VIDEO");
    const guard = `${d1LiveUserFilter} AND u.deletion_requested_at IS NULL
      AND (u.muted_until IS NULL OR u.muted_until <= ?)
      AND u.vip_tier IS ? AND u.vip_expires_at IS ?
      AND NOT EXISTS (SELECT 1 FROM blocks WHERE
        (blocker_id = u.source_id AND blocked_user_id = peer.source_id)
        OR (blocker_id = peer.source_id AND blocked_user_id = u.source_id))`;
    const guardValues = [receiverId, ...bindD1LiveUser(claims, time), time,
      actor.vip_tier, actor.vip_expires_at];

    const committed = await db.batch([
      db.prepare(`INSERT INTO rooms (source_id, title, description, type, host_id, cover_image, category, tags,
          language, status, visibility, max_speakers, participant_count, active_pk_id, is_duet, livekit_room_name,
          allow_audience_mic_requests, mic_locked, theme, vip_only, badge, ambience, scheduled_for, started_at,
          ended_at, mode, created_at, updated_at)
        SELECT ?, ?, ?, ?, u.source_id, NULL, 'Private', ?, ?, 'LIVE', 'PRIVATE', 2, 2, NULL, 0, ?, 0, 0, NULL,
          0, NULL, NULL, NULL, ?, NULL, NULL, ?, ?
        FROM users AS u JOIN users AS peer ON peer.source_id = ? WHERE ${guard}`)
        .bind(roomId, title, `Private ${type.toLowerCase()} call`, type, JSON.stringify(["private-call", "direct"]),
          languages[0] ?? "English", newRoomName(), time, time, time, ...guardValues),
      db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled, moderator_muted,
          seat_index, camera_enabled, joined_at)
        SELECT ?, ?, u.source_id, 'HOST', 1, 0, NULL, ?, ?
        FROM users AS u JOIN users AS peer ON peer.source_id = ? WHERE ${guard}`)
        .bind(newId(), roomId, cameraEnabled, time, ...guardValues),
      db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled, moderator_muted,
          seat_index, camera_enabled, joined_at)
        SELECT ?, ?, peer.source_id, 'SPEAKER', 1, 0, NULL, ?, ?
        FROM users AS u JOIN users AS peer ON peer.source_id = ? WHERE ${guard}`)
        .bind(newId(), roomId, cameraEnabled, time, ...guardValues),
      db.prepare(`INSERT INTO room_speakers (source_id, value, rooms_id, position)
        SELECT ?, u.source_id, ?, 0 FROM users AS u JOIN users AS peer ON peer.source_id = ? WHERE ${guard}`)
        .bind(`${roomId}:speakerIds:0`, roomId, ...guardValues),
      db.prepare(`INSERT INTO room_speakers (source_id, value, rooms_id, position)
        SELECT ?, peer.source_id, ?, 1 FROM users AS u JOIN users AS peer ON peer.source_id = ? WHERE ${guard}`)
        .bind(`${roomId}:speakerIds:1`, roomId, ...guardValues),
      db.prepare(`INSERT INTO direct_messages (source_id, sender_id, receiver_id, room_id, message, media_url,
          media_type, duration, forwarded, is_edited, read, created_at, updated_at,
          reply_to_message_id, reply_to_author, reply_to_author_id, reply_to_text, reply_to_media_url)
        SELECT ?, u.source_id, peer.source_id, ?, ?, '', '', 0, 0, 0, 0, ?, ?, '', '', NULL, '', ''
        FROM users AS u JOIN users AS peer ON peer.source_id = ? WHERE ${guard}`)
        .bind(messageId, roomId, message, time, time, ...guardValues)
    ]);
    if (!committed[0]?.meta.changes || !committed.at(-1)?.meta.changes) {
      throw new HttpError(409, "Private call changed. Please try again.", ErrorCode.CONFLICT);
    }

    await createNotification(db, receiverId, "MESSAGE",
      type === "VOICE" ? "Private voice call" : "Private video call",
      `${actor.name} started a private ${type.toLowerCase()} call`,
      { roomId, partnerId: callerId, callType: type });

    const room = await loadRoom(roomId);
    const createdMessage = await db.prepare(`${messageList} WHERE m.source_id = ?`)
      .bind(messageId).first<InboxMessage>();
    if (!room || !createdMessage) throw new HttpError(500, "Private call unavailable", ErrorCode.INTERNAL);
    sendOk(res, { room: presentD1Room(room, false), message: presentD1InboxMessage(createdMessage) }, 201);
  }));

  return router;
}
