import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Achievement } from "../models/Achievement.js";
import { Block } from "../models/Block.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Notification } from "../models/Notification.js";
import { Room } from "../models/Room.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { MiniGameScore } from "../models/MiniGameScore.js";
import { User, type IUser } from "../models/User.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { getLevelStatus } from "../services/levels.js";
import { creditWallet } from "../services/wallet.js";
import { getVipStatus } from "../services/vip.js";
import { creatorCoinsToInr } from "../services/withdrawal.js";
import { createNotification } from "../services/notifications.js";
import { badgeCatalog, currentHonors, maxWornBadges, syncBadgeState, wornBadges } from "../services/badges.js";

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

function streakEstimate(user: any, streakCount: number) {
  if (!user?.lastDailyCheckInAt) return 0;
  const last = new Date(user.lastDailyCheckInAt);
  const today = new Date();
  const lastUtcDay = Date.UTC(last.getUTCFullYear(), last.getUTCMonth(), last.getUTCDate());
  const todayUtcDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const dayGap = Math.floor((todayUtcDay - lastUtcDay) / 86400000);
  return dayGap <= 1 ? streakCount : 0;
}

async function blockedIdsFor(userId: string) {
  const rows = await Block.find({
    $or: [{ blockerId: userId }, { blockedUserId: userId }]
  }).lean();
  return rows.map((row) => row.blockerId.toString() === userId ? row.blockedUserId : row.blockerId);
}

function computeProgress(achievement: any, user: any, followingCount: number, hostedRooms: number, sentGifts: number, chatMessages: number, streak: number, joinedRooms: number, gamesPlayed: number, receivedGifts: number) {
  const raw: Record<string, number> = {
    profile_complete: profileCompletion(user).percent,
    daily_streak_3: streak,
    follow_10: followingCount,
    host_3: hostedRooms,
    gift_5: sentGifts,
    chat_25: chatMessages,
    level_5: getLevelStatus(user).level,
    room_join_10: joinedRooms,
    game_plays_10: gamesPlayed,
    gift_received_5: receivedGifts
  };
  return raw[achievement.metric ?? achievement.id] ?? 0;
}

function buildTierInfo(achievement: any, currentProgress: number, claimedTiers: Set<string>) {
  const activeTier = achievement.tiers.slice().reverse().find((t: any) => currentProgress >= t.target) ?? null;
  const nextTierData = achievement.tiers.find((t: any) => !claimedTiers.has(`${achievement.id}:${t.tier}`)) ?? null;

  const tiers = achievement.tiers.map((t: any) => ({
    tier: t.tier,
    target: t.target,
    rewardCoins: t.rewardCoins,
    rewardCosmetic: t.rewardCosmetic,
    reached: currentProgress >= t.target,
    claimed: claimedTiers.has(`${achievement.id}:${t.tier}`)
  }));

  let highestClaimedTier: string | null = null;
  for (const t of achievement.tiers) {
    if (claimedTiers.has(`${achievement.id}:${t.tier}`)) {
      highestClaimedTier = t.tier;
    }
  }

  const allTiersClaimed = achievement.tiers.every((t: any) => claimedTiers.has(`${achievement.id}:${t.tier}`));
  const canClaim = nextTierData !== null && currentProgress >= nextTierData.target;
  const canUpgrade = activeTier !== null && canClaim;

  return {
    progress: Math.min(currentProgress, nextTierData?.target ?? activeTier?.target ?? 0),
    total: nextTierData?.target ?? (activeTier?.target ?? 0),
    currentTier: activeTier?.tier ?? null,
    highestClaimedTier,
    tiers,
    nextTier: nextTierData?.tier ?? null,
    canClaim,
    canUpgrade,
    complete: allTiersClaimed
  };
}

async function buildAchievements(userId: string, user: any, catalog = badgeCatalog()) {
  const [followingCount, hostedRooms, sentGifts, chatMessages, joinedRooms, gamesPlayed, receivedGifts, allAchievements] = await Promise.all([
    Follow.countDocuments({ followerId: userId }),
    Room.countDocuments({ hostId: userId }),
    GiftTransaction.countDocuments({ senderId: userId }),
    ChatMessage.countDocuments({ senderId: userId }),
    RoomParticipant.distinct("roomId", { userId }),
    MiniGameScore.countDocuments({ userId }),
    GiftTransaction.countDocuments({ receiverId: userId }),
    catalog
  ]);

  const streak = streakEstimate(user, user?.streakCount ?? 0);
  const rawTiers: Array<{ achievementId: string; tier: string }> = user?.claimedAchievementTiers ?? [];
  const claimedTiers = new Set<string>(rawTiers.map((ct) => `${ct.achievementId}:${ct.tier}`));

  return allAchievements.filter(achievement => achievement.kind !== "HONOR").map((achievement) => {
    const progress = computeProgress(achievement, user, followingCount, hostedRooms, sentGifts, chatMessages, streak, joinedRooms.length, gamesPlayed, receivedGifts);
    const tierInfo = buildTierInfo(achievement, progress, claimedTiers);
    return {
      id: achievement.id,
      title: achievement.title,
      description: achievement.description,
      category: achievement.category,
      icon: achievement.icon,
      order: achievement.order,
      progress: tierInfo.progress,
      total: tierInfo.total,
      currentTier: tierInfo.currentTier,
      highestClaimedTier: tierInfo.highestClaimedTier,
      tiers: tierInfo.tiers,
      nextTier: tierInfo.nextTier,
      canClaim: tierInfo.canClaim,
      canUpgrade: tierInfo.canUpgrade,
      complete: tierInfo.complete
    };
  });
}

async function loadBadgeGallery(userId: string, user: Pick<IUser, "name" | "avatar"> | null) {
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const now = new Date();
  const catalog = badgeCatalog();
  const [achievements, definitions] = await Promise.all([buildAchievements(userId, user, catalog), catalog]);
  const earned = achievements.flatMap(item => item.currentTier ? [{ badgeId: item.id, tier: item.currentTier, earnedAt: now }] : []);
  const honors = await currentHonors(userId, definitions, now);
  const state = await syncBadgeState(userId, definitions, [...earned, ...honors], now);
  const progress = new Map(achievements.map(item => [item.id, item]));
  return {
    user: { name: user.name, avatar: user.avatar },
    wornIds: state.wornIds,
    badges: state.badges.map(badge => ({ ...progress.get(badge.id), ...badge }))
  };
}

experienceRouter.get("/home", asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const user = await User.findById(userId).lean();
  const hiddenIds = await blockedIdsFor(userId);
  const followingRows = await Follow.find({ followerId: userId }).lean();
  const followingIds = followingRows.map((row) => row.followingId);
  const catalog = badgeCatalog();

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
    buildAchievements(userId, user, catalog),
    RoomInvite.find({ inviteeId: userId, status: "PENDING" })
      .populate("roomId", "title type status hostId")
      .populate("inviterId", "name username avatar")
      .sort({ createdAt: -1 })
      .limit(5)
      .lean()
  ]);

  const now = new Date();
  const earned = achievementsList.flatMap(item => item.currentTier ? [{ badgeId: item.id, tier: item.currentTier, earnedAt: now }] : []);
  if (user && earned.length) void syncBadgeState(userId, await catalog, earned, now).catch(() => undefined);

  sendOk(res, {
    schemaVersion: 1,
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
  const user = await User.findById(req.user!.id).lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const achievement = await Achievement.findOne({ id: achievementId, hidden: { $ne: true }, kind: { $ne: "HONOR" } }).lean();
  if (!achievement) throw new HttpError(404, "Achievement not found", ErrorCode.NOT_FOUND);

  const allAchievements = await buildAchievements(req.user!.id, user);
  const entry = allAchievements.find((a) => a.id === achievementId);
  if (!entry) throw new HttpError(404, "Achievement not found", ErrorCode.NOT_FOUND);

  const nextTierToClaim = achievement.tiers.find(
    (t) => !user.claimedAchievementTiers?.some((ct: { achievementId: string; tier: string }) => ct.achievementId === achievementId && ct.tier === t.tier)
  );
  if (!nextTierToClaim) throw new HttpError(409, "All tiers already claimed", ErrorCode.CONFLICT);
  if (entry.progress < nextTierToClaim.target) throw new HttpError(400, `Reach ${nextTierToClaim.target} to unlock ${nextTierToClaim.tier}`, ErrorCode.VALIDATION);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const claimed = await User.findOneAndUpdate(
      {
        _id: req.user!.id,
        claimedAchievementTiers: { $not: { $elemMatch: { achievementId, tier: nextTierToClaim.tier } } }
      },
      {
        $addToSet: {
          claimedAchievementIds: achievementId,
          claimedAchievementTiers: { achievementId, tier: nextTierToClaim.tier, claimedAt: new Date() },
          ...(nextTierToClaim.rewardCosmetic ? { ownedCosmeticIds: nextTierToClaim.rewardCosmetic } : {})
        }
      },
      { new: true, session }
    );
    if (!claimed) throw new HttpError(409, "This achievement tier has already been claimed", ErrorCode.CONFLICT);
    if (nextTierToClaim.rewardCoins > 0) {
      await creditWallet(req.user!.id, nextTierToClaim.rewardCoins, "LEVEL_REWARD", { achievementId, tier: nextTierToClaim.tier }, session);
    }
    await session.commitTransaction();
  } catch (error) {
    await session.abortTransaction();
    throw error;
  } finally {
    await session.endSession();
  }
  void createNotification(req.user!.id, "SYSTEM", "Achievement unlocked", `${achievement.title} · ${nextTierToClaim.tier}`, { type: "ACHIEVEMENT_UNLOCKED", achievementId, tier: nextTierToClaim.tier }).catch(() => undefined);
  sendOk(res, { claimed: true, tier: nextTierToClaim.tier, rewardCoins: nextTierToClaim.rewardCoins, rewardCosmetic: nextTierToClaim.rewardCosmetic });
}));

experienceRouter.get("/achievements", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id).lean();
  const achievementsList = await buildAchievements(req.user!.id, user);
  sendOk(res, { schemaVersion: 1, achievements: achievementsList });
}));

experienceRouter.get("/badges", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id).lean();
  sendOk(res, await loadBadgeGallery(req.user!.id, user));
}));

const showcasedBadgeSchema = z.object({
  badgeIds: z.array(z.string().min(1).max(64)).max(maxWornBadges)
    .refine(ids => new Set(ids).size === ids.length, "Choose different badges for each slot")
});

experienceRouter.put("/badges/showcase", validateBody(showcasedBadgeSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { badgeIds } = req.body as z.infer<typeof showcasedBadgeSchema>;
  const state = await syncBadgeState(req.user!.id, await badgeCatalog(), [], new Date(), badgeIds);
  sendOk(res, { badgeIds: state.wornIds });
}));

experienceRouter.get("/badges/showcase/:userId", asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  if (!mongoose.isValidObjectId(userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  if (userId === req.user!.id) {
    const gallery = await loadBadgeGallery(userId, await User.findById(userId).lean());
    const badges = new Map(gallery.badges.map(badge => [badge.id, badge]));
    sendOk(res, { badges: gallery.wornIds.map(id => badges.get(id)).filter(Boolean) });
    return;
  }
  const [user, definitions] = await Promise.all([
    User.findById(userId).select("badgeGrants showcasedBadgeIds claimedAchievementTiers claimedAchievementIds").lean(),
    badgeCatalog()
  ]);
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  sendOk(res, { badges: wornBadges(user, definitions) });
}));

experienceRouter.post("/achievements/:id/share", asyncHandler(async (req: AuthRequest, res) => {
  const achievement = await Achievement.findOne({ id: req.params.id, hidden: { $ne: true }, kind: { $ne: "HONOR" } }).lean();
  if (!achievement) throw new HttpError(404, "Achievement not found", ErrorCode.NOT_FOUND);

  const user = await User.findById(req.user!.id).select("claimedAchievementTiers name username").lean();
  const claimedTiers = user?.claimedAchievementTiers ?? [];
  const highestTier = achievement.tiers
    .slice()
    .reverse()
    .find((t) => claimedTiers.some((ct: { achievementId: string; tier: string }) => ct.achievementId === achievement.id && ct.tier === t.tier));
  if (!highestTier) throw new HttpError(403, "Claim this achievement before sharing it", ErrorCode.FORBIDDEN);

  const shareText = `🏆 I earned "${achievement.title}" (${highestTier.tier}) on Yugm!\n${achievement.description}\n\nMatch the vibe.`;

  sendOk(res, {
    shareText,
    achievement: {
      id: achievement.id,
      title: achievement.title,
      tier: highestTier.tier,
      icon: achievement.icon
    }
  });
}));
