import { handleAsNodeRequest } from "cloudflare:node";
import type { D1Database, ExecutionContext, R2Bucket } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import process from "node:process";
import express, { type ErrorRequestHandler, type Request as ExpressRequest } from "express";
import { HttpError } from "../../api/src/utils/http.js";
import { installCloudflareImageProcessor } from "./imageProcessor.js";

interface D1ApiEnv {
  AUTH_DB: D1Database;
  ASSETS: R2Bucket;
  PUBLIC_MEDIA: R2Bucket;
  PRIVATE_MEDIA: R2Bucket;
  ORIGINALS: R2Bucket;
  STAGING: R2Bucket;
  IMAGES: unknown;
  YUGM_STAGE: string;
  YUGM_PRODUCTION_ORIGIN?: string;
  YUGM_R2_ENABLED?: string;
  MEDIA_GRANT_SECRET?: string;
  JWT_SECRET?: string;
  FCM_PROJECT_ID?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  APP_CHECK_ENFORCE?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
  MONGODB_URI?: string;
  REDIS_URL?: string;
}

const D1_API_PORT = 8789;
type ApiStage = "local" | "production";
// Android's emulator aliases the host loopback interface to 10.0.2.2.
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "10.0.2.2"]);
const forwardedSettings = [
  "JWT_SECRET", "FCM_PROJECT_ID", "GOOGLE_OAUTH_CLIENT_ID", "APP_CHECK_ENFORCE",
  "FCM_CLIENT_EMAIL", "FCM_PRIVATE_KEY"
] as const;

function configuredProductionOrigin(value?: string) {
  if (!value || !URL.canParse(value)) return null;
  const url = new URL(value);
  if (url.protocol !== "https:" || !url.hostname.includes(".") ||
      url.hostname.endsWith(".invalid") || loopbackHosts.has(url.hostname) ||
      url.username || url.password || url.pathname !== "/" || url.search || url.hash) return null;
  return url.origin;
}

function mediaEnabled(env: D1ApiEnv, stage: ApiStage) {
  return stage === "local" || env.YUGM_R2_ENABLED === "true";
}

async function startD1Runtime(env: D1ApiEnv, stage: ApiStage) {
  if (!env.FCM_PROJECT_ID?.trim()) throw new Error("Set the Firebase project ID");
  const enforceAppCheck = env.APP_CHECK_ENFORCE === "true" || env.APP_CHECK_ENFORCE === "1";
  if (stage === "production" && !enforceAppCheck) throw new Error("Production requires Firebase App Check");
  if (enforceAppCheck && (!env.FCM_CLIENT_EMAIL?.trim() || !env.FCM_PRIVATE_KEY?.trim())) {
    throw new Error("App Check requires Firebase Admin credentials");
  }
  const mediaGrantSecret = stage === "production" ? env.MEDIA_GRANT_SECRET : randomBytes(32).toString("hex");
  if (mediaEnabled(env, stage) && (!mediaGrantSecret || mediaGrantSecret.length < 32 || mediaGrantSecret === env.JWT_SECRET)) {
    throw new Error("Managed media requires a separate persistent media grant secret");
  }
  process.env.NODE_ENV = "production";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.YUGM_D1_API = "true";
  for (const key of forwardedSettings) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }

  const [{ createD1AuthRouter }, { createD1ProfileEditRouter }, { createD1MediaRouter }, { createD1CosmeticsRouter },
    { createD1ClansRouter }, { createD1NotificationRouter }, { requireAppCheck }, { initFirebase }, { responseError }] = await Promise.all([
    import("../../api/src/migration/d1AuthRouter.js"),
    import("../../api/src/migration/d1ProfileEdits.js"),
    import("../../api/src/migration/d1Media.js"),
    import("../../api/src/migration/d1Cosmetics.js"),
    import("../../api/src/migration/d1Clans.js"),
    import("../../api/src/migration/d1Notifications.js"),
    import("../../api/src/middleware/appCheck.js"),
    import("../../api/src/services/firebase.js"),
    import("../../api/src/utils/responseError.js")
  ]);
  installCloudflareImageProcessor(env.IMAGES);
  if (enforceAppCheck) await initFirebase();
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
  app.use("/api/auth", requireAppCheck, createD1AuthRouter(env.AUTH_DB));
  app.use("/api/users", createD1ProfileEditRouter(env.AUTH_DB));
  app.use("/api", createD1CosmeticsRouter(env.AUTH_DB, resolvePublicOrigin));
  app.use("/api/clans", createD1ClansRouter(env.AUTH_DB));
  app.use("/api/notifications", createD1NotificationRouter(env.AUTH_DB));
  if (mediaEnabled(env, stage) && mediaGrantSecret) app.use("/api/media", createD1MediaRouter({
    db: env.AUTH_DB,
    buckets: {
      assets: env.ASSETS,
      "public-media": env.PUBLIC_MEDIA,
      "private-media": env.PRIVATE_MEDIA,
      originals: env.ORIGINALS,
      staging: env.STAGING
    },
    resolvePublicOrigin,
    grantSecret: mediaGrantSecret
  }));
  app.use((_req, res) => res.status(404).json({ ok: false, error: { message: "Route not found" } }));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const { status, message, code } = responseError(error);
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("D1 API request failed", requestId, status);
    res.status(status).json({ ok: false, error: { message: status >= 500 ? "Unexpected server error" : message, code, requestId } });
  };
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(D1_API_PORT, resolve);
  });
}

export function createD1ApiWorker(stage: ApiStage) {
  let startup: Promise<void> | undefined;
  const service = stage === "local" ? "yugm-auth-local" : "yugm-api";
  return {
    async fetch(request: Request, env: D1ApiEnv, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);
      const validOrigin = stage === "local" ? loopbackHosts.has(url.hostname) : url.origin === configuredProductionOrigin(env.YUGM_PRODUCTION_ORIGIN);
      if (env.YUGM_STAGE !== stage || !validOrigin) return Response.json({ ok: false }, { status: 404 });

      if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
        return Response.json({ ok: true, service });
      }
      if (env.MONGODB_URI || env.REDIS_URL || process.env.MONGODB_URI || process.env.REDIS_URL) {
        return Response.json({ ok: false, error: { message: "Use the isolated D1 configuration without legacy database bindings" } }, { status: 503 });
      }
      try {
        startup ??= startD1Runtime(env, stage).catch((error: unknown) => {
          startup = undefined;
          throw error;
        });
        await startup;
        if (request.method === "GET" && (url.pathname === "/ready" || url.pathname === "/api/ready")) {
          // Preparing these statements validates the draft tables on an empty database too.
          await env.AUTH_DB.batch([
            env.AUTH_DB.prepare("SELECT source_id, firebase_uid, token_version FROM users LIMIT 0"),
            env.AUTH_DB.prepare("SELECT source_id, token_version_present FROM auth_sessions LIMIT 0"),
            env.AUTH_DB.prepare("SELECT source_id, null_fields, missing_fields, edit_token FROM user_auth_profile LIMIT 0"),
            env.AUTH_DB.prepare("SELECT source_id, upload_token_hash FROM media_upload_sessions LIMIT 0"),
            env.AUTH_DB.prepare("SELECT source_id, seq FROM media_counters LIMIT 0"),
            ...["device_tokens", "user_owned_cosmetics", "user_interests", "user_languages", "user_hobbies",
              "user_profile_media", "user_showcased_badges", "follows", "friendships", "bonds", "bond_users",
              "blocks", "trust_verifications", "profile_visits", "xp_grants", "seasons", "season_rewards", "battle_passes",
              "battle_pass_rewards", "battle_pass_xp_grants", "wallet_transactions", "notifications",
              "media_objects", "media_variants", "media_quota_reservations", "cosmetics", "assets", "asset_variants",
              "gift_inventories", "gifts", "achievements", "user_claimed_achievement_tiers", "user_safety_statuses",
              "xp_daily_caps", "clans", "clan_members", "clan_member_roles", "clan_invites", "clan_messages",
              "clan_message_reactions", "mini_game_challenges"]
              .map((table) => env.AUTH_DB.prepare(`SELECT source_id FROM ${table} LIMIT 0`))
          ]);
          return Response.json({ ok: true, service, storage: "d1", managedMedia: mediaEnabled(env, stage) });
        }
        if (url.pathname.toLowerCase().startsWith("/api/users/")) {
          const { readD1ProfileRequest } = await import("../../api/src/migration/d1ProfileReads.js");
          const response = await readD1ProfileRequest(env.AUTH_DB, request, promise => ctx.waitUntil(promise));
          if (response) return response;
        }
        if (url.pathname.toLowerCase().startsWith("/api/media/") || url.pathname.startsWith("/api/assets/published/")) {
          if (!mediaEnabled(env, stage)) {
            return Response.json({ ok: false, error: { message: "Managed media is unavailable" } }, { status: 503 });
          }
        }
        if (url.pathname.startsWith("/api/assets/published/")) {
          const { readD1PublishedCosmeticAsset } = await import("../../api/src/migration/d1Cosmetics.js");
          const response = await readD1PublishedCosmeticAsset(env.AUTH_DB, env.ASSETS, request);
          if (response) return response;
        }
        const forwarded = new Request(request, { headers: new Headers(request.headers) });
        // The Worker knows the real caller host; Express must not derive it from a
        // client-supplied header when constructing managed upload URLs.
        forwarded.headers.set("x-yugm-request-origin", url.origin);
        return await handleAsNodeRequest(D1_API_PORT, forwarded);
      } catch (error) {
        console.error("D1 API Worker unavailable", error instanceof Error ? error.name : "Error");
        return Response.json({ ok: false, error: { message: "D1 API is unavailable. Check its configuration and schema." } }, { status: 503 });
      }
    }
  };
}
