import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "path";
import { env } from "./config/env.js";
import { authRouter } from "./routes/auth.js";
import { datingRouter } from "./routes/dating.js";
import { livekitRouter } from "./routes/livekit.js";
import { notificationsRouter } from "./routes/notifications.js";
import { reportsRouter } from "./routes/reports.js";
import { roomsRouter } from "./routes/rooms.js";
import { uploadRouter } from "./routes/upload.js";
import { usersRouter } from "./routes/users.js";
import { walletRouter } from "./routes/wallet.js";
import { ErrorCode, HttpError } from "./utils/http.js";

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
  app.use(cors({ origin: env.CORS_ORIGIN === "*" ? "*" : env.CORS_ORIGIN.split(","), credentials: true }));
  // WARNING: If adding multer file uploads, always validate file type/size and scope upload routes with auth
  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("dev"));

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
  app.get("/", (_req, res) => res.json({ ok: true, service: "yugm-api", health: "/health", api: "/api" }));
  app.get("/health", (_req, res) => res.json({ ok: true, service: "yugm-api" }));
  app.use("/api/auth", authRouter);
  app.use("/api/dating", datingRouter);
  app.use("/api/users", usersRouter);
  app.use("/api/rooms", roomsRouter);
  app.use("/api/livekit", livekitRouter);
  app.use("/api/notifications", notificationsRouter);
  app.use("/api", walletRouter);
  app.use("/api", uploadRouter);
  app.use("/api", reportsRouter);

  app.use((_req, res) => res.status(404).json({ ok: false, error: { message: "Route not found" } }));
  app.use((error: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    const status = error instanceof HttpError ? error.status : 500;
    const message = error instanceof Error ? error.message : "Unexpected server error";
    const code = error instanceof HttpError && error.code ? error.code : ErrorCode.INTERNAL;
    console.error(`[${(req as any).requestId}] ${message}`);
    res.status(status).json({ ok: false, error: { message, code, requestId: (req as any).requestId } });
  });

  return app;
}
