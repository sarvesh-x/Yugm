import assert from "node:assert/strict";
import test from "node:test";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";
process.env.REDIS_URL = "";

const { ResilientRedisRateLimitStore } = await import("./rateLimitStore.js");

// The Cloudflare node bridge does not populate req.ip, so the rate limiter can
// receive an undefined key. Increment must still produce a usable bucket rather
// than throwing "Cannot read properties of undefined (reading 'replace')".
test("rate limit store tolerates a missing key", async () => {
  const store = new ResilientRedisRateLimitStore("auth");
  const first = await store.increment(undefined as unknown as string);
  const firstHits = first.totalHits;
  const second = await store.increment(undefined as unknown as string);

  assert.equal(firstHits, 1);
  assert.equal(second.totalHits, 2);
  assert.ok(first.resetTime instanceof Date);
});

test("rate limit store normalizes unexpected key characters", async () => {
  const store = new ResilientRedisRateLimitStore("auth-identifier");
  const key = `${"x".repeat(400)}${"\n"}${"y".repeat(10)}`;

  const result = await store.increment(key);

  assert.equal(result.totalHits, 1);
  assert.doesNotThrow(() => store.resetKey(key));
});
