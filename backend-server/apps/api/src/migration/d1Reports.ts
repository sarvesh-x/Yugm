import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { reportBaseSchema, reportSchema } from "@yugm/shared";
import { Router } from "express";
import type { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { clearProfileMarkers } from "./d1Cosmetics.js";
import { roomAccessFor } from "./d1RoomAccess.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

const id = () => randomBytes(12).toString("hex");
const roomReport = reportBaseSchema.omit({ roomId: true });
const muteReason = "Auto-muted after multiple unique reports in 24 hours";
const muteHours = 12;
const hourMs = 3_600_000;

export interface ReportRow {
  source_id: string; reporter_id: string; target_user_id: string | null; room_id: string | null;
  reason: string; description: string | null; evidence: string; risk_score: number;
  auto_flagged: number; auto_action_taken: string | null; moderator_note: string | null;
  reviewed_by: string | null; reviewed_by_admin_id?: string | null; reviewed_at: string | null; status: string;
  created_at: string | null;
}

export function presentD1Report(row: ReportRow) {
  return {
    _id: row.source_id, reporterId: row.reporter_id, targetUserId: row.target_user_id ?? undefined,
    roomId: row.room_id ?? undefined, reason: row.reason, description: row.description ?? undefined,
    status: row.status, createdAt: row.created_at ?? undefined
  };
}

export function reportQueueInsert(db: D1Database, queueId: string, reportId: string, time: string) {
  return db.prepare(`INSERT INTO moderation_queues (source_id, report_id, target_type, target_id, target_user_id,
      priority, status, reason, ai_score, created_at, updated_at)
    SELECT ?, p.source_id, CASE WHEN p.room_id IS NULL THEN 'USER' ELSE 'ROOM' END,
      COALESCE(p.room_id, p.target_user_id), p.target_user_id,
      CASE WHEN p.risk_score >= 80 THEN 'CRITICAL' WHEN p.risk_score >= 50 THEN 'HIGH' ELSE 'MEDIUM' END,
      'PENDING', p.reason, p.risk_score, ?, ? FROM reports AS p WHERE p.source_id = ?
      AND COALESCE(p.room_id, p.target_user_id) IS NOT NULL
      AND NOT EXISTS (SELECT 1 FROM moderation_queues WHERE report_id = p.source_id)`).bind(queueId, time, time, reportId);
}

async function createReport(db: D1Database, claims: AccessClaims, input: z.infer<typeof reportBaseSchema>) {
  const target = input.targetUserId?.toLowerCase() ?? null;
  const room = input.roomId?.toLowerCase() ?? null;
  if (target === claims.sub) throw new HttpError(400, "You cannot report yourself", ErrorCode.VALIDATION);
  const now = new Date();
  const time = now.toISOString();
  const since = new Date(now.getTime() - 24 * hourMs).toISOString();
  const expires = new Date(now.getTime() + muteHours * hourMs).toISOString();
  const key = id();
  const actionId = id();
  const insertedAction = "EXISTS (SELECT 1 FROM moderation_actions WHERE source_id = ?)";
  const statements = [
    db.prepare(`WITH room_messages AS (
        SELECT sender_id, message, created_at FROM chat_messages WHERE room_id = ?2
        ORDER BY created_at DESC, source_id DESC LIMIT 20
      ), direct_messages_for_report AS (
        SELECT sender_id, receiver_id, message, created_at FROM direct_messages
        WHERE created_at >= ?4 AND ((sender_id = ?3 AND receiver_id = ?1) OR (sender_id = ?1 AND receiver_id = ?3))
        ORDER BY created_at DESC, source_id DESC LIMIT 20
      ), counts AS (
        SELECT 1 + (SELECT COUNT(DISTINCT reporter_id) FROM reports WHERE target_user_id = ?1
          AND reporter_id <> ?3 AND created_at >= ?4) AS reporters,
          (SELECT COUNT(*) FROM room_messages) + (SELECT COUNT(*) FROM direct_messages_for_report) AS messages
      )
      INSERT INTO reports (source_id, reporter_id, target_user_id, room_id, reason, description, evidence, risk_score,
        auto_flagged, status, created_at)
      SELECT ?5, u.source_id, ?1, ?2, ?6, ?7,
        json_object('recentUniqueReporterCount', counts.reporters,
          'roomMessages', json((SELECT json_group_array(json_object('senderId', sender_id, 'message', message, 'createdAt', created_at))
            FROM (SELECT * FROM room_messages ORDER BY created_at))),
          'directMessages', json((SELECT json_group_array(json_object('senderId', sender_id, 'receiverId', receiver_id,
            'message', message, 'createdAt', created_at)) FROM (SELECT * FROM direct_messages_for_report ORDER BY created_at)))),
        counts.reporters * 25 + MIN(counts.messages, 20), counts.reporters * 25 + MIN(counts.messages, 20) >= 75, 'PENDING', ?8
      FROM users AS u CROSS JOIN counts
      WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL
        AND (?1 IS NULL OR EXISTS (SELECT 1 FROM users WHERE source_id = ?1))
        AND (?2 IS NULL OR EXISTS (SELECT 1 FROM rooms AS r WHERE r.source_id = ?2 AND (${roomAccessFor("?3")})))`)
      .bind(target, room, claims.sub, since, key, input.reason, input.description ?? null, time, ...bindD1LiveUser(claims, time)),
    db.prepare(`INSERT INTO moderation_actions (source_id, target_user_id, report_id, action, reason,
        duration_hours, expires_at, automated, created_at, updated_at)
      SELECT ?, u.source_id, p.source_id, 'MUTE', ?, ?, ?, 1, ?, ?
      FROM reports AS p JOIN users AS u ON u.source_id = p.target_user_id WHERE p.source_id = ?
        AND json_extract(p.evidence, '$.recentUniqueReporterCount') >= 3 AND (u.muted_until IS NULL OR u.muted_until <= ?)`)
      .bind(actionId, muteReason, muteHours, expires, time, time, key, time),
    db.prepare(`UPDATE users SET muted_until = ?, moderation_reason = ?, moderation_strikes = moderation_strikes + 1, updated_at = ?
      WHERE source_id = ? AND ${insertedAction}`).bind(expires, muteReason, time, target, actionId),
    db.prepare(`UPDATE reports SET status = 'ACTION_TAKEN', auto_action_taken = 'MUTE_12H'
      WHERE source_id = ? AND ${insertedAction}`).bind(key, actionId),
    db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
      SELECT ?, target_user_id, 'SYSTEM', 'Account muted',
        'You were muted for 12 hours after multiple reports. Keep chats respectful.', json_object('reportId', report_id), 0, ?, ?
      FROM moderation_actions WHERE source_id = ?`).bind(id(), time, time, actionId),
    reportQueueInsert(db, id(), key, time)
  ];
  if (target) statements.push(clearProfileMarkers(db, target,
    ["mutedUntil", "moderationReason", "moderationStrikes"], insertedAction, actionId));
  const results = await db.batch<ReportRow>([
    ...statements, db.prepare("SELECT * FROM reports WHERE source_id = ?").bind(key)
  ]);
  return results.at(-1)?.results[0];
}

export function createD1ReportsRouter(db: D1Database, allowReports?: D1UserRateLimit) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    await enforceD1UserRateLimit(allowReports, claims.sub, res, 60);
    res.locals.claims = claims;
    next();
  });
  const submit = asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    const payload = req.body as z.infer<typeof reportBaseSchema>;
    if (req.params.id !== undefined) {
      if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
      payload.roomId = req.params.id;
    }
    const report = await createReport(db, claims, payload);
    if (!report) {
      await requireHttpSession(req.headers.authorization, access);
      if (payload.targetUserId && !await db.prepare("SELECT 1 FROM users WHERE source_id = ?")
        .bind(payload.targetUserId.toLowerCase()).first()) {
        throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      }
      if (payload.roomId) {
        const row = await db.prepare(`SELECT (${roomAccessFor("?2")}) AS can_read FROM rooms AS r WHERE r.source_id = ?1`)
          .bind(payload.roomId.toLowerCase(), claims.sub).first<{ can_read: number }>();
        if (!row) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
        if (!row.can_read) throw new HttpError(403, "This private room is invite only", ErrorCode.FORBIDDEN);
      }
      throw new HttpError(409, "Report could not be submitted. Please try again.", ErrorCode.CONFLICT);
    }
    sendOk(res, { report: presentD1Report(report) }, 201);
  });
  router.post("/reports", authenticate, validateBody(reportSchema), submit);
  router.post("/rooms/:id/report", authenticate, validateBody(roomReport), submit);
  return router;
}
