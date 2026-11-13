import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { verifyAppCheckToken } from "../services/firebase.js";

export async function requireAppCheck(req: Request, _res: Response, next: NextFunction) {
  if (!env.APP_CHECK_ENFORCE || env.NODE_ENV === "development" || env.NODE_ENV === "test") return next();
  const token = req.header("X-Firebase-AppCheck");
  if (!token) return next(new HttpError(401, "App verification token is required", ErrorCode.UNAUTHORIZED));
  try {
    const decoded = await verifyAppCheckToken(token);
    if (decoded.alreadyConsumed) {
      return next(new HttpError(401, "App verification token has already been used", ErrorCode.UNAUTHORIZED));
    }
    (req as any).appCheck = decoded;
    next();
  } catch {
    next(new HttpError(401, "App verification failed", ErrorCode.UNAUTHORIZED));
  }
}
