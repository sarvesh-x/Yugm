import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import type { AccessClaims } from "../services/accessSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";

interface InboxRow {
  source_id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  data: string | null;
  read: number;
  created_at: string | null;
  updated_at: string | null;
}

function presentNotification(row: InboxRow) {
  return {
    _id: row.source_id, userId: row.user_id, type: row.type, title: row.title, body: row.body,
    data: row.data === null ? undefined : JSON.parse(row.data), read: Boolean(row.read),
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

export function createD1NotificationRouter(db: D1Database) {
  const router = Router();
  const readAccess = createD1AccessSessionReader(db, "http");
  const currentSession = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter})`;
  router.use(asyncHandler(async (req, res, next) => {
    res.locals.claims = (await requireHttpSession(req.headers.authorization, readAccess)).claims;
    next();
  }));

  router.get("/", asyncHandler(async (req, res) => {
    const { sub } = res.locals.claims as AccessClaims;
    const limit = Math.trunc(Math.min(Math.max(Number(req.query.limit) || 50, 1), 100));
    const [items, unread] = await db.batch<InboxRow | { total: number }>([
      db.prepare("SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT ?").bind(sub, limit),
      db.prepare("SELECT COUNT(*) AS total FROM notifications WHERE user_id = ? AND read = 0").bind(sub)
    ]);
    sendOk(res, { notifications: (items.results as InboxRow[]).map(presentNotification),
      unreadCount: (unread.results[0] as { total: number }).total });
  }));

  function markRead(claims: AccessClaims, id: string) {
    const time = new Date().toISOString();
    return db.prepare(`UPDATE notifications SET read = 1, updated_at = ? WHERE user_id = ? AND source_id = ?
      AND ${currentSession} RETURNING *`).bind(time, claims.sub, id.toLowerCase(), ...bindD1LiveUser(claims, time)).first<InboxRow>();
  }

  router.patch("/:id/read", asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    const row = await markRead(res.locals.claims, req.params.id);
    if (!row) throw new HttpError(404, "Notification not found", ErrorCode.NOT_FOUND);
    sendOk(res, { notification: presentNotification(row) });
  }));

  router.post("/read-all", asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    const time = new Date().toISOString();
    const result = await db.prepare(`UPDATE notifications SET read = 1, updated_at = ?
      WHERE user_id = ? AND read = 0 AND ${currentSession}`).bind(time, claims.sub, ...bindD1LiveUser(claims, time)).run();
    if (!result.meta.changes) await requireHttpSession(req.headers.authorization, readAccess);
    sendOk(res, { success: true });
  }));

  router.post("/track/:notificationId/click", asyncHandler(async (req, res) => {
    const id = req.params.notificationId;
    if (!isValidObjectId(id)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    sendOk(res, { tracked: Boolean(await markRead(res.locals.claims, id)) });
  }));

  return router;
}
