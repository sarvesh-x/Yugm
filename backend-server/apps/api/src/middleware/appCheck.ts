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
  } catch (error) {
    // Never log the bearer token. Keep the underlying Firebase error so a
    // rejected production token can be distinguished from missing verifier IAM
    // credentials without exposing implementation details to the client.
    console.error("Firebase App Check verification failed:", error instanceof Error ? error.message : String(error));
    next(new HttpError(401, "App verification failed", ErrorCode.UNAUTHORIZED));
  }
}
