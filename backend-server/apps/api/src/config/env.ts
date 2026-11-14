import "dotenv/config";
import crypto from "node:crypto";
import { z } from "zod";

const PLACEHOLDER_SECRETS = new Set(["replace-me", "replace-me-admin-access", "replace-me-admin-refresh"]);

function resolveJwtSecret(value: string | undefined, nodeEnv: string): string {
  if (value && value.length >= 16 && !PLACEHOLDER_SECRETS.has(value)) return value;
  if (nodeEnv === "production") {
    const generated = crypto.randomBytes(32).toString("hex");
    console.warn(
      "WARNING: JWT_SECRET is not set. Generated an ephemeral secret; auth tokens will be invalidated on the next restart. " +
        "Set JWT_SECRET as a persistent environment variable (e.g. Render: Environment > Env Vars, or generateValue in render.yaml)."
    );
    return generated;
  }
  return "dev-only-jwt-secret-do-not-use-in-production";
}

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("Yugm"),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.preprocess(
    (v) => (typeof v === "string" && (v.length < 16 || PLACEHOLDER_SECRETS.has(v)) ? undefined : v),
    z.string().min(16, "JWT_SECRET must be at least 16 characters").optional()
  ),
  ADMIN_JWT_SECRET: z.string().min(8).optional(),
  ADMIN_REFRESH_SECRET: z.string().min(8).optional(),
  ADMIN_PANEL_ORIGIN: z.string().optional(),
  SEED_SUPER_ADMIN_EMAIL: z.string().email().optional(),
  SEED_SUPER_ADMIN_NAME: z.string().optional(),
  SEED_SUPER_ADMIN_FIREBASE_UID: z.string().optional(),
  SEED_SUPER_ADMIN_PASSWORD: z.string().min(8).optional(),
  ACCESS_TOKEN_TTL: z.string().default("45m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().min(1).max(365).default(60),
  TRUST_PROXY: z.string().optional(),
  APP_CHECK_ENFORCE: z.preprocess((v) => v === true || v === "true" || v === "1", z.boolean()).default(false),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_URL: z.string().default("ws://localhost:7880"),
  CORS_ORIGIN: z.string().default("*"),
  // Public Firebase project identifier, also present in the Android client's
  // google-services.json. Service-account credentials are optional at startup.
  FCM_PROJECT_ID: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
    z.string().default("yugm-e985e")
  ),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_PLAY_PACKAGE_NAME: z.preprocess(
    (v) => (typeof v === "string" && v.trim() ? v.trim() : undefined),
    z.string().default("com.yugm.app")
  ),
  GOOGLE_PLAY_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PLAY_PRIVATE_KEY: z.string().optional(),
  GOOGLE_PLAY_SUBS_ENABLED: z.preprocess((v) => v === true || v === "true" || v === "1", z.boolean()).default(false),
  GOOGLE_PLAY_PUBSUB_AUDIENCE: z.string().optional(),
  GOOGLE_PLAY_PUBSUB_SERVICE_ACCOUNT: z.string().optional(),
  MONETIZATION_DIAMONDS_ENABLED: z.preprocess((v) => v === true || v === "true" || v === "1", z.boolean()).default(false),
  PAYOUT_KYC_ENCRYPTION_KEY: z.string().min(24).optional(),
  STORAGE_DRIVER: z.enum(["local", "s3"]).default("local"),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional()
});

const parsed = envSchema.parse(process.env);
if (parsed.NODE_ENV === "production" && (!parsed.LIVEKIT_URL.startsWith("wss://") || !parsed.LIVEKIT_API_KEY || !parsed.LIVEKIT_API_SECRET)) {
  console.warn("LiveKit is not fully configured; the API will start, but voice/video room tokens will be unavailable.");
}
const jwtSecret = resolveJwtSecret(parsed.JWT_SECRET, parsed.NODE_ENV);
const deriveSecret = (purpose: string) =>
  crypto.createHmac("sha256", jwtSecret).update(`yugm:${purpose}:v1`).digest("hex");

// Keep admin signing keys separate from user tokens even when optional admin
// secrets are not configured in the hosting environment.
export const env = {
  ...parsed,
  TRUST_PROXY: parsed.TRUST_PROXY === undefined
    ? parsed.NODE_ENV === "production" ? 1 : false
    : parsed.TRUST_PROXY === "true" ? 1
      : parsed.TRUST_PROXY === "false" ? false
        : Number(parsed.TRUST_PROXY),
  JWT_SECRET: jwtSecret,
  ADMIN_JWT_SECRET: parsed.ADMIN_JWT_SECRET || deriveSecret("admin-access-token"),
  ADMIN_REFRESH_SECRET: parsed.ADMIN_REFRESH_SECRET || deriveSecret("admin-refresh-token")
};
