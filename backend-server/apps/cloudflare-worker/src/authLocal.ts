import { handleAsNodeRequest } from "cloudflare:node";
import type { D1Database, ExecutionContext } from "@cloudflare/workers-types";
import { createServer } from "node:http";
import process from "node:process";
import express, { type ErrorRequestHandler } from "express";

interface LocalAuthEnv {
  AUTH_DB: D1Database;
  YUGM_STAGE: string;
  JWT_SECRET?: string;
  FCM_PROJECT_ID?: string;
  GOOGLE_OAUTH_CLIENT_ID?: string;
  APP_CHECK_ENFORCE?: string;
  FCM_CLIENT_EMAIL?: string;
  FCM_PRIVATE_KEY?: string;
  MONGODB_URI?: string;
  REDIS_URL?: string;
}

const AUTH_PORT = 8789;
const loopbackHosts = new Set(["127.0.0.1", "localhost", "[::1]"]);
const forwardedSettings = [
  "JWT_SECRET", "FCM_PROJECT_ID", "GOOGLE_OAUTH_CLIENT_ID", "APP_CHECK_ENFORCE",
  "FCM_CLIENT_EMAIL", "FCM_PRIVATE_KEY"
] as const;
let startup: Promise<void> | undefined;

async function startAuthRuntime(env: LocalAuthEnv) {
  if (!env.FCM_PROJECT_ID?.trim()) throw new Error("Set the local Firebase project ID");
  const enforceAppCheck = env.APP_CHECK_ENFORCE === "true" || env.APP_CHECK_ENFORCE === "1";
  if (enforceAppCheck && (!env.FCM_CLIENT_EMAIL?.trim() || !env.FCM_PRIVATE_KEY?.trim())) {
    throw new Error("Local App Check requires test Firebase Admin credentials");
  }
  process.env.NODE_ENV = "production";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.YUGM_LOCAL_AUTH_ONLY = "true";
  for (const key of forwardedSettings) {
    if (env[key] === undefined) delete process.env[key];
    else process.env[key] = env[key];
  }

  const [{ createD1AuthRouter }, { createD1ProfileEditRouter }, { requireAppCheck }, { initFirebase }, { responseError }] = await Promise.all([
    import("../../api/src/migration/d1AuthRouter.js"),
    import("../../api/src/migration/d1ProfileEdits.js"),
    import("../../api/src/middleware/appCheck.js"),
    import("../../api/src/services/firebase.js"),
    import("../../api/src/utils/responseError.js")
  ]);
  if (enforceAppCheck) await initFirebase();
  const app = express();
  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use("/api/auth", requireAppCheck, createD1AuthRouter(env.AUTH_DB));
  app.use("/api/users", createD1ProfileEditRouter(env.AUTH_DB));
  app.use((_req, res) => res.status(404).json({ ok: false, error: { message: "Route not found" } }));
  const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
    const { status, message, code } = responseError(error);
    const requestId = crypto.randomUUID();
    if (status >= 500) console.error("Local Auth request failed", requestId, status);
    res.status(status).json({ ok: false, error: { message: status >= 500 ? "Unexpected server error" : message, code, requestId } });
  };
  app.use(errorHandler);
  const server = createServer(app);
  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(AUTH_PORT, resolve);
  });
}

export default {
  async fetch(request: Request, env: LocalAuthEnv, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    if (env.YUGM_STAGE !== "local" || !loopbackHosts.has(url.hostname)) {
      return Response.json({ ok: false }, { status: 404 });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return Response.json({ ok: true, service: "yugm-auth-local" });
    }
    if (env.MONGODB_URI || env.REDIS_URL || process.env.MONGODB_URI || process.env.REDIS_URL) {
      return Response.json({ ok: false, error: { message: "Use the isolated D1 configuration without legacy database bindings" } }, { status: 503 });
    }
    try {
      startup ??= startAuthRuntime(env).catch((error: unknown) => {
        startup = undefined;
        throw error;
      });
      await startup;
      if (request.method === "GET" && url.pathname === "/ready") {
        // Preparing these statements validates the draft tables on an empty database too.
        await env.AUTH_DB.batch([
          env.AUTH_DB.prepare("SELECT source_id, firebase_uid, token_version FROM users LIMIT 0"),
          env.AUTH_DB.prepare("SELECT source_id, token_version_present FROM auth_sessions LIMIT 0"),
          env.AUTH_DB.prepare("SELECT source_id, null_fields, missing_fields, edit_token FROM user_auth_profile LIMIT 0"),
          ...["device_tokens", "user_owned_cosmetics", "user_interests", "user_languages", "user_hobbies",
            "user_profile_media", "user_showcased_badges", "follows", "friendships", "bonds", "bond_users",
            "blocks", "trust_verifications", "profile_visits", "xp_grants", "seasons", "season_rewards", "battle_passes",
            "battle_pass_rewards", "battle_pass_xp_grants", "wallet_transactions", "notifications"]
            .map((table) => env.AUTH_DB.prepare(`SELECT source_id FROM ${table} LIMIT 0`))
        ]);
        return Response.json({ ok: true, service: "yugm-auth-local", storage: "d1" });
      }
      if (url.pathname.toLowerCase().startsWith("/api/users/")) {
        const { readD1ProfileRequest } = await import("../../api/src/migration/d1ProfileReads.js");
        const response = await readD1ProfileRequest(env.AUTH_DB, request, promise => ctx.waitUntil(promise));
        if (response) return response;
      }
      return await handleAsNodeRequest(AUTH_PORT, request);
    } catch (error) {
      console.error("Local Auth Worker unavailable", error instanceof Error ? error.name : "Error");
      return Response.json({ ok: false, error: { message: "Local D1 Auth is unavailable. Check its configuration and schema." } }, { status: 503 });
    }
  }
};
