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
      return sendOk(res, { token: signToken(user), user: publicUser(user) });
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

  let user = await User.findOne({ firebaseUid }).select("-__v");
  if (!user) {
    user = await User.create({
      name: name ?? "Yugm User",
      username: await generateUniqueUsername(),
      email: email || undefined,
      firebaseUid,
      avatar: picture || undefined,
      interests: ["Music", "Chill"],
      languages: ["Hindi", "English"],
      walletBalance: 250,
      isVerified: false
    });
  }

  sendOk(res, { token: signToken(user), user: publicUser(user) });
}));

authRouter.post("/phone", authLimiter, asyncHandler(async (req, res) => {
  const { idToken } = req.body;
  if (!idToken) throw new HttpError(400, "idToken is required", ErrorCode.VALIDATION);

  const payload = await verifyIdToken(idToken);
  const { sub: firebaseUid, phone_number } = payload;

  let user = await User.findOne({ firebaseUid }).select("-__v");
  if (!user) {
    user = await User.create({
      name: "Yugm User",
      username: await generateUniqueUsername(),
      phone: phone_number || undefined,
      firebaseUid,
      interests: ["Music", "Chill"],
      languages: ["Hindi", "English"],
      walletBalance: 250,
      isVerified: false
    });
  }

  sendOk(res, { token: signToken(user), user: publicUser(user) });
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
