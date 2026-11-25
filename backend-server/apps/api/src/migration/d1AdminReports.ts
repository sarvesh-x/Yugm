import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { createD1AdminGuard } from "./d1AdminAuth.js";
import { person, personJson } from "./d1People.js";
import { presentD1Report, reportQueueInsert, type ReportRow } from "./d1Reports.js";

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
  return router;
}
