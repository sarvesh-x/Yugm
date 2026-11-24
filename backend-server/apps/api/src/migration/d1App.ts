import type { D1Database } from "@cloudflare/workers-types";
import express, { type ErrorRequestHandler, type Request as ExpressRequest } from "express";
import { requireAppCheck } from "../middleware/appCheck.js";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import type { AuthRateLimiters } from "../routes/authSession.js";
import { presentGameCatalog } from "../services/gameCatalog.js";
import { asyncHandler, HttpError, sendOk } from "../utils/http.js";
import { responseError } from "../utils/responseError.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { createD1AuthRouter } from "./d1AuthRouter.js";
import { createD1ClansRouter } from "./d1Clans.js";
import { createD1CosmeticsRouter } from "./d1Cosmetics.js";
import { readD1GameCatalog } from "./d1GameCatalog.js";
import { createD1MediaRouter, type D1MediaRouterOptions } from "./d1Media.js";
import { createD1NotificationRouter } from "./d1Notifications.js";
import { createD1ProfileEditRouter } from "./d1ProfileEdits.js";
import { createD1RoomsRouter } from "./d1Rooms.js";

export function createD1App(
  db: D1Database,
  rateLimiters: AuthRateLimiters,
  media?: Pick<D1MediaRouterOptions, "buckets" | "grantSecret">
) {
  const resolvePublicOrigin = (request: ExpressRequest) => {
    // The fetch handler validates the origin and discards any incoming value.
    const value = request.header("x-yugm-request-origin");
    if (!value) throw new HttpError(400, "Media origin is unavailable");
    return value;
  };
  const app = express();
  app.disable("x-powered-by");
  // The managed upload PUT carries raw image bytes, not JSON.
  app.use("/api/media/uploads/:sessionId/bytes", express.raw({ type: () => true, limit: "6mb" }));
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/auth", requireAppCheck, createD1AuthRouter(db, rateLimiters));
  app.use("/api/users", createD1ProfileEditRouter(db));
  app.use("/api", createD1CosmeticsRouter(db, resolvePublicOrigin));
  app.use("/api/clans", createD1ClansRouter(db));
  app.use("/api/notifications", createD1NotificationRouter(db));
  app.use("/api/rooms", createD1RoomsRouter(db));
  const access = createD1AccessSessionReader(db, "http");
  app.get("/api/games/catalog", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const { scores } = await readD1GameCatalog(db, user.id);
    sendOk(res, presentGameCatalog(scores));
  }));
  if (media) app.use("/api/media", createD1MediaRouter({ db, resolvePublicOrigin, ...media }));
  app.use((_req, res) => res.status(404).json({ ok: false, error: { message: "Route not found" } }));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const { status, message, code } = responseError(error);
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("D1 API request failed", requestId, status);
    res.status(status).json({ ok: false, error: { message: status >= 500 ? "Unexpected server error" : message, code, requestId } });
  };
  app.use(errorHandler);
  return app;
}
