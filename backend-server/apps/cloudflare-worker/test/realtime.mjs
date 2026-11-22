import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { io } from "socket.io-client";
import { unstable_dev } from "wrangler";

// The test provisions its own disposable loopback-only database and never
// reads the application's .env file or connects to a user-provided URI.
const workerDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const secret = `local-worker-test-${randomUUID()}`;
const sockets = [];
let replica;
let worker;
try {
  replica = await MongoMemoryReplSet.create({
    binary: { version: "8.2.6" },
    replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" }
  });
  const uri = replica.getUri();
  if (!/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) throw new Error("Expected disposable loopback MongoDB");
  await mongoose.connect(uri, { dbName: "YugmStaging" });
  const db = mongoose.connection.db;
  const users = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
  const sessions = users.map(() => new mongoose.Types.ObjectId());
  const roomId = new mongoose.Types.ObjectId();
  await db.collection("users").insertMany(users.map((id, i) => ({ _id: id, name: `Socket Test ${i}`, username: `socket_test_${i}`, tokenVersion: 1, age: 25, walletBalance: 100, isBlocked: false })));
  await db.collection("authsessions").insertMany(users.map((id, i) => ({ _id: sessions[i], userId: id, familyId: randomUUID(), refreshHash: randomUUID(), tokenVersion: 1, expiresAt: new Date(Date.now() + 3600000), revokedAt: null })));
  await db.collection("rooms").insertOne({ _id: roomId, hostId: users[0], title: "Socket Test", category: "test", language: "en", type: "VOICE", status: "LIVE", visibility: "PUBLIC", livekitRoomName: randomUUID(), createdAt: new Date() });
  await db.collection("roomparticipants").insertMany(users.slice(0, 2).map((userId, i) => ({ roomId, userId, leftAt: null, role: i ? "SPEAKER" : "HOST", seatIndex: i, micEnabled: true, moderatorMuted: false })));

  await db.collection("friendships").insertOne({ userId: users[0], friendId: users[1], status: "ACCEPTED" });

  const startWorker = (port) => unstable_dev(path.join(workerDir, "src/index.ts"), {
    config: path.join(workerDir, "wrangler.jsonc"), local: true, port,
    vars: { MONGODB_URI: uri, JWT_SECRET: secret, REDIS_URL: "", YUGM_BONDS_ENABLED: "true", LIVEKIT_URL: "ws://127.0.0.1:1", MONGODB_MEDIA_MAX_BYTES: "300" },
    logLevel: "error", experimental: { disableExperimentalWarning: true, disableDevRegistry: true }
  });
  worker = await startWorker(0);
  const address = `http://127.0.0.1:${worker.port}`;
  // /health is liveness only; /ready proves the Node runtime and dependencies started.
  const ready = await fetch(`${address}/ready`);
  assert.equal(ready.status, 200, "Worker must start with isolated MongoDB");

  function token(i) {
    return jwt.sign({ sub: users[i].toString(), sid: sessions[i].toString(), typ: "access", tokenVersion: 1 }, secret, { algorithm: "HS256", expiresIn: "1h" });
  }
  // A tiny valid PNG exercises request-scoped temporary files, GridFS and
  // public/private media access without using any external storage service.
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl61ZsAAAAASUVORK5CYII=", "base64");
  async function uploadMedia(pathname, field, actor, purpose) {
    const form = new FormData();
    if (purpose) form.append("purpose", purpose);
    form.append(field, new Blob([png], { type: "image/png" }), "test.png");
    const response = await fetch(`${address}/api/upload/${pathname}`, { method: "POST", headers: { authorization: `Bearer ${token(actor)}` }, body: form });
    const payload = await response.json();
    assert.ok(response.ok, `Media upload failed: ${JSON.stringify(payload)}`);
    return payload.data;
  }
  const cover = await uploadMedia("cover", "cover", 0);
  assert.equal(cover.storage, "mongodb");
  const publicMedia = await fetch(`${address}${cover.url}`);
  assert.equal(publicMedia.status, 200);
  assert.deepEqual(Buffer.from(await publicMedia.arrayBuffer()), png);
  const partial = await fetch(`${address}${cover.url}`, { headers: { range: "bytes=1-4" } });
  assert.equal(partial.status, 206);
  assert.deepEqual(Buffer.from(await partial.arrayBuffer()), png.subarray(1, 5));
  assert.equal((await fetch(`${address}${cover.url}`, { headers: { range: "bytes=999999-" } })).status, 416);
  const privateMedia = await uploadMedia("trust-verification", "media", 0, "FACE");
  assert.equal(privateMedia.storage, "private-mongodb");
  const privateName = privateMedia.url.split("/").pop();
  assert.equal((await fetch(`${address}/uploads/${privateName}`)).status, 404);
  assert.equal((await fetch(`${address}${privateMedia.url}`, { headers: { authorization: `Bearer ${token(1)}` } })).status, 403);
  const ownerMedia = await fetch(`${address}${privateMedia.url}`, { headers: { authorization: `Bearer ${token(0)}` } });
  assert.equal(ownerMedia.status, 200);
  assert.deepEqual(Buffer.from(await ownerMedia.arrayBuffer()), png);
  const extraUploads = await Promise.all(Array.from({ length: 3 }, () => {
    const form = new FormData();
    form.append("cover", new Blob([png], { type: "image/png" }), "test.png");
    return fetch(`${address}/api/upload/cover`, { method: "POST", headers: { authorization: `Bearer ${token(0)}` }, body: form });
  }));
  const available = Math.floor((300 - png.length * 2) / png.length);
  assert.equal(extraUploads.filter((response) => response.status === 200).length, available);
  assert.equal(extraUploads.filter((response) => response.status === 507).length, 3 - available);
  const mediaCounter = await db.collection("media.quota").findOne({ _id: "total" });
  assert.equal(mediaCounter.usedBytes, png.length * (2 + available));
  const oversized = new FormData();
  oversized.append("media", new Blob([Buffer.alloc(10 * 1024 * 1024 + 1)], { type: "image/png" }), "oversized.png");
  const oversizedResponse = await fetch(`${address}/api/upload/profile-media`, { method: "POST", headers: { authorization: `Bearer ${token(0)}` }, body: oversized });
  assert.equal(oversizedResponse.status, 413);
  async function connect(authToken) {
    const socket = io(address, { transports: ["websocket"], forceNew: true, reconnection: false, auth: { token: authToken }, timeout: 8000 });
    sockets.push(socket);
    await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
    return socket;
  }
  let first = await connect(token(0));
  let second = await connect(token(1));
  let outsider = await connect(token(2));
  const join = (socket) => socket.timeout(5000).emitWithAck("room:join", { roomId: roomId.toString() });
  assert.deepEqual(await join(first), { joined: true });
  assert.deepEqual(await join(second), { joined: true });
  assert.deepEqual(await join(outsider), { joined: false, reason: "not_a_participant" });

  async function bondApi(path, actor, payload, expected = 200) {
    const response = await fetch(address + "/api/bonds" + path, {
      method: payload ? "POST" : "GET",
      headers: { authorization: "Bearer " + token(actor), "content-type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined
    });
    assert.equal(response.status, expected);
    return (await response.json()).data;
  }
  const catalog = await bondApi("/gift-catalog", 0);
  const gift = catalog.gifts.find(item => item.kind === "BESTIE" && item.purpose === "INVITATION");
  assert.ok(gift, "Worker seeds the bond gift catalog");
  const updated = new Promise(resolve => second.once("bonds:changed", resolve));
  const request = await bondApi("/invitations", 0, {
    recipient: String(users[1]), slot: 1, kind: "BESTIE", giftId: gift.id, key: randomUUID()
  }, 201);
  let timeout;
  try {
    const event = await Promise.race([updated, new Promise((_, reject) => {
      timeout = setTimeout(() => reject(new Error("Bond socket change timed out")), 5000);
    })]);
    assert.equal(event.version, 1);
  } finally { clearTimeout(timeout); }
  const active = await bondApi(`/invitations/${request.id}/accept`, 1, {});
  assert.equal(active.status, "ACCEPTED");
  assert.equal((await bondApi("/me", 0)).balance, 100 - gift.price);
  await bondApi(`/profile/${users[0]}`, 2).then(profile => assert.deepEqual(profile.bonds, []));
  console.log("Worker Bonds verified gift reservation, acceptance, privacy and realtime delivery.");


  const typing = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Typing event timed out")), 5000);
    second.once("direct:typing:update", (value) => { clearTimeout(timeout); resolve(value); });
  });
  first.emit("direct:typing:start", { userId: users[1].toString() });
  assert.deepEqual(await typing, { userId: users[0].toString(), typing: true });

  let outsiderReceived = false;
  outsider.once("room:participant:update", () => { outsiderReceived = true; });
  const roomEvent = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Room broadcast timed out")), 5000);
    second.once("room:participant:update", (value) => { clearTimeout(timeout); resolve(value); });
  });
  const clear = await fetch(`${address}/api/rooms/${roomId}/chat/clean`, {
    method: "POST", headers: { authorization: `Bearer ${token(0)}` }
  });
  assert.equal(clear.status, 200, await clear.text());
  assert.deepEqual(await roomEvent, { roomId: roomId.toString(), action: "chat_cleared" });
  assert.equal(outsiderReceived, false, "A nonparticipant must not receive room events");

  async function pkPost(route, actor, body) {
    const response = await fetch(`${address}/api/pk${route}`, {
      method: "POST", headers: { authorization: `Bearer ${token(actor)}`, "content-type": "application/json" }, body: JSON.stringify(body)
    });
    const payload = await response.json();
    assert.ok(response.ok, `PK request failed: ${JSON.stringify(payload)}`);
    return payload.data;
  }
  const pk = await pkPost("/room-start", 0, {
    roomId: roomId.toString(), leftPlayerId: users[0].toString(), rightPlayerId: users[1].toString(), mode: "VOTE", durationSeconds: 60
  });
  const battleId = new mongoose.Types.ObjectId(pk.battle.id);
  await pkPost(`/${battleId}/ready`, 0, {});
  await pkPost(`/${battleId}/ready`, 1, {});
  async function waitForBattle(status, timeoutMs = 12000, id = battleId) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      const battle = await db.collection("pkbattles").findOne({ _id: id });
      if (battle?.status === status) return battle;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
    throw new Error(`PK did not reach ${status} before timeout`);
  }
  await waitForBattle("ACTIVE");
  // Simulate a Worker restart while PK is active. Advance the fixture's start
  // time in the disposable database while the Worker is stopped; startup must
  // recover the persisted deadline and finalize without a PK request.
  const port = worker.port;
  first.disconnect();
  second.disconnect();
  outsider.disconnect();
  await worker.stop();
  worker = undefined;
  await db.collection("pkbattles").updateOne({ _id: battleId }, { $set: { startedAt: new Date(Date.now() - 61000) } });
  worker = await startWorker(port);
  assert.equal((await fetch(`${address}/ready`)).status, 200);
  const restoredCover = await fetch(`${address}${cover.url}`);
  assert.equal(restoredCover.status, 200);
  assert.deepEqual(Buffer.from(await restoredCover.arrayBuffer()), png);
  first = await connect(token(0));
  second = await connect(token(1));
  outsider = await connect(token(2));
  assert.deepEqual(await join(first), { joined: true });
  assert.deepEqual(await join(second), { joined: true });
  await waitForBattle("COMPLETED");
  await db.collection("pkbattles").updateOne({ _id: battleId }, { $set: { endedAt: new Date(Date.now() - 61000) } });
  // A rejected PK action also recomputes the next wake-up; closure should be
  // processed by the alarm with no further requests.
  await fetch(`${address}/api/pk/${battleId}/ready`, {
    method: "POST", headers: { authorization: `Bearer ${token(0)}`, "content-type": "application/json" }, body: "{}"
  });
  await waitForBattle("CLOSED");
  const interruptedId = new mongoose.Types.ObjectId();
  await db.collection("pkbattles").insertOne({
    _id: interruptedId, battleCode: `test-${randomUUID()}`, mode: "VOTE", format: "PLAYER", status: "READY", battleType: "VOICE", durationSeconds: 60,
    startedByUserId: users[0], leftRoomId: roomId, rightRoomId: roomId, leftHostId: users[0], rightHostId: users[1],
    leftScore: 0, rightScore: 0, stateVersion: 1, createdAt: new Date(), updatedAt: new Date(Date.now() - 3000)
  });
  await fetch(`${address}/api/pk/${interruptedId}/ready`, {
    method: "POST", headers: { authorization: `Bearer ${token(0)}`, "content-type": "application/json" }, body: "{}"
  });
  await waitForBattle("ACTIVE", 12000, interruptedId);

  // Rejoin within the 15-second disconnect grace period and check that the
  // eventual cleanup does not remove a reconnected room participant.
  first.disconnect();
  first = await connect(token(0));
  assert.deepEqual(await join(first), { joined: true });

  const heartbeat = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Engine.IO heartbeat timed out")), 35000);
    first.io.engine.on("packet", function onPacket(packet) {
      if (packet.type !== "ping") return;
      clearTimeout(timeout);
      first.io.engine.off("packet", onPacket);
      resolve();
    });
  });
  await heartbeat;
  assert.equal(first.connected, true, "Socket should remain connected through heartbeat");
  assert.ok(await db.collection("roomparticipants").findOne({ roomId, userId: users[0], leftAt: null }), "Reconnected participant should remain in the room");

  const invalid = io(address, { transports: ["websocket"], forceNew: true, reconnection: false, auth: { token: "invalid" }, timeout: 8000 });
  sockets.push(invalid);
  const denied = await new Promise((resolve, reject) => {
    invalid.once("connect", () => reject(new Error("Invalid token was accepted")));
    invalid.once("connect_error", resolve);
  });
  assert.match(denied.message, /invalid token/i);
  await db.collection("authsessions").updateOne({ _id: sessions[2] }, { $set: { revokedAt: new Date() } });
  const revoked = io(address, { transports: ["websocket"], forceNew: true, reconnection: false, auth: { token: token(2) }, timeout: 8000 });
  sockets.push(revoked);
  const revocationError = await new Promise((resolve, reject) => {
    revoked.once("connect", () => reject(new Error("Revoked session was accepted")));
    revoked.once("connect_error", resolve);
  });
  assert.match(revocationError.message, /signed in on another device/i);
  assert.deepEqual(await join(second), { joined: true });
  const ended = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Room close event timed out")), 12000);
    second.once("room:ended", (value) => { clearTimeout(timeout); resolve(value); });
  });
  const [closeResponse, endedEvent] = await Promise.all([
    fetch(`${address}/api/rooms/${roomId}/end`, {
      method: "POST", headers: { authorization: `Bearer ${token(0)}` }, signal: AbortSignal.timeout(12000)
    }),
    ended
  ]);
  assert.equal(closeResponse.status, 200, await closeResponse.text());
  assert.equal(endedEvent.roomId, roomId.toString());
  assert.equal(await db.collection("roomparticipants").countDocuments({ roomId, leftAt: null }), 0);
  assert.equal((await db.collection("rooms").findOne({ _id: roomId })).status, "ENDED");
  console.log("Worker media, WebSocket authentication, room acknowledgements, broadcasts, PK alarms, reconnect and heartbeat passed with disposable MongoDB");
} finally {
  for (const socket of sockets) socket.disconnect();
  await worker?.stop();
  await mongoose.disconnect();
  await replica?.stop();
}
