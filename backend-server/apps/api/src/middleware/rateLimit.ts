import crypto from "node:crypto";
import rateLimit from "express-rate-limit";
import type { Request } from "express";
import type { AuthRequest } from "./auth.js";
import { ResilientRedisRateLimitStore } from "../services/rateLimitStore.js";

function clientIp(req: Request): string {
  const cfIp = req.headers["cf-connecting-ip"];
  if (typeof cfIp === "string" && cfIp.trim()) return cfIp.trim();
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.trim()) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.ip ?? "unknown";
}

function userOrIpKey(req: Request) {
  return (req as AuthRequest).user?.id ?? clientIp(req);
}

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  keyGenerator: clientIp,
  store: new ResilientRedisRateLimitStore("auth"),
  standardHeaders: true,
  legacyHeaders: false
});

export const authIdentifierLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  keyGenerator: (req) => {
    const value = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase()
      : typeof req.body?.phone === "string" ? req.body.phone.replace(/[\s()-]/g, "")
        : "";
    return value ? `identifier:${crypto.createHash("sha256").update(value).digest("hex")}` : `ip:${clientIp(req)}`;
  },
  store: new ResilientRedisRateLimitStore("auth-identifier"),
  standardHeaders: true,
  legacyHeaders: false
});

export const refreshLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  keyGenerator: (req) => {
    const token = typeof req.body?.refreshToken === "string" ? req.body.refreshToken : "";
    const ip = clientIp(req);
    const identity = token ? crypto.createHash("sha256").update(token).digest("hex").slice(0, 20) : ip;
    return `refresh:${ip}:${identity}`;
  },
  store: new ResilientRedisRateLimitStore("auth-refresh"),
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

export const giftLimiter = rateLimit({
  windowMs: 10_000,
  max: 20,
  keyGenerator: userOrIpKey,
  store: new ResilientRedisRateLimitStore("gift"),
  standardHeaders: true,
  legacyHeaders: false
});

export const bondLimiter = rateLimit({
  windowMs: 60_000,
  max: 90,
  keyGenerator: userOrIpKey,
  store: new ResilientRedisRateLimitStore("bonds"),
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
