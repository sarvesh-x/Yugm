import type { NextFunction, Request, Response } from "express";
import type { UserRole } from "@yugm/shared";
import { User, type IUser } from "../models/User.js";
import { AuthSession } from "../models/AuthSession.js";
import type { AccessClaims, AccessSession } from "../services/accessSession.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { createHttpSessionAuth } from "./httpAccessSession.js";

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

async function resolveAuthContext(decoded: AccessClaims) {
  const key = JSON.stringify([decoded.sub, decoded.sid, decoded.tokenVersion]);
  const invalidate = () => { authContextCache.delete(key); };
  const cached = readAuthCache(key);
  if (cached) {
    return { user: User.hydrate(cached.user), session: AuthSession.hydrate(cached.session), invalidate };
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
  return { user: user ? User.hydrate(user) : null, session: session ? AuthSession.hydrate(session) : null, invalidate };
}

export interface AuthRequest extends Request {
  user?: IUser;
  authSession?: AccessSession;
}

// Keep the existing Mongo request user and cache behavior for callers that use
// the full User document. The D1 guard reads authorization facts directly.
export const { required: requireAuth, optional: optionalAuth } = createHttpSessionAuth(
  resolveAuthContext,
  (req: AuthRequest, _res, user, session) => {
    req.user = user;
    req.authSession = session;
  }
);

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
