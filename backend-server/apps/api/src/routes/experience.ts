import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Block } from "../models/Block.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Notification } from "../models/Notification.js";
import { Room } from "../models/Room.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { User } from "../models/User.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { getLevelStatus } from "../services/levels.js";
import { creditWallet } from "../services/wallet.js";
import { getVipStatus } from "../services/vip.js";
import { creatorCoinsToInr } from "../services/withdrawal.js";

export const experienceRouter = Router();
experienceRouter.use(requireAuth);

const notificationPreferenceSchema = z.object({
  roomInvites: z.boolean().default(true),
  messages: z.boolean().default(true),
  gifts: z.boolean().default(true),
  follows: z.boolean().default(true),
  hostGoingLive: z.boolean().default(true),
  wallet: z.boolean().default(true),
  safety: z.boolean().default(true),
  marketing: z.boolean().default(false)
});

const defaultNotificationPreferences = {
  roomInvites: true,
  messages: true,
  gifts: true,
  follows: true,
  hostGoingLive: true,
  wallet: true,
  safety: true,
  marketing: false
};

const achievements = [
  { id: "profile_complete", title: "Profile Spark", description: "Complete your profile", target: 1, rewardCoins: 25, rewardCosmetic: "frame_minimal" },
  { id: "daily_streak_3", title: "Three Day Rhythm", description: "Check in for 3 days", target: 3, rewardCoins: 50, rewardCosmetic: "mood_chill" },
  { id: "follow_10", title: "Circle Builder", description: "Follow 10 creators", target: 10, rewardCoins: 75 },
  { id: "host_3", title: "Room Starter", description: "Host 3 rooms", target: 3, rewardCoins: 100, rewardCosmetic: "badge_early_host" },
  { id: "gift_5", title: "Gift Spark", description: "Send 5 gifts", target: 5, rewardCoins: 120 },
  { id: "chat_25", title: "Conversation Flow", description: "Send 25 chat messages", target: 25, rewardCoins: 80 },
  { id: "level_5", title: "Yugm Star", description: "Reach level 5", target: 5, rewardCoins: 150, rewardCosmetic: "name_neon_glow" }
];

function publicUser(user: any) {
  if (!user) return null;
  const levelStatus = getLevelStatus(user);
  return {
    id: user._id?.toString?.() ?? user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    city: user.city,
    interests: user.interests ?? [],
    followersCount: user.followersCount ?? 0,
    followingCount: user.followingCount ?? 0,
    activeCosmetics: user.activeCosmetics ?? {},
    level: levelStatus.level,
    levelTitle: levelStatus.title,
    levelStatus,
    ...getVipStatus(user)
  };
}

function profileCompletion(user: any) {
  const checks = [
    { id: "name", label: "Name", done: Boolean(user?.name) },
    { id: "username", label: "Username", done: Boolean(user?.username) },
    { id: "avatar", label: "Avatar", done: Boolean(user?.avatar) },
    { id: "bio", label: "Bio", done: Boolean(user?.bio) },
    { id: "city", label: "City", done: Boolean(user?.city) },
    { id: "interests", label: "Interests", done: (user?.interests?.length ?? 0) >= 3 },
    { id: "languages", label: "Languages", done: (user?.languages?.length ?? 0) > 0 }
  ];
  const completed = checks.filter((item) => item.done).length;
  return { checks, completed, total: checks.length, percent: Math.round((completed / checks.length) * 100) };
}

function streakEstimate(user: any) {
  if (!user?.lastDailyCheckInAt) return 0;
  const last = new Date(user.lastDailyCheckInAt);
  const ageHours = (Date.now() - last.getTime()) / 36e5;
  return ageHours <= 30 ? 1 : 0;
}

async function blockedIdsFor(userId: string) {
  const rows = await Block.find({
    $or: [{ blockerId: userId }, { blockedUserId: userId }]
  }).lean();
  return rows.map((row) => row.blockerId.toString() === userId ? row.blockedUserId : row.blockerId);
}

async function buildAchievements(userId: string, user: any) {
  const [followingCount, hostedRooms, sentGifts, chatMessages] = await Promise.all([
    Follow.countDocuments({ followerId: userId }),
    Room.countDocuments({ hostId: userId }),
    GiftTransaction.countDocuments({ senderId: userId }),
    ChatMessage.countDocuments({ senderId: userId })
  ]);
  const progress: Record<string, number> = {
    profile_complete: profileCompletion(user).percent >= 100 ? 1 : 0,
    daily_streak_3: streakEstimate(user),
    follow_10: followingCount,
    host_3: hostedRooms,
    gift_5: sentGifts,
    chat_25: chatMessages,
    level_5: getLevelStatus(user).level
  };
  return achievements.map((achievement) => {
    const value = progress[achievement.id] ?? 0;
    return {
      ...achievement,
      progress: Math.min(value, achievement.target),
      complete: value >= achievement.target
    };
  });
}

experienceRouter.get("/home", asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const user = await User.findById(userId).lean();
  const hiddenIds = await blockedIdsFor(userId);
  const followingRows = await Follow.find({ followerId: userId }).lean();
  const followingIds = followingRows.map((row) => row.followingId);

  const [
    recommendedRooms,
    scheduledRooms,
    socialRooms,
    suggestedHosts,
    notifications,
    unreadCount,
    achievementsList,
    invites
  ] = await Promise.all([
    Room.find({ status: "LIVE", visibility: "PUBLIC" })
      .populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .sort({ participantCount: -1, createdAt: -1 })
      .limit(8)
      .lean(),
    Room.find({ status: "SCHEDULED", visibility: "PUBLIC" })
      .populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .sort({ scheduledFor: 1 })
      .limit(6)
      .lean(),
    Room.find({ status: "LIVE", visibility: "PUBLIC", hostId: { $in: followingIds } })
      .populate("hostId", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .sort({ participantCount: -1, createdAt: -1 })
      .limit(6)
      .lean(),
    User.find({ _id: { $nin: [userId, ...followingIds, ...hiddenIds] }, isBlocked: { $ne: true } })
      .select("name username avatar city followersCount interests activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .sort({ vipExpiresAt: -1, level: -1, followersCount: -1, createdAt: -1 })
      .limit(8)
      .lean(),
    Notification.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
    Notification.countDocuments({ userId, read: false }),
    buildAchievements(userId, user),
    RoomInvite.find({ inviteeId: userId, status: "PENDING" }).populate("roomId inviterId").sort({ createdAt: -1 }).limit(5).lean()
  ]);

  sendOk(res, {
    user: publicUser(user),
    profileCompletion: profileCompletion(user),
    level: getLevelStatus(user),
    achievements: achievementsList,
    feed: [
      ...socialRooms.map((room) => ({ type: "FOLLOWING_LIVE", title: `${(room.hostId as { name?: string })?.name ?? "A host"} is live`, room })),
      ...recommendedRooms.map((room) => ({ type: "TRENDING_ROOM", title: room.title, room })),
      ...suggestedHosts.slice(0, 4).map((host) => ({ type: "SUGGESTED_HOST", title: `Meet ${host.name}`, user: publicUser(host) }))
    ].slice(0, 14),
    rooms: {
      live: recommendedRooms,
      scheduled: scheduledRooms,
      following: socialRooms
    },
    people: {
      suggestedHosts: suggestedHosts.map(publicUser)
    },
    notifications: { unreadCount, recent: notifications },
    invites,
    quickActions: [
      { id: "create_room", title: "Host a room", route: "/room/create" },
      { id: "check_in", title: "Daily check-in", route: "/(tabs)/profile" },
      { id: "earnings", title: "Creator dashboard", route: "/(tabs)/grow" },
      { id: "safety", title: "Safety center", route: "/(tabs)/grow" }
    ]
  });
}));

experienceRouter.get("/creator-dashboard", asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const hostedRoomIds = await Room.find({ hostId: userId, createdAt: { $gte: since } }).distinct("_id");
  const [giftIncome, rooms, hostedRooms, participantSummary, gifts, scheduledRooms, topSupporterRows] = await Promise.all([
    GiftTransaction.aggregate([
      { $match: { receiverId: req.user!._id, createdAt: { $gte: since } } },
      { $group: { _id: null, coins: { $sum: "$coinAmount" }, count: { $sum: 1 }, supporters: { $addToSet: "$senderId" } } }
    ]),
    Room.find({ hostId: userId, createdAt: { $gte: since } }).sort({ createdAt: -1 }).limit(10).lean(),
    Room.countDocuments({ hostId: userId, createdAt: { $gte: since } }),
    RoomParticipant.aggregate([
      { $match: { joinedAt: { $gte: since }, roomId: { $in: hostedRoomIds } } },
      { $group: { _id: null, visits: { $sum: 1 }, people: { $addToSet: "$userId" } } }
    ]),
    GiftTransaction.find({ receiverId: userId, createdAt: { $gte: since } }).populate("senderId", "name username avatar").populate("giftId", "name icon coinPrice").populate("roomId", "title").sort({ createdAt: -1 }).limit(8).lean(),
    Room.find({ hostId: userId, status: "SCHEDULED", scheduledFor: { $gte: new Date() } }).sort({ scheduledFor: 1 }).limit(8).lean(),
    GiftTransaction.aggregate([
      { $match: { receiverId: req.user!._id, createdAt: { $gte: since } } },
      { $group: { _id: "$senderId", coins: { $sum: "$coinAmount" }, gifts: { $sum: 1 } } },
      { $sort: { coins: -1 } },
      { $limit: 5 }
    ])
  ]);
  const giftSummary = giftIncome[0] ?? { coins: 0, count: 0, supporters: [] };
  const participantStats = participantSummary[0] ?? { visits: 0, people: [] };
  const supporterUsers = await User.find({ _id: { $in: topSupporterRows.map((row) => row._id) } }).select("name username avatar").lean();
  const supporterMap = new Map(supporterUsers.map((user) => [user._id.toString(), user]));
  const topSupporters = topSupporterRows.map((row) => ({ ...row, user: supporterMap.get(row._id.toString()) ?? null }));
  const nextSteps = [
    ...(scheduledRooms.length ? [] : ["Schedule one room for your strongest topic"]),
    ...(hostedRooms ? ["Invite followers before your next live room"] : ["Host your first room this month"]),
    ...(giftSummary.count ? ["Thank your top supporters after the room"] : ["Create a repeatable room format supporters recognize"]),
    "Pin a poll in the first five minutes"
  ].slice(0, 4);
  sendOk(res, {
    windowDays: 30,
    summary: {
      giftCoins: giftSummary.coins,
      giftCount: giftSummary.count,
      uniqueSupporters: giftSummary.supporters.length,
      hostedRooms,
      participants: participantStats.visits,
      uniqueParticipants: participantStats.people.length,
      averageParticipants: hostedRooms ? Math.round((participantStats.visits / hostedRooms) * 10) / 10 : 0,
      estimatedInr: creatorCoinsToInr(giftSummary.coins)
    },
    rooms,
    scheduledRooms,
    gifts,
    topSupporters,
    nextSteps
  });
}));

experienceRouter.get("/safety-center", asyncHandler(async (req: AuthRequest, res) => {
  const [blockedUsers, reportsSent, unreadSafety] = await Promise.all([
    Block.find({ blockerId: req.user!.id }).populate("blockedUserId", "name username avatar").sort({ createdAt: -1 }).limit(20).lean(),
    import("../models/Report.js").then(({ Report }) => Report.countDocuments({ reporterId: req.user!.id })),
    Notification.countDocuments({ userId: req.user!.id, type: "SYSTEM", read: false })
  ]);
  sendOk(res, {
    trust: {
      label: req.user!.isBlocked ? "Restricted" : req.user!.mutedUntil ? "Limited" : "Good standing",
      mutedUntil: req.user!.mutedUntil,
      suspendedUntil: req.user!.suspendedUntil,
      strikes: req.user!.moderationStrikes ?? 0
    },
    checklist: [
      { id: "block", title: "Block people who cross lines", done: blockedUsers.length > 0 },
      { id: "report", title: "Report unsafe behavior", done: reportsSent > 0 },
      { id: "privacy", title: "Keep personal info private", done: true },
      { id: "alerts", title: "Review safety alerts", done: unreadSafety === 0 }
    ],
    blockedUsers
  });
}));

experienceRouter.get("/notification-preferences", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id).select("notificationPreferences").lean();
  sendOk(res, { preferences: { ...defaultNotificationPreferences, ...(user?.notificationPreferences ?? {}) } });
}));

experienceRouter.put("/notification-preferences", validateBody(notificationPreferenceSchema.partial()), asyncHandler(async (req: AuthRequest, res) => {
  const current = { ...defaultNotificationPreferences, ...(req.user?.notificationPreferences ?? {}) };
  const preferences = { ...current, ...req.body };
  await User.findByIdAndUpdate(req.user!.id, { $set: { notificationPreferences: preferences } });
  sendOk(res, { preferences });
}));

experienceRouter.post("/achievements/claim", asyncHandler(async (req: AuthRequest, res) => {
  const { achievementId } = z.object({ achievementId: z.string().min(1) }).parse(req.body);
  const user = await User.findById(req.user!.id).select("ownedCosmeticIds walletBalance").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const claimed = req.user?.claimedAchievementIds ?? [];
  if (claimed.includes(achievementId)) throw new HttpError(409, "Achievement already claimed", ErrorCode.CONFLICT);
  const achievement = achievements.find((a) => a.id === achievementId);
  if (!achievement) throw new HttpError(404, "Achievement not found", ErrorCode.NOT_FOUND);
  const allAchievements = await buildAchievements(req.user!.id, req.user);
  const entry = allAchievements.find((a) => a.id === achievementId);
  if (!entry?.complete) throw new HttpError(400, "Achievement not yet completed", ErrorCode.VALIDATION);
  const update: Record<string, unknown> = { $push: { claimedAchievementIds: achievementId } };
  if (achievement.rewardCosmetic && !user.ownedCosmeticIds.includes(achievement.rewardCosmetic)) {
    update.$push = { ownedCosmeticIds: achievement.rewardCosmetic };
  }
  if (achievement.rewardCoins > 0) {
    await creditWallet(req.user!.id, achievement.rewardCoins, "LEVEL_REWARD", { achievementId });
  }
  await User.findByIdAndUpdate(req.user!.id, update);
  sendOk(res, { claimed: true, rewardCoins: achievement.rewardCoins, rewardCosmetic: achievement.rewardCosmetic });
}));
