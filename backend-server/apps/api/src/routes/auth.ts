import { Router } from "express";
import { profileSchema } from "@yugm/shared";
import { User } from "../models/User.js";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { authIdentifierLimiter, authLimiter, refreshLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { verifyIdToken } from "../services/firebase.js";
import { getVipStatus } from "../services/vip.js";
import { getLevelStatus } from "../services/levels.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { issueSession, revokeAllForUser, revokeSession, rotateRefresh } from "../services/tokens.js";
import { z } from "zod";

export const authRouter = Router();

async function generateUniqueUsername(): Promise<string> {
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const username = `vibe_${suffix}`;
    const exists = await User.findOne({ username }).lean();
    if (!exists) return username;
  }
  return `vibe_${Date.now()}`;
}

async function findOrCreateFirebaseUser(input: {
  firebaseUid: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  acceptTerms: boolean;
  emailVerified?: boolean;
}): Promise<{ user: any; isNewUser: boolean }> {
  const normalizedEmail = input.email?.trim().toLowerCase();

  for (let attempt = 0; attempt < 5; attempt++) {
    const byUid = await User.findOne({ firebaseUid: input.firebaseUid }).select("-__v");
    if (byUid) {
      let changed = false;
      if (input.acceptTerms && !byUid.termsAcceptedAt) { byUid.termsAcceptedAt = new Date(); changed = true; }
      if (input.emailVerified && !byUid.emailVerified) { byUid.emailVerified = true; changed = true; }
      if (byUid.deletionRequestedAt) { byUid.deletionRequestedAt = undefined; changed = true; }
      if (changed) await byUid.save();
      return { user: byUid, isNewUser: false };
    }

    // Older accounts may have been created through the OTP flow before Firebase
    // became the identity provider. Attach the authenticated Firebase identity to
    // that existing record instead of violating the unique email index.
    const byEmail = normalizedEmail
      ? await User.findOne({ email: normalizedEmail }).select("+email -__v")
      : null;
    if (byEmail) {
      if (!input.emailVerified) {
        throw new HttpError(409, "Verify this email address before linking it to an existing account.", ErrorCode.CONFLICT);
      }
      if (byEmail.firebaseUid && byEmail.firebaseUid !== input.firebaseUid) {
        throw new HttpError(409, "This email is already linked to another sign-in. Contact support to recover the account.", ErrorCode.CONFLICT);
      }
      if (input.acceptTerms && !byEmail.termsAcceptedAt) byEmail.termsAcceptedAt = new Date();
      if (input.emailVerified) byEmail.emailVerified = true;
      if (byEmail.deletionRequestedAt) byEmail.deletionRequestedAt = undefined;
      byEmail.firebaseUid = input.firebaseUid;
      if (!byEmail.email && normalizedEmail) byEmail.email = normalizedEmail;
      if (!byEmail.name && input.name) byEmail.name = input.name;
      if (!byEmail.avatar && input.avatar) byEmail.avatar = input.avatar;
      try {
        return { user: await byEmail.save(), isNewUser: false };
      } catch (error: any) {
        // Concurrent sign-in may have linked the same Firebase user already.
        if (error?.code === 11000) continue;
        throw error;
      }
    }

    try {
      const user = await User.create({
        name: input.name || "Yugm User",
        username: await generateUniqueUsername(),
        email: normalizedEmail || undefined,
        phone: input.phone || undefined,
        firebaseUid: input.firebaseUid,
        avatar: input.avatar || undefined,
        interests: ["Music", "Chill"],
        languages: ["Hindi", "English"],
        walletBalance: 250,
        isVerified: false,
        termsAcceptedAt: input.acceptTerms ? new Date() : undefined,
        emailVerified: Boolean(input.emailVerified)
      });
      return { user, isNewUser: true };
    } catch (error: any) {
      // The client retries auth after transient timeouts. If the original
      // request completed concurrently, return its user instead of a 500.
      if (error?.code === 11000) continue;
      throw error;
    }
  }

  const existing = await User.findOne({ firebaseUid: input.firebaseUid }).select("-__v");
  if (existing) return { user: existing, isNewUser: false };
  throw new HttpError(409, "Could not finish creating your account. Please retry.", ErrorCode.CONFLICT);
}

function isProfileCompleted(user: any): boolean {
  return Boolean(user.profileCompletedAt || (user.bio && user.city && user.interests?.length));
}

function publicUser(user: any) {
  const levelStatus = getLevelStatus(user);
  return {
    id: user.id,
    _id: user._id?.toString?.() ?? user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    isVerified: Boolean(user.isVerified),
    emailVerified: Boolean(user.emailVerified),
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
    languages: user.languages,
    city: user.city,
    bio: user.bio,
    profileCompleted: isProfileCompleted(user),
    followersCount: user.followersCount,
    followingCount: user.followingCount
  };
}

const authSchema = z.object({ idToken: z.string().min(20), acceptTerms: z.literal(true), provider: z.enum(["google", "email"]).optional() });
const phoneAuthSchema = z.object({ idToken: z.string().min(20), acceptTerms: z.literal(true) });

authRouter.post("/google", authLimiter, authIdentifierLimiter, validateBody(authSchema), asyncHandler(async (req, res) => {
  const { idToken, acceptTerms } = req.body;
  if (!idToken) throw new HttpError(400, "idToken is required", ErrorCode.VALIDATION);

  const payload = await verifyIdToken(idToken);
  const { sub: firebaseUid, name, email, picture, email_verified } = payload;
  if (!firebaseUid) throw new HttpError(401, "Invalid Firebase identity token", ErrorCode.UNAUTHORIZED);
  const { user, isNewUser } = await findOrCreateFirebaseUser({ firebaseUid, name, email, avatar: picture, acceptTerms, emailVerified: email_verified });
  const tokens = await issueSession(user, req);
  sendOk(res, { ...tokens, user: publicUser(user), isNewUser: isNewUser || !isProfileCompleted(user) });
}));

authRouter.post("/phone", authLimiter, authIdentifierLimiter, validateBody(phoneAuthSchema), asyncHandler(async (req, res) => {
  const { idToken, acceptTerms } = req.body;
  if (!idToken) throw new HttpError(400, "idToken is required", ErrorCode.VALIDATION);

  const payload = await verifyIdToken(idToken);
  const { sub: firebaseUid, phone_number } = payload;
  if (!firebaseUid) throw new HttpError(401, "Invalid Firebase identity token", ErrorCode.UNAUTHORIZED);
  const { user, isNewUser } = await findOrCreateFirebaseUser({ firebaseUid, phone: phone_number, acceptTerms });
  const tokens = await issueSession(user, req);
  sendOk(res, { ...tokens, user: publicUser(user), isNewUser: isNewUser || !isProfileCompleted(user) });
}));

authRouter.post("/refresh", refreshLimiter, validateBody(z.object({ refreshToken: z.string().min(30) })), asyncHandler(async (req, res) => {
  sendOk(res, await rotateRefresh(req.body.refreshToken, req));
}));

authRouter.post("/logout", requireAuth, validateBody(z.object({ refreshToken: z.string().optional() })), asyncHandler(async (req: AuthRequest, res) => {
  if (req.body.refreshToken) await revokeSession(req.body.refreshToken, req.user!.id);
  await User.updateOne({ _id: req.user!._id }, { $inc: { tokenVersion: 1 } });
  await revokeAllForUser(req.user!.id);
  sendOk(res, { loggedOut: true });
}));

authRouter.get("/me", requireAuth, (req: AuthRequest, res) => sendOk(res, { user: publicUser(req.user) }));

authRouter.patch("/profile", requireAuth, validateBody(profileSchema.partial().refine((data) => data.age === undefined || (data.age >= 18 && data.age <= 100), { message: "You must be between 18 and 100 years old", path: ["age"] })), asyncHandler(async (req: AuthRequest, res) => {
  const allowedFields = ["name", "username", "gender", "age", "city", "state", "bio", "vibeLine", "interests", "hobbies", "languages", "avatar", "interestedIn", "lookingFor", "datingAgeMin", "datingAgeMax"];
  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in req.body) update[key] = req.body[key];
  }
  if (typeof update.username === "string") {
    update.username = update.username.trim().toLowerCase();
    const existing = await User.exists({ username: update.username, _id: { $ne: req.user!._id } });
    if (existing) throw new HttpError(409, "That username is already taken. Choose another one.", ErrorCode.CONFLICT);
  }
  let user;
  try {
    user = await User.findByIdAndUpdate(req.user!.id, { $set: update }, { new: true }).select("-__v");
  } catch (error: any) {
    if (error?.code === 11000 && (error?.keyPattern?.username || error?.keyValue?.username)) {
      throw new HttpError(409, "That username is already taken. Choose another one.", ErrorCode.CONFLICT);
    }
    throw error;
  }
  sendOk(res, { user: publicUser(user) });
}));
