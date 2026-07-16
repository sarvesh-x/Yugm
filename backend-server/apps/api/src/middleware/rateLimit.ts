import rateLimit from "express-rate-limit";
import type { Request } from "express";
import type { AuthRequest } from "./auth.js";
import { ResilientRedisRateLimitStore } from "../services/rateLimitStore.js";

function userOrIpKey(req: Request) {
  return (req as AuthRequest).user?.id ?? req.ip ?? "unknown";
}

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 12,
  store: new ResilientRedisRateLimitStore("auth"),
  standardHeaders: true,
  legacyHeaders: false
});

export const chatLimiter = rateLimit({
  windowMs: 10_000,
  max: 12,
  keyGenerator: userOrIpKey,
  store: new ResilientRedisRateLimitStore("chat"),
  standardHeaders: true,
  legacyHeaders: false
});

export const reportLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  keyGenerator: userOrIpKey,
  store: new ResilientRedisRateLimitStore("report"),
  standardHeaders: true,
  legacyHeaders: false
});

export const twoFactorLimiter = rateLimit({
  windowMs: 60_000,
  max: 6,
  keyGenerator: (req) => req.ip ?? "unknown",
  store: new ResilientRedisRateLimitStore("2fa"),
  standardHeaders: true,
  legacyHeaders: false
});

export const createLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: userOrIpKey,
  store: new ResilientRedisRateLimitStore("create"),
  standardHeaders: true,
  legacyHeaders: false
});
