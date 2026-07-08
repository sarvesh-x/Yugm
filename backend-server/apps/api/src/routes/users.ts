import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { profileSchema } from "@yugm/shared";
import { requireAuth, requireNotMuted, type AuthRequest } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { Block } from "../models/Block.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SupportMessage, SupportTicket } from "../models/SupportTicket.js";
import { User } from "../models/User.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId, sanitizeText } from "../utils/http.js";
import { createNotification } from "../services/notifications.js";
import { getVipStatus } from "../services/vip.js";
import { dailyCheckInStart, getLevelStatus, grantXp } from "../services/levels.js";
import { findRelationship, grantRelationshipXp } from "../services/relationships.js";

export const usersRouter = Router();
usersRouter.use(requireAuth);

const privateCallSchema = z.object({ type: z.enum(["VOICE", "VIDEO"]) });
const profileMediaSchema = z.object({
  url: z.string().url(),
  type: z.enum(["IMAGE", "VIDEO"]).default("IMAGE"),
  caption: z.string().max(140).optional()
});
const feedbackSchema = z.object({
  category: z.enum(["LOGIN", "PAYMENT", "WITHDRAWAL", "ROOM", "CHAT", "MATCHING", "SAFETY", "REPORT", "BUG", "OTHER"]).default("OTHER"),
  subject: z.string().min(3).max(120),
  message: z.string().min(5).max(1200)
});

function publicUser(user: any) {
  const levelStatus = getLevelStatus(user);
  return {
    id: user.id,
    _id: user._id?.toString?.() ?? user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
    walletBalance: user.walletBalance,
    xp: levelStatus.xp,
    level: levelStatus.level,
    levelTitle: levelStatus.title,
    levelStatus,
    activeCosmetics: user.activeCosmetics,
    ownedCosmeticIds: user.ownedCosmeticIds,
    ...getVipStatus(user),
    interests: user.interests,
    hobbies: user.hobbies,
    languages: user.languages,
    profileMedia: user.profileMedia,
    closeFriendsCount: user.closeFriendIds?.length ?? 0,
    clanId: user.clanId?.toString?.() ?? user.clanId,
    city: user.city,
    state: user.state,
    bio: user.bio,
    vibeLine: user.vibeLine,
    gender: user.gender,
    age: user.age,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    interestedIn: user.interestedIn,
    lookingFor: user.lookingFor,
    datingAgeMin: user.datingAgeMin,
    datingAgeMax: user.datingAgeMax,
    isFollowing: user.isFollowing,
    isCloseFriend: user.isCloseFriend
  };
}

function hasCompletedProfile(user: any) {
  return Boolean(user?.name && user?.username && user?.bio && user?.city && (user?.interests?.length ?? 0) > 0);
}

usersRouter.get("/me", (req: AuthRequest, res) => sendOk(res, { user: publicUser(req.user) }));

usersRouter.patch("/me", validateBody(profileSchema.partial()), asyncHandler(async (req: AuthRequest, res) => {
  let user: any = await User.findByIdAndUpdate(req.user!.id, req.body, { new: true }).select("-__v");
  if (user && !user.profileCompletedAt && hasCompletedProfile(user)) {
    user.profileCompletedAt = new Date();
    await user.save();
    await grantXp(user.id, "PROFILE_COMPLETE");
    user = await User.findById(req.user!.id).select("-__v");
  }
  sendOk(res, { user: publicUser(user) });
}));

usersRouter.get("/me/close-friends", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id)
    .populate("closeFriendIds", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .select("closeFriendIds")
    .lean();
  const users = (user?.closeFriendIds ?? []).filter(Boolean);
  sendOk(res, { users });
}));

usersRouter.post("/me/profile-media", validateBody(profileMediaSchema), asyncHandler(async (req: AuthRequest, res) => {
  const media = {
    url: req.body.url,
    type: req.body.type,
    caption: req.body.caption ? sanitizeText(req.body.caption) : undefined,
    createdAt: new Date()
  };
  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $push: { profileMedia: { $each: [media], $position: 0, $slice: 24 } } },
    { new: true }
  ).select("-__v");
  sendOk(res, { user: publicUser(user), media: user?.profileMedia?.[0] }, 201);
}));

usersRouter.delete("/me/profile-media/:mediaId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.mediaId)) throw new HttpError(400, "Invalid media ID", ErrorCode.VALIDATION);
  const user = await User.findByIdAndUpdate(
    req.user!.id,
    { $pull: { profileMedia: { _id: req.params.mediaId } } },
    { new: true }
  ).select("-__v");
  sendOk(res, { user: publicUser(user) });
}));

usersRouter.post("/me/feedback", validateBody(feedbackSchema), asyncHandler(async (req: AuthRequest, res) => {
  const ticket = await SupportTicket.create({
    userId: req.user!.id,
    category: req.body.category,
    subject: sanitizeText(req.body.subject),
    lastMessageAt: new Date()
  });
  const message = await SupportMessage.create({
    ticketId: ticket._id,
    senderType: "USER",
    senderUserId: req.user!.id,
    message: sanitizeText(req.body.message)
  });
  sendOk(res, { ticket, message }, 201);
}));

usersRouter.get("/me/level", (req: AuthRequest, res) => {
  sendOk(res, { level: getLevelStatus(req.user) });
});

usersRouter.post("/me/check-in", asyncHandler(async (req: AuthRequest, res) => {
  const checkedIn = await User.findOneAndUpdate(
    {
      _id: req.user!.id,
      $or: [
        { lastDailyCheckInAt: { $exists: false } },
        { lastDailyCheckInAt: { $lt: dailyCheckInStart() } }
      ]
    },
    { $set: { lastDailyCheckInAt: new Date() } },
    { new: true }
  ).select("xp level levelTitle lastDailyCheckInAt walletBalance").lean();

  if (!checkedIn) {
    const user = await User.findById(req.user!.id).select("xp level levelTitle lastDailyCheckInAt walletBalance").lean();
    return sendOk(res, { alreadyClaimed: true, level: getLevelStatus(user), balance: user?.walletBalance ?? 0 });
  }

  const reward = await grantXp(req.user!.id, "DAILY_CHECKIN");
  sendOk(res, { alreadyClaimed: false, ...(reward ?? {}) });
}));

usersRouter.get("/search", asyncHandler(async (req: AuthRequest, res) => {
  const q = String(req.query.q || "").trim();
  if (!q || q.length < 2) throw new HttpError(400, "Query must be at least 2 characters", ErrorCode.VALIDATION);
  const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const blockedRows = await Block.find({
    $or: [
      { blockerId: req.user!.id },
      { blockedUserId: req.user!.id }
    ]
  }).lean();
  const hiddenIds = blockedRows.map((row) =>
    row.blockerId.toString() === req.user!.id ? row.blockedUserId : row.blockerId
  );
  const users = await User.find({
    _id: { $nin: hiddenIds },
    $or: [{ name: regex }, { username: regex }, { interests: regex }, { city: regex }],
    isBlocked: { $ne: true }
  })
    .select("name username avatar city followersCount interests role activeCosmetics vipTier vipStartedAt vipExpiresAt xp level levelTitle lastDailyCheckInAt")
    .sort({ vipExpiresAt: -1, level: -1, followersCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  const followingRows = await Follow.find({ followerId: req.user!.id, followingId: { $in: users.map((user) => user._id) } }).lean();
  const followingIds = new Set(followingRows.map((row) => row.followingId.toString()));
  sendOk(res, { users: users.map((user) => ({ ...user, ...getVipStatus(user), xp: getLevelStatus(user).xp, level: getLevelStatus(user).level, levelTitle: getLevelStatus(user).title, levelStatus: getLevelStatus(user), isFollowing: followingIds.has(user._id.toString()) })) });
}));

usersRouter.get("/hosts/suggested", asyncHandler(async (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const followingRows = await Follow.find({ followerId: req.user!.id }).lean();
  const followingIds = followingRows.map((row) => row.followingId);
  const users = await User.find({
    _id: { $nin: [req.user!.id, ...followingIds] },
    isBlocked: { $ne: true },
    role: { $in: ["HOST", "MODERATOR", "ADMIN"] }
  })
    .select("name username avatar city followersCount interests role activeCosmetics vipTier vipStartedAt vipExpiresAt xp level levelTitle lastDailyCheckInAt")
    .sort({ vipExpiresAt: -1, level: -1, followersCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { users: users.map((user) => ({ ...user, ...getVipStatus(user), xp: getLevelStatus(user).xp, level: getLevelStatus(user).level, levelTitle: getLevelStatus(user).title, levelStatus: getLevelStatus(user), isFollowing: false })) });
}));

usersRouter.get("/messages", asyncHandler(async (req: AuthRequest, res) => {
  const messages = await DirectMessage.find({
    $or: [{ senderId: req.user!.id }, { receiverId: req.user!.id }]
  })
    .populate("senderId receiverId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  sendOk(res, { messages });
}));

usersRouter.get("/messages/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: req.params.userId },
      { blockerId: req.params.userId, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot view this conversation", ErrorCode.FORBIDDEN);
  const messages = await DirectMessage.find({
    $or: [
      { senderId: req.user!.id, receiverId: req.params.userId },
      { senderId: req.params.userId, receiverId: req.user!.id }
    ]
  })
    .populate("senderId receiverId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  const relationship = await findRelationship(req.user!.id, req.params.userId);
  sendOk(res, { messages: messages.reverse(), relationship });
}));

usersRouter.post("/messages/:userId", requireAuth, requireNotMuted, chatLimiter, asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const receiverId = req.params.userId;
  if (receiverId === req.user!.id) throw new HttpError(400, "Cannot message yourself", ErrorCode.VALIDATION);

  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: receiverId },
      { blockerId: receiverId, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot message this user", ErrorCode.FORBIDDEN);

  const messageText = String(req.body.message || "").trim();
  if (!messageText) throw new HttpError(400, "Message cannot be empty", ErrorCode.VALIDATION);

  const message = await DirectMessage.create({
    senderId: req.user!.id,
    receiverId,
    message: sanitizeText(messageText)
  });

  // Mark other messages from them as read
  await DirectMessage.updateMany(
    { senderId: receiverId, receiverId: req.user!.id, read: false },
    { $set: { read: true } }
  );

  await createNotification(receiverId, "MESSAGE", "New message", `${req.user!.name}: ${message.message}`, { partnerId: req.user!.id });
  await grantXp(req.user!.id, "CHAT_MESSAGE");
  const relationship = await grantRelationshipXp(req.user!.id, receiverId, "MESSAGE_SENT", { messageId: message._id.toString() });
  sendOk(res, { message, relationship: relationship?.relationship }, 201);
}));

usersRouter.post("/messages/:userId/call", requireAuth, requireNotMuted, validateBody(privateCallSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const receiverId = req.params.userId;
  if (receiverId === req.user!.id) throw new HttpError(400, "Cannot call yourself", ErrorCode.VALIDATION);

  const receiver = await User.findById(receiverId).select("name username avatar").lean();
  if (!receiver) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: receiverId },
      { blockerId: receiverId, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot call this user", ErrorCode.FORBIDDEN);

  const type = req.body.type as "VOICE" | "VIDEO";
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const room = await Room.create([{
      title: `${req.user!.name} and ${receiver.name}`,
      description: `Private ${type.toLowerCase()} call`,
      type,
      hostId: req.user!.id,
      category: "Private",
      tags: ["private-call", "direct"],
      language: req.user!.languages?.[0] ?? "English",
      status: "LIVE",
      visibility: "PRIVATE",
      maxSpeakers: 2,
      participantCount: 2,
      speakerIds: [req.user!.id, receiverId],
      livekitRoomName: `yugm-private-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      allowAudienceMicRequests: false,
      startedAt: new Date()
    }], { session });

    await RoomParticipant.create([
      { roomId: room[0]._id, userId: req.user!.id, role: "HOST", micEnabled: true, cameraEnabled: type === "VIDEO" },
      { roomId: room[0]._id, userId: receiverId, role: "SPEAKER", micEnabled: true, cameraEnabled: type === "VIDEO" }
    ], { session });

    const message = await DirectMessage.create([{
      senderId: req.user!.id,
      receiverId,
      roomId: room[0]._id,
      message: `Private ${type.toLowerCase()} call started`
    }], { session });

    await session.commitTransaction();
    session.endSession();

    await createNotification(
      receiverId,
      "MESSAGE",
      type === "VOICE" ? "Private voice call" : "Private video call",
      `${req.user!.name} started a private ${type.toLowerCase()} call`,
      { roomId: room[0]._id.toString(), partnerId: req.user!.id, callType: type }
    );

    sendOk(res, { room: room[0], message: message[0] }, 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}));

usersRouter.get("/me/blocked", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const blockedRows = await Block.find({ blockerId: req.user!.id })
    .populate("blockedUserId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();
  const users = blockedRows.map((row) => row.blockedUserId).filter(Boolean);
  sendOk(res, { users });
}));

usersRouter.get("/leaderboard/levels", asyncHandler(async (_req: AuthRequest, res) => {
  const users = await User.find({ isBlocked: { $ne: true } })
    .select("name username avatar city followersCount activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ level: -1, xp: -1, followersCount: -1 })
    .limit(50)
    .lean();
  sendOk(res, { users: users.map(publicUser) });
}));

usersRouter.get("/:id", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: req.params.id },
      { blockerId: req.params.id, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const user = await User.findById(req.params.id).select("-email -phone -__v").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const following = req.params.id === req.user!.id
    ? false
    : Boolean(await Follow.exists({ followerId: req.user!.id, followingId: req.params.id }));
  const closeFriendIds = ((req.user as any)?.closeFriendIds ?? []).map((friendId: any) => friendId.toString());
  const isCloseFriend = closeFriendIds.includes(req.params.id);
  sendOk(res, { user: publicUser({ ...user, ...getVipStatus(user), isFollowing: following, isCloseFriend }) });
}));

usersRouter.post("/:id/follow", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  if (req.params.id === req.user!.id) throw new HttpError(400, "You cannot follow yourself", ErrorCode.VALIDATION);
  const target = await User.findById(req.params.id).select("_id").lean();
  if (!target) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: req.params.id },
      { blockerId: req.params.id, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot follow this user", ErrorCode.FORBIDDEN);
  const session = await mongoose.startSession();
  let createdFollow = false;
  session.startTransaction();
  try {
    const existing = await Follow.findOne({ followerId: req.user!.id, followingId: req.params.id }).session(session);
    if (!existing) {
      await Follow.create([{ followerId: req.user!.id, followingId: req.params.id }], { session });
      await User.findByIdAndUpdate(req.user!.id, { $inc: { followingCount: 1 } }, { session });
      await User.findByIdAndUpdate(req.params.id, { $inc: { followersCount: 1 } }, { session });
      await createNotification(req.params.id, "FOLLOW", "New Follower", `${req.user!.name} started following you`);
      createdFollow = true;
    }
    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
  if (createdFollow) await grantXp(req.user!.id, "FOLLOW_USER");
  sendOk(res, { following: true });
}));

usersRouter.post("/:id/close-friend", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  if (req.params.id === req.user!.id) throw new HttpError(400, "You cannot add yourself as a close friend", ErrorCode.VALIDATION);
  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: req.params.id },
      { blockerId: req.params.id, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot add this user", ErrorCode.FORBIDDEN);
  const target = await User.findById(req.params.id).select("_id name").lean();
  if (!target) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  await User.findByIdAndUpdate(req.user!.id, { $addToSet: { closeFriendIds: req.params.id } });
  sendOk(res, { closeFriend: true });
}));

usersRouter.delete("/:id/close-friend", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  await User.findByIdAndUpdate(req.user!.id, { $pull: { closeFriendIds: req.params.id } });
  sendOk(res, { closeFriend: false });
}));

usersRouter.delete("/:id/follow", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const deleted = await Follow.findOneAndDelete({ followerId: req.user!.id, followingId: req.params.id }).session(session);
    if (deleted) {
      await User.updateOne({ _id: req.user!.id, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }, { session });
      await User.updateOne({ _id: req.params.id, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }, { session });
    }
    await session.commitTransaction();
    session.endSession();
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
  sendOk(res, { following: false });
}));

usersRouter.post("/:id/block", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  await Block.updateOne({ blockerId: req.user!.id, blockedUserId: req.params.id }, {}, { upsert: true });
  await User.findByIdAndUpdate(req.user!.id, { $pull: { closeFriendIds: req.params.id } });
  sendOk(res, { blocked: true });
}));

usersRouter.delete("/:id/block", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  await Block.deleteOne({ blockerId: req.user!.id, blockedUserId: req.params.id });
  sendOk(res, { blocked: false });
}));

usersRouter.get("/:id/rooms", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const rooms = await Room.find({ hostId: req.params.id, status: "LIVE" })
    .populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { rooms });
}));

usersRouter.get("/:id/followers", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const followers = await Follow.find({ followingId: req.params.id })
    .populate("followerId", "name username avatar city followersCount activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const users = followers.map(f => f.followerId);
  sendOk(res, { followers: users, users });
}));

usersRouter.get("/:id/following", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const following = await Follow.find({ followerId: req.params.id })
    .populate("followingId", "name username avatar city followersCount activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const users = following.map(f => f.followingId);
  sendOk(res, { following: users, users });
}));
