import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk } from "../modules/admin/http.js";
import { adminPermissions, adminRoles, permissionsFor } from "../modules/admin/permissions.js";
import type { AuthRateLimiters } from "../routes/authSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, prepareD1AdminAudit, requireD1Admin } from "./d1AdminAuth.js";
import { hashAdminToken, provisionAdminPassword } from "./d1AdminCredentials.js";
import { adminAccountQuery, getAdminAccount, publicAdminAccount, type AdminAccount, type AdminSessionConfig } from "./d1AdminSessions.js";
import { newId } from "./d1Cosmetics.js";

const adminSchema = z.object({
  email: z.string().trim().email().max(254), displayName: z.string().trim().min(2).max(120),
  role: z.enum(adminRoles), permissions: z.array(z.enum(adminPermissions)).max(adminPermissions.length).optional(),
  firebaseUid: z.string().trim().min(1).max(128).optional(), password: z.string().min(8).max(256).optional()
});
const adminUpdate = adminSchema.pick({ displayName: true, role: true, permissions: true }).partial().extend({
  status: z.enum(["ACTIVE", "SUSPENDED", "DISABLED", "INVITED"]).optional()
});
const missingAccount = () => new HttpError(404, "Admin account not found", ErrorCode.NOT_FOUND);
const duplicateAccount = () => new HttpError(409, "Admin email or Firebase account already exists", ErrorCode.CONFLICT);

export function createD1AdminAccountsRouter(db: D1Database, rates: AuthRateLimiters, config: AdminSessionConfig) {
  const router = Router();
  const settings = createD1AdminGuard(db, config.jwtSecret)("settings.manage");
  const requireSuperAdmin = asyncHandler(async (req, res, next) => {
    const admin = await requireD1Admin(db, req.headers.authorization, config.jwtSecret);
    if (!admin.isSuperAdmin && admin.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "Super admin access required", ErrorCode.FORBIDDEN);
    }
    res.locals.d1Admin = admin;
    next();
  });
  // Write permissions through one SQL statement so replacement never partially succeeds.
  const writePermissions = (id: string, permissions: string[]) => db.prepare(`INSERT INTO admin_role_permissions
    (source_id, admin_users_id, position, value) SELECT ?1 || ':permissions:' || key, ?1, key, value FROM json_each(?2)
    WHERE EXISTS (SELECT 1 FROM admin_users WHERE source_id = ?1)`).bind(id, JSON.stringify([...new Set(permissions)]));

  async function createAccount(req: Request, creatorId: string, invite: boolean) {
    const body = req.body as z.infer<typeof adminSchema>;
    const email = body.email.toLowerCase();
    const id = newId();
    if (await db.prepare("SELECT 1 FROM admin_users WHERE lower(email) = ? OR firebase_uid = ?")
      .bind(email, body.firebaseUid ?? null).first()) throw duplicateAccount();
    if (config.production && body.firebaseUid && body.password) {
      throw new HttpError(422, "Provide a Firebase UID or a password for a new Firebase account", ErrorCode.VALIDATION);
    }
    const credentials = body.password ? await provisionAdminPassword(config, id, email, body.password) : null;
    const firebaseUid = body.firebaseUid ?? credentials?.firebaseUid ?? null;
    const invitationToken = !firebaseUid && !credentials?.passwordHash ? randomBytes(32).toString("base64url") : undefined;
    const time = new Date();
    const [created] = await db.batch<AdminAccount>([
      db.prepare(`INSERT INTO admin_users (source_id, email, display_name, role, status, is_super_admin, two_factor_enabled,
        password_hash, firebase_uid, invitation_token_hash, invitation_expires_at, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING RETURNING *`)
        .bind(id, email, body.displayName, body.role, invitationToken ? "INVITED" : "ACTIVE", Number(body.role === "SUPER_ADMIN"),
          credentials?.passwordHash ?? null, firebaseUid, invitationToken ? hashAdminToken(invitationToken) : null,
          invitationToken ? new Date(time.getTime() + 72 * 3_600_000).toISOString() : null, creatorId, time.toISOString(), time.toISOString()),
      prepareD1AdminAudit(db, { id: creatorId }, { action: invite ? "admin.invite" : "admin_user.created",
        entityType: "admin_user", entityId: id, metadata: { email, role: body.role }, req }, true),
      writePermissions(id, body.permissions ?? [])
    ]);
    if (!created.results[0]) throw duplicateAccount();
    return { admin: await publicAdminAccount(db, created.results[0], body.permissions ?? []), invitationToken };
  }

  router.post("/auth/invite", settings, validateBody(adminSchema), asyncHandler(async (req, res) => {
    const creator = adminFrom(res);
    if (req.body.role === "SUPER_ADMIN" && !creator.isSuperAdmin && creator.role !== "SUPER_ADMIN") {
      throw new HttpError(403, "Only a super admin can invite another super admin", ErrorCode.FORBIDDEN);
    }
    const allowed = permissionsFor(req.body.role, req.body.permissions ?? []).every(permission =>
      creator.isSuperAdmin || creator.permissions.includes(permission));
    if (!allowed) throw new HttpError(403, "Cannot grant permissions you do not have", ErrorCode.FORBIDDEN);
    adminOk(res, await createAccount(req, creator.id, true), {}, 201);
  }));
  router.post("/auth/accept-invite", rates.authLimiter, validateBody(z.object({
    invitationToken: z.string().min(32).max(256), password: z.string().min(8).max(256)
  })), asyncHandler(async (req, res) => {
    const hash = hashAdminToken(req.body.invitationToken);
    const account = await db.prepare(adminAccountQuery + " WHERE invitation_token_hash = ? AND invitation_expires_at > ? AND status = 'INVITED'")
      .bind(hash, new Date().toISOString()).first<AdminAccount>();
    if (!account) throw new HttpError(404, "Invitation not found", ErrorCode.NOT_FOUND);
    const credentials = await provisionAdminPassword(config, account.source_id, account.email, req.body.password);
    const now = new Date().toISOString();
    const [updated] = await db.batch([
      db.prepare(`UPDATE admin_users SET password_hash = ?, firebase_uid = ?, status = 'ACTIVE', updated_at = ?,
        invitation_token_hash = NULL, invitation_expires_at = NULL WHERE source_id = ?
        AND invitation_token_hash = ? AND invitation_expires_at > ? AND status = 'INVITED'`)
        .bind(credentials.passwordHash, credentials.firebaseUid, now, account.source_id, hash, now),
      prepareD1AdminAudit(db, { id: account.source_id }, { action: "admin.invite.accepted", entityType: "admin_user",
        entityId: account.source_id, req }, true)
    ]);
    if (!updated.meta.changes) throw new HttpError(404, "Invitation not found", ErrorCode.NOT_FOUND);
    adminOk(res, { accepted: true });
  }));
  router.get("/admin-users", settings, asyncHandler(async (_req, res) => {
    const [accounts, permissions] = await db.batch<AdminAccount | { admin_users_id: string; value: string }>([
      db.prepare(adminAccountQuery + " ORDER BY created_at DESC, source_id"),
      db.prepare("SELECT admin_users_id, value FROM admin_role_permissions ORDER BY admin_users_id, position")
    ]);
    const perAccount = new Map<string, string[]>();
    for (const permission of permissions.results as { admin_users_id: string; value: string }[]) {
      const list = perAccount.get(permission.admin_users_id) ?? [];
      list.push(permission.value);
      perAccount.set(permission.admin_users_id, list);
    }
    adminOk(res, await Promise.all((accounts.results as AdminAccount[])
      .map(account => publicAdminAccount(db, account, perAccount.get(account.source_id) ?? []))));
  }));
  router.post("/admin-users", requireSuperAdmin, validateBody(adminSchema), asyncHandler(async (req, res) => {
    adminOk(res, await createAccount(req, adminFrom(res).id, false), {}, 201);
  }));
  router.patch("/admin-users/:adminId", requireSuperAdmin, validateBody(adminUpdate), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.adminId)) throw new HttpError(400, "Invalid adminId", ErrorCode.VALIDATION);
    const id = req.params.adminId.toLowerCase();
    const admin = adminFrom(res);
    const body = req.body as z.infer<typeof adminUpdate>;
    const now = new Date().toISOString();
    const [updated] = await db.batch<AdminAccount>([
      db.prepare(`UPDATE admin_users SET display_name = COALESCE(?1, display_name), role = COALESCE(?2, role),
        is_super_admin = CASE WHEN ?2 IS NULL THEN is_super_admin ELSE ?2 = 'SUPER_ADMIN' END,
        status = COALESCE(?3, status), updated_at = ?4 WHERE source_id = ?5
        AND (source_id <> ?6 OR ((?2 IS NULL OR ?2 = role) AND (?3 IS NULL OR ?3 = status))) RETURNING *`)
        .bind(body.displayName ?? null, body.role ?? null, body.status ?? null, now, id, admin.id),
      prepareD1AdminAudit(db, admin, { action: "admin_user.updated", entityType: "admin_user", entityId: id, metadata: body, req }, true),
      ...(body.permissions ? [
        db.prepare("DELETE FROM admin_role_permissions WHERE admin_users_id = ? AND EXISTS (SELECT 1 FROM admin_users WHERE source_id = ? AND updated_at = ?)")
          .bind(id, id, now),
        db.prepare(`INSERT INTO admin_role_permissions (source_id, admin_users_id, position, value)
          SELECT ?1 || ':permissions:' || key, ?1, key, value FROM json_each(?2)
          WHERE EXISTS (SELECT 1 FROM admin_users WHERE source_id = ?1 AND updated_at = ?3)`)
          .bind(id, JSON.stringify([...new Set(body.permissions)]), now)
      ] : []),
      ...(body.status && body.status !== "ACTIVE" ? [
        db.prepare(`UPDATE admin_sessions SET revoked_at = ?1, updated_at = ?1 WHERE admin_id = ?2 AND revoked_at IS NULL
          AND EXISTS (SELECT 1 FROM admin_users WHERE source_id = ?2 AND updated_at = ?1 AND status <> 'ACTIVE')`).bind(now, id)
      ] : [])
    ]);
    if (!updated.results[0]) {
      if (!await getAdminAccount(db, id)) throw missingAccount();
      throw new HttpError(409, "You cannot change your own role or status", ErrorCode.CONFLICT);
    }
    adminOk(res, { admin: await publicAdminAccount(db, updated.results[0]) });
  }));
  return router;
}
