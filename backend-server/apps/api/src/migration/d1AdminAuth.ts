import type { D1Database } from "@cloudflare/workers-types";
import type { NextFunction, Request, Response } from "express";
import { permissionsFor, type AdminPermission, type AdminRole } from "../modules/admin/permissions.js";
import { ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { newId } from "./d1Cosmetics.js";

export type D1Admin = {
  id: string;
  email: string;
  displayName: string;
  role: AdminRole;
  isSuperAdmin: boolean;
  permissions: AdminPermission[];
  sessionId?: string;
};

type Claims = { sub?: string; role?: AdminRole; sessionId?: string; type?: string; exp?: number };

function decodePart(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - normalized.length % 4) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, char => char.charCodeAt(0));
}

function text(value: Uint8Array) {
  return new TextDecoder().decode(value);
}

/** Verify the same HS256 admin access token the legacy jsonwebtoken middleware accepts. */
export async function verifyD1AdminToken(token: string, secret: string): Promise<Claims> {
  const parts = token.split(".");
  if (parts.length !== 3) throw new HttpError(401, "Invalid admin auth token", ErrorCode.UNAUTHORIZED);
  let header: { alg?: string };
  let claims: Claims;
  let signature: Uint8Array;
  try {
    header = JSON.parse(text(decodePart(parts[0]))) as { alg?: string };
    claims = JSON.parse(text(decodePart(parts[1]))) as Claims;
    signature = decodePart(parts[2]);
  } catch {
    throw new HttpError(401, "Invalid admin auth token", ErrorCode.UNAUTHORIZED);
  }
  if (header?.alg !== "HS256" || !claims || typeof claims !== "object") {
    throw new HttpError(401, "Invalid admin auth token", ErrorCode.UNAUTHORIZED);
  }
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  const valid = await crypto.subtle.verify("HMAC", key, signature,
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`));
  if (!valid || claims.type !== "admin" || typeof claims.sub !== "string" || !isValidObjectId(claims.sub) ||
      typeof claims.exp !== "number" || claims.exp <= Math.floor(Date.now() / 1000) ||
      (claims.sessionId !== undefined && (typeof claims.sessionId !== "string" || !isValidObjectId(claims.sessionId)))) {
    throw new HttpError(401, "Invalid admin token", ErrorCode.UNAUTHORIZED);
  }
  return claims;
}

export async function requireD1Admin(db: D1Database, authorization: string | undefined, secret?: string): Promise<D1Admin> {
  if (!secret) throw new HttpError(503, "Admin authentication is not configured");
  const token = authorization?.startsWith("Bearer ") ? authorization.slice(7) : undefined;
  if (!token) throw new HttpError(401, "Missing admin auth token", ErrorCode.UNAUTHORIZED);
  const claims = await verifyD1AdminToken(token, secret);
  const now = new Date().toISOString();
  const admin = await db.prepare(`SELECT source_id, email, display_name, role, is_super_admin
    FROM admin_users WHERE source_id = ? AND status = 'ACTIVE'`).bind(claims.sub).first<{
      source_id: string; email: string; display_name: string; role: AdminRole; is_super_admin: number;
    }>();
  if (!admin) throw new HttpError(401, "Admin account is not active", ErrorCode.UNAUTHORIZED);
  if (claims.sessionId) {
    const session = await db.prepare(`SELECT source_id FROM admin_sessions WHERE source_id = ?
      AND admin_id = ? AND revoked_at IS NULL AND expires_at > ?`)
      .bind(claims.sessionId, admin.source_id, now).first();
    if (!session) throw new HttpError(401, "Admin session expired", ErrorCode.UNAUTHORIZED);
  }
  const { results } = await db.prepare(`SELECT value FROM admin_role_permissions
    WHERE admin_users_id = ? ORDER BY position`).bind(admin.source_id).all<{ value: string }>();
  return {
    id: admin.source_id,
    email: admin.email,
    displayName: admin.display_name,
    role: admin.role,
    isSuperAdmin: Boolean(admin.is_super_admin),
    permissions: permissionsFor(admin.role, results.map(row => row.value), Boolean(admin.is_super_admin)),
    sessionId: claims.sessionId
  };
}

export function requireD1Permission(admin: D1Admin, permission: AdminPermission) {
  if (!admin.isSuperAdmin && !admin.permissions.includes(permission)) {
    throw new HttpError(403, "You do not have permission to perform this action", ErrorCode.FORBIDDEN);
  }
}

/** Legacy installs requireAdminAuth before requirePermission and validateBody. */
export function createD1AdminGuard(db: D1Database, secret?: string) {
  return (...permissions: [AdminPermission, ...AdminPermission[]]) => async (req: Request, res: Response, next: NextFunction) => {
    try {
      const admin = await requireD1Admin(db, req.headers.authorization, secret);
      if (!admin.isSuperAdmin && !permissions.some(permission => admin.permissions.includes(permission))) {
        throw new HttpError(403, "You do not have permission to perform this action", ErrorCode.FORBIDDEN);
      }
      res.locals.d1Admin = admin;
      next();
    } catch (error) {
      next(error);
    }
  };
}

export function adminFrom(res: { locals: Record<string, unknown> }) {
  return res.locals.d1Admin as D1Admin;
}

export function prepareD1AdminAudit(db: D1Database, admin: Pick<D1Admin, "id">, input: {
  action: string;
  auditId?: string;
  entityType: string;
  entityId?: string;
  targetUserId?: string;
  metadata?: Record<string, unknown>;
  req: Request;
}, onlyAfterChange = false) {
  const entityId = input.entityId && isValidObjectId(input.entityId) ? input.entityId : null;
  const metadata = {
    ...(input.metadata ?? {}),
    ...(input.entityId && !entityId ? { entityId: input.entityId } : {})
  };
  const time = new Date().toISOString();
  return db.prepare(`INSERT INTO admin_audit_logs
    (source_id, admin_id, action, entity_type, entity_id, target_user_id, metadata, ip_address, user_agent, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? ${onlyAfterChange ? "WHERE changes() > 0" : ""}`)
    .bind(input.auditId ?? newId(), admin.id, input.action, input.entityType, entityId,
      input.targetUserId ?? null, JSON.stringify(metadata), input.req.ip ?? null,
      input.req.get("user-agent") ?? null, time, time);
}

export async function insertD1AdminAudit(...args: Parameters<typeof prepareD1AdminAudit>) {
  await prepareD1AdminAudit(...args).run();
}
