import rateLimit from "express-rate-limit";

// TODO: In production, switch from IP-based to per-user rate limiting using a custom keyGenerator

export const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

export const chatLimiter = rateLimit({
  windowMs: 10_000,
  max: 12,
  standardHeaders: true,
  legacyHeaders: false
});

export const reportLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false
});
