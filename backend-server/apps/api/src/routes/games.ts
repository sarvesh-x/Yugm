import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { miniGameIds, miniGames } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { Block } from "../models/Block.js";
import { Clan } from "../models/Clan.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { MiniGameChallenge } from "../models/MiniGameChallenge.js";
import { MiniGameScore } from "../models/MiniGameScore.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notifications.js";
import { emitUser } from "../services/socket.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText, sendOk } from "../utils/http.js";
import { grantXp } from "../services/levels.js";
import { socketEvents } from "@yugm/shared";

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

const scoreSchema = z.object({
  gameId: z.enum(miniGameIds),
  score: z.number().int().min(0).max(999999),
  durationMs: z.number().int().min(0).max(300000).optional(),
  rounds: z.number().int().min(0).max(1000).optional(),
  metadata: z.record(z.unknown()).optional()
});
const challengeSchema = z.object({
  gameId: z.enum(miniGameIds),
  score: z.number().int().min(0).max(999999),
  scoreId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  clanId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  message: z.string().max(180).optional()
}).refine((value) => Boolean(value.targetUserId) !== Boolean(value.clanId), "Challenge either a user or a clan");
const shareScoreSchema = z.object({
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/)
});

const maxScores: Record<(typeof miniGameIds)[number], number> = {
  vibe_tap: 6000,
  memory_match: 1200,
  reflex_ring: 1000
};

async function bestScoresForUser(userId: string) {
  const rows = await MiniGameScore.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId) } },
    { $sort: { score: -1, createdAt: 1 } },
    { $group: { _id: "$gameId", score: { $first: "$score" }, createdAt: { $first: "$createdAt" } } }
  ]);
  return Object.fromEntries(rows.map((row) => [row._id, { score: row.score, createdAt: row.createdAt }]));
}

function startOfUtcDay(date = new Date()) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function gameTitle(gameId: string) {
  return miniGames.find((game) => game.id === gameId)?.title ?? "Mini Game";
}

async function assertCanMessage(userId: string, targetUserId: string) {
  if (userId === targetUserId) throw new HttpError(400, "Choose someone else", ErrorCode.VALIDATION);
  const target = await User.findById(targetUserId).select("_id name").lean();
  if (!target) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const blocked = await Block.exists({
    $or: [
      { blockerId: userId, blockedUserId: targetUserId },
      { blockerId: targetUserId, blockedUserId: userId }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot interact with this user", ErrorCode.FORBIDDEN);
  return target;
}

function challengePayload(challenge: any) {
  return {
    _id: challenge._id?.toString?.() ?? challenge.id,
    gameId: challenge.gameId,
    score: challenge.score,
    message: challenge.message,
    expiresAt: challenge.expiresAt,
    createdAt: challenge.createdAt,
    challenger: challenge.challengerId,
    targetUser: challenge.targetUserId,
    clan: challenge.clanId
  };
}

gamesRouter.get("/catalog", asyncHandler(async (req: AuthRequest, res) => {
  const bestScores = await bestScoresForUser(req.user!.id);
  const recent = await MiniGameScore.find({ userId: req.user!.id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  sendOk(res, {
    games: miniGames.map((game) => ({ ...game, best: bestScores[game.id] ?? null })),
    recent
  });
}));

gamesRouter.get("/missions", asyncHandler(async (req: AuthRequest, res) => {
  const today = startOfUtcDay();
  const [scoresToday, bestToday, challengesToday] = await Promise.all([
    MiniGameScore.countDocuments({ userId: req.user!.id, createdAt: { $gte: today } }),
    MiniGameScore.findOne({ userId: req.user!.id, createdAt: { $gte: today } }).sort({ score: -1 }).lean(),
    MiniGameChallenge.countDocuments({ challengerId: req.user!.id, createdAt: { $gte: today } })
  ]);
  const missions = [
    { id: "play_3", title: "Play 3 arcade rounds", progress: Math.min(scoresToday, 3), target: 3, rewardXp: 12, complete: scoresToday >= 3 },
    { id: "score_500", title: "Score 500+ in any game", progress: Math.min(bestToday?.score ?? 0, 500), target: 500, rewardXp: 10, complete: (bestToday?.score ?? 0) >= 500 },
    { id: "send_challenge", title: "Challenge a friend or clan", progress: Math.min(challengesToday, 1), target: 1, rewardXp: 8, complete: challengesToday >= 1 }
  ];
  sendOk(res, { date: today, missions });
}));

gamesRouter.get("/leaderboard", asyncHandler(async (req: AuthRequest, res) => {
  const gameId = (miniGameIds as readonly string[]).includes(String(req.query.gameId)) ? String(req.query.gameId) : miniGameIds[0];
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const leaderboard = await MiniGameScore.aggregate([
    { $match: { gameId } },
    { $sort: { score: -1, createdAt: 1 } },
    { $group: { _id: "$userId", score: { $first: "$score" }, createdAt: { $first: "$createdAt" } } },
    { $limit: limit },
    {
      $lookup: {
        from: "users",
        localField: "_id",
        foreignField: "_id",
        as: "user"
      }
    },
    { $unwind: "$user" },
    {
      $project: {
        _id: 0,
        userId: "$_id",
        score: 1,
        createdAt: 1,
        user: {
          _id: "$user._id",
          name: "$user.name",
          username: "$user.username",
          avatar: "$user.avatar",
          level: "$user.level",
          levelTitle: "$user.levelTitle"
        }
      }
    }
  ]);
  const personalBest = await MiniGameScore.findOne({ userId: req.user!.id, gameId }).sort({ score: -1, createdAt: 1 }).lean();
  sendOk(res, { gameId, leaderboard, personalBest });
}));

gamesRouter.get("/challenges", asyncHandler(async (req: AuthRequest, res) => {
  const myClan = await Clan.findOne({ memberIds: req.user!.id }).select("_id").lean();
  const clanId = myClan?._id;
  const [incoming, outgoing, clan] = await Promise.all([
    MiniGameChallenge.find({ targetUserId: req.user!.id, expiresAt: { $gt: new Date() } })
      .populate("challengerId", "name username avatar level levelTitle")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    MiniGameChallenge.find({ challengerId: req.user!.id })
      .populate("targetUserId", "name username avatar level levelTitle")
      .populate("clanId", "name slug avatar familyLabel")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    clanId
      ? MiniGameChallenge.find({ clanId, expiresAt: { $gt: new Date() } })
        .populate("challengerId", "name username avatar level levelTitle")
        .populate("clanId", "name slug avatar familyLabel")
        .sort({ createdAt: -1 })
        .limit(20)
        .lean()
      : []
  ]);
  sendOk(res, {
    incoming: incoming.map(challengePayload),
    outgoing: outgoing.map(challengePayload),
    clan: clan.map(challengePayload)
  });
}));

gamesRouter.post("/scores", chatLimiter, validateBody(scoreSchema), asyncHandler(async (req: AuthRequest, res) => {
  const gameId = req.body.gameId as keyof typeof maxScores;
  if (req.body.score > maxScores[gameId]) {
    throw new HttpError(400, "Score is outside the valid range for this game", ErrorCode.VALIDATION);
  }
  const previousBest = await MiniGameScore.findOne({ userId: req.user!.id, gameId }).sort({ score: -1 }).lean();
  const score = await MiniGameScore.create({
    userId: req.user!.id,
    gameId,
    score: req.body.score,
    durationMs: req.body.durationMs,
    rounds: req.body.rounds,
    metadata: req.body.metadata ?? {}
  });
  const isPersonalBest = !previousBest || score.score > previousBest.score;
  const reward = await grantXp(req.user!.id, "MINI_GAME_PLAY", { gameId, score: score.score });
  sendOk(res, {
    score,
    isPersonalBest,
    personalBest: isPersonalBest ? score : previousBest,
    reward
  }, 201);
}));

gamesRouter.post("/challenges", chatLimiter, validateBody(challengeSchema), asyncHandler(async (req: AuthRequest, res) => {
  const gameId = req.body.gameId as keyof typeof maxScores;
  if (req.body.score > maxScores[gameId]) {
    throw new HttpError(400, "Score is outside the valid range for this game", ErrorCode.VALIDATION);
  }
  if (req.body.scoreId) {
    const score = await MiniGameScore.findOne({ _id: req.body.scoreId, userId: req.user!.id, gameId }).select("_id").lean();
    if (!score) throw new HttpError(404, "Score not found", ErrorCode.NOT_FOUND);
  }
  const expiresAt = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
  let memberIds: string[] = [];
  if (req.body.targetUserId) {
    await assertCanMessage(req.user!.id, req.body.targetUserId);
    memberIds = [req.body.targetUserId];
  }
  if (req.body.clanId) {
    const clan = await Clan.findOne({ _id: req.body.clanId, memberIds: req.user!.id }).select("memberIds name").lean();
    if (!clan) throw new HttpError(403, "Join this clan to send challenges", ErrorCode.FORBIDDEN);
    memberIds = (clan.memberIds ?? []).map((memberId: any) => memberId.toString()).filter((memberId: string) => memberId !== req.user!.id);
  }
  const challenge = await MiniGameChallenge.create({
    challengerId: req.user!.id,
    targetUserId: req.body.targetUserId,
    clanId: req.body.clanId,
    gameId,
    score: req.body.score,
    scoreId: req.body.scoreId,
    message: req.body.message ? sanitizeText(req.body.message) : undefined,
    expiresAt
  });
  await Promise.all(memberIds.slice(0, 50).map((memberId) =>
    createNotification(
      memberId,
      "SYSTEM",
      "Arcade challenge",
      `${req.user!.name} challenged you to beat ${req.body.score} in ${gameTitle(gameId)}`,
      { gameId, challengeId: challenge._id.toString(), userId: req.user!.id, clanId: req.body.clanId }
    )
  ));
  sendOk(res, { challenge }, 201);
}));

gamesRouter.post("/challenges/:challengeId/accept", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.challengeId)) throw new HttpError(400, "Invalid challenge ID", ErrorCode.VALIDATION);
  const challenge = await MiniGameChallenge.findById(req.params.challengeId);
  if (!challenge) throw new HttpError(404, "Challenge not found", ErrorCode.NOT_FOUND);
  if (!challenge.targetUserId || challenge.targetUserId.toString() !== req.user!.id) throw new HttpError(403, "This challenge is not for you", ErrorCode.FORBIDDEN);

  const text = `Challenge accepted! I beat your score of ${challenge.score} in ${gameTitle(challenge.gameId)}.`;
  await DirectMessage.create({
    senderId: req.user!.id,
    receiverId: challenge.challengerId,
    message: text
  });
  const gameId = challenge.gameId;
  const score = challenge.score;
  const challengerId = challenge.challengerId.toString();
  await MiniGameChallenge.findByIdAndDelete(req.params.challengeId);

  sendOk(res, { accepted: true, gameId, score, challengerId });
}));

gamesRouter.post("/challenges/:challengeId/decline", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.challengeId)) throw new HttpError(400, "Invalid challenge ID", ErrorCode.VALIDATION);
  const challenge = await MiniGameChallenge.findById(req.params.challengeId);
  if (!challenge) throw new HttpError(404, "Challenge not found", ErrorCode.NOT_FOUND);
  if (!challenge.targetUserId || challenge.targetUserId.toString() !== req.user!.id) throw new HttpError(403, "This challenge is not for you", ErrorCode.FORBIDDEN);

  await MiniGameChallenge.findByIdAndDelete(req.params.challengeId);
  sendOk(res, { declined: true });
}));

gamesRouter.post("/scores/:scoreId/share", chatLimiter, validateBody(shareScoreSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.scoreId)) throw new HttpError(400, "Invalid score ID", ErrorCode.VALIDATION);
  await assertCanMessage(req.user!.id, req.body.targetUserId);
  const score = await MiniGameScore.findOne({ _id: req.params.scoreId, userId: req.user!.id }).lean();
  if (!score) throw new HttpError(404, "Score not found", ErrorCode.NOT_FOUND);
  const text = `Arcade score: ${score.score} in ${gameTitle(score.gameId)}. Can you beat it?`;
  const created = await DirectMessage.create({
    senderId: req.user!.id,
    receiverId: req.body.targetUserId,
    message: text
  });
  const message = await DirectMessage.findById(created._id)
    .populate("senderId receiverId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();
  emitUser(req.body.targetUserId, socketEvents.directMessageNew, { message, partnerId: req.user!.id });
  emitUser(req.user!.id, socketEvents.directMessageNew, { message, partnerId: req.body.targetUserId });
  await createNotification(req.body.targetUserId, "MESSAGE", "Arcade score shared", `${req.user!.name}: ${text}`, { partnerId: req.user!.id, gameId: score.gameId, scoreId: score._id.toString() });
  sendOk(res, { message });
}));
