import { handleAsNodeRequest } from "cloudflare:node";
import type { D1Database, ExecutionContext, R2Bucket, RateLimit, ScheduledController } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { createServer } from "node:http";
import { isIP } from "node:net";
import process from "node:process";
import { runD1Maintenance } from "../../api/src/migration/d1Maintenance.js";
import { createFcmSender, deliverD1PushJobs } from "../../api/src/migration/d1NotificationPush.js";
import { authClientIpHeader, createWorkerAuthRateLimiters, type AuthRateLimitBindings } from "./authRateLimit.js";
import { installCloudflareImageProcessor } from "./imageProcessor.js";

interface D1ApiEnv extends AuthRateLimitBindings {
  CHAT_SEND?: RateLimit;
  REPORT_REQUESTS?: RateLimit;
  CREATE_REQUESTS?: RateLimit;
  GIFT_SEND?: RateLimit;
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
  YUGM_FCM_PUSH_ENABLED?: string;
  YUGM_BONDS_ENABLED?: string;
  YUGM_BOND_SLOTS?: string;
  MONETIZATION_DIAMONDS_ENABLED?: string;
  MEDIA_GRANT_SECRET?: string;
  JWT_SECRET?: string;
  ADMIN_JWT_SECRET?: string;
  ADMIN_REFRESH_SECRET?: string;
  ADMIN_FIREBASE_WEB_API_KEY?: string;
  ADMIN_PANEL_ORIGIN?: string;
  FCM_PROJECT_ID?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  APP_CHECK_ENFORCE?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
  LIVEKIT_API_KEY?: string;
  LIVEKIT_API_SECRET?: string;
  LIVEKIT_URL?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  GOOGLE_PLAY_PACKAGE_NAME?: string;
  GOOGLE_PLAY_CLIENT_EMAIL?: string;
  GOOGLE_PLAY_PRIVATE_KEY?: string;
  PAYOUT_KYC_ENCRYPTION_KEY?: string;
  MONGODB_URI?: string;
  REDIS_URL?: string;
}

const D1_API_PORT = 8789;
type ApiStage = "local" | "production";
// Android's emulator aliases the host loopback interface to 10.0.2.2.
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]", "10.0.2.2"]);
const localAdminOrigins = new Set(["http://127.0.0.1:5173", "http://localhost:5173"]);
const adminAllowedMethods = "GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS";
const adminAllowedHeaders = "Authorization, Content-Type, Idempotency-Key, X-Approval-Admin-Token";
const forwardedSettings = [
  "JWT_SECRET", "ADMIN_JWT_SECRET", "FCM_PROJECT_ID", "GOOGLE_OAUTH_CLIENT_ID", "APP_CHECK_ENFORCE",
  "FCM_CLIENT_EMAIL", "FCM_PRIVATE_KEY", "LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL",
  "YUGM_BONDS_ENABLED", "YUGM_BOND_SLOTS"
] as const;

class D1SetupError extends Error {
  constructor(readonly code: "D1_CONFIG_REQUIRED" | "D1_SCHEMA_UNAVAILABLE", message: string) {
    super(message);
  }
}

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

async function checkD1Schema(db: D1Database) {
  try {
    // Preparing these statements validates the draft tables on an empty database too.
    await db.batch([
      db.prepare("SELECT source_id, firebase_uid, token_version FROM users LIMIT 0"),
      db.prepare("SELECT source_id, token_version_present FROM auth_sessions LIMIT 0"),
      db.prepare("SELECT source_id, null_fields, missing_fields, edit_token FROM user_auth_profile LIMIT 0"),
      db.prepare("SELECT source_id, upload_token_hash, staging_cleaned_at FROM media_upload_sessions LIMIT 0"),
      db.prepare("SELECT source_id, seq FROM media_counters LIMIT 0"),
      db.prepare("SELECT pair_key, day, amount FROM relationship_message_xp_daily LIMIT 0"),
      db.prepare("SELECT " + ["device_tokens", "user_owned_cosmetics", "user_interests", "user_languages", "user_hobbies",
        "user_profile_media", "user_showcased_badges", "follows", "friendships", "bonds", "bond_users",
        "blocks", "trust_verifications", "profile_visits", "xp_grants", "seasons", "season_rewards", "battle_passes",
        "battle_pass_rewards", "battle_pass_xp_grants", "wallet_transactions", "notifications",
        "media_objects", "media_variants", "media_quota_reservations", "cosmetics", "assets", "asset_variants",
        "gift_inventories", "gifts", "achievements", "user_claimed_achievement_tiers", "user_safety_statuses",
        "xp_daily_caps", "clans", "clan_members", "clan_member_roles", "clan_invites", "clan_messages",
        "clan_message_reactions", "reports", "mini_game_challenges", "mini_game_scores", "rooms", "room_follows", "room_invites",
        "room_speakers", "room_moderators", "room_admins", "room_cohosts", "room_locked_seats", "room_participants",
        "speaker_requests", "chat_messages", "room_activities", "direct_messages", "direct_message_reactions",
        "message_hidden_for", "conversation_mutes", "pk_battles", "matches", "match_users",
        "relationships", "relationship_users", "purchases", "diamond_transactions", "support_tickets"]
        .map(table => `(SELECT source_id FROM ${table} LIMIT 0) AS ${table}`).join(", ")),
      db.prepare("SELECT notification_id, device_id FROM notification_push_jobs LIMIT 0"),
      db.prepare("SELECT sender_id, sender_admin_id FROM support_ticket_messages LIMIT 0")
    ]);
  } catch {
    throw new D1SetupError("D1_SCHEMA_UNAVAILABLE", "The local D1 schema is missing or out of date. Check the emulator setup instructions.");
  }
}

function configureD1Runtime(env: D1ApiEnv) {
  process.env.NODE_ENV = "production";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.YUGM_D1_API = "true";
  for (const key of forwardedSettings) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }
}

async function startD1Runtime(env: D1ApiEnv, stage: ApiStage) {
  if (![env.AUTH_REQUESTS, env.AUTH_IDENTIFIER, env.AUTH_REFRESH].every(binding => typeof binding?.limit === "function")) {
    throw new D1SetupError("D1_CONFIG_REQUIRED", "Auth rate limit bindings are missing. Restart Wrangler with the current auth-local/wrangler.jsonc.");
  }
  if (!env.FCM_PROJECT_ID?.trim() || (env.JWT_SECRET?.trim().length ?? 0) < 16) {
    throw new D1SetupError("D1_CONFIG_REQUIRED", "Set FCM_PROJECT_ID and a persistent JWT_SECRET in auth-local/.dev.vars, then restart Wrangler.");
  }
  if (stage === "local") await checkD1Schema(env.AUTH_DB);
  const rateLimiters = createWorkerAuthRateLimiters(env);
  const enforceAppCheck = env.APP_CHECK_ENFORCE === "true" || env.APP_CHECK_ENFORCE === "1";
  if (stage === "production" && !enforceAppCheck) throw new Error("Production requires Firebase App Check");
  if (enforceAppCheck && (!env.FCM_CLIENT_EMAIL?.trim() || !env.FCM_PRIVATE_KEY?.trim())) {
    throw new Error("App Check requires Firebase Admin credentials");
  }
  const mediaGrantSecret = stage === "production" ? env.MEDIA_GRANT_SECRET : randomBytes(32).toString("hex");
  if (mediaEnabled(env, stage) && (!mediaGrantSecret || mediaGrantSecret.length < 32 || mediaGrantSecret === env.JWT_SECRET)) {
    throw new Error("Managed media requires a separate persistent media grant secret");
  }
  configureD1Runtime(env);

  const [{ createD1App }, { initFirebase }] = await Promise.all([
    import("../../api/src/migration/d1App.js"),
    import("../../api/src/services/firebase.js")
  ]);
  installCloudflareImageProcessor(env.IMAGES);
  if (enforceAppCheck) await initFirebase();
  const limitByUser = (binding?: RateLimit) => binding && (async (userId: string) => (await binding.limit({ key: userId })).success);
  const app = createD1App(env.AUTH_DB, rateLimiters, mediaEnabled(env, stage) && mediaGrantSecret ? {
    buckets: {
      assets: env.ASSETS,
      "public-media": env.PUBLIC_MEDIA,
      "private-media": env.PRIVATE_MEDIA,
      originals: env.ORIGINALS,
      staging: env.STAGING
    },
    grantSecret: mediaGrantSecret
  } : undefined, {
    chat: limitByUser(env.CHAT_SEND), report: limitByUser(env.REPORT_REQUESTS),
    create: limitByUser(env.CREATE_REQUESTS), gift: limitByUser(env.GIFT_SEND)
  }, {
    apiKey: env.LIVEKIT_API_KEY,
    apiSecret: env.LIVEKIT_API_SECRET,
    url: env.LIVEKIT_URL,
    production: stage === "production"
  }, {
    razorpayKeyId: env.RAZORPAY_KEY_ID,
    razorpayKeySecret: env.RAZORPAY_KEY_SECRET,
    googlePlayPackageName: env.GOOGLE_PLAY_PACKAGE_NAME,
    googlePlayClientEmail: env.GOOGLE_PLAY_CLIENT_EMAIL,
    googlePlayPrivateKey: env.GOOGLE_PLAY_PRIVATE_KEY,
    production: stage === "production",
    devRecharge: stage === "local",
    diamondsEnabled: env.MONETIZATION_DIAMONDS_ENABLED === "true" || env.MONETIZATION_DIAMONDS_ENABLED === "1",
    payoutKycEncryptionKey: env.PAYOUT_KYC_ENCRYPTION_KEY,
    payoutWebhookSecret: env.RAZORPAY_WEBHOOK_SECRET
  }, {
    jwtSecret: env.ADMIN_JWT_SECRET ?? env.JWT_SECRET,
    refreshSecret: env.ADMIN_REFRESH_SECRET,
    firebaseApiKey: env.ADMIN_FIREBASE_WEB_API_KEY,
    production: stage === "production"
  }, createWorkerAuthRateLimiters(env, "admin:"));
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
    async scheduled(controller: ScheduledController, env: D1ApiEnv) {
      if (env.YUGM_STAGE !== stage || env.MONGODB_URI || env.REDIS_URL) return;
      if (stage === "production" && !configuredProductionOrigin(env.YUGM_PRODUCTION_ORIGIN)) return;
      const now = new Date(Math.min(controller.scheduledTime, Date.now()));
      if (controller.cron === "*/15 * * * *") {
        await runD1Maintenance(env.AUTH_DB, now, mediaEnabled(env, stage) ? env.STAGING : undefined);
      }
      if (controller.cron === "* * * * *" && env.YUGM_FCM_PUSH_ENABLED === "true" && env.FCM_PROJECT_ID &&
        env.FCM_CLIENT_EMAIL && env.FCM_PRIVATE_KEY) {
        configureD1Runtime(env);
        const { initFirebase, getFirebaseAccessToken } = await import("../../api/src/services/firebase.js");
        await initFirebase();
        await deliverD1PushJobs(env.AUTH_DB, now, createFcmSender(env.FCM_PROJECT_ID, getFirebaseAccessToken));
      }
    },
    async fetch(request: Request, env: D1ApiEnv, ctx: ExecutionContext): Promise<Response> {
      const url = new URL(request.url);
      const validOrigin = stage === "local" ? loopbackHosts.has(url.hostname) : url.origin === configuredProductionOrigin(env.YUGM_PRODUCTION_ORIGIN);
      if (env.YUGM_STAGE !== stage || !validOrigin) return Response.json({ ok: false }, { status: 404 });
      const adminRequest = /^\/api\/admin(?:\/|$)/i.test(url.pathname);
      const requestOrigin = request.headers.get("Origin");
      const allowedOrigin = adminRequest && requestOrigin && (stage === "local"
        ? localAdminOrigins.has(requestOrigin) : requestOrigin === configuredProductionOrigin(env.ADMIN_PANEL_ORIGIN))
        ? requestOrigin : null;
      const adminResponse = (response: Response) => {
        if (!adminRequest) return response;
        const headers = new Headers(response.headers);
        headers.append("Vary", "Origin");
        headers.set("Cache-Control", "private, no-store");
        if (allowedOrigin) headers.set("Access-Control-Allow-Origin", allowedOrigin);
        return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
      };
      if (adminRequest && request.method === "OPTIONS" && requestOrigin) {
        if (!allowedOrigin) return adminResponse(new Response(null, { status: 403 }));
        return adminResponse(new Response(null, { status: 204, headers: {
          "Access-Control-Allow-Methods": adminAllowedMethods,
          "Access-Control-Allow-Headers": adminAllowedHeaders,
          "Access-Control-Max-Age": "600"
        } }));
      }

      if (request.method === "GET" && (url.pathname === "/health" || url.pathname === "/api/health")) {
        return Response.json({ ok: true, service });
      }
      if (env.MONGODB_URI || env.REDIS_URL || process.env.MONGODB_URI || process.env.REDIS_URL) {
        return adminResponse(Response.json({ ok: false, error: { message: "Use the isolated D1 configuration without legacy database bindings" } }, { status: 503 }));
      }
      try {
        startup ??= startD1Runtime(env, stage).catch((error: unknown) => {
          startup = undefined;
          throw error;
        });
        await startup;
        if (request.method === "GET" && (url.pathname === "/ready" || url.pathname === "/api/ready")) {
          await checkD1Schema(env.AUTH_DB);
          return Response.json({ ok: true, service, storage: "d1", managedMedia: mediaEnabled(env, stage) });
        }
        if (url.pathname.toLowerCase().startsWith("/api/users/")) {
          const { readD1ProfileRequest } = await import("../../api/src/migration/d1ProfileReads.js");
          const response = await readD1ProfileRequest(env.AUTH_DB, request, promise => ctx.waitUntil(promise));
          if (response) return response;
        }
        if (url.pathname.toLowerCase().startsWith("/api/media/") ||
            url.pathname.toLowerCase().startsWith("/api/upload/cover") ||
            url.pathname.toLowerCase().startsWith("/api/upload/profile-media") ||
            url.pathname.toLowerCase().startsWith("/api/upload/story") ||
            url.pathname.toLowerCase().startsWith("/api/upload/voice-note") ||
            url.pathname.toLowerCase().startsWith("/api/upload/recording") ||
            url.pathname.startsWith("/api/assets/published/")) {
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
        const connectingIp = request.headers.get("CF-Connecting-IP") ?? "";
        forwarded.headers.set(authClientIpHeader, stage === "local" ? "loopback" : isIP(connectingIp) ? connectingIp : "unknown");
        return adminResponse(await handleAsNodeRequest(D1_API_PORT, forwarded));
      } catch (error) {
        const detail = error instanceof D1SetupError ? error.code : error instanceof Error ? error.name : "Error";
        console.error("D1 API Worker unavailable", detail);
        if (stage === "local" && error instanceof D1SetupError) {
          return adminResponse(Response.json({ ok: false, error: { code: error.code, message: error.message } }, { status: 503 }));
        }
        return adminResponse(Response.json({ ok: false, error: { message: "D1 API is unavailable. Check its configuration and schema." } }, { status: 503 }));
      }
    }
  };
}
