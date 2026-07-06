import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@yugm/shared";
import { env } from "../config/env.js";
import { User, type IUser } from "../models/User.js";
import { HttpError } from "../utils/http.js";

export interface AuthRequest extends Request {
  user?: IUser;
}

export function signToken(user: IUser) {
  return jwt.sign({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion }, env.JWT_SECRET, { expiresIn: "30d" });
}

export async function requireAuth(req: AuthRequest, _res: Response, next: NextFunction) {
  try {
    const header = req.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
    if (!token) throw new HttpError(401, "Missing auth token");

    const decoded = jwt.verify(token, env.JWT_SECRET) as { sub: string; tokenVersion?: number };
    const user = await User.findById(decoded.sub).select("-__v");
    if (!user || user.isBlocked) throw new HttpError(401, user?.moderationReason || "Invalid user");
    if (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) {
      throw new HttpError(403, `Account suspended until ${user.suspendedUntil.toISOString()}`);
    }
    if (decoded.tokenVersion !== undefined && user.tokenVersion !== decoded.tokenVersion) {
      throw new HttpError(401, "Token revoked");
    }

    req.user = user;
    next();
  } catch (error) {
    next(error instanceof HttpError ? error : new HttpError(401, "Invalid auth token"));
  }
}

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, "Missing user"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Insufficient role"));
    next();
  };
}

export function requireNotMuted(req: AuthRequest, _res: Response, next: NextFunction) {
  if (!req.user) return next(new HttpError(401, "Missing user"));
  if (req.user.mutedUntil && req.user.mutedUntil.getTime() > Date.now()) {
    return next(new HttpError(403, `Account muted until ${req.user.mutedUntil.toISOString()}`));
  }
  next();
}
