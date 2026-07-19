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
