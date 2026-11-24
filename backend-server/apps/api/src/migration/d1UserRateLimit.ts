import type { Response } from "express";
import { ErrorCode, HttpError } from "../utils/http.js";

export type D1UserRateLimit = (userId: string) => Promise<boolean>;

export async function enforceD1UserRateLimit(limiter: D1UserRateLimit | undefined, userId: string, res: Response, period: number) {
  if (!limiter) throw new HttpError(503, "Rate limiting is unavailable", ErrorCode.INTERNAL);
  if (!await limiter(userId)) {
    res.setHeader("Retry-After", String(period));
    throw new HttpError(429, "Too many requests, please try again later.", ErrorCode.RATE_LIMITED);
  }
}
