import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import jwt from "jsonwebtoken";
import * as otp from "otplib";
import QRCode from "qrcode";
import { z } from "zod";
import { authClientIpHeader } from "../middleware/authRateLimitKeys.js";
import { validateBody } from "../middleware/validate.js";
import { adminOk } from "../modules/admin/http.js";
import { permissionsFor, type AdminRole } from "../modules/admin/permissions.js";
import type { AuthRateLimiters } from "../routes/authSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { prepareD1AdminAudit, requireD1Admin, type D1Admin } from "./d1AdminAuth.js";
import { adminFirebaseIdentity, changeFirebaseAdminPassword, firebasePasswordLogin, hashAdminToken,
  localAdminPasswordMatches, provisionAdminPassword, type AdminCredentialConfig } from "./d1AdminCredentials.js";
import { newId } from "./d1Cosmetics.js";

export type AdminSessionConfig = AdminCredentialConfig & { jwtSecret?: string; refreshSecret?: string };
export type AdminAccount = {
  source_id: string; email: string; display_name: string; role: AdminRole; status: string;
  is_super_admin: number; avatar_url: string | null; password_hash: string | null; firebase_uid: string | null;
  two_factor_enabled: number; two_factor_secret: string | null; two_factor_temp_secret: string | null;
  last_login_at: string | null;
};
export const adminAccountQuery = `SELECT source_id, email, display_name, role, status, is_super_admin, avatar_url,
  password_hash, firebase_uid, two_factor_enabled, two_factor_secret, two_factor_temp_secret, last_login_at FROM admin_users`;
const byAccountId = " WHERE source_id = ?";
const oneTimeCode = z.string().regex(/^\d{6}$/);
const password = z.string().max(256);
const newPassword = password.min(8);
const missingSession = () => new HttpError(401, "Admin session expired", ErrorCode.UNAUTHORIZED);
const invalidCredentials = () => new HttpError(401, "Invalid admin credentials", ErrorCode.UNAUTHORIZED);
const activeStatusError = () => new HttpError(403, "Admin account is not active", ErrorCode.FORBIDDEN);
const loginInput = z.object({ email: z.string().email().max(254).optional(), password: password.optional(),
  firebaseIdToken: z.string().min(1).max(8192).optional() })
  .refine(value => value.firebaseIdToken || (value.email && value.password), "Use Firebase token or email/password");

export function getAdminAccount(db: D1Database, id: string) {
  return db.prepare(adminAccountQuery + byAccountId).bind(id).first<AdminAccount>();
}

export async function publicAdminAccount(db: D1Database, account: AdminAccount, permissions?: string[]) {
  const custom = permissions ?? (await db.prepare("SELECT value FROM admin_role_permissions WHERE admin_users_id = ? ORDER BY position")
    .bind(account.source_id).all<{ value: string }>()).results.map(row => row.value);
  return { id: account.source_id, email: account.email, displayName: account.display_name,
    avatarUrl: account.avatar_url ?? undefined, role: account.role, status: account.status,
    isSuperAdmin: Boolean(account.is_super_admin), permissions: permissionsFor(account.role, custom, Boolean(account.is_super_admin)),
    twoFactorEnabled: Boolean(account.two_factor_enabled), lastLoginAt: account.last_login_at ?? undefined };
}

function audit(db: D1Database, account: AdminAccount | D1Admin, req: Request, action: string, sessionId?: string) {
  const id = "source_id" in account ? account.source_id : account.id;
  return prepareD1AdminAudit(db, { id }, {
    action, entityType: sessionId ? "admin_session" : "admin_user", entityId: sessionId ?? id, req
  }, true);
}

export function createD1AdminSessionsRouter(db: D1Database, rates: AuthRateLimiters, config: AdminSessionConfig) {
  const router = Router();
  const { authLimiter, authIdentifierLimiter, refreshLimiter } = rates;
  const readAdmin = (req: Request) => requireD1Admin(db, req.headers.authorization, config.jwtSecret);
  const sessionSecrets = () => {
    const access = config.jwtSecret;
    if (!access) throw new HttpError(503, "Admin authentication is not configured");
    return { access, refresh: config.refreshSecret || access };
  };
  const signAccess = (account: AdminAccount, sessionId: string, secret: string) => jwt.sign({
    sub: account.source_id, role: account.role, sessionId, type: "admin"
  }, secret, { expiresIn: "15m" });
  const activeAccount = async (id: string) => {
    const account = await getAdminAccount(db, id);
    if (!account || account.status !== "ACTIVE") throw missingSession();
    return account;
  };
  const authIp = (req: Request) => req.get(authClientIpHeader) ?? null;

  async function issue(account: AdminAccount, req: Request, challenge?: { sessionId: string; hash: string }) {
    const secrets = sessionSecrets();
    const id = newId();
    const now = new Date();
    const time = now.toISOString();
    const expiry = new Date(now.getTime() + 30 * 86_400_000).toISOString();
    const refreshToken = jwt.sign({ sub: account.source_id, sessionId: id, type: "admin_refresh" },
      secrets.refresh, { expiresIn: "30d" });
    const challengeCondition = `AND a.two_factor_enabled = 1 AND a.two_factor_secret = ?
      AND EXISTS (SELECT 1 FROM admin_sessions WHERE source_id = ? AND admin_id = a.source_id
        AND refresh_token_hash = ? AND revoked_at IS NULL AND expires_at > ?)`;
    const conditions = challenge
      ? [account.two_factor_secret, challenge.sessionId, challenge.hash, time]
      : [account.password_hash, account.firebase_uid];
    const statements: D1PreparedStatement[] = [
      db.prepare(`INSERT INTO admin_sessions
        (source_id, admin_id, refresh_token_hash, expires_at, ip_address, user_agent, created_at, updated_at)
        SELECT ?, a.source_id, ?, ?, ?, ?, ?, ? FROM admin_users a
        WHERE a.source_id = ? AND a.status = 'ACTIVE'
        ${challenge ? challengeCondition : "AND a.two_factor_enabled = 0 AND a.password_hash IS ? AND a.firebase_uid IS ?"}`)
        .bind(id, hashAdminToken(refreshToken), expiry, authIp(req), req.get("user-agent") ?? null,
          time, time, account.source_id, ...conditions),
      audit(db, account, req, "admin.login", id)
    ];
    if (challenge) statements.push(db.prepare(`UPDATE admin_sessions SET revoked_at = ?, updated_at = ?
      WHERE source_id = ? AND EXISTS (SELECT 1 FROM admin_sessions WHERE source_id = ?)`)
      .bind(time, time, challenge.sessionId, id));
    statements.push(db.prepare(`UPDATE admin_users SET last_login_at = ?, last_login_ip = ?
      WHERE source_id = ? AND EXISTS (SELECT 1 FROM admin_sessions WHERE source_id = ?)`)
      .bind(time, authIp(req), account.source_id, id));
    const [created] = await db.batch(statements);
    if (!created.meta.changes) throw missingSession();
    return { admin: await publicAdminAccount(db, { ...account, last_login_at: time }),
      accessToken: signAccess(account, id, secrets.access), refreshToken };
  }

  async function confirmPassword(account: AdminAccount, value: string) {
    if (!config.production && account.password_hash) return await localAdminPasswordMatches(value, account.password_hash);
    if (!account.firebase_uid) return false;
    try {
      const token = await firebasePasswordLogin(config, account.email, value);
      return (await adminFirebaseIdentity(token)).uid === account.firebase_uid ? token : false;
    } catch (error) {
      if ((error as { status?: number }).status === 401) return false;
      throw error;
    }
  }

  router.post("/auth/login", authLimiter, validateBody(loginInput), authIdentifierLimiter, asyncHandler(async (req, res) => {
    sessionSecrets();
    const body = req.body as z.infer<typeof loginInput>;
    let account: AdminAccount | null;
    if (body.firebaseIdToken) {
      const verified = await adminFirebaseIdentity(body.firebaseIdToken);
      account = await db.prepare(adminAccountQuery + " WHERE firebase_uid = ?").bind(verified.uid).first<AdminAccount>();
    } else {
      account = await db.prepare(adminAccountQuery + " WHERE lower(email) = ?")
        .bind(body.email!.trim().toLowerCase()).first<AdminAccount>();
      if (!account || !await confirmPassword(account, body.password!)) throw invalidCredentials();
    }
    if (!account) throw invalidCredentials();
    if (account.status !== "ACTIVE") throw activeStatusError();
    if (!account.two_factor_enabled) {
      adminOk(res, await issue(account, req));
      return;
    }
    if (!account.two_factor_secret) throw new HttpError(409, "Admin 2FA recovery is required", ErrorCode.CONFLICT);
    const twoFactorToken = randomBytes(32).toString("base64url");
    const time = new Date();
    const created = await db.prepare(`INSERT INTO admin_sessions
      (source_id, admin_id, refresh_token_hash, expires_at, ip_address, user_agent, created_at, updated_at)
      SELECT ?, source_id, ?, ?, ?, ?, ?, ? FROM admin_users WHERE source_id = ?
      AND status = 'ACTIVE' AND two_factor_enabled = 1 AND two_factor_secret = ? AND password_hash IS ? AND firebase_uid IS ?`)
      .bind(newId(), `2fa:${hashAdminToken(twoFactorToken)}`, new Date(time.getTime() + 300_000).toISOString(),
        authIp(req), req.get("user-agent") ?? null, time.toISOString(), time.toISOString(), account.source_id,
        account.two_factor_secret, account.password_hash, account.firebase_uid).run();
    if (!created.meta.changes) throw missingSession();
    adminOk(res, { twoFactorRequired: true, twoFactorToken, adminId: account.source_id,
      email: account.email, displayName: account.display_name });
  }));

  router.post("/auth/2fa/login", authLimiter, validateBody(z.object({
    twoFactorToken: z.string().min(20).max(256), token: oneTimeCode, adminId: z.string().refine(isValidObjectId)
  })), authIdentifierLimiter, asyncHandler(async (req, res) => {
    const account = await activeAccount(req.body.adminId);
    const hash = `2fa:${hashAdminToken(req.body.twoFactorToken)}`;
    const challenge = await db.prepare(`SELECT source_id FROM admin_sessions WHERE admin_id = ?
      AND refresh_token_hash = ? AND expires_at > ? AND revoked_at IS NULL`)
      .bind(account.source_id, hash, new Date().toISOString()).first<string>("source_id");
    if (!challenge || !account.two_factor_enabled || !account.two_factor_secret) throw missingSession();
    if (!(await otp.verify({ token: req.body.token, secret: account.two_factor_secret })).valid) {
      throw new HttpError(401, "Invalid 2FA code", ErrorCode.UNAUTHORIZED);
    }
    adminOk(res, await issue(account, req, { sessionId: challenge, hash }));
  }));

  router.post("/auth/refresh", validateBody(z.object({ refreshToken: z.string().min(20).max(8192) })),
    refreshLimiter, asyncHandler(async (req, res) => {
      const secrets = sessionSecrets();
      let token: string | jwt.JwtPayload;
      try {
        token = jwt.verify(req.body.refreshToken, secrets.refresh, { algorithms: ["HS256"] });
      } catch {
        throw missingSession();
      }
      if (typeof token === "string" || token.type !== "admin_refresh" || typeof token.exp !== "number" ||
          typeof token.sub !== "string" || !isValidObjectId(token.sub) ||
          typeof token.sessionId !== "string" || !isValidObjectId(token.sessionId)) throw missingSession();
      const account = await db.prepare(`${adminAccountQuery} WHERE source_id = ? AND status = 'ACTIVE'
        AND EXISTS (SELECT 1 FROM admin_sessions WHERE admin_id = admin_users.source_id
          AND source_id = ? AND revoked_at IS NULL AND expires_at > ? AND refresh_token_hash = ?)`)
        .bind(token.sub, token.sessionId, new Date().toISOString(), hashAdminToken(req.body.refreshToken)).first<AdminAccount>();
      if (!account) throw missingSession();
      adminOk(res, { admin: await publicAdminAccount(db, account), accessToken: signAccess(account, token.sessionId, secrets.access) });
    }));

  router.get("/auth/me", asyncHandler(async (req, res) => {
    const admin = await readAdmin(req);
    adminOk(res, { admin: await publicAdminAccount(db, await activeAccount(admin.id), admin.permissions) });
  }));
  router.post("/auth/logout", asyncHandler(async (req, res) => {
    const admin = await readAdmin(req);
    if (!admin.sessionId) throw missingSession();
    const now = new Date().toISOString();
    await db.batch([
      db.prepare("UPDATE admin_sessions SET revoked_at = ?, updated_at = ? WHERE source_id = ? AND admin_id = ? AND revoked_at IS NULL")
        .bind(now, now, admin.sessionId, admin.id),
      audit(db, admin, req, "admin.logout", admin.sessionId)
    ]);
    adminOk(res, { loggedOut: true });
  }));
  router.post("/auth/change-password", authLimiter, validateBody(z.object({ currentPassword: password, newPassword })),
    asyncHandler(async (req, res) => {
      const admin = await readAdmin(req);
      const account = await activeAccount(admin.id);
      const confirmation = await confirmPassword(account, req.body.currentPassword);
      if (!confirmation) throw new HttpError(403, "Current password is incorrect", ErrorCode.FORBIDDEN);
      const time = new Date().toISOString();
      const statements: D1PreparedStatement[] = [];
      if (typeof confirmation === "string") {
        await changeFirebaseAdminPassword(config, confirmation, req.body.newPassword);
        statements.push(db.prepare("UPDATE admin_users SET updated_at = ? WHERE source_id = ? AND status = 'ACTIVE'").bind(time, admin.id));
      } else {
        const { passwordHash } = await provisionAdminPassword(config, admin.id, account.email, req.body.newPassword);
        statements.push(db.prepare("UPDATE admin_users SET password_hash = ?, updated_at = ? WHERE source_id = ? AND password_hash = ? AND status = 'ACTIVE'")
          .bind(passwordHash, time, admin.id, account.password_hash));
      }
      statements.push(audit(db, admin, req, "admin.password.changed"));
      statements.push(db.prepare(`UPDATE admin_sessions SET revoked_at = ?, updated_at = ? WHERE admin_id = ?
        AND revoked_at IS NULL AND changes() > 0`).bind(time, time, admin.id));
      const [updated] = await db.batch(statements);
      if (!updated.meta.changes) throw missingSession();
      adminOk(res, { changed: true });
    }));
  router.post("/auth/2fa/status", asyncHandler(async (req, res) => {
    const { id } = await readAdmin(req);
    const account = await activeAccount(id);
    adminOk(res, { enabled: Boolean(account.two_factor_enabled), email: account.email });
  }));
  router.post("/auth/2fa/setup", authLimiter, asyncHandler(async (req, res) => {
    const { id, email } = await readAdmin(req);
    const secret = otp.generateSecret();
    const uri = otp.generateURI({ issuer: "Yugm Admin", label: email, secret });
    const svg = await QRCode.toString(uri, { type: "svg" });
    const updated = await db.prepare("UPDATE admin_users SET two_factor_temp_secret = ? WHERE source_id = ? AND status = 'ACTIVE' AND two_factor_enabled = 0")
      .bind(secret, id).run();
    if (!updated.meta.changes) throw new HttpError(409, "2FA is already enabled. Disable it first to reconfigure.", ErrorCode.CONFLICT);
    adminOk(res, { secret, uri, qrCode: `data:image/svg+xml;base64,${btoa(svg)}` });
  }));
  router.post("/auth/2fa/verify", authLimiter, validateBody(z.object({ token: oneTimeCode })), asyncHandler(async (req, res) => {
    const admin = await readAdmin(req);
    const account = await activeAccount(admin.id);
    const secret = account.two_factor_enabled ? account.two_factor_secret : account.two_factor_temp_secret;
    if (!secret || !(await otp.verify({ token: req.body.token, secret })).valid) {
      throw new HttpError(400, "Invalid verification code or missing setup", ErrorCode.VALIDATION);
    }
    if (!account.two_factor_enabled) {
      const [updated] = await db.batch([
        db.prepare(`UPDATE admin_users SET two_factor_enabled = 1, two_factor_secret = two_factor_temp_secret, two_factor_temp_secret = NULL
          WHERE source_id = ? AND status = 'ACTIVE' AND two_factor_enabled = 0 AND two_factor_temp_secret = ?`).bind(admin.id, secret),
        audit(db, admin, req, "admin.2fa.enabled"),
        db.prepare("UPDATE admin_sessions SET revoked_at = ? WHERE admin_id = ? AND source_id <> ? AND revoked_at IS NULL AND changes() > 0")
          .bind(new Date().toISOString(), admin.id, admin.sessionId ?? "")
      ]);
      if (!updated.meta.changes) throw new HttpError(409, "2FA setup changed. Try again.", ErrorCode.CONFLICT);
    }
    adminOk(res, { verified: true, enabled: true });
  }));
  router.post("/auth/2fa/disable", authLimiter, validateBody(z.object({ token: oneTimeCode, password: password.optional() })),
    asyncHandler(async (req, res) => {
      const admin = await readAdmin(req);
      const account = await activeAccount(admin.id);
      const secret = account.two_factor_secret;
      if (!secret || !(await otp.verify({ token: req.body.token, secret })).valid) {
        throw new HttpError(400, "Invalid verification code or 2FA is disabled", ErrorCode.VALIDATION);
      }
      if (req.body.password && !await confirmPassword(account, req.body.password)) {
        throw new HttpError(403, "Password is incorrect", ErrorCode.FORBIDDEN);
      }
      const [updated] = await db.batch([
        db.prepare(`UPDATE admin_users SET two_factor_enabled = 0, two_factor_secret = NULL, two_factor_temp_secret = NULL
          WHERE source_id = ? AND status = 'ACTIVE' AND two_factor_secret = ?`).bind(admin.id, secret),
        audit(db, admin, req, "admin.2fa.disabled")
      ]);
      if (!updated.meta.changes) throw missingSession();
      adminOk(res, { disabled: true });
    }));
  return router;
}
