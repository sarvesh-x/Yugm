import type { D1Database } from "@cloudflare/workers-types";
import express, { type ErrorRequestHandler, type Request as ExpressRequest } from "express";
import { requireAppCheck } from "../middleware/appCheck.js";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import type { AuthRateLimiters } from "../routes/authSession.js";
import { legalRouter, publicServiceRoot } from "../routes/legal.js";
import { presentGameCatalog } from "../services/gameCatalog.js";
import { asyncHandler, HttpError, sendOk } from "../utils/http.js";
import { responseError } from "../utils/responseError.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { createD1AiWingmanRouter } from "./d1AiWingman.js";
import { createD1AdminRouter } from "./d1AdminConfig.js";
import { createD1AdminAccountsRouter } from "./d1AdminAccounts.js";
import { createD1AdminAssetsRouter } from "./d1AdminAssets.js";
import { createD1AdminBadgesRouter, createD1BadgeArtRouter } from "./d1AdminBadges.js";
import { createD1AdminAnalyticsRouter } from "./d1AdminAnalytics.js";
import { createD1AdminCosmeticsRouter } from "./d1AdminCosmetics.js";
import { createD1AdminDmReviewsRouter } from "./d1AdminDmReviews.js";
import { createD1AdminFinanceRouter } from "./d1AdminFinance.js";
import { createD1AdminGiftsRouter } from "./d1AdminGifts.js";
import { createD1AdminLiveOperationsRouter } from "./d1AdminLiveOperations.js";
import { createD1LegacyModerationRouter } from "./d1LegacyModeration.js";
import { createD1AdminMessagesRouter } from "./d1AdminMessages.js";
import { createD1AdminMediaRouter } from "./d1AdminMedia.js";
import { createD1AdminNotificationsRouter } from "./d1AdminNotifications.js";
import { createD1AdminPayoutDecisionsRouter } from "./d1AdminPayoutDecisions.js";
import { createD1AdminPaymentsRouter } from "./d1AdminPayments.js";
import { createD1AdminReportsRouter } from "./d1AdminReports.js";
import { createD1AdminReactionsRouter, createD1ReactionArtRouter } from "./d1AdminReactions.js";
import { createD1AdminRefundsRouter } from "./d1AdminRefunds.js";
import { createD1AdminSessionsRouter, type AdminSessionConfig } from "./d1AdminSessions.js";
import { createD1AdminRoomsRouter } from "./d1AdminRooms.js";
import { createD1AdminSupportRouter } from "./d1AdminSupport.js";
import { createD1AdminUsersRouter } from "./d1AdminUsers.js";
import { createD1AdminVerificationRouter } from "./d1AdminVerification.js";
import { createD1AuthRouter } from "./d1AuthRouter.js";
import { createD1BattlePassRouter } from "./d1BattlePass.js";
import { createD1BondsRouter } from "./d1Bonds.js";
import { createD1ClansRouter } from "./d1Clans.js";
import { createD1CosmeticsRouter } from "./d1Cosmetics.js";
import { createD1CoverUploadRouter } from "./d1CoverUpload.js";
import { createD1CreatorRouter } from "./d1Creator.js";
import { createD1AudioUploadRouter } from "./d1AudioUpload.js";
import { createD1AvatarUploadRouter } from "./d1AvatarUpload.js";
import { createD1ProfileMediaUploadRouter } from "./d1ProfileMediaUpload.js";
import { createD1DatingRouter } from "./d1Dating.js";
import { createD1DiscoverRouter } from "./d1Discover.js";
import { createD1DirectGiftsRouter } from "./d1DirectGifts.js";
import { createD1EventsRouter } from "./d1Events.js";
import { createD1ExperienceRouter } from "./d1Experience.js";
import { createD1FeedRouter } from "./d1Feed.js";
import { readD1GameCatalog } from "./d1GameCatalog.js";
import { createD1GamesReadsRouter } from "./d1GamesReads.js";
import { createD1GamesRouter } from "./d1Games.js";
import { createD1GiftCatalogRouter } from "./d1GiftCatalog.js";
import { createD1GroupsRouter } from "./d1Groups.js";
import { createD1HighlightsRouter } from "./d1Highlights.js";
import { createD1InboxRouter } from "./d1Inbox.js";
import { createD1LiveKitRouter, type D1LiveKitConfig } from "./d1LiveKit.js";
import { createD1MediaRouter, type D1MediaRouterOptions } from "./d1Media.js";
import { createD1MissionsRouter } from "./d1Missions.js";
import { createD1ModerationRouter } from "./d1Moderation.js";
import { createD1NotificationRouter } from "./d1Notifications.js";
import { createD1ProfileEditRouter } from "./d1ProfileEdits.js";
import { createD1ProfileActivityRouter } from "./d1ProfileActivity.js";
import { noD1Presence, type D1PresencePort } from "./d1Presence.js";
import { noD1Realtime, type D1RealtimePort } from "./d1Realtime.js";
import { createD1UserDiscoveryRouter } from "./d1UserDiscovery.js";
import { createD1UserMatchingRouter, type D1UserMatchingSideEffects } from "./d1UserMatching.js";
import { createD1ProgressionRouter } from "./d1Progression.js";
import { createD1RecordingsRouter } from "./d1Recordings.js";
import { createD1ReferralsRouter } from "./d1Referrals.js";
import { createD1ReportsRouter } from "./d1Reports.js";
import { createD1RoomGiftsRouter } from "./d1RoomGifts.js";
import { createD1RoomsRouter } from "./d1Rooms.js";
import { createD1RoomInvitesRouter } from "./d1RoomInvites.js";
import { createD1RoomReactionsRouter } from "./d1RoomReactions.js";
import { createD1PaymentProviders, type D1PaymentConfig } from "./d1Payments.js";
import { createD1PayoutWebhookHandler } from "./d1PayoutWebhook.js";
import { createD1PkReadsRouter } from "./d1PkReads.js";
import { createD1PkWritesRouter } from "./d1PkWrites.js";
import { createD1SocialRouter } from "./d1Social.js";
import { createD1SocialFeaturesRouter } from "./d1SocialFeatures.js";
import { createD1StoriesRouter } from "./d1Stories.js";
import { createD1SubscriptionsRouter } from "./d1Subscriptions.js";
import { createD1SupportRouter } from "./d1Support.js";
import { createD1ThemesRouter } from "./d1Themes.js";
import { createD1TrustVerificationRouter } from "./d1TrustVerification.js";
import { createD1TrustVerificationUploadRouter } from "./d1TrustVerificationUpload.js";
import { createD1VibeRouter } from "./d1Vibe.js";
import type { D1UserRateLimit } from "./d1UserRateLimit.js";
import { createD1WalletRouter } from "./d1Wallet.js";
import { createD1WatchPartyRouter } from "./d1WatchParty.js";
import { createD1WishlistRouter } from "./d1Wishlist.js";

export interface D1WalletConfig extends D1PaymentConfig {
  devRecharge?: boolean;
  diamondsEnabled?: boolean;
  payoutKycEncryptionKey?: string;
  payoutWebhookSecret?: string;
}

export function createD1App(
  db: D1Database,
  rateLimiters: AuthRateLimiters,
  media?: Pick<D1MediaRouterOptions, "buckets" | "grantSecret">,
  limits: { chat?: D1UserRateLimit; report?: D1UserRateLimit; create?: D1UserRateLimit; gift?: D1UserRateLimit } = {},
  livekit: D1LiveKitConfig = {},
  wallet: D1WalletConfig = { production: true },
  admin: AdminSessionConfig = {},
  adminRateLimiters = rateLimiters,
  userMatching: D1UserMatchingSideEffects = {},
  presence: D1PresencePort = noD1Presence,
  realtime: D1RealtimePort = noD1Realtime
) {
  const resolvePublicOrigin = (request: ExpressRequest) => {
    // The fetch handler validates the origin and discards any incoming value.
    const value = request.header("x-yugm-request-origin");
    if (!value) throw new HttpError(400, "Media origin is unavailable");
    return value;
  };
  // Explicit matching callbacks win; otherwise the shared presence port supplies
  // ephemeral online state and user-scoped invalidation. Presence never changes
  // the outcome of a guarded D1 commit.
  const matchingSideEffects: D1UserMatchingSideEffects = {
    ...userMatching,
    isUserOnline: userMatching.isUserOnline ?? ((userId) => presence.isUserOnline(userId)),
    disconnectUser: userMatching.disconnectUser ?? ((userId) =>
      presence.disconnectUser?.(userId) ?? presence.markOffline(userId)),
    emitUser: userMatching.emitUser ?? ((userId, event, payload) => presence.emitUser?.(userId, event, payload))
  };
  const app = express();
  const paymentProviders = createD1PaymentProviders(wallet);
  app.disable("x-powered-by");
  app.get("/", publicServiceRoot);
  app.use("/legal", legalRouter);
  // The managed upload PUT carries raw image bytes, not JSON.
  app.use("/api/media/uploads/:sessionId/bytes", express.raw({ type: () => true, limit: "6mb" }));
  // Webhook route needs raw body for signature verification (before express.json).
  app.post("/api/payments/webhook/payout", express.raw({ type: "application/json" }),
    createD1PayoutWebhookHandler(db, wallet.payoutWebhookSecret));
  app.use(express.json({ limit: "1mb" }));
  app.get("/api", (_req, res) => res.json({
    ok: true,
    service: "yugm-api",
    version: "0.1.0",
    environment: process.env.NODE_ENV,
    uptimeSeconds: Math.round(process.uptime()),
    health: "/api/health",
    authentication: "Bearer <token> header required on protected routes",
    endpointGroups: [
      "POST /api/auth/* (register, login, otp, refresh, logout, me)",
      "/api/users/*", "/api/rooms/*", "/api/feed", "/api/friends", "/api/clans", "/api/groups",
      "/api/pk/*", "/api/games/*", "/api/livekit/*", "/api/wallet", "/api/gifts", "/api/events",
      "/api/social/*", "/api/dating/*", "/api/creator/*", "/api/recordings", "/api/notifications/*",
      "/api/reports", "/api/support/*", "/api/upload/*", "/api/missions", "/api/battle-pass",
      "/api/vibe/*", "/api/ai/*", "/api/trust-verification/*", "/api/moderation/*", "/api/discover/*",
      "/api/admin/* (admin panel)", "/api/payments/webhook/payout (webhook)"
    ]
  }));
  app.use("/api/auth", requireAppCheck, createD1AuthRouter(db, rateLimiters));
  app.use("/api/admin", createD1AdminSessionsRouter(db, adminRateLimiters, admin));
  app.use("/api/admin", createD1AdminAccountsRouter(db, adminRateLimiters, admin));
  app.use("/api/admin", createD1AdminRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminSupportRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminReportsRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminUsersRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminMessagesRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminRoomsRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminAnalyticsRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminCosmeticsRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminFinanceRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminPayoutDecisionsRouter(db, paymentProviders, admin.jwtSecret));
  app.use("/api/admin", createD1AdminPaymentsRouter(db, paymentProviders, admin.jwtSecret));
  app.use("/api/admin", createD1AdminRefundsRouter(db, paymentProviders, admin.jwtSecret));
  app.use("/api/admin", createD1AdminGiftsRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminNotificationsRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminMediaRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminAssetsRouter(db, resolvePublicOrigin, media?.buckets, admin.jwtSecret));
  app.use("/api/admin", createD1AdminBadgesRouter(db, admin.jwtSecret, media?.buckets.assets));
  app.use("/api/admin", createD1AdminReactionsRouter(db, resolvePublicOrigin, admin.jwtSecret, media?.buckets.assets));
  app.use("/api/admin", createD1AdminVerificationRouter(db, admin.jwtSecret, media?.buckets["private-media"]));
  app.use("/api/admin", createD1AdminDmReviewsRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminLiveOperationsRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1LegacyModerationRouter(db));
  app.use("/api/badge-art", createD1BadgeArtRouter(db, media?.buckets.assets));
  app.use("/api/reaction-art", createD1ReactionArtRouter(db, media?.buckets.assets));
  app.use("/api/users", createD1ProfileEditRouter(db));
  app.use("/api/users", createD1ProfileActivityRouter(db));
  app.use("/api/users", createD1UserDiscoveryRouter(db, presence));
  app.use("/api/users", createD1UserMatchingRouter(db, limits.chat, matchingSideEffects));
  app.use("/api", createD1ProgressionRouter(db));
  app.use("/api/users/messages", createD1InboxRouter(db, limits.chat));
  app.use("/api", createD1DiscoverRouter(db, presence));
  app.use("/api", createD1SocialRouter(db));
  app.use("/api", createD1SocialFeaturesRouter(db));
  app.use("/api", createD1ExperienceRouter(db));
  app.use("/api", createD1ModerationRouter(db));
  app.use("/api", createD1GroupsRouter(db, limits.chat));
  app.use("/api", createD1FeedRouter(db));
  app.use("/api", createD1StoriesRouter(db, limits.create));
  app.use("/api", createD1HighlightsRouter(db));
  app.use("/api", createD1CosmeticsRouter(db, resolvePublicOrigin));
  app.use("/api", createD1WalletRouter(db, {
    payments: paymentProviders,
    devRecharge: wallet.devRecharge
  }));
  app.use("/api", createD1DirectGiftsRouter(db, wallet.diamondsEnabled));
  app.use("/api/clans", createD1ClansRouter(db, limits));
  app.use("/api/notifications", createD1NotificationRouter(db));
  app.use("/api/support", createD1SupportRouter(db, limits.create));
  app.use("/api/dating", createD1DatingRouter(db, presence));
  // The legacy app mounts this router twice, preserving both the canonical
  // /api/events paths and older double-prefixed clients.
  const events = createD1EventsRouter(db, limits.create);
  app.use("/api/events", events);
  app.use("/api", events);
  app.use("/api", createD1ThemesRouter(db));
  app.use("/api/rooms", createD1RoomsRouter(db, limits.chat));
  app.use("/api/rooms", createD1RoomInvitesRouter(db));
  app.use("/api/recordings", createD1RecordingsRouter(db));
  app.use("/api", createD1ReportsRouter(db, limits.report));
  app.use("/api", createD1GiftCatalogRouter(db));
  app.use("/api", createD1RoomGiftsRouter(db, limits.gift, wallet.diamondsEnabled));
  app.use("/api", createD1RoomReactionsRouter(db));
  app.use("/api", createD1WatchPartyRouter(db));
  app.use("/api", createD1WishlistRouter(db));
  app.use("/api", createD1MissionsRouter(db));
  app.use("/api", createD1BattlePassRouter(db));
  app.use("/api", createD1ReferralsRouter(db));
  app.use("/api", createD1SubscriptionsRouter(db));
  app.use("/api", createD1VibeRouter(db));
  app.use("/api/ai", createD1AiWingmanRouter(db));
  app.use("/api/trust-verification", createD1TrustVerificationRouter(db, media?.buckets["private-media"]));
  app.use("/api/bonds", createD1BondsRouter(db));
  app.use("/api/creator", createD1CreatorRouter(db, { payoutKycEncryptionKey: wallet.payoutKycEncryptionKey }));
  app.use("/api", createD1LiveKitRouter(db, livekit));
  app.use("/api/pk", createD1PkReadsRouter(db, livekit));
  app.use("/api/pk", createD1PkWritesRouter(db, realtime));
  app.use("/api", createD1GamesReadsRouter(db));
  app.use("/api", createD1GamesRouter(db, limits.chat));
  const access = createD1AccessSessionReader(db, "http");
  app.get("/api/games/catalog", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const { scores } = await readD1GameCatalog(db, user.id);
    sendOk(res, presentGameCatalog(scores));
  }));
  if (media) app.use("/api/upload", createD1CoverUploadRouter({ db, resolvePublicOrigin, buckets: media.buckets }));
  if (media) app.use("/api/upload", createD1ProfileMediaUploadRouter({ db, resolvePublicOrigin, buckets: media.buckets }));
  if (media) app.use("/api/upload", createD1AudioUploadRouter({ db, resolvePublicOrigin, buckets: media.buckets }));
  if (media) app.use("/api/upload", createD1AvatarUploadRouter({ db, resolvePublicOrigin, buckets: media.buckets }));
  if (media) app.use("/api/upload", createD1TrustVerificationUploadRouter({ db, buckets: media.buckets }));
  if (media) app.use("/api/media", createD1MediaRouter({ db, resolvePublicOrigin, ...media }));
  app.use((_req, res) => res.status(404).json({ ok: false, error: { message: "Route not found" } }));
  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const { status, message, code } = responseError(error);
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("D1 API request failed", requestId, status);
    const errorBody = { message: status >= 500 ? "Unexpected server error" : message, code, requestId };
    res.status(status).json(req.path.startsWith("/api/admin") && !res.locals.legacyAdminRoute
      ? { success: false, error: errorBody }
      : { ok: false, error: errorBody });
  };
  app.use(errorHandler);
  return app;
}
