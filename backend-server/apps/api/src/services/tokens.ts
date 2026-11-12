import crypto from "node:crypto";
import jwt, { type SignOptions } from "jsonwebtoken";
import type { Request } from "express";
import { User, type IUser } from "../models/User.js";
import { AuthSession } from "../models/AuthSession.js";
import { env } from "../config/env.js";
import { ErrorCode, HttpError } from "../utils/http.js";

function accessLifetimeSeconds() {
  const match = env.ACCESS_TOKEN_TTL.match(/^(\d+)(s|m|h|d)$/i);
  if (!match) return 45 * 60;
  const value = Number(match[1]);
  return value * ({ s: 1, m: 60, h: 3600, d: 86400 }[match[2].toLowerCase() as "s" | "m" | "h" | "d"]);
}

export function hashRefresh(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

export function signAccessToken(user: IUser, sessionId: string) {
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

function requestMetadata(req: Request) {
  return { ip: req.ip, userAgent: req.get("user-agent")?.slice(0, 500) };
}

export async function issueSession(user: IUser, req: Request) {
  const raw = crypto.randomBytes(32).toString("base64url");
  const refreshHash = hashRefresh(raw);
  const session = await AuthSession.create({
    userId: user._id,
    familyId: crypto.randomUUID(),
    refreshHash,
    expiresAt: refreshExpiry(),
    ...requestMetadata(req)
  });
  const accessToken = signAccessToken(user, session.id);
  return {
    token: accessToken,
    accessToken,
    refreshToken: raw,
    expiresIn: accessLifetimeSeconds(),
    sessionId: session.id
  };
}

export async function rotateRefresh(raw: string, req: Request) {
  const old = await AuthSession.findOne({ refreshHash: hashRefresh(raw) });
  if (!old) throw new HttpError(401, "Refresh session is invalid", ErrorCode.UNAUTHORIZED);
  if (old.revokedAt || old.replacedByHash) {
    await AuthSession.updateMany({ familyId: old.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw new HttpError(401, "Refresh token reuse detected", ErrorCode.UNAUTHORIZED);
  }
  if (old.expiresAt.getTime() <= Date.now()) throw new HttpError(401, "Refresh session expired", ErrorCode.UNAUTHORIZED);

  const nextRaw = crypto.randomBytes(32).toString("base64url");
  const nextHash = hashRefresh(nextRaw);
  const now = new Date();
  const claimed = await AuthSession.findOneAndUpdate(
    { _id: old._id, revokedAt: null, replacedByHash: null, expiresAt: { $gt: now } },
    { $set: { revokedAt: now, replacedByHash: nextHash, lastUsedAt: now } },
    { new: true }
  );
  if (!claimed) {
    await AuthSession.updateMany({ familyId: old.familyId, revokedAt: null }, { $set: { revokedAt: now } });
    throw new HttpError(401, "Refresh token reuse detected", ErrorCode.UNAUTHORIZED);
  }

  const nextSession = await AuthSession.create({
    userId: old.userId,
    familyId: old.familyId,
    refreshHash: nextHash,
    expiresAt: refreshExpiry(),
    ...requestMetadata(req)
  });
  const user = await User.findById(old.userId).select("-__v");
  if (!user || user.isBlocked || user.tokenVersion === undefined) {
    await AuthSession.updateMany({ familyId: old.familyId, revokedAt: null }, { $set: { revokedAt: new Date() } });
    throw new HttpError(401, "Account session is no longer valid", ErrorCode.UNAUTHORIZED);
  }
  const accessToken = signAccessToken(user, nextSession.id);
  return {
    token: accessToken,
    accessToken,
    refreshToken: nextRaw,
    expiresIn: accessLifetimeSeconds(),
    sessionId: nextSession.id
  };
}

export async function revokeSession(raw: string, userId?: string) {
  if (!raw) return;
  await AuthSession.updateOne(
    { refreshHash: hashRefresh(raw), ...(userId ? { userId } : {}), revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

export async function revokeAllForUser(userId: string) {
  await AuthSession.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: new Date() } });
}
