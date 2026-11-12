import { Router } from "express";
import { profileSchema, requestOtpSchema, verifyOtpSchema } from "@yugm/shared";
import { User } from "../models/User.js";
import { requireAuth, signToken, type AuthRequest } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { verifyIdToken } from "../services/firebase.js";
import { getVipStatus } from "../services/vip.js";
import { getLevelStatus } from "../services/levels.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { env } from "../config/env.js";

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
}): Promise<{ user: any; isNewUser: boolean }> {
  const normalizedEmail = input.email?.trim().toLowerCase();

  for (let attempt = 0; attempt < 5; attempt++) {
    const byUid = await User.findOne({ firebaseUid: input.firebaseUid }).select("-__v");
    if (byUid) return { user: byUid, isNewUser: false };

    // Older accounts may have been created through the OTP flow before Firebase
    // became the identity provider. Attach the authenticated Firebase identity to
    // that existing record instead of violating the unique email index.
    const byEmail = normalizedEmail
      ? await User.findOne({ email: normalizedEmail }).select("-__v")
      : null;
    if (byEmail) {
      if (byEmail.firebaseUid && byEmail.firebaseUid !== input.firebaseUid) {
        throw new HttpError(409, "This email is already linked to another sign-in. Contact support to recover the account.", ErrorCode.CONFLICT);
      }
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
        isVerified: false
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

function publicUser(user: any) {
  const levelStatus = getLevelStatus(user);
  return {
    id: user.id,
    _id: user._id?.toString?.() ?? user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    isVerified: Boolean(user.isVerified),
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
    profileCompleted: Boolean(user.profileCompletedAt || (user.bio && user.city && user.interests?.length)),
    followersCount: user.followersCount,
    followingCount: user.followingCount
  };
}

const otpStore = new Map<string, { otp: string; expiresAt: number }>();

authRouter.post("/request-otp", authLimiter, validateBody(requestOtpSchema), asyncHandler(async (req, res) => {
  const devOtp = env.DEV_BYPASS_OTP;
  if (!devOtp && env.NODE_ENV !== "development") {
    throw new HttpError(501, "Use Firebase phone/Google authentication or configure DEV_BYPASS_OTP for staging.", ErrorCode.VALIDATION);
  }
  const key = req.body.email || req.body.phone;
  const activeOtp = devOtp || "123456";
  otpStore.set(key, { otp: activeOtp, expiresAt: Date.now() + 300_000 });
  sendOk(res, { channel: req.body.email ? "email" : "phone", expiresInSeconds: 300, devOtp: devOtp || undefined });
}));

authRouter.post("/verify-otp", authLimiter, validateBody(verifyOtpSchema), asyncHandler(async (req, res) => {
  const key = req.body.email || req.body.phone;
  const stored = otpStore.get(key);
  const isValidOtp = stored && stored.otp === req.body.otp && stored.expiresAt > Date.now();
  const isDevBypass = Boolean(env.DEV_BYPASS_OTP && req.body.otp === env.DEV_BYPASS_OTP);
  if (!isValidOtp && !isDevBypass) {
    throw new HttpError(401, "Invalid or expired OTP", ErrorCode.UNAUTHORIZED);
  }
  if (stored) otpStore.delete(key);

  const lookup = req.body.email ? { email: req.body.email } : { phone: req.body.phone };
  const isNewUser = !(await User.exists(lookup));
  const maxRetries = 10;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const username = await generateUniqueUsername();
    try {
      const user = await User.findOneAndUpdate(
        lookup,
        {
          $setOnInsert: {
            name: "Yugm User",
            username,
            interests: ["Music", "Chill"],
            languages: ["Hindi", "English"],
            walletBalance: 250
          }
        },
        { upsert: true, new: true }
      );
      return sendOk(res, { token: signToken(user), user: publicUser(user), isNewUser });
    } catch (err: any) {
      if (err?.code === 11000 && attempt < maxRetries - 1) continue;
      throw err;
    }
  }
}));

authRouter.post("/google", authLimiter, asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) throw new HttpError(400, "idToken is required", ErrorCode.VALIDATION);

  const payload = await verifyIdToken(idToken);
  const { sub: firebaseUid, name, email, picture } = payload;
  if (!firebaseUid) throw new HttpError(401, "Invalid Firebase identity token", ErrorCode.UNAUTHORIZED);
  const { user, isNewUser } = await findOrCreateFirebaseUser({ firebaseUid, name, email, avatar: picture });

  sendOk(res, { token: signToken(user), user: publicUser(user), isNewUser });
}));

authRouter.post("/phone", authLimiter, asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) throw new HttpError(400, "idToken is required", ErrorCode.VALIDATION);

  const payload = await verifyIdToken(idToken);
  const { sub: firebaseUid, phone_number } = payload;
  if (!firebaseUid) throw new HttpError(401, "Invalid Firebase identity token", ErrorCode.UNAUTHORIZED);
  const { user, isNewUser } = await findOrCreateFirebaseUser({ firebaseUid, phone: phone_number });

  sendOk(res, { token: signToken(user), user: publicUser(user), isNewUser });
}));

authRouter.post("/logout", requireAuth, (_req, res) => sendOk(res, { loggedOut: true }));

authRouter.get("/me", requireAuth, (req: AuthRequest, res) => sendOk(res, { user: publicUser(req.user) }));

authRouter.patch("/profile", requireAuth, validateBody(profileSchema.partial()), asyncHandler(async (req: AuthRequest, res) => {
  const allowedFields = ["name", "username", "gender", "age", "city", "state", "bio", "vibeLine", "interests", "hobbies", "languages", "avatar", "interestedIn", "lookingFor", "datingAgeMin", "datingAgeMax"];
  const update: Record<string, unknown> = {};
  for (const key of allowedFields) {
    if (key in req.body) update[key] = req.body[key];
  }
  const user = await User.findByIdAndUpdate(req.user!.id, { $set: update }, { new: true }).select("-__v");
  sendOk(res, { user: publicUser(user) });
}));
