import type { D1Database } from "@cloudflare/workers-types";
import type { Request } from "express";
import { Router } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit, type D1Admin } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";

const putConfigSchema = z.object({
  value: z.unknown(),
  description: z.string().max(500).optional()
});

type ConfigRow = {
  source_id: string;
  key: string;
  value: string;
  description: string | null;
  updated_by: string | null;
  created_at: string | null;
  updated_at: string | null;
};

type AuditRow = {
  source_id: string;
  admin_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  target_user_id: string | null;
  metadata: string;
  created_at: string | null;
  admin_email: string | null;
  admin_display_name: string | null;
  admin_role: string | null;
};

function configJson(row: ConfigRow) {
  return {
    _id: row.source_id,
    key: row.key,
    value: JSON.parse(row.value) as unknown,
    ...(row.description === null ? {} : { description: row.description }),
    ...(row.updated_by === null ? {} : { updatedBy: row.updated_by }),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
}

function auditJson(row: AuditRow) {
  return {
    _id: row.source_id,
    action: row.action,
    entityType: row.entity_type,
    ...(row.entity_id === null ? {} : { entityId: row.entity_id }),
    ...(row.target_user_id === null ? {} : { targetUserId: row.target_user_id }),
    metadata: JSON.parse(row.metadata) as Record<string, unknown>,
    createdAt: row.created_at ?? undefined,
    ...(row.admin_id === null ? {} : {
      adminId: {
        _id: row.admin_id,
        ...(row.admin_email === null ? {} : { email: row.admin_email }),
        ...(row.admin_display_name === null ? {} : { displayName: row.admin_display_name }),
        ...(row.admin_role === null ? {} : { role: row.admin_role })
      }
    })
  };
}

export function createD1AdminRouter(db: D1Database, adminJwtSecret?: string) {
  const router = Router();

  const guard = createD1AdminGuard(db, adminJwtSecret);

  const writeAudit = async (admin: D1Admin, input: {
    action: string;
    entityType: string;
    entityId?: string;
    targetUserId?: string;
    metadata?: Record<string, unknown>;
    req: Request;
  }) => {
    try {
      await insertD1AdminAudit(db, admin, input);
    } catch (error) {
      // Legacy config audit writes are deliberately non-fatal.
      console.warn("Admin audit log failed:", error instanceof Error ? error.message : String(error));
    }
  };

  const findConfig = (key: string) => db.prepare("SELECT * FROM app_config WHERE \"key\" = ?")
    .bind(key).first<ConfigRow>();

  router.get("/config", guard("settings.manage"), asyncHandler(async (_req, res) => {
    const { results } = await db.prepare("SELECT * FROM app_config ORDER BY \"key\", source_id").all<ConfigRow>();
    adminOk(res, results.map(configJson));
  }));

  router.get("/config/:key", guard("settings.manage"), asyncHandler(async (req, res) => {
    const row = await findConfig(req.params.key);
    adminOk(res, row ? configJson(row) : null);
  }));

  router.put("/config/:key", guard("settings.manage"), validateBody(putConfigSchema), asyncHandler(async (req, res) => {
    const admin = adminFrom(res);
    const body = req.body as { value: unknown; description?: string };
    const before = await findConfig(req.params.key);
    const time = new Date().toISOString();
    const value = JSON.stringify(body.value ?? null);
    if (before) {
      await db.prepare(`UPDATE app_config SET value = ?, description = ?, updated_by = ?, updated_at = ?
        WHERE source_id = ?`)
        .bind(value, body.description ?? null, admin.id, time, before.source_id).run();
    } else {
      await db.prepare(`INSERT INTO app_config
        (source_id, "key", value, description, updated_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)`)
        .bind(newId(), req.params.key, value, body.description ?? null, admin.id, time, time).run();
    }
    const config = configJson((await findConfig(req.params.key))!);
    await writeAudit(admin, { action: "config.changed", entityType: "app_config", entityId: config._id,
      metadata: { before, after: config }, req });
    adminOk(res, { config });
  }));

  router.delete("/config/:key", guard("settings.manage"), asyncHandler(async (req, res) => {
    const admin = adminFrom(res);
    const before = await findConfig(req.params.key);
    if (before) await db.prepare("DELETE FROM app_config WHERE source_id = ?").bind(before.source_id).run();
    await writeAudit(admin, { action: "config.deleted", entityType: "app_config",
      entityId: before?.source_id, metadata: { key: req.params.key }, req });
    adminOk(res, { deleted: Boolean(before) });
  }));

  router.get("/audit-logs", guard("audit.read"), asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const adminId = req.query.adminId === undefined || req.query.adminId === null || req.query.adminId === ""
      ? null : String(req.query.adminId);
    if (adminId && !isValidObjectId(adminId)) throw new HttpError(400, "Invalid adminId", ErrorCode.VALIDATION);
    const targetUserId = req.query.targetUserId === undefined || req.query.targetUserId === null || req.query.targetUserId === ""
      ? null : String(req.query.targetUserId);
    if (targetUserId && !isValidObjectId(targetUserId)) throw new HttpError(400, "Invalid targetUserId", ErrorCode.VALIDATION);
    const action = String(req.query.action ?? "").trim().toLowerCase();
    const entityType = String(req.query.entityType ?? "").trim();
    const where = [
      "(?1 IS NULL OR l.admin_id = ?1)",
      "(?2 = '' OR instr(lower(l.action), ?2) > 0)",
      "(?3 = '' OR l.entity_type = ?3)",
      "(?4 IS NULL OR l.target_user_id = ?4)"
    ].join(" AND ");
    const params = [adminId, action, entityType, targetUserId] as const;
    const total = await db.prepare(`SELECT COUNT(*) AS count FROM admin_audit_logs AS l WHERE ${where}`)
      .bind(...params).first<{ count: number }>();
    const { results } = await db.prepare(`SELECT l.*, a.email AS admin_email,
      a.display_name AS admin_display_name, a.role AS admin_role
      FROM admin_audit_logs AS l LEFT JOIN admin_users AS a ON a.source_id = l.admin_id
      WHERE ${where} ORDER BY l.created_at DESC, l.source_id DESC LIMIT ?5 OFFSET ?6`)
      .bind(...params, limit, skip).all<AuditRow>();
    adminOk(res, results.map(auditJson), paginationMeta(page, limit, total?.count ?? 0));
  }));

  return router;
}
