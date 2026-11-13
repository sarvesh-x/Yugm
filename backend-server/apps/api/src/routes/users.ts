import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { levelMilestones, profileSchema, reactionSchema, socketEvents, streakCosmeticRewards, xpEvents } from "@yugm/shared";
import { optionalAuth, requireAuth, requireNotMuted, type AuthRequest } from "../middleware/auth.js";
import { activeCosmeticKey, ensureDefaultCosmetics, listCosmeticsByIds } from "../services/cosmetics.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import { requireNotChatRestricted } from "../middleware/requireSafety.js";
import { validateBody } from "../middleware/validate.js";
import { Block } from "../models/Block.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { FriendMatchRequest } from "../models/FriendMatchRequest.js";
import { PkBattle } from "../models/PkBattle.js";
import { pkState } from "../services/pk.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { User, type IUser } from "../models/User.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId, sanitizeText } from "../utils/http.js";
import { TrustVerification } from "../models/TrustVerification.js";
import { createNotification } from "../services/notifications.js";
import { emitUser, isUserOnline } from "../services/socket.js";
import { autoModerate } from "../middleware/autoModerate.js";
import { getVipStatus } from "../services/vip.js";
import { dailyCheckInStart, getLevelStatus, grantXp } from "../services/levels.js";
import { creditWallet } from "../services/wallet.js";
import { findRelationship, grantRelationshipXp } from "../services/relationships.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { revokeAllForUser } from "../services/tokens.js";

export const usersRouter = Router();

async function handlePublicProfile(identifier: string, isUsername: boolean, req: AuthRequest, res: any) {
  let user: any;
  if (isUsername) {
    const cleanUsername = identifier.trim().toLowerCase().replace(/^@/, "");
    user = await User.findOne({ username: cleanUsername, isBlocked: { $ne: true } }).select("-email -phone -__v").lean();
  } else {
    if (!isValidObjectId(identifier)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
    user = await User.findOne({ _id: identifier, isBlocked: { $ne: true } }).select("-email -phone -__v").lean();
  }
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  let isFollowing = false;
  let isCloseFriend = false;
  if (req.user) {
    const callerId = req.user.id;
    const targetId = user._id.toString();
    const blocked = await Block.exists({
      $or: [
        { blockerId: callerId, blockedUserId: targetId },
        { blockerId: targetId, blockedUserId: callerId }
      ]
    });
    if (blocked) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

    if (callerId !== targetId) {
      isFollowing = Boolean(await Follow.exists({ followerId: callerId, followingId: targetId }));
      const closeFriendIds = (req.user.closeFriendIds ?? []).map((id: any) => id.toString());
      isCloseFriend = closeFriendIds.includes(targetId);
    }
  }

  let verificationLevel: string = "NONE";
  if (user.isVerified) {
    const trustStatus = await TrustVerification.findOne({ userId: user._id }).lean().catch(() => null);
    verificationLevel = trustStatus?.level === "ADVANCED" ? "ADVANCED" : "BASIC";
  }

  const isSelf = req.user ? req.user.id === user._id.toString() : false;
  sendOk(res, {
    user: publicUser({
      ...user,
      isFollowing,
      isCloseFriend,
      isOnline: isUserOnline(user._id.toString()),
      verificationLevel,
      ...(!isSelf ? { walletBalance: undefined } : {})
    })
  });
}

// Public endpoints accessible without authentication (optionalAuth attached)
usersRouter.get("/public/:id", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  await handlePublicProfile(req.params.id, false, req, res);
}));

usersRouter.get("/by-username/:username", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  await handlePublicProfile(req.params.username, true, req, res);
}));

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

const FRIEND_MATCH_WAIT_MS = 90_000;
const FRIEND_MATCHED_TTL_MS = 5 * 60_000;

async function friendMatchState(userId: string) {
  const request = await FriendMatchRequest.findOne({ userId, expiresAt: { $gt: new Date() } }).lean();
  if (!request) return { status: "IDLE" as const };
  if (request.status !== "MATCHED" || !request.roomId || !request.matchedUserId) {
    return { status: "WAITING" as const };
  }
  const room = await Room.findOne({ _id: request.roomId, status: "LIVE" }).lean();
  if (!room) {
    await FriendMatchRequest.updateMany({ roomId: request.roomId, status: "MATCHED" }, { $set: { status: "CANCELLED", expiresAt: new Date() } });
    return { status: "IDLE" as const };
  }
  return { status: "MATCHED" as const, room };
}

async function createRandomFriendCall(user: IUser, matchedUserId: mongoose.Types.ObjectId) {
  const matchedUser = await User.findById(matchedUserId).select("name languages isBlocked").lean();
  if (!matchedUser || matchedUser.isBlocked) throw new HttpError(409, "That match is no longer available", ErrorCode.CONFLICT);

  const session = await mongoose.startSession();
  let createdRoom: any;
  try {
    await session.withTransaction(async () => {
      const rooms = await Room.create([{
        title: `${user.name} and ${matchedUser.name}`,
        description: "Private voice call",
        type: "VOICE",
        hostId: user._id,
        category: "Private",
        tags: ["private-call", "random-match"],
        language: user.languages?.[0] ?? "English",
        status: "LIVE",
        visibility: "PRIVATE",
        maxSpeakers: 2,
        participantCount: 2,
        speakerIds: [user._id, matchedUserId],
        livekitRoomName: `yugm-friend-match-${new mongoose.Types.ObjectId().toString()}`,
        allowAudienceMicRequests: false,
        startedAt: new Date()
      }], { session });
      createdRoom = rooms[0];

      await RoomParticipant.create([
        { roomId: createdRoom._id, userId: user._id, role: "HOST", micEnabled: true, cameraEnabled: false },
        { roomId: createdRoom._id, userId: matchedUserId, role: "SPEAKER", micEnabled: true, cameraEnabled: false }
      ], { session });

      const expiresAt = new Date(Date.now() + FRIEND_MATCHED_TTL_MS);
      const first = await FriendMatchRequest.updateOne(
        { userId: user._id, status: "PAIRING" },
        { $set: { status: "MATCHED", matchedUserId, roomId: createdRoom._id, expiresAt } },
        { session }
      );
      const second = await FriendMatchRequest.updateOne(
        { userId: matchedUserId, status: "PAIRING" },
        { $set: { status: "MATCHED", matchedUserId: user._id, roomId: createdRoom._id, expiresAt } },
        { session }
      );
      if (first.modifiedCount !== 1 || second.modifiedCount !== 1) {
        throw new HttpError(409, "The match was cancelled", ErrorCode.CONFLICT);
      }
    });
  } finally {
    await session.endSession();
  }
  return createdRoom;
}

usersRouter.post("/friend-match/search", chatLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!._id;
  const now = new Date();
  let request = await FriendMatchRequest.findOne({ userId });
  if (request?.status === "MATCHED" && request.roomId && request.expiresAt > now) {
    const existingMatch = await friendMatchState(req.user!.id);
    if (existingMatch.status === "MATCHED") return sendOk(res, existingMatch);
  }
  if (request?.status === "PAIRING" && request.expiresAt > now) return sendOk(res, { status: "WAITING" });

  if (!request) {
    request = await FriendMatchRequest.findOneAndUpdate(
      { userId },
      { $set: { status: "WAITING", expiresAt: new Date(now.getTime() + FRIEND_MATCH_WAIT_MS) }, $unset: { matchedUserId: 1, roomId: 1 } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );
  } else {
    request.status = "WAITING";
    request.matchedUserId = undefined;
    request.roomId = undefined;
    request.expiresAt = new Date(now.getTime() + FRIEND_MATCH_WAIT_MS);
    await request.save();
  }
  if (!request) throw new HttpError(500, "Could not start friend matching", ErrorCode.INTERNAL);

  const reservedRequest = await FriendMatchRequest.findOneAndUpdate(
    { _id: request._id, status: "WAITING", expiresAt: { $gt: now } },
    { $set: { status: "PAIRING" } },
    { new: true }
  );
  if (!reservedRequest) return sendOk(res, await friendMatchState(req.user!.id));

  const blockedRows = await Block.find({ $or: [{ blockerId: userId }, { blockedUserId: userId }] }).select("blockerId blockedUserId").lean();
  const excludedIds = new Set([userId.toString()]);
  for (const row of blockedRows) {
    excludedIds.add(row.blockerId.toString());
    excludedIds.add(row.blockedUserId.toString());
  }

  let matchedRoom: any = null;
  const candidates = await FriendMatchRequest.find({
    userId: { $nin: [...excludedIds] },
    status: "WAITING",
    expiresAt: { $gt: now }
  }).sort({ createdAt: 1 }).limit(10);
  for (const candidate of candidates) {
    if (!isUserOnline(candidate.userId.toString())) {
      await FriendMatchRequest.updateOne({ _id: candidate._id, status: "WAITING" }, { $set: { status: "CANCELLED", expiresAt: now } });
      continue;
    }
    const claimed = await FriendMatchRequest.findOneAndUpdate(
      { _id: candidate._id, status: "WAITING", expiresAt: { $gt: now } },
      { $set: { status: "PAIRING" } },
      { new: true }
    );
    if (!claimed) continue;
    try {
      matchedRoom = await createRandomFriendCall(req.user!, candidate.userId);
      break;
    } catch (error) {
      await FriendMatchRequest.updateMany(
        { _id: { $in: [reservedRequest._id, claimed._id] }, status: "PAIRING" },
        { $set: { status: "WAITING" } }
      );
      throw error;
    }
  }

  if (matchedRoom) return sendOk(res, { status: "MATCHED", room: matchedRoom }, 200);
  await FriendMatchRequest.updateOne({ _id: reservedRequest._id, status: "PAIRING" }, { $set: { status: "WAITING" } });
  sendOk(res, { status: "WAITING" });
}));

usersRouter.get("/friend-match", chatLimiter, asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await friendMatchState(req.user!.id));
}));

usersRouter.post("/friend-match/cancel", chatLimiter, asyncHandler(async (req: AuthRequest, res) => {
  await FriendMatchRequest.updateOne(
    { userId: req.user!._id, status: "WAITING" },
    { $set: { status: "CANCELLED", expiresAt: new Date() } }
  );
  sendOk(res, { cancelled: true });
}));

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
    isOnline: user.isOnline ?? isUserOnline(user._id?.toString?.() ?? user.id),
    city: user.city,
    state: user.state,
    bio: user.bio,
    profileCompleted: Boolean(user.profileCompletedAt || (user.bio && user.city && user.interests?.length)),
    streakCount: user.streakCount ?? 0,
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
    isCloseFriend: user.isCloseFriend, isVerified: Boolean(user.isVerified), verificationLevel: user.verificationLevel ?? (user.isVerified ? "BASIC" : "NONE"), showcasedBadgeIds: user.showcasedBadgeIds ?? []
  };
}

function hasCompletedProfile(user: any) {
  return Boolean(user?.name && user?.username && user?.bio && user?.city && (user?.interests?.length ?? 0) > 0);
}

usersRouter.get("/me", (req: AuthRequest, res) => sendOk(res, { user: publicUser(req.user) }));

usersRouter.delete("/me", asyncHandler(async (req: AuthRequest, res) => {
  const requestedAt = new Date();
  await User.updateOne({ _id: req.user!._id }, { $set: { deletionRequestedAt: requestedAt }, $inc: { tokenVersion: 1 } });
  await Promise.all([
    revokeAllForUser(req.user!.id),
    DeviceToken.deleteMany({ userId: req.user!._id })
  ]);
  sendOk(res, { deletionScheduledAt: new Date(requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000) });
}));

usersRouter.patch("/me", validateBody(profileSchema.partial().refine((data) => data.age === undefined || (data.age >= 18 && data.age <= 100), { message: "You must be between 18 and 100 years old", path: ["age"] })), asyncHandler(async (req: AuthRequest, res) => {
  const allowedFields = ["name", "username", "gender", "age", "city", "state", "bio", "vibeLine", "interests", "hobbies", "languages", "avatar", "interestedIn", "lookingFor", "datingAgeMin", "datingAgeMax"];
  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in req.body) update[key] = req.body[key];
  }
  if (req.body.acceptTerms === true && !req.user!.termsAcceptedAt) update.termsAcceptedAt = new Date();
  if (typeof update.username === "string") {
    update.username = update.username.trim().toLowerCase();
    const existing = await User.exists({ username: update.username, _id: { $ne: req.user!._id } });
    if (existing) throw new HttpError(409, "That username is already taken. Choose another one.", ErrorCode.CONFLICT);
  }
  let user: any;
  try {
    user = await User.findByIdAndUpdate(req.user!.id, { $set: update }, { new: true }).select("-__v");
  } catch (error: any) {
    // Keep the database unique index as the final guard against simultaneous claims.
    if (error?.code === 11000 && (error?.keyPattern?.username || error?.keyValue?.username)) {
      throw new HttpError(409, "That username is already taken. Choose another one.", ErrorCode.CONFLICT);
    }
    throw error;
  }
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
  const messageText = sanitizeText(req.body.message);
  const ticket = await SupportTicket.create({
    userId: req.user!.id,
    category: req.body.category,
    subject: sanitizeText(req.body.subject),
    message: messageText,
    lastMessageAt: new Date(),
    messages: [{
      senderId: req.user!.id,
      senderRole: "USER",
      message: messageText,
      createdAt: new Date()
    }]
  });
  sendOk(res, { ticket }, 201);
}));

usersRouter.get("/me/level", (req: AuthRequest, res) => {
  sendOk(res, { level: getLevelStatus(req.user) });
});

usersRouter.get("/me/level-overview", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id)
    .select("name username avatar xp level levelTitle lastDailyCheckInAt streakCount walletBalance activeCosmetics")
    .lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const levelStatus = getLevelStatus(user);
  const streak = user.streakCount ?? 0;
  const streakBonuses: Record<number, number> = { 3: 10, 7: 25, 14: 50, 30: 100, 60: 200, 90: 500 };
  const milestones = Object.keys(streakBonuses).map(Number).sort((a, b) => a - b);
  const nextMilestone = milestones.find((m) => m > streak) ?? null;

  const topUsers = await User.find({ isBlocked: { $ne: true } })
    .sort({ level: -1, xp: -1 })
    .limit(10)
    .select("name username avatar level levelTitle xp activeCosmetics")
    .lean();

  sendOk(res, {
    level: levelStatus,
    streak: {
      count: streak,
      canCheckIn: levelStatus.canDailyCheckIn,
      nextMilestone,
      nextMilestoneReward: nextMilestone ? streakBonuses[nextMilestone] : 0,
      streakBonuses
    },
    milestones: levelMilestones,
    xpEvents: {
      DAILY_CHECKIN: { name: "Daily Check-In", xp: xpEvents.DAILY_CHECKIN, icon: "ðŸ“…" },
      PROFILE_COMPLETE: { name: "Complete Profile", xp: xpEvents.PROFILE_COMPLETE, icon: "â­" },
      ROOM_CREATE: { name: "Host Live Room", xp: xpEvents.ROOM_CREATE, icon: "ðŸŽ™ï¸" },
      ROOM_JOIN: { name: "Join Room", xp: xpEvents.ROOM_JOIN, icon: "ðŸŽ§" },
      CHAT_MESSAGE: { name: "Send Chat Message", xp: xpEvents.CHAT_MESSAGE, icon: "ðŸ’¬" },
      GIFT_SENT: { name: "Send Gift", xp: xpEvents.GIFT_SENT, icon: "ðŸŽ" },
      VIP_PURCHASE: { name: "VIP Subscription", xp: xpEvents.VIP_PURCHASE, icon: "ðŸ‘‘" },
      COSMETIC_PURCHASE: { name: "Cosmetic Purchase", xp: xpEvents.COSMETIC_PURCHASE, icon: "ðŸŽ¨" }
    },
    leaderboard: topUsers.map((u, i) => ({
      rank: i + 1,
      id: u._id.toString(),
      name: u.name,
      username: u.username,
      avatar: u.avatar,
      level: u.level ?? 1,
      levelTitle: u.levelTitle ?? "New Vibe",
      xp: u.xp ?? 0,
      activeCosmetics: u.activeCosmetics ?? {}
    }))
  });
}));

usersRouter.get("/me/inventory", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id)
    .select("ownedCosmeticIds activeCosmetics claimedAchievementTiers walletBalance")
    .lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const ownedIds = new Set(user.ownedCosmeticIds ?? []);
  const activeCosmetics = user.activeCosmetics ?? {};
  await ensureDefaultCosmetics();
  const cosmetics = (await listCosmeticsByIds([...ownedIds])).map((item) => {
    const key = activeCosmeticKey(item.type);
    const isEquipped = key ? (activeCosmetics as any)[key] === item.id : false;
    return {
      ...item,
      isEquipped
    };
  });

  const { GiftInventory } = await import("../models/GiftInventory.js");
  const giftItems = await GiftInventory.find({ userId: req.user!.id, quantity: { $gt: 0 } })
    .populate("giftId")
    .sort({ updatedAt: -1 })
    .lean();
  const gifts = giftItems.map((item: any) => ({
    id: item._id.toString(),
    giftId: item.giftId?._id?.toString() ?? item.giftId,
    name: item.giftId?.name ?? "Gift",
    icon: item.giftId?.icon ?? "ðŸŽ",
    coinPrice: item.giftId?.coinPrice ?? 0,
    quantity: item.quantity,
    source: item.source,
    tradable: item.tradable,
    upgradeLevel: item.upgradeLevel ?? 1,
    upgradeable: Boolean(item.giftId?.upgradeable)
  }));

  const claimedTiers = user.claimedAchievementTiers ?? [];
  const { Achievement } = await import("../models/Achievement.js");
  const achievementIds = [...new Set(claimedTiers.map((t: any) => t.achievementId))];
  const achievements = achievementIds.length > 0
    ? await Achievement.find({ id: { $in: achievementIds } }).lean()
    : [];
  const badges = claimedTiers.map((ct: any) => {
    const ach = achievements.find((a: any) => a.id === ct.achievementId);
    return {
      achievementId: ct.achievementId,
      tier: ct.tier,
      claimedAt: ct.claimedAt,
      title: ach?.title ?? ct.achievementId,
      description: ach?.description ?? "",
      icon: ach?.icon ?? "ðŸ…"
    };
  });

  sendOk(res, {
    cosmetics,
    activeCosmetics,
    gifts,
    badges,
    summary: {
      totalCosmetics: cosmetics.length,
      equippedCosmetics: cosmetics.filter((c) => c.isEquipped).length,
      totalGifts: gifts.reduce((acc: number, g: any) => acc + g.quantity, 0),
      totalBadges: badges.length,
      walletBalance: user.walletBalance ?? 0
    }
  });
}));


usersRouter.post("/me/check-in", asyncHandler(async (req: AuthRequest, res) => {
  const now = new Date();
  const user = await User.findById(req.user!.id).select("xp level levelTitle lastDailyCheckInAt walletBalance streakCount ownedCosmeticIds").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const alreadyClaimed = user.lastDailyCheckInAt && user.lastDailyCheckInAt >= dailyCheckInStart();
  if (alreadyClaimed) {
    return sendOk(res, { alreadyClaimed: true, level: getLevelStatus(user), balance: user.walletBalance, streak: user.streakCount ?? 0 });
  }

  const yesterday = new Date(now.getTime() - 86400000);
  const isConsecutive = user.lastDailyCheckInAt && user.lastDailyCheckInAt >= dailyCheckInStart(yesterday);
  const newStreak = (isConsecutive ? (user.streakCount ?? 0) : 0) + 1;

  const update: Record<string, unknown> = { lastDailyCheckInAt: now, streakCount: newStreak };
  const rewardCosmetic = streakCosmeticRewards[newStreak];
  let unlockedCosmetic: string | undefined;
  if (rewardCosmetic && !user.ownedCosmeticIds.includes(rewardCosmetic)) {
    update.$push = { ownedCosmeticIds: rewardCosmetic };
    unlockedCosmetic = rewardCosmetic;
  }

  await User.findByIdAndUpdate(req.user!.id, update);

  const streakBonuses: Record<number, number> = { 3: 10, 7: 25, 14: 50, 30: 100, 60: 200, 90: 500 };
  const milestones = Object.keys(streakBonuses).map(Number).sort((a, b) => a - b);
  let streakBonus = 0;
  if (streakBonuses[newStreak]) {
    streakBonus = streakBonuses[newStreak];
    await creditWallet(req.user!.id, streakBonus, "STREAK_BONUS", { streak: newStreak, milestone: newStreak });
  }

  const nextMilestone = milestones.find((m) => m > newStreak) ?? null;

  const xpReward = await grantXp(req.user!.id, "DAILY_CHECKIN");
  sendOk(res, {
    alreadyClaimed: false,
    streak: newStreak,
    unlockedCosmetic,
    streakBonus,
    nextMilestone,
    ...(xpReward ?? {})
  });
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

// Recommended users to chat with: people you follow + suggested, online users sorted first
usersRouter.get("/users/recommended-chat", asyncHandler(async (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 60);
  const followingRows = await Follow.find({ followerId: req.user!.id }).lean();
  const followingIds = followingRows.map((row) => row.followingId);

  const followingUsers = await User.find({
    _id: { $in: followingIds, $ne: req.user!.id },
    isBlocked: { $ne: true }
  })
    .select("name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .limit(limit)
    .lean();

  let suggestedUsers: any[] = [];
  if (followingUsers.length < limit) {
    const existingIds = new Set([req.user!.id.toString(), ...followingUsers.map((u: any) => u._id.toString())]);
    suggestedUsers = await User.find({
      _id: { $nin: Array.from(existingIds) },
      isBlocked: { $ne: true }
    })
      .select("name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .sort({ level: -1 })
      .limit(limit - followingUsers.length)
      .lean();
  }

  const allUsers = [...followingUsers, ...suggestedUsers];
  const withOnline = allUsers.map((user: any) => ({
    ...user,
    ...getVipStatus(user),
    isOnline: isUserOnline(user._id.toString()),
    isFollowing: followingIds.some((id: any) => id.toString() === user._id.toString())
  }));
  withOnline.sort((a: any, b: any) => (b.isOnline ? 1 : 0) - (a.isOnline ? 1 : 0));
  sendOk(res, { users: withOnline });
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

usersRouter.post("/messages/read-all", asyncHandler(async (req: AuthRequest, res) => {
  const result = await DirectMessage.updateMany(
    { receiverId: req.user!.id, read: false },
    { $set: { read: true } }
  );
  sendOk(res, { updated: result.modifiedCount });
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
  await DirectMessage.updateMany(
    { senderId: req.params.userId, receiverId: req.user!.id, read: false },
    { $set: { read: true } }
  );
  sendOk(res, { messages: messages.reverse(), relationship });
}));

usersRouter.post("/messages/:userId", requireAuth, requireNotMuted, requireNotChatRestricted, chatLimiter, autoModerate("message"), asyncHandler(async (req: AuthRequest, res) => {
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
  const mediaUrl = String(req.body.mediaUrl || "").trim();
  const mediaType = String(req.body.mediaType || "").toUpperCase();
  const duration = Number(req.body.duration) || 0;
  if (!messageText && !mediaUrl) throw new HttpError(400, "Message cannot be empty", ErrorCode.VALIDATION);
  if (mediaUrl && !["IMAGE", "VIDEO", "AUDIO"].includes(mediaType)) throw new HttpError(400, "Invalid message media type", ErrorCode.VALIDATION);

  const created = await DirectMessage.create({
    senderId: req.user!.id,
    receiverId,
    message: messageText ? sanitizeText(messageText) : mediaType === "VIDEO" ? "Shared a video" : mediaType === "AUDIO" ? "ðŸŽ¤ Voice note" : "Shared a photo",
    mediaUrl,
    mediaType,
    duration: mediaType === "AUDIO" ? duration : 0
  });
  const message = await DirectMessage.findById(created._id)
    .populate("senderId receiverId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();

  // Mark other messages from them as read
  await DirectMessage.updateMany(
    { senderId: receiverId, receiverId: req.user!.id, read: false },
    { $set: { read: true } }
  );

  emitUser(receiverId, socketEvents.directMessageNew, { message, partnerId: req.user!.id });
  emitUser(req.user!.id, socketEvents.directMessageNew, { message, partnerId: receiverId });
  await createNotification(receiverId, "MESSAGE", "New message", `${req.user!.name}: ${message?.message ?? ""}`, { partnerId: req.user!.id, messageId: created._id.toString() });
  await grantXp(req.user!.id, "CHAT_MESSAGE");
  const relationship = await grantRelationshipXp(req.user!.id, receiverId, "MESSAGE_SENT", { messageId: created._id.toString() });
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
    emitUser(receiverId, socketEvents.directMessageNew, { message: message[0], partnerId: req.user!.id });
    emitUser(req.user!.id, socketEvents.directMessageNew, { message: message[0], partnerId: receiverId });

    sendOk(res, { room: room[0], message: message[0] }, 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}));

usersRouter.post("/messages/:userId/:messageId/reactions", chatLimiter, validateBody(reactionSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId) || !isValidObjectId(req.params.messageId)) throw new HttpError(400, "Invalid message", ErrorCode.VALIDATION);
  const belongsToConversation = {
    _id: req.params.messageId,
    $or: [
      { senderId: req.user!.id, receiverId: req.params.userId },
      { senderId: req.params.userId, receiverId: req.user!.id }
    ]
  };
  const message = await DirectMessage.findOne(belongsToConversation).select("_id senderId receiverId").lean();
  if (!message) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);

  await DirectMessage.updateOne({ _id: req.params.messageId }, { $pull: { reactions: { userId: req.user!.id } } });
  const updated = await DirectMessage.findByIdAndUpdate(
    req.params.messageId,
    { $push: { reactions: { userId: req.user!.id, type: req.body.type, createdAt: new Date() } } },
    { new: true }
  )
    .populate("senderId receiverId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();

  const partnerId = message.senderId.toString() === req.user!.id ? message.receiverId.toString() : message.senderId.toString();
  emitUser(partnerId, "direct:reaction:new", { message: updated, partnerId: req.user!.id });
  await createNotification(partnerId, "MESSAGE", "New reaction", `${req.user!.name} reacted to your message`, { partnerId: req.user!.id, messageId: req.params.messageId });
  sendOk(res, { message: updated });
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

usersRouter.get("/:userId/pk-stats", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const userObjectId = new mongoose.Types.ObjectId(req.params.userId);
  const battles = await PkBattle.find({
    status: { $in: ["ENDED", "FORCE_ENDED"] },
    $or: [{ leftHostId: userObjectId }, { rightHostId: userObjectId }]
  }).lean();
  const wins = battles.filter((battle: any) => battle.winnerUserId?.toString?.() === req.params.userId).length;
  const draws = battles.filter((battle: any) => battle.winnerSide === "DRAW").length;
  const losses = battles.length - wins - draws;
  const ordered = [...battles].sort((a: any, b: any) => new Date(a.endedAt ?? a.createdAt).getTime() - new Date(b.endedAt ?? b.createdAt).getTime());
  let currentStreak = 0;
  let bestStreak = 0;
  for (const battle of ordered) {
    if (battle.winnerUserId?.toString?.() === req.params.userId) {
      currentStreak += 1;
      bestStreak = Math.max(bestStreak, currentStreak);
    } else if (battle.winnerSide !== "DRAW") {
      currentStreak = 0;
    }
  }
  const totalScore = battles.reduce((sum: number, battle: any) => {
    const ownScore = battle.leftHostId?.toString?.() === req.params.userId ? battle.leftScore : battle.rightScore;
    return sum + (ownScore ?? 0);
  }, 0);
  const bestBattle = battles.reduce((best: number, battle: any) => {
    const ownScore = battle.leftHostId?.toString?.() === req.params.userId ? battle.leftScore : battle.rightScore;
    return Math.max(best, ownScore ?? 0);
  }, 0);
  sendOk(res, { stats: { played: battles.length, wins, losses, draws, totalScore, bestBattle, bestStreak, winRate: battles.length ? Math.round((wins / battles.length) * 100) : 0 } });
}));

usersRouter.get("/:userId/pk-history", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const battles = await PkBattle.find({
    status: { $in: ["ENDED", "FORCE_ENDED"] },
    $or: [{ leftHostId: req.params.userId }, { rightHostId: req.params.userId }]
  }).sort({ createdAt: -1 }).limit(50).lean();
  sendOk(res, { battles: await Promise.all(battles.map((battle) => pkState(battle))) });
}));

usersRouter.get("/:id", asyncHandler(async (req: AuthRequest, res) => {
  await handlePublicProfile(req.params.id, false, req, res);
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
      await createNotification(req.params.id, "FOLLOW", "New Follower", `${req.user!.name} started following you`, { userId: req.user!.id });
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
  await createNotification(req.params.id, "SYSTEM", "Close friend", `${req.user!.name} added you as a close friend`, { userId: req.user!.id });
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

usersRouter.delete("/me/followers/:id", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  if (req.params.id === req.user!.id) throw new HttpError(400, "Invalid follower", ErrorCode.VALIDATION);
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const deleted = await Follow.findOneAndDelete({ followerId: req.params.id, followingId: req.user!._id }).session(session);
    if (deleted) {
      await User.updateOne({ _id: req.params.id, followingCount: { $gt: 0 } }, { $inc: { followingCount: -1 } }, { session });
      await User.updateOne({ _id: req.user!._id, followersCount: { $gt: 0 } }, { $inc: { followersCount: -1 } }, { session });
    }
    await session.commitTransaction();
  } catch (err) {
    await session.abortTransaction();
    throw err;
  } finally {
    await session.endSession();
  }
  sendOk(res, { removed: true });
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
  const users = followers.map(f => f.followerId).filter(Boolean);
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
  const users = following.map(f => f.followingId).filter(Boolean);
  sendOk(res, { following: users, users });
}));

usersRouter.get("/:id/stats", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const roomCount = await Room.countDocuments({ hostId: req.params.id });
  const liveCount = await Room.countDocuments({ hostId: req.params.id, status: "LIVE" });
  sendOk(res, { roomsHosted: roomCount, roomsLive: liveCount });
}));
