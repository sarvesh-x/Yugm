import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { inviteSchema } from "@yugm/shared";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { visiblePerson } from "./d1People.js";

const respondSchema = z.object({ accept: z.boolean() });
const id = () => randomBytes(12).toString("hex");
const participating = `EXISTS (SELECT 1 FROM room_participants
  WHERE room_id = r.source_id AND user_id = u.source_id AND left_at IS NULL)`;
const accepted = `FROM json_each(?) AS t
  JOIN notifications AS n ON n.source_id = json_extract(t.value, '$.notificationId')`;

interface InviteRow {
  source_id: string;
  room_id: string;
  inviter_id: string;
  invitee_id: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
}

function normalizedId(value: string, label: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${label} ID`, ErrorCode.VALIDATION);
  return value.toLowerCase();
}

function presentInvite(row: InviteRow) {
  return {
    _id: row.source_id, roomId: row.room_id, inviterId: row.inviter_id, inviteeId: row.invitee_id,
    status: row.status, createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

async function sendInvites(db: D1Database, claims: AccessClaims, roomId: string, userIds: string[]) {
  const time = new Date().toISOString();
  const targets = JSON.stringify(userIds.map(userId => ({
    userId, newInviteId: id(), messageId: id(), notificationId: id()
  })));
  // The notification rows claim the request. The remaining writes use those
  // exact rows so a rejected request creates no invite, message, or activity.
  const [notified, , , , rows] = await db.batch<InviteRow>([
    db.prepare(`WITH targets AS (
      SELECT json_extract(value, '$.userId') AS user_id, json_extract(value, '$.newInviteId') AS invite_id,
        json_extract(value, '$.notificationId') AS notification_id FROM json_each(?)
    ), eligible AS (
      SELECT t.* FROM targets AS t JOIN users AS peer ON peer.source_id = t.user_id
      WHERE ${visiblePerson("peer", "?2")}
    )
    INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
    SELECT t.notification_id, t.user_id, 'ROOM_INVITE', 'Room invite', u.name || ' invited you to ' || r.title,
      json_object('roomId', r.source_id, 'inviteId', COALESCE((
        SELECT existing.source_id FROM room_invites AS existing WHERE existing.room_id = r.source_id
          AND existing.inviter_id = u.source_id AND existing.invitee_id = t.user_id AND existing.status = 'PENDING'
        ORDER BY existing.created_at DESC, existing.source_id DESC LIMIT 1
      ), t.invite_id)), 0, ?, ?
    FROM rooms AS r CROSS JOIN users AS u CROSS JOIN eligible AS t
    WHERE r.source_id = ? AND r.status = 'LIVE' AND ${d1LiveUserFilter}
      AND (u.muted_until IS NULL OR u.muted_until <= ?) AND ${participating}
      AND (SELECT COUNT(*) FROM eligible) = ?`)
      .bind(targets, claims.sub, time, time, roomId, ...bindD1LiveUser(claims, time), time, userIds.length),
    db.prepare(`INSERT INTO room_invites (source_id, room_id, inviter_id, invitee_id, status, created_at, updated_at)
      SELECT json_extract(n.data, '$.inviteId'), ?, ?, n.user_id, 'PENDING', ?, ? ${accepted}
      WHERE 1 ON CONFLICT (source_id) DO UPDATE SET updated_at = excluded.updated_at`)
      .bind(roomId, claims.sub, time, time, targets),
    db.prepare(`INSERT INTO direct_messages (source_id, sender_id, receiver_id, room_id, message, media_url,
      media_type, duration, forwarded, is_edited, read, created_at, updated_at,
      reply_to_message_id, reply_to_author, reply_to_text, reply_to_media_url)
      SELECT json_extract(t.value, '$.messageId'), ?, n.user_id, ?, ?, '', '', 0, 0, 0, 0, ?, ?, '', '', '', '' ${accepted}`)
      .bind(claims.sub, roomId, `ROOM_INVITE:${roomId}`, time, time, targets),
    db.prepare(`INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at, updated_at)
      SELECT ?, ?, u.source_id, 'INVITE', u.name || ?, ?, ?, ? FROM users AS u WHERE u.source_id = ?
        AND EXISTS (SELECT 1 ${accepted})`)
      .bind(id(), roomId, ` invited ${userIds.length} ${userIds.length === 1 ? "friend" : "friends"}`,
        JSON.stringify({ inviteeIds: userIds }), time, time, claims.sub, targets),
    db.prepare(`SELECT i.* ${accepted}
      JOIN room_invites AS i ON i.source_id = json_extract(n.data, '$.inviteId') ORDER BY CAST(t.key AS INTEGER)`)
      .bind(targets)
  ]);
  return notified.meta.changes ? rows.results.map(presentInvite) : null;
}

export function createD1RoomInvitesRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.claims = (await requireHttpSession(req.headers.authorization, access)).claims;
    next();
  });

  router.post("/:id/invites", authenticate, validateBody(inviteSchema), asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    const roomId = normalizedId(req.params.id, "room");
    const { userId, userIds } = req.body as z.infer<typeof inviteSchema>;
    const recipients = [...new Set([...(userIds ?? []), ...(userId ? [userId] : [])].map(value => value.toLowerCase()))];
    if (recipients.includes(claims.sub)) throw new HttpError(400, "Cannot invite yourself", ErrorCode.VALIDATION);
    const invites = await sendInvites(db, claims, roomId, recipients);
    if (!invites) {
      await requireHttpSession(req.headers.authorization, access);
      const room = await db.prepare(`SELECT r.status, u.muted_until, ${participating} AS participating
        FROM rooms AS r CROSS JOIN users AS u WHERE r.source_id = ? AND u.source_id = ?`)
        .bind(roomId, claims.sub).first<{ status: string; muted_until: string | null; participating: number }>();
      if (room?.muted_until && Date.parse(room.muted_until) > Date.now()) {
        throw new HttpError(403, `Account muted until ${room.muted_until}`, ErrorCode.FORBIDDEN);
      }
      if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
      if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
      if (!room.participating) {
        throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
      }
      throw new HttpError(403, "Cannot invite this user", ErrorCode.FORBIDDEN);
    }
    sendOk(res, { invites }, 201);
  }));

  router.post("/invites/:inviteId/respond", authenticate, validateBody(respondSchema), asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    const key = normalizedId(req.params.inviteId, "invite");
    const accept: boolean = req.body.accept;
    const time = new Date().toISOString();
    const invite = await db.prepare(`UPDATE room_invites AS i SET status = ?, updated_at = ?
      WHERE i.source_id = ? AND i.status = 'PENDING' AND EXISTS (
        SELECT 1 FROM users AS u WHERE i.invitee_id = u.source_id AND ${d1LiveUserFilter}
      ) RETURNING room_id`).bind(accept ? "ACCEPTED" : "DECLINED", time, key, ...bindD1LiveUser(claims, time))
      .first<{ room_id: string }>();
    if (!invite) {
      await requireHttpSession(req.headers.authorization, access);
      throw new HttpError(404, "Pending room invite not found", ErrorCode.NOT_FOUND);
    }
    sendOk(res, accept ? { roomId: invite.room_id, accepted: true } : { accepted: false });
  }));
  return router;
}
