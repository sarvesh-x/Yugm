import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@yugm/shared";
import { env } from "../config/env.js";
import { User, type IUser } from "../models/User.js";
import { AuthSession } from "../models/AuthSession.js";
import { ErrorCode, HttpError } from "../utils/http.js";

type AuthCacheEntry = { user: Record<string, unknown>; session: Record<string, unknown>; expiresAt: number };
const authContextCache = new Map<string, AuthCacheEntry>();
const AUTH_CACHE_TTL_MS = 20_000;
const AUTH_CACHE_MAX = 4000;

function readAuthCache(key: string): AuthCacheEntry | undefined {
  const entry = authContextCache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt <= Date.now()) {
    authContextCache.delete(key);
    return undefined;
  }
  return entry;
}

function writeAuthCache(key: string, user: Record<string, unknown>, session: Record<string, unknown>) {
  if (authContextCache.size >= AUTH_CACHE_MAX) {
    const oldest = authContextCache.keys().next().value;
    if (oldest !== undefined) authContextCache.delete(oldest);
  }
  authContextCache.set(key, { user, session, expiresAt: Date.now() + AUTH_CACHE_TTL_MS });
}

async function resolveAuthContext(decoded: { sub: string; tokenVersion?: number; sid: string }) {
  const key = `${decoded.sid}:${decoded.tokenVersion ?? 0}`;
  const cached = readAuthCache(key);
  if (cached) {
    return { user: User.hydrate(cached.user), session: AuthSession.hydrate(cached.session), key };
  }
  // `email`/`phone` are `select: false` on the schema. Self-facing responses
  // (`/auth/me`, `/auth/verify-email`, profile updates) need the verified
  // address for display and identity matching, so request it explicitly here.
  // Public/shared payload builders must not forward it for other users.
  const [user, session] = await Promise.all([
    User.findById(decoded.sub).select("-__v +email").lean(),
    AuthSession.findOne({ _id: decoded.sid, userId: decoded.sub, revokedAt: null, expiresAt: { $gt: new Date() } }).lean()
  ]);
  if (user && session) writeAuthCache(key, user as Record<string, unknown>, session as Record<string, unknown>);
  return { user: user ? User.hydrate(user) : null, session: session ? AuthSession.hydrate(session) : null, key };
}

export interface AuthRequest extends Request {
  user?: IUser;
  authSession?: any;
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new HttpError(401, "Missing auth token", ErrorCode.UNAUTHORIZED);

    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as { sub: string; tokenVersion?: number; sid?: string; typ?: string };
    if (decoded.typ !== "access" || !decoded.sid) throw new HttpError(401, "Invalid access token", ErrorCode.UNAUTHORIZED);
    // Short-lived per-process cache saves 2 DB round trips on nearly every
    // authenticated request. Keyed by sid+tokenVersion so rotated/revoked-token
    // JWTs don't reuse stale entries; revocations may take up to TTL to reflect.
    const { user, session, key } = await resolveAuthContext({ sub: decoded.sub, tokenVersion: decoded.tokenVersion, sid: decoded.sid });
    if (!user || user.isBlocked) throw new HttpError(401, user?.moderationReason || "Invalid user", ErrorCode.UNAUTHORIZED);
    if (!session) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    if ((session.tokenVersion ?? decoded.tokenVersion) !== decoded.tokenVersion) {
      authContextCache.delete(key);
      throw new HttpError(401, "This account was signed in on another device", ErrorCode.UNAUTHORIZED);
    }
    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
      throw new HttpError(403, `Account suspended until ${user.suspendedUntil.toISOString()}`, ErrorCode.FORBIDDEN);
    }
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
      authContextCache.delete(key);
      throw new HttpError(401, "Token revoked", ErrorCode.UNAUTHORIZED);
    }

    req.user = user;
    req.authSession = session;
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Invalid auth token", ErrorCode.UNAUTHORIZED));
  }
}

export async function optionalAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) return next();

    const decoded = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] }) as { sub: string; tokenVersion?: number; sid?: string; typ?: string };
    if (decoded.typ !== "access" || !decoded.sid || !decoded.sub) return next();

    const { user, session } = await resolveAuthContext({ sub: decoded.sub, tokenVersion: decoded.tokenVersion, sid: decoded.sid });
    if (
      user &&
      !user.isBlocked &&
      session &&
      (session.tokenVersion ?? decoded.tokenVersion) === decoded.tokenVersion &&
      !(user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) &&
      (decoded.tokenVersion === undefined || user.tokenVersion === decoded.tokenVersion)
    ) {
      req.user = user;
      req.authSession = session;
    }
    next();
  } catch {
    next();
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Missing user", ErrorCode.UNAUTHORIZED));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Insufficient role", ErrorCode.FORBIDDEN));
    next();
  };
}

export function requireNotMuted(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Missing user", ErrorCode.UNAUTHORIZED));
  if (req.user.mutedUntil && req.user.mutedUntil.getTime() > Date.now()) {
    return next(new HttpError(403, `Account muted until ${req.user.mutedUntil.toISOString()}`, ErrorCode.FORBIDDEN));
  }
  next();
}
