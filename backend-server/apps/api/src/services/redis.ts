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
const warnedRedisCommandErrors = new Set<string>();

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
