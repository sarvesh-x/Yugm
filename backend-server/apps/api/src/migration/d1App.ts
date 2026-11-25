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
import { createD1AdminRouter } from "./d1AdminConfig.js";
import { createD1AdminReportsRouter } from "./d1AdminReports.js";
import { createD1AdminSupportRouter } from "./d1AdminSupport.js";
import { createD1AuthRouter } from "./d1AuthRouter.js";
import { createD1BattlePassRouter } from "./d1BattlePass.js";
import { createD1BondsRouter } from "./d1Bonds.js";
import { createD1ClansRouter } from "./d1Clans.js";
import { createD1CosmeticsRouter } from "./d1Cosmetics.js";
import { createD1DatingRouter } from "./d1Dating.js";
import { createD1DirectGiftsRouter } from "./d1DirectGifts.js";
import { createD1FeedRouter } from "./d1Feed.js";
import { readD1GameCatalog } from "./d1GameCatalog.js";
import { createD1GiftCatalogRouter } from "./d1GiftCatalog.js";
import { createD1HighlightsRouter } from "./d1Highlights.js";
import { createD1InboxRouter } from "./d1Inbox.js";
import { createD1LiveKitRouter, type D1LiveKitConfig } from "./d1LiveKit.js";
import { createD1MediaRouter, type D1MediaRouterOptions } from "./d1Media.js";
import { createD1MissionsRouter } from "./d1Missions.js";
import { createD1NotificationRouter } from "./d1Notifications.js";
import { createD1ProfileEditRouter } from "./d1ProfileEdits.js";
import { createD1ProgressionRouter } from "./d1Progression.js";
import { createD1ReferralsRouter } from "./d1Referrals.js";
import { createD1ReportsRouter } from "./d1Reports.js";
import { createD1RoomGiftsRouter } from "./d1RoomGifts.js";
import { createD1RoomsRouter } from "./d1Rooms.js";
import { createD1RoomInvitesRouter } from "./d1RoomInvites.js";
import { createD1RoomReactionsRouter } from "./d1RoomReactions.js";
import { createD1PaymentProviders, type D1PaymentConfig } from "./d1Payments.js";
import { createD1SocialRouter } from "./d1Social.js";
import { createD1StoriesRouter } from "./d1Stories.js";
import { createD1SubscriptionsRouter } from "./d1Subscriptions.js";
import { createD1SupportRouter } from "./d1Support.js";
import { createD1ThemesRouter } from "./d1Themes.js";
import type { D1UserRateLimit } from "./d1UserRateLimit.js";
import { createD1WalletRouter } from "./d1Wallet.js";
import { createD1WatchPartyRouter } from "./d1WatchParty.js";
import { createD1WishlistRouter } from "./d1Wishlist.js";

export interface D1WalletConfig extends D1PaymentConfig {
  devRecharge?: boolean;
  diamondsEnabled?: boolean;
}

export function createD1App(
  db: D1Database,
  rateLimiters: AuthRateLimiters,
  media?: Pick<D1MediaRouterOptions, "buckets" | "grantSecret">,
  limits: { chat?: D1UserRateLimit; report?: D1UserRateLimit; create?: D1UserRateLimit; gift?: D1UserRateLimit } = {},
  livekit: D1LiveKitConfig = {},
  wallet: D1WalletConfig = { production: true },
  admin: { jwtSecret?: string } = {}
) {
  const resolvePublicOrigin = (request: ExpressRequest) => {
    // The fetch handler validates the origin and discards any incoming value.
    const value = request.header("x-yugm-request-origin");
    if (!value) throw new HttpError(400, "Media origin is unavailable");
    return value;
  };
  const app = express();
  app.disable("x-powered-by");
  app.get("/", publicServiceRoot);
  app.use("/legal", legalRouter);
  // The managed upload PUT carries raw image bytes, not JSON.
  app.use("/api/media/uploads/:sessionId/bytes", express.raw({ type: () => true, limit: "6mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/auth", requireAppCheck, createD1AuthRouter(db, rateLimiters));
  app.use("/api/admin", createD1AdminRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminSupportRouter(db, admin.jwtSecret));
  app.use("/api/admin", createD1AdminReportsRouter(db, admin.jwtSecret));
  app.use("/api/users", createD1ProfileEditRouter(db));
  app.use("/api", createD1ProgressionRouter(db));
  app.use("/api/users/messages", createD1InboxRouter(db, limits.chat));
  app.use("/api", createD1SocialRouter(db));
  app.use("/api", createD1FeedRouter(db));
  app.use("/api", createD1StoriesRouter(db));
  app.use("/api", createD1HighlightsRouter(db));
  app.use("/api", createD1CosmeticsRouter(db, resolvePublicOrigin));
  app.use("/api", createD1WalletRouter(db, {
    payments: createD1PaymentProviders(wallet),
    devRecharge: wallet.devRecharge
  }));
  app.use("/api", createD1DirectGiftsRouter(db, wallet.diamondsEnabled));
  app.use("/api/clans", createD1ClansRouter(db, limits));
  app.use("/api/notifications", createD1NotificationRouter(db));
  app.use("/api/support", createD1SupportRouter(db, limits.create));
  app.use("/api/dating", createD1DatingRouter(db));
  app.use("/api", createD1ThemesRouter(db));
  app.use("/api/rooms", createD1RoomsRouter(db, limits.chat));
  app.use("/api/rooms", createD1RoomInvitesRouter(db));
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
  app.use("/api/bonds", createD1BondsRouter(db));
  app.use("/api", createD1LiveKitRouter(db, livekit));
  const access = createD1AccessSessionReader(db, "http");
  app.get("/api/games/catalog", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const { scores } = await readD1GameCatalog(db, user.id);
    sendOk(res, presentGameCatalog(scores));
  }));
  if (media) app.use("/api/media", createD1MediaRouter({ db, resolvePublicOrigin, ...media }));
  app.use((_req, res) => res.status(404).json({ ok: false, error: { message: "Route not found" } }));
  const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
    const { status, message, code } = responseError(error);
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("D1 API request failed", requestId, status);
    const errorBody = { message: status >= 500 ? "Unexpected server error" : message, code, requestId };
    res.status(status).json(req.path.startsWith("/api/admin")
      ? { success: false, error: errorBody }
      : { ok: false, error: errorBody });
  };
  app.use(errorHandler);
  return app;
}
