import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";
import { person, personJson } from "./d1People.js";
import { endD1Room, d1RoomProjection, presentD1Room } from "./d1Rooms.js";
import { createModerationAction } from "./d1AdminUsers.js";

type Row = Record<string, string | number | null>;

function key(value: string, entity: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${entity} ID`, ErrorCode.VALIDATION);
  return value.toLowerCase();
}

function parseJson(value: unknown) {
  if (typeof value !== "string" || !value) return null;
  try { return JSON.parse(value); } catch { return null; }
}

export function createD1AdminRoomsRouter(db: D1Database, adminJwtSecret?: string) {
  const router = Router();
  const canRead = createD1AdminGuard(db, adminJwtSecret)("rooms.read");
  const canEnd = createD1AdminGuard(db, adminJwtSecret)("rooms.end");
  const canFeature = createD1AdminGuard(db, adminJwtSecret)("rooms.feature");
  const canModerate = createD1AdminGuard(db, adminJwtSecret)("rooms.moderate");
  const canWallet = createD1AdminGuard(db, adminJwtSecret)("wallet.read");
  const canReports = createD1AdminGuard(db, adminJwtSecret)("reports.read");
  const canMessages = createD1AdminGuard(db, adminJwtSecret)("messages.read");

  const reasonSchema = z.object({ reason: z.string().min(3).max(500).optional() });
  const removeSchema = z.object({ userId: z.string(), reason: z.string().max(500).optional() });
  const muteSchema = z.object({ userId: z.string(), reason: z.string().max(500).optional() });
  const banSchema = z.object({ userId: z.string(), reason: z.string().max(500).optional() });
  const warningSchema = z.object({ message: z.string().min(3).max(300) });

  router.get("/rooms", canRead, asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (typeof req.query.roomType === "string" && req.query.roomType) { params.push(req.query.roomType); clauses.push("r.type = ?"); }
    if (typeof req.query.status === "string" && req.query.status) { params.push(req.query.status); clauses.push("r.status = ?"); }
    if (typeof req.query.category === "string" && req.query.category) { params.push(`%${req.query.category.toLowerCase()}%`); clauses.push("instr(lower(r.category), ?) > 0"); }
    if (typeof req.query.language === "string" && req.query.language) { params.push(`%${req.query.language.toLowerCase()}%`); clauses.push("instr(lower(r.language), ?) > 0"); }
    const hostId = typeof req.query.hostId === "string" && req.query.hostId ? req.query.hostId.toLowerCase() : undefined;
    if (hostId) { params.push(hostId); clauses.push("r.host_id = ?"); }
    const search = typeof req.query.search === "string" ? req.query.search.trim() : "";
    if (search) {
      const escaped = `%${search.toLowerCase()}%`;
      params.push(escaped, escaped, escaped);
      clauses.push("(instr(lower(r.title), ?) > 0 OR instr(lower(COALESCE(r.description, '')), ?) > 0 OR instr(lower(r.tags), ?) > 0)");
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows, total] = await Promise.all([
      db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id ${where} ORDER BY r.created_at DESC, r.source_id DESC LIMIT ? OFFSET ?`).bind(...params, limit, skip).all<Row>(),
      db.prepare(`SELECT COUNT(*) AS count FROM rooms AS r ${where}`).bind(...params).first<{ count: number }>()
    ]);
    adminOk(res, rows.results.map((row) => presentD1Room(row)), paginationMeta(page, limit, total?.count ?? 0));
  }));

  router.get("/rooms/live", canRead, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.status = 'LIVE' ORDER BY r.participant_count DESC, r.created_at DESC, r.source_id DESC LIMIT 100`).all<Row>();
    adminOk(res, results.map((row) => presentD1Room(row)));
  }));

  router.get("/rooms/:roomId", canRead, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const roomRow = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`).bind(roomId).first<Row>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const room = presentD1Room(roomRow);
    const [participants, messages, gifts, reports] = await Promise.all([
      db.prepare(`SELECT rp.*, ${personJson("u")} AS user_json FROM room_participants AS rp LEFT JOIN users AS u ON u.source_id = rp.user_id WHERE rp.room_id = ? ORDER BY rp.joined_at, rp.source_id`).bind(roomId).all<Row>(),
      db.prepare(`SELECT cm.*, ${personJson("u")} AS sender_json FROM chat_messages AS cm LEFT JOIN users AS u ON u.source_id = cm.sender_id WHERE cm.room_id = ? ORDER BY cm.created_at DESC, cm.source_id DESC LIMIT 100`).bind(roomId).all<Row>(),
      db.prepare(`SELECT gt.*, ${personJson("s")} AS sender_json, ${personJson("r")} AS receiver_json, json_object('_id', g.source_id, 'name', g.name, 'icon', g.icon, 'coinPrice', g.coin_price, 'diamondPrice', g.diamond_price) AS gift_json FROM gift_transactions AS gt LEFT JOIN users AS s ON s.source_id = gt.sender_id LEFT JOIN users AS r ON r.source_id = gt.receiver_id LEFT JOIN gifts AS g ON g.source_id = gt.gift_id WHERE gt.room_id = ? ORDER BY gt.created_at DESC, gt.source_id DESC LIMIT 100`).bind(roomId).all<Row>(),
      db.prepare("SELECT * FROM reports WHERE room_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 50").bind(roomId).all<Row>()
    ]);
    adminOk(res, {
      room,
      participants: participants.results.map((row) => ({
        _id: row.source_id, roomId: row.room_id, userId: parseJson(row.user_json), role: row.role,
        micEnabled: Boolean(row.mic_enabled), moderatorMuted: Boolean(row.moderator_muted),
        seatIndex: row.seat_index === null ? undefined : Number(row.seat_index),
        cameraEnabled: Boolean(row.camera_enabled), joinedAt: row.joined_at, leftAt: row.left_at
      })),
      messages: messages.results.map((row) => ({
        _id: row.source_id, roomId: row.room_id, senderId: parseJson(row.sender_json), message: row.message,
        type: row.type, mediaUrl: row.media_url ?? undefined, mediaType: row.media_type ?? undefined,
        createdAt: row.created_at, updatedAt: row.updated_at
      })),
      gifts: gifts.results.map((row) => ({
        _id: row.source_id, roomId: row.room_id, senderId: parseJson(row.sender_json), receiverId: parseJson(row.receiver_json),
        giftId: parseJson(row.gift_json), coinAmount: row.coin_amount, diamondAmount: row.diamond_amount, createdAt: row.created_at
      })),
      reports: reports.results
    });
  }));

  router.post("/rooms/:roomId/end", canEnd, validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const roomRow = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`).bind(roomId).first<Row>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const room = presentD1Room(roomRow);
    const body = req.body as { reason?: string };
    const ended = await endD1Room(db, roomId, new Date().toISOString());
    const admin = adminFrom(res);
    await createModerationAction(db, admin.id, { actionType: "ROOM_ENDED", targetType: "ROOM", targetId: roomId, reason: body.reason });
    await insertD1AdminAudit(db, admin, { action: "room.ended", entityType: "room", entityId: roomId, metadata: { reason: body.reason, ended }, req });
    adminOk(res, { room, ended });
  }));

  router.post("/rooms/:roomId/feature", canFeature, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const roomRow = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`).bind(roomId).first<Row>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.featured", entityType: "room", entityId: roomId, req });
    adminOk(res, { featured: true });
  }));

  router.post("/rooms/:roomId/unfeature", canFeature, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const roomRow = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`).bind(roomId).first<Row>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.unfeatured", entityType: "room", entityId: roomId, req });
    adminOk(res, { featured: false });
  }));

  router.post("/rooms/:roomId/lock", canModerate, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const roomRow = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`).bind(roomId).first<Row>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    await db.prepare("UPDATE rooms SET visibility = 'PRIVATE', updated_at = ? WHERE source_id = ?").bind(time, roomId).run();
    const updated = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`).bind(roomId).first<Row>();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.locked", entityType: "room", entityId: roomId, req });
    adminOk(res, { room: updated ? presentD1Room(updated) : presentD1Room(roomRow) });
  }));

  router.post("/rooms/:roomId/unlock", canModerate, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const roomRow = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`).bind(roomId).first<Row>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    await db.prepare("UPDATE rooms SET visibility = 'PUBLIC', updated_at = ? WHERE source_id = ?").bind(time, roomId).run();
    const updated = await db.prepare(`SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id WHERE r.source_id = ?`).bind(roomId).first<Row>();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.unlocked", entityType: "room", entityId: roomId, req });
    adminOk(res, { room: updated ? presentD1Room(updated) : presentD1Room(roomRow) });
  }));

  router.post("/rooms/:roomId/remove-user", canModerate, validateBody(removeSchema), asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const body = req.body as { userId: string; reason?: string };
    const userId = body.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid userId", ErrorCode.VALIDATION);
    const roomRow = await db.prepare("SELECT source_id FROM rooms WHERE source_id = ?").bind(roomId).first<{ source_id: string }>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    await db.prepare("UPDATE room_participants SET left_at = ?, mic_enabled = 0, camera_enabled = 0, seat_index = NULL WHERE room_id = ? AND user_id = ? AND left_at IS NULL").bind(time, roomId, userId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.user_removed", entityType: "room", entityId: roomId, targetUserId: userId, metadata: { reason: body.reason }, req });
    adminOk(res, { removed: true });
  }));

  router.post("/rooms/:roomId/mute-user", canModerate, validateBody(muteSchema), asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const body = req.body as { userId: string; reason?: string };
    const userId = body.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid userId", ErrorCode.VALIDATION);
    const roomRow = await db.prepare("SELECT source_id FROM rooms WHERE source_id = ?").bind(roomId).first<{ source_id: string }>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    const mutedUntil = new Date(Date.now() + 60 * 60 * 1000).toISOString();
    await db.prepare("UPDATE users SET muted_until = ?, moderation_reason = ?, updated_at = ? WHERE source_id = ?").bind(mutedUntil, body.reason || "Muted by room moderator", time, userId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.user_muted", entityType: "room", entityId: roomId, targetUserId: userId, metadata: { reason: body.reason }, req });
    adminOk(res, { muted: true });
  }));

  router.post("/rooms/:roomId/ban-user-from-room", canModerate, validateBody(banSchema), asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const body = req.body as { userId: string; reason?: string };
    const userId = body.userId.toLowerCase();
    if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid userId", ErrorCode.VALIDATION);
    const roomRow = await db.prepare("SELECT source_id FROM rooms WHERE source_id = ?").bind(roomId).first<{ source_id: string }>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    await db.prepare("UPDATE room_participants SET left_at = ?, mic_enabled = 0, camera_enabled = 0, seat_index = NULL WHERE room_id = ? AND user_id = ? AND left_at IS NULL").bind(time, roomId, userId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.user_banned", entityType: "room", entityId: roomId, targetUserId: userId, metadata: { reason: body.reason }, req });
    adminOk(res, { banned: true });
  }));

  router.get("/rooms/:roomId/participants", canRead, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const { results } = await db.prepare(`SELECT rp.*, ${personJson("u")} AS user_json FROM room_participants AS rp LEFT JOIN users AS u ON u.source_id = rp.user_id WHERE rp.room_id = ? ORDER BY rp.joined_at, rp.source_id`).bind(roomId).all<Row>();
    adminOk(res, results.map((row) => ({
      _id: row.source_id, roomId: row.room_id, userId: parseJson(row.user_json), role: row.role,
      micEnabled: Boolean(row.mic_enabled), moderatorMuted: Boolean(row.moderator_muted),
      seatIndex: row.seat_index === null ? undefined : Number(row.seat_index),
      cameraEnabled: Boolean(row.camera_enabled), joinedAt: row.joined_at, leftAt: row.left_at
    })));
  }));

  router.get("/rooms/:roomId/messages", canMessages, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const { results } = await db.prepare(`SELECT cm.*, ${personJson("u")} AS sender_json FROM chat_messages AS cm LEFT JOIN users AS u ON u.source_id = cm.sender_id WHERE cm.room_id = ? ORDER BY cm.created_at DESC, cm.source_id DESC LIMIT 200`).bind(roomId).all<Row>();
    adminOk(res, results.map((row) => ({
      _id: row.source_id, roomId: row.room_id, senderId: parseJson(row.sender_json), message: row.message, type: row.type,
      mediaUrl: row.media_url ?? undefined, mediaType: row.media_type ?? undefined, createdAt: row.created_at, updatedAt: row.updated_at
    })));
  }));

  router.get("/rooms/:roomId/gifts", canWallet, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const { results } = await db.prepare(`SELECT gt.*, ${personJson("s")} AS sender_json, ${personJson("r")} AS receiver_json, json_object('_id', g.source_id, 'name', g.name, 'icon', g.icon, 'coinPrice', g.coin_price, 'diamondPrice', g.diamond_price) AS gift_json FROM gift_transactions AS gt LEFT JOIN users AS s ON s.source_id = gt.sender_id LEFT JOIN users AS r ON r.source_id = gt.receiver_id LEFT JOIN gifts AS g ON g.source_id = gt.gift_id WHERE gt.room_id = ? ORDER BY gt.created_at DESC, gt.source_id DESC LIMIT 200`).bind(roomId).all<Row>();
    adminOk(res, results.map((row) => ({
      _id: row.source_id, roomId: row.room_id, senderId: parseJson(row.sender_json), receiverId: parseJson(row.receiver_json),
      giftId: parseJson(row.gift_json), coinAmount: row.coin_amount, diamondAmount: row.diamond_amount, createdAt: row.created_at
    })));
  }));

  router.get("/rooms/:roomId/reports", canReports, asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const { results } = await db.prepare("SELECT * FROM reports WHERE room_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 100").bind(roomId).all<Row>();
    adminOk(res, results);
  }));

  router.post("/live/rooms/:roomId/warning", canModerate, validateBody(warningSchema), asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const roomRow = await db.prepare("SELECT source_id FROM rooms WHERE source_id = ?").bind(roomId).first<{ source_id: string }>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const body = req.body as { message: string };
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.warning_sent", entityType: "room", entityId: roomId, metadata: { message: body.message }, req });
    adminOk(res, { sent: true });
  }));

  router.post("/live/rooms/:roomId/escalate", canModerate, validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const roomId = key(req.params.roomId, "room");
    const roomRow = await db.prepare("SELECT source_id FROM rooms WHERE source_id = ?").bind(roomId).first<{ source_id: string }>();
    if (!roomRow) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const body = req.body as { reason: string };
    const time = new Date().toISOString();
    await db.prepare(`INSERT INTO moderation_queues (source_id, report_id, target_type, target_id, target_user_id, priority, status, reason, ai_score, created_at, updated_at)
      VALUES (?, NULL, 'ROOM', ?, NULL, 'CRITICAL', 'ESCALATED', ?, NULL, ?, ?)`).bind(newId(), roomId, body.reason, time, time).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "room.escalated", entityType: "room", entityId: roomId, metadata: { reason: body.reason }, req });
    adminOk(res, { escalated: true });
  }));

  return router;
}