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
import { createD1AuthSessionStore } from "./d1AuthSessionStore.js";
import { endD1UnavailableBonds } from "./d1Bonds.js";
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
const parseJsonStrings = (value: string | null | undefined) => {
  try {
    const parsed = JSON.parse(value ?? "[]");
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
};

// Host-provided side effects stay optional so the Worker bundle never pulls in
// Firebase Admin or Socket.IO. Without a presence adapter, no D1 user is treated
// as online and random matching returns the legacy WAITING shape.
export type D1UserMatchingSideEffects = {
  deleteFirebaseUser?: (uid: string) => Promise<{ deleted: boolean; reason?: "not_configured" | "not_found" }>;
  isUserOnline?: (userId: string) => Promise<boolean> | boolean;
  disconnectUser?: (userId: string) => Promise<void> | void;
  emitUser?: (userId: string, event: string, payload: unknown) => void;
};

export function createD1UserMatchingRouter(db: D1Database, allowChat?: D1UserRateLimit,
  sideEffects: D1UserMatchingSideEffects = {}) {
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

  const readFriendMatchState = async (userId: string, now: string) => {
    const request = await db.prepare(`SELECT source_id, status, matched_user_id, room_id, expires_at
      FROM friend_match_requests WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at ASC, source_id ASC LIMIT 1`).bind(userId, now).first<MatchRequest>();
    if (!request) return { status: "IDLE" as const };
    if (request.status !== "MATCHED" || !request.room_id || !request.matched_user_id) {
      return { status: "WAITING" as const };
    }
    const live = await db.prepare("SELECT source_id FROM rooms WHERE source_id = ? AND status = 'LIVE'")
      .bind(request.room_id).first();
    const room = live ? await loadRoom(request.room_id) : null;
    if (!room) {
      await db.prepare("UPDATE friend_match_requests SET status = 'CANCELLED', expires_at = ? WHERE room_id = ? AND status = 'MATCHED'")
        .bind(now, request.room_id).run();
      return { status: "IDLE" as const };
    }
    return { status: "MATCHED" as const, room: presentD1Room(room, false) };
  };

  router.get("/friend-match", authenticate, chatGate, asyncHandler(async (_req, res) => {
    const { user } = sessionFor(res);
    sendOk(res, await readFriendMatchState(user.id, new Date().toISOString()));
  }));

  router.post("/friend-match/cancel", authenticate, chatGate, asyncHandler(async (_req, res) => {
    const { user } = sessionFor(res);
    await db.prepare("UPDATE friend_match_requests SET status = 'CANCELLED', expires_at = ? WHERE user_id = ? AND status = 'WAITING'")
      .bind(new Date().toISOString(), user.id).run();
    sendOk(res, { cancelled: true });
  }));

  router.post("/friend-match/search", authenticate, chatGate, asyncHandler(async (_req, res) => {
    const { user } = sessionFor(res);
    const started = new Date();
    const now = started.toISOString();
    const waitingUntil = new Date(started.getTime() + 90_000).toISOString();
    const matchedUntil = new Date(started.getTime() + 5 * 60_000).toISOString();
    const existing = await db.prepare(`SELECT source_id, status, matched_user_id, room_id, expires_at
      FROM friend_match_requests WHERE user_id = ? AND expires_at > ?
      ORDER BY created_at ASC, source_id ASC LIMIT 1`).bind(user.id, now).first<MatchRequest>();
    if (existing?.status === "MATCHED" && existing.room_id && existing.matched_user_id) {
      const matched = await readFriendMatchState(user.id, now);
      if (matched.status === "MATCHED") return sendOk(res, matched);
    }
    if (existing?.status === "PAIRING") return sendOk(res, { status: "WAITING" });

    const ownId = existing?.source_id ?? newId();
    if (existing) {
      await db.prepare(`UPDATE friend_match_requests
        SET status = 'WAITING', matched_user_id = NULL, room_id = NULL, expires_at = ?, updated_at = ?
        WHERE source_id = ?`).bind(waitingUntil, now, ownId).run();
    } else {
      await db.prepare(`INSERT INTO friend_match_requests
        (source_id, user_id, status, matched_user_id, room_id, expires_at, created_at, updated_at)
        VALUES (?, ?, 'WAITING', NULL, NULL, ?, ?, ?)`)
        .bind(ownId, user.id, waitingUntil, now, now).run();
    }
    const reserved = await db.prepare(`UPDATE friend_match_requests SET status = 'PAIRING', updated_at = ?
      WHERE source_id = ? AND status = 'WAITING' AND expires_at > ?`).bind(now, ownId, now).run();
    if (!reserved.meta.changes) return sendOk(res, await readFriendMatchState(user.id, now));

    const blocks = await db.prepare(`SELECT blocker_id, blocked_user_id FROM blocks
      WHERE blocker_id = ? OR blocked_user_id = ?`).bind(user.id, user.id)
      .all<{ blocker_id: string; blocked_user_id: string }>();
    const excluded = new Set<string>([user.id]);
    for (const row of blocks.results) {
      excluded.add(row.blocker_id);
      excluded.add(row.blocked_user_id);
    }
    const excludedIds = [...excluded];
    const candidates = await db.prepare(`SELECT fr.source_id, fr.user_id FROM friend_match_requests AS fr
      JOIN users AS u ON u.source_id = fr.user_id
      WHERE fr.status = 'WAITING' AND fr.expires_at > ? AND fr.user_id NOT IN (${excludedIds.map(() => "?").join(", ")})
        AND u.is_blocked = 0 AND u.deletion_requested_at IS NULL
      ORDER BY fr.created_at ASC, fr.source_id ASC LIMIT 10`)
      .bind(now, ...excludedIds).all<{ source_id: string; user_id: string }>();

    const resetPair = async (candidateRequestId: string) => {
      await db.prepare(`UPDATE friend_match_requests SET status = 'WAITING', updated_at = ?
        WHERE source_id IN (?, ?) AND status = 'PAIRING'`).bind(now, ownId, candidateRequestId).run();
    };
    for (const candidate of candidates.results) {
      const online = sideEffects.isUserOnline ? await sideEffects.isUserOnline(candidate.user_id) : false;
      if (!online) {
        await db.prepare(`UPDATE friend_match_requests SET status = 'CANCELLED', expires_at = ?
          WHERE source_id = ? AND status = 'WAITING'`).bind(now, candidate.source_id).run();
        continue;
      }
      const claimed = await db.prepare(`UPDATE friend_match_requests SET status = 'PAIRING', updated_at = ?
        WHERE source_id = ? AND status = 'WAITING' AND expires_at > ?`).bind(now, candidate.source_id, now).run();
      if (!claimed.meta.changes) continue;
      const matchedUser = await db.prepare(`SELECT source_id, name FROM users
        WHERE source_id = ? AND is_blocked = 0 AND deletion_requested_at IS NULL`)
        .bind(candidate.user_id).first<{ source_id: string; name: string }>();
      if (!matchedUser) {
        await resetPair(candidate.source_id);
        throw new HttpError(409, "That match is no longer available", ErrorCode.CONFLICT);
      }
      const actor = await db.prepare("SELECT name FROM users WHERE source_id = ?")
        .bind(user.id).first<{ name: string }>();
      const language = await db.prepare(`SELECT value FROM user_languages
        WHERE users_id = ? ORDER BY position LIMIT 1`).bind(user.id).first<{ value: string }>();
      const roomId = newId();
      const guardedUsers = `EXISTS (SELECT 1 FROM users WHERE source_id = ? AND is_blocked = 0
          AND deletion_requested_at IS NULL)
        AND EXISTS (SELECT 1 FROM users WHERE source_id = ? AND is_blocked = 0 AND deletion_requested_at IS NULL)
        AND NOT EXISTS (SELECT 1 FROM blocks WHERE
          (blocker_id = ? AND blocked_user_id = ?) OR (blocker_id = ? AND blocked_user_id = ?))`;
      const guardValues = [user.id, candidate.user_id, user.id, candidate.user_id, user.id, candidate.user_id];
      const committed = await db.batch([
        db.prepare(`INSERT INTO rooms (source_id, title, description, type, host_id, cover_image, category,
            tags, language, status, visibility, max_speakers, participant_count, active_pk_id, is_duet,
            livekit_room_name, allow_audience_mic_requests, mic_locked, theme, vip_only, badge, ambience,
            scheduled_for, started_at, ended_at, mode, created_at, updated_at)
          SELECT ?, ?, 'Private voice call', 'VOICE', ?, NULL, 'Private', ?, ?, 'LIVE', 'PRIVATE', 2, 2,
            NULL, 0, ?, 0, 0, NULL, 0, NULL, NULL, NULL, ?, NULL, NULL, ?, ?
          WHERE ${guardedUsers}`)
          .bind(roomId, `${actor?.name ?? matchedUser.name} and ${matchedUser.name}`,
            user.id, JSON.stringify(["private-call", "random-match"]), language?.value ?? "English",
            `yugm-friend-match-${roomId}`, now, now, now, ...guardValues),
        db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
            moderator_muted, seat_index, camera_enabled, joined_at)
          SELECT ?, ?, ?, 'HOST', 1, 0, 0, 0, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE source_id = ?)
            AND ${guardedUsers}`)
          .bind(`${roomId}:participant:${user.id}`, roomId, user.id, now, roomId, ...guardValues),
        db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled,
            moderator_muted, seat_index, camera_enabled, joined_at)
          SELECT ?, ?, ?, 'SPEAKER', 1, 0, 1, 0, ? WHERE EXISTS (SELECT 1 FROM rooms WHERE source_id = ?)
            AND ${guardedUsers}`)
          .bind(`${roomId}:participant:${candidate.user_id}`, roomId, candidate.user_id, now, roomId, ...guardValues),
        db.prepare(`INSERT INTO room_speakers (source_id, value, rooms_id, position)
          SELECT ?, ?, ?, 0 WHERE EXISTS (SELECT 1 FROM rooms WHERE source_id = ?) AND ${guardedUsers}`)
          .bind(`${roomId}:speakerIds:0`, user.id, roomId, roomId, ...guardValues),
        db.prepare(`INSERT INTO room_speakers (source_id, value, rooms_id, position)
          SELECT ?, ?, ?, 1 WHERE EXISTS (SELECT 1 FROM rooms WHERE source_id = ?) AND ${guardedUsers}`)
          .bind(`${roomId}:speakerIds:1`, candidate.user_id, roomId, roomId, ...guardValues),
        db.prepare(`UPDATE friend_match_requests SET status = 'MATCHED', matched_user_id = ?, room_id = ?,
          expires_at = ?, updated_at = ? WHERE source_id = ? AND status = 'PAIRING'`)
          .bind(candidate.user_id, roomId, matchedUntil, now, ownId),
        db.prepare(`UPDATE friend_match_requests SET status = 'MATCHED', matched_user_id = ?, room_id = ?,
          expires_at = ?, updated_at = ? WHERE source_id = ? AND status = 'PAIRING'`)
          .bind(user.id, roomId, matchedUntil, now, candidate.source_id)
      ]);
      if (committed.some(result => result.meta.changes !== 1)) {
        await resetPair(candidate.source_id);
        throw new HttpError(409, "The match was cancelled", ErrorCode.CONFLICT);
      }
      const room = await loadRoom(roomId);
      if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
      return sendOk(res, { status: "MATCHED", room: presentD1Room(room, false) });
    }

    await db.prepare(`UPDATE friend_match_requests SET status = 'WAITING', updated_at = ?
      WHERE source_id = ? AND status = 'PAIRING'`).bind(now, ownId).run();
    sendOk(res, { status: "WAITING" });
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

  router.delete("/me", authenticate, asyncHandler(async (_req, res) => {
    const { claims } = sessionFor(res);
    const userId = claims.sub;
    const started = new Date();
    const time = started.toISOString();
    const account = await db.prepare("SELECT firebase_uid FROM users WHERE source_id = ?")
      .bind(userId).first<{ firebase_uid: string | null }>();
    if (!account) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    const partners = await db.prepare(`SELECT DISTINCT partner_id FROM (
      SELECT receiver_id AS partner_id FROM direct_messages WHERE sender_id = ?
      UNION SELECT sender_id AS partner_id FROM direct_messages WHERE receiver_id = ?)`)
      .bind(userId, userId).all<{ partner_id: string }>();
    const profile = await db.prepare("SELECT null_fields, missing_fields FROM user_auth_profile WHERE source_id = ?")
      .bind(userId).first<{ null_fields: string; missing_fields: string }>();
    const removedFields = ["email", "phone", "firebaseUid", "avatar", "avatarType", "avatarParts",
      ...["background", "clothes", "head", "mouth", "eyes", "top"].map(key => `avatarParts.${key}`),
      "bio", "vibeLine", "city", "state", "gender", "age", "interestedIn", "lookingFor",
      "profileCompletedAt", "termsAcceptedAt"];
    const nullFields = parseJsonStrings(profile?.null_fields).filter(field => !removedFields.includes(field));
    const missingFields = [...new Set([...parseJsonStrings(profile?.missing_fields), ...removedFields])];

    const tombstone = await db.batch([
      db.prepare(`UPDATE users SET deletion_requested_at = ?, name = 'Deleted User', username = ?,
        email_verified = 0, is_verified = 0, email = NULL, phone = NULL, firebase_uid = NULL,
        avatar = NULL, avatar_type = NULL, avatar_parts_background = NULL, avatar_parts_clothes = NULL,
        avatar_parts_head = NULL, avatar_parts_mouth = NULL, avatar_parts_eyes = NULL, avatar_parts_top = NULL,
        bio = NULL, vibe_line = NULL, city = NULL, state = NULL, gender = NULL, age = NULL,
        interested_in = NULL, looking_for = NULL, profile_completed_at = NULL, terms_accepted_at = NULL,
        token_version = token_version + 1, updated_at = ?
        WHERE source_id = ? AND is_blocked = 0 AND deletion_requested_at IS NULL
          AND token_version IS ?`)
        .bind(time, `deleted_${userId.toLowerCase()}`, time, userId, claims.tokenVersion ?? null),
      db.prepare(`UPDATE user_auth_profile SET null_fields = ?, missing_fields = ?, edit_token = NULL
        WHERE source_id = ?`).bind(JSON.stringify(nullFields), JSON.stringify(missingFields), userId)
    ]);
    if (!tombstone[0]?.meta.changes) throw new HttpError(409, "Account changed. Please try again.", ErrorCode.CONFLICT);

    await endD1UnavailableBonds(db, userId, "TERMINATED_BY_ACCOUNT_REMOVAL");
    await createD1AuthSessionStore(db).revokeAll(userId, started);
    await db.prepare("DELETE FROM device_tokens WHERE user_id = ?").bind(userId).run();
    try {
      await sideEffects.disconnectUser?.(userId);
      for (const { partner_id } of partners.results) {
        sideEffects.emitUser?.(partner_id, "direct:conversation:deleted", { partnerId: userId });
      }
    } catch (error) {
      console.warn("D1 account deletion realtime side effects failed", error);
    }
    if (account.firebase_uid && sideEffects.deleteFirebaseUser) {
      await sideEffects.deleteFirebaseUser(account.firebase_uid);
    }
    sendOk(res, { deletionScheduledAt: new Date(started.getTime() + 30 * 24 * 60 * 60 * 1000) });
  }));

  return router;
}
