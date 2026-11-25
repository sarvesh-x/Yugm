import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit } from "./d1AdminAuth.js";
import { createModerationAction, flagSafetyState } from "./d1AdminUsers.js";

type Row = Record<string, string | number | null>;

function key(value: string, entity: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${entity} ID`, ErrorCode.VALIDATION);
  return value.toLowerCase();
}

export function createD1AdminMessagesRouter(db: D1Database, adminJwtSecret?: string) {
  const router = Router();
  const canRead = createD1AdminGuard(db, adminJwtSecret)("messages.read");
  const canDelete = createD1AdminGuard(db, adminJwtSecret)("messages.delete");
  const canPrivate = createD1AdminGuard(db, adminJwtSecret)("messages.read_private");

  const reasonSchema = z.object({ reason: z.string().min(3).max(500) });

  router.get("/messages", canRead, asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const clauses: string[] = [];
    const params: unknown[] = [];
    const senderId = typeof req.query.senderId === "string" && req.query.senderId ? req.query.senderId.toLowerCase() : undefined;
    if (senderId) { params.push(senderId); clauses.push("sender_id = ?"); }
    const roomId = typeof req.query.roomId === "string" && req.query.roomId ? req.query.roomId.toLowerCase() : undefined;
    if (roomId) { params.push(roomId); clauses.push("room_id = ?"); }
    const keyword = typeof req.query.containsKeyword === "string" ? req.query.containsKeyword.trim() : "";
    if (keyword) { params.push(`%${keyword.toLowerCase()}%`); clauses.push("instr(lower(message), ?) > 0"); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows, total] = await Promise.all([
      db.prepare(`SELECT * FROM chat_messages ${where} ORDER BY created_at DESC, source_id DESC LIMIT ? OFFSET ?`).bind(...params, limit, skip).all<Row>(),
      db.prepare(`SELECT COUNT(*) AS count FROM chat_messages ${where}`).bind(...params).first<{ count: number }>()
    ]);
    adminOk(res, rows.results, paginationMeta(page, limit, total?.count ?? 0));
  }));

  router.get("/messages/:messageId", canRead, asyncHandler(async (req, res) => {
    const messageId = key(req.params.messageId, "message");
    const row = await db.prepare("SELECT * FROM chat_messages WHERE source_id = ?").bind(messageId).first<Row>();
    if (!row) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
    adminOk(res, row);
  }));

  router.post("/messages/:messageId/delete", canDelete, validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const messageId = key(req.params.messageId, "message");
    const row = await db.prepare("SELECT * FROM chat_messages WHERE source_id = ?").bind(messageId).first<Row>();
    if (!row) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
    const body = req.body as { reason: string };
    const time = new Date().toISOString();
    await db.prepare("UPDATE chat_messages SET message = ?, updated_at = ? WHERE source_id = ?").bind("[deleted by moderation]", time, messageId).run();
    const admin = adminFrom(res);
    await createModerationAction(db, admin.id, { actionType: "MESSAGE_DELETED", targetType: "MESSAGE", targetId: messageId, targetUserId: row.sender_id ? String(row.sender_id) : undefined, reason: body.reason });
    await insertD1AdminAudit(db, admin, { action: "message.deleted", entityType: "message", entityId: messageId, targetUserId: row.sender_id ? String(row.sender_id) : undefined, metadata: { reason: body.reason }, req });
    const updated = await db.prepare("SELECT * FROM chat_messages WHERE source_id = ?").bind(messageId).first<Row>();
    adminOk(res, { message: updated });
  }));

  router.post("/messages/:messageId/restore", canDelete, asyncHandler(async (req, res) => {
    const messageId = key(req.params.messageId, "message");
    const row = await db.prepare("SELECT * FROM chat_messages WHERE source_id = ?").bind(messageId).first<Row>();
    if (!row) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "message.restore_requested", entityType: "message", entityId: messageId, req });
    adminOk(res, { restored: false, note: "Original message bodies are not retained after moderation delete." });
  }));

  router.get("/chats/:chatId/messages", canPrivate, asyncHandler(async (req, res) => {
    const ids = req.params.chatId.split(":").map((value) => value.trim().toLowerCase()).filter(isValidObjectId);
    if (ids.length !== 2) throw new HttpError(400, "chatId must be userA:userB", ErrorCode.VALIDATION);
    const { results } = await db.prepare("SELECT * FROM direct_messages WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?) ORDER BY created_at DESC, source_id DESC LIMIT 200")
      .bind(ids[0], ids[1], ids[1], ids[0]).all<Row>();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "private_chat.viewed", entityType: "direct_chat", metadata: { chatId: req.params.chatId, count: results.length }, req });
    adminOk(res, results);
  }));

  router.post("/chats/:chatId/restrict", canDelete, validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const ids = req.params.chatId.split(":").map((value) => value.trim().toLowerCase()).filter(isValidObjectId);
    if (ids.length !== 2) throw new HttpError(400, "chatId must be userA:userB", ErrorCode.VALIDATION);
    const body = req.body as { reason: string };
    const admin = adminFrom(res);
    await Promise.all(ids.map((id) => flagSafetyState(db, id, { isChatRestricted: true }, admin.id)));
    await insertD1AdminAudit(db, admin, { action: "chat.restricted", entityType: "direct_chat", metadata: { chatId: req.params.chatId, reason: body.reason }, req });
    adminOk(res, { restricted: true });
  }));

  router.post("/chats/:chatId/unrestrict", canDelete, asyncHandler(async (req, res) => {
    const ids = req.params.chatId.split(":").map((value) => value.trim().toLowerCase()).filter(isValidObjectId);
    if (ids.length !== 2) throw new HttpError(400, "chatId must be userA:userB", ErrorCode.VALIDATION);
    const admin = adminFrom(res);
    await Promise.all(ids.map((id) => flagSafetyState(db, id, { isChatRestricted: false }, admin.id)));
    await insertD1AdminAudit(db, admin, { action: "chat.unrestricted", entityType: "direct_chat", metadata: { chatId: req.params.chatId }, req });
    adminOk(res, { restricted: false });
  }));

  return router;
}