import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import { env } from "../config/env.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { isSessionGenerationCurrent } from "./authSessionRules.js";
import type { AuthSessionAccount, AuthSessionStore } from "./authSessionStore.js";

type SessionRequest = { ip?: string; get(name: "user-agent"): string | undefined };

function accessLifetimeSeconds() {
  const match = env.ACCESS_TOKEN_TTL.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return 45 * 60;
  const value = Number(match[1]);
  return value * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2].toLowerCase() as "s" | "m" | "h" | "d"]);
}

export function hashRefresh(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function signAccessToken(user: Omit<AuthSessionAccount, "id"> & { id?: string }, sessionId: string) {
  if (!user.id) throw new HttpError(401, "Account session is no longer valid", ErrorCode.UNAUTHORIZED);
  return jwt.sign({
    sub: user.id,
    role: user.role,
    tokenVersion: user.tokenVersion,
    sid: sessionId,
    typ: "access"
  }, env.JWT_SECRET, { expiresIn: env.ACCESS_TOKEN_TTL as SignOptions["expiresIn"], algorithm: "HS256" });
}

function refreshExpiry() {
  return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
}

function requestMetadata(req: SessionRequest) {
  return { ip: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) };
}

export async function issueSession(user: AuthSessionAccount, req: SessionRequest, store: AuthSessionStore) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const session = await store.issue(user.id, crypto.randomUUID(), {
    refreshHash: hashRefresh(raw),
    expiresAt: refreshExpiry(),
    ...requestMetadata(req)
  }, new Date());
  if (!session) throw new HttpError(401, "Account session is no longer valid", ErrorCode.UNAUTHORIZED);
  user.tokenVersion = session.tokenVersion;
  const accessToken = signAccessToken(user, session.id);
  return {
    token: accessToken,
    accessToken,
    refreshToken: raw,
    expiresIn: accessLifetimeSeconds(),
    sessionId: session.id
  };
}

export async function rotateRefresh(raw: string, req: SessionRequest, store: AuthSessionStore) {
  const old = await store.findRefreshSession(hashRefresh(raw));
  if (!old) throw new HttpError(401, "Refresh session is invalid", ErrorCode.UNAUTHORIZED);
  const user = await store.findAccount(old.userId);
  if (!user || user.isBlocked || user.tokenVersion === undefined) {
    throw new HttpError(401, "Account session is no longer valid", ErrorCode.UNAUTHORIZED);
  }
  // Keep the legacy refresh fallback for a session whose hydrated generation is nullish.
  const sessionTokenVersion = old.tokenVersion ?? user.tokenVersion;
  if (!isSessionGenerationCurrent(old.tokenVersion, user.tokenVersion)) {
    await store.revokeById(old.id, new Date());
    throw new HttpError(401, "This account was signed in on another device", ErrorCode.UNAUTHORIZED);
  }
  if (old.revokedAt || old.replacedByHash) {
    await store.revokeFamily(old.familyId, new Date());
    throw new HttpError(401, "Refresh token reuse detected", ErrorCode.UNAUTHORIZED);
  }
  if (old.expiresAt.getTime() <= Date.now()) throw new HttpError(401, "Refresh session expired", ErrorCode.UNAUTHORIZED);

  const nextRaw = crypto.randomBytes(32).toString("base64url");
  const now = new Date();
  const nextSessionId = await store.rotate(old, sessionTokenVersion, {
    refreshHash: hashRefresh(nextRaw),
    expiresAt: refreshExpiry(),
    ...requestMetadata(req)
  }, now);
  if (!nextSessionId) {
    await store.revokeFamily(old.familyId, now);
    throw new HttpError(401, "Refresh token reuse detected", ErrorCode.UNAUTHORIZED);
  }
  const latestUser = await store.findAccount(old.userId);
  if (!latestUser || latestUser.isBlocked || latestUser.tokenVersion !== sessionTokenVersion) {
    await store.revokeFamily(old.familyId, new Date());
    throw new HttpError(401, "This account was signed in on another device", ErrorCode.UNAUTHORIZED);
  }
  const accessToken = signAccessToken(latestUser, nextSessionId);
  return {
    token: accessToken,
    accessToken,
    refreshToken: nextRaw,
    expiresIn: accessLifetimeSeconds(),
    sessionId: nextSessionId
  };
}

export async function logoutSession(userId: string, raw: string | undefined, store: AuthSessionStore, deviceToken?: string) {
  await store.logout(userId, raw ? hashRefresh(raw) : undefined, new Date(), deviceToken);
}

export async function revokeAllForUser(userId: string, store: AuthSessionStore) {
  await store.revokeAll(userId, new Date());
}
