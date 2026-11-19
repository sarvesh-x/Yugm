import assert from "node:assert/strict";
import test from "node:test";
import type { AddressInfo } from "node:net";
import type { Server } from "node:http";
import type { RequestHandler } from "express";

process.env.MONGODB_URI ??= "mongodb://127.0.0.1:27017/yugm-test";
process.env.MONGODB_DB_NAME ??= "yugm-test";
process.env.REDIS_URL = "";

const express = (await import("express")).default;
const { authLimiter, authIdentifierLimiter, refreshLimiter } = await import("./rateLimit.js");

async function withServer(
  middlewares: RequestHandler[],
  assertion: (baseUrl: string) => Promise<void>,
) {
  const app = express();
  // The Cloudflare node bridge hands Express a request without a resolved
  // remote address, which leaves req.ip undefined.
  app.use((req, _res, next) => {
    Object.defineProperty(req, "ip", { configurable: true, value: undefined });
    next();
  });
  app.use(middlewares);
  app.use(express.json());
  app.post("/probe", (_req, res) => {
    res.json({ ok: true });
  });

  const server: Server = app.listen(0, "127.0.0.1");
  await new Promise<void>((resolve) => server.once("listening", () => resolve()));
  const { port } = server.address() as AddressInfo;
  try {
    await assertion(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

async function post(baseUrl: string, body: unknown) {
  return fetch(`${baseUrl}/probe`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

// Release/staging sign-in failed with HTTP 500 "Cannot read properties of
// undefined (reading 'replace')" because the auth limiters keyed on req.ip.
test("auth rate limiters tolerate a request without ip", async () => {
  await withServer([authLimiter, authIdentifierLimiter], async (baseUrl) => {
    const response = await post(baseUrl, {});
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { ok: true });
  });
});

test("auth identifier limiter keys on the submitted email without an ip", async () => {
  await withServer([authIdentifierLimiter], async (baseUrl) => {
    const response = await post(baseUrl, { email: "user@example.com" });
    assert.equal(response.status, 200);
  });
});

test("refresh limiter tolerates a request without ip or token", async () => {
  await withServer([refreshLimiter], async (baseUrl) => {
    const response = await post(baseUrl, {});
    assert.equal(response.status, 200);
  });
});
