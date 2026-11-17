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
const { WalletTransaction } = await import("../models/WalletTransaction.js");
const { GiftTransaction } = await import("../models/GiftTransaction.js");
const { GiftInventory } = await import("../models/GiftInventory.js");
const { Gift } = await import("../models/Gift.js");
const { Room } = await import("../models/Room.js");
const { RoomParticipant } = await import("../models/RoomParticipant.js");
const { SpeakerRequest } = await import("../models/SpeakerRequest.js");
const { RoomFollow } = await import("../models/RoomFollow.js");
const { roomsRouter } = await import("../routes/rooms.js");
const { livekitRouter } = await import("../routes/livekit.js");
const { mediaProvider } = await import("../services/livekit.js");
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

let server: http.Server;
let baseUrl: string;
before(async () => {
  await mongoose.connect(uri, { dbName, autoIndex: false, serverSelectionTimeoutMS: 5000 });
  // Real production schema indexes, applied only inside the owned test replica.
  for (const model of [User, AuthSession, WalletTransaction, GiftTransaction, GiftInventory, Gift, Room, RoomParticipant, SpeakerRequest, RoomFollow, Referral, ImmersiveTheme, UserSafetyStatus, Event, Purchase]) {
    await model.createCollection();
    await model.createIndexes();
  }
  const app = express();
  app.post("/webhook-test", express.raw({ type: "application/json" }), (req, res, next) => { void handlePaymentWebhook(req, res).catch(next); });
  app.use(express.json());
  app.use("/api/rooms", roomsRouter);
  app.use("/api/livekit", livekitRouter);
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
