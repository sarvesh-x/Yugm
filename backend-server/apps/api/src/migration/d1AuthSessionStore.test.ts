import assert from "node:assert/strict";
import { once } from "node:events";
import { mkdtemp, readFile, rmdir, unlink, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type { D1Database } from "@cloudflare/workers-types";
import express, { type ErrorRequestHandler } from "express";
import jwt from "jsonwebtoken";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";
import { Server as SocketServer } from "socket.io";
import { io as connectSocket, type Socket as ClientSocket } from "socket.io-client";
import { getPlatformProxy, unstable_splitSqlQuery } from "wrangler";
import { createD1AuthSessionStore } from "./d1AuthSessionStore.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { D1TargetWriter } from "./d1Target.js";
import { applyMapping } from "./mappings.js";
import { stableStringify } from "./snapshot.js";
import { TransformContext } from "./transform.js";

function waitForSocketEvent(socket: ClientSocket, event: string): Promise<unknown[]> {
  return new Promise((resolve, reject) => {
    const onEvent = (...args: unknown[]) => {
      clearTimeout(timer);
      resolve(args);
    };
    const timer = setTimeout(() => {
      socket.off(event, onEvent);
      reject(new Error(`Timed out waiting for ${event}`));
    }, 3_000);
    socket.once(event, onEvent);
  });
}

test("session service runs against MongoDB and the local D1 adapter", async (t) => {
  const database = await MongoMemoryServer.create();
  t.after(async () => {
    await mongoose.disconnect();
    await database.stop();
  });
  const uri = database.getUri("yugm-session-parity");
  const secret = "local-auth-session-fixture-secret";
  process.env.NODE_ENV = "test";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.MONGODB_URI = uri;
  process.env.REDIS_URL = "";
  process.env.JWT_SECRET = secret;
  process.env.ACCESS_TOKEN_TTL = "45m";
  const [{ User }, { AuthSession }, { mongoAuthSessionStore }, { issueSession, rotateRefresh, logoutSession, hashRefresh }] =
    await Promise.all([
      import("../models/User.js"),
      import("../models/AuthSession.js"),
      import("../services/mongoAuthSessionStore.js"),
      import("../services/tokens.js")
    ]);
  await mongoose.connect(uri);

  const directory = await mkdtemp(join(tmpdir(), "yugm-session-d1-"));
  const configPath = join(directory, "wrangler.jsonc");
  await writeFile(configPath, JSON.stringify({
    name: "yugm-session-d1-test",
    compatibility_date: "2026-08-04",
    d1_databases: [{ binding: "DB", database_name: "session-fixture", database_id: "00000000-0000-4000-8000-000000000003" }]
  }));
  t.after(async () => {
    await unlink(configPath);
    await rmdir(directory);
  });
  const platform = await getPlatformProxy<{ DB: D1Database }>({
    configPath, envFiles: [], remoteBindings: false, persist: false
  });
  t.after(() => platform.dispose());
  const db = platform.env.DB;
  const ddl = await readFile(new URL("../../migrations/d1/0001_initial.sql", import.meta.url), "utf8");
  await db.batch(unstable_splitSqlQuery(ddl).map((sql) => db.prepare(sql)));
  const d1Store = createD1AuthSessionStore(db);
  const writer = new D1TargetWriter(db);
  const context = new TransformContext("session-fixture");
  const request = { ip: "127.0.0.1", get: (header: string) => header === "user-agent" ? "fixture-client" : undefined };

  async function seedUser(username: string, tokenVersion = 0) {
    const user = await User.create({ name: "Fixture User", username, tokenVersion });
    const source = await User.findById(user.id).lean();
    const mapped = applyMapping("users", JSON.parse(stableStringify(source)), context);
    assert.equal(mapped.rejected, false);
    await writer.writeBatch(mapped.writes);
    return { id: String(user.id), tokenVersion, role: user.role };
  }

  function expectAuthError(message: string) {
    return { status: 401, message };
  }

  for (const [name, store] of [["mongo", mongoAuthSessionStore], ["d1", d1Store]] as const) {
    await t.test(`${name} sign-in, refresh, replay and scoped logout follow the session contract`, async () => {
      const user = await seedUser(`session_${name}`);
      const other = await seedUser(`other_${name}`);
      const otherSession = await issueSession(other, request, store);
      const first = await issueSession(user, request, store);
      assert.equal(first.token, first.accessToken);
      assert.equal(first.expiresIn, 2_700);
      const claims = jwt.verify(first.accessToken, secret, { algorithms: ["HS256"] });
      assert.ok(typeof claims === "object");
      assert.deepEqual(
        [claims.sub, claims.sid, claims.typ, claims.tokenVersion],
        [user.id, first.sessionId, "access", 1]
      );

      const rotated = await rotateRefresh(first.refreshToken, request, store);
      const old = await store.findRefreshSession(hashRefresh(first.refreshToken));
      const replacement = await store.findRefreshSession(hashRefresh(rotated.refreshToken));
      assert.equal(old?.replacedByHash, hashRefresh(rotated.refreshToken));
      assert.equal(replacement?.familyId, old?.familyId);
      assert.equal(replacement?.tokenVersion, 1);
      await assert.rejects(rotateRefresh(first.refreshToken, request, store), expectAuthError("Refresh token reuse detected"));
      await assert.rejects(rotateRefresh(rotated.refreshToken, request, store), expectAuthError("Refresh token reuse detected"));

      const login = await issueSession(user, request, store);
      const current = await issueSession(user, request, store);
      assert.equal(user.tokenVersion, 3);
      await assert.rejects(rotateRefresh(login.refreshToken, request, store), expectAuthError("This account was signed in on another device"));
      await logoutSession(user.id, otherSession.refreshToken, store);
      assert.equal((await store.findAccount(user.id))?.tokenVersion, 4);
      assert.ok((await store.findRefreshSession(hashRefresh(current.refreshToken)))?.revokedAt);
      assert.ok(await rotateRefresh(otherSession.refreshToken, request, store));
    });
  }

  await t.test("legacy missing, null and zero generations hydrate and revoke like Mongo", async () => {
    const user = await seedUser("legacy_generations", 5);
    const generations = [{}, { tokenVersion: null }, { tokenVersion: 0 }] as const;
    const hashes: string[] = [];
    for (const [index, generation] of generations.entries()) {
      const raw = `legacy-fixture-refresh-secret-${index}`;
      const source = {
        _id: new mongoose.Types.ObjectId(), userId: new mongoose.Types.ObjectId(user.id),
        familyId: `family-${index}`, refreshHash: hashRefresh(raw), expiresAt: new Date(Date.now() + 60_000),
        lastUsedAt: new Date(), ...generation
      };
      hashes.push(source.refreshHash);
      await AuthSession.collection.insertOne(source);
      const mapped = applyMapping("auth_sessions", JSON.parse(stableStringify(source)), context);
      assert.equal(mapped.rejected, false);
      await writer.writeBatch(mapped.writes);
      assert.deepEqual(await d1Store.findRefreshSession(source.refreshHash), await mongoAuthSessionStore.findRefreshSession(source.refreshHash));
      const claims = { sub: user.id, sid: source._id.toString(), tokenVersion: user.tokenVersion };
      const http = await createD1AccessSessionReader(db, "http")(claims);
      const socket = await createD1AccessSessionReader(db, "socket")(claims);
      assert.equal(http.session?.tokenVersion, index === 1 ? null : 0);
      assert.equal(socket.session?.tokenVersion, index === 2 ? 0 : null);
    }
    // An explicit null inherits the current generation for refresh. An omitted
    // field hydrates to the old Mongoose default and is revoked by a fresh login.
    await issueSession({ ...user }, request, mongoAuthSessionStore);
    await issueSession({ ...user }, request, d1Store);
    for (const [index, hash] of hashes.entries()) {
      const expectedRevoked = index !== 1;
      assert.equal(Boolean((await mongoAuthSessionStore.findRefreshSession(hash))?.revokedAt), expectedRevoked);
      assert.equal(Boolean((await d1Store.findRefreshSession(hash))?.revokedAt), expectedRevoked);
    }
    for (const store of [mongoAuthSessionStore, d1Store]) {
      const rotated = await rotateRefresh("legacy-fixture-refresh-secret-1", request, store);
      assert.equal((await store.findRefreshSession(hashRefresh(rotated.refreshToken)))?.tokenVersion, 6);
    }
  });

  await t.test("D1 overlapping refresh requests leave the replayed family revoked", { timeout: 5_000 }, async () => {
    const user = await seedUser("overlapping_refresh");
    const session = await issueSession(user, request, d1Store);
    const otherAdapter = createD1AuthSessionStore(db);
    // Hold both reads until they have each seen the active predecessor.
    let release!: () => void;
    const gate = new Promise<void>((resolve) => { release = resolve; });
    let reads = 0;
    const holdInitialRead = (adapter: typeof d1Store): typeof d1Store => ({
      ...adapter,
      async findRefreshSession(hash) {
        const found = await adapter.findRefreshSession(hash);
        if (++reads === 2) release();
        await gate;
        return found;
      }
    });
    const [first, second] = await Promise.allSettled([
      rotateRefresh(session.refreshToken, request, holdInitialRead(d1Store)),
      rotateRefresh(session.refreshToken, request, holdInitialRead(otherAdapter))
    ]);
    const [success, rejected] = first.status === "fulfilled" ? [first, second] : [second, first];
    assert.ok(success.status === "fulfilled" && rejected.status === "rejected");
    assert.match(rejected.reason.message, /Refresh token reuse detected/);
    const { refreshToken } = success.value;
    await assert.rejects(rotateRefresh(refreshToken, request, otherAdapter), expectAuthError("Refresh token reuse detected"));
  });

  await t.test("D1 overlapping sign-ins retain one current account generation", async () => {
    const user = await seedUser("overlapping_login");
    const otherAdapter = createD1AuthSessionStore(db);
    const sessions = await Promise.all([
      issueSession({ ...user }, request, d1Store),
      issueSession({ ...user }, request, otherAdapter)
    ]);
    const rows = await Promise.all(sessions.map(({ refreshToken }) => d1Store.findRefreshSession(hashRefresh(refreshToken))));
    assert.deepEqual(rows.map((row) => row?.tokenVersion).sort(), [1, 2]);
    assert.deepEqual(rows.filter((row) => row && !row.revokedAt).map((row) => row?.tokenVersion), [2]);
  });

  await t.test("D1 rolls back generation and refresh claims when the next write fails", async () => {
    const user = await seedUser("session_rollback");
    const first = await issueSession(user, request, d1Store);
    const hash = hashRefresh(first.refreshToken);
    const session = await d1Store.findRefreshSession(hash);
    assert.ok(session);
    const next = { refreshHash: hash, expiresAt: session.expiresAt };
    await assert.rejects(d1Store.issue(user.id, "second-family", next, new Date()), /UNIQUE constraint failed/);
    assert.equal((await d1Store.findAccount(user.id))?.tokenVersion, 1);
    assert.equal((await d1Store.findRefreshSession(hash))?.revokedAt, null);
    await assert.rejects(d1Store.rotate(session, 1, next, new Date()), /UNIQUE constraint failed/);
    assert.deepEqual(await d1Store.findRefreshSession(hash), session);
    assert.ok(await rotateRefresh(first.refreshToken, request, d1Store));
  });

  await t.test("D1 import retries update the same source row and surface duplicate refresh hashes", async () => {
    const user = await seedUser("session_import_retry");
    const source = {
      _id: "507f1f77bcf86cd799439011", userId: user.id, familyId: "import-family",
      refreshHash: "duplicate-hash-fixture", expiresAt: new Date(Date.now() + 60_000), lastUsedAt: new Date()
    };
    const original = applyMapping("auth_sessions", source, context);
    const duplicate = applyMapping("auth_sessions", { ...source, _id: "507f1f77bcf86cd799439012" }, context);
    await writer.writeBatch(original.writes);
    await writer.writeBatch(original.writes);
    await assert.rejects(writer.writeBatch(duplicate.writes), /UNIQUE constraint failed/);
    assert.equal((await d1Store.findRefreshSession(source.refreshHash))?.id, source._id);
  });

  await t.test("the existing Mongo HTTP and Socket.IO entry points accept a current session", async (fixture) => {
    const [{ createApp }, { initSocket, closeSocketInfrastructure }] = await Promise.all([
      import("../app.js"), import("../services/socket.js")
    ]);
    const server = createServer(createApp());
    const io = await initSocket(server);
    fixture.after(async () => {
      await io.close();
      await closeSocketInfrastructure();
    });
    server.listen(0, "127.0.0.1");
    await once(server, "listening");
    const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const user = await seedUser("mongo_transport_auth");
    const session = await issueSession(user, request, mongoAuthSessionStore);
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    const response = await fetch(`${origin}/api/auth/me`, { headers, signal: AbortSignal.timeout(3_000) });
    assert.equal(response.status, 200);
    const { data } = await response.json() as { data: { user: { id: string } } };
    assert.equal(data.user.id, user.id);

    const client = connectSocket(origin, {
      autoConnect: false, transports: ["websocket"], auth: { token: session.accessToken }, reconnection: false, timeout: 2_000
    });
    fixture.after(() => { client.disconnect(); });
    const connected = waitForSocketEvent(client, "connect");
    client.connect();
    await connected;
    assert.equal(io.sockets.sockets.get(client.id!)?.data.userId, user.id);
    assert.equal(io.sockets.sockets.get(client.id!)?.data.sessionId, session.sessionId);
  });

  await t.test("D1 access checks current state across independent local HTTP and socket servers", async (fixture) => {
    const [{ createHttpSessionAuth }, { createSocketSessionAuth }, { HttpError, asyncHandler }] =
      await Promise.all([
        import("../middleware/httpAccessSession.js"),
        import("../services/socketAccessSession.js"),
        import("../utils/http.js")
      ]);

    async function startServer() {
      const app = express();
      const store = createD1AuthSessionStore(db);
      const http = createHttpSessionAuth(createD1AccessSessionReader(db, "http"), (_req, res, user) => {
        res.locals.userId = user.id;
      });
      app.get("/required", http.required, (_req, res) => res.json({ userId: res.locals.userId }));
      app.get("/optional", http.optional, (_req, res) => res.json({ userId: res.locals.userId ?? null }));
      app.post("/logout", http.required, asyncHandler(async (_req, res) => {
        await logoutSession(res.locals.userId, undefined, store);
        res.sendStatus(204);
      }));
      const handleError: ErrorRequestHandler = (error, _req, res, _next) => {
        const status = error instanceof HttpError ? error.status : 500;
        res.status(status).json({ message: error.message });
      };
      app.use(handleError);
      const server = createServer(app);
      const io = new SocketServer(server);
      io.use(createSocketSessionAuth(createD1AccessSessionReader(db, "socket"), true));
      let packets = 0;
      io.on("connection", (socket) => {
        socket.on("fixture:ping", (ack: (userId: string) => void) => {
          packets++;
          ack(socket.data.userId);
        });
      });
      fixture.after(async () => { await io.close(); });
      server.listen(0, "127.0.0.1");
      await once(server, "listening");
      const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
      function request(path: string, token?: string, method = "GET") {
        return fetch(origin + path, {
          method, headers: token === undefined ? {} : { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(3_000)
        });
      }
      function socket(token: string) {
        const client = connectSocket(origin, {
          autoConnect: false, transports: ["websocket"], auth: { token }, reconnection: false, timeout: 2_000
        });
        fixture.after(() => { client.disconnect(); });
        return client;
      }
      return { request, socket, packets: () => packets };
    }

    const [first, second] = await Promise.all([startServer(), startServer()]);
    const user = await seedUser("d1_transport_auth");
    const other = await seedUser("d1_transport_other");
    const session = await issueSession(user, request, d1Store);
    const otherSession = await issueSession(other, request, d1Store);
    const connected = second.socket(session.accessToken);
    const ready = waitForSocketEvent(connected, "connect");
    connected.connect();
    await ready;
    assert.equal(await connected.timeout(2_000).emitWithAck("fixture:ping"), user.id);
    assert.deepEqual(await (await second.request("/required", session.accessToken)).json(), { userId: user.id });
    assert.deepEqual(await (await second.request("/optional", session.accessToken)).json(), { userId: user.id });

    const signedForDifferentAccount = jwt.sign({
      sub: other.id, sid: session.sessionId, typ: "access", tokenVersion: other.tokenVersion
    }, secret, { expiresIn: "1m" });
    const mismatch = await second.request("/required", signedForDifferentAccount);
    assert.equal(mismatch.status, 401);
    assert.deepEqual(await mismatch.json(), { message: "Session revoked" });

    const suspendedUntil = new Date(Date.now() + 60_000).toISOString();
    await db.prepare("UPDATE users SET suspended_until = ? WHERE source_id = ?").bind(suspendedUntil, user.id).run();
    const suspended = await second.request("/required", session.accessToken);
    assert.equal(suspended.status, 403);
    assert.deepEqual(await suspended.json(), { message: `Account suspended until ${suspendedUntil}` });
    await db.prepare("UPDATE users SET suspended_until = NULL WHERE source_id = ?").bind(user.id).run();

    assert.equal((await first.request("/logout", session.accessToken, "POST")).status, 204);
    const revoked = await second.request("/required", session.accessToken);
    assert.equal(revoked.status, 401);
    assert.deepEqual(await revoked.json(), { message: "Session revoked" });
    assert.deepEqual(await (await second.request("/optional", session.accessToken)).json(), { userId: null });
    assert.equal((await second.request("/required", otherSession.accessToken)).status, 200);

    const disconnected = waitForSocketEvent(connected, "disconnect");
    connected.emit("fixture:ping", () => {});
    const [reason] = await disconnected;
    assert.equal(reason, "io server disconnect");
    assert.equal(second.packets(), 1);

    const retry = second.socket(session.accessToken);
    const rejected = waitForSocketEvent(retry, "connect_error");
    retry.connect();
    const [error] = await rejected;
    assert.ok(error instanceof Error);
    assert.equal(error.message, "This account was signed in on another device");

    await db.prepare("UPDATE users SET is_blocked = 1, moderation_reason = ? WHERE source_id = ?").bind("Fixture block", other.id).run();
    const blocked = await second.request("/required", otherSession.accessToken);
    assert.equal(blocked.status, 401);
    assert.deepEqual(await blocked.json(), { message: "Fixture block" });
    await db.prepare("UPDATE users SET is_blocked = 0 WHERE source_id = ?").bind(other.id).run();
    await db.prepare("UPDATE auth_sessions SET expires_at = ? WHERE source_id = ?")
      .bind(new Date(Date.now() - 1_000).toISOString(), otherSession.sessionId).run();
    const expired = await second.request("/required", otherSession.accessToken);
    assert.equal(expired.status, 401);
    assert.deepEqual(await expired.json(), { message: "Session revoked" });
  });
  context.assertAccountedFor();
  assert.deepEqual(context.quarantine, []);
});
