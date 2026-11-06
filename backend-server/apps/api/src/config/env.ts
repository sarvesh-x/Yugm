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
  DEV_BYPASS_OTP: z.string().optional(),
  LIVEKIT_API_KEY: z.string().optional(),
  LIVEKIT_API_SECRET: z.string().optional(),
  LIVEKIT_URL: z.string().default("ws://localhost:7880"),
  CORS_ORIGIN: z.string().default("*"),
  FCM_PROJECT_ID: z.string().optional(),
  FCM_CLIENT_EMAIL: z.string().optional(),
  FCM_PRIVATE_KEY: z.string().optional(),
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_KEY_SECRET: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  GOOGLE_PLAY_PACKAGE_NAME: z.string().optional(),
  GOOGLE_PLAY_CLIENT_EMAIL: z.string().optional(),
  GOOGLE_PLAY_PRIVATE_KEY: z.string().optional(),
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
const jwtSecret = resolveJwtSecret(parsed.JWT_SECRET, parsed.NODE_ENV);
const deriveSecret = (purpose: string) =>
  crypto.createHmac("sha256", jwtSecret).update(`yugm:${purpose}:v1`).digest("hex");

// Keep admin signing keys separate from user tokens even when optional admin
// secrets are not configured in the hosting environment.
export const env = {
  ...parsed,
  JWT_SECRET: jwtSecret,
  ADMIN_JWT_SECRET: parsed.ADMIN_JWT_SECRET || deriveSecret("admin-access-token"),
  ADMIN_REFRESH_SECRET: parsed.ADMIN_REFRESH_SECRET || deriveSecret("admin-refresh-token")
};
