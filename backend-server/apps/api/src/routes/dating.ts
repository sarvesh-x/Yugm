import { Router } from "express";
import mongoose from "mongoose";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { Like } from "../models/Like.js";
import { Match } from "../models/Match.js";
import { Block } from "../models/Block.js";
import { User } from "../models/User.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { createNotification } from "../services/notifications.js";
import { getVipStatus } from "../services/vip.js";

export const datingRouter = Router();
datingRouter.use(requireAuth);

// Helper function to calculate compatibility score
function calculateVibeScore(userA: any, userB: any) {
  let score = 50; // Base score

  // Same city
  if (userA.city && userB.city && userA.city.toLowerCase() === userB.city.toLowerCase()) {
    score += 15;
  }

  // Shared languages
  if (userA.languages && userB.languages) {
    const commonLangs = userA.languages.filter((lang: string) => userB.languages.includes(lang));
    if (commonLangs.length > 0) {
      score += 10;
    }
  }

  // Shared interests
  if (userA.interests && userB.interests) {
    const commonInterests = userA.interests.filter((interest: string) => userB.interests.includes(interest));
    score += Math.min(commonInterests.length * 5, 25);
  }

  return Math.min(score, 100);
}

// 1. GET /dating/explore - Get profiles to swipe on
datingRouter.get("/explore", asyncHandler(async (req: AuthRequest, res) => {
  const currentUser = req.user!;
  
  // Find users current user has swiped on
  const swiped = await Like.find({ likerId: currentUser.id }).select("likedId").lean();
  const swipedIds = swiped.map(s => s.likedId.toString());

  // Find blocks
  const blocks = await Block.find({
    $or: [{ blockerId: currentUser.id }, { blockedUserId: currentUser.id }]
  }).lean();
  const blockedIds = blocks.map(b => 
    b.blockerId.toString() === currentUser.id ? b.blockedUserId.toString() : b.blockerId.toString()
  );

  const excludeIds = [currentUser.id, ...swipedIds, ...blockedIds];
  const excludeObjectIds = excludeIds.map(id => new mongoose.Types.ObjectId(id));

  // Fetch candidate users
  const candidates = await User.find({
    _id: { $nin: excludeObjectIds },
    isBlocked: { $ne: true }
  }).limit(40).lean();

  // Calculate vibe score for each candidate
  const formattedCandidates = candidates.map(candidate => {
    const vibeScore = calculateVibeScore(currentUser, candidate);
    return {
      id: candidate._id.toString(),
      _id: candidate._id.toString(),
      name: candidate.name,
      username: candidate.username,
      avatar: candidate.avatar,
      age: candidate.age,
      gender: candidate.gender,
      city: candidate.city,
      bio: candidate.bio,
      interests: candidate.interests,
      languages: candidate.languages,
      followersCount: candidate.followersCount,
      role: candidate.role,
      activeCosmetics: candidate.activeCosmetics,
      ...getVipStatus(candidate),
      vibeScore
    };
  });

  // Sort by vibeScore desc
  formattedCandidates.sort((a, b) => Number(b.isVip) - Number(a.isVip) || b.vibeScore - a.vibeScore);

  sendOk(res, { candidates: formattedCandidates });
}));

// 2. POST /dating/like - Swipe Like or Super Like a user
datingRouter.post("/like", asyncHandler(async (req: AuthRequest, res) => {
  const { likedId, type = "LIKE" } = req.body;
  if (!likedId || !isValidObjectId(likedId)) {
    throw new HttpError(400, "Invalid likedId", ErrorCode.VALIDATION);
  }

  const currentUser = req.user!;
  if (currentUser.id === likedId) {
    throw new HttpError(400, "You cannot like yourself", ErrorCode.VALIDATION);
  }

  // Check if like already exists
  const existingLike = await Like.findOne({ likerId: currentUser.id, likedId });
  if (existingLike) {
    throw new HttpError(400, "Already swiped on this user", ErrorCode.VALIDATION);
  }

  // Create Like
  const newLike = await Like.create({
    likerId: currentUser.id,
    likedId,
    type
  });

  // Check for mutual like (excluding PASS)
  const mutualLike = await Like.findOne({
    likerId: likedId,
    likedId: currentUser.id,
    type: { $in: ["LIKE", "SUPER_LIKE"] }
  });

  let isMatch = false;
  let match = null;

  if (mutualLike && (type === "LIKE" || type === "SUPER_LIKE")) {
    isMatch = true;
    
    // Check if Match document already exists (to prevent duplicates)
    const existingMatch = await Match.findOne({
      users: { $all: [currentUser.id, likedId] }
    });

    if (!existingMatch) {
      match = await Match.create({
        users: [currentUser.id, likedId]
      });

      // Send match notifications to both users
      const otherUser = await User.findById(likedId).select("name").lean();
      await createNotification(
        likedId,
        "SYSTEM",
        "It's a Yugm!",
        `You matched with ${currentUser.name}! Start chatting now.`,
        { type: "MATCH", matchId: match._id.toString(), partnerId: currentUser.id }
      );
      await createNotification(
        currentUser.id,
        "SYSTEM",
        "It's a Yugm!",
        `You matched with ${otherUser?.name || "someone"}! Start chatting now.`,
        { type: "MATCH", matchId: match._id.toString(), partnerId: likedId }
      );
    }
  }

  sendOk(res, { like: newLike, isMatch, match });
}));

// 3. POST /dating/pass - Swipe Pass a user
datingRouter.post("/pass", asyncHandler(async (req: AuthRequest, res) => {
  const { likedId } = req.body;
  if (!likedId || !isValidObjectId(likedId)) {
    throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  }

  const currentUser = req.user!;
  
  // Check if like/pass already exists
  const existingLike = await Like.findOne({ likerId: currentUser.id, likedId });
  if (existingLike) {
    throw new HttpError(400, "Already swiped on this user", ErrorCode.VALIDATION);
  }

  const newPass = await Like.create({
    likerId: currentUser.id,
    likedId,
    type: "PASS"
  });

  sendOk(res, { pass: newPass });
}));

// 4. GET /dating/matches - Get user's matches
datingRouter.get("/matches", asyncHandler(async (req: AuthRequest, res) => {
  const currentUser = req.user!;

  // Find all matches containing current user
  const matches = await Match.find({
    users: currentUser.id
  }).sort({ createdAt: -1 }).lean();

  const partnerIds = matches.map(m => 
    m.users.find((u: any) => u.toString() !== currentUser.id)
  ).filter(Boolean);

  // Fetch user profiles for partners
  const partners = await User.find({
    _id: { $in: partnerIds }
  }).select("name username avatar city bio interests languages activeCosmetics vipTier vipStartedAt vipExpiresAt").lean();

  // Map back matching documents with details
  const formattedMatches = matches.map(m => {
    const partnerId = m.users.find((u: any) => u.toString() !== currentUser.id);
    if (!partnerId) return null;
    const partner = partners.find(p => p._id.toString() === partnerId.toString());
    if (!partner) return null;
    return {
      id: m._id.toString(),
      _id: m._id.toString(),
      matchDate: m.createdAt,
      partner: {
        id: partner._id.toString(),
        _id: partner._id.toString(),
        name: partner.name,
        username: partner.username,
        avatar: partner.avatar,
        city: partner.city,
        bio: partner.bio,
        activeCosmetics: partner.activeCosmetics,
        interests: partner.interests,
        languages: partner.languages,
        ...getVipStatus(partner)
      }
    };
  }).filter(Boolean);

  sendOk(res, { matches: formattedMatches });
}));
