import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import dotenv from "dotenv";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";
import { io } from "socket.io-client";

// This script creates only randomly identified fixtures in the explicitly
// isolated YugmStaging database. It never reads or deletes unrelated records.
if (!process.argv.includes("--confirm-isolated-staging")) throw new Error("Explicit isolated staging confirmation is required");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const vars = dotenv.parse(await readFile(path.join(root, ".dev.vars.staging")));
if (vars.STAGING_DB_ISOLATED !== "true" || !vars.MONGODB_URI || !vars.JWT_SECRET) throw new Error("Isolated staging credentials are incomplete");
const address = "https://yugm-api-staging.sarveshkumar10101.workers.dev";
const client = new mongoose.mongo.MongoClient(vars.MONGODB_URI, { serverSelectionTimeoutMS: 10000 });
const users = [new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId(), new mongoose.Types.ObjectId()];
const sessions = users.map(() => new mongoose.Types.ObjectId());
const roomId = new mongoose.Types.ObjectId();
const sockets = [];
let db;
let cleanupError;
try {
  await client.connect();
  db = client.db("YugmStaging");
  const suffix = randomUUID();
  await db.collection("users").insertMany(users.map((id, i) => ({ _id: id, name: `Staging fixture ${i}`, username: `staging_${suffix}_${i}`, tokenVersion: 1, isBlocked: false })));
  await db.collection("authsessions").insertMany(users.map((id, i) => ({ _id: sessions[i], userId: id, familyId: randomUUID(), refreshHash: randomUUID(), tokenVersion: 1, expiresAt: new Date(Date.now() + 3600000), revokedAt: null })));
  await db.collection("rooms").insertOne({ _id: roomId, hostId: users[0], title: "Temporary staging fixture", category: "test", language: "en", type: "VOICE", status: "LIVE", visibility: "PUBLIC", livekitRoomName: `fixture-${suffix}`, createdAt: new Date() });
  await db.collection("roomparticipants").insertMany(users.slice(0, 2).map((userId, i) => ({ roomId, userId, leftAt: null, role: i ? "SPEAKER" : "HOST", seatIndex: i, micEnabled: true, moderatorMuted: false })));

  const health = await fetch(`${address}/health`, { signal: AbortSignal.timeout(30000) });
  assert.equal(health.status, 200, "Staging health check failed");
  function token(i) { return jwt.sign({ sub: users[i].toString(), sid: sessions[i].toString(), typ: "access", tokenVersion: 1 }, vars.JWT_SECRET, { algorithm: "HS256", expiresIn: "1h" }); }
  async function connect(authToken) {
    const socket = io(address, { transports: ["websocket"], forceNew: true, reconnection: false, auth: { token: authToken }, timeout: 15000 });
    sockets.push(socket);
    socket.on("disconnect", (reason) => console.log(`Staging socket disconnected: ${reason}`));
    await new Promise((resolve, reject) => { socket.once("connect", resolve); socket.once("connect_error", reject); });
    return socket;
  }
  const first = await connect(token(0));
  const second = await connect(token(1));
  const outsider = await connect(token(2));
  const join = (socket) => socket.timeout(10000).emitWithAck("room:join", { roomId: roomId.toString() });
  assert.deepEqual(await join(first), { joined: true });
  assert.deepEqual(await join(second), { joined: true });
  assert.deepEqual(await join(outsider), { joined: false, reason: "not_a_participant" });

  const typing = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Staging typing event timed out")), 10000);
    second.once("direct:typing:update", (value) => { clearTimeout(timeout); resolve(value); });
  });
  first.emit("direct:typing:start", { userId: users[1].toString() });
  assert.deepEqual(await typing, { userId: users[0].toString(), typing: true });

  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl61ZsAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.append("cover", new Blob([png], { type: "image/png" }), "fixture.png");
  const upload = await fetch(`${address}/api/upload/cover`, { method: "POST", headers: { authorization: `Bearer ${token(0)}` }, body: form, signal: AbortSignal.timeout(30000) });
  assert.equal(upload.status, 200, "Staging cover upload failed");
  const uploaded = (await upload.json()).data;
  assert.equal(uploaded.storage, "mongodb");
  const media = await fetch(`${address}${uploaded.url}`, { signal: AbortSignal.timeout(30000) });
  assert.equal(media.status, 200, "Staging media download failed");
  assert.deepEqual(Buffer.from(await media.arrayBuffer()), png);

  async function pkPost(route, actor, body, expected = 200) {
    const response = await fetch(`${address}/api/pk${route}`, {
      method: "POST", headers: { authorization: `Bearer ${token(actor)}`, "content-type": "application/json" },
      body: JSON.stringify(body), signal: AbortSignal.timeout(30000)
    });
    assert.equal(response.status, expected, "Staging PK request failed");
    return (await response.json()).data;
  }
  const created = await pkPost("/room-start", 0, {
    roomId: roomId.toString(), leftPlayerId: users[0].toString(), rightPlayerId: users[1].toString(), mode: "VOTE", durationSeconds: 60
  }, 201);
  const battleId = new mongoose.Types.ObjectId(created.battle.id);
  await pkPost(`/${battleId}/ready`, 0, {});
  await pkPost(`/${battleId}/ready`, 1, {});
  async function waitForBattle(status) {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const battle = await db.collection("pkbattles").findOne({ _id: battleId });
      if (battle?.status === status) return;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    throw new Error(`Staging PK did not reach ${status}`);
  }
  await waitForBattle("ACTIVE");
  console.log("Staging PK entered ACTIVE");
  // Only this test-owned staging record is adjusted to avoid a 60-second wait.
  await db.collection("pkbattles").updateOne({ _id: battleId }, { $set: { startedAt: new Date(Date.now() - 61000) } });
  await waitForBattle("COMPLETED");
  console.log(`Staging PK completed; room sockets connected: ${first.connected}, ${second.connected}`);

  const ended = new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Staging room close event timed out")), 10000);
    second.once("room:ended", (value) => { clearTimeout(timeout); resolve(value); });
  });
  const closeStarted = Date.now();
  const close = await fetch(`${address}/api/rooms/${roomId}/end`, { method: "POST", headers: { authorization: `Bearer ${token(0)}` }, signal: AbortSignal.timeout(30000) });
  assert.equal(close.status, 200, "Staging room close failed");
  assert.equal((await ended).roomId, roomId.toString());
  console.log(`Staging room close response and event: ${Date.now() - closeStarted} ms`);
  assert.equal(await db.collection("roomparticipants").countDocuments({ roomId, leftAt: null }), 0);
  console.log("Cloudflare staging health, WebSocket auth, room join, user event, MongoDB media, PK alarms and room close passed.");
} finally {
  for (const socket of sockets) socket.disconnect();
  if (db) {
    try {
      const bucket = new mongoose.mongo.GridFSBucket(db, { bucketName: "media" });
      const files = await bucket.find({ "metadata.publicName": { $regex: `^${users[0].toString()}_` } }).toArray();
      for (const file of files) {
        await bucket.delete(file._id);
        await db.collection("media.quota").updateOne({ _id: "total", usedBytes: { $gte: file.length } }, { $inc: { usedBytes: -file.length } });
      }
      const battles = await db.collection("pkbattles").find({ startedByUserId: users[0], leftRoomId: roomId }).project({ _id: 1 }).toArray();
      const battleIds = battles.map((battle) => battle._id);
      if (battleIds.length) {
        for (const collection of ["pkevents", "pkinvites", "pkparticipants", "pkvotes", "pkleaderboardentries"]) {
          await db.collection(collection).deleteMany({ battleId: { $in: battleIds } });
        }
        await db.collection("pkbattles").deleteMany({ _id: { $in: battleIds }, startedByUserId: users[0], leftRoomId: roomId });
      }
      await db.collection("roomparticipants").deleteMany({ roomId });
      await db.collection("rooms").deleteOne({ _id: roomId });
      await db.collection("authsessions").deleteMany({ _id: { $in: sessions } });
      await db.collection("users").deleteMany({ _id: { $in: users } });
    } catch (error) {
      cleanupError = error;
    }
  }
  await client.close();
  if (cleanupError) throw new Error(`Could not remove staging test fixtures: ${cleanupError.name}`);
}
