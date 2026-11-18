import assert from "node:assert/strict";
import { randomUUID, createHmac } from "node:crypto";
import http from "node:http";
import { after, before, beforeEach, test } from "node:test";
import type { AddressInfo } from "node:net";
import express from "express";
import mongoose from "mongoose";

const dbName = process.env.MONGODB_DB_NAME ?? "";
const uri = process.env.MONGODB_URI ?? "";
if (process.env.YUGM_HARDENING_TEST !== "1" || !/^yugm_hardening_[a-f0-9]{32}$/.test(dbName) ||
    !/^mongodb:\/\/127\.0\.0\.1:\d+\//.test(uri)) {
  throw new Error("Run only through test/run-hardening.mjs with its isolated loopback replica set");
}

const { User } = await import("../models/User.js");
const { Bond, BondRequest, BondPoint, BondReward, BondRankingSnapshot } = await import("../models/Bond.js");
const { Friendship } = await import("../models/Friendship.js");
const { Block } = await import("../models/Block.js");
const { bondsRouter } = await import("../routes/bonds.js");
const { blockBondPair, endUnavailableBonds, expireBondRequests, setBondPreferences } = await import("../services/bonds.js");
const { runBondMaintenance, expireBondRewards } = await import("../services/bondProgress.js");
const { dayMs, weeklyPeriod } = await import("../services/bondRules.js");
const { WalletTransaction } = await import("../models/WalletTransaction.js");
const { GiftTransaction } = await import("../models/GiftTransaction.js");
const { GiftInventory } = await import("../models/GiftInventory.js");
const { Gift } = await import("../models/Gift.js");
const { Room } = await import("../models/Room.js");
const { RoomParticipant } = await import("../models/RoomParticipant.js");
const { SpeakerRequest } = await import("../models/SpeakerRequest.js");
const { RoomFollow } = await import("../models/RoomFollow.js");
const { roomsRouter } = await import("../routes/rooms.js");
const { reactionsRouter } = await import("../routes/reactions.js");
const { livekitRouter } = await import("../routes/livekit.js");
const { mediaProvider } = await import("../services/livekit.js");
const { syncInvalidation } = await import("../middleware/syncInvalidation.js");
const { TrackSource } = await import("livekit-server-sdk");
const { AuthSession } = await import("../models/AuthSession.js");
const { UserSafetyStatus } = await import("../models/UserSafetyStatus.js");
const { Referral } = await import("../models/Referral.js");
const { ImmersiveTheme } = await import("../models/ImmersiveTheme.js");
const { creditWallet, debitWallet } = await import("../services/wallet.js");
const { claimReferral } = await import("../services/referrals.js");
const { purchaseTheme, assertThemeEntitlement } = await import("../services/themePurchase.js");
const { signAccessToken } = await import("../services/tokens.js");
const { giftsRouter } = await import("../routes/gifts.js");
const { walletRouter } = await import("../routes/wallet.js");
const { roomThemesRouter } = await import("../routes/roomThemes.js");
const { referralsRouter } = await import("../routes/referrals.js");
const { eventsRouter } = await import("../routes/events.js");
const { Event } = await import("../models/Event.js");
const { Purchase } = await import("../models/Purchase.js");
const { creditPurchase } = await import("../services/purchaseCredit.js");
const { markPurchasePaid } = await import("../services/purchaseState.js");
const { handlePaymentWebhook } = await import("../services/paymentWebhook.js");
const { Achievement } = await import("../models/Achievement.js");
const { AdminUser } = await import("../models/AdminUser.js");
const { AdminAuditLog } = await import("../models/AdminAuditLog.js");
const { requireAdminAuth, signAdminAccessToken } = await import("../middleware/adminAuth.js");
const { experienceRouter } = await import("../routes/experience.js");
const { adminBadgesRouter, badgeArtRouter } = await import("../routes/adminBadges.js");
const { awardWeeklyHonors, badgeCatalog, weeklyHonorWindow, wornBadges } = await import("../services/badges.js");

let server: http.Server;
let baseUrl: string;
before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  // Real production schema indexes, applied only inside the owned test replica.
  for (const model of [User, AuthSession, WalletTransaction, GiftTransaction, GiftInventory, Gift, Room, RoomParticipant, SpeakerRequest, RoomFollow, Referral, ImmersiveTheme, UserSafetyStatus, Event, Purchase, Achievement, AdminUser, AdminAuditLog, Bond, BondRequest, BondPoint, BondReward, BondRankingSnapshot, Friendship, Block]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const app = express();
  app.post("/webhook-test", express.raw({ type: "application/json" }), (req, res, next) => { void handlePaymentWebhook(req, res).catch(next); });
  app.use(express.json());
  app.use("/api", syncInvalidation);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/bonds", bondsRouter);
  app.use("/api", reactionsRouter);
  app.use("/api/livekit", livekitRouter);
  app.use("/api/experience", experienceRouter);
  app.use("/api/admin", requireAdminAuth, adminBadgesRouter);
  app.use("/api/badge-art", badgeArtRouter);
  app.use("/api/events", eventsRouter);
  app.use("/api", eventsRouter);
  app.use("/api", giftsRouter, walletRouter, roomThemesRouter, referralsRouter);
  app.use((error: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    res.status(error.status ?? 500).json({ ok: false, error: { message: error.message, code: error.code } });
  });
  server = app.listen(0, "127.0.0.1");
  await new Promise<void>(resolve => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api`;
});
beforeEach(async () => {
  // The runner-generated database is the only allowed deletion target.
  assert.equal(mongoose.connection.name, dbName);
  for (const collection of Object.values(mongoose.connection.collections)) await collection.deleteMany({});
});
after(async () => {
  if (server) await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  await mongoose.disconnect();
});

async function user(balance = 1000, extra: Record<string, unknown> = {}) {
  const suffix = randomUUID();
  return User.create({ name: "Test user", username: `test_${suffix}`, walletBalance: balance, ...extra });
}
async function tokenFor(actor: InstanceType<typeof User>) {
  const session = await AuthSession.create({ userId: actor._id, familyId: randomUUID(), refreshHash: randomUUID(), expiresAt: new Date(Date.now() + 3600000), tokenVersion: actor.tokenVersion });
  return signAccessToken(actor, session.id);
}
async function post(route: string, token: string, body: unknown) {
  const response = await fetch(`${baseUrl}${route}`, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: response.status, body: await response.json() as any };
}
async function theme(coins = 100, diamonds = 0) {
  return ImmersiveTheme.create({ key: `test_${randomUUID()}`, name: "Test theme", type: "room_background", category: "test", price: { coins, diamonds }, colors: [] });
}
function httpStatus(status: number) {
  return (error: unknown) => typeof error === "object" && error !== null && "status" in error && error.status === status;
}

async function get(route: string, token: string) {
  const response = await fetch(`${baseUrl}${route}`, { headers: { authorization: `Bearer ${token}` } });
  return { status: response.status, body: await response.json() as any };
}

test("reaction catalog and room submission agree on VIP access", async () => {
  const future = new Date(Date.now() + 3600000);
  const past = new Date(Date.now() - 3600000);
  const actors = await Promise.all([
    user(),
    user(1000, { vipLevel: 2, vipExpiresAt: future }),
    user(1000, { vipLevel: 3, vipExpiresAt: future }),
    user(1000, { vipTier: "VIP3", vipExpiresAt: future }),
    user(1000, { vipLevel: 3, vipExpiresAt: future, vipFrozen: true }),
    user(1000, { vipLevel: 3, vipExpiresAt: past })
  ]);
  const room = await Room.create({
    title: "Reaction test room", hostId: actors[0]._id, type: "VOICE",
    category: "test", language: "English", status: "LIVE", livekitRoomName: randomUUID()
  });
  await RoomParticipant.insertMany(actors.map((actor, index) => ({
    roomId: room._id, userId: actor._id, role: index === 0 ? "HOST" : "AUDIENCE"
  })));
  const tokens = await Promise.all(actors.map(tokenFor));

  for (const [index, token] of tokens.entries()) {
    const eligible = index === 2 || index === 3;
    const catalog = await get("/reactions", token);
    assert.equal(catalog.status, 200);
    const reactions = catalog.body.data.reactions as Array<{ id: string; usable: boolean; lockedReason: string | null }>;
    assert.equal(reactions.find(reaction => reaction.id === "wave")?.usable, true);
    const exclusive = reactions.find(reaction => reaction.id === "vip_diamond");
    assert.equal(exclusive?.usable, eligible);
    assert.equal(exclusive?.lockedReason, eligible ? null : "VIP");

    const sent = await post(`/rooms/${room.id}/reactions`, token, { type: "vip_diamond" });
    assert.equal(sent.status, eligible ? 201 : 403);
    if (eligible) assert.equal(sent.body.data.reaction.reactionId, "vip_diamond");
  }
  const free = await post(`/rooms/${room.id}/reactions`, tokens[0], { type: "wave" });
  assert.equal(free.status, 201);
  assert.equal(free.body.data.reaction.reactionId, "wave");
});

test("badge gallery grants qualifying levels once, caps automatic wear, and preserves an unwear choice", async () => {
  const actor = await user();
  const viewer = await user();
  const [token, viewerToken] = await Promise.all([actor, viewer].map(tokenFor));
  const tiers = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER"].map((tier, index) => ({
    tier, target: (index + 1) * 10, rewardCoins: 0
  }));
  // Name and username are two of the seven profile fields. Add enough
  // progress to hit all six tiers on one badge and have a locked badge too.
  await User.updateOne({ _id: actor._id }, { $set: { bio: "Test", city: "Test", avatar: "https://example.com/avatar.png" } });
  await Achievement.insertMany(["first", "second", "third", "fourth", "locked"].map((id, i) => ({
    id, title: id, description: "Complete the profile", metric: "profile_complete", order: i,
    tiers: i === 4 ? [{ tier: "BRONZE", target: 100, rewardCoins: 0 }] : tiers
  })));
  const gallery = await Promise.all([get("/experience/badges", token), get("/experience/badges", token)]);
  for (const result of gallery) {
    assert.equal(result.status, 200);
    assert.deepEqual(result.body.data.wornIds, ["first", "second", "third"]);
    assert.equal(result.body.data.badges[3].tier, "MASTER");
    assert.equal(result.body.data.badges[4].unlocked, false);
  }
  assert.equal((await User.findById(actor._id).lean())?.badgeGrants.length, 4);
  const wear = (badgeIds: string[]) => fetch(`${baseUrl}/experience/badges/showcase`, {
    method: "PUT", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ badgeIds })
  });
  assert.equal((await wear(["first", "second", "third", "fourth"])).status, 422);
  assert.equal((await wear(["first", "first"])).status, 422);
  assert.equal((await wear(["locked"])).status, 400);
  assert.equal((await wear(["fourth", "second"])).status, 200);
  assert.deepEqual((await get("/experience/badges", token)).body.data.wornIds, ["fourth", "second"]);
  const publicProfile = await get(`/experience/badges/showcase/${actor.id}`, viewerToken);
  assert.deepEqual(publicProfile.body.data.badges.map((badge: { id: string }) => badge.id), ["fourth", "second"]);
});

test("Sunday honors only count the previous week and expire at the next Sunday boundary", async () => {
  const host = await user();
  const lateHost = await user();
  const now = new Date("2026-11-15T00:00:01.000Z");
  const window = weeklyHonorWindow(now);
  await Achievement.create({ id: "weekly-fixture", title: "Weekly host", description: "Host one room", metric: "host_3", kind: "HONOR", weeklyTarget: 1, tiers: [] });
  for (const [actor, start] of [[host, window.from], [lateHost, window.start]] as const) {
    await Room.create({
      hostId: actor._id, title: "Badge test room", category: "test", language: "en", type: "VOICE",
      livekitRoomName: randomUUID(), startedAt: start
    });
  }
  await awardWeeklyHonors(now);
  await awardWeeklyHonors(now);
  const definitions = await badgeCatalog();
  const awarded = await User.findById(host._id).orFail().lean();
  assert.equal(awarded.badgeGrants.length, 1);
  assert.equal(wornBadges(awarded, definitions, now)[0].id, "weekly-fixture");
  assert.deepEqual(wornBadges(awarded, definitions, window.expiresAt), []);
  assert.deepEqual((await User.findById(lateHost._id).lean())?.badgeGrants, []);
});

test("admin badge artwork is replaced and archived through permission-gated routes", async () => {
  const admin = await AdminUser.create({ email: "super@example.test", displayName: "Super Admin", role: "SUPER_ADMIN", isSuperAdmin: true });
  const analyst = await AdminUser.create({ email: "analyst@example.test", displayName: "Analyst", role: "ANALYST" });
  assert.equal((await get("/admin/badges", await tokenFor(await user()))).status, 401);
  assert.equal((await get("/admin/badges", signAdminAccessToken(analyst))).status, 403);
  const token = signAdminAccessToken(admin);
  const definition = {
    id: "custom", title: "Custom", description: "Attain a level", kind: "ACHIEVEMENT", icon: "star", metric: "level_5",
    order: 4, tiers: [{ tier: "BRONZE", target: 2, rewardCoins: 0 }]
  };
  const png = Uint8Array.from(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl61ZsAAAAASUVORK5CYII=", "base64"));
  const updateArtwork = (method: "POST" | "PUT", blob = new Blob([png], { type: "image/png" })) => {
    const body = new FormData();
    body.set("definition", JSON.stringify(definition));
    body.set("image", blob, "custom.png");
    return fetch(`${baseUrl}/admin/badges${method === "PUT" ? "/custom" : ""}`, {
      method, headers: { authorization: `Bearer ${token}` }, body
    });
  };
  assert.equal((await updateArtwork("POST", new Blob(["not an image"], { type: "image/png" }))).status, 400);
  assert.equal((await updateArtwork("POST")).status, 201);
  const image = async () => (await get("/admin/badges", token)).body.data.badges[0].imageUrl as string;
  const first = await image();
  const url = (path: string) => new URL(path, baseUrl).href;
  const art = await fetch(url(first));
  assert.equal(art.status, 200);
  assert.equal(art.headers.get("content-type"), "image/png");
  assert.deepEqual(new Uint8Array(await art.arrayBuffer()), png);
  assert.equal((await updateArtwork("PUT")).status, 200);
  const second = await image();
  assert.notEqual(first, second);
  assert.equal((await fetch(url(first))).status, 404);
  assert.equal((await fetch(`${baseUrl}/admin/badges/custom`, { method: "DELETE", headers: { authorization: `Bearer ${token}` } })).status, 200);
  assert.equal((await fetch(url(second))).status, 404);
  const stored = await Achievement.findOne({ id: "custom" }).orFail().lean();
  assert.equal(await AdminAuditLog.countDocuments({ entityId: stored._id, "metadata.badgeId": "custom" }), 3);
});

test("public voice and video entry never requires following and membership counts track leave/rejoin", async () => {
  const host = await user();
  const guest = await user();
  const token = await tokenFor(guest);
  for (const type of ["VOICE", "VIDEO"]) {
    const room = await Room.create({ title: "Open room", hostId: host._id, type, category: "test", language: "English", livekitRoomName: randomUUID(), participantCount: 1 });
    await RoomParticipant.create({ roomId: room._id, userId: host._id, role: "HOST", seatIndex: 0 });
    const path = `/rooms/${room.id}`;
    assert.equal(await RoomFollow.countDocuments({ roomId: room._id, userId: guest._id }), 0);
    assert.equal((await post(`${path}/join`, token, {})).status, 200);
    assert.equal((await post(`${path}/join`, token, {})).status, 200);
    const detail = await get(path, token);
    assert.equal(detail.status, 200);
    assert.equal(detail.body.data.participants.length, 2);
    assert.equal(detail.body.data.room.participantCount, 2);
    assert.ok(detail.body.data.participants.some((p: any) => p.userId._id === guest.id && p.role === "AUDIENCE"));
    assert.equal((await post(`${path}/leave`, token, {})).status, 200);
    assert.equal((await get(path, token)).body.data.participants.length, 1);
    assert.equal((await Room.findById(room._id))?.participantCount, 1);
    assert.equal((await post(`${path}/join`, token, {})).status, 200);
    assert.equal((await get(path, token)).body.data.participants.length, 2);
    assert.equal((await Room.findById(room._id))?.participantCount, 2);
  }
});

test("video call approval grants camera/mic only to approved guests and rejection permits a new request", async t => {
  const host = await user();
  const guest = await user();
  const rejected = await user();
  const [hostToken, guestToken, rejectedToken] = await Promise.all([host, guest, rejected].map(tokenFor));
  const room = await Room.create({ title: "Video call", hostId: host._id, type: "VIDEO", category: "test", language: "English", livekitRoomName: randomUUID(), participantCount: 1 });
  await RoomParticipant.create({ roomId: room._id, userId: host._id, role: "HOST", seatIndex: 0 });
  const path = `/rooms/${room.id}`;
  const issued: { identity: string; publishSources?: number[] }[] = [];
  t.mock.method(mediaProvider, "createToken", async (input: any) => {
    issued.push(input);
    return { token: "isolated-media-fixture", url: "ws://127.0.0.1:1" };
  });
  assert.equal((await post("/livekit/token", guestToken, { roomId: room.id })).status, 403);
  for (const token of [guestToken, rejectedToken]) assert.equal((await post(`${path}/join`, token, {})).status, 200);
  assert.equal((await post(`${path}/take-seat`, guestToken, {})).status, 403);
  const viewerMedia = await post("/livekit/token", guestToken, { roomId: room.id });
  assert.equal(viewerMedia.status, 200);
  assert.equal(viewerMedia.body.data.canPublishMicrophone, false);
  assert.equal(issued.at(-1)?.publishSources?.includes(TrackSource.CAMERA), false);
  assert.equal(issued.at(-1)?.publishSources?.includes(TrackSource.MICROPHONE), false);
  assert.equal((await post(`${path}/request-speaker`, guestToken, {})).status, 201);
  assert.equal((await post(`${path}/request-speaker`, guestToken, {})).status, 409);
  assert.equal((await get(path, hostToken)).body.data.speakerRequests.length, 1);
  assert.equal((await post(`${path}/approve-speaker`, rejectedToken, { userId: guest.id })).status, 403);
  assert.equal((await post(`${path}/approve-speaker`, hostToken, { userId: guest.id })).status, 200);
  assert.equal((await get(path, hostToken)).body.data.speakerRequests.length, 0);
  const media = await post("/livekit/token", guestToken, { roomId: room.id });
  assert.equal(media.status, 200);
  assert.equal(media.body.data.role, "SPEAKER");
  assert.equal(media.body.data.canPublishMicrophone, true);
  assert.ok(issued.at(-1)?.publishSources?.includes(TrackSource.CAMERA));
  assert.ok(issued.at(-1)?.publishSources?.includes(TrackSource.MICROPHONE));
  await RoomParticipant.updateOne({ roomId: room._id, userId: guest._id, leftAt: null }, { $set: { moderatorMuted: true } });
  assert.equal((await post("/livekit/token", guestToken, { roomId: room.id })).body.data.canPublishMicrophone, false);
  assert.equal(issued.at(-1)?.publishSources?.includes(TrackSource.CAMERA), false);
  await RoomParticipant.updateOne({ roomId: room._id, userId: guest._id, leftAt: null }, { $set: { moderatorMuted: false } });
  // The Android guest reconnect after permission must retain their approved role.
  assert.equal((await post(`${path}/join`, guestToken, {})).status, 200);
  assert.equal((await RoomParticipant.findOne({ roomId: room._id, userId: guest._id, leftAt: null }))?.role, "SPEAKER");
  assert.equal((await Room.findById(room._id))?.participantCount, 3);
  assert.equal((await post(`${path}/request-speaker`, rejectedToken, {})).status, 201);
  assert.equal((await post(`${path}/reject-speaker`, guestToken, { userId: rejected.id })).status, 403);
  assert.equal((await post(`${path}/reject-speaker`, hostToken, { userId: rejected.id })).status, 200);
  assert.equal((await get(path, rejectedToken)).body.data.speakerRequests.length, 0);
  assert.equal((await post("/livekit/token", rejectedToken, { roomId: room.id })).body.data.canPublishMicrophone, false);
  assert.equal((await post(`${path}/request-speaker`, rejectedToken, {})).status, 201);
  assert.equal((await post(`${path}/leave`, rejectedToken, {})).status, 200);
  assert.equal((await get(path, hostToken)).body.data.speakerRequests.length, 0);
  assert.equal((await post("/livekit/token", rejectedToken, { roomId: room.id })).status, 403);
});

test("event endpoint aliases preserve Android paths and last-seat admission is atomic", async () => {
  const host = await user();
  const event = await Event.create({ title: "One seat", hostId: host._id, category: "test", type: "ROOM", eventDate: new Date(Date.now() + 3600000), maxParticipants: 1 });
  for (const endpoint of ["/events", "/events/events"]) {
    const result = await fetch(`${baseUrl}${endpoint}`);
    assert.equal(result.status, 200);
    assert.equal((await result.json() as any).data.events.length, 1);
  }
  const actors = await Promise.all(Array.from({ length: 20 }, () => user()));
  const tokens = await Promise.all(actors.map(tokenFor));
  const results = await Promise.all(tokens.map(token => post(`/events/${event.id}/join`, token, {})));
  assert.equal(results.filter(result => result.status === 200).length, 1);
  assert.equal(results.filter(result => result.status === 409).length, 19);
  const winner = results.findIndex(result => result.status === 200);
  const replay = await post(`/events/${event.id}/join`, tokens[winner], {});
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.alreadyJoined, true);
  assert.equal((await Event.findById(event._id))?.participantIds.length, 1);
  assert.equal((await post(`/events/${event.id}/cancel`, tokens[winner], {})).status, 404);
  assert.equal((await post(`/events/${event.id}/cancel`, await tokenFor(host), {})).status, 200);
  assert.equal((await post(`/events/${event.id}/join`, tokens[0], {})).status, 409);
});

test("concurrent event leave and joins preserve other memberships", async () => {
  const [host, leaving, ...joining] = await Promise.all(Array.from({ length: 12 }, () => user()));
  const event = await Event.create({ title: "Open event", hostId: host._id, category: "test", type: "PARTY", eventDate: new Date(Date.now() + 3600000), participantIds: [leaving._id] });
  const leaveToken = await tokenFor(leaving);
  const tokens = await Promise.all(joining.map(tokenFor));
  await Promise.all([post(`/events/${event.id}/leave`, leaveToken, {}), ...tokens.map(token => post(`/events/${event.id}/join`, token, {}))]);
  const saved = await Event.findById(event._id);
  assert.deepEqual(saved?.participantIds.map(String).sort(), joining.map(actor => actor.id).sort());
});

test("purchase credit rejects unverified/refund states and concurrent paid replay grants once", async () => {
  const actor = await user(0);
  for (const status of ["PENDING", "FAILED", "REFUND_PENDING", "REFUNDED", "REFUND_FAILED"] as const) {
    const purchase = await Purchase.create({ userId: actor._id, provider: "RAZORPAY", status, packId: "fixture", coinAmount: 100, amountInr: 10 });
    await assert.rejects(creditPurchase(purchase.id, actor.id, {}), httpStatus(409));
    if (status.startsWith("REFUND")) await assert.rejects(markPurchasePaid(purchase.id, actor.id), httpStatus(409));
    assert.equal((await Purchase.findById(purchase._id))?.status, status);
  }
  const paid = await Purchase.create({ userId: actor._id, provider: "RAZORPAY", status: "PAID", packId: "fixture", coinAmount: 100, amountInr: 10 });
  const results = await Promise.all(Array.from({ length: 30 }, () => creditPurchase(paid.id, actor.id, {})));
  assert.equal(new Set(results.map(result => result.id)).size, 1);
  assert.equal((await User.findById(actor._id))?.walletBalance, 100);
  assert.equal(await WalletTransaction.countDocuments(), 1);
});

test("signed delayed capture and failure callbacks never reopen refund state", async () => {
  const actor = await user(0);
  for (const status of ["REFUND_PENDING", "REFUNDED", "REFUND_FAILED"] as const) {
    const purchase = await Purchase.create({ userId: actor._id, provider: "RAZORPAY", status, packId: "fixture", coinAmount: 100, amountInr: 10, providerOrderId: randomUUID() });
    for (const event of ["payment.captured", "payment.failed"]) {
      const body = JSON.stringify({ event, payload: { payment: { entity: { id: randomUUID(), order_id: purchase.providerOrderId, amount: 1000, currency: "INR", status: event === "payment.captured" ? "captured" : "failed" } } } });
      const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET!).update(body).digest("hex");
      const result = await fetch(baseUrl.replace(/\/api$/, "/webhook-test"), { method: "POST", headers: { "content-type": "application/json", "x-razorpay-signature": signature }, body });
      assert.equal(result.status, 200, await result.text());
      assert.equal((await Purchase.findById(purchase._id))?.status, status);
    }
  }
  assert.equal((await User.findById(actor._id))?.walletBalance, 0);
  assert.equal(await WalletTransaction.countDocuments(), 0);
});

test("purchase ledger failure rolls back fulfillment and permits safe retry", async t => {
  const actor = await user(0);
  const purchase = await Purchase.create({ userId: actor._id, provider: "RAZORPAY", status: "PAID", packId: "fixture", coinAmount: 100, amountInr: 10 });
  const injected = t.mock.method(WalletTransaction, "create", async () => { throw new Error("purchase journal unavailable"); });
  try { await assert.rejects(creditPurchase(purchase.id, actor.id, {}), /purchase journal unavailable/); }
  finally { injected.mock.restore(); }
  assert.equal((await Purchase.findById(purchase._id))?.status, "PAID");
  assert.equal((await User.findById(actor._id))?.walletBalance, 0);
  assert.equal(await WalletTransaction.countDocuments(), 0);
  await creditPurchase(purchase.id, actor.id, {});
  assert.equal((await User.findById(actor._id))?.walletBalance, 100);
  assert.equal(await WalletTransaction.countDocuments(), 1);
});

test("HTTP combo and trade reject forged consent with zero asset changes", async () => {
  const [actor, victim, other] = await Promise.all([user(), user(), user()]);
  const gift = await Gift.create({ name: randomUUID(), icon: "test", coinPrice: 100 });
  const ownItem = await GiftInventory.create({ userId: actor._id, giftId: gift._id, quantity: 1, tradable: true });
  const victimItem = await GiftInventory.create({ userId: victim._id, giftId: gift._id, quantity: 2, tradable: true });
  const token = await tokenFor(actor);
  const combo = await post("/gifts/combo", token, { roomId: new mongoose.Types.ObjectId(), giftId: gift.id, participants: [victim.id, other.id] });
  const trade = await post("/inventory/trade", token, { targetUserId: victim.id, offerItems: [ownItem.id], requestItems: [victimItem.id] });
  assert.equal(combo.status, 409);
  assert.equal(trade.status, 409);
  assert.deepEqual((await User.find().sort({ _id: 1 }).lean()).map(row => row.walletBalance), [1000, 1000, 1000]);
  assert.equal((await GiftInventory.findById(victimItem._id))?.quantity, 2);
  assert.equal((await GiftInventory.findById(ownItem._id))?.userId.toString(), actor.id);
  assert.equal(await WalletTransaction.countDocuments(), 0);
  assert.equal(await GiftTransaction.countDocuments(), 0);
});

test("wallet rejects invalid units/source and inactive sessions without changing balance", async () => {
  const actor = await user();
  for (const amount of [0, -10, 0.5, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(creditWallet(actor.id, amount, "RECHARGE"), httpStatus(400));
    await assert.rejects(debitWallet(actor.id, amount, "GIFT_SENT"), httpStatus(400));
  }
  await assert.rejects(creditWallet(actor.id, 100, "referral_bonus"), httpStatus(400));
  await assert.rejects(debitWallet(actor.id, 100, "COSMETIC_PURCHASE"), httpStatus(400));
  const session = await mongoose.startSession();
  try { await assert.rejects(creditWallet(actor.id, 10, "RECHARGE", {}, session), httpStatus(500)); }
  finally { await session.endSession(); }
  assert.equal((await User.findById(actor._id))?.walletBalance, 1000);
  assert.equal(await WalletTransaction.countDocuments(), 0);
});

test("standalone wallet mutation rolls back balance when ledger insert fails", async t => {
  const actor = await user();
  const mocked = t.mock.method(WalletTransaction, "create", async () => { throw new Error("injected ledger failure"); });
  try {
    await assert.rejects(creditWallet(actor.id, 100, "RECHARGE"), /injected ledger failure/);
    await assert.rejects(debitWallet(actor.id, 100, "GIFT_SENT"), /injected ledger failure/);
  } finally { mocked.mock.restore(); }
  assert.equal((await User.findById(actor._id))?.walletBalance, 1000);
  assert.equal(await WalletTransaction.countDocuments(), 0);
});

test("100 concurrent identical credits have one committed balance and journal effect", async () => {
  const actor = await user(0);
  const rows = await Promise.all(Array.from({ length: 100 }, () => creditWallet(actor.id, 100, "RECHARGE", { idempotencyKey: "same-intent" })));
  assert.equal(new Set(rows.map(result => result[0].id)).size, 1);
  assert.equal((await User.findById(actor._id))?.walletBalance, 100);
  assert.equal(await WalletTransaction.countDocuments(), 1);
  await assert.rejects(creditWallet(actor.id, 101, "RECHARGE", { idempotencyKey: "same-intent" }), httpStatus(409));
  await assert.rejects(debitWallet(actor.id, 100, "GIFT_SENT", { idempotencyKey: "same-intent" }), httpStatus(409));
  assert.equal((await User.findById(actor._id))?.walletBalance, 100);
});

test("concurrent distinct debits never spend more than the available balance", async () => {
  const actor = await user(100);
  const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => debitWallet(actor.id, 30, "GIFT_SENT", { idempotencyKey: `debit-${index}` })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 3);
  assert.equal((await User.findById(actor._id))?.walletBalance, 10);
  assert.equal(await WalletTransaction.countDocuments(), 3);
  assert.equal((await WalletTransaction.find().lean()).reduce((sum, row) => sum + row.amount, 0), 90);
});

test("outer transaction rollback includes wallet helper mutations", async () => {
  const actor = await user();
  await assert.rejects(mongoose.connection.transaction(async session => {
    await creditWallet(actor.id, 200, "RECHARGE", {}, session);
    await debitWallet(actor.id, 50, "GIFT_SENT", {}, session);
    throw new Error("workflow failure");
  }), /workflow failure/);
  assert.equal((await User.findById(actor._id))?.walletBalance, 1000);
  assert.equal(await WalletTransaction.countDocuments(), 0);
});

test("theme concurrent/repeated purchase charges once and requires entitlement", async () => {
  const actor = await user();
  const paid = await theme();
  await assert.rejects(assertThemeEntitlement(actor.id, paid.key), httpStatus(403));
  const purchases = await Promise.all(Array.from({ length: 12 }, () => purchaseTheme(actor.id, paid.key)));
  assert.equal(purchases.filter(result => !result.alreadyOwned).length, 1);
  assert.equal((await User.findById(actor._id))?.walletBalance, 900);
  assert.equal(await WalletTransaction.countDocuments(), 1);
  assert.equal((await User.findById(actor._id))?.ownedCosmeticIds.filter(key => key === paid.key).length, 1);
  await assertThemeEntitlement(actor.id, paid.key);
  await assertThemeEntitlement(actor.id, (await theme(0)).key);
  const diamondOnly = await theme(0, 5);
  await assert.rejects(purchaseTheme(actor.id, diamondOnly.key), httpStatus(409));
});

test("theme journal failure rolls back both ownership and payment", async t => {
  const actor = await user();
  const paid = await theme();
  const mocked = t.mock.method(WalletTransaction, "create", async () => { throw new Error("injected theme journal failure"); });
  try { await assert.rejects(purchaseTheme(actor.id, paid.key), /injected theme journal failure/); }
  finally { mocked.mock.restore(); }
  const saved = await User.findById(actor._id);
  assert.equal(saved?.walletBalance, 1000);
  assert.equal(saved?.ownedCosmeticIds.includes(paid.key), false);
  assert.equal(await WalletTransaction.countDocuments(), 0);
});

test("referral concurrent retries pay exactly one reward pair", async () => {
  const referrer = await user(0, { referralCode: "TESTCODE" });
  const claimant = await user(0);
  const claims = await Promise.all(Array.from({ length: 12 }, () => claimReferral({ userId: claimant.id, code: "TESTCODE" })));
  assert.equal(claims.filter(result => !result.alreadyClaimed).length, 1);
  assert.equal((await User.findById(referrer._id))?.walletBalance, 100);
  assert.equal((await User.findById(claimant._id))?.walletBalance, 100);
  assert.equal(await Referral.countDocuments({ status: "REWARDED" }), 1);
  assert.equal(await WalletTransaction.countDocuments(), 2);
});

test("second referral credit failure rolls back both users, claim and referral", async t => {
  const referrer = await user(0, { referralCode: "TESTCODE" });
  const claimant = await user(0);
  const original = WalletTransaction.create.bind(WalletTransaction);
  let calls = 0;
  const mocked = t.mock.method(WalletTransaction, "create", async (...args: any[]) => {
    if (++calls === 2) throw new Error("injected second credit failure");
    return (original as any)(...args);
  });
  try { await assert.rejects(claimReferral({ userId: claimant.id, code: "TESTCODE" }), /injected second credit failure/); }
  finally { mocked.mock.restore(); }
  assert.equal((await User.findById(referrer._id))?.walletBalance, 0);
  assert.equal((await User.findById(claimant._id))?.walletBalance, 0);
  assert.equal((await User.findById(claimant._id))?.referredBy, undefined);
  assert.equal(await Referral.countDocuments(), 0);
  assert.equal(await WalletTransaction.countDocuments(), 0);
});

test("legacy incomplete referral is rejected without a second reward", async () => {
  const referrer = await user(100, { referralCode: "TESTCODE" });
  const claimant = await user(100, { referredBy: referrer._id });
  await Referral.create({ referrerId: referrer._id, referredUserId: claimant._id, referralCode: "TESTCODE", status: "COMPLETED" });
  await assert.rejects(claimReferral({ userId: claimant.id, code: "TESTCODE" }), httpStatus(409));
  assert.equal(await WalletTransaction.countDocuments(), 0);
  assert.equal((await User.findById(claimant._id))?.walletBalance, 100);
});

test("HTTP room gifts from different senders can safely reuse a client key", async () => {
  const [first, second, receiver] = await Promise.all([user(), user(), user(0)]);
  const gift = await Gift.create({ name: randomUUID(), icon: "test", coinPrice: 100 });
  const room = await Room.create({ title: "Test room", hostId: receiver._id, type: "VOICE", category: "test", language: "English", status: "LIVE", livekitRoomName: randomUUID() });
  await RoomParticipant.insertMany([first, second, receiver].map(actor => ({ roomId: room._id, userId: actor._id })));
  const tokens = await Promise.all([tokenFor(first), tokenFor(second)]);
  const request = { receiverId: receiver.id, giftId: gift.id, currency: "COINS", idempotencyKey: "same-raw-key" };
  const responses = await Promise.all(tokens.map(token => post(`/rooms/${room.id}/send-gift`, token, request)));
  assert.deepEqual(responses.map(response => response.status), [201, 201], JSON.stringify(responses));
  assert.equal((await User.findById(first._id))?.walletBalance, 900);
  assert.equal((await User.findById(second._id))?.walletBalance, 900);
  assert.equal((await User.findById(receiver._id))?.walletBalance, 180);
  assert.equal(await WalletTransaction.countDocuments({ source: "GIFT_RECEIVED" }), 2);
  assert.equal(await GiftTransaction.countDocuments(), 2);
  const replay = await post(`/rooms/${room.id}/send-gift`, tokens[0], request);
  assert.equal(replay.status, 200);
  assert.equal(replay.body.data.giftTransaction._id, responses[0].body.data.giftTransaction._id);
  await Gift.updateOne({ _id: gift._id }, { $set: { coinPrice: 150 } });
  assert.equal((await post(`/rooms/${room.id}/send-gift`, tokens[0], request)).status, 200);
  const changedGift = await Gift.create({ name: randomUUID(), icon: "test", coinPrice: 100 });
  assert.equal((await post(`/rooms/${room.id}/send-gift`, tokens[0], { ...request, giftId: changedGift.id })).status, 409);
  assert.equal(await GiftTransaction.countDocuments(), 2);
  assert.equal((await User.findById(first._id))?.walletBalance, 900);
});

test("HTTP concurrent repeated room gift intent commits one transfer", async () => {
  const [sender, receiver] = await Promise.all([user(), user(0)]);
  const gift = await Gift.create({ name: randomUUID(), icon: "test", coinPrice: 100 });
  const room = await Room.create({ title: "Test room", hostId: receiver._id, type: "VOICE", category: "test", language: "English", status: "LIVE", livekitRoomName: randomUUID() });
  await RoomParticipant.insertMany([sender, receiver].map(actor => ({ roomId: room._id, userId: actor._id })));
  const token = await tokenFor(sender);
  const request = { receiverId: receiver.id, giftId: gift.id, currency: "COINS", idempotencyKey: "repeated-gift" };
  const results = await Promise.all(Array.from({ length: 12 }, () => post(`/rooms/${room.id}/send-gift`, token, request)));
  assert.equal(results.filter(result => result.status === 201).length, 1, JSON.stringify(results));
  assert.equal(results.filter(result => result.status === 200).length, 11, JSON.stringify(results));
  assert.equal(new Set(results.map(result => result.body.data.giftTransaction._id)).size, 1);
  assert.equal((await User.findById(sender._id))?.walletBalance, 900);
  assert.equal((await User.findById(receiver._id))?.walletBalance, 90);
  assert.equal(await GiftTransaction.countDocuments(), 1);
  assert.equal(await WalletTransaction.countDocuments({ source: { $in: ["GIFT_SENT", "GIFT_RECEIVED"] } }), 2);
});

test("HTTP paid theme equip requires ownership and repeated purchase retains response contract", async () => {
  const actor = await user();
  const paid = await theme();
  const token = await tokenFor(actor);
  assert.equal((await post("/user/themes/equip", token, { slot: "room", themeKey: paid.key })).status, 403);
  const purchased = await post("/themes/purchase", token, { themeKey: paid.key });
  assert.equal(purchased.status, 200, JSON.stringify(purchased));
  assert.equal(purchased.body.data.theme.key, paid.key);
  assert.equal((await post("/themes/purchase", token, { themeKey: paid.key })).status, 200);
  assert.equal((await post("/user/themes/equip", token, { slot: "room", themeKey: paid.key })).status, 200);
  assert.equal((await User.findById(actor._id))?.walletBalance, 900);
  assert.equal(await WalletTransaction.countDocuments(), 1);
});

test("HTTP legacy referral-code index conflict is safe and atomic", async () => {
  const referrer = await user(0, { referralCode: "TESTCODE" });
  const first = await user(0);
  const second = await user(0);
  await claimReferral({ userId: first.id, code: "TESTCODE" });
  const response = await post("/referrals/claim", await tokenFor(second), { code: "TESTCODE" });
  assert.equal(response.status, 409, JSON.stringify(response));
  assert.equal((await User.findById(second._id))?.walletBalance, 0);
  assert.equal((await User.findById(second._id))?.referredBy, undefined);
  assert.equal((await User.findById(referrer._id))?.walletBalance, 100);
  assert.equal(await WalletTransaction.countDocuments(), 2);
});

test("concurrent different referral codes cannot reward the same claimant twice", async () => {
  const firstReferrer = await user(0, { referralCode: "FIRSTCODE" });
  const secondReferrer = await user(0, { referralCode: "SECONDCODE" });
  const claimant = await user(0);
  const results = await Promise.allSettled([
    claimReferral({ userId: claimant.id, code: "FIRSTCODE" }),
    claimReferral({ userId: claimant.id, code: "SECONDCODE" })
  ]);
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  const rejected = results.find(result => result.status === "rejected");
  assert.ok(rejected?.status === "rejected");
  assert.ok(httpStatus(409)(rejected.reason));
  const savedClaimant = await User.findById(claimant._id);
  assert.equal(savedClaimant?.walletBalance, 100);
  const referrers = await User.find({ _id: { $in: [firstReferrer._id, secondReferrer._id] } }).lean();
  assert.deepEqual(referrers.map(row => row.walletBalance).sort((a, b) => a - b), [0, 100]);
  const referral = await Referral.findOne({ referredUserId: claimant._id });
  assert.ok(referral);
  assert.equal(referral.status, "REWARDED");
  assert.equal(savedClaimant?.referredBy?.toString(), referral.referrerId.toString());
  assert.equal(await Referral.countDocuments(), 1);
  assert.equal(await WalletTransaction.countDocuments(), 2);
});

test("insufficient theme funds roll back tentative ownership and leave no journal", async () => {
  const actor = await user(50);
  const paid = await theme(100);
  await assert.rejects(purchaseTheme(actor.id, paid.key), httpStatus(402));
  const saved = await User.findById(actor._id);
  assert.equal(saved?.walletBalance, 50);
  assert.equal(saved?.ownedCosmeticIds.includes(paid.key), false);
  assert.equal(await WalletTransaction.countDocuments(), 0);
});

test("HTTP room theme updates require both host role and paid theme ownership", async () => {
  const host = await user();
  const guest = await user();
  const paid = await theme();
  const room = await Room.create({
    title: "Entitlement test room", hostId: host._id, type: "VOICE", category: "test",
    language: "English", status: "LIVE", livekitRoomName: randomUUID()
  });
  const hostToken = await tokenFor(host);
  const guestToken = await tokenFor(guest);
  const endpoint = `/rooms/${room.id}/theme`;

  assert.equal((await post(endpoint, hostToken, { themeKey: paid.key })).status, 403);
  assert.equal((await Room.findById(room._id))?.theme, undefined);
  await User.updateOne({ _id: guest._id }, { $addToSet: { ownedCosmeticIds: paid.key } });
  assert.equal((await post(endpoint, guestToken, { themeKey: paid.key })).status, 403);
  assert.equal((await Room.findById(room._id))?.theme, undefined);

  await User.updateOne({ _id: host._id }, { $addToSet: { ownedCosmeticIds: paid.key } });
  const equipped = await post(endpoint, hostToken, { themeKey: paid.key });
  assert.equal(equipped.status, 200, JSON.stringify(equipped));
  assert.equal(equipped.body.data.room.theme, paid.key);
  assert.equal((await Room.findById(room._id))?.theme, paid.key);
  const free = await theme(0);
  assert.equal((await post(endpoint, hostToken, { themeKey: free.key })).status, 200);
  assert.equal((await Room.findById(room._id))?.theme, free.key);
  assert.equal(await WalletTransaction.countDocuments(), 0);
});

async function bondParticipant(balance = 500) {
  const actor = await user(balance, { age: 25 });
  return { id: actor.id, token: await tokenFor(actor) };
}
type BondParticipant = Awaited<ReturnType<typeof bondParticipant>>;
async function connectFriends(first: BondParticipant, second: BondParticipant) {
  await Friendship.create({ userId: first.id, friendId: second.id, status: "ACCEPTED" });
}
async function inviteBond(sender: BondParticipant, recipient: BondParticipant, slot = 1, giftId?: string, kind = "BESTIE", key = randomUUID()) {
  return post("/bonds/invitations", sender.token, { recipient: recipient.id, slot, kind, giftId, key });
}
const bondRequest = (actor: BondParticipant, id: string, action: string) => post(`/bonds/invitations/${id}/${action}`, actor.token, {});
const bondBalance = async (actor: BondParticipant) => (await User.findById(actor.id).orFail().lean()).walletBalance;

test("Bonds holds and settles one gift, requires recipient consent, and preserves bilateral privacy", async () => {
  const a = await bondParticipant();
  const b = await bondParticipant();
  const stranger = await bondParticipant();
  await connectFriends(a, b);
  const gift = await Gift.create({ name: "Test bestie gift", icon: "Gift", category: "bonds", bondPurpose: "INVITATION", bondKind: "BESTIE", coinPrice: 50, bondPoints: 20 });
  const key = randomUUID();
  const create = await Promise.all([inviteBond(a, b, 1, gift.id, "BESTIE", key), inviteBond(a, b, 1, gift.id, "BESTIE", key)]);
  assert.ok(create.every(result => result.status === 201), JSON.stringify(create));
  const id = create[0].body.data.id;
  assert.equal(create[1].body.data.id, id);
  assert.equal(await bondBalance(a), 450);
  assert.equal(await bondBalance(b), 500);
  assert.equal((await bondRequest(stranger, id, "accept")).status, 403);
  assert.equal(await Bond.countDocuments({ status: "ACTIVE" }), 0);
  const accepted = await Promise.all([bondRequest(b, id, "accept"), bondRequest(b, id, "accept")]);
  assert.ok(accepted.every(result => result.body.data?.status === "ACCEPTED"), JSON.stringify(accepted));
  const bondId = accepted[0].body.data.bondId;
  assert.equal(await Bond.countDocuments({ status: "ACTIVE" }), 1);
  assert.equal(await GiftTransaction.countDocuments({ senderId: a.id, giftId: gift.id }), 1);
  assert.equal(await bondBalance(a), 450);
  assert.equal(await bondBalance(b), 545);
  assert.equal((await get(`/bonds/${bondId}`, stranger.token)).status, 404);
  assert.equal((await get(`/bonds/profile/${a.id}`, stranger.token)).body.data.bonds.length, 0);
  await setBondPreferences(bondId, a.id, { visibility: "PUBLIC" });
  assert.equal((await get(`/bonds/profile/${a.id}`, stranger.token)).body.data.bonds.length, 0);
  await setBondPreferences(bondId, b.id, { visibility: "PUBLIC", showLevel: false });
  const cards = (await get(`/bonds/profile/${a.id}`, stranger.token)).body.data.bonds;
  assert.equal(cards.length, 1);
  assert.equal(cards[0].level, undefined);

  const progression = await Gift.create({ name: "Test points gift", icon: "Gift", category: "bonds", bondPurpose: "PROGRESSION", coinPrice: 10, bondPoints: 80 });
  const purchase = { giftId: progression.id, key: randomUUID() };
  for (let retry = 0; retry < 2; retry++) assert.equal((await post(`/bonds/${bondId}/gifts`, a.token, purchase)).status, 200);
  for (const actor of [a, b, b]) assert.equal((await post(`/bonds/${bondId}/check-in`, actor.token, {})).status, 200);
  const detail = (await get(`/bonds/${bondId}`, a.token)).body.data;
  assert.equal(detail.points, 110);
  assert.equal(detail.level, 2);
  assert.equal(await GiftTransaction.countDocuments({ senderId: a.id }), 2);

  const conversion = await post(`/bonds/${bondId}/type-change`, b.token, { kind: "SOULMATE", key: randomUUID() });
  assert.equal(conversion.status, 201);
  assert.equal((await bondRequest(a, conversion.body.data.id, "accept")).body.data.bondId, bondId);
  assert.equal((await Bond.findById(bondId).orFail().lean()).kind, "SOULMATE");
  assert.equal((await post(`/bonds/${bondId}/end`, a.token, {})).status, 200);
  assert.equal((await post(`/bonds/${bondId}/end`, b.token, {})).status, 200);
  assert.equal(await bondBalance(a), 440);
  assert.equal(await bondBalance(b), 554);
  assert.equal((await get(`/bonds/profile/${a.id}`, stranger.token)).body.data.bonds.length, 0);
});

test("Bonds releases paid holds on decline, cancel, expiration, block and account removal", async () => {
  const sender = await bondParticipant(50);
  const gift = await Gift.create({ name: "Test soulmate gift", icon: "Gift", category: "bonds", bondPurpose: "INVITATION", bondKind: "SOULMATE", coinPrice: 50, bondPoints: 20 });
  for (const action of ["decline", "cancel", "expire", "block", "delete"]) {
    const recipient = await bondParticipant();
    await connectFriends(sender, recipient);
    const invite = await inviteBond(sender, recipient, 1, gift.id, "SOULMATE");
    assert.equal(invite.status, 201, JSON.stringify(invite));
    const id = invite.body.data.id;
    assert.equal(await bondBalance(sender), 0);
    if (action === "expire") {
      await expireBondRequests(undefined, new Date(Date.now() + dayMs + 1000));
      assert.equal((await bondRequest(recipient, id, "accept")).body.data.status, "EXPIRED");
    } else if (action === "block") {
      await blockBondPair(recipient.id, sender.id);
      assert.equal((await bondRequest(recipient, id, "accept")).body.data.status, "INVALIDATED");
    } else if (action === "delete") {
      await endUnavailableBonds(recipient.id, "TERMINATED_BY_ACCOUNT_REMOVAL");
      assert.equal((await bondRequest(recipient, id, "accept")).body.data.status, "INVALIDATED");
    } else {
      const result = await bondRequest(action === "cancel" ? sender : recipient, id, action);
      assert.equal(result.status, 200);
    }
    assert.equal(await bondBalance(sender), 50);
    assert.equal(await GiftTransaction.countDocuments({ senderId: sender.id }), 0);
    assert.equal(await BondRequest.countDocuments({ senderId: sender.id, status: "PENDING" }), 0);
  }
  const unfunded = await bondParticipant(0);
  await connectFriends(unfunded, sender);
  assert.equal((await inviteBond(unfunded, sender, 1, gift.id, "SOULMATE")).status, 402);
  assert.equal(await BondRequest.countDocuments({ senderId: unfunded.id }), 0);
});

test("Bonds serializes opposite requests and accepts at most three slots under contention", async () => {
  const hub = await bondParticipant();
  const partners = await Promise.all(Array.from({ length: 5 }, () => bondParticipant()));
  for (const partner of partners) await connectFriends(hub, partner);
  const reversed = await Promise.all([inviteBond(hub, partners[4]), inviteBond(partners[4], hub)]);
  assert.deepEqual(reversed.map(row => row.status).sort(), [201, 409]);
  const winner = reversed[0].status === 201 ? { acting: hub, result: reversed[0] } : { acting: partners[4], result: reversed[1] };
  assert.equal((await bondRequest(winner.acting, winner.result.body.data.id, "cancel")).status, 200);
  const all = await Promise.all(partners.slice(0, 4).map(partner => inviteBond(partner, hub)));
  assert.ok(all.every(row => row.status === 201), JSON.stringify(all));
  const accepted = await Promise.all(all.map(row => bondRequest(hub, row.body.data.id, "accept")));
  assert.deepEqual(accepted.map(row => row.status).sort(), [200, 200, 200, 409]);
  const active = await Bond.find({ users: hub.id, status: "ACTIVE" }).lean();
  assert.equal(active.length, 3);
  assert.equal(new Set(active.map(row => row.slots[row.users.findIndex(id => id.toString() === hub.id)])).size, 3);
});

test("Bonds creates milestone and ranking rewards once", async () => {
  const a = await bondParticipant();
  const b = await bondParticipant();
  await connectFriends(a, b);
  const invite = await inviteBond(a, b);
  const { body } = await bondRequest(b, invite.body.data.id, "accept");
  const id = body.data.bondId;
  for (const actor of [a, b]) await setBondPreferences(id, actor.id, { visibility: "PUBLIC", leaderboard: true });
  const now = new Date();
  const prior = weeklyPeriod(new Date(weeklyPeriod(now).start.getTime() - 1));
  const start = new Date(Math.min(now.getTime() - 8 * dayMs, prior.start.getTime()));
  await Bond.updateOne({ _id: id }, { $set: { activatedAt: start, nextMilestoneAt: new Date(start.getTime() + dayMs) } });
  await BondPoint.collection.insertOne({ bondId: new mongoose.Types.ObjectId(id), kind: "ACTIVITY", key: "previous-activity", points: 10, support: 0, createdAt: prior.start });
  await runBondMaintenance(now);
  await runBondMaintenance(now);
  assert.equal(await BondRankingSnapshot.countDocuments({ period: prior.id }), 3);
  assert.equal(await BondReward.countDocuments({ bondId: id, key: `rank:${prior.id}:ACTIVITY` }), 2);
  assert.equal(await BondReward.countDocuments({ bondId: id, key: "milestone:7" }), 2);
  assert.equal(await BondPoint.countDocuments({ bondId: id, kind: "MILESTONE" }), 2);
  assert.deepEqual((await Bond.findById(id).orFail().lean()).milestoneDays, [1, 7]);
  assert.ok((await User.findById(a.id).orFail().lean()).ownedCosmeticIds.includes("bond_weekly_frame"));
  await expireBondRewards(new Date(now.getTime() + 8 * dayMs));
  const owned = (await User.findById(a.id).orFail().lean()).ownedCosmeticIds;
  assert.ok(!owned.includes("bond_weekly_frame"));
  assert.ok(owned.includes("bond_memory_badge"));
  await blockBondPair(a.id, b.id);
  assert.equal((await Bond.findById(id).orFail().lean()).status, "TERMINATED_BY_BLOCK");
});
