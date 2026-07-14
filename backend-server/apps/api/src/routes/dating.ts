import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { requireNotShadowBanned } from "../middleware/requireSafety.js";
import { Like } from "../models/Like.js";
import { Match } from "../models/Match.js";
import { Block } from "../models/Block.js";
import { User } from "../models/User.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { createNotification } from "../services/notifications.js";
import { getVipStatus } from "../services/vip.js";
import { ensureRelationshipForMatch, grantRelationshipXp } from "../services/relationships.js";
import { assertUsersCanInteract } from "../services/safety.js";
import { calculateCompatibility } from "../services/datingCompatibility.js";
import { isUserOnline } from "../services/socket.js";
import { validateBody } from "../middleware/validate.js";

export const datingRouter = Router();
datingRouter.use(requireAuth);

const preferenceSchema = z.object({
  interestedIn: z.enum(["Everyone", "Women", "Men", "Non-binary"]),
  lookingFor: z.enum(["Friendship", "Dating", "Relationship", "Networking"]),
  datingAgeMin: z.number().int().min(18).max(80),
  datingAgeMax: z.number().int().min(18).max(80),
  verifiedOnly: z.boolean().optional()
}).refine((value) => value.datingAgeMin <= value.datingAgeMax, { message: "Minimum age must be below maximum age", path: ["datingAgeMin"] });

datingRouter.get("/preferences", asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findById(req.user!.id).select("interestedIn lookingFor datingAgeMin datingAgeMax datingVerifiedOnly").lean();
  sendOk(res, { preferences: {
    interestedIn: user?.interestedIn ?? "Everyone",
    lookingFor: user?.lookingFor ?? "Friendship",
    datingAgeMin: user?.datingAgeMin ?? 18,
    datingAgeMax: user?.datingAgeMax ?? 35,
    verifiedOnly: Boolean((user as any)?.datingVerifiedOnly)
  } });
}));

datingRouter.put("/preferences", validateBody(preferenceSchema), asyncHandler(async (req: AuthRequest, res) => {
  const update = { ...req.body, datingVerifiedOnly: req.body.verifiedOnly };
  delete update.verifiedOnly;
  await User.findByIdAndUpdate(req.user!.id, { $set: update });
  sendOk(res, { preferences: req.body });
}));

// 1. GET /dating/explore - Get profiles to swipe on
datingRouter.get("/explore", requireNotShadowBanned, asyncHandler(async (req: AuthRequest, res) => {
  const currentUser = req.user!;
  
  // Parse query filters
  const queryMinAge = req.query.minAge ? Number(req.query.minAge) : undefined;
  const queryMaxAge = req.query.maxAge ? Number(req.query.maxAge) : undefined;
  const onlineOnly = req.query.onlineOnly === "true";
  const sharedInterestsOnly = req.query.sharedInterests === "true";

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

  // Find shadow banned users to exclude from explore
  const shadowBanned = await UserSafetyStatus.find({ isShadowBanned: true }).select("userId").lean();
  const shadowBannedIds = shadowBanned.map((s: any) => s.userId.toString());

  const excludeIds = [currentUser.id, ...swipedIds, ...blockedIds, ...shadowBannedIds];
  const excludeObjectIds = excludeIds.map(id => new mongoose.Types.ObjectId(id));

  const genderFilter = currentUser.interestedIn && currentUser.interestedIn !== "Everyone"
    ? { gender: currentUser.interestedIn === "Women" ? "Female" : currentUser.interestedIn === "Men" ? "Male" : "Non-binary" }
    : {};
  const ageFilter = (queryMinAge || queryMaxAge)
    ? { age: { $gte: queryMinAge ?? 18, $lte: queryMaxAge ?? 80 } }
    : currentUser.datingAgeMin || currentUser.datingAgeMax
      ? { age: { $gte: currentUser.datingAgeMin ?? 18, $lte: currentUser.datingAgeMax ?? 80 } }
      : {};

  const candidates = await User.find({
    _id: { $nin: excludeObjectIds },
    isBlocked: { $ne: true },
    ...genderFilter,
    ...ageFilter,
    ...((currentUser as any).datingVerifiedOnly ? { isVerified: true } : {})
  }).limit(40).lean();

  // Calculate vibe score for each candidate
  const formattedCandidates = candidates.map(candidate => {
    const compatibility = calculateCompatibility(currentUser, candidate);
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
      vibeLine: candidate.vibeLine,
      interests: candidate.interests,
      languages: candidate.languages,
      followersCount: candidate.followersCount,
      role: candidate.role,
      activeCosmetics: candidate.activeCosmetics,
      isVerified: candidate.isVerified,
      lookingFor: candidate.lookingFor,
      ...getVipStatus(candidate),
      vibeScore: compatibility.score,
      matchReasons: compatibility.reasons,
      sharedInterests: compatibility.sharedInterests,
      sharedLanguages: compatibility.sharedLanguages
    };
  });

  // Apply post-query filters
  let filtered = formattedCandidates;
  if (onlineOnly) {
    filtered = filtered.filter((c) => isUserOnline(c.id));
  }
  if (sharedInterestsOnly) {
    filtered = filtered.filter((c) => (c.sharedInterests?.length ?? 0) > 0);
  }

  // Sort by vibeScore desc
  filtered.sort((a, b) => Number(b.isVip) - Number(a.isVip) || b.vibeScore - a.vibeScore);

  sendOk(res, { candidates: filtered });
}));

// 2. POST /dating/like - Swipe Like or Super Like a user
datingRouter.post("/like", requireNotShadowBanned, asyncHandler(async (req: AuthRequest, res) => {
  const { likedId, type = "LIKE" } = req.body;
  if (!likedId || !isValidObjectId(likedId)) {
    throw new HttpError(400, "Invalid likedId", ErrorCode.VALIDATION);
  }

  const currentUser = req.user!;
  if (currentUser.id === likedId) {
    throw new HttpError(400, "You cannot like yourself", ErrorCode.VALIDATION);
  }
  await assertUsersCanInteract(currentUser.id, likedId, "Cannot like this user");

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
      await grantRelationshipXp(
        currentUser.id,
        likedId,
        type === "SUPER_LIKE" || mutualLike.type === "SUPER_LIKE" ? "SUPER_LIKE_MATCH" : "MATCH_CREATED",
        { matchId: match._id.toString() }
      );

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
datingRouter.post("/pass", requireNotShadowBanned, asyncHandler(async (req: AuthRequest, res) => {
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
  const formattedMatches = await Promise.all(matches.map(async (m) => {
    const partnerId = m.users.find((u: any) => u.toString() !== currentUser.id);
    if (!partnerId) return null;
    const partner = partners.find(p => p._id.toString() === partnerId.toString());
    if (!partner) return null;
    const relationship = await ensureRelationshipForMatch(currentUser.id, partnerId.toString(), m._id.toString());
    return {
      id: m._id.toString(),
      _id: m._id.toString(),
      matchDate: m.createdAt,
      relationship: relationship.relationship,
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
  }));

  sendOk(res, { matches: formattedMatches.filter(Boolean) });
}));
