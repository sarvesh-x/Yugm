import "dotenv/config";

type EnvKey = {
  key: string;
  group: string;
  required: boolean;
  note?: string;
};

const keys: EnvKey[] = [
  { key: "PORT", group: "startup", required: false, note: "defaults to 4000" },
  { key: "MONGODB_URI", group: "startup", required: true },
  { key: "MONGODB_DB_NAME", group: "startup", required: false, note: "defaults to Yugm" },
  { key: "JWT_SECRET", group: "auth", required: false, note: "set a strong value outside local dev" },
  { key: "ADMIN_JWT_SECRET", group: "admin", required: false, note: "set a strong admin access token secret in production" },
  { key: "ADMIN_REFRESH_SECRET", group: "admin", required: false, note: "set a strong admin refresh token secret in production" },
  { key: "ADMIN_PANEL_ORIGIN", group: "admin", required: false, note: "admin web origin allowlist" },
  { key: "SEED_SUPER_ADMIN_EMAIL", group: "admin", required: false, note: "used by npm run seed:admin" },
  { key: "SEED_SUPER_ADMIN_NAME", group: "admin", required: false, note: "used by npm run seed:admin" },
  { key: "SEED_SUPER_ADMIN_FIREBASE_UID", group: "admin", required: false, note: "Firebase admin login binding" },
  { key: "SEED_SUPER_ADMIN_PASSWORD", group: "admin", required: false, note: "local/backend admin password seed" },
  { key: "DEV_BYPASS_OTP", group: "auth", required: false, note: "dev-only OTP bypass" },
  { key: "LIVEKIT_API_KEY", group: "livekit", required: false, note: "required for media tokens" },
  { key: "LIVEKIT_API_SECRET", group: "livekit", required: false, note: "required for media tokens" },
  { key: "LIVEKIT_URL", group: "livekit", required: false, note: "defaults to ws://localhost:7880" },
  { key: "FCM_PROJECT_ID", group: "firebase", required: false, note: "required for Google/Phone auth and push" },
  { key: "FCM_CLIENT_EMAIL", group: "firebase", required: false, note: "required for Google/Phone auth and push" },
  { key: "FCM_PRIVATE_KEY", group: "firebase", required: false, note: "required for Google/Phone auth and push" },
  { key: "RAZORPAY_KEY_ID", group: "payments", required: false, note: "required for Razorpay orders" },
  { key: "RAZORPAY_KEY_SECRET", group: "payments", required: false, note: "required for Razorpay verification" },
  { key: "GOOGLE_PLAY_PACKAGE_NAME", group: "payments", required: false, note: "required for Google Play purchases" },
  { key: "GOOGLE_PLAY_CLIENT_EMAIL", group: "payments", required: false, note: "required for Google Play purchases" },
  { key: "GOOGLE_PLAY_PRIVATE_KEY", group: "payments", required: false, note: "required for Google Play purchases" },
  { key: "REDIS_URL", group: "cache", required: false, note: "leave blank to disable Redis locally" },
  { key: "CORS_ORIGIN", group: "http", required: false, note: "defaults to *" }
];

function statusFor(key: string) {
  if (!(key in process.env)) return "MISSING";
  return String(process.env[key]).trim() ? "SET" : "BLANK";
}

const rows = keys.map((item) => ({
  group: item.group,
  key: item.key,
  status: statusFor(item.key),
  required: item.required ? "yes" : "feature/default",
  note: item.note ?? ""
}));

console.table(rows);

const missingRequired = rows.filter((row) => row.required === "yes" && row.status !== "SET");
if (missingRequired.length) {
  console.error(`Required env missing: ${missingRequired.map((row) => row.key).join(", ")}`);
  process.exit(1);
}

const isProduction = process.env.NODE_ENV === "production";
const productionErrors: string[] = [];
if (isProduction) {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "replace-me" || process.env.JWT_SECRET.length < 24) {
    productionErrors.push("JWT_SECRET must be set to a strong value in production");
  }
  if (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET.length < 24) {
    productionErrors.push("ADMIN_JWT_SECRET must be set to a strong value in production");
  }
  if (!process.env.ADMIN_REFRESH_SECRET || process.env.ADMIN_REFRESH_SECRET.length < 24) {
    productionErrors.push("ADMIN_REFRESH_SECRET must be set to a strong value in production");
  }
  if (process.env.DEV_BYPASS_OTP) {
    productionErrors.push("DEV_BYPASS_OTP must not be set in production");
  }
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*") {
    productionErrors.push("CORS_ORIGIN should be an explicit comma-separated allowlist in production");
  }
  for (const key of ["FCM_PROJECT_ID", "FCM_CLIENT_EMAIL", "FCM_PRIVATE_KEY"]) {
    if (!process.env[key]) {
      productionErrors.push(`${key} must be set for Firebase auth and push in production`);
    }
  }
  for (const key of ["LIVEKIT_API_KEY", "LIVEKIT_API_SECRET", "LIVEKIT_URL"]) {
    if (!process.env[key]) {
      productionErrors.push(`${key} must be set for media rooms in production`);
    }
  }
  if (process.env.REDIS_URL) {
    try {
      new URL(process.env.REDIS_URL.trim().replace(/^redis-cli\s+-u\s+/, ""));
    } catch {
      productionErrors.push("REDIS_URL must be a valid redis:// or rediss:// URL");
    }
  }
}

if (productionErrors.length) {
  console.error(`Production env problems:\n- ${productionErrors.join("\n- ")}`);
  process.exit(1);
}

const blankFeatureKeys = rows.filter((row) => row.required !== "yes" && row.status !== "SET");
if (blankFeatureKeys.length) {
  console.log(`Feature/default env not set: ${blankFeatureKeys.map((row) => row.key).join(", ")}`);
}
