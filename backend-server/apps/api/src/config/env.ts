import "dotenv/config";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.string().default("development"),
  PORT: z.coerce.number().default(4000),
  MONGODB_URI: z.string().min(1, "MONGODB_URI is required"),
  MONGODB_DB_NAME: z.string().min(1).default("Yugm"),
  REDIS_URL: z.string().optional(),
  JWT_SECRET: z.string().min(16, "JWT_SECRET must be at least 16 characters"),
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

export const env = envSchema.parse(process.env);

if (!env.ADMIN_JWT_SECRET && env.NODE_ENV === "production") {
  console.warn("WARNING: ADMIN_JWT_SECRET is not set. Admin auth will fall back to JWT_SECRET.");
}
