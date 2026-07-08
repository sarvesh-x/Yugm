import rateLimit from "express-rate-limit";
import type { Request } from "express";
import type { AuthRequest } from "./auth.js";

function userOrIpKey(req: Request) {
  return (req as AuthRequest).user?.id ?? req.ip ?? "unknown";
}

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

export const chatLimiter = rateLimit({
  windowMs: 10_000,
  max: 12,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false
});

export const reportLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: userOrIpKey,
  standardHeaders: true,
  legacyHeaders: false
});
