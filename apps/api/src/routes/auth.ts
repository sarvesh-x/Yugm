import { Router } from "express";
import { profileSchema, requestOtpSchema, verifyOtpSchema } from "@yugm/shared";
import { User } from "../models/User.js";
import { requireAuth, signToken, type AuthRequest } from "../middleware/auth.js";
import { authLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { verifyIdToken } from "../services/firebase.js";
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
  return {
    id: user.id,
    _id: user._id?.toString?.() ?? user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    role: user.role,
    walletBalance: user.walletBalance,
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
  const key = req.body.email || req.body.phone;
  if (env.NODE_ENV !== "development" || !devOtp) {
    throw new HttpError(501, "OTP provider is not configured. Use Firebase phone auth or configure an OTP provider.", ErrorCode.VALIDATION);
  }
  otpStore.set(key, { otp: devOtp, expiresAt: Date.now() + 300_000 });
  sendOk(res, { channel: req.body.email ? "email" : "phone", expiresInSeconds: 300, devOtp });
}));

authRouter.post("/verify-otp", authLimiter, validateBody(verifyOtpSchema), asyncHandler(async (req, res) => {
  const key = req.body.email || req.body.phone;
  const stored = otpStore.get(key);
  const isValidOtp = stored && stored.otp === req.body.otp && stored.expiresAt > Date.now();
  const isDevBypass = env.NODE_ENV === "development" && env.DEV_BYPASS_OTP && req.body.otp === env.DEV_BYPASS_OTP;
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
          },
          $set: { isVerified: true }
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
      isVerified: true
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
      isVerified: true
    });
  }

  sendOk(res, { token: signToken(user), user: publicUser(user) });
}));

authRouter.post("/logout", requireAuth, (_req, res) => sendOk(res, { loggedOut: true }));

authRouter.get("/me", requireAuth, (req: AuthRequest, res) => sendOk(res, { user: publicUser(req.user) }));

authRouter.patch("/profile", requireAuth, validateBody(profileSchema.partial()), asyncHandler(async (req: AuthRequest, res) => {
  const user = await User.findByIdAndUpdate(req.user!.id, req.body, { new: true }).select("-__v");
  sendOk(res, { user: publicUser(user) });
}));
