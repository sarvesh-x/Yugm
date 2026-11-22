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
  { key: "LIVEKIT_API_KEY", group: "livekit", required: false, note: "required for media tokens" },
  { key: "LIVEKIT_API_SECRET", group: "livekit", required: false, note: "required for media tokens" },
  { key: "LIVEKIT_URL", group: "livekit", required: false, note: "defaults to ws://localhost:7880" },
  { key: "FCM_PROJECT_ID", group: "firebase", required: false, note: "defaults to the Yugm Firebase project ID; used to verify auth tokens" },
  { key: "FCM_CLIENT_EMAIL", group: "firebase", required: false, note: "required for enforced App Check and optional for push notifications" },
  { key: "FCM_PRIVATE_KEY", group: "firebase", required: false, note: "required for enforced App Check and optional for push notifications" },
  { key: "RAZORPAY_KEY_ID", group: "payments", required: false, note: "required for Razorpay orders" },
  { key: "RAZORPAY_KEY_SECRET", group: "payments", required: false, note: "required for Razorpay verification" },
  { key: "GOOGLE_PLAY_PACKAGE_NAME", group: "payments", required: false, note: "required for Google Play purchases" },
  { key: "GOOGLE_PLAY_CLIENT_EMAIL", group: "payments", required: false, note: "required for Google Play purchases" },
  { key: "GOOGLE_PLAY_PRIVATE_KEY", group: "payments", required: false, note: "required for Google Play purchases" },
  { key: "PAYOUT_KYC_ENCRYPTION_KEY", group: "payout-kyc", required: false, note: "strong key for encrypted PAN/UPI/bank fields" },
  { key: "REDIS_URL", group: "cache", required: false, note: "leave blank to disable Redis locally" },
  { key: "STORAGE_DRIVER", group: "storage", required: false, note: "local, mongodb or s3; defaults to local" },
  { key: "MONGODB_MEDIA_MAX_BYTES", group: "storage", required: false, note: "MongoDB media quota in bytes; defaults to 128 MiB" },
  { key: "S3_BUCKET", group: "storage", required: false, note: "required when STORAGE_DRIVER=s3" },
  { key: "S3_REGION", group: "storage", required: false, note: "required when STORAGE_DRIVER=s3" },
  { key: "S3_ENDPOINT", group: "storage", required: false, note: "optional S3-compatible endpoint" },
  { key: "S3_ACCESS_KEY_ID", group: "storage", required: false, note: "optional IAM/access key" },
  { key: "S3_SECRET_ACCESS_KEY", group: "storage", required: false, note: "optional IAM/access secret" },
  { key: "S3_PUBLIC_BASE_URL", group: "storage", required: false, note: "optional CDN/public base URL" },
  { key: "R2_ACCOUNT_ID", group: "storage-r2", required: false, note: "derives the account-scoped S3 endpoint unless S3_ENDPOINT is set" },
  { key: "R2_ACCESS_KEY_ID", group: "storage-r2", required: false, note: "server-only R2 API token ID" },
  { key: "R2_SECRET_ACCESS_KEY", group: "storage-r2", required: false, note: "server-only R2 API token secret" },
  { key: "R2_ASSETS_BUCKET", group: "storage-r2", required: false, note: "published assets bucket" },
  { key: "R2_PUBLIC_MEDIA_BUCKET", group: "storage-r2", required: false, note: "public media bucket" },
  { key: "R2_PRIVATE_MEDIA_BUCKET", group: "storage-r2", required: false, note: "authenticated private media bucket" },
  { key: "R2_ORIGINALS_BUCKET", group: "storage-r2", required: false, note: "private provenance originals bucket" },
  { key: "R2_STAGING_BUCKET", group: "storage-r2", required: false, note: "short-lived upload staging bucket" },
  { key: "R2_ASSETS_PUBLIC_URL", group: "storage-r2", required: false, note: "CDN/public URL for the assets bucket" },
  { key: "R2_MEDIA_PUBLIC_URL", group: "storage-r2", required: false, note: "CDN/public URL for the public media bucket" },
  { key: "R2_SIGNED_URL_TTL_SECONDS", group: "storage-r2", required: false, note: "defaults to 900 seconds (60-3600)" },
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
  if (["true", "1"].includes((process.env.APP_CHECK_ENFORCE ?? "").toLowerCase()) &&
      (!process.env.FCM_CLIENT_EMAIL?.trim() || !process.env.FCM_PRIVATE_KEY?.trim())) {
    productionErrors.push("APP_CHECK_ENFORCE requires FCM_CLIENT_EMAIL and FCM_PRIVATE_KEY for Firebase Admin token verification");
  }
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === "replace-me" || process.env.JWT_SECRET.length < 24) {
    productionErrors.push("JWT_SECRET must be set to a strong value in production");
  }
  if (!process.env.ADMIN_JWT_SECRET || process.env.ADMIN_JWT_SECRET.length < 24) {
    productionErrors.push("ADMIN_JWT_SECRET must be set to a strong value in production");
  }
  if (!process.env.ADMIN_REFRESH_SECRET || process.env.ADMIN_REFRESH_SECRET.length < 24) {
    productionErrors.push("ADMIN_REFRESH_SECRET must be set to a strong value in production");
  }
  if (!process.env.PAYOUT_KYC_ENCRYPTION_KEY || process.env.PAYOUT_KYC_ENCRYPTION_KEY.length < 24) {
    productionErrors.push("PAYOUT_KYC_ENCRYPTION_KEY must be set to a strong value in production");
  }
  if (!process.env.CORS_ORIGIN || process.env.CORS_ORIGIN === "*") {
    productionErrors.push("CORS_ORIGIN should be an explicit comma-separated allowlist in production");
  }
  if (!process.env.REDIS_URL) {
    productionErrors.push("REDIS_URL must be set in production for socket fan-out, queues, rate limits, and cache");
  }
  if (!["mongodb", "s3"].includes(process.env.STORAGE_DRIVER ?? "local")) {
    productionErrors.push("STORAGE_DRIVER must be mongodb or s3 for durable production media storage");
  }
  if (process.env.STORAGE_DRIVER === "s3") {
    for (const key of ["S3_BUCKET", "S3_REGION"]) {
      if (!process.env[key]) productionErrors.push(`${key} must be set when STORAGE_DRIVER=s3`);
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

// Managed media needs R2/S3 configuration in every environment, not only in
// production. Report key names and status only; never print values.
const r2BucketKeys = [
  "R2_ASSETS_BUCKET",
  "R2_PUBLIC_MEDIA_BUCKET",
  "R2_PRIVATE_MEDIA_BUCKET",
  "R2_ORIGINALS_BUCKET",
  "R2_STAGING_BUCKET"
] as const;
const storageErrors: string[] = [];
const storageHints: string[] = [];
const legacyBucket = process.env.S3_BUCKET?.trim();

if (process.env.STORAGE_DRIVER === "s3") {
  if (!process.env.R2_ACCOUNT_ID?.trim() && !process.env.S3_ENDPOINT?.trim()) {
    storageErrors.push("R2_ACCOUNT_ID (or explicit S3_ENDPOINT) is required when STORAGE_DRIVER=s3");
  }
  const accessKey = process.env.R2_ACCESS_KEY_ID?.trim() || process.env.S3_ACCESS_KEY_ID?.trim();
  const secretKey = process.env.R2_SECRET_ACCESS_KEY?.trim() || process.env.S3_SECRET_ACCESS_KEY?.trim();
  if (!accessKey || !secretKey) {
    storageErrors.push("R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY (or explicit S3_* credentials) are required when STORAGE_DRIVER=s3");
  }
  const missingBuckets = r2BucketKeys.filter((key) => !process.env[key]?.trim());
  if (missingBuckets.length && !legacyBucket) {
    storageErrors.push(`Set these buckets when STORAGE_DRIVER=s3: ${missingBuckets.join(", ")}`);
  } else if (missingBuckets.length && legacyBucket) {
    storageHints.push(`S3_BUCKET is used as the fallback for: ${missingBuckets.join(", ")}; use separate buckets per storage class`);
  }
  const publicBase = process.env.R2_ASSETS_PUBLIC_URL?.trim()
    || process.env.R2_MEDIA_PUBLIC_URL?.trim()
    || process.env.S3_PUBLIC_BASE_URL?.trim();
  if (!publicBase) {
    storageErrors.push("R2_ASSETS_PUBLIC_URL or R2_MEDIA_PUBLIC_URL (or S3_PUBLIC_BASE_URL) is required for public media URLs");
  }
} else if (r2BucketKeys.some((key) => Boolean(process.env[key]?.trim())) || process.env.R2_ACCOUNT_ID?.trim()) {
  storageHints.push("R2_* values are set but STORAGE_DRIVER is not 's3'; managed media uploads will return 503");
}

if (storageHints.length) console.log(`Storage configuration notes:\n- ${storageHints.join("\n- ")}`);
if (storageErrors.length) {
  console.error(`Storage configuration problems:\n- ${storageErrors.join("\n- ")}`);
  process.exit(1);
}

const blankFeatureKeys = rows.filter((row) => row.required !== "yes" && row.status !== "SET");
if (blankFeatureKeys.length) {
  console.log(`Feature/default env not set: ${blankFeatureKeys.map((row) => row.key).join(", ")}`);
}
