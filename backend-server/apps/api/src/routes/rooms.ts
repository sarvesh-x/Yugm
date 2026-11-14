import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { chatMessageSchema, createPollSchema, createRoomSchema, directMessageSchema, inviteSchema, reactionSchema, reportBaseSchema, socketEvents, votePollSchema } from "@yugm/shared";
import { requireAuth, requireNotMuted, type AuthRequest } from "../middleware/auth.js";
import { chatLimiter, reportLimiter } from "../middleware/rateLimit.js";
import { requireNotChatRestricted, requireNotRoomRestricted, requireNotShadowBanned, requireWalletNotFrozen } from "../middleware/requireSafety.js";
import { validateBody } from "../middleware/validate.js";
import { Block } from "../models/Block.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { Friendship } from "../models/Friendship.js";
import { Poll } from "../models/Poll.js";
import { PkBattle } from "../models/PkBattle.js";
import { Room } from "../models/Room.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SpeakerRequest } from "../models/SpeakerRequest.js";
import { User } from "../models/User.js";
import { asyncHandler, sanitizeText, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { emitRoom, emitUser } from "../services/socket.js";
import { createNotification } from "../services/notifications.js";
import { pkState } from "../services/pk.js";
import { getCachedJson, invalidateCache, setCachedJson } from "../services/redis.js";
import { grantXp } from "../services/levels.js";
import { grantRelationshipXp } from "../services/relationships.js";
import { createReportWithEvidence } from "../services/moderation.js";
import { assertUsersCanInteract } from "../services/safety.js";
import { autoModerate } from "../middleware/autoModerate.js";
import { applyAutoModeration } from "../services/autoModeration.js";

const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  maxSpeakers: z.number().int().min(2).max(20).optional(),
  allowAudienceMicRequests: z.boolean().optional(),
  micLocked: z.boolean().optional(),
  coverImage: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
  theme: z.string().optional(),
  vipOnly: z.boolean().optional(),
  badge: z.string().optional(),
  ambience: z.string().optional(),
});

export const roomsRouter = Router();

async function addActivity(roomId: string, type: "JOIN" | "LEAVE" | "GIFT" | "REACTION" | "SPEAKER_REQUEST" | "POLL" | "INVITE" | "MISSION", label: string, userId?: string, metadata: Record<string, unknown> = {}) {
  try {
    const activity = await RoomActivity.create({ roomId, type, label, userId, metadata });
    emitRoom(roomId, socketEvents.roomActivityNew, { activity });
    return activity;
  } catch (error) {
    console.warn("Room activity failed (non-fatal):", error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

async function getRoomOrThrow(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const room = await Room.findById(id).lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  return room;
}

async function assertHost(req: AuthRequest, roomId: string) {
  const room = await getRoomOrThrow(roomId);
  if (room.hostId.toString() !== req.user!.id && req.user!.role !== "ADMIN") {
    throw new HttpError(403, "Host control required", ErrorCode.FORBIDDEN);
  }
  return room;
}

async function assertHostOrRoomAdmin(req: AuthRequest, roomId: string) {
  const room = await getRoomOrThrow(roomId);
  const isHost = room.hostId.toString() === req.user!.id;
  const isPlatformAdmin = req.user!.role === "ADMIN";
  const isRoomAdmin = roomObjectIdListIncludes(room.roomAdminIds, req.user!.id);
  if (!isHost && !isPlatformAdmin && !isRoomAdmin) {
    throw new HttpError(403, "Room host or room admin control required", ErrorCode.FORBIDDEN);
  }
  return { room, isHost: isHost || isPlatformAdmin };
}

function objectIdBody(value: unknown, label: string) {
  if (typeof value !== "string" || !isValidObjectId(value)) {
    throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
  }
  return value;
}

function assertNotHostTarget(room: any, userId: string, action: string) {
  if (room.hostId?.toString?.() === userId) {
    throw new HttpError(400, `Cannot ${action} the room host`, ErrorCode.VALIDATION);
  }
}

async function requireActiveParticipant(roomId: unknown, userId: string) {
  const participant = await RoomParticipant.findOne({ roomId, userId, leftAt: null }).lean();
  if (!participant) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
  return participant;
}

function roomMicLimit(room: { maxSpeakers?: number }): number {
  return Math.min(20, Math.max(2, Number.isFinite(room.maxSpeakers) ? room.maxSpeakers! : 8));
}

async function getOccupiedSeatIndices(room: any, excludeUserId?: string) {
  const occupied = await RoomParticipant.find({
    roomId: room._id,
    leftAt: null,
    ...(excludeUserId ? { userId: { $ne: excludeUserId } } : {}),
    role: { $in: ["HOST", "SPEAKER", "MODERATOR"] }
  }).select("seatIndex joinedAt").sort({ joinedAt: 1, _id: 1 }).lean();
  const used = new Set<number>();
  const micLimit = roomMicLimit(room);
  occupied.forEach((participant: any) => {
    if (Number.isInteger(participant.seatIndex) && participant.seatIndex >= 0 && participant.seatIndex < micLimit) used.add(participant.seatIndex);
  });
  occupied.filter((participant: any) => !Number.isInteger(participant.seatIndex)).forEach(() => {
    for (let seat = 0; seat < micLimit; seat++) {
      if (!used.has(seat)) { used.add(seat); break; }
    }
  });
  return used;
}

async function findOpenSeat(room: any, requestedSeat?: number, excludeUserId?: string) {
  const used = await getOccupiedSeatIndices(room, excludeUserId);
  const locked = new Set<number>((room.lockedSeatIndices ?? []).filter((seat: number) => Number.isInteger(seat)));
  const micLimit = roomMicLimit(room);
  if (requestedSeat !== undefined) {
    if (requestedSeat < 0 || requestedSeat >= micLimit) throw new HttpError(400, "Invalid mic seat", ErrorCode.VALIDATION);
    if (locked.has(requestedSeat)) throw new HttpError(423, "This mic seat is locked", ErrorCode.FORBIDDEN);
    if (used.has(requestedSeat)) throw new HttpError(409, "This mic seat is already occupied", ErrorCode.CONFLICT);
    return requestedSeat;
  }
  for (let seat = 0; seat < micLimit; seat++) {
    if (!used.has(seat) && !locked.has(seat)) return seat;
  }
  throw new HttpError(409, "No open mic seats are available", ErrorCode.CONFLICT);
}

function roomObjectIdListIncludes(values: unknown[] | undefined, userId: string) {
  return Boolean(values?.some((value: any) => value?.toString?.() === userId));
}

function privateRoomRole(room: any, userId: string) {
  if (room.hostId?.toString?.() === userId) return "HOST";
  if (roomObjectIdListIncludes(room.moderatorIds, userId)) return "MODERATOR";
  if (roomObjectIdListIncludes(room.speakerIds, userId)) return "SPEAKER";
  return undefined;
}

function assertPrivateRoomAccess(room: any, userId?: string) {
  if (room.visibility !== "PRIVATE") return;
  if (!userId || !privateRoomRole(room, userId)) {
    throw new HttpError(403, "This private room is invite only", ErrorCode.FORBIDDEN);
  }
}

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function grantRoomXp(userId: string, event: Parameters<typeof grantXp>[1], metadata: Record<string, unknown>) {
  try {
    return await grantXp(userId, event, metadata);
  } catch (error) {
    console.warn("Room XP grant failed (non-fatal):", error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

async function decrementRoomParticipantCount(roomId: unknown) {
  await Room.updateOne(
    { _id: roomId, participantCount: { $gt: 0 } },
    { $inc: { participantCount: -1 } }
  );
}

async function validateRoomCosmetics(hostId: string, fields: { theme?: string; badge?: string; ambience?: string }) {
  const cosmeticIds = [fields.theme, fields.badge, fields.ambience].filter(Boolean) as string[];
  if (cosmeticIds.length === 0) return;
  const user = await User.findById(hostId).select("ownedCosmeticIds").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const missing = cosmeticIds.filter((id) => !user.ownedCosmeticIds.includes(id));
  if (missing.length > 0) {
    throw new HttpError(403, `You don't own these cosmetics: ${missing.join(", ")}`, ErrorCode.FORBIDDEN);
  }
}

roomsRouter.post("/", requireAuth, requireNotMuted, requireNotRoomRestricted, requireNotShadowBanned, validateBody(createRoomSchema), asyncHandler(async (req: AuthRequest, res) => {
  const scheduledFor = req.body.scheduledFor ? new Date(req.body.scheduledFor) : undefined;
  const isScheduled = scheduledFor && scheduledFor.getTime() > Date.now() + 60_000;
  await validateRoomCosmetics(req.user!.id, { theme: req.body.theme, badge: req.body.badge, ambience: req.body.ambience });
  const { title, description, type, category, language, tags, maxSpeakers, visibility, coverImage, allowAudienceMicRequests, theme, vipOnly, badge, ambience } = req.body;
  const room = await Room.create({
    title, description, type, category, language, tags, maxSpeakers, visibility, coverImage, allowAudienceMicRequests, theme, vipOnly, badge, ambience,
    scheduledFor,
    status: isScheduled ? "SCHEDULED" : "LIVE",
    hostId: req.user!.id,
    speakerIds: [req.user!.id],
    participantCount: isScheduled ? 0 : 1,
    livekitRoomName: `yugm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: isScheduled ? undefined : new Date()
  });
  if (!isScheduled) {
    await RoomParticipant.create({ roomId: room.id, userId: req.user!.id, role: "HOST", seatIndex: 0 });
    await addActivity(room.id, "MISSION", `${req.user!.name} started the room`, req.user!.id);
  }
  await invalidateCache("rooms:*");
  await grantRoomXp(req.user!.id, "ROOM_CREATE", { roomId: room.id });
  sendOk(res, { room }, 201);
}));

roomsRouter.get("/", asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { status: "LIVE", visibility: "PUBLIC" };
  if (typeof req.query.type === "string") filter.type = req.query.type;
  if (typeof req.query.category === "string") filter.category = req.query.category;
  const cacheKey = `rooms:list:${JSON.stringify(filter)}`;
  const cached = await getCachedJson(cacheKey);
  if (cached) return sendOk(res, cached);
  const rooms = await Room.find(filter).populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle").sort({ participantCount: -1, createdAt: -1 }).limit(50).lean();
  const payload = { rooms };
  await setCachedJson(cacheKey, payload, 20);
  sendOk(res, payload);
}));

roomsRouter.get("/scheduled", asyncHandler(async (_req, res) => {
  const rooms = await Room.find({ status: "SCHEDULED", visibility: "PUBLIC" })
    .populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ scheduledFor: 1 })
    .limit(30)
    .lean();
  sendOk(res, { rooms });
}));

roomsRouter.get("/recommended", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id).lean();
  const followingRows = await Follow.find({ followerId: req.user!.id }).lean();
  const followingIds = followingRows.map((row) => row.followingId);
  const friendRows = await Friendship.find({
    $or: [{ userId: req.user!.id }, { friendId: req.user!.id }],
    status: "ACCEPTED"
  }).lean();
  const friendIds = friendRows.map((r) =>
    r.userId.toString() === req.user!.id ? r.friendId.toString() : r.userId.toString()
  );
  const interests = user?.interests ?? [];
  const languages = user?.languages ?? [];

  const rooms = await Room.find({
    status: "LIVE",
    visibility: "PUBLIC",
    $or: [
      { hostId: { $in: followingIds } },
      { hostId: { $in: friendIds } },
      { category: { $in: interests } },
      { tags: { $in: interests.map((item) => new RegExp(`^${escapeRegex(item)}$`, "i")) } },
      { language: { $in: languages } }
    ]
  })
    .populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ participantCount: -1, createdAt: -1 })
    .limit(30)
    .lean();

  const seen = new Set<string>();
  const deduped: Array<Record<string, unknown>> = [];
  for (const room of rooms) {
    const id = room._id.toString();
    if (seen.has(id)) continue;
    seen.add(id);
    const hints: string[] = [];
    const hostIdStr = room.hostId?._id?.toString?.() ?? "";
    if (friendIds.some((f: any) => f.toString() === hostIdStr)) hints.push("Your friend is hosting");
    if (followingIds.some((f: any) => f.toString() === hostIdStr)) hints.push("You follow the host");
    if (interests.some((i: string) => i.toLowerCase() === (room.category ?? "").toLowerCase())) hints.push("Matches your interests");
    if (languages.some((l: string) => l.toLowerCase() === (room.language ?? "").toLowerCase())) hints.push("Matches your language");
    deduped.push({ ...room, recommendationHints: hints });
  }

  sendOk(res, { rooms: deduped.slice(0, 20) });
}));

roomsRouter.get("/leaderboard", asyncHandler(async (_req, res) => {
  const topRooms = await Room.find({ status: "LIVE", visibility: "PUBLIC" })
    .populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ participantCount: -1, createdAt: -1 })
    .limit(10)
    .lean();
  const topHosts = await User.find({ role: { $in: ["HOST", "USER"] } })
    .sort({ followersCount: -1, walletBalance: -1 })
    .select("name username avatar city followersCount walletBalance activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .limit(10)
    .lean();
  sendOk(res, { topRooms, topHosts });
}));

roomsRouter.get("/trending", asyncHandler(async (_req, res) => {
  const cached = await getCachedJson("rooms:trending");
  if (cached) return sendOk(res, cached);
  const rooms = await Room.find({ status: "LIVE", visibility: "PUBLIC" }).populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle").sort({ participantCount: -1 }).limit(12).lean();
  const payload = { rooms };
  await setCachedJson("rooms:trending", payload, 20);
  sendOk(res, payload);
}));

roomsRouter.get("/:roomId/pk-history", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.roomId)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const battles = await PkBattle.find({
    status: { $in: ["ENDED", "FORCE_ENDED"] },
    $or: [{ leftRoomId: req.params.roomId }, { rightRoomId: req.params.roomId }]
  }).sort({ createdAt: -1 }).limit(50).lean();
  sendOk(res, { battles: await Promise.all(battles.map((battle) => pkState(battle))) });
}));

roomsRouter.get("/search", asyncHandler(async (req, res) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) throw new HttpError(400, "Query must be at least 2 characters", ErrorCode.VALIDATION);
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const rooms = await Room.find({
    status: "LIVE",
    visibility: "PUBLIC",
    $or: [{ title: regex }, { description: regex }, { tags: regex }, { category: regex }, { language: regex }]
  })
    .populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ participantCount: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { rooms });
}));

roomsRouter.get("/:id", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const rawRoom = await Room.findById(req.params.id).lean();
  if (!rawRoom) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  assertPrivateRoomAccess(rawRoom, req.user!.id);
  const room = await Room.findById(req.params.id).populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle").populate("coHostIds", "name username avatar").lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  const participants = await RoomParticipant.find({ roomId: req.params.id, leftAt: null }).populate("userId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle").lean();
  const speakerRequests = await SpeakerRequest.find({ roomId: req.params.id, status: "PENDING" }).populate("userId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle").lean();
  const orderedSpeakers = participants.filter((participant: any) => ["HOST", "SPEAKER", "MODERATOR"].includes(participant.role))
    .sort((a: any, b: any) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
  const legacySeatById = new Map<string, number>();
  const assignedSeats = new Set<number>();
  orderedSpeakers.forEach((participant: any) => {
    if (Number.isInteger(participant.seatIndex)) assignedSeats.add(participant.seatIndex);
  });
  orderedSpeakers.filter((participant: any) => !Number.isInteger(participant.seatIndex)).forEach((participant: any) => {
    for (let seatIndex = 0; seatIndex < roomMicLimit(room); seatIndex++) {
      if (!assignedSeats.has(seatIndex)) {
        assignedSeats.add(seatIndex);
        legacySeatById.set(participant._id.toString(), seatIndex);
        break;
      }
    }
  });
  const participantPayload = participants.map((participant: any) => ({
    ...participant,
    seatIndex: participant.seatIndex ?? legacySeatById.get(participant._id.toString()),
    isRoomAdmin: roomObjectIdListIncludes(rawRoom.roomAdminIds, participant.userId?._id?.toString?.() ?? participant.userId?.toString?.() ?? "")
  }));
  sendOk(res, { room, participants: participantPayload, speakerRequests });
}));

roomsRouter.post("/:id/join", requireAuth, requireNotRoomRestricted, requireNotShadowBanned, asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
  assertPrivateRoomAccess(room, req.user!.id);
  if (room.status === "SCHEDULED") throw new HttpError(400, "This room is scheduled for later", ErrorCode.VALIDATION);
  if (room.vipOnly) {
    const user = await User.findById(req.user!.id).select("vipExpiresAt").lean();
    const isVip = user?.vipExpiresAt && new Date(user.vipExpiresAt) > new Date();
    if (!isVip) throw new HttpError(403, "This room is for VIP members only", ErrorCode.FORBIDDEN);
  }
  const blocked = await Block.exists({ blockerId: room.hostId, blockedUserId: req.user!.id });
  if (blocked) throw new HttpError(403, "You cannot join this room", ErrorCode.FORBIDDEN);

  const role = privateRoomRole(room, req.user!.id) ?? "AUDIENCE";
  const existingParticipant = await RoomParticipant.findOne({ roomId: room._id, userId: req.user!.id, leftAt: null });
  if (existingParticipant) {
    existingParticipant.role = role;
    existingParticipant.joinedAt = new Date();
    await existingParticipant.save();
  } else {
    await RoomParticipant.create({ roomId: room._id, userId: req.user!.id, role });
    await Room.findByIdAndUpdate(room._id, { $inc: { participantCount: 1 } });
    await invalidateCache("rooms:*");
    await grantRoomXp(req.user!.id, "ROOM_JOIN", { roomId: room._id.toString() });
  }
  // NOTE: emitRoom is called after the socket room join for consistent ordering
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, { userId: req.user!.id, action: "join" });
  await addActivity(room._id.toString(), "JOIN", `${req.user!.name} joined`, req.user!.id);
  sendOk(res, { joined: true, role });
}));

roomsRouter.post("/:id/leave", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const result = await RoomParticipant.findOneAndUpdate({ roomId: req.params.id, userId: req.user!.id, leftAt: null }, { leftAt: new Date() });
  if (result) {
    await decrementRoomParticipantCount(req.params.id);
    await invalidateCache("rooms:*");
  }
  emitRoom(req.params.id, socketEvents.roomParticipantUpdate, { userId: req.user!.id, action: "leave" });
  await addActivity(req.params.id, "LEAVE", `${req.user!.name} left`, req.user!.id);

  // If host leaves and there is no admin user in the room then the room gets closed; if admin is available the room can stay active
  const room = await Room.findById(req.params.id);
  if (room && room.status === "LIVE" && room.hostId.toString() === req.user!.id) {
    const activeAdmin = await RoomParticipant.findOne({
      roomId: req.params.id,
      userId: { $ne: req.user!.id },
      leftAt: null,
      isRoomAdmin: true
    });
    if (!activeAdmin) {
      await Room.findByIdAndUpdate(req.params.id, { $set: { status: "ENDED", endedAt: new Date() } });
      await invalidateCache("rooms:*");
      emitRoom(req.params.id, socketEvents.roomEnded, { roomId: req.params.id });
      await addActivity(req.params.id, "MISSION", "Room closed (host left without admin)");
    } else {
      await addActivity(req.params.id, "MISSION", "Host left. Room kept open by admin");
    }
  }

  sendOk(res, { left: true });
}));

roomsRouter.post("/:id/end", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await assertHost(req, req.params.id);
  await Room.findByIdAndUpdate(req.params.id, { $set: { status: "ENDED", endedAt: new Date() } });
  await invalidateCache("rooms:*");
  emitRoom(req.params.id, socketEvents.roomEnded, { roomId: req.params.id });
  await addActivity(req.params.id, "MISSION", "Room ended");
  sendOk(res, { room });
}));

roomsRouter.patch("/:id", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { room } = await assertHostOrRoomAdmin(req, req.params.id);
  const parsed = patchSchema.parse(req.body);
  await validateRoomCosmetics(req.user!.id, { theme: parsed.theme, badge: parsed.badge, ambience: parsed.ambience });
  await Room.findByIdAndUpdate(req.params.id, { $set: parsed }, { new: true });
  await invalidateCache("rooms:*");
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, { roomId: room.id, action: "settings_updated" });
  sendOk(res, { room });
}));

roomsRouter.post("/:id/mic-lock", requireAuth, validateBody(z.object({ locked: z.boolean() })), asyncHandler(async (req: AuthRequest, res) => {
  const { room } = await assertHostOrRoomAdmin(req, req.params.id);
  await Room.updateOne({ _id: room._id }, { $set: { micLocked: req.body.locked } });
  await invalidateCache("rooms:*");
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, {
    roomId: room.id,
    action: "mic_lock_changed",
    micLocked: req.body.locked
  });
  sendOk(res, { micLocked: req.body.locked });
}));

roomsRouter.post("/:id/seat-lock", requireAuth, validateBody(z.object({ seatIndex: z.number().int().min(0), locked: z.boolean() })), asyncHandler(async (req: AuthRequest, res) => {
  const { room } = await assertHostOrRoomAdmin(req, req.params.id);
  const { seatIndex, locked } = req.body;
  if (seatIndex >= roomMicLimit(room)) throw new HttpError(400, "Invalid mic seat", ErrorCode.VALIDATION);
  if ((await getOccupiedSeatIndices(room)).has(seatIndex)) throw new HttpError(409, "An occupied mic cannot be locked", ErrorCode.CONFLICT);
  await Room.updateOne({ _id: room._id }, locked
    ? { $addToSet: { lockedSeatIndices: seatIndex } }
    : { $pull: { lockedSeatIndices: seatIndex } });
  await invalidateCache("rooms:*");
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, { roomId: room.id, action: "seat_lock_changed", seatIndex, locked });
  sendOk(res, { seatIndex, locked });
}));

roomsRouter.post("/:id/request-speaker", requireAuth, requireNotMuted, asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const room = await getRoomOrThrow(req.params.id);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  if (!room.allowAudienceMicRequests) throw new HttpError(400, "Mic requests are closed", ErrorCode.VALIDATION);
  const participant = await requireActiveParticipant(room._id, req.user!.id);
  if (participant.role !== "AUDIENCE") throw new HttpError(409, "Only audience members can request the mic", ErrorCode.CONFLICT);
  const existing = await SpeakerRequest.findOne({ roomId: room._id, userId: req.user!.id, status: "PENDING" }).lean();
  if (existing) throw new HttpError(409, "Speaker request already pending", ErrorCode.CONFLICT);
  const request = await SpeakerRequest.create({ roomId: room._id, userId: req.user!.id });
  emitRoom(room._id.toString(), socketEvents.roomSpeakerRequest, { request });
  await addActivity(room._id.toString(), "SPEAKER_REQUEST", `${req.user!.name} requested the mic`, req.user!.id);
  sendOk(res, { request }, 201);
}));

roomsRouter.post("/:id/approve-speaker", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { room } = await assertHostOrRoomAdmin(req, req.params.id);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  const userId = objectIdBody(req.body.userId, "user ID");
  assertNotHostTarget(room, userId, "approve");
  const participant = await RoomParticipant.findOne({ roomId: room._id, userId, leftAt: null }).lean();
  if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
  if (participant.role !== "AUDIENCE") throw new HttpError(409, "User is already allowed to speak", ErrorCode.CONFLICT);
  const seatIndex = await findOpenSeat(room);
  const request = await SpeakerRequest.findOneAndUpdate({ roomId: room._id, userId, status: "PENDING" }, { status: "APPROVED" }, { new: true });
  if (!request) throw new HttpError(404, "Pending speaker request not found", ErrorCode.NOT_FOUND);
  await Room.findByIdAndUpdate(room._id, { $addToSet: { speakerIds: userId } });
  await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId, leftAt: null }, { role: "SPEAKER", micEnabled: true, moderatorMuted: false, seatIndex });
  emitRoom(room._id.toString(), socketEvents.roomSpeakerApprove, { userId, seatIndex });
  sendOk(res, { approved: true });
}));

// Listeners can claim a seat; current speakers and the host can move to an open seat.
roomsRouter.post("/:id/take-seat", requireAuth, requireNotMuted, validateBody(z.object({ seatIndex: z.number().int().min(0).optional() })), asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  const userId = req.user!.id;
  const participant = await requireActiveParticipant(room._id, userId);
  if (!["AUDIENCE", "HOST", "SPEAKER", "MODERATOR"].includes(participant.role)) throw new HttpError(409, "You cannot change seats right now", ErrorCode.CONFLICT);
  const wasAudience = participant.role === "AUDIENCE";
  const seatIndex = await findOpenSeat(room, req.body.seatIndex, userId);
  if (wasAudience) {
    await Room.findByIdAndUpdate(room._id, { $addToSet: { speakerIds: userId } });
    await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId, leftAt: null }, { role: "SPEAKER", micEnabled: true, moderatorMuted: false, seatIndex });
    await SpeakerRequest.updateOne({ roomId: room._id, userId, status: "PENDING" }, { status: "APPROVED" });
    emitRoom(room._id.toString(), socketEvents.roomSpeakerApprove, { userId, seatIndex });
  } else {
    await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId, leftAt: null }, { seatIndex });
  }
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, { roomId: room.id, action: wasAudience ? "seat_taken" : "seat_changed", userId, seatIndex });
  sendOk(res, { seated: true, seatIndex, moved: !wasAudience });
}));

roomsRouter.post("/:id/invite-speaker", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { room } = await assertHostOrRoomAdmin(req, req.params.id);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  const userId = objectIdBody(req.body.userId, "user ID");
  assertNotHostTarget(room, userId, "invite");
  const participant = await RoomParticipant.findOne({ roomId: room._id, userId, leftAt: null }).lean();
  if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
  if (participant.role !== "AUDIENCE") throw new HttpError(409, "User already has a speaker seat", ErrorCode.CONFLICT);
  const seatIndex = await findOpenSeat(room);
  await Room.findByIdAndUpdate(room._id, { $addToSet: { speakerIds: userId } });
  await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId, leftAt: null }, { role: "SPEAKER", micEnabled: true, moderatorMuted: false, seatIndex });
  await SpeakerRequest.updateOne({ roomId: room._id, userId, status: "PENDING" }, { status: "APPROVED" });
  emitRoom(room._id.toString(), socketEvents.roomSpeakerApprove, { userId, seatIndex });
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, { roomId: room.id, action: "speaker_invited", userId, seatIndex });
  sendOk(res, { invited: true });
}));

roomsRouter.post("/:id/reject-speaker", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { room } = await assertHostOrRoomAdmin(req, req.params.id);
  const userId = objectIdBody(req.body.userId, "user ID");
  assertNotHostTarget(room, userId, "reject");
  const request = await SpeakerRequest.findOneAndUpdate({ roomId: room._id, userId, status: "PENDING" }, { status: "REJECTED" }, { new: true });
  if (!request) throw new HttpError(404, "Pending speaker request not found", ErrorCode.NOT_FOUND);
  emitRoom(room._id.toString(), socketEvents.roomSpeakerReject, { userId });
  sendOk(res, { rejected: true });
}));

roomsRouter.post("/:id/mute-user", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { room, isHost } = await assertHostOrRoomAdmin(req, req.params.id);
  const userId = objectIdBody(req.body.userId, "user ID");
  assertNotHostTarget(room, userId, "mute");
  if (!isHost && roomObjectIdListIncludes(room.roomAdminIds, userId)) throw new HttpError(403, "Room admins cannot mute each other", ErrorCode.FORBIDDEN);
  const participant = await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId, leftAt: null }, { micEnabled: false, moderatorMuted: true }, { new: true });
  if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
  emitRoom(room._id.toString(), socketEvents.roomUserMute, { userId });
  sendOk(res, { muted: true });
}));

roomsRouter.post("/:id/mic-state", requireAuth, requireNotMuted, validateBody(z.object({ enabled: z.boolean() })), asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
  const participant = await RoomParticipant.findOne({ roomId: room._id, userId: req.user!.id, leftAt: null });
  if (!participant) throw new HttpError(403, "You are not an active room participant", ErrorCode.FORBIDDEN);
  if (!["HOST", "SPEAKER", "MODERATOR"].includes(participant.role)) throw new HttpError(403, "You do not have an active mic seat", ErrorCode.FORBIDDEN);
  if (req.body.enabled && participant.moderatorMuted) throw new HttpError(423, "The host or an admin muted your microphone", ErrorCode.FORBIDDEN);
  participant.micEnabled = req.body.enabled;
  await participant.save();
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, {
    roomId: room.id,
    action: "mic_state_changed",
    userId: req.user!.id,
    micEnabled: participant.micEnabled,
    moderatorMuted: participant.moderatorMuted
  });
  sendOk(res, { micEnabled: participant.micEnabled, moderatorMuted: participant.moderatorMuted });
}));

roomsRouter.post("/:id/remove-speaker", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { room, isHost } = await assertHostOrRoomAdmin(req, req.params.id);
  const userId = objectIdBody(req.body.userId, "user ID");
  assertNotHostTarget(room, userId, "remove from the mic");
  if (!isHost && roomObjectIdListIncludes(room.roomAdminIds, userId)) throw new HttpError(403, "Room admins cannot remove each other from the mic", ErrorCode.FORBIDDEN);
  const participant = await RoomParticipant.findOneAndUpdate(
    { roomId: room._id, userId, leftAt: null, role: { $in: ["SPEAKER", "MODERATOR"] } },
    { role: "AUDIENCE", micEnabled: false, moderatorMuted: false, $unset: { seatIndex: 1 } },
    { new: true }
  );
  if (!participant) throw new HttpError(404, "Active speaker not found", ErrorCode.NOT_FOUND);
  await Room.findByIdAndUpdate(room._id, { $pull: { speakerIds: userId, moderatorIds: userId } });
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, { roomId: room.id, action: "speaker_removed", userId });
  emitRoom(room._id.toString(), socketEvents.roomUserMute, { userId });
  sendOk(res, { removedFromSeat: true });
}));

roomsRouter.post("/:id/remove-user", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { room, isHost } = await assertHostOrRoomAdmin(req, req.params.id);
  const userId = objectIdBody(req.body.userId, "user ID");
  assertNotHostTarget(room, userId, "remove");
  if (!isHost && roomObjectIdListIncludes(room.roomAdminIds, userId)) throw new HttpError(403, "Room admins cannot remove each other", ErrorCode.FORBIDDEN);
  const result = await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId, leftAt: null }, { leftAt: new Date() });
  if (!result) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
  await Room.findByIdAndUpdate(room._id, { $pull: { speakerIds: userId, moderatorIds: userId, roomAdminIds: userId } });
  if (result) {
    await decrementRoomParticipantCount(room._id);
    await invalidateCache("rooms:*");
  }
  emitRoom(room._id.toString(), socketEvents.roomUserRemove, { userId });
  sendOk(res, { removed: true });
}));

roomsRouter.post("/:id/admin", requireAuth, validateBody(z.object({ userId: z.string(), isAdmin: z.boolean().optional() })), asyncHandler(async (req: AuthRequest, res) => {
  const room = await assertHost(req, req.params.id);
  const userId = objectIdBody(req.body.userId, "user ID");
  assertNotHostTarget(room, userId, "promote");
  const participant = await RoomParticipant.findOne({ roomId: room._id, userId, leftAt: null }).lean();
  if (!participant) throw new HttpError(404, "Active participant not found", ErrorCode.NOT_FOUND);
  const isAdmin = req.body.isAdmin !== false;
  await Room.findByIdAndUpdate(room._id, isAdmin
    ? { $addToSet: { roomAdminIds: userId } }
    : { $pull: { roomAdminIds: userId } });
  emitRoom(room._id.toString(), socketEvents.roomParticipantUpdate, { roomId: room.id, action: isAdmin ? "admin_promoted" : "admin_removed", userId });
  sendOk(res, { isRoomAdmin: isAdmin });
}));

roomsRouter.post("/:id/co-host", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  if (room.hostId.toString() !== req.user!._id.toString()) throw new HttpError(403, "Only host can add co-hosts", ErrorCode.FORBIDDEN);

  const { userId } = req.body;
  if (!userId) throw new HttpError(400, "userId required", ErrorCode.VALIDATION);
  if (room.coHostIds.some((id) => id.toString() === userId)) throw new HttpError(409, "User is already a co-host", ErrorCode.CONFLICT);
  if (room.hostId.toString() === userId) throw new HttpError(400, "Cannot add host as co-host", ErrorCode.VALIDATION);

  room.coHostIds.push(new mongoose.Types.ObjectId(userId));
  if (!room.isDuet) room.isDuet = true;
  await room.save();

  await RoomParticipant.updateOne({ roomId: room._id, userId, leftAt: null }, { role: "MODERATOR" });

  for (const pid of room.speakerIds) {
    if (pid.toString() !== userId) emitUser(pid.toString(), socketEvents.roomParticipantUpdate, { roomId: room.id, action: "co_host_added", userId });
  }

  sendOk(res, { room });
}));

roomsRouter.post("/:id/remove-co-host", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await Room.findById(req.params.id);
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  if (room.hostId.toString() !== req.user!._id.toString()) throw new HttpError(403, "Only host can remove co-hosts", ErrorCode.FORBIDDEN);

  const { userId } = req.body;
  room.coHostIds = room.coHostIds.filter((id) => id.toString() !== userId);
  if (room.coHostIds.length === 0) room.isDuet = false;
  await room.save();

  await RoomParticipant.updateOne({ roomId: room._id, userId, leftAt: null }, { role: "SPEAKER" });

  sendOk(res, { room });
}));

roomsRouter.get("/:id/co-hosts", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await Room.findById(req.params.id).populate("coHostIds", "name username avatar").lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  sendOk(res, { coHosts: room.coHostIds, isDuet: room.isDuet });
}));

roomsRouter.post("/:id/report", requireAuth, reportLimiter, validateBody(reportBaseSchema.omit({ roomId: true }).extend({ targetUserId: reportBaseSchema.shape.targetUserId })), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const report = await createReportWithEvidence({ ...req.body, roomId: req.params.id }, req.user!.id);
  sendOk(res, { report }, 201);
}));

roomsRouter.get("/:id/messages", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const limit = Math.min(Number(req.query.limit) || 80, 200);
  const messages = await ChatMessage.find({ roomId: req.params.id }).populate("senderId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle").sort({ createdAt: -1 }).limit(limit).lean();
  sendOk(res, { messages: messages.reverse() });
}));

roomsRouter.get("/:id/activity", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const activity = await RoomActivity.find({ roomId: req.params.id }).sort({ createdAt: -1 }).limit(limit).lean();
  sendOk(res, { activity: activity.reverse() });
}));

roomsRouter.post("/:id/reactions", requireAuth, requireNotChatRestricted, validateBody(reactionSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  await requireActiveParticipant(room._id, req.user!.id);
  const payload = { type: req.body.type, userId: req.user!.id, name: req.user!.name, at: new Date().toISOString() };
  emitRoom(req.params.id, socketEvents.roomReactionSend, payload);
  await addActivity(req.params.id, "REACTION", `${req.user!.name} reacted with ${req.body.type}`, req.user!.id, payload);
  sendOk(res, { reaction: payload }, 201);
}));

roomsRouter.get("/:id/polls", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const polls = await Poll.find({ roomId: req.params.id }).sort({ createdAt: -1 }).limit(10).lean();
  sendOk(res, { polls });
}));

roomsRouter.post("/:id/polls", requireAuth, validateBody(createPollSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await assertHost(req, req.params.id);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  const poll = await Poll.create({
    roomId: room._id,
    createdBy: req.user!.id,
    question: sanitizeText(req.body.question),
    options: req.body.options.map((text: string) => ({ text: sanitizeText(text), votes: 0 }))
  });
  emitRoom(req.params.id, socketEvents.roomPollNew, { poll });
  await addActivity(req.params.id, "POLL", `${req.user!.name} started a poll`, req.user!.id, { pollId: poll.id });
  sendOk(res, { poll }, 201);
}));

roomsRouter.post("/:id/polls/:pollId/vote", requireAuth, validateBody(votePollSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  if (!isValidObjectId(req.params.pollId)) throw new HttpError(400, "Invalid poll ID", ErrorCode.VALIDATION);
  await requireActiveParticipant(req.params.id, req.user!.id);
  const poll = await Poll.findOne({ _id: req.params.pollId, roomId: req.params.id, isActive: true });
  if (!poll) throw new HttpError(404, "Poll not found", ErrorCode.NOT_FOUND);
  if (poll.voters.some((id) => id.toString() === req.user!.id)) throw new HttpError(409, "You already voted", ErrorCode.CONFLICT);
  if (!poll.options[req.body.optionIndex]) throw new HttpError(400, "Invalid option", ErrorCode.VALIDATION);
  poll.options[req.body.optionIndex].votes += 1;
  poll.voters.push(req.user!.id);
  await poll.save();
  emitRoom(req.params.id, socketEvents.roomPollVote, { poll });
  sendOk(res, { poll });
}));

roomsRouter.post("/:id/invites", requireAuth, requireNotMuted, validateBody(inviteSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  if (req.body.userId === req.user!.id) throw new HttpError(400, "Cannot invite yourself", ErrorCode.VALIDATION);
  await requireActiveParticipant(room._id, req.user!.id);
  await assertUsersCanInteract(req.user!.id, req.body.userId, "Cannot invite this user");
  const invite = await RoomInvite.findOneAndUpdate(
    { roomId: room._id, inviterId: req.user!.id, inviteeId: req.body.userId, status: "PENDING" },
    { roomId: room._id, inviterId: req.user!.id, inviteeId: req.body.userId, status: "PENDING" },
    { upsert: true, new: true }
  );
  await createNotification(req.body.userId, "ROOM_INVITE", "Room invite", `${req.user!.name} invited you to ${room.title}`, { roomId: room._id.toString() });
  await addActivity(req.params.id, "INVITE", `${req.user!.name} invited a friend`, req.user!.id, { inviteeId: req.body.userId });
  sendOk(res, { invite }, 201);
}));

roomsRouter.get("/:id/missions", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const [reactions, gifts, participants] = await Promise.all([
    RoomActivity.countDocuments({ roomId: req.params.id, type: "REACTION" }),
    RoomActivity.countDocuments({ roomId: req.params.id, type: "GIFT" }),
    RoomParticipant.countDocuments({ roomId: req.params.id, leftAt: null })
  ]);
  const missions = [
    { id: "react-10", title: "Spark 10 reactions", progress: Math.min(reactions, 10), target: 10, reward: 25, complete: reactions >= 10 },
    { id: "gift-3", title: "Send 3 gifts", progress: Math.min(gifts, 3), target: 3, reward: 50, complete: gifts >= 3 },
    { id: "crowd-25", title: "Bring 25 people together", progress: Math.min(participants, 25), target: 25, reward: 100, complete: participants >= 25 }
  ];
  sendOk(res, { missions });
}));

roomsRouter.post("/:id/messages/direct", requireAuth, requireNotMuted, requireNotChatRestricted, validateBody(directMessageSchema), autoModerate("message"), asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
  await requireActiveParticipant(room._id, req.user!.id);
  const receiverId = room.hostId.toString() === req.user!.id ? String(req.body.receiverId || "") : room.hostId.toString();
  if (!isValidObjectId(receiverId)) throw new HttpError(400, "Invalid receiver", ErrorCode.VALIDATION);
  if (receiverId === req.user!.id) throw new HttpError(400, "Cannot message yourself", ErrorCode.VALIDATION);
  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: receiverId },
      { blockerId: receiverId, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot message this user", ErrorCode.FORBIDDEN);
  await assertUsersCanInteract(req.user!.id, receiverId, "Cannot message this user");
  const receiverInRoom = await RoomParticipant.exists({ roomId: room._id, userId: receiverId, leftAt: null });
  if (!receiverInRoom) throw new HttpError(400, "Receiver is not in the room", ErrorCode.VALIDATION);
  const message = await DirectMessage.create({
    senderId: req.user!.id,
    receiverId,
    roomId: room._id,
    message: sanitizeText(req.body.message)
  });
  emitUser(receiverId, socketEvents.directMessageNew, { message, partnerId: req.user!.id, roomId: room._id.toString() });
  emitUser(req.user!.id, socketEvents.directMessageNew, { message, partnerId: receiverId, roomId: room._id.toString() });
  await createNotification(receiverId, "MESSAGE", "New message", `${req.user!.name}: ${message.message}`, { roomId: room._id.toString(), partnerId: req.user!.id, messageId: message._id.toString() });
  await grantRoomXp(req.user!.id, "CHAT_MESSAGE", { roomId: room._id.toString(), direct: true });
  const relationship = await grantRelationshipXp(req.user!.id, receiverId, "ROOM_DM_SENT", { roomId: room._id.toString(), messageId: message._id.toString() });
  sendOk(res, { message, relationship: relationship?.relationship }, 201);
}));

roomsRouter.post("/:id/messages", requireAuth, requireNotMuted, requireNotChatRestricted, chatLimiter, validateBody(chatMessageSchema), autoModerate("message"), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const participant = await RoomParticipant.findOne({ roomId: req.params.id, userId: req.user!.id, leftAt: null }).lean();
  if (!participant) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
  const message = await ChatMessage.create({
    roomId: req.params.id,
    senderId: req.user!.id,
    message: sanitizeText(req.body.message),
    type: "TEXT"
  });
  const populatedMessage = await message.populate("senderId", "name username avatar");
  // NOTE: emitRoom is called after the socket room join for consistent ordering
  emitRoom(req.params.id, socketEvents.roomChatMessage, { message: populatedMessage });
  await grantRoomXp(req.user!.id, "CHAT_MESSAGE", { roomId: req.params.id });
  sendOk(res, { message: populatedMessage }, 201);
}));
