import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { validateBody } from "../middleware/validate.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit } from "./d1AdminAuth.js";
import { person, personJson } from "./d1People.js";
import { presentD1Report, reportQueueInsert, type ReportRow } from "./d1Reports.js";
import { createModerationAction, createNotification, refreshSafetyStatus } from "./d1AdminUsers.js";
import { endD1UnavailableBonds } from "./d1Bonds.js";
import { endD1Room } from "./d1Rooms.js";

type ReviewRow = ReportRow & { reporter: string | null; target: string | null; room: string | null };
type QueueRow = {
  source_id: string; report_id: string; target_type: string; target_id: string; target_user_id: string | null;
  priority: string; status: string; assigned_to: string | null; reason: string | null; ai_score: number | null;
  notes: string | null; resolved_at: string | null; resolved_by: string | null; created_at: string | null; updated_at: string | null;
};

const latest = "ORDER BY p.created_at DESC, p.source_id DESC";
const joined = `SELECT p.*, CASE WHEN reporter.source_id IS NOT NULL THEN ${personJson("reporter")} END AS reporter,
  CASE WHEN target.source_id IS NOT NULL THEN ${personJson("target")} END AS target,
  CASE WHEN r.source_id IS NOT NULL THEN json_object('_id', r.source_id, 'title', r.title, 'type', r.type, 'status', r.status) END AS room
  FROM reports AS p LEFT JOIN users AS reporter ON reporter.source_id = p.reporter_id
  LEFT JOIN users AS target ON target.source_id = p.target_user_id LEFT JOIN rooms AS r ON r.source_id = p.room_id`;

function reviewDetails(row: ReportRow) {
  return { ...presentD1Report(row), evidence: JSON.parse(row.evidence), riskScore: row.risk_score,
    autoFlagged: Boolean(row.auto_flagged), autoActionTaken: row.auto_action_taken ?? undefined,
    moderatorNote: row.moderator_note ?? undefined, reviewedBy: row.reviewed_by ?? undefined,
    reviewedAt: row.reviewed_at ?? undefined };
}

function review(row: ReviewRow) {
  return { ...reviewDetails(row), reporterId: row.reporter ? person(row.reporter) : null,
    targetUserId: row.target ? person(row.target) : undefined, roomId: row.room ? JSON.parse(row.room) : undefined };
}

function queueDetails(row: QueueRow) {
  return {
    _id: row.source_id, reportId: row.report_id, targetType: row.target_type, targetId: row.target_id,
    targetUserId: row.target_user_id ?? undefined, priority: row.priority, status: row.status,
    assignedTo: row.assigned_to ?? undefined, reason: row.reason ?? undefined, aiScore: row.ai_score ?? undefined,
    notes: row.notes ?? undefined, resolvedAt: row.resolved_at ?? undefined, resolvedBy: row.resolved_by ?? undefined,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

function key(value: string, entity: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${entity} ID`, ErrorCode.VALIDATION);
  return value.toLowerCase();
}

export function createD1AdminReportsRouter(db: D1Database, secret?: string) {
  const router = Router();
  const canRead = createD1AdminGuard(db, secret)("reports.read");
  const canResolve = createD1AdminGuard(db, secret)("reports.resolve");

  router.get("/reports", canRead, asyncHandler(async (req, res) => {
    const { page, limit } = pageParams(req.query);
    const size = Math.trunc(limit);
    const current = Math.min(Math.floor(Number.MAX_SAFE_INTEGER / 100), Math.trunc(page));
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const reason = typeof req.query.reason === "string" ? req.query.reason.trim() : null;
    const type = typeof req.query.targetType === "string" ? req.query.targetType : null;
    const where = `WHERE (?1 IS NULL OR p.status = ?1) AND (?2 IS NULL OR instr(lower(p.reason), lower(?2)) > 0)
      AND (CASE ?3 WHEN 'USER' THEN p.target_user_id IS NOT NULL WHEN 'ROOM' THEN p.room_id IS NOT NULL ELSE 1 END)`;
    const [pageRows, total] = await db.batch<ReviewRow | { count: number }>([
      db.prepare(`${joined} ${where} ${latest} LIMIT ?4 OFFSET ?5`).bind(status, reason, type, size, (current - 1) * size),
      db.prepare(`SELECT COUNT(*) AS count FROM reports AS p ${where}`).bind(status, reason, type)
    ]);
    adminOk(res, (pageRows.results as ReviewRow[]).map(review),
      paginationMeta(current, size, (total.results[0] as { count: number }).count));
  }));

  router.get("/reports/:reportId", canRead, asyncHandler(async (req, res) => {
    const id = key(req.params.reportId, "report");
    const row = await db.prepare(`${joined} WHERE p.source_id = ?`).bind(id).first<ReviewRow>();
    if (!row) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
    const [, queues, related, safety] = await db.batch<QueueRow | ReportRow | { safety_json: string }>([
      reportQueueInsert(db, randomBytes(12).toString("hex"), id, new Date().toISOString()),
      db.prepare("SELECT * FROM moderation_queues WHERE report_id = ? ORDER BY created_at, source_id LIMIT 1").bind(id),
      db.prepare(`SELECT p.* FROM reports AS p WHERE p.target_user_id = ? ${latest} LIMIT 20`).bind(row.target_user_id),
      db.prepare(`SELECT json_object('_id', source_id, 'userId', user_id, 'trustScore', trust_score, 'riskLevel', risk_level,
        'warningCount', warning_count, 'reportCount', report_count, 'suspensionCount', suspension_count,
        'isShadowBanned', json(CASE WHEN is_shadow_banned = 1 THEN 'true' ELSE 'false' END),
        'isChatRestricted', json(CASE WHEN is_chat_restricted = 1 THEN 'true' ELSE 'false' END),
        'isRoomRestricted', json(CASE WHEN is_room_restricted = 1 THEN 'true' ELSE 'false' END),
        'isWalletFrozen', json(CASE WHEN is_wallet_frozen = 1 THEN 'true' ELSE 'false' END)) AS safety_json
        FROM user_safety_statuses WHERE user_id = ? ORDER BY source_id LIMIT 1`).bind(row.target_user_id)
    ]);
    const queue = queues.results[0] as QueueRow | undefined;
    const safetyRow = safety.results[0] as { safety_json: string } | undefined;
    adminOk(res, { report: review(row), queue: queue ? queueDetails(queue) : undefined,
      related: (related.results as ReportRow[]).map(reviewDetails), safety: safetyRow ? JSON.parse(safetyRow.safety_json) : undefined });
  }));

  router.get("/users/:userId/reports", canRead, asyncHandler(async (req, res) => {
    const { results } = await db.prepare(`SELECT p.* FROM reports AS p WHERE p.target_user_id = ? ${latest} LIMIT 100`)
      .bind(key(req.params.userId, "user")).all<ReportRow>();
    adminOk(res, results.map(reviewDetails));
  }));

  router.get("/rooms/:roomId/reports", canRead, asyncHandler(async (req, res) => {
    const { results } = await db.prepare(`SELECT p.* FROM reports AS p WHERE p.room_id = ? ${latest} LIMIT 100`)
      .bind(key(req.params.roomId, "room")).all<ReportRow>();
    adminOk(res, results.map(reviewDetails));
  }));
  const reasonSchema = z.object({ reason: z.string().min(3).max(500), durationHours: z.number().int().min(1).max(8760).optional() });

  router.post("/reports/:reportId/assign", canResolve, validateBody(z.object({ adminId: z.string().optional() })), asyncHandler(async (req, res) => {
    const reportId = key(req.params.reportId, "report");
    const row = await db.prepare("SELECT * FROM reports WHERE source_id = ?").bind(reportId).first<ReportRow>();
    if (!row) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
    await reportQueueInsert(db, randomBytes(12).toString("hex"), reportId, new Date().toISOString()).run();
    const queue = await db.prepare("SELECT * FROM moderation_queues WHERE report_id = ? ORDER BY created_at, source_id LIMIT 1").bind(reportId).first<QueueRow>();
    const adminId = (req.body as { adminId?: string }).adminId || adminFrom(res).id;
    if (queue) await db.prepare("UPDATE moderation_queues SET assigned_to = ?, status = 'IN_REVIEW', updated_at = ? WHERE source_id = ?").bind(adminId, new Date().toISOString(), queue.source_id).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "report.assigned", entityType: "report", entityId: reportId, metadata: { assignedTo: adminId }, req });
    adminOk(res, { assigned: true });
  }));

  router.post("/reports/:reportId/escalate", canResolve, validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const reportId = key(req.params.reportId, "report");
    const row = await db.prepare("SELECT * FROM reports WHERE source_id = ?").bind(reportId).first<ReportRow>();
    if (!row) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
    await reportQueueInsert(db, randomBytes(12).toString("hex"), reportId, new Date().toISOString()).run();
    const queue = await db.prepare("SELECT * FROM moderation_queues WHERE report_id = ? ORDER BY created_at, source_id LIMIT 1").bind(reportId).first<QueueRow>();
    if (queue) await db.prepare("UPDATE moderation_queues SET priority = 'CRITICAL', status = 'ESCALATED', notes = ?, updated_at = ? WHERE source_id = ?").bind((req.body as { reason: string }).reason, new Date().toISOString(), queue.source_id).run();
    const admin = adminFrom(res);
    await createModerationAction(db, admin.id, { actionType: "ESCALATED", reportId, queueId: queue?.source_id, targetType: row.room_id ? "ROOM" : "USER", targetId: row.room_id ?? row.target_user_id ?? undefined, targetUserId: row.target_user_id ?? undefined, reason: (req.body as { reason: string }).reason });
    await insertD1AdminAudit(db, admin, { action: "report.escalated", entityType: "report", entityId: reportId, metadata: req.body, req });
    adminOk(res, { escalated: true });
  }));

  router.post("/reports/:reportId/dismiss", canResolve, validateBody(z.object({ reason: z.string().min(3).max(500).optional() })), asyncHandler(async (req, res) => {
    const reportId = key(req.params.reportId, "report");
    const row = await db.prepare("SELECT * FROM reports WHERE source_id = ?").bind(reportId).first<ReportRow>();
    if (!row) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    const body = req.body as { reason?: string };
    await db.prepare("UPDATE reports SET status = 'DISMISSED', reviewed_by = ?, reviewed_at = ?, moderator_note = ?, updated_at = ? WHERE source_id = ?").bind(adminFrom(res).id, time, body.reason ?? null, time, reportId).run();
    await db.prepare("UPDATE moderation_queues SET status = 'DISMISSED', resolved_at = ?, resolved_by = ?, updated_at = ? WHERE report_id = ?").bind(time, adminFrom(res).id, time, reportId).run();
    const admin = adminFrom(res);
    await createModerationAction(db, admin.id, { actionType: "REPORT_DISMISSED", reportId, targetType: "REPORT", targetId: reportId, targetUserId: row.target_user_id ?? undefined, reason: body.reason });
    await insertD1AdminAudit(db, admin, { action: "report.dismissed", entityType: "report", entityId: reportId, metadata: body, req });
    adminOk(res, { dismissed: true });
  }));

  router.post("/reports/:reportId/resolve", canResolve, validateBody(z.object({ resolution: z.string().min(2).max(80), note: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
    const reportId = key(req.params.reportId, "report");
    const row = await db.prepare("SELECT * FROM reports WHERE source_id = ?").bind(reportId).first<ReportRow>();
    if (!row) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
    const time = new Date().toISOString();
    const body = req.body as { resolution: string; note?: string };
    await db.prepare("UPDATE reports SET status = 'REVIEWED', reviewed_by = ?, reviewed_at = ?, moderator_note = ?, updated_at = ? WHERE source_id = ?").bind(adminFrom(res).id, time, body.note ?? null, time, reportId).run();
    await db.prepare("UPDATE moderation_queues SET status = 'AUTO_RESOLVED', resolved_at = ?, resolved_by = ?, updated_at = ? WHERE report_id = ?").bind(time, adminFrom(res).id, time, reportId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "report.resolved", entityType: "report", entityId: reportId, metadata: body, req });
    adminOk(res, { resolved: true });
  }));

  router.post("/reports/:reportId/action", canResolve, validateBody(z.object({ action: z.enum(["NO_ACTION", "WARNING", "DELETE_MESSAGE", "HIDE_PROFILE", "REMOVE_PHOTO", "SUSPEND_USER", "BAN_USER", "END_ROOM", "ESCALATE"]), reason: z.string().min(3).max(500), durationHours: z.number().int().min(1).max(8760).optional() })), asyncHandler(async (req, res) => {
    const reportId = key(req.params.reportId, "report");
    const row = await db.prepare("SELECT * FROM reports WHERE source_id = ?").bind(reportId).first<ReportRow>();
    if (!row) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
    await reportQueueInsert(db, randomBytes(12).toString("hex"), reportId, new Date().toISOString()).run();
    const queue = await db.prepare("SELECT * FROM moderation_queues WHERE report_id = ? ORDER BY created_at, source_id LIMIT 1").bind(reportId).first<QueueRow>();
    const body = req.body as { action: string; reason: string; durationHours?: number };
    const targetUserId = row.target_user_id ?? undefined;
    const admin = adminFrom(res);
    if (body.action === "WARNING" && targetUserId) await createNotification(db, targetUserId, "SYSTEM", "Community warning", body.reason, { reportId });
    if (body.action === "SUSPEND_USER" && targetUserId) {
      const suspendedUntil = new Date(Date.now() + (body.durationHours ?? 24) * 60 * 60 * 1000).toISOString();
      const time = new Date().toISOString();
      await db.prepare("UPDATE users SET suspended_until = ?, moderation_reason = ?, moderation_strikes = moderation_strikes + 1, updated_at = ? WHERE source_id = ?").bind(suspendedUntil, body.reason, time, targetUserId).run();
    }
    if (body.action === "BAN_USER" && targetUserId) {
      const time = new Date().toISOString();
      await db.prepare("UPDATE users SET is_blocked = 1, moderation_reason = ?, moderation_strikes = moderation_strikes + 1, token_version = token_version + 1, updated_at = ? WHERE source_id = ?").bind(body.reason, time, targetUserId).run();
      await endD1UnavailableBonds(db, targetUserId, "TERMINATED_BY_MODERATION");
    }
    if (body.action === "END_ROOM" && row.room_id) await endD1Room(db, row.room_id, new Date().toISOString());
    const time = new Date().toISOString();
    await db.prepare("UPDATE reports SET status = ?, reviewed_by = ?, reviewed_at = ?, moderator_note = ?, updated_at = ? WHERE source_id = ?")
      .bind(body.action === "NO_ACTION" ? "DISMISSED" : "ACTION_TAKEN", admin.id, time, body.reason, time, reportId).run();
    if (queue) await db.prepare("UPDATE moderation_queues SET status = ?, resolved_at = ?, resolved_by = ?, updated_at = ? WHERE source_id = ?")
      .bind(body.action === "NO_ACTION" ? "DISMISSED" : "ACTION_TAKEN", time, admin.id, time, queue.source_id).run();
    const actionType = body.action === "NO_ACTION" ? "NO_ACTION" : body.action === "WARNING" ? "WARNING_SENT" : body.action === "SUSPEND_USER" ? "USER_SUSPENDED" : body.action === "BAN_USER" ? "USER_BANNED" : body.action === "END_ROOM" ? "ROOM_ENDED" : "ESCALATED";
    await createModerationAction(db, admin.id, { actionType, reportId, queueId: queue?.source_id, targetType: row.room_id ? "ROOM" : "USER", targetId: row.room_id ?? row.target_user_id ?? undefined, targetUserId, reason: body.reason, durationHours: body.durationHours });
    if (targetUserId) await refreshSafetyStatus(db, targetUserId, admin.id);
    adminOk(res, { action: { actionType } });
  }));

  router.get("/moderation/queue", canRead, asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (typeof req.query.status === "string" && req.query.status) { params.push(req.query.status); clauses.push("status = ?"); }
    if (typeof req.query.priority === "string" && req.query.priority) { params.push(req.query.priority); clauses.push("priority = ?"); }
    const assignedTo = typeof req.query.assignedTo === "string" && req.query.assignedTo ? req.query.assignedTo.toLowerCase() : undefined;
    if (assignedTo) { params.push(assignedTo); clauses.push("assigned_to = ?"); }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const [rows, total] = await Promise.all([
      db.prepare(`SELECT * FROM moderation_queues ${where} ORDER BY CASE priority WHEN 'CRITICAL' THEN 0 WHEN 'HIGH' THEN 1 WHEN 'MEDIUM' THEN 2 ELSE 3 END, created_at DESC, source_id DESC LIMIT ? OFFSET ?`).bind(...params, limit, skip).all<QueueRow>(),
      db.prepare(`SELECT COUNT(*) AS count FROM moderation_queues ${where}`).bind(...params).first<{ count: number }>()
    ]);
    adminOk(res, rows.results.map(queueDetails), paginationMeta(page, limit, total?.count ?? 0));
  }));

  router.get("/moderation/queue/:queueId", canRead, asyncHandler(async (req, res) => {
    const queueId = key(req.params.queueId, "queue");
    const row = await db.prepare("SELECT * FROM moderation_queues WHERE source_id = ?").bind(queueId).first<QueueRow>();
    if (!row) throw new HttpError(404, "Moderation queue item not found", ErrorCode.NOT_FOUND);
    adminOk(res, queueDetails(row));
  }));

  router.post("/moderation/queue/:queueId/assign", canResolve, validateBody(z.object({ adminId: z.string().optional() })), asyncHandler(async (req, res) => {
    const queueId = key(req.params.queueId, "queue");
    const row = await db.prepare("SELECT * FROM moderation_queues WHERE source_id = ?").bind(queueId).first<QueueRow>();
    if (!row) throw new HttpError(404, "Moderation queue item not found", ErrorCode.NOT_FOUND);
    const adminId = (req.body as { adminId?: string }).adminId || adminFrom(res).id;
    const time = new Date().toISOString();
    await db.prepare("UPDATE moderation_queues SET assigned_to = ?, status = 'IN_REVIEW', updated_at = ? WHERE source_id = ?").bind(adminId, time, queueId).run();
    const updated = await db.prepare("SELECT * FROM moderation_queues WHERE source_id = ?").bind(queueId).first<QueueRow>();
    adminOk(res, { queue: updated ? queueDetails(updated) : undefined });
  }));

  router.post("/moderation/queue/:queueId/resolve", canResolve, validateBody(z.object({ status: z.enum(["ACTION_TAKEN", "DISMISSED", "AUTO_RESOLVED"]), notes: z.string().max(500).optional() })), asyncHandler(async (req, res) => {
    const queueId = key(req.params.queueId, "queue");
    const row = await db.prepare("SELECT * FROM moderation_queues WHERE source_id = ?").bind(queueId).first<QueueRow>();
    if (!row) throw new HttpError(404, "Moderation queue item not found", ErrorCode.NOT_FOUND);
    const body = req.body as { status: string; notes?: string };
    const time = new Date().toISOString();
    await db.prepare("UPDATE moderation_queues SET status = ?, notes = ?, resolved_at = ?, resolved_by = ?, updated_at = ? WHERE source_id = ?").bind(body.status, body.notes ?? null, time, adminFrom(res).id, time, queueId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "moderation_queue.resolved", entityType: "moderation_queue", entityId: queueId, metadata: body, req });
    const updated = await db.prepare("SELECT * FROM moderation_queues WHERE source_id = ?").bind(queueId).first<QueueRow>();
    adminOk(res, { queue: updated ? queueDetails(updated) : undefined });
  }));

  router.post("/moderation/queue/:queueId/escalate", canResolve, validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const queueId = key(req.params.queueId, "queue");
    const row = await db.prepare("SELECT * FROM moderation_queues WHERE source_id = ?").bind(queueId).first<QueueRow>();
    if (!row) throw new HttpError(404, "Moderation queue item not found", ErrorCode.NOT_FOUND);
    const body = req.body as { reason: string };
    const time = new Date().toISOString();
    await db.prepare("UPDATE moderation_queues SET status = 'ESCALATED', priority = 'CRITICAL', notes = ?, updated_at = ? WHERE source_id = ?").bind(body.reason, time, queueId).run();
    const admin = adminFrom(res);
    await insertD1AdminAudit(db, admin, { action: "moderation_queue.escalated", entityType: "moderation_queue", entityId: queueId, metadata: body, req });
    const updated = await db.prepare("SELECT * FROM moderation_queues WHERE source_id = ?").bind(queueId).first<QueueRow>();
    adminOk(res, { queue: updated ? queueDetails(updated) : undefined });
  }));

  return router;
}
