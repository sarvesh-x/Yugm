import { Router, type Request, type RequestHandler, type Response } from "express";
import { validateBody } from "../middleware/validate.js";
import { verifyIdToken } from "../services/firebase.js";
import { getVipStatus } from "../services/vip.js";
import { getLevelStatus } from "../services/levelPresentation.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { issueSession, logoutSession, rotateRefresh } from "../services/tokens.js";
import { z } from "zod";
import { isProfileCompleted } from "../services/profileCompletion.js";
import { asAuthUser, findOrCreateFirebaseUser, type AuthAccountStore, type AuthUser } from "../services/authAccounts.js";
import type { AuthSessionStore } from "../services/authSessionStore.js";

// Host-neutral request shape; the legacy Mongoose auth middleware is retired.
type AuthRequest = Request & { user?: AuthUser };

export function publicAuthUser(user: AuthUser) {
  const levelStatus = getLevelStatus(user);
  return {
    id: user.id,
    _id: user.id,
    name: user.name,
    username: user.username,
    email: user.email,
    avatar: user.avatar,
    avatarType: user.avatarType,
    avatarParts: user.avatarParts,
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
    state: user.state,
    bio: user.bio,
    vibeLine: user.vibeLine,
    gender: user.gender,
    age: user.age,
    hobbies: user.hobbies,
    interestedIn: user.interestedIn,
    lookingFor: user.lookingFor,
    datingAgeMin: user.datingAgeMin,
    datingAgeMax: user.datingAgeMax,
    profileCompleted: isProfileCompleted(user),
    followersCount: user.followersCount,
    followingCount: user.followingCount
  };
}

const authSchema = z.object({
  idToken: z.string().min(20),
  acceptTerms: z.literal(true),
  provider: z.enum(["google", "facebook", "email"]).optional(),
  name: z.string().trim().min(1).max(60).optional(),
  mode: z.enum(["login", "signup"]).optional()
});
const facebookAuthSchema = z.object({
  idToken: z.string().min(20),
  acceptTerms: z.literal(true),
  name: z.string().trim().min(1).max(60).optional()
});
const phoneAuthSchema = z.object({ idToken: z.string().min(20), acceptTerms: z.literal(true) });

export type AuthRateLimiters = {
  authLimiter: RequestHandler;
  authIdentifierLimiter: RequestHandler;
  refreshLimiter: RequestHandler;
};

export function createAuthSessionRouter(dependencies: {
  accounts: AuthAccountStore;
  sessions: AuthSessionStore;
  enforceSession: RequestHandler;
  rateLimiters: AuthRateLimiters;
  onSessionIssued?: (userId: string, sessionId: string) => Promise<void>;
  onLogout?: (userId: string) => Promise<void>;
}) {
  const authRouter = Router();
  const { accounts, sessions, enforceSession, rateLimiters, onSessionIssued, onLogout } = dependencies;
  const { authLimiter, authIdentifierLimiter, refreshLimiter } = rateLimiters;

  function authenticatedUserId(req: AuthRequest, res: Response) {
    const id: unknown = req.user?.id ?? res.locals.authUserId;
    if (typeof id !== "string" || !id) throw new HttpError(401, "Invalid user", ErrorCode.UNAUTHORIZED);
    return id;
  }

  async function currentUser(req: AuthRequest, res: Response) {
    if (req.user) return asAuthUser(req.user);
    const user = await accounts.findById(authenticatedUserId(req, res));
    if (!user) throw new HttpError(401, "Invalid user", ErrorCode.UNAUTHORIZED);
    return user;
  }

  async function issueSingleDeviceSession(user: AuthUser, req: AuthRequest) {
    const tokens = await issueSession(user, req, sessions);
    await onSessionIssued?.(user.id, tokens.sessionId);
    return tokens;
  }

  authRouter.post("/google", authLimiter, authIdentifierLimiter, validateBody(authSchema), asyncHandler(async (req, res) => {
    const { idToken, acceptTerms, name: bodyName, mode } = req.body;
    if (!idToken) throw new HttpError(400, "idToken is required", ErrorCode.VALIDATION);

    const payload = await verifyIdToken(idToken);
    const { sub: firebaseUid, name: tokenName, email, picture, email_verified } = payload;
    if (!firebaseUid) throw new HttpError(401, "Invalid Firebase identity token", ErrorCode.UNAUTHORIZED);

    // Email/password accounts must be verified before they can create or use a
    // Yugm account. This prevents abuse with unverified email addresses.
    if (payload.firebase?.sign_in_provider === "password" && !payload.email_verified) {
      throw new HttpError(403, "Verify your email address to continue. Check your inbox for the verification link.", ErrorCode.FORBIDDEN);
    }

    const resolvedName = tokenName || bodyName;
    const { user, isNewUser } = await findOrCreateFirebaseUser(accounts, { firebaseUid, name: resolvedName, email, avatar: picture, acceptTerms, emailVerified: email_verified });
    const tokens = await issueSingleDeviceSession(user, req);
    sendOk(res, { ...tokens, user: publicAuthUser(user), isNewUser: isNewUser || !isProfileCompleted(user) });
  }));

  authRouter.post("/facebook", authLimiter, authIdentifierLimiter, validateBody(facebookAuthSchema), asyncHandler(async (req, res) => {
    const { idToken, acceptTerms, name: bodyName } = req.body;
    if (!idToken) throw new HttpError(400, "idToken is required", ErrorCode.VALIDATION);

    const payload = await verifyIdToken(idToken);
    const { sub: firebaseUid, name: tokenName, email, picture, email_verified } = payload;
    if (!firebaseUid) throw new HttpError(401, "Invalid Firebase identity token", ErrorCode.UNAUTHORIZED);
    const signInProvider = payload.firebase?.sign_in_provider;
    if (signInProvider && signInProvider !== "facebook.com") {
      throw new HttpError(401, "This token was not issued for Facebook sign-in", ErrorCode.UNAUTHORIZED);
    }
    const resolvedName = tokenName || bodyName;
    const { user, isNewUser } = await findOrCreateFirebaseUser(accounts, { firebaseUid, name: resolvedName, email, avatar: picture, acceptTerms, emailVerified: email_verified });
    const tokens = await issueSingleDeviceSession(user, req);
    sendOk(res, { ...tokens, user: publicAuthUser(user), isNewUser: isNewUser || !isProfileCompleted(user) });
  }));

  authRouter.post("/phone", authLimiter, authIdentifierLimiter, validateBody(phoneAuthSchema), asyncHandler(async (req, res) => {
    const { idToken, acceptTerms } = req.body;
    if (!idToken) throw new HttpError(400, "idToken is required", ErrorCode.VALIDATION);

    const payload = await verifyIdToken(idToken);
    const { sub: firebaseUid, phone_number } = payload;
    if (!firebaseUid) throw new HttpError(401, "Invalid Firebase identity token", ErrorCode.UNAUTHORIZED);
    if (!phone_number) throw new HttpError(401, "Phone sign-in token is missing a phone number", ErrorCode.UNAUTHORIZED);
    const signInProvider = payload.firebase?.sign_in_provider;
    if (signInProvider && signInProvider !== "phone") {
      throw new HttpError(401, "This token was not issued for phone sign-in", ErrorCode.UNAUTHORIZED);
    }
    const { user, isNewUser } = await findOrCreateFirebaseUser(accounts, { firebaseUid, phone: phone_number, acceptTerms });
    const tokens = await issueSingleDeviceSession(user, req);
    sendOk(res, { ...tokens, user: publicAuthUser(user), isNewUser: isNewUser || !isProfileCompleted(user) });
  }));

  authRouter.post("/refresh", refreshLimiter, validateBody(z.object({ refreshToken: z.string().min(30) })), asyncHandler(async (req, res) => {
    sendOk(res, await rotateRefresh(req.body.refreshToken, req, sessions));
  }));

  authRouter.post("/logout", enforceSession, validateBody(z.object({ refreshToken: z.string().optional(), deviceToken: z.string().min(20).optional() })), asyncHandler(async (req: AuthRequest, res) => {
    const userId = authenticatedUserId(req, res);
    await logoutSession(userId, req.body.refreshToken, sessions, req.body.deviceToken);
    await onLogout?.(userId);
    sendOk(res, { loggedOut: true });
  }));

  authRouter.get("/me", enforceSession, asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, { user: publicAuthUser(await currentUser(req, res)) });
  }));

  authRouter.post("/verify-email", enforceSession, validateBody(z.object({ idToken: z.string().min(20).optional() }).optional()), asyncHandler(async (req: AuthRequest, res) => {
    let user = await currentUser(req, res);
    const { idToken } = req.body ?? {};
    if (!user.emailVerified && idToken) {
      const payload = await verifyIdToken(idToken);
      const isMatchingUser = payload.sub === user.firebaseUid || (payload.email && payload.email.toLowerCase() === user.email?.toLowerCase());
      if (isMatchingUser && payload.email_verified) {
        const updated = await accounts.updateIdentity(user, { emailVerified: true }) ?? await accounts.findById(user.id);
        if (!updated?.emailVerified) throw new HttpError(409, "Account changed. Please try again.", ErrorCode.CONFLICT);
        user = updated;
      }
    }
    sendOk(res, { emailVerified: Boolean(user.emailVerified), user: publicAuthUser(user) });
  }));

  return authRouter;
}
