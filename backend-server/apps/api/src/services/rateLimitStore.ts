import type { ClientRateLimitInfo, Options, Store } from "express-rate-limit";
import { consumeRedisRateLimit, redis } from "./redis.js";

type LocalEntry = {
  totalHits: number;
  resetTime: Date;
};

function safeKey(value: string) {
  return value.replace(/[^a-zA-Z0-9:_-]/g, "_").slice(0, 180);
}

export class ResilientRedisRateLimitStore implements Store {
  localKeys = false;
  prefix: string;
  private windowMs = 60_000;
  private localFallback = new Map<string, LocalEntry>();

  constructor(prefix: string) {
    this.prefix = `rl:${safeKey(prefix)}:`;
  }

  init(options: Options) {
    this.windowMs = options.windowMs;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const local = this.localFallback.get(key);
    if (local && local.resetTime > new Date()) return local;
    if (local) this.localFallback.delete(key);
    return undefined;
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const seconds = Math.max(1, Math.ceil(this.windowMs / 1000));
    const redisResult = await consumeRedisRateLimit(`${this.prefix}${safeKey(key)}`, Number.MAX_SAFE_INTEGER, seconds);
    if (redisResult && redis?.status === "ready") {
      return { totalHits: redisResult.totalHits, resetTime: redisResult.resetTime };
    }
    return this.incrementLocal(key);
  }

  async decrement(key: string) {
    const local = this.localFallback.get(key);
    if (local) local.totalHits = Math.max(0, local.totalHits - 1);
  }

  async resetKey(key: string) {
    this.localFallback.delete(key);
    if (redis?.status === "ready") {
      await redis.del(`rate:${this.prefix}${safeKey(key)}`).catch(() => {});
    }
  }

  async resetAll() {
    this.localFallback.clear();
  }

  private incrementLocal(key: string): ClientRateLimitInfo {
    const now = Date.now();
    const existing = this.localFallback.get(key);
    if (!existing || existing.resetTime.getTime() <= now) {
      const entry = { totalHits: 1, resetTime: new Date(now + this.windowMs) };
      this.localFallback.set(key, entry);
      return entry;
    }
    existing.totalHits += 1;
    return existing;
  }
}
