import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { miniGameIds, miniGames } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { MiniGameScore } from "../models/MiniGameScore.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { grantXp } from "../services/levels.js";

export const gamesRouter = Router();
gamesRouter.use(requireAuth);

const scoreSchema = z.object({
  gameId: z.enum(miniGameIds),
  score: z.number().int().min(0).max(999999),
  durationMs: z.number().int().min(0).max(300000).optional(),
  rounds: z.number().int().min(0).max(1000).optional(),
  metadata: z.record(z.unknown()).optional()
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

gamesRouter.get("/leaderboard", asyncHandler(async (req: AuthRequest, res) => {
  const gameId = miniGameIds.includes(String(req.query.gameId) as any) ? String(req.query.gameId) : miniGameIds[0];
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
