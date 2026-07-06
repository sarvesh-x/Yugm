import { Redis } from "ioredis";
import { env } from "../config/env.js";

function normalizeRedisUrl(rawUrl: string | undefined) {
  const value = rawUrl?.trim();
  if (!value) return undefined;

  const matches = [...value.matchAll(/rediss?:\/\//g)];
  const start = matches.at(-1)?.index;
  const candidate = start === undefined ? value : value.slice(start).trim();

  try {
    new URL(candidate);
    return candidate;
  } catch {
    console.warn("Redis disabled: REDIS_URL is not a valid URL");
    return undefined;
  }
}

const redisUrl = normalizeRedisUrl(env.REDIS_URL);

export const redis = redisUrl
  ? new Redis(redisUrl, {
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableOfflineQueue: false,
      retryStrategy: () => null
    })
  : undefined;

let warnedRedisError = false;

if (redis) {
  redis.on("error", (err) => {
    if (!warnedRedisError) {
      warnedRedisError = true;
      console.warn("Redis connection error:", err.message);
    }
  });
}

export async function connectRedis() {
  if (!redis) {
    console.log("Redis disabled: REDIS_URL is empty");
    return;
  }

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

export async function setUserPresence(userId: string, online: boolean) {
  if (!isRedisReady()) return;
  const key = `presence:user:${userId}`;
  if (online) {
    await redis!.set(key, "online", "EX", 300);
  } else {
    await redis!.del(key);
  }
}

export async function getCachedJson<T>(key: string): Promise<T | undefined> {
  if (!isRedisReady()) return undefined;
  const raw = await redis!.get(key);
  return raw ? JSON.parse(raw) as T : undefined;
}

export async function setCachedJson(key: string, value: unknown, seconds: number) {
  if (!isRedisReady()) return;
  await redis!.set(key, JSON.stringify(value), "EX", seconds);
}

export async function invalidateCache(pattern: string) {
  if (!isRedisReady()) return;
  let cursor = "0";
  do {
    const result = await redis!.scan(cursor, "MATCH", pattern);
    cursor = result[0];
    const keys = result[1];
    if (keys.length) await redis!.del(keys);
  } while (cursor !== "0");
}
