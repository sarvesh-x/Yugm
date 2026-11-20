import { blockBondPair, endUnavailableBonds } from "../services/bonds.js";
import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { getLevelMilestone, levelMilestones, profileSchema, reactionSchema, socketEvents, streakCoinBonuses, streakCosmeticRewards, xpEventDisplay, xpEvents, type XpEvent } from "@yugm/shared";
import { optionalAuth, requireAuth, requireNotMuted, type AuthRequest } from "../middleware/auth.js";
import { activeCosmeticKey, ensureDefaultCosmetics, listCosmeticsByIds } from "../services/cosmetics.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import { requireNotChatRestricted } from "../middleware/requireSafety.js";
import { validateBody } from "../middleware/validate.js";
import { Block } from "../models/Block.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { ConversationMute } from "../models/ConversationMute.js";
import { Follow } from "../models/Follow.js";
import { ProfileVisit } from "../models/ProfileVisit.js";
import { Friendship } from "../models/Friendship.js";
import { FriendMatchRequest } from "../models/FriendMatchRequest.js";
import { PkBattle } from "../models/PkBattle.js";
import { pkState } from "../services/pk.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SupportTicket } from "../models/SupportTicket.js";
import { User, type IUser } from "../models/User.js";
import { isProfileCompleted } from "../services/profileCompletion.js";
import { updateProfileForUser } from "../services/profileUpdate.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId, sanitizeText } from "../utils/http.js";
import { TrustVerification } from "../models/TrustVerification.js";
import { createNotification } from "../services/notifications.js";
import { canUseRoomReaction, findActiveRoomReaction, normalizeReactionId } from "../services/reactions.js";
import { emitUser, getOnlineUserIds, isUserOnline } from "../services/socket.js";
import { autoModerate } from "../middleware/autoModerate.js";
import { getVipStatus } from "../services/vip.js";
import { dailyCheckInStart, dailyXpCaps, getLevelStatus, grantXp } from "../services/levels.js";
import { getProgressionTrack } from "../services/progressionTracks.js";
import { XpDailyCap } from "../models/XpDailyCap.js";
import { creditWallet } from "../services/wallet.js";
import { findRelationship, grantRelationshipXp } from "../services/relationships.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { revokeAllForUser } from "../services/tokens.js";
import { disconnectUserSockets } from "../services/socket.js";
import { deleteFirebaseUser } from "../services/firebase.js";

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

  // Relationship counters on User are denormalized and can be stale after
  // legacy data imports or account cleanup. Read the actual relationship rows.
  const [followersCount, followingCount, friendsCount] = await Promise.all([
    Follow.countDocuments({ followingId: user._id }),
    Follow.countDocuments({ followerId: user._id }),
    Friendship.countDocuments({
      status: "ACCEPTED",
      $or: [{ userId: user._id }, { friendId: user._id }]
    })
  ]);

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
  const viewer: any = req.user;
  if (viewer && !isSelf && !viewer.mysteriousVisitors) {
    // Bookkeeping write on a GET; don't make the profile response wait for it.
    void ProfileVisit.updateOne(
      { profileId: user._id, visitorId: viewer._id },
      { $set: { lastVisitedAt: new Date() }, $setOnInsert: { profileId: user._id, visitorId: viewer._id } },
      { upsert: true }
    ).catch((error: unknown) => {
      console.error("Profile visit upsert failed:", error instanceof Error ? error.message : String(error));
    });
  }
  sendOk(res, {
    user: publicUser({
      ...user,
      followersCount,
      followingCount,
      isFollowing,
      isCloseFriend,
      friendsCount,
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
const vipPrivacySchema = z.object({ mysteriousVisitors: z.boolean().optional(), chatPrivacy: z.enum(["EVERYONE", "FOLLOWERS"]).optional() })
  .refine((data) => data.mysteriousVisitors !== undefined || data.chatPrivacy !== undefined, "A privacy setting is required");

usersRouter.get("/me/vip-privacy", asyncHandler(async (req: AuthRequest, res) => {
  if (!getVipStatus(req.user).isVip) throw new HttpError(403, "VIP membership required", ErrorCode.FORBIDDEN);
  sendOk(res, { mysteriousVisitors: Boolean((req.user as any).mysteriousVisitors), chatPrivacy: (req.user as any).vipChatPrivacy ?? "EVERYONE" });
}));

usersRouter.patch("/me/vip-privacy", validateBody(vipPrivacySchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!getVipStatus(req.user).isVip) throw new HttpError(403, "VIP membership required", ErrorCode.FORBIDDEN);
  const changes: Record<string, unknown> = {};
  if (req.body.mysteriousVisitors !== undefined) changes.mysteriousVisitors = req.body.mysteriousVisitors;
  if (req.body.chatPrivacy !== undefined) changes.vipChatPrivacy = req.body.chatPrivacy;
  await User.findByIdAndUpdate(req.user!._id, { $set: changes });
  sendOk(res, {
    mysteriousVisitors: req.body.mysteriousVisitors ?? Boolean((req.user as any).mysteriousVisitors),
    chatPrivacy: req.body.chatPrivacy ?? (req.user as any).vipChatPrivacy ?? "EVERYONE"
  });
}));

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
      }], { session, ordered: true });
      createdRoom = rooms[0];

      await RoomParticipant.create([
        { roomId: createdRoom._id, userId: user._id, role: "HOST", micEnabled: true, cameraEnabled: false },
        { roomId: createdRoom._id, userId: matchedUserId, role: "SPEAKER", micEnabled: true, cameraEnabled: false }
      ], { session, ordered: true });

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
    avatarType: user.avatarType,
    avatarParts: user.avatarParts,
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
    profileCompleted: isProfileCompleted(user),
    streakCount: user.streakCount ?? 0,
    vibeLine: user.vibeLine,
    gender: user.gender,
    age: user.age,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    friendsCount: user.friendsCount ?? 0,
    interestedIn: user.interestedIn,
    lookingFor: user.lookingFor,
    datingAgeMin: user.datingAgeMin,
    datingAgeMax: user.datingAgeMax,
    isFollowing: user.isFollowing,
    isCloseFriend: user.isCloseFriend, isVerified: Boolean(user.isVerified), verificationLevel: user.verificationLevel ?? (user.isVerified ? "BASIC" : "NONE"), showcasedBadgeIds: user.showcasedBadgeIds ?? []
  };
}

let unavailableUsersCache: { ids: any[]; expiresAt: number } = { ids: [], expiresAt: 0 };
async function getUnavailableUserIds() {
  const now = Date.now();
  if (unavailableUsersCache.expiresAt > now) return unavailableUsersCache.ids;
  const ids = await User.distinct("_id", { deletionRequestedAt: { $type: "date" } });
  unavailableUsersCache = { ids, expiresAt: now + 5 * 60_000 };
  return ids;
}

usersRouter.get("/me", asyncHandler(async (req: AuthRequest, res) => {
  await handlePublicProfile(req.user!._id.toString(), false, req, res);
}));

usersRouter.delete("/me", asyncHandler(async (req: AuthRequest, res) => {
  const requestedAt = new Date();
  const firebaseUid = (req.user as any).firebaseUid as string | undefined;
  const tombstoneUsername = `deleted_${req.user!._id.toString()}`;
  const [sentPartners, receivedPartners] = await Promise.all([
    DirectMessage.distinct("receiverId", { senderId: req.user!._id }),
    DirectMessage.distinct("senderId", { receiverId: req.user!._id })
  ]);
  await User.updateOne(
    { _id: req.user!._id },
    {
      $set: {
        deletionRequestedAt: requestedAt,
        name: "Deleted User",
        username: tombstoneUsername,
        emailVerified: false,
        isVerified: false
      },
      $unset: {
        email: "",
        phone: "",
        firebaseUid: "",
        avatar: "",
        avatarType: "",
        avatarParts: "",
        bio: "",
        vibeLine: "",
        city: "",
        state: "",
        gender: "",
        age: "",
        interestedIn: "",
        lookingFor: "",
        profileCompletedAt: "",
        termsAcceptedAt: ""
      },
      $inc: { tokenVersion: 1 }
    }
  );
  await endUnavailableBonds(req.user!.id, "TERMINATED_BY_ACCOUNT_REMOVAL");
  await Promise.all([
    revokeAllForUser(req.user!.id),
    DeviceToken.deleteMany({ userId: req.user!._id })
  ]);
  await disconnectUserSockets(req.user!.id);
  for (const partnerId of new Set([...sentPartners, ...receivedPartners].map((id: any) => id.toString()))) {
    emitUser(partnerId, socketEvents.directConversationDeleted, { partnerId: req.user!.id });
  }

  if (firebaseUid) {
    const firebaseDelete = await deleteFirebaseUser(firebaseUid);
    if (firebaseDelete.reason === "not_configured") {
      console.warn("Account deletion completed in MongoDB but Firebase Admin is not configured; Firebase Auth user was not deleted", { userId: req.user!.id, firebaseUid });
    }
  }

  sendOk(res, { deletionScheduledAt: new Date(requestedAt.getTime() + 30 * 24 * 60 * 60 * 1000) });
}));

usersRouter.patch("/me", validateBody(profileSchema.partial()), asyncHandler(async (req: AuthRequest, res) => {
  const { user, xpGrant } = await updateProfileForUser(req.user!.id, req.body);
  // This response is self-only, so include the email and verification state
  // that `publicUser` deliberately omits for other users' profiles. The Android
  // client keeps the cached signed-in identity from this payload.
  sendOk(res, {
    user: { ...publicUser(user), email: user?.email, emailVerified: Boolean(user?.emailVerified) },
    xpGrant
  });
}));

usersRouter.get("/me/friends", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const rows = await Friendship.find({ $or: [{ userId: req.user!._id }, { friendId: req.user!._id }], status: "ACCEPTED" })
    .populate("userId", "name username avatar avatarType avatarParts city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .populate("friendId", "name username avatar avatarType avatarParts city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ updatedAt: -1 }).limit(100).lean();
  const users = rows.map((row: any) => row.userId?._id?.toString() === req.user!.id ? row.friendId : row.userId).filter(Boolean);
  sendOk(res, { users });
}));

usersRouter.get("/me/close-friends", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id)
    .populate("closeFriendIds", "name username avatar avatarType avatarParts city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
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
  sendOk(res, { schemaVersion: 1, level: getLevelStatus(req.user) });
});

usersRouter.get("/me/level-overview", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id)
    .select("name username avatar avatarType avatarParts xp level levelTitle lastDailyCheckInAt streakCount walletBalance activeCosmetics wealthExp charmExp")
    .lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const levelStatus = getLevelStatus(user);
  const streak = user.streakCount ?? 0;
  const milestones = Object.keys(streakCoinBonuses).map(Number).sort((a, b) => a - b);
  const nextMilestone = milestones.find((m) => m > streak) ?? null;
  const today = dailyCheckInStart();
  const capRows = await XpDailyCap.find({ userId: req.user!.id, day: today }).select("event amount").lean();
  const earnedByEvent = new Map(capRows.map((row) => [row.event, row.amount]));
  const eventInfo = (key: XpEvent) => ({
    ...xpEventDisplay[key],
    xp: xpEvents[key],
    cap: dailyXpCaps[key] ?? null,
    earnedToday: earnedByEvent.get(key) ?? 0
  });
  const todayXpEarned = capRows.reduce((total, row) => total + row.amount, 0);
  const todayXpCap = Object.values(dailyXpCaps).reduce((total, cap) => total + (cap ?? 0), 0);
  const roadmapMilestones = levelStatus.level <= levelMilestones.length
    ? levelMilestones
    : Array.from({ length: 31 }, (_, index) => getLevelMilestone(Math.max(1, levelStatus.level - 10) + index));

  const [topUsers, usersAhead] = await Promise.all([
    User.find({ isBlocked: { $ne: true } })
      .sort({ level: -1, xp: -1, _id: 1 })
      .limit(10)
      .select("name username avatar avatarType avatarParts level levelTitle xp activeCosmetics")
      .lean(),
    User.countDocuments({
      isBlocked: { $ne: true },
      _id: { $ne: user._id },
      $or: [
        { level: { $gt: levelStatus.level } },
        { level: levelStatus.level, xp: { $gt: levelStatus.xp } },
        { level: levelStatus.level, xp: levelStatus.xp, _id: { $lt: user._id } }
      ]
    })
  ]);

  sendOk(res, {
    schemaVersion: 1,
    level: levelStatus,
    wealthLevel: getProgressionTrack(user.wealthExp),
    charmLevel: getProgressionTrack(user.charmExp),
    streak: {
      count: streak,
      canCheckIn: levelStatus.canDailyCheckIn,
      nextMilestone,
      nextMilestoneReward: nextMilestone ? streakCoinBonuses[nextMilestone] : 0,
      milestones: milestones.map((streakDays) => ({
        streakDays,
        rewardCoins: streakCoinBonuses[streakDays],
        cosmeticId: streakCosmeticRewards[streakDays] ?? "",
        reached: streak >= streakDays
      })),
      streakBonuses: streakCoinBonuses
    },
    leaderboardRank: usersAhead + 1,
    milestones: roadmapMilestones,
    xpEvents: {
      DAILY_CHECKIN: eventInfo("DAILY_CHECKIN"),
      PROFILE_COMPLETE: eventInfo("PROFILE_COMPLETE"),
      ROOM_CREATE: eventInfo("ROOM_CREATE"),
      ROOM_JOIN: eventInfo("ROOM_JOIN"),
      CHAT_MESSAGE: eventInfo("CHAT_MESSAGE"),
      GIFT_SENT: eventInfo("GIFT_SENT"),
      GIFT_RECEIVED: eventInfo("GIFT_RECEIVED"),
      VIP_PURCHASE: eventInfo("VIP_PURCHASE"),
      COSMETIC_PURCHASE: eventInfo("COSMETIC_PURCHASE"),
      FOLLOW_USER: eventInfo("FOLLOW_USER"),
      MINI_GAME_PLAY: eventInfo("MINI_GAME_PLAY")
    },
    todayXpEarned,
    todayXpCap,
    leaderboard: topUsers.map((u, i) => ({
      rank: i + 1,
      id: u._id.toString(),
      name: u.name,
      username: u.username,
      avatar: u.avatar,
      avatarType: (u as any).avatarType,
      avatarParts: (u as any).avatarParts,
      level: getLevelStatus(u).level,
      levelTitle: getLevelStatus(u).title,
      xp: getLevelStatus(u).xp,
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
    icon: item.giftId?.icon ?? "🎁",
    coinPrice: item.giftId?.coinPrice ?? 0,
    rarity: item.giftId?.rarity ?? "common",
    quantity: item.quantity,
    source: item.source,
    tradable: item.tradable,
    upgradeLevel: item.upgradeLevel ?? 1,
    upgradeable: Boolean(item.giftId?.upgradeable),
    upgradeCost: item.giftId?.upgradeable ? Math.floor((item.giftId?.coinPrice ?? 0) * 1.5) : 0
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
      icon: ach?.icon ?? "🏅"
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
  const todayStart = dailyCheckInStart(now);
  const user = await User.findById(req.user!.id).select("xp level levelTitle lastDailyCheckInAt walletBalance streakCount ownedCosmeticIds").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const alreadyClaimed = user.lastDailyCheckInAt && user.lastDailyCheckInAt >= todayStart;
  if (alreadyClaimed) {
    return sendOk(res, { alreadyClaimed: true, level: getLevelStatus(user), balance: user.walletBalance, streak: user.streakCount ?? 0 });
  }

  const yesterday = new Date(now.getTime() - 86400000);
  const isConsecutive = user.lastDailyCheckInAt && user.lastDailyCheckInAt >= dailyCheckInStart(yesterday);
  const newStreak = (isConsecutive ? (user.streakCount ?? 0) : 0) + 1;

  const rewardCosmetic = streakCosmeticRewards[newStreak];
  let unlockedCosmetic: string | undefined;
  if (rewardCosmetic && !(user.ownedCosmeticIds ?? []).includes(rewardCosmetic)) {
    unlockedCosmetic = rewardCosmetic;
  }

  const claimUpdate: Record<string, unknown> = {
    $set: { lastDailyCheckInAt: now, streakCount: newStreak },
    ...(unlockedCosmetic ? { $addToSet: { ownedCosmeticIds: unlockedCosmetic } } : {})
  };
  const claimedUser = await User.findOneAndUpdate(
    { _id: req.user!.id, lastDailyCheckInAt: user.lastDailyCheckInAt ?? null },
    claimUpdate,
    { new: true }
  ).select("xp level levelTitle lastDailyCheckInAt walletBalance streakCount").lean();
  if (!claimedUser) {
    const currentUser = await User.findById(req.user!.id).select("xp level levelTitle lastDailyCheckInAt walletBalance streakCount").lean();
    return sendOk(res, {
      alreadyClaimed: true,
      level: getLevelStatus(currentUser),
      balance: currentUser?.walletBalance,
      streak: currentUser?.streakCount ?? 0
    });
  }

  const milestones = Object.keys(streakCoinBonuses).map(Number).sort((a, b) => a - b);
  let streakBonus = 0;
  if (streakCoinBonuses[newStreak]) {
    streakBonus = streakCoinBonuses[newStreak];
    await creditWallet(req.user!.id, streakBonus, "STREAK_BONUS", {
      streak: newStreak,
      milestone: newStreak,
      idempotencyKey: `check-in:${req.user!.id}:${todayStart.toISOString()}:streak`
    });
  }

  const nextMilestone = milestones.find((m) => m > newStreak) ?? null;

  const xpReward = await grantXp(req.user!.id, "DAILY_CHECKIN", {
    idempotencyKey: `check-in:${req.user!.id}:${todayStart.toISOString()}:xp`
  });
  sendOk(res, {
    schemaVersion: 1,
    alreadyClaimed: false,
    streak: newStreak,
    unlockedCosmetic,
    streakBonus,
    nextMilestone,
    balance: (xpReward as { walletBalance?: number } | undefined)?.walletBalance,
    xpGrant: xpReward,
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
    $or: req.query.scope === "username"
      ? [{ username: regex }]
      : [{ name: regex }, { username: regex }, { interests: regex }, { city: regex }],
    isBlocked: { $ne: true }
  })
    .select("name username avatar avatarType avatarParts city followersCount interests role activeCosmetics vipTier vipStartedAt vipExpiresAt xp level levelTitle lastDailyCheckInAt")
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
    .select("name username avatar avatarType avatarParts city followersCount interests role activeCosmetics vipTier vipStartedAt vipExpiresAt xp level levelTitle lastDailyCheckInAt")
    .sort({ vipExpiresAt: -1, level: -1, followersCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { users: users.map((user) => ({ ...user, ...getVipStatus(user), xp: getLevelStatus(user).xp, level: getLevelStatus(user).level, levelTitle: getLevelStatus(user).title, levelStatus: getLevelStatus(user), isFollowing: false })) });
}));

// Random users from live presence for the chat discovery carousel. This is
// intentionally independent of follows, friends, and dating matches.
usersRouter.get("/recommended-chat", asyncHandler(async (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 30, 60);
  const onlineIds = await getOnlineUserIds();
  if (onlineIds.length === 0) return sendOk(res, { users: [] });
  const blockedRows = await Block.find({
    $or: [
      { blockerId: req.user!._id, blockedUserId: { $in: onlineIds } },
      { blockedUserId: req.user!._id, blockerId: { $in: onlineIds } }
    ]
  }).select("blockerId blockedUserId").lean();
  const excludedIds = new Set<string>([req.user!.id, ...blockedRows.flatMap((row) => [row.blockerId.toString(), row.blockedUserId.toString()])]);
  const candidates = onlineIds.filter((id) => !excludedIds.has(id));
  if (candidates.length === 0) return sendOk(res, { users: [] });

  const sampledUsers = await User.aggregate([
    { $match: {
      _id: { $in: candidates.map((id) => new mongoose.Types.ObjectId(id)) },
      isBlocked: { $ne: true },
      deletionRequestedAt: { $exists: false }
    } },
    { $sample: { size: limit } },
    { $project: { name: 1, username: 1, avatar: 1, avatarType: 1, avatarParts: 1, activeCosmetics: 1, vipTier: 1, vipExpiresAt: 1, xp: 1, level: 1, levelTitle: 1 } }
  ]);
  const users = sampledUsers.map((user: any) => ({
    ...user,
    ...getVipStatus(user),
    // These ids came from the shared live-presence set. isUserOnline only
    // checks this process's cached snapshot and can incorrectly mark users
    // connected to another API instance as offline.
    isOnline: true,
    isFollowing: false
  }));
  sendOk(res, { users });
}));

usersRouter.get("/messages", asyncHandler(async (req: AuthRequest, res) => {
  const unavailableUsers = await getUnavailableUserIds();
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const beforeRaw = String(req.query.before || "").trim();
  let beforeDate: Date | null = null;
  if (beforeRaw) {
    const parsed = new Date(beforeRaw);
    if (!Number.isNaN(parsed.getTime())) beforeDate = parsed;
  }
  const filter: Record<string, unknown> = {
    $or: [
      { senderId: req.user!._id, receiverId: { $nin: unavailableUsers } },
      { receiverId: req.user!._id, senderId: { $nin: unavailableUsers } }
    ],
    hiddenFor: { $ne: req.user!._id }
  };
  if (beforeDate) filter.createdAt = { $lt: beforeDate };
  const rows = await DirectMessage.find(filter)
    .populate("senderId receiverId", "name username avatar avatarType avatarParts activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = rows.length > limit;
  const messages = hasMore ? rows.slice(0, limit) : rows;
  sendOk(res, {
    messages,
    hasMore,
    nextBefore: messages.length ? (messages[messages.length - 1] as any).createdAt : null
  });
}));

usersRouter.post("/messages/read-all", asyncHandler(async (req: AuthRequest, res) => {
  const unavailableUsers = await getUnavailableUserIds();
  const senders = await DirectMessage.distinct("senderId", { receiverId: req.user!._id, senderId: { $nin: unavailableUsers }, read: false, hiddenFor: { $ne: req.user!._id } });
  const result = await DirectMessage.updateMany(
    { receiverId: req.user!.id, senderId: { $nin: unavailableUsers }, read: false, hiddenFor: { $ne: req.user!._id } },
    { $set: { read: true } }
  );
  const readThrough = new Date().toISOString();
  senders.forEach((senderId: any) => emitUser(senderId.toString(), socketEvents.directMessageRead, { partnerId: req.user!.id, readThrough }));
  senders.forEach((senderId: any) => emitUser(req.user!.id, "direct:conversation:read", { partnerId: senderId.toString(), readThrough }));
  sendOk(res, { updated: result.modifiedCount });
}));

usersRouter.post("/messages/:userId/read", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const unavailable = await User.exists({ _id: req.params.userId, deletionRequestedAt: { $type: "date" } });
  if (unavailable) throw new HttpError(404, "This account is no longer available", ErrorCode.NOT_FOUND);
  const readResult = await DirectMessage.updateMany(
    { senderId: req.params.userId, receiverId: req.user!.id, read: false, hiddenFor: { $ne: req.user!._id } },
    { $set: { read: true } }
  );
  const readThrough = new Date().toISOString();
  if (readResult.modifiedCount > 0) {
    emitUser(req.params.userId, socketEvents.directMessageRead, { partnerId: req.user!.id, readThrough });
    emitUser(req.user!.id, "direct:conversation:read", { partnerId: req.params.userId, readThrough });
  } else {
    // Still notify self to reconcile unread badges across sessions/tabs when already read server-side.
    emitUser(req.user!.id, "direct:conversation:read", { partnerId: req.params.userId, readThrough });
  }
  sendOk(res, { updated: readResult.modifiedCount, readThrough });
}));

usersRouter.get("/messages/unread-counts", asyncHandler(async (req: AuthRequest, res) => {
  const unavailableUsers = await getUnavailableUserIds();
  const rows = await DirectMessage.aggregate([
    { $match: { receiverId: req.user!._id, senderId: { $nin: unavailableUsers }, read: false, hiddenFor: { $ne: req.user!._id } } },
    { $group: { _id: "$senderId", count: { $sum: 1 } } }
  ]);
  const unreadCounts = Object.fromEntries(rows.map((row: any) => [row._id.toString(), row.count]));
  sendOk(res, { unreadCounts, total: rows.reduce((sum: number, row: any) => sum + row.count, 0) });
}));

usersRouter.get("/messages/mutes", asyncHandler(async (req: AuthRequest, res) => {
  const rows: any[] = await ConversationMute.find({ ownerId: req.user!._id, muted: true }).select("partnerId").lean();
  sendOk(res, { partnerIds: rows.map((row) => row.partnerId.toString()) });
}));

usersRouter.get("/messages/:userId/search", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  if (await User.exists({ _id: req.params.userId, deletionRequestedAt: { $type: "date" } })) throw new HttpError(404, "This account is no longer available", ErrorCode.NOT_FOUND);
  const query = String(req.query.q || "").trim();
  if (query.length < 2) throw new HttpError(400, "Search must be at least 2 characters", ErrorCode.VALIDATION);
  const blocked = await Block.exists({ $or: [
    { blockerId: req.user!._id, blockedUserId: req.params.userId },
    { blockerId: req.params.userId, blockedUserId: req.user!._id }
  ] });
  if (blocked) throw new HttpError(403, "Cannot search this conversation", ErrorCode.FORBIDDEN);
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 200);
  const beforeRaw = String(req.query.before || "").trim();
  let beforeDate: Date | null = null;
  if (beforeRaw) {
    const parsed = new Date(beforeRaw);
    if (!Number.isNaN(parsed.getTime())) beforeDate = parsed;
  }
  const filter: Record<string, unknown> = {
    $or: [
      { senderId: req.user!._id, receiverId: req.params.userId },
      { senderId: req.params.userId, receiverId: req.user!._id }
    ],
    hiddenFor: { $ne: req.user!._id },
    message: { $regex: escaped, $options: "i" }
  };
  if (beforeDate) filter.createdAt = { $lt: beforeDate };
  const rows = await DirectMessage.find(filter).sort({ createdAt: -1, _id: -1 }).limit(limit + 1).lean();
  const hasMore = rows.length > limit;
  const messages = hasMore ? rows.slice(0, limit) : rows;
  sendOk(res, { messages: messages.reverse(), hasMore, nextBefore: messages.length ? (messages[0] as any).createdAt : null });
}));

usersRouter.put("/messages/:userId/mute", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId) || typeof req.body.muted !== "boolean") throw new HttpError(400, "Invalid mute setting", ErrorCode.VALIDATION);
  const preference = await ConversationMute.findOneAndUpdate(
    { ownerId: req.user!._id, partnerId: req.params.userId },
    { $set: { muted: req.body.muted, updatedAt: new Date() } },
    { upsert: true, new: true }
  ).lean();
  sendOk(res, { muted: preference?.muted ?? false });
}));

usersRouter.get("/messages/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  if (await User.exists({ _id: req.params.userId, deletionRequestedAt: { $type: "date" } })) throw new HttpError(404, "This account is no longer available", ErrorCode.NOT_FOUND);
  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: req.params.userId },
      { blockerId: req.params.userId, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot view this conversation", ErrorCode.FORBIDDEN);
  const limit = Math.min(Math.max(Number(req.query.limit) || 100, 1), 100);
  const beforeRaw = String(req.query.before || "").trim();
  let beforeDate: Date | null = null;
  if (beforeRaw) {
    const parsed = new Date(beforeRaw);
    if (!Number.isNaN(parsed.getTime())) beforeDate = parsed;
    else if (isValidObjectId(beforeRaw)) {
      const cursorMsg = await DirectMessage.findById(beforeRaw).select("createdAt").lean();
      if (cursorMsg?.createdAt) beforeDate = new Date(cursorMsg.createdAt as any);
    }
  }
  const markReadRaw = String(req.query.markRead ?? "").trim().toLowerCase();
  const markRead = markReadRaw === "" ? true : !["false", "0", "no"].includes(markReadRaw);

  const baseFilter: Record<string, unknown> = {
    $or: [
      { senderId: req.user!.id, receiverId: req.params.userId },
      { senderId: req.params.userId, receiverId: req.user!.id }
    ],
    hiddenFor: { $ne: req.user!._id }
  };
  if (beforeDate) baseFilter.createdAt = { $lt: beforeDate };

  const messages = await DirectMessage.find(baseFilter)
    .populate("senderId receiverId", "name username avatar avatarType avatarParts activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .lean();
  const hasMore = messages.length > limit;
  const page = hasMore ? messages.slice(0, limit) : messages;
  const relationship = await findRelationship(req.user!.id, req.params.userId);
  const mutePreference: any = await ConversationMute.findOne({ ownerId: req.user!._id, partnerId: req.params.userId }).lean();

  // Only mark as read / emit receipts on initial (latest) fetch to avoid side effects when paginating older history.
  if (!beforeDate && markRead) {
    const readResult = await DirectMessage.updateMany(
      { senderId: req.params.userId, receiverId: req.user!.id, read: false, hiddenFor: { $ne: req.user!._id } },
      { $set: { read: true } }
    );
    if (readResult.modifiedCount > 0) emitUser(req.params.userId, socketEvents.directMessageRead, { partnerId: req.user!.id, readThrough: new Date().toISOString() });
  }

  sendOk(res, {
    messages: page.reverse(),
    relationship,
    muted: Boolean(mutePreference?.muted),
    hasMore,
    nextBefore: page.length ? (page[0] as any).createdAt : null
  });
}));

usersRouter.put("/messages/:userId/:messageId", requireNotMuted, requireNotChatRestricted, chatLimiter, autoModerate("message"), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId) || !isValidObjectId(req.params.messageId)) throw new HttpError(400, "Invalid message or user ID", ErrorCode.VALIDATION);
  const messageText = String(req.body.message || "").trim();
  if (!messageText || messageText.length > 2000) throw new HttpError(400, "Message must be between 1 and 2000 characters", ErrorCode.VALIDATION);
  const message: any = await DirectMessage.findOne({ _id: req.params.messageId, senderId: req.user!._id, receiverId: req.params.userId });
  if (!message) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
  if (Date.now() - new Date(message.createdAt).getTime() > 15 * 60 * 1000) throw new HttpError(400, "Messages can only be edited for 15 minutes", ErrorCode.VALIDATION);
  if (message.mediaUrl) throw new HttpError(400, "Media messages cannot be edited", ErrorCode.VALIDATION);
  message.message = sanitizeText(messageText);
  message.isEdited = true;
  message.editedAt = new Date();
  await message.save();
  await message.populate("senderId receiverId", "name username avatar avatarType avatarParts activeCosmetics vipTier vipExpiresAt xp level levelTitle");
  const safeMessage = message.toObject ? message.toObject() : message;
  emitUser(req.params.userId, socketEvents.directMessageNew, { message: safeMessage, partnerId: req.user!.id, updated: true });
  emitUser(req.user!.id, socketEvents.directMessageNew, { message: safeMessage, partnerId: req.params.userId, updated: true });
  sendOk(res, { message: safeMessage });
}));

usersRouter.post("/messages/:userId/forward", requireNotMuted, requireNotChatRestricted, chatLimiter, asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId) || !isValidObjectId(req.body.messageId)) throw new HttpError(400, "Invalid user or message ID", ErrorCode.VALIDATION);
  if (req.params.userId === req.user!.id) throw new HttpError(400, "Cannot forward a message to yourself", ErrorCode.VALIDATION);
  const source: any = await DirectMessage.findOne({ _id: req.body.messageId, $or: [
    { senderId: req.user!._id }, { receiverId: req.user!._id }
  ] }).lean();
  if (!source) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
  if (!await User.exists({ _id: req.params.userId })) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const blocked = await Block.exists({ $or: [
    { blockerId: req.user!._id, blockedUserId: req.params.userId },
    { blockerId: req.params.userId, blockedUserId: req.user!._id }
  ] });
  if (blocked) throw new HttpError(403, "Cannot message this user", ErrorCode.FORBIDDEN);
  const created = await DirectMessage.create({
    senderId: req.user!._id, receiverId: req.params.userId,
    message: source.message, mediaUrl: source.mediaUrl, mediaType: source.mediaType,
    duration: source.duration, forwarded: true
  });
  const message: any = await DirectMessage.findById(created._id).populate("senderId receiverId", "name username avatar avatarType avatarParts activeCosmetics vipTier vipExpiresAt xp level levelTitle").lean();
  emitUser(req.params.userId, socketEvents.directMessageNew, { message, partnerId: req.user!.id });
  emitUser(req.user!.id, socketEvents.directMessageNew, { message, partnerId: req.params.userId });
  const targetMuted = await ConversationMute.exists({ ownerId: req.params.userId, partnerId: req.user!._id, muted: true });
  if (!targetMuted) await createNotification(req.params.userId, "MESSAGE", "Forwarded message", `${req.user!.name} forwarded you a message`, { partnerId: req.user!.id, messageId: created._id.toString() });
  sendOk(res, { message }, 201);
}));

// Hide conversation for the current user only (preserves shared history for the other participant).
usersRouter.delete("/messages/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const result = await DirectMessage.updateMany({
    $or: [
      { senderId: req.user!.id, receiverId: req.params.userId },
      { senderId: req.params.userId, receiverId: req.user!.id }
    ],
    hiddenFor: { $ne: req.user!._id }
  }, { $addToSet: { hiddenFor: req.user!._id } });
  emitUser(req.user!.id, socketEvents.directConversationDeleted, { partnerId: req.params.userId });
  sendOk(res, { deletedCount: result.modifiedCount ?? 0 });
}));

usersRouter.post("/messages/:userId/delete-selected", chatLimiter, asyncHandler(async (req: AuthRequest, res) => {
  const messageIds = req.body.messageIds;
  const scope = String(req.body.scope || "").toUpperCase();
  if (!isValidObjectId(req.params.userId) || !Array.isArray(messageIds) || messageIds.length < 1 || messageIds.length > 100 || !messageIds.every(isValidObjectId) || !["ME", "EVERYONE"].includes(scope)) {
    throw new HttpError(400, "Invalid message selection", ErrorCode.VALIDATION);
  }
  const conversationFilter = {
    _id: { $in: messageIds },
    $or: [
      { senderId: req.user!._id, receiverId: req.params.userId },
      { senderId: req.params.userId, receiverId: req.user!._id }
    ]
  };
  if (scope === "ME") {
    const visible = await DirectMessage.find({ ...conversationFilter, hiddenFor: { $ne: req.user!._id } }).select("_id").lean();
    const deletedIds = visible.map((message: any) => message._id.toString());
    if (deletedIds.length) {
      await DirectMessage.updateMany({ _id: { $in: deletedIds } }, { $addToSet: { hiddenFor: req.user!._id } });
    }
    return sendOk(res, { deletedIds, deletedCount: deletedIds.length, scope });
  }

  const owned = await DirectMessage.find({
    ...conversationFilter,
    senderId: req.user!._id,
    receiverId: req.params.userId
  }).select("_id").lean();
  const deletedIds = owned.map((message: any) => message._id.toString());
  if (deletedIds.length) {
    await DirectMessage.deleteMany({ _id: { $in: deletedIds }, senderId: req.user!._id });
    deletedIds.forEach((messageId: string) => {
      emitUser(req.user!.id, socketEvents.directMessageDeleted, { messageId, partnerId: req.params.userId });
      emitUser(req.params.userId, socketEvents.directMessageDeleted, { messageId, partnerId: req.user!.id });
    });
  }
  sendOk(res, { deletedIds, deletedCount: deletedIds.length, scope });
}));

usersRouter.delete("/messages/:userId/:messageId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId) || !isValidObjectId(req.params.messageId)) throw new HttpError(400, "Invalid message or user ID", ErrorCode.VALIDATION);
  const result = await DirectMessage.deleteOne({
    _id: req.params.messageId,
    senderId: req.user!.id,
    receiverId: req.params.userId
  });
  if (result.deletedCount === 0) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
  emitUser(req.user!.id, socketEvents.directMessageDeleted, { messageId: req.params.messageId, partnerId: req.params.userId });
  emitUser(req.params.userId, socketEvents.directMessageDeleted, { messageId: req.params.messageId, partnerId: req.user!.id });
  sendOk(res, { deleted: true });
}));

usersRouter.post("/messages/:userId", requireAuth, requireNotMuted, requireNotChatRestricted, chatLimiter, autoModerate("message"), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const receiverId = req.params.userId;
  if (receiverId === req.user!.id) throw new HttpError(400, "Cannot message yourself", ErrorCode.VALIDATION);
  if (await User.exists({ _id: receiverId, deletionRequestedAt: { $type: "date" } })) throw new HttpError(404, "This account is no longer available", ErrorCode.NOT_FOUND);

  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: receiverId },
      { blockerId: receiverId, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot message this user", ErrorCode.FORBIDDEN);

  const recipientPrivacy = await User.findById(receiverId).select("vipChatPrivacy").lean();
  const senderIsVip = getVipStatus(req.user).isVip;
  if (recipientPrivacy?.vipChatPrivacy === "FOLLOWERS" && !senderIsVip && !await Follow.exists({ followerId: req.user!._id, followingId: receiverId })) {
    throw new HttpError(403, "This user only accepts messages from followers", ErrorCode.FORBIDDEN);
  }

  const messageText = String(req.body.message || "").trim();
  const mediaUrl = String(req.body.mediaUrl || "").trim();
  const mediaType = String(req.body.mediaType || "").toUpperCase();
  const duration = Number(req.body.duration) || 0;
  if (!messageText && !mediaUrl) throw new HttpError(400, "Message cannot be empty", ErrorCode.VALIDATION);
  if (mediaUrl && !["IMAGE", "VIDEO", "AUDIO"].includes(mediaType)) throw new HttpError(400, "Invalid message media type", ErrorCode.VALIDATION);

  let replyTo: Record<string, unknown> | undefined;
  if (req.body.replyToId) {
    if (!isValidObjectId(req.body.replyToId)) throw new HttpError(400, "Invalid reply target", ErrorCode.VALIDATION);
    const replied: any = await DirectMessage.findOne({ _id: req.body.replyToId, $or: [
      { senderId: req.user!._id, receiverId }, { senderId: receiverId, receiverId: req.user!._id }
    ] }).populate("senderId", "name").lean();
    if (!replied) throw new HttpError(404, "Reply target not found", ErrorCode.NOT_FOUND);
    replyTo = {
      messageId: replied._id,
      author: replied.senderId?.name ?? "User",
      authorId: replied.senderId?._id ?? replied.senderId,
      text: replied.message,
      mediaUrl: replied.mediaUrl
    };
  }

  const created = await DirectMessage.create({
    senderId: req.user!.id,
    receiverId,
    message: messageText ? sanitizeText(messageText) : mediaType === "VIDEO" ? "Shared a video" : mediaType === "AUDIO" ? "🎤 Voice note" : "Shared a photo",
    mediaUrl,
    mediaType,
    duration: mediaType === "AUDIO" ? duration : 0,
    replyTo
  });
  const message = await DirectMessage.findById(created._id)
    .populate("senderId receiverId", "name username avatar avatarType avatarParts activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();

  // Mark other messages from them as read
  const readResult = await DirectMessage.updateMany(
    { senderId: receiverId, receiverId: req.user!.id, read: false },
    { $set: { read: true } }
  );
  const readThrough = new Date().toISOString();
  if (readResult.modifiedCount > 0) {
    emitUser(receiverId, socketEvents.directMessageRead, { partnerId: req.user!.id, readThrough });
    emitUser(req.user!.id, "direct:conversation:read", { partnerId: receiverId, readThrough });
  }

  emitUser(receiverId, socketEvents.directMessageNew, { message, partnerId: req.user!.id });
  emitUser(req.user!.id, socketEvents.directMessageNew, { message, partnerId: receiverId });
  const receiverMuted = await ConversationMute.exists({ ownerId: receiverId, partnerId: req.user!._id, muted: true });
  if (!receiverMuted) await createNotification(receiverId, "MESSAGE", "New message", `${req.user!.name}: ${message?.message ?? ""}`, { partnerId: req.user!.id, messageId: created._id.toString() });
  const xpGrant = await grantXp(req.user!.id, "CHAT_MESSAGE", { messageId: created._id.toString(), idempotencyKey: `message:${created._id}` });
  const relationship = await grantRelationshipXp(req.user!.id, receiverId, "MESSAGE_SENT", { messageId: created._id.toString() });
  sendOk(res, { message, relationship: relationship?.relationship, xpGrant }, 201);
}));

usersRouter.post("/messages/:userId/call", requireAuth, requireNotMuted, validateBody(privateCallSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const receiverId = req.params.userId;
  if (receiverId === req.user!.id) throw new HttpError(400, "Cannot call yourself", ErrorCode.VALIDATION);

  const [receiver, caller] = await Promise.all([
    User.findById(receiverId).select("name username avatar avatarType avatarParts").lean(),
    User.findById(req.user!.id).select("vipTier vipExpiresAt vipStartedAt").lean()
  ]);
  if (!receiver) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  if (!getVipStatus(caller).isVip) throw new HttpError(403, "Private voice and video calls are available to VIP members only", ErrorCode.FORBIDDEN);

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
    }], { session, ordered: true });

    await RoomParticipant.create([
      { roomId: room[0]._id, userId: req.user!.id, role: "HOST", micEnabled: true, cameraEnabled: type === "VIDEO" },
      { roomId: room[0]._id, userId: receiverId, role: "SPEAKER", micEnabled: true, cameraEnabled: type === "VIDEO" }
    ], { session, ordered: true });

    const createdMessage = await DirectMessage.create([{
      senderId: req.user!.id,
      receiverId,
      roomId: room[0]._id,
      message: `Private ${type.toLowerCase()} call started`
    }], { session, ordered: true });

    await session.commitTransaction();
    session.endSession();

    const safeMessage = await DirectMessage.findById(createdMessage[0]._id)
      .populate("senderId receiverId", "name username avatar avatarType avatarParts activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .lean();

    await createNotification(
      receiverId,
      "MESSAGE",
      type === "VOICE" ? "Private voice call" : "Private video call",
      `${req.user!.name} started a private ${type.toLowerCase()} call`,
      { roomId: room[0]._id.toString(), partnerId: req.user!.id, callType: type }
    );
    if (safeMessage) {
      emitUser(receiverId, socketEvents.directMessageNew, { message: safeMessage, partnerId: req.user!.id });
      emitUser(req.user!.id, socketEvents.directMessageNew, { message: safeMessage, partnerId: receiverId });
    }

    sendOk(res, { room: room[0], message: safeMessage ?? createdMessage[0] }, 201);
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
  const message = await DirectMessage.findOne(belongsToConversation).select("_id senderId receiverId reactions").lean();
  if (!message) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);

  const requestedType = normalizeReactionId(String(req.body.type || ""));
  if (!requestedType) throw new HttpError(400, "Invalid reaction", ErrorCode.VALIDATION);
  const existingReaction = (message.reactions || []).find((reaction: any) => reaction?.userId?.toString?.() === req.user!.id);
  const existingType = normalizeReactionId(String(existingReaction?.type || ""));
  const isRemoving = Boolean(existingType) && existingType === requestedType;

  let updated;
  if (isRemoving) {
    updated = await DirectMessage.findByIdAndUpdate(
      req.params.messageId,
      { $pull: { reactions: { userId: req.user!.id } } },
      { new: true }
    )
      .populate("senderId receiverId", "name username avatar avatarType avatarParts activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .lean();
  } else {
    const catalogReaction = await findActiveRoomReaction(requestedType);
    if (!catalogReaction) throw new HttpError(400, "Reaction is not available", ErrorCode.VALIDATION);
    if (!canUseRoomReaction(catalogReaction as any, req.user as any)) {
      throw new HttpError(403, "VIP membership required for this reaction", ErrorCode.FORBIDDEN);
    }
    await DirectMessage.updateOne({ _id: req.params.messageId }, { $pull: { reactions: { userId: req.user!.id } } });
    updated = await DirectMessage.findByIdAndUpdate(
      req.params.messageId,
      { $push: { reactions: { userId: req.user!.id, type: requestedType, createdAt: new Date() } } },
      { new: true }
    )
      .populate("senderId receiverId", "name username avatar avatarType avatarParts activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .lean();
  }

  const partnerId = message.senderId.toString() === req.user!.id ? message.receiverId.toString() : message.senderId.toString();
  emitUser(partnerId, "direct:reaction:new", { message: updated, partnerId: req.user!.id });
  if (!isRemoving) {
    const conversationMuted = await ConversationMute.exists({ ownerId: partnerId, partnerId: req.user!._id, muted: true });
    if (!conversationMuted) await createNotification(partnerId, "MESSAGE", "New reaction", `${req.user!.name} reacted to your message`, { partnerId: req.user!.id, messageId: req.params.messageId });
  }
  sendOk(res, { message: updated });
}));

usersRouter.get("/me/blocked", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const blockedRows = await Block.find({ blockerId: req.user!.id })
    .populate("blockedUserId", "name username avatar avatarType avatarParts city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();
  const users = blockedRows.map((row) => row.blockedUserId).filter(Boolean);
  sendOk(res, { users });
}));

usersRouter.get("/leaderboard/levels", asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1);
  const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.pageSize ?? "25"), 10) || 25));
  const requester = await User.findById(req.user!.id).select("level xp").lean();
  if (!requester) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const [users, total] = await Promise.all([
    User.find({ isBlocked: { $ne: true } })
    .select("name username avatar avatarType avatarParts city followersCount activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .sort({ level: -1, xp: -1, _id: 1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
    User.countDocuments({ isBlocked: { $ne: true } })
  ]);
  const usersAhead = await User.countDocuments({
    isBlocked: { $ne: true },
    $or: [
      { level: { $gt: requester.level ?? 1 } },
      { level: requester.level ?? 1, xp: { $gt: requester.xp ?? 0 } },
      { level: requester.level ?? 1, xp: requester.xp ?? 0, _id: { $lt: requester._id } }
    ]
  });
  const ranked = users.map((user, index) => ({ ...publicUser(user), rank: (page - 1) * pageSize + index + 1 }));
  sendOk(res, {
    users: ranked,
    leaderboard: ranked,
    page,
    pageSize,
    total,
    requesterId: req.user!.id,
    requesterRank: usersAhead + 1
  });
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
      const [follow] = await Follow.create([{ followerId: req.user!.id, followingId: req.params.id }], { session, ordered: true });
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
  const xpGrant = createdFollow
    ? await grantXp(req.user!.id, "FOLLOW_USER", { targetId: req.params.id, idempotencyKey: `follow:${req.user!.id}:${req.params.id}` })
    : undefined;
  sendOk(res, { following: true, xpGrant });
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
  let unfollowed = false;
  session.startTransaction();
  try {
    const deleted = await Follow.findOneAndDelete({ followerId: req.user!.id, followingId: req.params.id }).session(session);
    unfollowed = Boolean(deleted);
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
  if (unfollowed) {
    const unfollower = await User.findById(req.user!.id).select("name").lean();
    await Promise.resolve(createNotification(req.params.id, "FOLLOW", "A follower left", `${unfollower?.name ?? "Someone"} unfollowed you`, { userId: req.user!.id, action: "UNFOLLOW" })).catch(() => undefined);
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
  if (req.params.id === req.user!.id) throw new HttpError(400, "You cannot block yourself", ErrorCode.VALIDATION);
  await blockBondPair(req.user!.id, req.params.id);
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
    .populate("hostId", "name username avatar avatarType avatarParts city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { rooms });
}));

usersRouter.get("/:id/followers", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const followers = await Follow.find({ followingId: req.params.id })
    .populate("followerId", "name username avatar avatarType avatarParts city followersCount activeCosmetics vipTier vipExpiresAt xp level levelTitle")
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
    .populate("followingId", "name username avatar avatarType avatarParts city followersCount activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  const users = following.map(f => f.followingId).filter(Boolean);
  sendOk(res, { following: users, users });
}));

usersRouter.get("/:id/friends", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const rows = await Friendship.find({ status: "ACCEPTED", $or: [{ userId: req.params.id }, { friendId: req.params.id }] })
    .populate("userId", "name username avatar avatarType avatarParts city followersCount activeCosmetics vipTier vipLevel vipExp vipExpiresAt xp level levelTitle")
    .populate("friendId", "name username avatar avatarType avatarParts city followersCount activeCosmetics vipTier vipLevel vipExp vipExpiresAt xp level levelTitle")
    .sort({ updatedAt: -1 }).limit(100).lean();
  const friends = rows.map((row: any) => String(row.userId?._id ?? row.userId) === req.params.id ? row.friendId : row.userId).filter(Boolean);
  sendOk(res, { users: friends });
}));

usersRouter.get("/:id/visitors", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  if (req.params.id !== req.user!.id) throw new HttpError(403, "You can only view your own visitors", ErrorCode.FORBIDDEN);
  if (!getVipStatus(req.user).isVip) throw new HttpError(403, "All Visitors is a VIP benefit", ErrorCode.FORBIDDEN);
  const visits = await ProfileVisit.find({ profileId: req.params.id })
    .populate("visitorId", "name username avatar avatarType avatarParts city followersCount activeCosmetics vipTier vipLevel vipExp vipExpiresAt xp level levelTitle")
    .sort({ lastVisitedAt: -1 }).limit(100).lean();
  sendOk(res, { users: visits.map((visit: any) => ({ ...visit.visitorId, visitedAt: visit.lastVisitedAt })).filter((user: any) => user.id || user._id) });
}));

usersRouter.get("/:id/stats", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const roomCount = await Room.countDocuments({ hostId: req.params.id });
  const liveCount = await Room.countDocuments({ hostId: req.params.id, status: "LIVE" });
  sendOk(res, { roomsHosted: roomCount, roomsLive: liveCount });
}));
