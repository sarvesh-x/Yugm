import assert from "node:assert/strict";
import test from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";
process.env.REDIS_URL = "redis://127.0.0.1:6390";

const redisService = await import("./redis.js");

test("redis helpers are safe when redis is configured but unavailable", async () => {
  await redisService.connectRedis();

  await assert.doesNotReject(() => redisService.invalidateCache("rooms:*"));
  await assert.doesNotReject(() => redisService.setCachedJson("rooms:list:{}", { rooms: [] }, 1));
  assert.equal(await redisService.getCachedJson("rooms:list:{}"), undefined);
  await assert.doesNotReject(() => redisService.setUserPresence("user-1", true));

  assert.equal(redisService.getRedisHealth().ready, false);
});

test("redis helpers swallow command failures after a transient ready check", async () => {
  assert.ok(redisService.redis, "redis should be configured for this test");

  Object.defineProperty(redisService.redis, "status", { value: "ready", configurable: true });
  redisService.redis.get = async () => {
    throw new Error("forced get failure");
  };
  redisService.redis.set = async () => {
    throw new Error("forced set failure");
  };
  redisService.redis.scan = async () => {
    throw new Error("forced scan failure");
  };
  redisService.redis.del = async () => {
    throw new Error("forced del failure");
  };

  assert.equal(await redisService.getCachedJson("rooms:list:{}"), undefined);
  await assert.doesNotReject(() => redisService.setCachedJson("rooms:list:{}", { rooms: [] }, 1));
  await assert.doesNotReject(() => redisService.invalidateCache("rooms:*"));
  await assert.doesNotReject(() => redisService.setUserPresence("user-1", true));

  redisService.redis.disconnect();
});
