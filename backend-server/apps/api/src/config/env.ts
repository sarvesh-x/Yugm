import crypto from "node:crypto";
import { z } from "zod";

// Cloudflare supplies runtime configuration through bindings, not a .env file.
// Keep dotenv available for local Node scripts without importing it in Workers.
if (process.env.YUGM_RUNTIME !== "cloudflare") {
  const dotenvConfig = "dotenv/" + "config";
  await import(dotenvConfig);
}

const PLACEHOLDER_SECRETS = new Set(["replace-me", "replace-me-admin-access", "replace-me-admin-refresh"]);

// Empty values in copied .env files must not become empty bucket names or secrets.
const optionalSetting = z.preprocess(
  (value) => (typeof value === "string" && value.trim() ? value.trim() : undefined),
  z.string().optional()
);

function resolveJwtSecret(value: string | undefined, nodeEnv: string): string {
  if (value && value.length >= 16 && !PLACEHOLDER_SECRETS.has(value)) return value;
  if (nodeEnv === "production") {
    throw new Error("JWT_SECRET must be configured as a persistent secret in production; refusing to invalidate tokens on restart");
  }
  return "dev-only-jwt-secret-do-not-use-in-production";
}

const envSchema = z.object({
  YUGM_BONDS_ENABLED: z.enum(['true', 'false']).transform(value => value === 'true').optional(),
  YUGM_BOND_SLOTS: z.coerce.number().int().min(1).max(12).default(3),
  NODE_ENV: z.string().default("development"),
  YUGM_RUNTIME: z.enum(["node", "cloudflare"]).default("node"),
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
  STORAGE_DRIVER: z.enum(["local", "s3", "mongodb"]).default("local"),
  MONGODB_MEDIA_MAX_BYTES: z.coerce.number().int().min(1).default(128 * 1024 * 1024),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
  S3_ENDPOINT: z.string().optional(),
  S3_ACCESS_KEY_ID: z.string().optional(),
  S3_SECRET_ACCESS_KEY: z.string().optional(),
  S3_PUBLIC_BASE_URL: z.string().optional(),
  // Cloudflare R2 is the canonical object store. These credentials are
  // server-only and must never be exposed to Android, admin or API responses.
  R2_ACCOUNT_ID: optionalSetting,
  R2_ACCESS_KEY_ID: optionalSetting,
  R2_SECRET_ACCESS_KEY: optionalSetting,
  R2_ASSETS_BUCKET: optionalSetting,
  R2_PUBLIC_MEDIA_BUCKET: optionalSetting,
  R2_PRIVATE_MEDIA_BUCKET: optionalSetting,
  R2_ORIGINALS_BUCKET: optionalSetting,
  R2_STAGING_BUCKET: optionalSetting,
  R2_ASSETS_PUBLIC_URL: optionalSetting,
  R2_MEDIA_PUBLIC_URL: optionalSetting,
  R2_SIGNED_URL_TTL_SECONDS: z.preprocess(
    (value) => (typeof value === "string" && !value.trim() ? undefined : value),
    z.coerce.number().int().min(60).max(3600).default(900)
  )
});

const parsed = envSchema.parse(process.env);

// R2 supplies an account-scoped S3 endpoint. Explicit S3_* values still win so
// existing deployments and local emulators keep their current behaviour.
const r2Endpoint = parsed.R2_ACCOUNT_ID
  ? `https://${parsed.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`
  : undefined;
const effectiveS3 = {
  S3_ENDPOINT: parsed.S3_ENDPOINT ?? r2Endpoint,
  S3_REGION: parsed.S3_REGION ?? (r2Endpoint ? "auto" : undefined),
  S3_ACCESS_KEY_ID: parsed.S3_ACCESS_KEY_ID ?? parsed.R2_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: parsed.S3_SECRET_ACCESS_KEY ?? parsed.R2_SECRET_ACCESS_KEY
};

if (parsed.STORAGE_DRIVER === "s3" && effectiveS3.S3_ENDPOINT && !parsed.S3_PUBLIC_BASE_URL &&
    !parsed.R2_ASSETS_PUBLIC_URL && !parsed.R2_MEDIA_PUBLIC_URL) {
  console.warn("R2/S3 storage uses a custom endpoint but no public base URL is set; public media uploads will fail until R2_ASSETS_PUBLIC_URL/R2_MEDIA_PUBLIC_URL or S3_PUBLIC_BASE_URL is configured.");
}
if (r2Endpoint && parsed.STORAGE_DRIVER !== "s3") {
  console.warn("R2 is configured but STORAGE_DRIVER is not 's3'; managed media uploads are disabled until it is enabled.");
}
if (parsed.NODE_ENV === "production" && parsed.YUGM_RUNTIME !== "cloudflare" && (!parsed.LIVEKIT_URL.startsWith("wss://") || !parsed.LIVEKIT_API_KEY || !parsed.LIVEKIT_API_SECRET)) {
  console.warn("LiveKit is not fully configured; the API will start, but voice/video room tokens will be unavailable.");
}
const jwtSecret = resolveJwtSecret(parsed.JWT_SECRET, parsed.NODE_ENV);
const deriveSecret = (purpose: string) =>
  crypto.createHmac("sha256", jwtSecret).update(`yugm:${purpose}:v1`).digest("hex");

// Keep admin signing keys separate from user tokens even when optional admin
// secrets are not configured in the hosting environment.
export const env = {
  ...parsed,
  S3_ENDPOINT: effectiveS3.S3_ENDPOINT,
  S3_REGION: effectiveS3.S3_REGION,
  S3_ACCESS_KEY_ID: effectiveS3.S3_ACCESS_KEY_ID,
  S3_SECRET_ACCESS_KEY: effectiveS3.S3_SECRET_ACCESS_KEY,
  TRUST_PROXY: parsed.TRUST_PROXY === undefined
    ? parsed.NODE_ENV === "production" ? 1 : false
    : parsed.TRUST_PROXY === "true" ? 1
      : parsed.TRUST_PROXY === "false" ? false
        : Number(parsed.TRUST_PROXY),
  JWT_SECRET: jwtSecret,
  ADMIN_JWT_SECRET: parsed.ADMIN_JWT_SECRET || deriveSecret("admin-access-token"),
  ADMIN_REFRESH_SECRET: parsed.ADMIN_REFRESH_SECRET || deriveSecret("admin-refresh-token")
};
