import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { VibeGraph } from "../models/VibeGraph.js";
import { User } from "../models/User.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { validateBody } from "../middleware/validate.js";

export const vibeRouter = Router();
vibeRouter.use(requireAuth);

function computeVibeScore(
  a: { interests: string[]; languages: string[]; city: string },
  b: { interests: string[]; languages: string[]; city: string }
): number {
  let score = 50;

  const sharedInterests = a.interests.filter(i => b.interests.includes(i));
  const sharedLanguages = a.languages.filter(l => b.languages.includes(l));

  score += Math.min(sharedInterests.length * 8, 25);
  score += Math.min(sharedLanguages.length * 6, 15);
  if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) {
    score += 10;
  }

  return Math.min(Math.max(Math.round(score), 0), 100);
}

const updateSchema = z.object({
  interactionType: z.enum(["message", "room_join", "gift", "room_host", "story_reply"]),
  targetUserId: z.string().optional(),
});

vibeRouter.post("/vibe/init", asyncHandler(async (req: AuthRequest, res) => {
  const existing = await VibeGraph.findOne({ userId: req.user!.id });
  if (existing) {
    return sendOk(res, { vibe: existing });
  }

  const user = await User.findById(req.user!.id).select("interests languages city").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const vibe = await VibeGraph.create({
    userId: req.user!.id,
    interests: user.interests ?? [],
    languages: user.languages ?? [],
    city: user.city ?? "",
    vibeScore: 50,
    totalInteractions: 0,
    lastVibeUpdate: new Date(),
  });

  sendOk(res, { vibe }, 201);
}));

vibeRouter.post("/vibe/update", validateBody(updateSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { interactionType, targetUserId } = req.body;
  let vibe = await VibeGraph.findOne({ userId: req.user!.id });
  if (!vibe) {
    const user = await User.findById(req.user!.id).select("interests languages city").lean();
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    vibe = await VibeGraph.create({
      userId: req.user!.id,
      interests: user.interests ?? [],
      languages: user.languages ?? [],
      city: user.city ?? "",
      vibeScore: 50,
      totalInteractions: 0,
      lastVibeUpdate: new Date(),
    });
  }

  const points: Record<string, number> = {
    message: 2,
    room_join: 3,
    gift: 5,
    room_host: 4,
    story_reply: 2,
  };

  const gain = points[interactionType] ?? 1;
  vibe.vibeScore = Math.min(vibe.vibeScore + gain, 100);
  vibe.totalInteractions += 1;
  vibe.lastVibeUpdate = new Date();
  await vibe.save();

  if (targetUserId && isValidObjectId(targetUserId)) {
    const targetUser = await User.findById(targetUserId).select("interests languages city").lean();
    const currentUser = await User.findById(req.user!.id).select("interests languages city").lean();
    if (targetUser && currentUser) {
      const compatibility = computeVibeScore(
        { interests: currentUser.interests ?? [], languages: currentUser.languages ?? [], city: currentUser.city ?? "" },
        { interests: targetUser.interests ?? [], languages: targetUser.languages ?? [], city: targetUser.city ?? "" }
      );
    }
  }

  sendOk(res, {
    vibe,
    vibeChange: gain,
    improved: true,
    message: gain > 0 ? "Your vibe is getting stronger!" : undefined,
  });
}));

vibeRouter.get("/vibe/match/:userId", asyncHandler(async (req: AuthRequest, res) => {
  const { userId } = req.params;
  if (!isValidObjectId(userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);

  const [currentUser, targetUser] = await Promise.all([
    User.findById(req.user!.id).select("interests languages city").lean(),
    User.findById(userId).select("interests languages city name avatar username level levelTitle").lean(),
  ]);
  if (!currentUser) throw new HttpError(404, "Current user not found", ErrorCode.NOT_FOUND);
  if (!targetUser) throw new HttpError(404, "Target user not found", ErrorCode.NOT_FOUND);

  const score = computeVibeScore(
    { interests: currentUser.interests ?? [], languages: currentUser.languages ?? [], city: currentUser.city ?? "" },
    { interests: targetUser.interests ?? [], languages: targetUser.languages ?? [], city: targetUser.city ?? "" }
  );

  const currentVibe = await VibeGraph.findOne({ userId: req.user!.id });

  let label: string;
  if (score >= 85) label = "Soulmate Vibe";
  else if (score >= 70) label = "Perfect Match";
  else if (score >= 55) label = "Good Vibes";
  else if (score >= 40) label = "Getting There";
  else label = "New Connection";

  sendOk(res, {
    compatibility: {
      score,
      label,
      sharedInterests: currentUser.interests?.filter(i => targetUser.interests?.includes(i)) ?? [],
      sharedLanguages: currentUser.languages?.filter(l => targetUser.languages?.includes(l)) ?? [],
      sameCity: currentUser.city?.toLowerCase() === targetUser.city?.toLowerCase(),
    },
    vibe: currentVibe ? { score: currentVibe.vibeScore, totalInteractions: currentVibe.totalInteractions } : null,
    targetUser: {
      _id: targetUser._id.toString(),
      name: targetUser.name,
      avatar: targetUser.avatar,
      username: targetUser.username,
      level: targetUser.level,
      levelTitle: targetUser.levelTitle,
    },
  });
}));

// GET /vibe/matches — paginated list of top vibe matches for the current user
vibeRouter.get("/vibe/matches", asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));

  const currentUser = await User.findById(req.user!.id)
    .select("interests languages city")
    .lean();
  if (!currentUser) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  // Find users with at least one shared interest or language
  const candidateFilter: Record<string, unknown> = {
    _id: { $ne: req.user!.id },
    ...(currentUser.interests?.length ? { interests: { $in: currentUser.interests } } : {}),
  };

  const candidates = await User.find(candidateFilter)
    .select("_id name avatar username level levelTitle interests languages city")
    .limit(limit * 5) // oversample to sort by score
    .skip((page - 1) * limit * 5)
    .lean();

  const scored = candidates.map(candidate => {
    const score = computeVibeScore(
      { interests: currentUser.interests ?? [], languages: currentUser.languages ?? [], city: currentUser.city ?? "" },
      { interests: candidate.interests ?? [], languages: candidate.languages ?? [], city: candidate.city ?? "" }
    );
    return { user: candidate, scores: { overall: score, compatibility: score, interestSimilarity: score } };
  });

  scored.sort((a, b) => b.scores.overall - a.scores.overall);

  const matches = scored.slice(0, limit).map(({ user, scores }) => ({
    user: {
      _id: user._id.toString(),
      name: user.name,
      avatar: user.avatar,
      username: user.username,
      level: user.level ?? 1,
      levelTitle: user.levelTitle ?? "New Vibe"
    },
    scores
  }));

  sendOk(res, { matches });
}));

// GET /vibe/graph — return the current user's vibe graph
vibeRouter.get("/vibe/graph", asyncHandler(async (req: AuthRequest, res) => {
  const vibe = await VibeGraph.findOne({ userId: req.user!.id }).lean();
  sendOk(res, { vibeGraph: vibe ?? null });
}));

// GET /vibe/trend — return vibe score trend history
vibeRouter.get("/vibe/trend", asyncHandler(async (req: AuthRequest, res) => {
  const vibe = await VibeGraph.findOne({ userId: req.user!.id }).lean();
  if (!vibe) {
    return sendOk(res, { trend: "stable", history: [] });
  }

  // Build a synthetic 7-day history based on totalInteractions and current score
  const now = Date.now();
  const history = Array.from({ length: 7 }, (_, i) => {
    const daysAgo = 6 - i;
    const decayedScore = Math.max(0, Math.round((vibe as any).vibeScore - daysAgo * 2));
    return {
      score: decayedScore,
      date: new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10)
    };
  });

  const firstScore = history[0]?.score ?? 0;
  const lastScore = history[history.length - 1]?.score ?? 0;
  const trend = lastScore > firstScore + 5 ? "up" : lastScore < firstScore - 5 ? "down" : "stable";

  sendOk(res, { trend, history });
}));

// GET /vibe/dimensions — return named dimension breakdown
vibeRouter.get("/vibe/dimensions", asyncHandler(async (req: AuthRequest, res) => {
  const vibe = await VibeGraph.findOne({ userId: req.user!.id }).lean();
  const user = await User.findById(req.user!.id).select("interests languages city").lean();

  const baseScore = (vibe as any)?.vibeScore ?? 50;

  // Build dimensions from available user data + vibe score
  const dimensions = [
    { name: "Overall Vibe", score: baseScore, description: "Your overall vibe energy" },
    { name: "Conversation", score: Math.min(100, baseScore + 5), description: "How you connect in chat" },
    { name: "Humor", score: Math.min(100, baseScore - 3), description: "Your humor compatibility" },
    { name: "Energy", score: Math.min(100, baseScore + 8), description: "Your social energy level" },
    { name: "Music", score: user?.interests?.includes("music") ? Math.min(100, baseScore + 12) : baseScore - 5, description: "Music taste alignment" },
    { name: "Gaming", score: user?.interests?.includes("gaming") ? Math.min(100, baseScore + 10) : baseScore - 8, description: "Gaming interest match" },
    { name: "Language", score: (user?.languages?.length ?? 0) > 1 ? Math.min(100, baseScore + 6) : baseScore, description: "Language compatibility" },
    { name: "Late Night", score: Math.min(100, baseScore - 2), description: "Late-night conversation vibe" },
  ].map(d => ({ ...d, score: Math.max(0, Math.min(100, Math.round(d.score))) }));

  sendOk(res, { dimensions });
}));

// POST /vibe/preferences — update user's vibe preferences
vibeRouter.post("/vibe/preferences", asyncHandler(async (req: AuthRequest, res) => {
  const dimensions = req.body.dimensions ?? {};
  const vibe = await VibeGraph.findOneAndUpdate(
    { userId: req.user!.id },
    { $set: { preferences: dimensions, updatedAt: new Date() } },
    { new: true, upsert: true }
  ).lean();
  sendOk(res, { vibeGraph: vibe });
}));
