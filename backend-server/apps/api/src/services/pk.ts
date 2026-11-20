import crypto from "crypto";
import mongoose from "mongoose";
import { env } from "../config/env.js";
import { Block } from "../models/Block.js";
import { Gift } from "../models/Gift.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { PkBattle } from "../models/PkBattle.js";
import { PkEvent } from "../models/PkEvent.js";
import { PkInvite } from "../models/PkInvite.js";
import { PkLeaderboardEntry } from "../models/PkLeaderboardEntry.js";
import { PkParticipant } from "../models/PkParticipant.js";
import { PkVote } from "../models/PkVote.js";
import { Room } from "../models/Room.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { User } from "../models/User.js";
import { createNotification } from "./notifications.js";
import { emitRoom, emitUser } from "./socket.js";
import { debitWallet } from "./wallet.js";
import { rankPkOpponents } from "./pkMatch.js";
import { assertPkTransition } from "./pkStateMachine.js";
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

export const allowedPkDurations = [60, 180, 300, 600, 900];
const activeStatuses = ["INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN", "ACTIVE", "FINAL_CRUNCH", "FINALIZING", "COMPLETED"];
const reactionPoints: Record<string, number> = { heart: 1, clap: 1, fire: 2, wow: 2, laugh: 1, sparkle: 1 };
const reactionBuckets = new Map<string, { points: number; resetAt: number }>();
const giftCombos = new Map<string, { count: number; resetAt: number }>();
const timers = new Map<string, NodeJS.Timeout>();
const countdownTimers = new Map<string, NodeJS.Timeout>();

type PkSide = "LEFT" | "RIGHT";
type PkMode = "GIFT" | "VOTE" | "REACTION" | "MIXED";
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
    User.findById(hostId).select("name username avatar avatarType avatarParts activeCosmetics").lean(),
    participantCount(roomId)
  ]);
  return {
    roomId: roomId?.toString?.() ?? String(roomId),
    roomTitle: room?.title ?? "",
    hostId: hostId?.toString?.() ?? String(hostId),
    hostName: host?.name ?? "Yugm Host",
    hostAvatar: host?.avatar,
    hostAvatarType: host?.avatarType,
    hostAvatarParts: host?.avatarParts,
    activeCosmetics: host?.activeCosmetics ?? {},
    score,
    members: [] as Array<{ userId: string; name: string; avatar?: string; avatarType?: string; avatarParts?: any; isReady?: boolean; team: string }>,
    participantCount: count || room?.participantCount || 0
  };
}

export async function pkState(battleOrId: any) {
  const battle = typeof battleOrId === "string"
    ? await PkBattle.findById(objectId(battleOrId, "battleId")).lean()
    : battleOrId;
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  const [left, right, members] = await Promise.all([
    publicSide(battle, "LEFT"),
    publicSide(battle, "RIGHT"),
    PkParticipant.find({ battleId: battle._id, leftAt: null })
      .populate("userId", "name username avatar avatarType avatarParts")
      .select("userId side teamName isReady")
      .lean()
  ]);
  left.members = members.filter((entry: any) => entry.side === "LEFT").map((entry: any) => ({ userId: entry.userId?._id?.toString?.() ?? entry.userId?.toString?.(), name: entry.userId?.name ?? "Player", avatar: entry.userId?.avatar, avatarType: entry.userId?.avatarType, avatarParts: entry.userId?.avatarParts, isReady: entry.isReady, team: entry.teamName ?? "A" }));
  right.members = members.filter((entry: any) => entry.side === "RIGHT").map((entry: any) => ({ userId: entry.userId?._id?.toString?.() ?? entry.userId?.toString?.(), name: entry.userId?.name ?? "Player", avatar: entry.userId?.avatar, avatarType: entry.userId?.avatarType, avatarParts: entry.userId?.avatarParts, isReady: entry.isReady, team: entry.teamName ?? "B" }));
  return {
    battleId: battle._id?.toString?.() ?? battle.id,
    id: battle._id?.toString?.() ?? battle.id,
    battleCode: battle.battleCode,
    title: battle.title ?? "",
    status: battle.status,
    stateVersion: battle.stateVersion ?? 1,
    mode: battle.mode,
    format: battle.format ?? "ROOM",
    scope: battle.scope ?? "CROSS_ROOM",
    teamSize: battle.teamSize ?? 1,
    selectedGiftId: battle.selectedGiftId?.toString?.() ?? "",
    battleType: battle.battleType,
    durationSeconds: battle.durationSeconds,
    remainingSeconds: remainingSeconds(battle),
    countdownEndsAt: battle.countdownEndsAt,
    countdownSecondsRemaining: battle.countdownEndsAt ? Math.max(0, Math.ceil((new Date(battle.countdownEndsAt).getTime() - Date.now()) / 1000)) : 0,
    left,
    right,
    leader: leader(battle.leftScore ?? 0, battle.rightScore ?? 0),
    winnerSide: battle.winnerSide,
    terminationReason: battle.terminationReason ?? "",
    startedAt: battle.startedAt,
    endedAt: battle.endedAt
  };
}

async function emitPkState(battle: any, event: string = pkSocketEvents.state) {
  const state = await pkState(battle);
  for (const roomId of new Set([state.left.roomId, state.right.roomId])) emitRoom(roomId, event, state);
  return state;
}

export async function setPkReady(userId: string, battleId: string) {
  objectId(battleId, "battleId");
  const battle = await PkBattle.findById(battleId);
  if (!battle || battle.status !== "PREPARING") throw new HttpError(409, "PK preparation is closed", ErrorCode.CONFLICT);
  assertPkTransition(battle.status, "READY");
  const participant = await PkParticipant.findOneAndUpdate(
    { battleId: battle._id, userId, leftAt: null },
    { $set: { isReady: true } },
    { new: true }
  );
  if (!participant) throw new HttpError(403, "Only a PK participant can ready up", ErrorCode.FORBIDDEN);
  await addPkEvent({ battleId: battle._id, roomId: participant.roomId, userId, eventType: "PK_READY", metadata: { side: participant.side } });
  const [required, ready] = await Promise.all([
    PkParticipant.countDocuments({ battleId: battle._id, leftAt: null }),
    PkParticipant.countDocuments({ battleId: battle._id, leftAt: null, isReady: true })
  ]);
  if (required > 0 && ready === required) {
    const readyBattle = await PkBattle.findOneAndUpdate(
      { _id: battle._id, status: "PREPARING" },
      { $set: { status: "READY" }, $inc: { stateVersion: 1 } },
      { new: true }
    );
    if (readyBattle) {
      await addPkEvent({ battleId: battle._id, eventType: "PK_READY", metadata: { participantsReady: ready } });
      await emitPkState(readyBattle.toObject());
      const countdownEndsAt = new Date(Date.now() + 3_000);
      assertPkTransition("READY", "COUNTDOWN");
      const countdown = await PkBattle.findOneAndUpdate(
        { _id: battle._id, status: "READY" },
        { $set: { status: "COUNTDOWN", countdownEndsAt }, $inc: { stateVersion: 1 } },
        { new: true }
      );
      if (countdown) {
        await addPkEvent({ battleId: battle._id, eventType: "PK_COUNTDOWN" });
        await emitPkState(countdown.toObject());
        schedulePkCountdown(battle.id);
      }
    }
  } else {
    await emitPkState(battle.toObject());
  }
  return { battle: { ...(await pkState(battleId)), myReady: true }, ready: true };
}

function stopPkCountdown(battleId: string) {
  const timer = countdownTimers.get(battleId);
  if (timer) clearTimeout(timer);
  countdownTimers.delete(battleId);
}

function schedulePkCountdown(battleId: string) {
  stopPkCountdown(battleId);
  // Workers use Durable Object alarms to recover deadlines after a restart.
  if (env.YUGM_RUNTIME === "cloudflare") return;
  const tick = async () => {
    const battle = await PkBattle.findById(battleId);
    if (!battle || battle.status !== "COUNTDOWN" || !battle.countdownEndsAt) {
      stopPkCountdown(battleId);
      return;
    }
    const remaining = battle.countdownEndsAt.getTime() - Date.now();
    if (remaining <= 0) {
      const started = await PkBattle.findOneAndUpdate(
        { _id: battle._id, status: "COUNTDOWN", countdownEndsAt: { $lte: new Date() } },
        { $set: { status: "ACTIVE", startedAt: new Date() }, $unset: { countdownEndsAt: 1 }, $inc: { stateVersion: 1 } },
        { new: true }
      );
      stopPkCountdown(battleId);
      if (started) {
        assertPkTransition("COUNTDOWN", "ACTIVE");
        await addPkEvent({ battleId: battle._id, eventType: "PK_STARTED" });
        await emitPkState(started.toObject(), pkSocketEvents.started);
        startBattleTimer(battleId);
      }
      return;
    }
    await emitPkState(battle.toObject(), pkSocketEvents.timerTick);
    const timer = setTimeout(() => { void tick(); }, Math.min(1000, remaining));
    timer.unref?.();
    countdownTimers.set(battleId, timer);
  };
  void tick();
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

async function requirePkParticipant(battle: any, userId: string) {
  const participant = await RoomParticipant.exists({
    roomId: { $in: [battle.leftRoomId, battle.rightRoomId] },
    userId,
    leftAt: null
  });
  if (!participant) throw new HttpError(403, "Join a PK room before engaging", ErrorCode.FORBIDDEN);
}

async function assertHost(userId: string, roomId: string) {
  const room = await Room.findById(roomId).lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  const isManager = room.hostId.toString() === userId
    || room.roomAdminIds?.some((id) => id.toString() === userId)
    || await User.exists({ _id: userId, role: "ADMIN" });
  if (!isManager) throw new HttpError(403, "Only the room host or an admin can manage PK", ErrorCode.FORBIDDEN);
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

export async function createRoomPk(input: {
  userId: string;
  roomId: string;
  leftPlayerId: string;
  rightPlayerId: string;
  leftPlayerIds?: string[];
  rightPlayerIds?: string[];
  format?: "PLAYER" | "TEAM";
  mode: "GIFT" | "VOTE";
  durationSeconds: number;
  selectedGiftId?: string;
}) {
  assertPkTransition("DRAFT", "PREPARING");
  objectId(input.roomId, "roomId");
  const leftPlayerIds = input.leftPlayerIds?.length ? input.leftPlayerIds : [input.leftPlayerId];
  const rightPlayerIds = input.rightPlayerIds?.length ? input.rightPlayerIds : [input.rightPlayerId];
  if ([...leftPlayerIds, ...rightPlayerIds].some((id) => !isValidObjectId(id))) throw new HttpError(400, "Invalid player selection", ErrorCode.VALIDATION);
  if (new Set([...leftPlayerIds, ...rightPlayerIds]).size !== leftPlayerIds.length + rightPlayerIds.length) throw new HttpError(400, "A player cannot be on both teams", ErrorCode.VALIDATION);
  const format = input.format ?? "PLAYER";
  if (format === "PLAYER" && (leftPlayerIds.length !== 1 || rightPlayerIds.length !== 1)) throw new HttpError(400, "Player PK requires one player per side", ErrorCode.VALIDATION);
  if (format === "TEAM" && (leftPlayerIds.length < 2 || leftPlayerIds.length > 5 || rightPlayerIds.length !== leftPlayerIds.length)) throw new HttpError(400, "Team PK requires balanced teams of 2–5 players", ErrorCode.VALIDATION);
  if (!allowedPkDurations.includes(input.durationSeconds)) throw new HttpError(400, "Invalid PK duration", ErrorCode.VALIDATION);
  const room = await Room.findById(input.roomId).lean();
  if (!room || room.status !== "LIVE") throw new HttpError(400, "Room must be live to start a PK", ErrorCode.VALIDATION);
  await assertHost(input.userId, input.roomId);
  const manager = await User.findById(input.userId).select("isBlocked mutedUntil suspendedUntil").lean();
  if (!manager || manager.isBlocked || (manager.mutedUntil && manager.mutedUntil > new Date()) || (manager.suspendedUntil && manager.suspendedUntil > new Date())) {
    throw new HttpError(403, "Restricted room managers cannot start PK", ErrorCode.FORBIDDEN);
  }

  const selectedPlayerIds = [...leftPlayerIds, ...rightPlayerIds];
  const players = await RoomParticipant.find({
    roomId: input.roomId,
    userId: { $in: selectedPlayerIds },
    leftAt: null,
    role: { $in: ["HOST", "SPEAKER", "MODERATOR"] },
    seatIndex: { $ne: null },
    micEnabled: true,
    moderatorMuted: false
  }).select("userId").lean();
  if (new Set(players.map((player) => player.userId.toString())).size !== selectedPlayerIds.length) {
    throw new HttpError(400, "Both PK players must be on an active microphone seat", ErrorCode.VALIDATION);
  }

  let gift: any = null;
  if (input.mode === "GIFT") {
    if (!input.selectedGiftId) throw new HttpError(400, "Choose the PK gift", ErrorCode.VALIDATION);
    gift = await Gift.findOne({ _id: objectId(input.selectedGiftId, "giftId"), isActive: true }).select("name pkPoints").lean();
    if (!gift) throw new HttpError(404, "Selected PK gift is unavailable", ErrorCode.NOT_FOUND);
    if (!(gift.pkPoints > 0)) throw new HttpError(400, "Selected gift has no PK point value; update gift PK points first", ErrorCode.VALIDATION);
  }

  const session = await mongoose.startSession();
  let battle: any;
  try {
    await session.withTransaction(async () => {
      const lockProbe = await Room.findOneAndUpdate(
        { _id: input.roomId, status: "LIVE", $or: [{ activePkId: { $exists: false } }, { activePkId: null }] },
        { $set: { activePkId: new mongoose.Types.ObjectId() } },
        { new: true, session }
      );
      if (!lockProbe) throw new HttpError(409, "A PK is already active in this room", ErrorCode.CONFLICT);
      const battleId = lockProbe.activePkId!;
      const [created] = await PkBattle.create([{
        _id: battleId,
        battleCode: battleCode(),
        title: gift ? `${gift.name} ${format === "TEAM" ? "Team" : "Player"} PK` : `${format === "TEAM" ? "Team" : "Player"} Vote PK`,
        mode: input.mode,
        format,
        scope: "SAME_ROOM",
        teamSize: leftPlayerIds.length,
        status: "PREPARING",
        battleType: room.type,
        durationSeconds: input.durationSeconds,
        startedByUserId: input.userId,
        leftRoomId: input.roomId,
        rightRoomId: input.roomId,
        leftHostId: leftPlayerIds[0],
        rightHostId: rightPlayerIds[0],
        selectedGiftId: gift?._id,
        inRoomBattle: true,
        stateVersion: 1
      }], { session });
      battle = created;
      await PkParticipant.create([
        ...leftPlayerIds.map((userId) => ({ battleId, userId, roomId: input.roomId, side: "LEFT", role: "SPEAKER", isReady: false, teamName: "A" })),
        ...rightPlayerIds.map((userId) => ({ battleId, userId, roomId: input.roomId, side: "RIGHT", role: "SPEAKER", isReady: false, teamName: "B" }))
      ], { session, ordered: true });
    });
  } finally {
    await session.endSession();
  }
  const state = await emitPkState(battle.toObject(), pkSocketEvents.state);
  await addPkEvent({ battleId: battle._id, roomId: input.roomId, userId: input.userId, eventType: "PK_CREATED", metadata: { format, mode: input.mode, leftPlayerIds, rightPlayerIds } });
  return { battle: state };
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
  if (input.roomId === input.opponentRoomId) throw new HttpError(400, "Cross-room PK requires two different rooms", ErrorCode.VALIDATION);
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
  const battleId = new mongoose.Types.ObjectId();
  const session = await mongoose.startSession();
  let battle: any;
  let invite: any;
  try {
    await session.withTransaction(async () => {
      for (const roomId of [input.roomId, input.opponentRoomId].sort()) {
        const locked = await Room.findOneAndUpdate(
          { _id: roomId, status: "LIVE", $or: [{ activePkId: { $exists: false } }, { activePkId: null }] },
          { $set: { activePkId: battleId } },
          { new: true, session }
        );
        if (!locked) throw new HttpError(409, "One of the rooms is already in a PK", ErrorCode.CONFLICT);
      }
      [battle] = await PkBattle.create([{
        _id: battleId,
        battleCode: battleCode(),
        title: sanitizeText(input.title ?? ""),
        mode: input.mode,
        format: input.battleType === "VIDEO" ? "LIVESTREAM" : "ROOM",
        scope: "CROSS_ROOM",
        status: "INVITED",
        battleType: input.battleType,
        durationSeconds: input.durationSeconds,
        startedByUserId: input.userId,
        leftRoomId: input.roomId,
        rightRoomId: input.opponentRoomId,
        leftHostId: input.userId,
        rightHostId: input.opponentHostId
      }], { session });
      [invite] = await PkInvite.create([{
        battleId: battle._id,
        inviterUserId: input.userId,
        inviteeUserId: input.opponentHostId,
        inviterRoomId: input.roomId,
        inviteeRoomId: input.opponentRoomId,
        expiresAt: new Date(Date.now() + 60_000)
      }], { session });
      await PkEvent.create([
        { battleId, roomId: input.roomId, userId: input.userId, eventType: "PK_CREATED" },
        { battleId, roomId: input.opponentRoomId, userId: input.userId, eventType: "PK_INVITE_SENT" }
      ], { session, ordered: true });
    });
  } finally {
    await session.endSession();
  }
  await Promise.all([
    createNotification(input.opponentHostId, "SYSTEM", "PK Battle Invite", `${room.title} invited you to a PK Battle`, { battleId: battle.id, inviteId: invite.id, roomId: input.opponentRoomId, inviterRoomId: input.roomId, type: "PK_INVITE" })
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
  if (invite.expiresAt.getTime() < Date.now()) {
    await expireInvite(invite.id);
    throw new HttpError(409, "PK invite expired", ErrorCode.CONFLICT);
  }
  const battle = await PkBattle.findById(invite.battleId);
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  const [leftRoom, rightRoom] = await Promise.all([Room.findById(battle.leftRoomId).lean(), Room.findById(battle.rightRoomId).lean()]);
  if (leftRoom?.status !== "LIVE" || rightRoom?.status !== "LIVE") throw new HttpError(400, "Both rooms must be live", ErrorCode.VALIDATION);
  assertPkTransition(battle.status, "PREPARING");
  const session = await mongoose.startSession();
  let acceptedBattle: any;
  try {
    await session.withTransaction(async () => {
      const acceptedInvite = await PkInvite.findOneAndUpdate(
        { _id: invite._id, status: "PENDING", expiresAt: { $gt: new Date() } },
        { $set: { status: "ACCEPTED", respondedAt: new Date() } },
        { new: true, session }
      );
      if (!acceptedInvite) throw new HttpError(409, "Invitation was already answered or expired", ErrorCode.CONFLICT);
      acceptedBattle = await PkBattle.findOneAndUpdate(
        { _id: battle._id, status: "INVITED" },
        { $set: { status: "PREPARING" }, $inc: { stateVersion: 1 } },
        { new: true, session }
      );
      if (!acceptedBattle) throw new HttpError(409, "PK is no longer available", ErrorCode.CONFLICT);
      await PkParticipant.updateOne({ battleId: battle._id, userId: battle.leftHostId }, { $set: { battleId: battle._id, userId: battle.leftHostId, roomId: battle.leftRoomId, side: "LEFT", role: "HOST", joinedAt: new Date(), isReady: false } }, { upsert: true, session });
      await PkParticipant.updateOne({ battleId: battle._id, userId: battle.rightHostId }, { $set: { battleId: battle._id, userId: battle.rightHostId, roomId: battle.rightRoomId, side: "RIGHT", role: "HOST", joinedAt: new Date(), isReady: false } }, { upsert: true, session });
    });
  } finally {
    await session.endSession();
  }
  invite.status = "ACCEPTED";
  invite.respondedAt = new Date();
  await addPkEvent({ battleId: battle._id, userId, eventType: "PK_INVITE_ACCEPTED" });
  const state = await emitPkState(acceptedBattle.toObject(), pkSocketEvents.state);
  emitUser(battle.leftHostId.toString(), pkSocketEvents.inviteAccepted, state);
  return { battle: state, invite };
}

export async function rejectPkInvite(userId: string, inviteId: string) {
  objectId(inviteId, "inviteId");
  const invite = await PkInvite.findById(inviteId);
  if (!invite) throw new HttpError(404, "PK invite not found", ErrorCode.NOT_FOUND);
  if (invite.inviteeUserId.toString() !== userId) throw new HttpError(403, "Only invitee can reject", ErrorCode.FORBIDDEN);
  if (invite.status !== "PENDING") throw new HttpError(409, "Invite is not pending", ErrorCode.CONFLICT);
  if (invite.expiresAt.getTime() < Date.now()) {
    await expireInvite(invite.id);
    throw new HttpError(409, "PK invite expired", ErrorCode.CONFLICT);
  }
  const session = await mongoose.startSession();
  let battle: any;
  try {
    await session.withTransaction(async () => {
      const changedInvite = await PkInvite.findOneAndUpdate(
        { _id: invite._id, status: "PENDING", expiresAt: { $gt: new Date() } },
        { $set: { status: "REJECTED", respondedAt: new Date() } },
        { new: true, session }
      );
      if (!changedInvite) throw new HttpError(409, "Invitation was already answered or expired", ErrorCode.CONFLICT);
      assertPkTransition("INVITED", "DECLINED");
      battle = await PkBattle.findOneAndUpdate(
        { _id: invite.battleId, status: "INVITED" },
        { $set: { status: "DECLINED", endedAt: new Date() }, $inc: { stateVersion: 1 } },
        { new: true, session }
      );
      if (!battle) throw new HttpError(409, "PK is no longer available", ErrorCode.CONFLICT);
      await Room.updateMany({ _id: { $in: [battle.leftRoomId, battle.rightRoomId] }, activePkId: battle._id }, { $unset: { activePkId: 1 } }, { session });
    });
  } finally {
    await session.endSession();
  }
  await addPkEvent({ battleId: invite.battleId, userId, eventType: "PK_INVITE_REJECTED" });
  if (battle) {
    const state = await pkState(battle);
    emitRoom(battle.leftRoomId.toString(), pkSocketEvents.inviteRejected, { battleId: battle._id.toString(), inviteId });
    for (const roomId of new Set([state.left.roomId, state.right.roomId])) emitRoom(roomId, pkSocketEvents.ended, state);
  }
  return { rejected: true };
}

export async function cancelPk(userId: string, battleId: string) {
  objectId(battleId, "battleId");
  const battle = await PkBattle.findById(battleId);
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  if (!["INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN"].includes(battle.status)) throw new HttpError(409, "An active PK must be ended, not cancelled", ErrorCode.CONFLICT);
  if (battle.inRoomBattle) {
    const room = await Room.findById(battle.leftRoomId).select("hostId roomAdminIds").lean();
    const manager = room?.hostId.toString() === userId || room?.roomAdminIds?.some((id) => id.toString() === userId)
      || Boolean(await User.exists({ _id: userId, role: "ADMIN" }));
    if (!manager) throw new HttpError(403, "Only the room host or admin can cancel PK", ErrorCode.FORBIDDEN);
  } else if (battle.leftHostId.toString() !== userId && battle.startedByUserId.toString() !== userId) {
    throw new HttpError(403, "Cannot cancel this PK", ErrorCode.FORBIDDEN);
  }
  assertPkTransition(battle.status, "CANCELLED");
  const cancelled = await PkBattle.findOneAndUpdate({ _id: battle._id, status: battle.status }, { $set: { status: "CANCELLED", endedAt: new Date() }, $inc: { stateVersion: 1 } }, { new: true });
  if (!cancelled) throw new HttpError(409, "PK changed while cancelling", ErrorCode.CONFLICT);
  await PkInvite.updateMany({ battleId }, { status: "CANCELLED", respondedAt: new Date() });
  await addPkEvent({ battleId: battle._id, userId, eventType: "PK_CANCELLED" });
  await emitPkState(cancelled.toObject(), pkSocketEvents.ended);
  await Room.updateMany({ _id: { $in: [battle.leftRoomId, battle.rightRoomId] }, activePkId: battle._id }, { $unset: { activePkId: 1 } });
  stopBattleTimer(battle.id);
  stopPkCountdown(battle.id);
  return { cancelled: true };
}

export async function endPkBattle(input: { userId?: string; battleId: string; force?: boolean; reason?: string }) {
  objectId(input.battleId, "battleId");
  const battle = await PkBattle.findById(input.battleId);
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  if (!input.force && input.userId) {
    const rooms = await Room.find({ _id: { $in: [battle.leftRoomId, battle.rightRoomId] } }).select("hostId roomAdminIds").lean();
    const canManage = rooms.some((room) => room.hostId.toString() === input.userId || room.roomAdminIds?.some((id) => id.toString() === input.userId))
      || Boolean(await User.exists({ _id: input.userId, role: "ADMIN" }));
    if (!canManage) throw new HttpError(403, "Only a room host or admin can end PK", ErrorCode.FORBIDDEN);
  }
  if (!["INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN", "ACTIVE", "FINAL_CRUNCH", "FINALIZING", "OVERTIME"].includes(battle.status)) return { battle: await pkState(battle) };
  const winnerSide = leader(battle.leftScore, battle.rightScore);
  const preStart = ["INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN"].includes(battle.status);
  let finalizing = battle;
  if (!input.force && !preStart && battle.status !== "FINALIZING") {
    assertPkTransition(battle.status, "FINALIZING");
    const changed = await PkBattle.findOneAndUpdate({ _id: battle._id, status: battle.status }, { $set: { status: "FINALIZING" }, $inc: { stateVersion: 1 } }, { new: true });
    if (!changed) return { battle: await pkState(input.battleId) };
    finalizing = changed;
    await addPkEvent({ battleId: battle._id, eventType: "PK_FINALIZING" });
    await emitPkState(changed.toObject());
  }
  const terminalStatus = input.force ? "ABORTED" : preStart ? "CANCELLED" : "COMPLETED";
  assertPkTransition(finalizing.status, terminalStatus);
  const finalized = await PkBattle.findOneAndUpdate(
    { _id: battle._id, status: finalizing.status },
    { $set: { status: terminalStatus, winnerSide, winnerUserId: winnerSide === "LEFT" ? battle.leftHostId : winnerSide === "RIGHT" ? battle.rightHostId : undefined, endedAt: new Date(), finalizedAt: new Date(), terminationReason: input.reason ?? "" }, $inc: { stateVersion: 1 } },
    { new: true }
  );
  if (!finalized) return { battle: await pkState(input.battleId) };
  stopBattleTimer(battle.id);
  stopPkCountdown(battle.id);
  await addPkEvent({
    battleId: finalized._id,
    eventType: input.force ? "PK_ABORTED" : preStart ? "PK_CANCELLED" : "PK_COMPLETED",
    side: winnerSide,
    metadata: { reason: input.reason }
  });
  const state = await emitPkState(finalized.toObject(), input.force ? pkSocketEvents.forceEnded : pkSocketEvents.ended);
  await Room.updateMany({ _id: { $in: [battle.leftRoomId, battle.rightRoomId] }, activePkId: battle._id }, { $unset: { activePkId: 1 } });
  if (input.force) await closePkBattle({ battleId: battle.id, force: true });
  else schedulePkClose(battle.id);
  return { battle: state };
}

export async function closePkBattle(input: { battleId: string; userId?: string; force?: boolean }) {
  objectId(input.battleId, "battleId");
  const battle = await PkBattle.findById(input.battleId);
  if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  if (!input.force && input.userId) {
    const rooms = await Room.find({ _id: { $in: [battle.leftRoomId, battle.rightRoomId] } }).select("hostId roomAdminIds").lean();
    const canManage = rooms.some((room) => room.hostId.toString() === input.userId || room.roomAdminIds?.some((id) => id.toString() === input.userId))
      || Boolean(await User.exists({ _id: input.userId, role: "ADMIN" }));
    if (!canManage) throw new HttpError(403, "Only a room host or admin can close PK", ErrorCode.FORBIDDEN);
  }
  if (battle.status === "CLOSED") return { battle: await pkState(battle) };
  if (!["COMPLETED", "ABORTED", "CANCELLED", "DECLINED", "EXPIRED", "ENDED", "FORCE_ENDED"].includes(battle.status)) {
    throw new HttpError(409, "Finalize or cancel PK before closing it", ErrorCode.CONFLICT);
  }
  assertPkTransition(battle.status === "ENDED" ? "ENDED" : battle.status, "CLOSED");
  const closed = await PkBattle.findOneAndUpdate(
    { _id: battle._id, status: battle.status },
    { $set: { status: "CLOSED", closedAt: new Date() }, $inc: { stateVersion: 1 } },
    { new: true }
  );
  if (!closed) return { battle: await pkState(input.battleId) };
  stopBattleTimer(battle.id);
  stopPkCountdown(battle.id);
  await Room.updateMany({ _id: { $in: [battle.leftRoomId, battle.rightRoomId] }, activePkId: battle._id }, { $unset: { activePkId: 1 } });
  await addPkEvent({ battleId: battle._id, eventType: "PK_CLOSED" });
  const state = await emitPkState(closed.toObject(), pkSocketEvents.ended);
  return { battle: state };
}

const closeTimers = new Map<string, NodeJS.Timeout>();
function schedulePkClose(battleId: string) {
  if (env.YUGM_RUNTIME === "cloudflare") return;
  const existing = closeTimers.get(battleId);
  if (existing) clearTimeout(existing);
  const timer = setTimeout(() => { void closePkBattle({ battleId, force: true }).catch(() => {}); }, 60_000);
  timer.unref?.();
  closeTimers.set(battleId, timer);
}

export async function votePk(input: { userId: string; battleId: string; side: PkSide }) {
  objectId(input.battleId, "battleId");
  const battle = await PkBattle.findById(input.battleId);
  if (!battle || !["ACTIVE", "FINAL_CRUNCH"].includes(battle.status) || remainingSeconds(battle) <= 0 || battle.mode !== "VOTE") {
    throw new HttpError(409, "This vote PK is no longer accepting votes", ErrorCode.CONFLICT);
  }
  await requirePkParticipant(battle, input.userId);
  const roomId = battle.leftRoomId.toString();
  const session = await mongoose.startSession();
  let updated: any;
  try {
    await session.withTransaction(async () => {
      await PkVote.create([{ battleId: battle._id, voterId: input.userId, side: input.side, roomId }], { session });
      updated = await PkBattle.findOneAndUpdate(
        { _id: battle._id, status: { $in: ["ACTIVE", "FINAL_CRUNCH"] }, mode: "VOTE", startedAt: { $gt: new Date(Date.now() - battle.durationSeconds * 1000) } },
        { $inc: { ...(input.side === "LEFT" ? { leftScore: 1 } : { rightScore: 1 }), stateVersion: 1, eventSequence: 1 } },
        { new: true, session }
      );
      if (!updated) throw new HttpError(409, "PK has already ended", ErrorCode.CONFLICT);
      await PkEvent.create([{ battleId: battle._id, roomId, userId: input.userId, eventType: "VOTE_CAST", side: input.side, points: 1, sequence: updated.eventSequence, stateVersion: updated.stateVersion }], { session });
    });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000 || (error as { code?: string })?.code === "11000") {
      throw new HttpError(409, "You already voted in this PK", ErrorCode.CONFLICT);
    }
    throw error;
  } finally {
    await session.endSession();
  }
  const state = await emitPkState(updated.toObject(), pkSocketEvents.scoreUpdate);
  return { battle: { ...state, myVote: input.side }, voted: true };
}

export async function requestPkRematch(userId: string, battleId: string) {
  objectId(battleId, "battleId");
  const oldBattle = await PkBattle.findById(battleId).lean();
  if (!oldBattle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
  if (!["ENDED", "FORCE_ENDED", "COMPLETED", "CLOSED"].includes(oldBattle.status)) {
    throw new HttpError(400, "Can only rematch ended battles", ErrorCode.VALIDATION);
  }
  const isLeftHost = oldBattle.leftHostId.toString() === userId;
  const isRightHost = oldBattle.rightHostId.toString() === userId;
  if (!isLeftHost && !isRightHost) {
    throw new HttpError(403, "Only battle participants can request rematch", ErrorCode.FORBIDDEN);
  }
  const myRoomId = isLeftHost ? oldBattle.leftRoomId.toString() : oldBattle.rightRoomId.toString();
  const opponentRoomId = isLeftHost ? oldBattle.rightRoomId.toString() : oldBattle.leftRoomId.toString();
  const opponentHostId = isLeftHost ? oldBattle.rightHostId.toString() : oldBattle.leftHostId.toString();
  const room = await Room.findById(myRoomId).lean();
  if (!room || room.status !== "LIVE") throw new HttpError(400, "Your room must be live", ErrorCode.VALIDATION);
  if (room.hostId.toString() !== userId) throw new HttpError(403, "Only room host can request rematch", ErrorCode.FORBIDDEN);
  const result = await createPkInvite({
    userId,
    roomId: myRoomId,
    opponentRoomId,
    opponentHostId,
    battleType: oldBattle.battleType as PkBattleType,
    mode: oldBattle.mode as PkMode,
    durationSeconds: oldBattle.durationSeconds,
    title: `Rematch: ${oldBattle.title || "PK Battle"}`
  });
  emitUser(opponentHostId, pkSocketEvents.rematchRequested, { battleId: result.battle.id, previousBattleId: battleId, userId });
  return result;
}

export async function getActivePk(roomId: string) {
  objectId(roomId, "roomId");
  const battle = await PkBattle.findOne({
    status: { $in: activeStatuses },
    $or: [{ leftRoomId: roomId }, { rightRoomId: roomId }]
  }).lean();
  return battle ? pkState(battle) : null;
}

export async function sendPkGift(input: { userId: string; battleId: string; giftId: string; side: PkSide; idempotencyKey: string; quantity?: number }) {
  objectId(input.battleId, "battleId");
  objectId(input.giftId, "giftId");
  if (input.idempotencyKey) {
    const previous = await GiftTransaction.findOne({ senderId: input.userId, "metadata.idempotencyKey": input.idempotencyKey }).lean();
    if (previous) {
      if (previous.metadata?.pkBattleId?.toString?.() !== input.battleId) {
        throw new HttpError(409, "Gift request key was already used", ErrorCode.CONFLICT);
      }
      return { battle: await pkState(input.battleId), giftTransaction: previous };
    }
  }
  const battle = await PkBattle.findById(input.battleId);
  const gift = await Gift.findOne({ _id: input.giftId, isActive: true }).lean();
  if (!battle || !["ACTIVE", "FINAL_CRUNCH"].includes(battle.status) || remainingSeconds(battle) <= 0) throw new HttpError(404, "Active PK not found", ErrorCode.NOT_FOUND);
  if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
  if (battle.mode === "VOTE") throw new HttpError(400, "This PK accepts votes only", ErrorCode.VALIDATION);
  if (battle.inRoomBattle && battle.selectedGiftId?.toString() !== input.giftId) throw new HttpError(400, "Only the selected PK gift counts toward this battle", ErrorCode.VALIDATION);
  if (!(gift.pkPoints > 0)) throw new HttpError(400, "This gift has no configured PK point value", ErrorCode.VALIDATION);
  await requirePkParticipant(battle, input.userId);
  const receiverId = input.side === "LEFT" ? battle.leftHostId.toString() : battle.rightHostId.toString();
  const senderTeam = await PkParticipant.findOne({ battleId: battle._id, userId: input.userId, leftAt: null }).select("side").lean();
  if (senderTeam?.side === input.side) throw new HttpError(400, "Support the opposing side with PK gifts", ErrorCode.VALIDATION);
  if (receiverId === input.userId) throw new HttpError(400, "Cannot send gifts to yourself", ErrorCode.VALIDATION);
  const quantity = Math.min(99, Math.max(1, Math.floor(input.quantity ?? 1)));
  const totalPrice = gift.coinPrice * quantity;
  const totalPoints = gift.pkPoints * quantity;
  const roomId = input.side === "LEFT" ? battle.leftRoomId.toString() : battle.rightRoomId.toString();
  const comboKey = `${input.battleId}:${input.userId}:${input.side}:gift`;
  const existingCombo = giftCombos.get(comboKey);
  const combo = existingCombo && existingCombo.resetAt > Date.now() ? existingCombo.count + 1 : 1;
  giftCombos.set(comboKey, { count: combo, resetAt: Date.now() + 12_000 });
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(input.userId, totalPrice, "GIFT_SENT", { pkBattleId: battle.id, giftId: gift._id.toString(), side: input.side, quantity, idempotencyKey: input.idempotencyKey }, session);
    const [giftTransaction] = await GiftTransaction.create([{
      roomId,
      senderId: input.userId,
      receiverId,
      giftId: gift._id,
      coinAmount: totalPrice,
      comboCount: quantity,
      totalValue: totalPrice,
      metadata: { pkBattleId: battle.id, side: input.side, quantity, idempotencyKey: input.idempotencyKey }
    }], { session, ordered: true });
    await User.updateOne({ _id: receiverId }, { $inc: { charmExp: totalPrice } }, { session });
    const effectivePoints = totalPoints;
    const oldLeader = leader(battle.leftScore, battle.rightScore);
    const scoreUpdate = input.side === "LEFT" ? { $inc: { leftScore: effectivePoints } } : { $inc: { rightScore: effectivePoints } };
    const updated = await PkBattle.findOneAndUpdate(
      { _id: battle._id, status: { $in: ["ACTIVE", "FINAL_CRUNCH"] }, startedAt: { $gt: new Date(Date.now() - battle.durationSeconds * 1000) } },
      { ...scoreUpdate, $inc: { ...(scoreUpdate as any).$inc, stateVersion: 1, eventSequence: 1 } },
      { new: true, session }
    );
    if (!updated) throw new HttpError(500, "Failed to update PK battle", ErrorCode.INTERNAL);
    const newLeader = leader(updated.leftScore, updated.rightScore);
    await PkLeaderboardEntry.updateOne(
      { battleId: battle._id, userId: input.userId },
      { $setOnInsert: { battleId: battle._id, userId: input.userId, side: input.side }, $inc: { totalPoints: totalPoints, totalGiftsSent: quantity } },
      { upsert: true, session }
    );
    await PkEvent.create([{
      battleId: battle._id, roomId, userId: input.userId, eventType: "GIFT_SENT", side: input.side,
      points: totalPoints, sequence: updated.eventSequence, stateVersion: updated.stateVersion,
      giftTransactionId: giftTransaction._id,
      metadata: { giftId: gift._id.toString(), giftName: gift.name, quantity, unitPkPoints: gift.pkPoints, combo }
    }], { session, ordered: true });
    await session.commitTransaction();
    session.endSession();
    if (newLeader !== oldLeader && newLeader !== "DRAW") {
      await addPkEvent({ battleId: battle._id, eventType: "LEAD_CHANGED", side: newLeader, metadata: { from: oldLeader } });
      emitRoom(updated.leftRoomId.toString(), pkSocketEvents.leadChanged, { battleId: battle.id, leader: newLeader, leftScore: updated.leftScore, rightScore: updated.rightScore });
      if (updated.rightRoomId.toString() !== updated.leftRoomId.toString()) emitRoom(updated.rightRoomId.toString(), pkSocketEvents.leadChanged, { battleId: battle.id, leader: newLeader, leftScore: updated.leftScore, rightScore: updated.rightScore });
    }
    await RoomActivity.create({ roomId, userId: input.userId, type: "GIFT", label: `PK gift: ${gift.name} +${gift.coinPrice}`, metadata: { pkBattleId: battle.id, side: input.side } });
    const state = await emitPkState(updated?.toObject() ?? battle.toObject(), pkSocketEvents.scoreUpdate);
    const payload = {
      battleId: battle.id,
      side: input.side,
      senderId: input.userId,
      giftId: gift._id.toString(),
      giftName: gift.name,
      coinAmount: totalPrice,
      quantity,
      pointsAdded: totalPoints,
      combo,
      leftScore: state.left.score,
      rightScore: state.right.score
    };
    emitRoom(state.left.roomId, pkSocketEvents.giftReceived, payload);
    if (state.right.roomId !== state.left.roomId) emitRoom(state.right.roomId, pkSocketEvents.giftReceived, payload);
    return { battle: state, giftTransaction };
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    if (input.idempotencyKey && (err as { code?: number })?.code === 11000) {
      const previous = await GiftTransaction.findOne({ senderId: input.userId, "metadata.idempotencyKey": input.idempotencyKey }).lean();
      if (previous?.metadata?.pkBattleId?.toString?.() === input.battleId) {
        return { battle: await pkState(input.battleId), giftTransaction: previous };
      }
    }
    throw err;
  }
}

export async function sendPkReaction(input: { userId: string; battleId: string; side: PkSide; type: string }) {
  objectId(input.battleId, "battleId");
  const battle = await PkBattle.findById(input.battleId);
  if (!battle || battle.status !== "ACTIVE") throw new HttpError(404, "Active PK not found", ErrorCode.NOT_FOUND);
  if (battle.inRoomBattle) throw new HttpError(400, "Room PK supports its configured gift or one-time votes", ErrorCode.VALIDATION);
  await requirePkParticipant(battle, input.userId);
  const sideHostId = input.side === "LEFT" ? battle.leftHostId.toString() : battle.rightHostId.toString();
  if (sideHostId === input.userId) throw new HttpError(400, "Cannot react for your own side", ErrorCode.VALIDATION);
  const now = Date.now();
  const bucketKey = `${input.battleId}:${input.userId}`;
  const bucket = reactionBuckets.get(bucketKey);
  const resetAt = bucket && bucket.resetAt > now ? bucket.resetAt : now + 10_000;
  const points = reactionPoints[input.type] ?? 1;
  const used = bucket && bucket.resetAt > now ? bucket.points : 0;
  if (used + points > 10) throw new HttpError(429, "Reaction limit reached", ErrorCode.RATE_LIMITED);
  reactionBuckets.set(bucketKey, { points: used + points, resetAt });
  const oldLeader = leader(battle.leftScore, battle.rightScore);
  const updated = await PkBattle.findByIdAndUpdate(
    battle._id,
    input.side === "LEFT" ? { $inc: { leftScore: points } } : { $inc: { rightScore: points } },
    { new: true }
  );
  if (!updated) throw new HttpError(500, "Failed to update PK battle", ErrorCode.INTERNAL);
  const newLeader = leader(updated.leftScore, updated.rightScore);
  if (newLeader !== oldLeader && newLeader !== "DRAW") {
    await addPkEvent({ battleId: battle._id, eventType: "LEAD_CHANGED", side: newLeader, metadata: { from: oldLeader } });
    emitRoom(updated.leftRoomId.toString(), pkSocketEvents.leadChanged, { battleId: battle.id, leader: newLeader, leftScore: updated.leftScore, rightScore: updated.rightScore });
    emitRoom(updated.rightRoomId.toString(), pkSocketEvents.leadChanged, { battleId: battle.id, leader: newLeader, leftScore: updated.leftScore, rightScore: updated.rightScore });
  }
  await addPkEvent({ battleId: battle._id, userId: input.userId, eventType: "REACTION_SENT", side: input.side, points, metadata: { type: input.type } });
  const state = await emitPkState(updated?.toObject() ?? battle.toObject(), pkSocketEvents.scoreUpdate);
  emitRoom(state.left.roomId, pkSocketEvents.reactionReceived, { battleId: battle.id, side: input.side, type: input.type, pointsAdded: points, bucketRemaining: Math.max(0, 10 - (used + points)) });
  if (state.right.roomId !== state.left.roomId) emitRoom(state.right.roomId, pkSocketEvents.reactionReceived, { battleId: battle.id, side: input.side, type: input.type, pointsAdded: points, bucketRemaining: Math.max(0, 10 - (used + points)) });
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
    .populate("hostId", "name username avatar avatarType avatarParts city activeCosmetics isBlocked mutedUntil suspendedUntil")
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
      hostAvatarType: room.hostId?.avatarType,
      hostAvatarParts: room.hostId?.avatarParts,
      activeCosmetics: room.hostId?.activeCosmetics ?? {}
    }));
}

export async function expireInvite(inviteId: string) {
  const invite = await PkInvite.findById(inviteId);
  if (!invite || invite.status !== "PENDING") return { expired: false };
  const session = await mongoose.startSession();
  let battle: any;
  try {
    await session.withTransaction(async () => {
      const changedInvite = await PkInvite.findOneAndUpdate(
        { _id: invite._id, status: "PENDING", expiresAt: { $lte: new Date() } },
        { $set: { status: "EXPIRED", respondedAt: new Date() } },
        { new: true, session }
      );
      if (!changedInvite) return;
      assertPkTransition("INVITED", "EXPIRED");
      battle = await PkBattle.findOneAndUpdate(
        { _id: invite.battleId, status: "INVITED" },
        { $set: { status: "EXPIRED", endedAt: new Date() }, $inc: { stateVersion: 1 } },
        { new: true, session }
      );
      if (!battle) throw new HttpError(409, "PK is no longer available", ErrorCode.CONFLICT);
      await Room.updateMany({ _id: { $in: [battle.leftRoomId, battle.rightRoomId] }, activePkId: battle._id }, { $unset: { activePkId: 1 } }, { session });
    });
  } finally {
    await session.endSession();
  }
  if (!battle) return { expired: false };
  if (battle) {
    await addPkEvent({ battleId: invite.battleId, userId: invite.inviteeUserId.toString(), eventType: "PK_INVITE_EXPIRED" });
    const state = await pkState(battle);
    for (const roomId of new Set([state.left.roomId, state.right.roomId])) emitRoom(roomId, pkSocketEvents.ended, state);
    emitRoom(battle.leftRoomId.toString(), pkSocketEvents.inviteExpired, { battleId: battle._id.toString(), inviteId });
    emitUser(invite.inviteeUserId.toString(), pkSocketEvents.inviteExpired, { battleId: battle._id.toString(), inviteId });
  }
  return { expired: true };
}

export function scheduleInviteExpiry(inviteId: string) {
  if (env.YUGM_RUNTIME === "cloudflare") return;
  setTimeout(() => expireInvite(inviteId).catch(() => {}), 61_000).unref?.();
}

function stopBattleTimer(battleId: string) {
  const timer = timers.get(battleId);
  if (timer) clearInterval(timer);
  timers.delete(battleId);
}

export function startBattleTimer(battleId: string) {
  stopBattleTimer(battleId);
  if (env.YUGM_RUNTIME === "cloudflare") return;
  const timer = setInterval(async () => {
    await tickBattle(battleId);
  }, 5000);
  timer.unref?.();
  timers.set(battleId, timer);
}

async function tickBattle(battleId: string) {
  const battle = await PkBattle.findById(battleId).lean();
  if (!battle || !["ACTIVE", "FINAL_CRUNCH"].includes(battle.status)) {
    stopBattleTimer(battleId);
    return;
  }
  let currentBattle = battle;
  if (battle.status === "ACTIVE" && remainingSeconds(battle) <= 10) {
    const finalCrunch = await PkBattle.findOneAndUpdate(
      { _id: battle._id, status: "ACTIVE" },
      { $set: { status: "FINAL_CRUNCH" }, $inc: { stateVersion: 1 } },
      { new: true }
    );
    if (finalCrunch) {
      await addPkEvent({ battleId: battle._id, eventType: "PK_FINAL_CRUNCH" });
      await emitPkState(finalCrunch.toObject());
      currentBattle = finalCrunch.toObject();
    }
  }
  const state = await pkState(currentBattle);
  emitRoom(state.left.roomId, pkSocketEvents.timerTick, state);
  if (state.right.roomId !== state.left.roomId) emitRoom(state.right.roomId, pkSocketEvents.timerTick, state);
  if (state.remainingSeconds <= 0) {
    stopBattleTimer(battleId);
    await endPkBattle({ battleId });
  }
}

/** Process persisted PK deadlines in an awaited Worker alarm invocation. */
export async function runPkDeadlines() {
  const now = new Date();
  const [ready, countdowns, active, completed, expiredInvites] = await Promise.all([
    PkBattle.find({ status: "READY", updatedAt: { $lte: new Date(now.getTime() - 2000) } }).select("_id").lean(),
    PkBattle.find({ status: "COUNTDOWN", countdownEndsAt: { $lte: now } }).lean(),
    PkBattle.find({ status: { $in: ["ACTIVE", "FINAL_CRUNCH", "FINALIZING"] } }).select("_id status").lean(),
    PkBattle.find({ status: "COMPLETED", endedAt: { $lte: new Date(now.getTime() - 60_000) } }).select("_id").lean(),
    PkInvite.find({ status: "PENDING", expiresAt: { $lte: now } }).select("_id").lean()
  ]);
  // Recover if the process stopped between the READY and COUNTDOWN updates.
  for (const battle of ready) {
    const countdown = await PkBattle.findOneAndUpdate(
      { _id: battle._id, status: "READY" },
      { $set: { status: "COUNTDOWN", countdownEndsAt: new Date(Date.now() + 3000) }, $inc: { stateVersion: 1 } },
      { new: true }
    );
    if (countdown) {
      await addPkEvent({ battleId: countdown._id, eventType: "PK_COUNTDOWN" });
      await emitPkState(countdown.toObject());
    }
  }
  for (const battle of countdowns) {
    const started = await PkBattle.findOneAndUpdate(
      { _id: battle._id, status: "COUNTDOWN", countdownEndsAt: { $lte: now } },
      { $set: { status: "ACTIVE", startedAt: battle.countdownEndsAt }, $unset: { countdownEndsAt: 1 }, $inc: { stateVersion: 1 } },
      { new: true }
    );
    if (started) {
      await addPkEvent({ battleId: started._id, eventType: "PK_STARTED" });
      await emitPkState(started.toObject(), pkSocketEvents.started);
      await tickBattle(started._id.toString());
    }
  }
  for (const battle of active) {
    if (battle.status === "FINALIZING") await endPkBattle({ battleId: battle._id.toString() });
    else await tickBattle(battle._id.toString());
  }
  for (const battle of completed) await closePkBattle({ battleId: battle._id.toString(), force: true });
  for (const invite of expiredInvites) await expireInvite(invite._id.toString());
}

/** Earliest persisted deadline; active battles need a five-second tick. */
export async function nextPkDeadline(): Promise<number | undefined> {
  const [active, ready, countdown, completed, invite] = await Promise.all([
    PkBattle.exists({ status: { $in: ["ACTIVE", "FINAL_CRUNCH", "FINALIZING"] } }),
    PkBattle.findOne({ status: "READY" }).sort({ updatedAt: 1 }).select("updatedAt").lean(),
    PkBattle.findOne({ status: "COUNTDOWN", countdownEndsAt: { $exists: true } }).sort({ countdownEndsAt: 1 }).select("countdownEndsAt").lean(),
    PkBattle.findOne({ status: "COMPLETED", endedAt: { $exists: true } }).sort({ endedAt: 1 }).select("endedAt").lean(),
    PkInvite.findOne({ status: "PENDING" }).sort({ expiresAt: 1 }).select("expiresAt").lean()
  ]);
  const candidates = [
    active ? Date.now() + 5000 : undefined,
    ready?.updatedAt ? ready.updatedAt.getTime() + 2000 : undefined,
    countdown?.countdownEndsAt?.getTime(),
    completed?.endedAt ? completed.endedAt.getTime() + 60_000 : undefined,
    invite?.expiresAt?.getTime()
  ].filter((value): value is number => value !== undefined && Number.isFinite(value));
  return candidates.length ? Math.min(...candidates) : undefined;
}

export async function resumePkTimers() {
  const battles = await PkBattle.find({ status: { $in: ["COUNTDOWN", "ACTIVE", "FINAL_CRUNCH"] } }).lean();
  await Promise.all(battles.map(async (battle) => {
    if (battle.status === "COUNTDOWN") schedulePkCountdown(battle._id.toString());
    else if (remainingSeconds(battle) <= 0) await endPkBattle({ battleId: battle._id.toString() });
    else startBattleTimer(battle._id.toString());
  }));
  const completed = await PkBattle.find({ status: "COMPLETED" }).select("_id").lean();
  for (const battle of completed) schedulePkClose(battle._id.toString());
  const staleInvites = await PkInvite.find({ status: "PENDING", expiresAt: { $lte: new Date() } }).lean();
  await Promise.all(staleInvites.map((invite) => expireInvite(invite._id.toString())));
}
