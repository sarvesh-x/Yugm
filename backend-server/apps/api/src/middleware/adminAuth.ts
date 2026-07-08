import crypto from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { AdminUser, type IAdminUser } from "../models/AdminUser.js";
import { AdminSession } from "../models/AdminSession.js";
import { HttpError } from "../utils/http.js";
import { permissionsFor, type AdminPermission } from "../modules/admin/permissions.js";

export interface AdminAuthRequest extends Request {
  admin?: IAdminUser;
  adminPermissions?: AdminPermission[];
  adminSessionId?: string;
}

export function adminJwtSecret() {
  return env.ADMIN_JWT_SECRET || env.JWT_SECRET;
}

export function adminRefreshSecret() {
  return env.ADMIN_REFRESH_SECRET || env.ADMIN_JWT_SECRET || env.JWT_SECRET;
}

export function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function signAdminAccessToken(admin: IAdminUser, sessionId?: string) {
  return jwt.sign(
    { sub: admin.id, role: admin.role, sessionId, type: "admin" },
    adminJwtSecret(),
    { expiresIn: "15m" }
  );
}

export function signAdminRefreshToken(admin: IAdminUser, sessionId: string) {
  return jwt.sign(
    { sub: admin.id, sessionId, type: "admin_refresh" },
    adminRefreshSecret(),
    { expiresIn: "30d" }
  );
}

export async function requireAdminAuth(req: AdminAuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new HttpError(401, "Missing admin auth token");

    const decoded = jwt.verify(token, adminJwtSecret()) as { sub: string; sessionId?: string; type?: string };
    if (decoded.type !== "admin") throw new HttpError(401, "Invalid admin token");
    const admin = await AdminUser.findById(decoded.sub);
    if (!admin || admin.status !== "ACTIVE") throw new HttpError(401, "Admin account is not active");
    if (decoded.sessionId) {
      const session = await AdminSession.findOne({ _id: decoded.sessionId, adminId: admin.id, revokedAt: { $exists: false }, expiresAt: { $gt: new Date() } });
      if (!session) throw new HttpError(401, "Admin session expired");
      req.adminSessionId = session.id;
    }
    req.admin = admin;
    req.adminPermissions = permissionsFor(admin.role, admin.permissions, admin.isSuperAdmin);
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Invalid admin auth token"));
  }
}

export function requirePermission(permission: AdminPermission) {
  return (req: AdminAuthRequest, _res: Response, next: NextFunction) => {
    if (!req.admin) return next(new HttpError(401, "Missing admin"));
    if (req.admin.isSuperAdmin || req.adminPermissions?.includes(permission)) return next();
    next(new HttpError(403, "You do not have permission to perform this action"));
  };
}

export function requireAnyPermission(permissions: AdminPermission[]) {
  return (req: AdminAuthRequest, _res: Response, next: NextFunction) => {
    if (!req.admin) return next(new HttpError(401, "Missing admin"));
    if (req.admin.isSuperAdmin || permissions.some((permission) => req.adminPermissions?.includes(permission))) return next();
    next(new HttpError(403, "You do not have permission to perform this action"));
  };
}

export function requireSuperAdmin(req: AdminAuthRequest, _res: Response, next: NextFunction) {
  if (!req.admin) return next(new HttpError(401, "Missing admin"));
  if (!req.admin.isSuperAdmin && req.admin.role !== "SUPER_ADMIN") return next(new HttpError(403, "Super admin access required"));
  next();
}
