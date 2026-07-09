import crypto from "crypto";
import mongoose from "mongoose";
import { Block } from "../models/Block.js";
import { Gift } from "../models/Gift.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { PkBattle } from "../models/PkBattle.js";
import { PkEvent } from "../models/PkEvent.js";
import { PkInvite } from "../models/PkInvite.js";
import { PkLeaderboardEntry } from "../models/PkLeaderboardEntry.js";
import { PkParticipant } from "../models/PkParticipant.js";
import { Room } from "../models/Room.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { User } from "../models/User.js";
import { createNotification } from "./notifications.js";
import { emitRoom, emitUser } from "./socket.js";
import { creditWallet, debitWallet } from "./wallet.js";
import { rankPkOpponents } from "./pkMatch.js";
import { ErrorCode, HttpError, isValidObjectId, sanitizeText } from "../utils/http.js";

export const pkSocketEvents = {
  inviteReceived: "pk:invite:received",
  inviteSent: "pk:invite:sent",
  inviteAccepted: "pk:invite:accepted",
  inviteRejected: "pk:invite:rejected",
  inviteExpired: "pk:invite:expired",
  started: "pk:started",
  state: "pk:state",
  scoreUpdate: "pk:score:update",
  leadChanged: "pk:lead:changed",
  giftReceived: "pk:gift:received",
  reactionReceived: "pk:reaction:received",
  timerTick: "pk:timer:tick",
  ended: "pk:ended",
  forceEnded: "pk:force_ended",
  rematchRequested: "pk:rematch:requested",
  error: "pk:error"
} as const;

export const allowedPkDurations = [180, 300, 600];
const activeStatuses = ["INVITED", "WAITING", "ACTIVE"];
const reactionPoints: Record<string, number> = { heart: 1, clap: 1, fire: 2, wow: 2, laugh: 1, sparkle: 1 };
const reactionBuckets = new Map<string, { points: number; resetAt: number }>();
const giftCombos = new Map<string, { count: number; resetAt: number }>();
const timers = new Map<string, NodeJS.Timeout>();

type PkSide = "LEFT" | "RIGHT";
type PkMode = "GIFT" | "REACTION" | "MIXED";
type PkBattleType = "VOICE" | "VIDEO";

function battleCode() {
  return `PK-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

function objectId(value: string, label: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
  return value;
}

function leader(leftScore: number, rightScore: number) {
  if (leftScore > rightScore) return "LEFT";
  if (rightScore > leftScore) return "RIGHT";
  return "DRAW";
}

function remainingSeconds(battle: any) {
  if (!battle.startedAt) return battle.durationSeconds;
  const elapsed = Math.floor((Date.now() - new Date(battle.startedAt).getTime()) / 1000);
  return Math.max(0, battle.durationSeconds - elapsed);
}

async function participantCount(roomId: unknown) {
  return RoomParticipant.countDocuments({ roomId, leftAt: null });
}

async function publicSide(battle: any, side: PkSide) {
  const roomId = side === "LEFT" ? battle.leftRoomId : battle.rightRoomId;
  const hostId = side === "LEFT" ? battle.leftHostId : battle.rightHostId;
  const score = side === "LEFT" ? battle.leftScore : battle.rightScore;
  const [room, host, count] = await Promise.all([
    Room.findById(roomId).select("title category language participantCount").lean(),
    User.findById(hostId).select("name username avatar activeCosmetics").lean(),
    participantCount(roomId)
  ]);
  return {
    roomId: roomId?.toString?.() ?? String(roomId),
    roomTitle: room?.title ?? "",
    hostId: hostId?.toString?.() ?? String(hostId),
    hostName: host?.name ?? "Yugm Host",
    hostAvatar: host?.avatar,
    activeCosmetics: host?.activeCosmetics ?? {},
    score,
    participantCount: count || room?.participantCount || 0
  };
}

export async function pkState(battleOrId: any) {
  const battle = typeof battleOrId === "string"
    ? await PkBattle.findById(battleOrId).lean()
    : battleOrId;
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  const [left, right] = await Promise.all([publicSide(battle, "LEFT"), publicSide(battle, "RIGHT")]);
  return {
    battleId: battle._id?.toString?.() ?? battle.id,
    id: battle._id?.toString?.() ?? battle.id,
    battleCode: battle.battleCode,
    title: battle.title ?? "",
    status: battle.status,
    mode: battle.mode,
    battleType: battle.battleType,
    durationSeconds: battle.durationSeconds,
    remainingSeconds: remainingSeconds(battle),
    left,
    right,
    leader: leader(battle.leftScore ?? 0, battle.rightScore ?? 0),
    winnerSide: battle.winnerSide,
    startedAt: battle.startedAt,
    endedAt: battle.endedAt
  };
}

async function emitPkState(battle: any, event: string = pkSocketEvents.state) {
  const state = await pkState(battle);
  emitRoom(state.left.roomId, event, state);
  emitRoom(state.right.roomId, event, state);
  return state;
}

async function addPkEvent(input: {
  battleId: unknown;
  roomId?: unknown;
  userId?: string;
  eventType: string;
  side?: PkSide | "DRAW";
  points?: number;
  giftTransactionId?: unknown;
  metadata?: Record<string, unknown>;
}) {
  return PkEvent.create({
    battleId: input.battleId,
    roomId: input.roomId,
    userId: input.userId,
    eventType: input.eventType,
    side: input.side,
    points: input.points ?? 0,
    giftTransactionId: input.giftTransactionId,
    metadata: input.metadata ?? {}
  });
}

async function assertHost(userId: string, roomId: string) {
  const room = await Room.findById(roomId).lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  if (room.hostId.toString() !== userId) throw new HttpError(403, "Only room host can start PK", ErrorCode.FORBIDDEN);
  const host = await User.findById(userId).select("isBlocked mutedUntil suspendedUntil name").lean();
  if (!host || host.isBlocked || (host.suspendedUntil && host.suspendedUntil > new Date()) || (host.mutedUntil && host.mutedUntil > new Date())) {
    throw new HttpError(403, "Restricted hosts cannot start PK", ErrorCode.FORBIDDEN);
  }
  return room;
}

async function assertNoActivePk(roomId: string) {
  const existing = await PkBattle.exists({
    status: { $in: activeStatuses },
    $or: [{ leftRoomId: roomId }, { rightRoomId: roomId }]
  });
  if (existing) throw new HttpError(409, "Room already has an active PK", ErrorCode.CONFLICT);
}

export async function createPkInvite(input: {
  userId: string;
  roomId: string;
  opponentRoomId: string;
  opponentHostId: string;
  battleType: PkBattleType;
  mode: PkMode;
  durationSeconds: number;
  title?: string;
}) {
  objectId(input.roomId, "roomId");
  objectId(input.opponentRoomId, "opponentRoomId");
  objectId(input.opponentHostId, "opponentHostId");
  if (!allowedPkDurations.includes(input.durationSeconds)) throw new HttpError(400, "Invalid PK duration", ErrorCode.VALIDATION);
  const room = await assertHost(input.userId, input.roomId);
  const opponentRoom = await Room.findById(input.opponentRoomId).lean();
  if (!opponentRoom || opponentRoom.status !== "LIVE") throw new HttpError(404, "Opponent room is not live", ErrorCode.NOT_FOUND);
  if (opponentRoom.hostId.toString() !== input.opponentHostId) throw new HttpError(400, "Opponent host does not own that room", ErrorCode.VALIDATION);
  if (room.type !== input.battleType || opponentRoom.type !== input.battleType) throw new HttpError(400, "PK type must match both rooms", ErrorCode.VALIDATION);
  const blocked = await Block.exists({
    $or: [
      { blockerId: input.userId, blockedUserId: input.opponentHostId },
      { blockerId: input.opponentHostId, blockedUserId: input.userId }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot invite this host", ErrorCode.FORBIDDEN);
  await Promise.all([assertNoActivePk(input.roomId), assertNoActivePk(input.opponentRoomId)]);

  const battle = await PkBattle.create({
    battleCode: battleCode(),
    title: sanitizeText(input.title ?? ""),
    mode: input.mode,
    status: "INVITED",
    battleType: input.battleType,
    durationSeconds: input.durationSeconds,
    startedByUserId: input.userId,
    leftRoomId: input.roomId,
    rightRoomId: input.opponentRoomId,
    leftHostId: input.userId,
    rightHostId: input.opponentHostId
  });
  const invite = await PkInvite.create({
    battleId: battle._id,
    inviterUserId: input.userId,
    inviteeUserId: input.opponentHostId,
    inviterRoomId: input.roomId,
    inviteeRoomId: input.opponentRoomId,
    expiresAt: new Date(Date.now() + 60_000)
  });
  await Promise.all([
    addPkEvent({ battleId: battle._id, roomId: input.roomId, userId: input.userId, eventType: "PK_CREATED" }),
    addPkEvent({ battleId: battle._id, roomId: input.opponentRoomId, userId: input.userId, eventType: "PK_INVITE_SENT" }),
    createNotification(input.opponentHostId, "SYSTEM", "PK Battle Invite", `${(room as any).title} invited you to a PK Battle`, { battleId: battle.id, inviteId: invite.id, roomId: input.roomId, type: "PK_INVITE" })
  ]);
  const state = await pkState(battle.toObject());
  emitUser(input.opponentHostId, pkSocketEvents.inviteReceived, { invite, battle: state });
  emitRoom(input.roomId, pkSocketEvents.inviteSent, { invite, battle: state });
  scheduleInviteExpiry(invite.id);
  return { battle: state, invite };
}

export async function autoMatchPk(input: {
  userId: string;
  roomId: string;
  battleType: PkBattleType;
  mode: PkMode;
  durationSeconds: number;
  title?: string;
}) {
  const room = await assertHost(input.userId, input.roomId);
  const opponents = await availableOpponents({ userId: input.userId, battleType: input.battleType, limit: 50 });
  const ranked = rankPkOpponents(room, input.roomId, opponents);
  const opponent = ranked[0];
  if (!opponent) throw new HttpError(404, "No live PK opponent is available right now", ErrorCode.NOT_FOUND);
  return createPkInvite({
    userId: input.userId,
    roomId: input.roomId,
    opponentRoomId: opponent.roomId,
    opponentHostId: opponent.hostId,
    battleType: input.battleType,
    mode: input.mode,
    durationSeconds: input.durationSeconds,
    title: input.title
  });
}

export async function acceptPkInvite(userId: string, inviteId: string) {
  objectId(inviteId, "inviteId");
  const invite = await PkInvite.findById(inviteId);
  if (!invite) throw new HttpError(404, "PK invite not found", ErrorCode.NOT_FOUND);
  if (invite.inviteeUserId.toString() !== userId) throw new HttpError(403, "Only invitee can accept", ErrorCode.FORBIDDEN);
  if (invite.status !== "PENDING") throw new HttpError(409, "Invite is not pending", ErrorCode.CONFLICT);
  if (invite.expiresAt.getTime() < Date.now()) return expireInvite(invite.id);
  const battle = await PkBattle.findById(invite.battleId);
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  const [leftRoom, rightRoom] = await Promise.all([Room.findById(battle.leftRoomId).lean(), Room.findById(battle.rightRoomId).lean()]);
  if (leftRoom?.status !== "LIVE" || rightRoom?.status !== "LIVE") throw new HttpError(400, "Both rooms must be live", ErrorCode.VALIDATION);
  battle.status = "ACTIVE";
  battle.startedAt = new Date();
  await battle.save();
  invite.status = "ACCEPTED";
  invite.respondedAt = new Date();
  await invite.save();
  await PkParticipant.updateOne({ battleId: battle._id, userId: battle.leftHostId }, { battleId: battle._id, userId: battle.leftHostId, roomId: battle.leftRoomId, side: "LEFT", role: "HOST", joinedAt: new Date() }, { upsert: true });
  await PkParticipant.updateOne({ battleId: battle._id, userId: battle.rightHostId }, { battleId: battle._id, userId: battle.rightHostId, roomId: battle.rightRoomId, side: "RIGHT", role: "HOST", joinedAt: new Date() }, { upsert: true });
  await addPkEvent({ battleId: battle._id, userId, eventType: "PK_INVITE_ACCEPTED" });
  await addPkEvent({ battleId: battle._id, eventType: "PK_STARTED" });
  const state = await emitPkState(battle.toObject(), pkSocketEvents.started);
  emitUser(battle.leftHostId.toString(), pkSocketEvents.inviteAccepted, state);
  startBattleTimer(battle.id);
  return { battle: state, invite };
}

export async function rejectPkInvite(userId: string, inviteId: string) {
  objectId(inviteId, "inviteId");
  const invite = await PkInvite.findById(inviteId);
  if (!invite) throw new HttpError(404, "PK invite not found", ErrorCode.NOT_FOUND);
  if (invite.inviteeUserId.toString() !== userId) throw new HttpError(403, "Only invitee can reject", ErrorCode.FORBIDDEN);
  invite.status = "REJECTED";
  invite.respondedAt = new Date();
  await invite.save();
  const battle = await PkBattle.findByIdAndUpdate(invite.battleId, { status: "DECLINED", endedAt: new Date() }, { new: true }).lean();
  await addPkEvent({ battleId: invite.battleId, userId, eventType: "PK_INVITE_REJECTED" });
  if (battle) emitRoom(battle.leftRoomId.toString(), pkSocketEvents.inviteRejected, { battleId: battle._id.toString(), inviteId });
  return { rejected: true };
}

export async function cancelPk(userId: string, battleId: string) {
  const battle = await PkBattle.findById(battleId);
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  if (battle.leftHostId.toString() !== userId && battle.startedByUserId.toString() !== userId) throw new HttpError(403, "Cannot cancel this PK", ErrorCode.FORBIDDEN);
  battle.status = "CANCELLED";
  battle.endedAt = new Date();
  await battle.save();
  await PkInvite.updateMany({ battleId }, { status: "CANCELLED", respondedAt: new Date() });
  await emitPkState(battle.toObject(), pkSocketEvents.ended);
  stopBattleTimer(battle.id);
  return { cancelled: true };
}

export async function endPkBattle(input: { userId?: string; battleId: string; force?: boolean; reason?: string }) {
  objectId(input.battleId, "battleId");
  const battle = await PkBattle.findById(input.battleId);
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  if (!input.force && input.userId && ![battle.leftHostId.toString(), battle.rightHostId.toString(), battle.startedByUserId.toString()].includes(input.userId)) {
    throw new HttpError(403, "Host control required", ErrorCode.FORBIDDEN);
  }
  const winnerSide = leader(battle.leftScore, battle.rightScore);
  battle.status = input.force ? "FORCE_ENDED" : "ENDED";
  battle.winnerSide = winnerSide;
  battle.winnerUserId = winnerSide === "LEFT" ? battle.leftHostId : winnerSide === "RIGHT" ? battle.rightHostId : undefined;
  battle.endedAt = new Date();
  await battle.save();
  stopBattleTimer(battle.id);
  await addPkEvent({
    battleId: battle._id,
    eventType: input.force ? "PK_FORCE_ENDED" : "PK_ENDED",
    side: winnerSide,
    metadata: { reason: input.reason }
  });
  const state = await emitPkState(battle.toObject(), input.force ? pkSocketEvents.forceEnded : pkSocketEvents.ended);
  return { battle: state };
}

export async function getActivePk(roomId: string) {
  objectId(roomId, "roomId");
  const battle = await PkBattle.findOne({
    status: { $in: ["INVITED", "WAITING", "ACTIVE"] },
    $or: [{ leftRoomId: roomId }, { rightRoomId: roomId }]
  }).lean();
  return battle ? pkState(battle) : null;
}

export async function sendPkGift(input: { userId: string; battleId: string; giftId: string; side: PkSide; idempotencyKey?: string }) {
  objectId(input.battleId, "battleId");
  objectId(input.giftId, "giftId");
  const battle = await PkBattle.findById(input.battleId);
  const gift = await Gift.findOne({ _id: input.giftId, isActive: true }).lean();
  if (!battle || battle.status !== "ACTIVE") throw new HttpError(404, "Active PK not found", ErrorCode.NOT_FOUND);
  if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
  const receiverId = input.side === "LEFT" ? battle.leftHostId.toString() : battle.rightHostId.toString();
  const roomId = input.side === "LEFT" ? battle.leftRoomId.toString() : battle.rightRoomId.toString();
  const comboKey = `${input.battleId}:${input.userId}:${input.side}:gift`;
  const existingCombo = giftCombos.get(comboKey);
  const combo = existingCombo && existingCombo.resetAt > Date.now() ? existingCombo.count + 1 : 1;
  giftCombos.set(comboKey, { count: combo, resetAt: Date.now() + 12_000 });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(input.userId, gift.coinPrice, "GIFT_SENT", { pkBattleId: battle.id, giftId: gift._id.toString(), side: input.side, idempotencyKey: input.idempotencyKey }, session);
    await creditWallet(receiverId, gift.coinPrice, "GIFT_RECEIVED", { pkBattleId: battle.id, giftId: gift._id.toString(), side: input.side }, session);
    const [giftTransaction] = await GiftTransaction.create([{
      roomId,
      senderId: input.userId,
      receiverId,
      giftId: gift._id,
      coinAmount: gift.coinPrice
    }], { session });
    const scoreUpdate = input.side === "LEFT" ? { $inc: { leftScore: gift.coinPrice } } : { $inc: { rightScore: gift.coinPrice } };
    const updated = await PkBattle.findByIdAndUpdate(battle._id, scoreUpdate, { new: true, session });
    await PkLeaderboardEntry.updateOne(
      { battleId: battle._id, userId: input.userId },
      { $setOnInsert: { battleId: battle._id, userId: input.userId, side: input.side }, $inc: { totalPoints: gift.coinPrice, totalGiftsSent: 1 } },
      { upsert: true, session }
    );
    await session.commitTransaction();
    session.endSession();
    await addPkEvent({ battleId: battle._id, roomId, userId: input.userId, eventType: "GIFT_SENT", side: input.side, points: gift.coinPrice, giftTransactionId: giftTransaction._id, metadata: { giftId: gift._id.toString(), giftName: gift.name, combo } });
    await RoomActivity.create({ roomId, userId: input.userId, type: "GIFT", label: `PK gift: ${gift.name} +${gift.coinPrice}`, metadata: { pkBattleId: battle.id, side: input.side } });
    const state = await emitPkState(updated?.toObject() ?? battle.toObject(), pkSocketEvents.scoreUpdate);
    const payload = {
      battleId: battle.id,
      side: input.side,
      senderId: input.userId,
      giftId: gift._id.toString(),
      giftName: gift.name,
      coinAmount: gift.coinPrice,
      pointsAdded: gift.coinPrice,
      combo,
      leftScore: state.left.score,
      rightScore: state.right.score
    };
    emitRoom(state.left.roomId, pkSocketEvents.giftReceived, payload);
    emitRoom(state.right.roomId, pkSocketEvents.giftReceived, payload);
    return { battle: state, giftTransaction };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}

export async function sendPkReaction(input: { userId: string; battleId: string; side: PkSide; type: string }) {
  const battle = await PkBattle.findById(input.battleId);
  if (!battle || battle.status !== "ACTIVE") throw new HttpError(404, "Active PK not found", ErrorCode.NOT_FOUND);
  const now = Date.now();
  const bucketKey = `${input.battleId}:${input.userId}`;
  const bucket = reactionBuckets.get(bucketKey);
  const resetAt = bucket && bucket.resetAt > now ? bucket.resetAt : now + 10_000;
  const points = reactionPoints[input.type] ?? 1;
  const used = bucket && bucket.resetAt > now ? bucket.points : 0;
  if (used + points > 10) throw new HttpError(429, "Reaction limit reached", ErrorCode.RATE_LIMITED);
  reactionBuckets.set(bucketKey, { points: used + points, resetAt });
  const updated = await PkBattle.findByIdAndUpdate(
    battle._id,
    input.side === "LEFT" ? { $inc: { leftScore: points } } : { $inc: { rightScore: points } },
    { new: true }
  );
  await addPkEvent({ battleId: battle._id, userId: input.userId, eventType: "REACTION_SENT", side: input.side, points, metadata: { type: input.type } });
  const state = await emitPkState(updated?.toObject() ?? battle.toObject(), pkSocketEvents.scoreUpdate);
  emitRoom(state.left.roomId, pkSocketEvents.reactionReceived, { battleId: battle.id, side: input.side, type: input.type, pointsAdded: points, bucketRemaining: Math.max(0, 10 - (used + points)) });
  emitRoom(state.right.roomId, pkSocketEvents.reactionReceived, { battleId: battle.id, side: input.side, type: input.type, pointsAdded: points, bucketRemaining: Math.max(0, 10 - (used + points)) });
  return { battle: state };
}

export async function availableOpponents(input: { userId: string; battleType?: string; search?: string; limit?: number }) {
  const filter: Record<string, unknown> = { status: "LIVE", visibility: "PUBLIC" };
  if (input.battleType) filter.type = input.battleType;
  const active = await PkBattle.find({ status: { $in: activeStatuses } }).select("leftRoomId rightRoomId").lean();
  const activeRoomIds = active.flatMap((battle) => [battle.leftRoomId, battle.rightRoomId]);
  filter._id = { $nin: activeRoomIds };
  if (input.search) {
    const regex = new RegExp(input.search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
    filter.$or = [{ title: regex }, { category: regex }, { language: regex }];
  }
  const rooms = await Room.find(filter)
    .populate("hostId", "name username avatar city activeCosmetics isBlocked mutedUntil suspendedUntil")
    .sort({ participantCount: -1, createdAt: -1 })
    .limit(Math.min(input.limit ?? 20, 50))
    .lean();
  return rooms
    .filter((room: any) => room.hostId?._id?.toString?.() !== input.userId && !room.hostId?.isBlocked)
    .map((room: any) => ({
      roomId: room._id.toString(),
      roomTitle: room.title,
      battleType: room.type,
      category: room.category,
      language: room.language,
      participantCount: room.participantCount ?? 0,
      hostId: room.hostId?._id?.toString?.() ?? "",
      hostName: room.hostId?.name ?? "Host",
      hostAvatar: room.hostId?.avatar,
      activeCosmetics: room.hostId?.activeCosmetics ?? {}
    }));
}

export async function expireInvite(inviteId: string) {
  const invite = await PkInvite.findById(inviteId);
  if (!invite || invite.status !== "PENDING") return { expired: false };
  invite.status = "EXPIRED";
  invite.respondedAt = new Date();
  await invite.save();
  const battle = await PkBattle.findByIdAndUpdate(invite.battleId, { status: "EXPIRED", endedAt: new Date() }, { new: true }).lean();
  if (battle) {
    await addPkEvent({ battleId: invite.battleId, userId: invite.inviteeUserId.toString(), eventType: "PK_INVITE_EXPIRED" });
    emitRoom(battle.leftRoomId.toString(), pkSocketEvents.inviteExpired, { battleId: battle._id.toString(), inviteId });
    emitUser(invite.inviteeUserId.toString(), pkSocketEvents.inviteExpired, { battleId: battle._id.toString(), inviteId });
  }
  return { expired: true };
}

export function scheduleInviteExpiry(inviteId: string) {
  setTimeout(() => expireInvite(inviteId).catch(() => {}), 61_000).unref?.();
}

function stopBattleTimer(battleId: string) {
  const timer = timers.get(battleId);
  if (timer) clearInterval(timer);
  timers.delete(battleId);
}

export function startBattleTimer(battleId: string) {
  stopBattleTimer(battleId);
  const timer = setInterval(async () => {
    const battle = await PkBattle.findById(battleId).lean();
    if (!battle || battle.status !== "ACTIVE") {
      stopBattleTimer(battleId);
      return;
    }
    const state = await pkState(battle);
    emitRoom(state.left.roomId, pkSocketEvents.timerTick, state);
    emitRoom(state.right.roomId, pkSocketEvents.timerTick, state);
    if (state.remainingSeconds <= 0) await endPkBattle({ battleId });
  }, 5000);
  timer.unref?.();
  timers.set(battleId, timer);
}

export async function resumePkTimers() {
  const battles = await PkBattle.find({ status: "ACTIVE" }).lean();
  await Promise.all(battles.map(async (battle) => {
    if (remainingSeconds(battle) <= 0) await endPkBattle({ battleId: battle._id.toString() });
    else startBattleTimer(battle._id.toString());
  }));
  const staleInvites = await PkInvite.find({ status: "PENDING", expiresAt: { $lte: new Date() } }).lean();
  await Promise.all(staleInvites.map((invite) => expireInvite(invite._id.toString())));
}
