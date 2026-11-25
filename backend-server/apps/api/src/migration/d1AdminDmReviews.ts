import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";
import { person, personJson } from "./d1People.js";

type Row = Record<string, string | number | null>;
const notes = z.object({ adminNotes: z.string().max(2000).optional() });
const display = `SELECT q.*, CASE WHEN u.source_id IS NOT NULL THEN ${personJson("u")} END AS user_profile,
  a.display_name AS resolver, r.reason AS report_reason, r.status AS report_status
  FROM moderation_queues q LEFT JOIN users u ON u.source_id = q.target_user_id
  LEFT JOIN admin_users a ON a.source_id = q.resolved_by LEFT JOIN reports r ON r.source_id = q.report_id`;
const association = `((q.target_type = 'MESSAGE' AND q.target_id = m.source_id)
  OR (q.target_type = 'CHAT' AND length(q.target_id) = 49 AND substr(q.target_id, 25, 1) = ':'
    AND ((m.sender_id = substr(q.target_id, 1, 24) AND m.receiver_id = substr(q.target_id, 26))
      OR (m.receiver_id = substr(q.target_id, 1, 24) AND m.sender_id = substr(q.target_id, 26)))))
  AND q.target_user_id IN (m.sender_id, m.receiver_id)`;
const placeholder = () => new HttpError(404, "DM review not found", ErrorCode.NOT_FOUND);
const key = (raw: string, label: string) => {
  if (!isValidObjectId(raw)) throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
  return raw.toLowerCase();
};
const queueView = (row: Row) => ({
  _id: row.source_id, reportId: row.report_id ? { _id: row.report_id, reason: row.report_reason,
    status: row.report_status } : null, targetType: row.target_type, targetId: row.target_id,
  targetUserId: row.user_profile ? person(String(row.user_profile)) : null,
  reason: row.reason, priority: row.priority, status: row.status, notes: row.notes, aiScore: row.ai_score,
  resolvedAt: row.resolved_at, resolvedBy: row.resolver ? { _id: row.resolved_by, displayName: row.resolver } : null,
  createdAt: row.created_at, updatedAt: row.updated_at
});

export function createD1AdminDmReviewsRouter(db: D1Database, secret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const canRead = guard("messages.read_private");
  const canRemove = guard("messages.delete");
  const lookup = (id: string) => db.prepare(`${display} WHERE q.source_id = ? AND q.target_type IN ('MESSAGE', 'CHAT')`)
    .bind(id).first<Row>();
  const finding = (queueId: string) => db.prepare(`SELECT m.sender_id, m.receiver_id FROM direct_messages m
    JOIN moderation_queues q ON q.source_id = ? WHERE ${association} ORDER BY m.created_at DESC, m.source_id LIMIT 1`)
    .bind(queueId).first<{ sender_id: string; receiver_id: string }>();
  const wipe = (match: string, args: string[]) => [
    db.prepare(`DELETE FROM direct_message_reactions WHERE direct_messages_id IN (${match})`).bind(...args),
    db.prepare(`DELETE FROM message_hidden_for WHERE direct_messages_id IN (${match})`).bind(...args),
    db.prepare(`UPDATE direct_messages SET reply_to_message_id = '', reply_to_author = '', reply_to_author_id = NULL,
      reply_to_text = '', reply_to_media_url = '' WHERE reply_to_message_id IN (${match})`).bind(...args),
    db.prepare(`DELETE FROM direct_messages WHERE source_id IN (${match})`).bind(...args)
  ];

  router.get("/dm-reviews", canRead, asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const condition = "WHERE q.target_type IN ('MESSAGE','CHAT') AND (?1 IS NULL OR q.status = ?1)";
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : null;
    const [items, counts, previews] = await db.batch<Row>([
      db.prepare(`${display} ${condition} ORDER BY q.created_at DESC, q.source_id LIMIT ?2 OFFSET ?3`).bind(status, limit, skip),
      db.prepare(`SELECT COUNT(*) AS total FROM moderation_queues q ${condition}`).bind(status),
      db.prepare(`WITH selected AS (SELECT q.* FROM moderation_queues q ${condition}
        ORDER BY q.created_at DESC, q.source_id LIMIT ?2 OFFSET ?3)
        SELECT q.source_id, (SELECT json_object('_id', m.source_id, 'message', m.message, 'createdAt', m.created_at)
          FROM direct_messages m WHERE ${association} ORDER BY m.created_at DESC, m.source_id LIMIT 1) AS preview FROM selected q`)
        .bind(status, limit, skip)
    ]);
    const byId = new Map(previews.results.map(row => [row.source_id, row.preview ? JSON.parse(String(row.preview)) as unknown : null]));
    await insertD1AdminAudit(db, adminFrom(res), { action: "dm_reviews.list", entityType: "moderation_queue",
      metadata: { status, count: items.results.length }, req });
    adminOk(res, { dmReviews: items.results.map(row => ({ ...queueView(row), message: byId.get(row.source_id) ?? null })) },
      paginationMeta(page, limit, Number(counts.results[0]?.total ?? 0)));
  }));
  router.get("/dm-reviews/:queueId", canRead, asyncHandler(async (req, res) => {
    const id = key(req.params.queueId, "queueId");
    const queue = await lookup(id);
    if (!queue) throw placeholder();
    const { results } = await db.prepare(`SELECT m.source_id AS _id, m.sender_id AS sender_id, m.receiver_id AS receiver_id,
      ${personJson("sender")} AS sender, ${personJson("receiver")} AS receiver, m.message,
      m.media_url AS mediaUrl, m.media_type AS mediaType, m.duration, m.created_at AS createdAt FROM direct_messages m
      JOIN users sender ON sender.source_id = m.sender_id JOIN users receiver ON receiver.source_id = m.receiver_id
      JOIN moderation_queues q ON q.source_id = ? WHERE ${association}
      ORDER BY m.created_at DESC, m.source_id LIMIT 100`).bind(id).all<Row>();
    const sample = results[0];
    const partnerId = sample ? (sample.sender_id === queue.target_user_id ? sample.receiver_id : sample.sender_id) : "";
    await insertD1AdminAudit(db, adminFrom(res), { action: "dm_reviews.view", entityType: "moderation_queue", entityId: id,
      targetUserId: queue.target_user_id ? String(queue.target_user_id) : undefined, req });
    adminOk(res, { dmReview: queueView(queue), messages: results.map(({ sender, receiver, sender_id, receiver_id, ...item }) => ({
      ...item, senderId: person(String(sender)), receiverId: person(String(receiver))
    })), partnerId });
  }));

  const resolve = (restrict: boolean) => asyncHandler(async (req, res) => {
    const id = key(req.params.queueId, "queueId");
    const queue = await lookup(id);
    if (!queue) throw placeholder();
    const status = restrict ? "ACTION_TAKEN" : "DISMISSED";
    const partner = restrict && queue.status !== status ? await finding(id) : null;
    if (restrict && queue.status !== status && !partner) throw new HttpError(409, "Review has no linked conversation", ErrorCode.CONFLICT);
    const admin = adminFrom(res);
    const now = new Date().toISOString();
    const auditId = newId();
    const [resolved] = await db.batch<Row>([
      db.prepare(`UPDATE moderation_queues SET status = ?, resolved_at = ?, resolved_by = ?, updated_at = ?, notes = COALESCE(?, notes)
        WHERE source_id = ? AND status IN ('PENDING', 'IN_REVIEW', 'ESCALATED') AND target_id = ?
        RETURNING *`).bind(status, now, admin.id, now, req.body.adminNotes ?? null, id, queue.target_id),
      prepareD1AdminAudit(db, admin, { auditId, action: restrict ? "dm_reviews.restrict" : "dm_reviews.dismiss",
        entityType: "moderation_queue", entityId: id, targetUserId: queue.target_user_id ? String(queue.target_user_id) : undefined, req }, true),
      db.prepare(`UPDATE reports SET status = ?, reviewed_at = ?, reviewed_by_admin_id = ?, reviewed_by = NULL, moderator_note = ?, updated_at = ?
        WHERE source_id = ? AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE source_id = ?)`)
        .bind(status, now, admin.id, req.body.adminNotes ?? null, now, queue.report_id, auditId),
      ...(partner ? wipe(`SELECT source_id FROM direct_messages WHERE
        ((sender_id = ?1 AND receiver_id = ?2) OR (sender_id = ?2 AND receiver_id = ?1))
        AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE source_id = ?3)`,
      [partner.sender_id, partner.receiver_id, auditId]) : [])
    ]);
    const row = resolved.results[0] ?? await lookup(id);
    if (!row || row.status !== status) throw new HttpError(409, "DM review is already resolved", ErrorCode.CONFLICT);
    const presented = queueView({ ...queue, ...row });
    adminOk(res, { dmReview: presented, ...(restrict ? { restricted: true } : {}) });
  });
  router.post("/dm-reviews/:queueId/dismiss", guard("reports.resolve"), validateBody(notes), resolve(false));
  router.post("/dm-reviews/:queueId/restrict", canRemove, validateBody(notes), resolve(true));

  router.post("/dm-reviews/:queueId/delete-message/:messageId", canRemove, validateBody(notes), asyncHandler(async (req, res) => {
    const queueId = key(req.params.queueId, "queueId");
    const messageId = key(req.params.messageId, "messageId");
    const admin = adminFrom(res);
    const now = new Date().toISOString();
    const actionId = newId();
    const [action] = await db.batch([
      db.prepare(`INSERT INTO admin_moderation_actions (source_id, admin_id, queue_id, report_id, target_type,
        target_id, target_user_id, action_type, reason, metadata, created_at, updated_at) SELECT ?1, ?2, q.source_id, q.report_id,
        'MESSAGE', m.source_id, m.sender_id, 'MESSAGE_DELETED', ?3, '{}', ?4, ?4 FROM direct_messages m
        JOIN moderation_queues q ON q.source_id = ?5 WHERE m.source_id = ?6 AND ${association}`)
        .bind(actionId, admin.id, req.body.adminNotes ?? "Removed during DM review", now, queueId, messageId),
      prepareD1AdminAudit(db, admin, { action: "dm_reviews.delete_message", entityType: "direct_message", entityId: messageId,
        metadata: { queueId }, req }, true),
      ...wipe(`SELECT target_id FROM admin_moderation_actions WHERE source_id = ?`, [actionId])
    ]);
    if (!action.meta.changes) throw new HttpError(404, "Message is outside this review or no longer exists", ErrorCode.NOT_FOUND);
    adminOk(res, { deleted: true, messageId });
  }));
  router.post("/dm-reviews/:queueId/warn-user", guard("users.suspend"),
    validateBody(notes.extend({ reason: z.string().min(2).max(500) })), asyncHandler(async (req, res) => {
      const queueId = key(req.params.queueId, "queueId");
      const queue = await lookup(queueId);
      if (!queue) throw placeholder();
      if (!queue.target_user_id) throw new HttpError(400, "No target user for this review", ErrorCode.VALIDATION);
      const userId = String(queue.target_user_id);
      const admin = adminFrom(res);
      const now = new Date().toISOString();
      const reason = req.body.reason;
      await db.batch([
        db.prepare(`INSERT INTO moderation_actions (source_id, target_user_id, moderator_id, report_id,
          action, reason, automated, created_at, updated_at) SELECT ?, ?, user_id, ?, 'WARN', ?, 0, ?, ?
          FROM admin_users WHERE source_id = ?`).bind(newId(), userId, queue.report_id, reason, now, now, admin.id),
        db.prepare(`INSERT INTO admin_moderation_actions (source_id, admin_id, queue_id, report_id, target_type,
          target_user_id, action_type, reason, metadata, created_at, updated_at)
          VALUES (?, ?, ?, ?, 'USER', ?, 'WARNING_SENT', ?, ?, ?, ?)`)
          .bind(newId(), admin.id, queueId, queue.report_id, userId, reason, JSON.stringify({ adminNotes: req.body.adminNotes }), now, now),
        prepareD1AdminAudit(db, admin, { action: "dm_reviews.warn_user", entityType: "moderation_queue", entityId: queueId,
          targetUserId: userId, metadata: { reason }, req })
      ]);
      adminOk(res, { warned: true, userId });
    }));
  return router;
}
