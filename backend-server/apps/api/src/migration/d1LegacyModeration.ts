import type { D1Database } from "@cloudflare/workers-types";
import { moderationActionSchema } from "@yugm/shared";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { endD1UnavailableBonds } from "./d1Bonds.js";
import { clearProfileMarkers, newId } from "./d1Cosmetics.js";
import { person, personJson } from "./d1People.js";
import { presentD1Report, type ReportRow } from "./d1Reports.js";

type Row = Record<string, string | number | null>;
const statuses = z.object({ status: z.enum(["PENDING", "REVIEWED", "ACTION_TAKEN", "DISMISSED"]),
  moderatorNote: z.string().max(500).optional() });
const userColumns = `source_id AS _id, name, username, role, is_blocked AS isBlocked, muted_until AS mutedUntil,
  suspended_until AS suspendedUntil, moderation_strikes AS moderationStrikes, moderation_reason AS moderationReason`;
const actionColumns = `a.source_id AS _id, a.target_user_id AS targetUserId, a.moderator_id AS moderatorId, a.report_id AS reportId,
  a.action, a.reason, a.duration_hours AS durationHours, a.expires_at AS expiresAt, a.automated, a.created_at AS createdAt`;
const key = (raw: string, label: string) => {
  if (!isValidObjectId(raw)) throw new HttpError(400, `Invalid ${label} ID`, ErrorCode.VALIDATION);
  return raw.toLowerCase();
};
const action = (row: Row) => ({ ...row, automated: Boolean(row.automated) });
const report = (row: ReportRow) => ({ ...presentD1Report(row), evidence: JSON.parse(row.evidence),
  riskScore: row.risk_score, autoFlagged: Boolean(row.auto_flagged), autoActionTaken: row.auto_action_taken,
  moderatorNote: row.moderator_note, reviewedBy: row.reviewed_by_admin_id ?? row.reviewed_by, reviewedAt: row.reviewed_at });

export function createD1LegacyModerationRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const moderator = asyncHandler(async (req, res, next) => {
    res.locals.legacyAdminRoute = true;
    const actor = await requireHttpSession(req.headers.authorization, access);
    if (actor.user.role !== "ADMIN" && actor.user.role !== "MODERATOR") {
      throw new HttpError(403, "Moderator role required", ErrorCode.FORBIDDEN);
    }
    res.locals.legacyClaims = actor.claims;
    next();
  });
  const requireActiveRole = `EXISTS (SELECT 1 FROM users u WHERE ${d1LiveUserFilter} AND u.role IN ('ADMIN', 'MODERATOR'))`;
  const target = (id: string) => db.prepare(`SELECT ${userColumns} FROM users WHERE source_id = ?`).bind(id).first<Row>();
  router.patch("/reports/:id", moderator, validateBody(statuses), asyncHandler(async (req, res) => {
    const id = key(req.params.id, "report");
    const claims = res.locals.legacyClaims as AccessClaims;
    const now = new Date().toISOString();
    const row = await db.prepare(`UPDATE reports SET status = ?, moderator_note = ?, reviewed_by = ?, reviewed_by_admin_id = NULL,
      reviewed_at = ?, updated_at = ? WHERE source_id = ? AND ${requireActiveRole} RETURNING *`)
      .bind(req.body.status, req.body.moderatorNote ?? null, claims.sub, now, now, id, ...bindD1LiveUser(claims, now)).first<ReportRow>();
    if (!row) throw new HttpError(404, "Report not found or access changed", ErrorCode.NOT_FOUND);
    sendOk(res, { report: report(row) });
  }));
  router.get("/moderation/actions", moderator, asyncHandler(async (req, res) => {
    const limit = Math.min(200, Math.max(1, Math.trunc(Number(req.query.limit) || 100)));
    const { results } = await db.prepare(`SELECT ${actionColumns}, ${personJson("t")} AS targetProfile,
      t.role AS targetRole, t.is_blocked AS targetBlocked, t.muted_until AS targetMutedUntil,
      t.suspended_until AS targetSuspendedUntil, t.moderation_strikes AS targetStrikes,
      CASE WHEN m.source_id IS NOT NULL THEN json_object('_id', m.source_id, 'name', m.name,
        'username', m.username, 'role', m.role) END AS moderatorProfile
      FROM moderation_actions a JOIN users t ON t.source_id = a.target_user_id LEFT JOIN users m ON m.source_id = a.moderator_id
      ORDER BY a.created_at DESC, a.source_id LIMIT ?`).bind(limit).all<Row>();
    sendOk(res, { actions: results.map(({ targetProfile, targetRole, targetBlocked, targetMutedUntil,
      targetSuspendedUntil, targetStrikes, moderatorProfile, ...row }) => ({ ...action(row),
      targetUserId: { ...person(String(targetProfile)), role: targetRole, isBlocked: Boolean(targetBlocked),
        mutedUntil: targetMutedUntil, suspendedUntil: targetSuspendedUntil, moderationStrikes: targetStrikes },
      moderatorId: moderatorProfile ? JSON.parse(String(moderatorProfile)) : null })) });
  }));
  router.get("/users/:id/moderation", moderator, asyncHandler(async (req, res) => {
    const id = key(req.params.id, "user");
    const [user, actions, reports] = await Promise.all([
      target(id),
      db.prepare(`SELECT ${actionColumns} FROM moderation_actions a WHERE a.target_user_id = ?
        ORDER BY a.created_at DESC, a.source_id LIMIT 50`).bind(id).all<Row>(),
      db.prepare("SELECT * FROM reports WHERE target_user_id = ? ORDER BY created_at DESC, source_id LIMIT 50")
        .bind(id).all<ReportRow>()
    ]);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    sendOk(res, { user: { ...user, isBlocked: Boolean(user.isBlocked) }, actions: actions.results.map(action),
      reports: reports.results.map(report) });
  }));
  router.post("/moderation/actions", moderator, validateBody(moderationActionSchema), asyncHandler(async (req, res) => {
    const claims = res.locals.legacyClaims as AccessClaims;
    const input = req.body as z.infer<typeof moderationActionSchema>;
    const targetId = input.targetUserId.toLowerCase();
    if (targetId === claims.sub) throw new HttpError(400, "You cannot moderate yourself", ErrorCode.VALIDATION);
    const reportId = input.reportId?.toLowerCase() ?? null;
    const time = new Date();
    const now = time.toISOString();
    const expires = input.durationHours ? new Date(time.valueOf() + input.durationHours * 3_600_000).toISOString() : null;
    const id = newId();
    const inserted = "EXISTS (SELECT 1 FROM moderation_actions WHERE source_id = ?)";
    const kind = input.action;
    const updates = {
      WARN: "moderation_strikes = moderation_strikes + 1",
      MUTE: "muted_until = COALESCE(?4, muted_until), moderation_strikes = moderation_strikes + 1",
      SUSPEND: "suspended_until = COALESCE(?4, suspended_until), moderation_strikes = moderation_strikes + 1",
      BAN: "is_blocked = 1, token_version = token_version + 1, moderation_strikes = moderation_strikes + 1",
      UNBAN: "is_blocked = 0, suspended_until = NULL, muted_until = NULL"
    }[kind];
    const [created] = await db.batch<Row>([
      db.prepare(`INSERT INTO moderation_actions (source_id, target_user_id, moderator_id, report_id, action, reason,
        duration_hours, expires_at, automated, created_at, updated_at)
        SELECT ?2, t.source_id, u.source_id, ?1, ?, ?, ?, ?, 0, ?, ?
        FROM users t CROSS JOIN users u WHERE t.source_id = ? AND ${d1LiveUserFilter}
        AND (u.role = 'ADMIN' OR (u.role = 'MODERATOR' AND t.role <> 'ADMIN'))
        AND (?1 IS NULL OR EXISTS (SELECT 1 FROM reports WHERE source_id = ?1 AND target_user_id = t.source_id))`)
        .bind(reportId, id, kind, input.reason, input.durationHours ?? null, expires, now, now, targetId, ...bindD1LiveUser(claims, now)),
      db.prepare(`UPDATE users SET ${updates}, moderation_reason = ?1, updated_at = ?2
        WHERE source_id = ?3 AND EXISTS (SELECT 1 FROM moderation_actions WHERE source_id = ?5)`)
        .bind(kind === "UNBAN" ? null : input.reason, now, targetId, expires, id),
      clearProfileMarkers(db, targetId, ["isBlocked", "suspendedUntil", "mutedUntil", "moderationReason", "moderationStrikes"], inserted, id),
      ...(reportId ? [db.prepare(`UPDATE reports SET status = 'ACTION_TAKEN', reviewed_by = ?, reviewed_by_admin_id = NULL,
        reviewed_at = ?, updated_at = ? WHERE source_id = ? AND ${inserted}`).bind(claims.sub, now, now, reportId, id)] : []),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, ?, 'SYSTEM', 'Moderation action', ?, ?, 0, ?, ? WHERE ${inserted}`)
        .bind(newId(), targetId, `${kind}: ${input.reason}`, JSON.stringify({ actionId: id }), now, now, id)
    ]);
    if (!created.meta.changes) {
      if (!await target(targetId)) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      throw new HttpError(403, "Moderator scope or report association is invalid", ErrorCode.FORBIDDEN);
    }
    if (kind === "BAN") await endD1UnavailableBonds(db, targetId, "TERMINATED_BY_MODERATION");
    const [entry, user] = await Promise.all([
      db.prepare(`SELECT ${actionColumns} FROM moderation_actions a WHERE a.source_id = ?`).bind(id).first<Row>(),
      target(targetId)
    ]);
    sendOk(res, { action: entry ? action(entry) : null, user: user ? { ...user, isBlocked: Boolean(user.isBlocked) } : null }, 201);
  }));
  return router;
}
