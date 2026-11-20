import mongoose, { type ClientSession } from "mongoose";
import { Bond, BondPoint, BondRequest, BondReward, type BondRecord, type BondRequestRecord } from "../models/Bond.js";
import { Block } from "../models/Block.js";
import { Friendship } from "../models/Friendship.js";
import { Gift } from "../models/Gift.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Notification } from "../models/Notification.js";
import { User } from "../models/User.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { assertWalletNotFrozen, creditWallet, creatorShare, debitWallet } from "./wallet.js";
import { dispatchNotification } from "./notifications.js";
import { emitUser } from "./socket.js";
import { relationshipPairKey } from "./relationships.js";
import { anniversaryLeadMs, bondDefaults, bondConfig, bondKinds, bondLevel, dayMs, ensureBondCatalog, nextAnniversary, type BondKind } from "./bondRules.js";

type Outcome = "ACCEPTED" | "DECLINED" | "CANCELLED" | "EXPIRED" | "INVALIDATED";
type EndStatus = "ENDED" | "TERMINATED_BY_BLOCK" | "TERMINATED_BY_MODERATION" | "TERMINATED_BY_ACCOUNT_REMOVAL";
type NotificationRow = Awaited<ReturnType<typeof Notification.create>>[number];
let trackBondBackground: ((work: Promise<unknown>) => void) | undefined;

export function setBondBackgroundTracker(track: (work: Promise<unknown>) => void) {
  trackBondBackground = track;
}

export const bondPeopleFields = "name username avatar avatarType avatarParts age isBlocked suspendedUntil deletionRequestedAt bondInvitations";
export const idsFor = (pair: string) => pair.split(":");
const open = (id: string) => ({ status: "ACTIVE", users: id });
const pending = (id: string) => ({ status: "PENDING", $or: [{ senderId: id }, { recipientId: id }] });
const fail = (message: string): never => { throw new HttpError(409, message, ErrorCode.CONFLICT); };
const denied = (message = "This bond action is unavailable"): never => { throw new HttpError(403, message, ErrorCode.FORBIDDEN); };
const missing = (): never => { throw new HttpError(404, "Bond not found", ErrorCode.NOT_FOUND); };
const safeId = (id: string) => {
  if (!mongoose.isValidObjectId(id)) throw new HttpError(400, "Invalid identifier", ErrorCode.VALIDATION);
  return id;
};

export function bondPreferences(bond: BondRecord, id: string) {
  const map = bond.preferences as Map<string, Partial<typeof bondDefaults>> | Record<string, Partial<typeof bondDefaults>> | undefined;
  const stored = map instanceof Map ? map.get(id) : map?.[id];
  return { ...bondDefaults, ...stored } as Omit<typeof bondDefaults, "visibility"> & { visibility: "PRIVATE" | "FRIENDS" | "PUBLIC" };
}

export const memberAvailable = (user: { age?: number | null; isBlocked?: boolean; suspendedUntil?: Date | null; deletionRequestedAt?: Date | null } | null, now = new Date()) =>
  !!user && (user.age ?? 0) >= 18 && !user.isBlocked && !user.deletionRequestedAt && (!user.suspendedUntil || user.suspendedUntil <= now);

async function lockUsers(ids: string[], session: ClientSession) {
  // All slot-changing paths write the same per-user fence before reading counts.
  // MongoDB retries the entire transaction when a concurrent operation writes it.
  for (const id of [...new Set(ids)].sort()) {
    await User.updateOne({ _id: id }, { $inc: { bondVersion: 1 } }, { session, timestamps: false });
  }
}

export const pairBlockFilter = (a: string, b: string) => ({ $or: [{ blockerId: a, blockedUserId: b }, { blockerId: b, blockedUserId: a }] });
const pairFriendFilter = (a: string, b: string) => ({ status: "ACCEPTED", $or: [{ userId: a, friendId: b }, { userId: b, friendId: a }] });

async function eligiblePair(from: string, to: string, session: ClientSession, requireFriend = true, requireInvites = true) {
  const people = await User.find({ _id: { $in: [from, to] } }).select(bondPeopleFields).session(session).lean();
  if (people.length !== 2 || people.some(person => !memberAvailable(person)) ||
      (requireInvites && people.find(person => String(person._id) === to)?.bondInvitations === false)) {
    denied();
  }
  if (await Block.exists(pairBlockFilter(from, to)).session(session)) denied();
  if (requireFriend && !await Friendship.exists(pairFriendFilter(from, to)).session(session)) denied("Only accepted friends can create a bond");
  const restrictions = await UserSafetyStatus.exists({
    userId: { $in: [from, to] },
    $or: [{ isChatRestricted: true }, { isShadowBanned: true }]
  }).session(session);
  if (restrictions) denied();
}

async function activeSlots(id: string, session?: ClientSession) {
  const query = Bond.find(open(id)).select("users slots").lean();
  if (session) query.session(session);
  const bonds = await query;
  return bonds.map(bond => bond.slots[bond.users.findIndex(user => String(user) === id)]);
}

async function availableSlots(id: string, now: Date, session: ClientSession) {
  const occupied = new Set(await activeSlots(id, session));
  const requests = await BondRequest.find({ senderId: id, status: "PENDING", bondId: null, expiresAt: { $gt: now } }).select("slot").session(session).lean();
  for (const request of requests) occupied.add(request.slot ?? 0);
  return Array.from({ length: bondConfig.capacity }, (_, index) => index + 1).filter(slot => !occupied.has(slot));
}

async function notification(userId: string, kind: string, title: string, body: string, session: ClientSession, reference: Record<string, unknown> = {}) {
  const [row] = await Notification.create([{ userId, type: "SYSTEM", title, body, data: { type: "BONDS", kind, ...reference } }], { session, ordered: true });
  return row;
}

export function publishBonds(ids: string[], version?: number, eventId?: string, notes: NotificationRow[] = []) {
  for (const id of new Set(ids)) {
    emitUser(id, "bonds:changed", { at: new Date().toISOString(), version, eventId });
  }
  for (const note of notes) {
    const delivery = dispatchNotification(note).catch(error => console.warn("Bond notification delivery failed:", error instanceof Error ? error.name : "unknown"));
    trackBondBackground?.(delivery);
  }
}

async function closeRequest(request: BondRequestRecord, outcome: Exclude<Outcome, "ACCEPTED">, now: Date, session: ClientSession) {
  const update = await BondRequest.updateOne({ _id: request._id, status: "PENDING" }, {
    $set: { status: outcome, resolvedAt: now }, $inc: { version: 1 }
  }, { session });
  if (!update.modifiedCount) return false;
  if (request.price > 0 && await User.exists({ _id: request.senderId }).session(session)) {
    await creditWallet(String(request.senderId), request.price, "BOND_RELEASE", {
      idempotencyKey: `bond:release:${request._id}`, invitationId: String(request._id)
    }, session);
  }
  return true;
}

export async function expireBondRequests(userId?: string, now = new Date()) {
  const filter = userId ? pending(userId) : { status: "PENDING" };
  const expired = await BondRequest.find({ ...filter, expiresAt: { $lte: now } }).select("pairKey").limit(100).lean();
  for (const item of expired) {
    const ids = idsFor(item.pairKey);
    const result = await mongoose.connection.transaction(async session => {
      await lockUsers(ids, session);
      const request = await BondRequest.findOne({ _id: item._id, status: "PENDING", expiresAt: { $lte: now } }).session(session).lean();
      if (!request || !await closeRequest(request, "EXPIRED", now, session)) return;
      return { version: request.version + 1, note: await notification(String(request.senderId), "EXPIRED", "Bond invitation expired", "The invitation slot and any held coins are available again.", session) };
    });
    if (result) publishBonds(ids, result.version, `${item._id}:${result.version}`, [result.note]);
  }
}

export async function sendBondRequest(sender: string, input: { recipient: string; kind: BondKind; slot?: number; giftId?: string; message?: string; key: string; bondId?: string }) {
  const recipient = safeId(input.recipient);
  if (sender === recipient) denied("You cannot invite yourself");
  const pair = relationshipPairKey(sender, recipient);
  await expireBondRequests(sender);
  const result = await mongoose.connection.transaction(async session => {
    await lockUsers(idsFor(pair), session);
    const now = new Date();
    const previous = await BondRequest.findOne({ senderId: sender, key: input.key }).session(session).lean();
    if (previous) {
      if (String(previous.recipientId) !== recipient || previous.kind !== input.kind || previous.slot !== input.slot ||
          String(previous.giftId ?? "") !== (input.giftId ?? "") || (previous.message ?? "") !== (input.message ?? "")) {
        fail("This request key was already used");
      }
      return { request: previous };
    }
    await eligiblePair(sender, recipient, session, !input.bondId);
    if (await BondRequest.exists({ pairKey: pair, status: "PENDING" }).session(session)) fail("A request is already pending");
    const active = await Bond.findOne({ pairKey: pair, status: "ACTIVE" }).session(session).lean();
    if (input.bondId) {
      if (String(active?._id ?? "") !== input.bondId || active?.kind === input.kind) fail("No eligible bond to change");
    } else {
      if (active) fail("You already have a bond together");
      if (!input.slot || !(await availableSlots(sender, now, session)).includes(input.slot)) fail("This slot is unavailable");
      if (!(await availableSlots(recipient, now, session)).length) fail("Your friend has no available slots");
    }
    const recent = await BondRequest.countDocuments({ senderId: sender, createdAt: { $gte: new Date(now.getTime() - dayMs) } }).session(session);
    if (recent >= bondConfig.dailyRequestLimit) throw new HttpError(429, "Daily bond request limit reached");
    if (await BondRequest.exists({ pairKey: pair, status: { $in: ["DECLINED", "CANCELLED"] }, resolvedAt: { $gt: new Date(now.getTime() - bondConfig.pairCooldownMs) } }).session(session)) {
      fail("You can send another invitation later");
    }
    const gift = input.giftId && !input.bondId
      ? await Gift.findOne({ _id: safeId(input.giftId), isActive: true, category: "bonds", bondPurpose: "INVITATION", bondKind: input.kind, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).session(session).lean()
      : null;
    if (input.giftId && !gift) fail("Invitation gift is unavailable");
    if (!gift && !input.bondId && !bondConfig.freeInvitations) fail("Choose an invitation gift");
    const [request] = await BondRequest.create([{
      senderId: sender, recipientId: recipient, pairKey: pair, slot: input.slot, kind: input.kind, bondId: input.bondId,
      giftId: gift?._id, giftName: gift?.name, giftIcon: gift?.icon, price: gift?.coinPrice ?? 0, giftPoints: gift?.bondPoints ?? 0,
      message: input.message, key: input.key, expiresAt: new Date(now.getTime() + bondConfig.invitationHours * 3_600_000)
    }], { session, ordered: true });
    if (request.price > 0) {
      await debitWallet(sender, request.price, "BOND_HOLD", {
        idempotencyKey: `bond:hold:${request._id}`, invitationId: request.id
      }, session);
    }
    const note = await notification(recipient, input.bondId ? "TYPE_CHANGE" : "INVITATION", "New bond request", "Open Relationship Center to review it.", session, { requestId: request.id });
    return { request, note };
  });
  if (result.note) publishBonds(idsFor(pair), 1, `${result.request._id}:1`, [result.note]);
  return { id: String(result.request._id), status: result.request.status };
}

export async function addBondReward(bond: BondRecord, key: string, itemId: string, now: Date, session: ClientSession, expiresAt?: Date) {
  for (const userId of bond.users) {
    const entry = await BondReward.updateOne({ bondId: bond._id, userId, key }, {
      $setOnInsert: { itemId, grantedAt: now, expiresAt }
    }, { session, upsert: true });
    if (entry.upsertedCount) await User.updateOne({ _id: userId }, { $addToSet: { ownedCosmeticIds: itemId }, $inc: { bondVersion: 1 } }, { session });
  }
}

async function addPoints(bond: BondRecord, key: string, kind: string, points: number, session: ClientSession,
  notes: NotificationRow[], actorId?: string, support = 0) {
  await BondPoint.create([{ bondId: bond._id, actorId, key, kind, points, support }], { session, ordered: true });
  const update = await Bond.updateOne({ _id: bond._id, status: "ACTIVE" }, { $inc: { points, version: 1 } }, { session });
  if (!update.modifiedCount) fail("This bond has ended");
  const level = bondLevel(bond.points + points).level;
  if (level > bondLevel(bond.points).level) {
    for (const userId of bond.users.map(String)) {
      notes.push(await notification(userId, "LEVEL_UP", "Your bond reached a new level", `Your shared bond is now level ${level}.`, session, { bondId: String(bond._id) }));
    }
  }
}

async function settleGift(input: {
  bond: BondRecord; sender: string; recipient: string; giftId: mongoose.Types.ObjectId; amount: number;
  points: number; requestKey: string; held?: boolean; cosmetic?: string | null
}, session: ClientSession, notes: NotificationRow[]) {
  const { bond, sender, recipient, amount, giftId, requestKey, cosmetic } = input;
  const key = `bond:gift:${requestKey}`;
  const existing = await GiftTransaction.findOne({ senderId: sender, "metadata.idempotencyKey": key }).session(session).lean();
  if (existing) {
    if (String(existing.giftId) !== String(giftId) || String(existing.metadata.bondId) !== String(bond._id)) fail("This gift key was already used");
    return;
  }
  const metadata = { idempotencyKey: key, bondId: String(bond._id), giftId: String(giftId), platformFee: amount - creatorShare(amount) };
  if (input.held) {
    await assertWalletNotFrozen(sender, session);
    await User.updateOne({ _id: sender }, { $inc: { wealthExp: amount } }, { session });
  } else {
    await debitWallet(sender, amount, "GIFT_SENT_DM", metadata, session);
    await User.updateOne({ _id: sender }, { $inc: { wealthExp: amount } }, { session });
  }
  await creditWallet(recipient, creatorShare(amount), "GIFT_RECEIVED_DM", metadata, session);
  const [transaction] = await GiftTransaction.create([{
    senderId: sender, receiverId: recipient, giftId, coinAmount: amount, totalValue: amount, metadata
  }], { session, ordered: true });
  const startOfDay = new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const ledger = await BondPoint.aggregate<{ _id: null; total: number }>([
    { $match: { bondId: bond._id, kind: "GIFT", createdAt: { $gte: startOfDay } } },
    { $group: { _id: null, total: { $sum: "$points" } } }
  ]).session(session);
  const awarded = Math.min(input.points, Math.max(0, bondConfig.dailyGiftPoints - (ledger[0]?.total ?? 0)));
  await addPoints(bond, String(transaction._id), "GIFT", awarded, session, notes, sender, amount);
  if (cosmetic) await addBondReward(bond, key, cosmetic, new Date(), session);
}

export async function resolveBondRequest(id: string, actor: string, action: "ACCEPTED" | "DECLINED" | "CANCELLED") {
  const initial = await BondRequest.findById(safeId(id)).lean() ?? missing();
  const sender = String(initial.senderId);
  const recipient = String(initial.recipientId);
  if (actor !== (action === "CANCELLED" ? sender : recipient)) denied();
  await expireBondRequests(recipient);
  const ids = idsFor(initial.pairKey);
  const result = await mongoose.connection.transaction(async session => {
    await lockUsers(ids, session);
    const request = await BondRequest.findById(id).session(session).lean() ?? missing();
    if (request.status !== "PENDING") return { status: request.status, bondId: request.bondId, version: request.version, notes: [] as NotificationRow[] };
    const now = new Date();
    let outcome: Outcome = request.expiresAt <= now ? "EXPIRED" : action;
    if (outcome === "ACCEPTED") {
      try {
        await eligiblePair(sender, recipient, session, !request.bondId, true);
        if (request.price) {
          await assertWalletNotFrozen(sender, session);
          const hold = await WalletTransaction.exists({
            userId: sender, type: "DEBIT", source: "BOND_HOLD", amount: request.price,
            "metadata.idempotencyKey": `bond:hold:${request._id}`
          }).session(session);
          if (!hold) fail("Gift hold requires reconciliation");
        }
      } catch (error) {
        if (!(error instanceof HttpError) || error.status !== 403) throw error;
        outcome = "INVALIDATED";
      }
    }
    const notes: NotificationRow[] = [];
    if (outcome !== "ACCEPTED") {
      await closeRequest(request, outcome, now, session);
      if (outcome !== "CANCELLED") {
        notes.push(await notification(sender, outcome, "Bond request closed", "The slot and any held coins are available again.", session));
      }
      return { status: outcome, version: request.version + 1, notes };
    }
    let bond: BondRecord;
    if (request.bondId) {
      const converted = await Bond.findOneAndUpdate({ _id: request.bondId, pairKey: request.pairKey, status: "ACTIVE" },
        { $set: { kind: request.kind }, $inc: { version: 1 } }, { session, new: true }).lean();
      if (!converted) {
        await closeRequest(request, "INVALIDATED", now, session);
        return { status: "INVALIDATED", version: request.version + 1, notes };
      }
      bond = converted;
    } else {
      const recipientSlot = (await availableSlots(recipient, now, session))[0] ?? fail("No available slot. Free a slot before accepting.");
      if (!request.slot || request.slot > bondConfig.capacity || (await activeSlots(sender, session)).includes(request.slot)) fail("The sender's slot is unavailable");
      if (await Bond.exists({ pairKey: request.pairKey, status: "ACTIVE" }).session(session)) fail("This bond is already active");
      const [created] = await Bond.create([{
        pairKey: request.pairKey, users: [sender, recipient], slots: [request.slot, recipientSlot],
        kind: request.kind, activatedAt: now, nextMilestoneAt: new Date(now.getTime() + dayMs),
        anniversaryReminderAt: new Date(nextAnniversary(now, now).getTime() - anniversaryLeadMs)
      }], { session, ordered: true });
      bond = created;
      if (request.giftId && request.price > 0) {
        await settleGift({ bond, sender, recipient, giftId: request.giftId, amount: request.price,
          points: request.giftPoints, held: true, requestKey: `invitation:${request._id}` }, session, notes);
      }
    }
    await BondRequest.updateOne({ _id: request._id, status: "PENDING" }, {
      $set: { status: "ACCEPTED", bondId: bond._id, resolvedAt: now }, $inc: { version: 1 }
    }, { session });
    notes.push(await notification(sender, request.slot ? "ESTABLISHED" : "TYPE_CHANGED", "Bond request accepted", "Your bond is ready to view.", session, { bondId: String(bond._id) }));
    return { status: "ACCEPTED", bondId: bond._id, version: request.version + 1, notes };
  });
  if (result.notes.length || result.version !== initial.version) publishBonds(ids, result.version, `${id}:${result.version}`, result.notes);
  return { status: result.status, bondId: result.bondId ? String(result.bondId) : null };
}

export async function readBond(id: string, actor: string) {
  return await Bond.findOne({ _id: safeId(id), users: actor }).lean() ?? missing();
}

async function withActiveBond<T>(id: string, actor: string, run: (bond: BondRecord, partner: string, session: ClientSession, notes: NotificationRow[]) => Promise<T>) {
  const initial = await readBond(id, actor);
  const ids = initial.users.map(String);
  const partner = ids.find(user => user !== actor) ?? missing();
  const result = await mongoose.connection.transaction(async session => {
    await lockUsers(ids, session);
    const bond = await Bond.findOne({ _id: initial._id, status: "ACTIVE", users: actor }).session(session).lean() ?? fail("This bond has ended");
    await eligiblePair(actor, partner, session, false, false);
    const notes: NotificationRow[] = [];
    const value = await run(bond, partner, session, notes);
    return { value, notes };
  });
  publishBonds(ids, undefined, undefined, result.notes);
  return result.value;
}

export async function bondCheckIn(id: string, actor: string) {
  return withActiveBond(id, actor, async (bond, partner, session, notes) => {
    const day = new Date().toISOString().slice(0, 10);
    const checkInKey = `check-in:${day}:${actor}`;
    if (await BondPoint.exists({ bondId: bond._id, key: checkInKey }).session(session)) return { checkedIn: true };
    await addPoints(bond, checkInKey, "CHECK_IN", 0, session, notes, actor);
    if (await BondPoint.exists({ bondId: bond._id, key: `check-in:${day}:${partner}` }).session(session)) {
      await addPoints(bond, `reciprocal:${day}`, "ACTIVITY", bondConfig.dailyCheckInPoints, session, notes);
    }
    return { checkedIn: true };
  });
}

export async function sendBondGift(id: string, actor: string, giftId: string, key: string) {
  return withActiveBond(id, actor, async (bond, partner, session, notes) => {
    const now = new Date();
    const gift = await Gift.findOne({ _id: safeId(giftId), category: "bonds", isActive: true,
      bondPurpose: { $in: ["PROGRESSION", "ANNIVERSARY", "COSMETIC"] }, $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }] }).session(session).lean();
    if (!gift || (gift.bondKind && gift.bondKind !== bond.kind) || (gift.bondMinimumDays ?? 0) > bondDays(bond, now)) return fail("This gift is unavailable for this bond");
    await settleGift({ bond, sender: actor, recipient: partner, giftId: gift._id, amount: gift.coinPrice,
      points: gift.bondPoints ?? 0, requestKey: `progress:${id}:${key}`, cosmetic: gift.bondCosmeticId }, session, notes);
    return { sent: true };
  });
}

export async function setBondPreferences(id: string, actor: string, patch: Partial<ReturnType<typeof bondPreferences>>) {
  return withActiveBond(id, actor, async (bond, _partner, session) => {
    const settings = { ...bondPreferences(bond, actor), ...patch };
    await Bond.updateOne({ _id: bond._id }, { $set: { [`preferences.${actor}`]: settings }, $inc: { version: 1 } }, { session });
    return { settings };
  });
}

async function endPair(pair: string, actor: string, status: EndStatus, session: ClientSession, bondId?: string) {
  const now = new Date();
  const requests = await BondRequest.find({ pairKey: pair, status: "PENDING" }).session(session).lean();
  for (const request of requests) await closeRequest(request, "INVALIDATED", now, session);
  return await Bond.findOneAndUpdate({ pairKey: pair, status: "ACTIVE", ...(bondId ? { _id: bondId } : {}) },
    { $set: { status, endedAt: now, endedBy: actor }, $inc: { version: 1 } }, { session, new: true }).lean();
}

export async function endBond(id: string, actor: string) {
  const existing = await readBond(id, actor);
  if (existing.status !== "ACTIVE") return { ended: true };
  const ids = existing.users.map(String);
  const result = await mongoose.connection.transaction(async session => {
    await lockUsers(ids, session);
    if (!await Bond.exists({ _id: id, status: "ACTIVE" }).session(session)) return;
    const ended = await endPair(existing.pairKey, actor, "ENDED", session, id);
    const partner = ids.find(user => user !== actor) ?? missing();
    return ended && { ended, note: await notification(partner, "ENDED", "Bond ended", "Relationship Center has been updated.", session) };
  });
  if (result) publishBonds(ids, result.ended.version, `${id}:${result.ended.version}`, [result.note]);
  return { ended: true };
}

export async function blockBondPair(actor: string, target: string) {
  const pair = relationshipPairKey(actor, target);
  const ids = idsFor(pair);
  await mongoose.connection.transaction(async session => {
    await lockUsers(ids, session);
    await Block.updateOne({ blockerId: actor, blockedUserId: target },
      { $setOnInsert: { blockerId: actor, blockedUserId: target } }, { upsert: true, session });
    await User.updateOne({ _id: actor }, { $pull: { closeFriendIds: target } }, { session });
    await endPair(pair, actor, "TERMINATED_BY_BLOCK", session);
  });
  publishBonds(ids);
}

export async function endUnavailableBonds(actor: string, status: "TERMINATED_BY_MODERATION" | "TERMINATED_BY_ACCOUNT_REMOVAL") {
  const pairs = new Set([
    ...await Bond.distinct("pairKey", open(actor)),
    ...await BondRequest.distinct("pairKey", pending(actor))
  ]);
  for (const pair of pairs) {
    const ids = idsFor(pair);
    await mongoose.connection.transaction(async session => {
      await lockUsers(ids, session);
      await endPair(pair, actor, status, session);
    });
    publishBonds(ids);
  }
}

export function bondDays(bond: BondRecord, now = new Date()) {
  return Math.max(0, Math.floor(((bond.endedAt ?? now).getTime() - bond.activatedAt.getTime()) / dayMs));
}

export function describeBond(bond: BondRecord) {
  return {
    id: String(bond._id), kind: bond.kind, kindName: bondKinds[bond.kind as BondKind]?.name ?? bond.kind,
    status: bond.status, activatedAt: bond.activatedAt, endedAt: bond.endedAt, days: bondDays(bond),
    points: bond.points, version: bond.version, ...bondLevel(bond.points),
    milestoneDays: bond.milestoneDays, nextMilestoneAt: bond.nextMilestoneAt,
    nextAnniversaryAt: bond.status === "ACTIVE" ? nextAnniversary(bond.activatedAt, new Date()) : null
  };
}

export async function listBondGifts() {
  await ensureBondCatalog();
  const gifts = await Gift.find({ category: "bonds", isActive: true, $or: [{ expiresAt: null }, { expiresAt: { $gt: new Date() } }] })
    .sort({ coinPrice: 1, _id: 1 }).limit(50).lean();
  return gifts.map(gift => ({
    id: String(gift._id), name: gift.name, icon: gift.icon, price: gift.coinPrice,
    purpose: gift.bondPurpose, kind: gift.bondKind, points: gift.bondPoints, minimumDays: gift.bondMinimumDays
  }));
}

