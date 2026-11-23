import { bondsRouter } from "./routes/bonds.js";
import compression from "compression";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import { syncInvalidation } from "./middleware/syncInvalidation.js";
import helmet from "helmet";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { adminRouter } from "./routes/admin.js";
import { adminSupportRouter } from "./routes/adminSupport.js";
import { adminCosmeticsRouter } from "./routes/adminCosmetics.js";
import { adminAssetsRouter } from "./routes/adminAssets.js";
import { adminDmReviewsRouter } from "./routes/adminDmReviews.js";
import { adminMediaRouter } from "./routes/adminMedia.js";
import { adminReactionsRouter } from "./routes/adminReactions.js";
import { adminBadgesRouter, badgeArtRouter } from "./routes/adminBadges.js";
import { adminVerificationRouter } from "./routes/adminVerification.js";
import { authRouter } from "./routes/auth.js";
import { handlePayoutWebhook } from "./services/payoutWebhook.js";
import { clansRouter } from "./routes/clans.js";
import { creatorRouter } from "./routes/creator.js";
import { datingRouter } from "./routes/dating.js";
import { eventsRouter } from "./routes/events.js";
import { experienceRouter } from "./routes/experience.js";
import { feedRouter } from "./routes/feed.js";
import { friendsRouter } from "./routes/friends.js";
import { gamesRouter } from "./routes/games.js";
import { groupsRouter } from "./routes/groups.js";
import { livekitRouter } from "./routes/livekit.js";
import { notificationsRouter } from "./routes/notifications.js";
import { recordingsRouter } from "./routes/recordings.js";
import { pkRouter } from "./routes/pk.js";
import { referralsRouter } from "./routes/referrals.js";
import { reactionsRouter } from "./routes/reactions.js";
import { reportsRouter } from "./routes/reports.js";
import { roomModesRouter } from "./routes/roomModes.js";
import { roomThemesRouter } from "./routes/roomThemes.js";
import { roomsRouter } from "./routes/rooms.js";
import { storiesRouter } from "./routes/stories.js";
import { supportRouter } from "./routes/support.js";
import { watchPartyRouter } from "./routes/watchparty.js";
import { subscriptionRouter } from "./routes/subscriptions.js";
import { highlightsRouter } from "./routes/highlights.js";
import { trustVerificationRouter } from "./routes/trustVerification.js";
import { aiWingmanRouter } from "./routes/aiWingman.js";
import moderationRouter from "./routes/moderation.js";
import { vibeRouter } from "./routes/vibe.js";
import { discoverRouter } from "./routes/discover.js";
import { uploadRouter } from "./routes/upload.js";
import { mediaRouter } from "./routes/media.js";
import { usersRouter } from "./routes/users.js";
import { legalRouter } from "./routes/legal.js";
import { walletRouter } from "./routes/wallet.js";
import { giftLeaderboardRouter } from "./routes/giftLeaderboard.js";
import { giftsRouter } from "./routes/gifts.js";
import { socialRouter } from "./routes/social.js";
import { missionsRouter } from "./routes/missions.js";
import { battlePassRouter } from "./routes/battlePass.js";
import { wishlistRouter } from "./routes/wishlist.js";
import { getJobHealth } from "./services/jobs.js";
import { getImageProcessorHealth } from "./services/imageProcessor.js";
import { getMetricsSnapshot, recordHttpRequest } from "./services/metrics.js";
import { getRedisHealth } from "./services/redis.js";
import { getPublicMongoMedia, getStorageHealth } from "./services/storage.js";
import { asyncHandler, ErrorCode, HttpError } from "./utils/http.js";
import { requireAppCheck } from "./middleware/appCheck.js";

function responseError(error: unknown) {
  if (typeof error === "object" && error !== null && "code" in error && error.code === "LIMIT_FILE_SIZE") {
    return { status: 413, message: "Uploaded file is too large", code: ErrorCode.VALIDATION };
  }
  if (error instanceof HttpError) {
    return {
      status: error.status,
      message: error.message,
      code: error.code ?? ErrorCode.INTERNAL
    };
  }
  if (error instanceof mongoose.Error.CastError) {
    return {
      status: 400,
      message: "Invalid identifier",
      code: ErrorCode.VALIDATION
    };
  }
  if (error instanceof mongoose.Error.ValidationError) {
    return {
      status: 400,
      message: error.message,
      code: ErrorCode.VALIDATION
    };
  }
  const maybeHttp = error as { message?: unknown; status?: unknown; statusCode?: unknown; type?: unknown };
  if (maybeHttp.type === "entity.parse.failed") {
    return {
      status: 400,
      message: "Invalid JSON body",
      code: ErrorCode.VALIDATION
    };
  }
  const status = typeof maybeHttp.status === "number"
    ? maybeHttp.status
    : typeof maybeHttp.statusCode === "number"
      ? maybeHttp.statusCode
      : 500;
  return {
    status: status >= 400 && status < 600 ? status : 500,
    message: status >= 400 && status < 500
        ? typeof error === "object" && error != null && "message" in error
          ? (error as { message?: unknown }).message
          : "Unexpected server error"
        : error instanceof Error
          ? error.message
          : "Unexpected server error",
    code: status >= 400 && status < 500 ? ErrorCode.VALIDATION : ErrorCode.INTERNAL
  };
}

export function createApp() {
  const app = express();

  app.set("trust proxy", env.TRUST_PROXY);

  app.use(helmet());
  // Workers manage content encoding; applying Node compression here can
  // return encoded bytes without matching headers through the HTTP bridge.
  if (env.YUGM_RUNTIME !== "cloudflare") app.use(compression());
  // Request ID middleware for log correlation
  app.use((req, _res, next) => {
    (req as any).requestId = crypto.randomUUID();
    next();
  });
  // For production, CORS_ORIGIN must be an explicit URL, not "*", when credentials are enabled
  app.use(cors(env.CORS_ORIGIN === "*"
    ? { origin: "*", credentials: false }
    : { origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean), credentials: true }));
  // Webhook route needs raw body for signature verification (before express.json)
  app.post("/api/payments/webhook/payout", express.raw({ type: "application/json" }), handlePayoutWebhook);

  // WARNING: If adding multer file uploads, always validate file type/size and scope upload routes with auth
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    const start = Date.now();
    res.on("finish", () => {
      const ms = Date.now() - start;
      recordHttpRequest(req.method, req.path, res.statusCode, ms);
      if (res.statusCode >= 400 || ms > 750) {
        console.log(JSON.stringify({
          level: res.statusCode >= 500 ? "error" : "info",
          requestId: (req as any).requestId,
          method: req.method,
          path: req.path,
          statusCode: res.statusCode,
          durationMs: ms
        }));
      }
    });
    next();
  });

  if (env.STORAGE_DRIVER === "mongodb") {
    app.get("/uploads/:fileName", asyncHandler(async (req, res) => {
      const media = await getPublicMongoMedia(req.params.fileName);
      if (!media) throw new HttpError(404, "Media not found", ErrorCode.NOT_FOUND);
      const { file, bucket } = media;
      const size = file.length;
      let start = 0;
      let end = size - 1;
      const range = req.headers.range;
      if (range) {
        const match = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!match || (!match[1] && !match[2]) || size === 0) {
          res.setHeader("Content-Range", `bytes */${size}`);
          return res.sendStatus(416);
        }
        if (!match[1]) {
          const suffix = Number(match[2]);
          if (!Number.isSafeInteger(suffix) || suffix <= 0) {
            res.setHeader("Content-Range", `bytes */${size}`);
            return res.sendStatus(416);
          }
          start = Math.max(0, size - suffix);
        } else {
          start = Number(match[1]);
          if (match[2]) end = Number(match[2]);
        }
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start >= size || end < start) {
          res.setHeader("Content-Range", `bytes */${size}`);
          return res.sendStatus(416);
        }
        end = Math.min(end, size - 1);
        res.status(206).setHeader("Content-Range", `bytes ${start}-${end}/${size}`);
      }
      res.setHeader("Accept-Ranges", "bytes");
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      res.setHeader("Content-Type", file.metadata?.contentType ?? "application/octet-stream");
      res.setHeader("Content-Length", size === 0 ? 0 : end - start + 1);
      if (size === 0) return res.end();
      const stream = bucket.openDownloadStream(file._id, { start, end: end + 1 });
      stream.on("error", (error) => res.destroy(error));
      stream.pipe(res);
    }));
  }

  if (env.YUGM_RUNTIME !== "cloudflare") {
    const __dirname = path.dirname(fileURLToPath(import.meta.url));
    if (env.STORAGE_DRIVER !== "mongodb") {
      // Uploaded file names are content-unique; let clients and the edge cache
      // them instead of re-downloading on every list render.
      app.use("/uploads", express.static(path.join(process.cwd(), "uploads"), { maxAge: "365d", immutable: true }));
    }
    app.use("/assets", express.static(path.resolve(__dirname, "../public")));

    // The admin UI is hosted independently on Cloudflare Pages in the
    // Workers deployment; keep the static mount for local Node development.
    const adminDist = path.resolve(__dirname, "../../admin/dist");
    app.use("/admin", express.static(adminDist, { index: false }));
    app.get("/admin/*", (_req, res) => {
      res.sendFile(path.join(adminDist, "index.html"));
    });
  }

  app.get("/", (_req, res) => res.json({ ok: true, service: "yugm-api", version: "0.1.0", health: "/health", api: "/api" }));
  app.use("/legal", legalRouter);
  // API root — declared before routers so unauthenticated discovery requests don't 401
  app.get("/api", (_req, res) => res.json({
    ok: true,
    service: "yugm-api",
    version: "0.1.0",
    environment: env.NODE_ENV,
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
  // Liveness answers without touching infrastructure. Readiness below is the
  // endpoint callers and deployment probes should use for dependency checks.
  const livenessHandler = (_req: express.Request, res: express.Response) => {
    res.status(200).json({
      ok: true,
      service: "yugm-api",
      version: "0.1.0",
      runtime: env.YUGM_RUNTIME,
      uptimeSeconds: Math.round(process.uptime()),
      ready: "/ready"
    });
  };
  app.get("/health", livenessHandler);
  app.get("/api/health", livenessHandler);

  const readinessHandler = (_req: express.Request, res: express.Response) => {
    const mongoReady = mongoose.connection.readyState === 1;
    const storage = getStorageHealth();
    const images = getImageProcessorHealth();
    // Redis and queue mode are reported but not required: both hosts support
    // an inline fallback. Database, storage and image processing are required.
    const ready = mongoReady && storage.ready && images.configured;
    res.status(ready ? 200 : 503).json({
      ok: ready,
      ready,
      service: "yugm-api",
      uptimeSeconds: Math.round(process.uptime()),
      db: {
        ready: mongoReady,
        name: mongoose.connection.name,
        state: mongoose.connection.readyState
      },
      redis: getRedisHealth(),
      jobs: getJobHealth(),
      storage,
      images,
      metrics: getMetricsSnapshot()
    });
  };
  app.get("/ready", readinessHandler);
  app.get("/api/ready", readinessHandler);
  app.use("/api", syncInvalidation);
  app.use("/api/admin", adminVerificationRouter);
  app.use("/api/admin", adminDmReviewsRouter);
  app.use("/api/admin", adminMediaRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/admin", adminSupportRouter);
  app.use("/api/admin", adminCosmeticsRouter);
  app.use("/api/admin", adminAssetsRouter);
  app.use("/api/admin", adminBadgesRouter);
  app.use("/api/admin", adminReactionsRouter);
  app.use("/api/badge-art", badgeArtRouter);
  app.use("/api/auth", requireAppCheck, authRouter);
  app.use("/api/clans", clansRouter);
  app.use("/api/creator", creatorRouter);
  app.use("/api/dating", datingRouter);
  app.use("/api/events", eventsRouter); // Preserve older double-prefixed clients.
  app.use("/api", eventsRouter); // Android's canonical /api/events endpoints.
  app.use("/api/bonds", bondsRouter);
  app.use("/api/experience", experienceRouter);
  app.use("/api", feedRouter);
  app.use("/api", friendsRouter);
  app.use("/api/games", gamesRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/rooms", roomModesRouter);
  app.use("/api", roomThemesRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/livekit", livekitRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/pk", pkRouter);
  app.use("/api/recordings", recordingsRouter);
  app.use("/api/trust-verification", trustVerificationRouter);
  app.use("/api", walletRouter);
  app.use("/api", giftLeaderboardRouter);
  app.use("/api", wishlistRouter);
  app.use("/api", giftsRouter);
  app.use("/api", mediaRouter);
  app.use("/api", uploadRouter);
  app.use("/api", reportsRouter);
  app.use("/api", reactionsRouter);
  app.use("/api", storiesRouter);
  app.use("/api", watchPartyRouter);
  app.use("/api", referralsRouter);
  app.use("/api", groupsRouter);
  app.use("/api/support", supportRouter);
  app.use("/api", subscriptionRouter);
  app.use("/api", highlightsRouter);
  app.use("/api/ai", aiWingmanRouter);
  app.use("/api", vibeRouter);
  app.use("/api", discoverRouter);
  app.use("/api", socialRouter);
  app.use("/api", moderationRouter);
  app.use("/api", missionsRouter);
  app.use("/api", battlePassRouter);

  app.use((_req, res) => res.status(404).json({ ok: false, error: { message: "Route not found" } }));
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, message, code } = responseError(error);
    console.error(JSON.stringify({
      level: "error",
      event: "request_error",
      runtime: env.YUGM_RUNTIME,
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      status,
      code,
      errorName: error instanceof Error ? error.name : "Error",
      message,
      ...(env.NODE_ENV === "production" || !(error instanceof Error) || !error.stack
        ? {}
        : { stack: error.stack })
    }));
    if (req.originalUrl.startsWith("/api/admin")) {
      res.status(status).json({ success: false, error: { message, code, requestId: (req as any).requestId } });
      return;
    }
    res.status(status).json({ ok: false, error: { message, code, requestId: (req as any).requestId } });
  });

  return app;
}
