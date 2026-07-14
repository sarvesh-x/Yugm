import compression from "compression";
import cors from "cors";
import crypto from "node:crypto";
import express from "express";
import helmet from "helmet";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import { env } from "./config/env.js";
import { adminRouter } from "./routes/admin.js";
import { adminVerificationRouter } from "./routes/adminVerification.js";
import { authRouter } from "./routes/auth.js";
import { clansRouter } from "./routes/clans.js";
import { creatorRouter } from "./routes/creator.js";
import { datingRouter } from "./routes/dating.js";
import { experienceRouter } from "./routes/experience.js";
import { gamesRouter } from "./routes/games.js";
import { livekitRouter } from "./routes/livekit.js";
import { notificationsRouter } from "./routes/notifications.js";
import { pkRouter } from "./routes/pk.js";
import { reportsRouter } from "./routes/reports.js";
import { roomsRouter } from "./routes/rooms.js";
import { trustVerificationRouter } from "./routes/trustVerification.js";
import { uploadRouter } from "./routes/upload.js";
import { usersRouter } from "./routes/users.js";
import { walletRouter } from "./routes/wallet.js";
import { getJobHealth } from "./services/jobs.js";
import { getMetricsSnapshot, recordHttpRequest } from "./services/metrics.js";
import { getRedisHealth } from "./services/redis.js";
import { getStorageHealth } from "./services/storage.js";
import { ErrorCode, HttpError } from "./utils/http.js";

function responseError(error: unknown) {
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
    message: status >= 400 && status < 500 && error instanceof Error ? error.message : "Unexpected server error",
    code: status >= 400 && status < 500 ? ErrorCode.VALIDATION : ErrorCode.INTERNAL
  };
}

export function createApp() {
  const app = express();

  app.use(helmet());
  app.use(compression());
  // Request ID middleware for log correlation
  app.use((req, _res, next) => {
    (req as any).requestId = crypto.randomUUID();
    next();
  });
  // For production, CORS_ORIGIN must be an explicit URL, not "*", when credentials are enabled
  app.use(cors(env.CORS_ORIGIN === "*"
    ? { origin: "*", credentials: false }
    : { origin: env.CORS_ORIGIN.split(",").map((origin) => origin.trim()).filter(Boolean), credentials: true }));
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

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));

  // Serve the admin panel production build
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const adminDist = path.resolve(__dirname, "../../apps/admin/dist");
  app.use("/admin", express.static(adminDist, { index: false }));
  app.get("/admin/*", (_req, res) => {
    res.sendFile(path.join(adminDist, "index.html"));
  });

  app.get("/", (_req, res) => res.json({ ok: true, service: "yugm-api", health: "/health", api: "/api" }));
  const healthHandler = (_req: express.Request, res: express.Response) => {
    const mongoReady = mongoose.connection.readyState === 1;
    const redis = getRedisHealth();
    res.status(mongoReady ? 200 : 503).json({
      ok: mongoReady,
      service: "yugm-api",
      uptimeSeconds: Math.round(process.uptime()),
      db: {
        ready: mongoReady,
        name: mongoose.connection.name,
        state: mongoose.connection.readyState
      },
      redis,
      jobs: getJobHealth(),
      storage: getStorageHealth(),
      metrics: getMetricsSnapshot()
    });
  };
  app.get("/health", healthHandler);
  app.get("/api/health", healthHandler);
  app.use("/api/admin", adminVerificationRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/clans", clansRouter);
  app.use("/api/creator", creatorRouter);
  app.use("/api/dating", datingRouter);
  app.use("/api/experience", experienceRouter);
  app.use("/api/games", gamesRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/livekit", livekitRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api/pk", pkRouter);
  app.use("/api/trust-verification", trustVerificationRouter);
  app.use("/api", walletRouter);
  app.use("/api", uploadRouter);
  app.use("/api", reportsRouter);

  app.use((_req, res) => res.status(404).json({ ok: false, error: { message: "Route not found" } }));
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const { status, message, code } = responseError(error);
    console.error(JSON.stringify({
      level: "error",
      requestId: (req as any).requestId,
      method: req.method,
      path: req.path,
      status,
      code,
      message
    }));
    if (req.originalUrl.startsWith("/api/admin")) {
      res.status(status).json({ success: false, error: { message, code, requestId: (req as any).requestId } });
      return;
    }
    res.status(status).json({ ok: false, error: { message, code, requestId: (req as any).requestId } });
  });

  return app;
}
