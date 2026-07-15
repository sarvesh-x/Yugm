import { Redis, type RedisOptions } from "ioredis";
import { env } from "../config/env.js";

function normalizeRedisUrl(rawUrl: string | undefined) {
  const value = rawUrl?.trim();
  if (!value) {
    console.log("Redis disabled: REDIS_URL is empty");
    return undefined;
  }

  const matches = [...value.matchAll(/rediss?:\/\//g)];
  const start = matches.at(-1)?.index;
  const candidate = start === undefined ? value : value.slice(start).trim();

  try {
    const parsed = new URL(candidate);
    console.log(`Redis URL resolved: host=${parsed.hostname} port=${parsed.port}`);
    return candidate;
  } catch {
    console.warn("Redis disabled: REDIS_URL is not a valid URL:", rawUrl?.slice(0, 40));
    return undefined;
  }
}

const redisUrl = normalizeRedisUrl(env.REDIS_URL);
const presenceScanMatch = "presence:user:*";

export function getRedisUrl() {
  return redisUrl;
}

let lastCreateRedisErrorTime = 0;

export function createRedisConnection(options: RedisOptions = {}) {
  if (!redisUrl) return undefined;
  const client = new Redis(redisUrl, {
    lazyConnect: true,
    enableOfflineQueue: false,
    retryStrategy: () => null,
    ...options
  });
  client.on("error", (err) => {
    const now = Date.now();
    if (now - lastCreateRedisErrorTime > REDIS_ERROR_COOLDOWN_MS) {
      lastCreateRedisErrorTime = now;
      console.warn("Redis connection error (createRedisConnection):", err.message);
    }
  });
  return client;
}

export const redis = redisUrl
  ? new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: () => null
    })
  : undefined;

let lastRedisErrorTime = 0;
const REDIS_ERROR_COOLDOWN_MS = 30_000;
const warnedRedisCommandErrors = new Set<string>();

if (redis) {
  redis.on("error", (err) => {
    const now = Date.now();
    if (now - lastRedisErrorTime > REDIS_ERROR_COOLDOWN_MS) {
      lastRedisErrorTime = now;
      console.warn("Redis connection error:", err.message);
    }
  });
}

let lastRedisConnectAttempt = 0;

export async function connectRedis() {
  if (!redis) return;

  const now = Date.now();
  if (now - lastRedisConnectAttempt < 10_000) return;
  lastRedisConnectAttempt = now;

  try {
    await redis.connect();
    console.log("Redis connected");
  } catch (err: any) {
    console.warn("Redis connection failed (non-fatal):", err.message);
  }
}

function isRedisReady() {
  return redis?.status === "ready";
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : String(error);
}

function warnRedisCommandFailure(operation: string, error: unknown) {
  if (warnedRedisCommandErrors.has(operation)) return;
  warnedRedisCommandErrors.add(operation);
  console.warn(`Redis ${operation} failed (non-fatal):`, getErrorMessage(error));
}

async function runRedisCommand<T>(
  operation: string,
  fallback: T,
  command: (client: Redis) => Promise<T>
): Promise<T> {
  if (!isRedisReady() || !redis) return fallback;

  try {
    return await command(redis);
  } catch (error) {
    warnRedisCommandFailure(operation, error);
    return fallback;
  }
}

export function getRedisHealth() {
  return {
    configured: Boolean(redis),
    status: redis?.status ?? "disabled",
    ready: isRedisReady()
  };
}

export async function setUserPresence(userId: string, online: boolean) {
  const key = `presence:user:${userId}`;
  await runRedisCommand("presence update", undefined, async (client) => {
    if (online) {
      await client.set(key, "online", "EX", 300);
    } else {
      await client.del(key);
    }
  });
}

export async function setUserConnectionPresence(userId: string, connectionId: string, online: boolean) {
  const userKey = `presence:user:${userId}`;
  const connectionKey = `presence:user:${userId}:socket:${connectionId}`;
  await runRedisCommand("connection presence update", undefined, async (client) => {
    if (online) {
      await client
        .multi()
        .set(userKey, "online", "EX", 300)
        .set(connectionKey, "online", "EX", 300)
        .exec();
      return;
    }

    await client.del(connectionKey);
    let cursor = "0";
    let hasOtherConnection = false;
    do {
      const result = await client.scan(cursor, "MATCH", `presence:user:${userId}:socket:*`, "COUNT", 50);
      cursor = result[0];
      if (result[1].length) {
        hasOtherConnection = true;
        break;
      }
    } while (cursor !== "0");

    if (hasOtherConnection) {
      await client.set(userKey, "online", "EX", 300);
    } else {
      await client.del(userKey);
    }
  });
}

export async function getOnlinePresenceIds(limit = 10_000) {
  return runRedisCommand<string[]>("presence scan", [], async (client) => {
    const ids = new Set<string>();
    let cursor = "0";
    do {
      const result = await client.scan(cursor, "MATCH", presenceScanMatch, "COUNT", 500);
      cursor = result[0];
      for (const key of result[1]) {
        if (key.includes(":socket:")) continue;
        const userId = key.slice("presence:user:".length);
        if (userId) ids.add(userId);
        if (ids.size >= limit) return [...ids];
      }
    } while (cursor !== "0");
    return [...ids];
  });
}

export async function isUserPresent(userId: string) {
  return runRedisCommand<boolean>("presence read", false, async (client) => Boolean(await client.exists(`presence:user:${userId}`)));
}

export async function consumeRedisRateLimit(key: string, limit: number, seconds: number) {
  return runRedisCommand<{ allowed: boolean; totalHits: number; resetTime: Date } | undefined>(
    "rate limit",
    undefined,
    async (client) => {
      const redisKey = `rate:${key}`;
      const totalHits = await client.incr(redisKey);
      if (totalHits === 1) await client.expire(redisKey, seconds);
      const ttl = await client.ttl(redisKey);
      const resetTime = new Date(Date.now() + Math.max(ttl, seconds, 1) * 1000);
      return { allowed: totalHits <= limit, totalHits, resetTime };
    }
  );
}

export async function getCachedJson<T>(key: string): Promise<T | undefined> {
  return runRedisCommand<T | undefined>("cache read", undefined, async (client) => {
    const raw = await client.get(key);
    return raw ? JSON.parse(raw) as T : undefined;
  });
}

export async function setCachedJson(key: string, value: unknown, seconds: number) {
  await runRedisCommand("cache write", undefined, async (client) => {
    await client.set(key, JSON.stringify(value), "EX", seconds);
  });
}

export async function invalidateCache(pattern: string) {
  await runRedisCommand("cache invalidation", undefined, async (client) => {
    let cursor = "0";
    do {
      const result = await client.scan(cursor, "MATCH", pattern);
      cursor = result[0];
      const keys = result[1];
      if (keys.length) await client.del(keys);
    } while (cursor !== "0");
  });
}
