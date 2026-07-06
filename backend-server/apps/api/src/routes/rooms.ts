import { Router } from "express";
import { z } from "zod";
import { chatMessageSchema, createPollSchema, createRoomSchema, directMessageSchema, inviteSchema, reactionSchema, reportSchema, socketEvents, votePollSchema } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { chatLimiter, reportLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { Block } from "../models/Block.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { Poll } from "../models/Poll.js";
import { Report } from "../models/Report.js";
import { Room } from "../models/Room.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SpeakerRequest } from "../models/SpeakerRequest.js";
import { User } from "../models/User.js";
import { asyncHandler, sanitizeText, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { emitRoom } from "../services/socket.js";
import { createNotification } from "../services/notifications.js";
import { getCachedJson, invalidateCache, setCachedJson } from "../services/redis.js";

const patchSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  tags: z.array(z.string()).optional(),
  category: z.string().optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  maxSpeakers: z.number().int().min(1).max(50).optional(),
  allowAudienceMicRequests: z.boolean().optional(),
  coverImage: z.string().optional(),
  scheduledFor: z.string().datetime().optional(),
});

export const roomsRouter = Router();

async function addActivity(roomId: string, type: "JOIN" | "LEAVE" | "GIFT" | "REACTION" | "SPEAKER_REQUEST" | "POLL" | "INVITE" | "MISSION", label: string, userId?: string, metadata: Record<string, unknown> = {}) {
  const activity = await RoomActivity.create({ roomId, type, label, userId, metadata });
  emitRoom(roomId, socketEvents.roomActivityNew, { activity });
  return activity;
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

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

roomsRouter.post("/", requireAuth, validateBody(createRoomSchema), asyncHandler(async (req: AuthRequest, res) => {
  const scheduledFor = req.body.scheduledFor ? new Date(req.body.scheduledFor) : undefined;
  const isScheduled = scheduledFor && scheduledFor.getTime() > Date.now() + 60_000;
  const room = await Room.create({
    ...req.body,
    scheduledFor,
    status: isScheduled ? "SCHEDULED" : "LIVE",
    hostId: req.user!.id,
    speakerIds: [req.user!.id],
    participantCount: isScheduled ? 0 : 1,
    livekitRoomName: `yugm-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    startedAt: isScheduled ? undefined : new Date()
  });
  if (!isScheduled) {
    await RoomParticipant.create({ roomId: room.id, userId: req.user!.id, role: "HOST" });
    await addActivity(room.id, "MISSION", `${req.user!.name} started the room`, req.user!.id);
  }
  await invalidateCache("rooms:*");
  sendOk(res, { room }, 201);
}));

roomsRouter.get("/", asyncHandler(async (req, res) => {
  const filter: Record<string, unknown> = { status: "LIVE", visibility: "PUBLIC" };
  if (typeof req.query.type === "string") filter.type = req.query.type;
  if (typeof req.query.category === "string") filter.category = req.query.category;
  const cacheKey = `rooms:list:${JSON.stringify(filter)}`;
  const cached = await getCachedJson(cacheKey);
  if (cached) return sendOk(res, cached);
  const rooms = await Room.find(filter).populate("hostId", "name username avatar city vipTier vipExpiresAt").sort({ participantCount: -1, createdAt: -1 }).limit(50).lean();
  const payload = { rooms };
  await setCachedJson(cacheKey, payload, 20);
  sendOk(res, payload);
}));

roomsRouter.get("/scheduled", asyncHandler(async (_req, res) => {
  const rooms = await Room.find({ status: "SCHEDULED", visibility: "PUBLIC" })
    .populate("hostId", "name username avatar city vipTier vipExpiresAt")
    .sort({ scheduledFor: 1 })
    .limit(30)
    .lean();
  sendOk(res, { rooms });
}));

roomsRouter.get("/recommended", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id).lean();
  const followingRows = await Follow.find({ followerId: req.user!.id }).lean();
  const followingIds = followingRows.map((row) => row.followingId);
  const interests = user?.interests ?? [];
  const languages = user?.languages ?? [];
  const rooms = await Room.find({
    status: "LIVE",
    visibility: "PUBLIC",
    $or: [
      { hostId: { $in: followingIds } },
      { category: { $in: interests } },
      { tags: { $in: interests.map((item) => new RegExp(`^${escapeRegex(item)}$`, "i")) } },
      { language: { $in: languages } }
    ]
  })
    .populate("hostId", "name username avatar city vipTier vipExpiresAt")
    .sort({ participantCount: -1, createdAt: -1 })
    .limit(20)
    .lean();
  sendOk(res, { rooms });
}));

roomsRouter.get("/leaderboard", asyncHandler(async (_req, res) => {
  const topRooms = await Room.find({ status: "LIVE", visibility: "PUBLIC" })
    .populate("hostId", "name username avatar city vipTier vipExpiresAt")
    .sort({ participantCount: -1, createdAt: -1 })
    .limit(10)
    .lean();
  const topHosts = await User.find({ role: { $in: ["HOST", "USER"] } })
    .sort({ followersCount: -1, walletBalance: -1 })
    .select("name username avatar city followersCount walletBalance vipTier vipExpiresAt")
    .limit(10)
    .lean();
  sendOk(res, { topRooms, topHosts });
}));

roomsRouter.get("/trending", asyncHandler(async (_req, res) => {
  const cached = await getCachedJson("rooms:trending");
  if (cached) return sendOk(res, cached);
  const rooms = await Room.find({ status: "LIVE", visibility: "PUBLIC" }).populate("hostId", "name username avatar city vipTier vipExpiresAt").sort({ participantCount: -1 }).limit(12).lean();
  const payload = { rooms };
  await setCachedJson("rooms:trending", payload, 20);
  sendOk(res, payload);
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
    .populate("hostId", "name username avatar city vipTier vipExpiresAt")
    .sort({ participantCount: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { rooms });
}));

roomsRouter.get("/:id", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const room = await Room.findById(req.params.id).populate("hostId", "name username avatar city vipTier vipExpiresAt").lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  const participants = await RoomParticipant.find({ roomId: req.params.id, leftAt: null }).populate("userId", "name username avatar vipTier vipExpiresAt").lean();
  const speakerRequests = await SpeakerRequest.find({ roomId: req.params.id, status: "PENDING" }).populate("userId", "name username avatar vipTier vipExpiresAt").lean();
  sendOk(res, { room, participants, speakerRequests });
}));

roomsRouter.post("/:id/join", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
  if (room.status === "SCHEDULED") throw new HttpError(400, "This room is scheduled for later", ErrorCode.VALIDATION);
  const blocked = await Block.exists({ blockerId: room.hostId, blockedUserId: req.user!.id });
  if (blocked) throw new HttpError(403, "You cannot join this room", ErrorCode.FORBIDDEN);

  const role = room.hostId.toString() === req.user!.id ? "HOST" : "AUDIENCE";
  const existingParticipant = await RoomParticipant.findOne({ roomId: room._id, userId: req.user!.id, leftAt: null });
  if (existingParticipant) {
    existingParticipant.role = role;
    existingParticipant.joinedAt = new Date();
    await existingParticipant.save();
  } else {
    await RoomParticipant.create({ roomId: room._id, userId: req.user!.id, role });
    await Room.findByIdAndUpdate(room._id, { $inc: { participantCount: 1 } });
    await invalidateCache("rooms:*");
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
    await Room.findByIdAndUpdate(req.params.id, { $inc: { participantCount: -1 }, $max: { participantCount: 0 } });
    await invalidateCache("rooms:*");
  }
  emitRoom(req.params.id, socketEvents.roomParticipantUpdate, { userId: req.user!.id, action: "leave" });
  await addActivity(req.params.id, "LEAVE", `${req.user!.name} left`, req.user!.id);
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
  const room = await assertHost(req, req.params.id);
  const parsed = patchSchema.parse(req.body);
  await Room.findByIdAndUpdate(req.params.id, { $set: parsed }, { new: true });
  await invalidateCache("rooms:*");
  sendOk(res, { room });
}));

roomsRouter.post("/:id/request-speaker", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const room = await getRoomOrThrow(req.params.id);
  if (!room.allowAudienceMicRequests) throw new HttpError(400, "Mic requests are closed", ErrorCode.VALIDATION);
  const existing = await SpeakerRequest.findOne({ roomId: room._id, userId: req.user!.id, status: "PENDING" }).lean();
  if (existing) throw new HttpError(409, "Speaker request already pending", ErrorCode.CONFLICT);
  const request = await SpeakerRequest.create({ roomId: room._id, userId: req.user!.id });
  emitRoom(room._id.toString(), socketEvents.roomSpeakerRequest, { request });
  await addActivity(room._id.toString(), "SPEAKER_REQUEST", `${req.user!.name} requested the mic`, req.user!.id);
  sendOk(res, { request }, 201);
}));

roomsRouter.post("/:id/approve-speaker", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await assertHost(req, req.params.id);
  const { userId } = req.body;
  await SpeakerRequest.findOneAndUpdate({ roomId: room._id, userId, status: "PENDING" }, { status: "APPROVED" });
  await Room.findByIdAndUpdate(room._id, { $addToSet: { speakerIds: userId } });
  await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId, leftAt: null }, { role: "SPEAKER" });
  emitRoom(room._id.toString(), socketEvents.roomSpeakerApprove, { userId });
  sendOk(res, { approved: true });
}));

roomsRouter.post("/:id/reject-speaker", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await assertHost(req, req.params.id);
  await SpeakerRequest.findOneAndUpdate({ roomId: room._id, userId: req.body.userId, status: "PENDING" }, { status: "REJECTED" });
  emitRoom(room._id.toString(), socketEvents.roomSpeakerReject, { userId: req.body.userId });
  sendOk(res, { rejected: true });
}));

roomsRouter.post("/:id/mute-user", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await assertHost(req, req.params.id);
  await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId: req.body.userId, leftAt: null }, { micEnabled: false });
  emitRoom(room._id.toString(), socketEvents.roomUserMute, { userId: req.body.userId });
  sendOk(res, { muted: true });
}));

roomsRouter.post("/:id/remove-user", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const room = await assertHost(req, req.params.id);
  const result = await RoomParticipant.findOneAndUpdate({ roomId: room._id, userId: req.body.userId, leftAt: null }, { leftAt: new Date() });
  if (result) {
    await Room.findByIdAndUpdate(room._id, { $inc: { participantCount: -1 }, $max: { participantCount: 0 } });
    await invalidateCache("rooms:*");
  }
  emitRoom(room._id.toString(), socketEvents.roomUserRemove, { userId: req.body.userId });
  sendOk(res, { removed: true });
}));

roomsRouter.post("/:id/report", requireAuth, reportLimiter, validateBody(reportSchema.omit({ roomId: true }).extend({ targetUserId: reportSchema.shape.targetUserId })), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const report = await Report.create({ ...req.body, roomId: req.params.id, reporterId: req.user!.id });
  sendOk(res, { report }, 201);
}));

roomsRouter.get("/:id/messages", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const limit = Math.min(Number(req.query.limit) || 80, 200);
  const messages = await ChatMessage.find({ roomId: req.params.id }).populate("senderId", "name username avatar vipTier vipExpiresAt").sort({ createdAt: -1 }).limit(limit).lean();
  sendOk(res, { messages: messages.reverse() });
}));

roomsRouter.get("/:id/activity", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const limit = Math.min(Number(req.query.limit) || 40, 100);
  const activity = await RoomActivity.find({ roomId: req.params.id }).sort({ createdAt: -1 }).limit(limit).lean();
  sendOk(res, { activity: activity.reverse() });
}));

roomsRouter.post("/:id/reactions", requireAuth, validateBody(reactionSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
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
  if (!isValidObjectId(req.params.pollId)) throw new HttpError(400, "Invalid poll ID", ErrorCode.VALIDATION);
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

roomsRouter.post("/:id/invites", requireAuth, validateBody(inviteSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
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

roomsRouter.post("/:id/messages/direct", requireAuth, validateBody(directMessageSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await getRoomOrThrow(req.params.id);
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
  const receiverInRoom = await RoomParticipant.exists({ roomId: room._id, userId: receiverId, leftAt: null });
  if (!receiverInRoom) throw new HttpError(400, "Receiver is not in the room", ErrorCode.VALIDATION);
  const message = await DirectMessage.create({
    senderId: req.user!.id,
    receiverId,
    roomId: room._id,
    message: sanitizeText(req.body.message)
  });
  await createNotification(receiverId, "MESSAGE", "New message", `${req.user!.name}: ${message.message}`, { roomId: room._id.toString() });
  sendOk(res, { message }, 201);
}));

roomsRouter.post("/:id/messages", requireAuth, chatLimiter, validateBody(chatMessageSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const participant = await RoomParticipant.findOne({ roomId: req.params.id, userId: req.user!.id, leftAt: null }).lean();
  if (!participant) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
  const message = await ChatMessage.create({
    roomId: req.params.id,
    senderId: req.user!.id,
    message: sanitizeText(req.body.message),
    type: "TEXT"
  });
  // NOTE: emitRoom is called after the socket room join for consistent ordering
  emitRoom(req.params.id, socketEvents.roomChatMessage, { message });
  sendOk(res, { message }, 201);
}));
