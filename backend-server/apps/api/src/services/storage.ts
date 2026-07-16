import fs from "fs/promises";
import path from "path";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";

let s3: S3Client | undefined;

function getS3Client() {
  if (!s3) {
    s3 = new S3Client({
      region: env.S3_REGION,
      endpoint: env.S3_ENDPOINT,
      forcePathStyle: Boolean(env.S3_ENDPOINT),
      credentials: env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY
        ? { accessKeyId: env.S3_ACCESS_KEY_ID, secretAccessKey: env.S3_SECRET_ACCESS_KEY }
        : undefined
    });
  }
  return s3;
}

function assertS3Ready() {
  if (!env.S3_BUCKET || !env.S3_REGION) {
    throw new Error("S3 storage requires S3_BUCKET and S3_REGION");
  }
}

export async function persistUploadedFile(file: Express.Multer.File, folder: "avatars" | "covers" | "profile-media" | "trust-verification" | "stories" | "voice-notes") {
  if (env.STORAGE_DRIVER !== "s3") {
    return {
      url: folder === "trust-verification" ? `/api/trust-verification/media/${file.filename}` : `/uploads/${file.filename}`,
      storage: folder === "trust-verification" ? "private-local" as const : "local" as const
    };
  }
  assertS3Ready();
  const key = `${folder}/${file.filename}`;
  const body = await fs.readFile(file.path);
  await getS3Client().send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: file.mimetype,
    CacheControl: folder === "trust-verification" ? "private, no-store" : "public, max-age=31536000, immutable"
  }));
  await fs.unlink(file.path).catch(() => {});
  if (folder === "trust-verification") {
    return { url: `/api/trust-verification/media/${file.filename}`, storage: "private-s3" as const, key };
  }
  const base = env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const url = base
    ? `${base}/${key}`
    : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
  return { url, storage: "s3" as const, key };
}

const trustMediaNamePattern = /^[0-9a-f]{24}_[0-9]+_[a-z0-9]{6}\.(?:jpe?g|png|webp|mp4|mov|m4v|webm|mp3|m4a|aac|wav|ogg)$/i;

export function assertTrustMediaFileName(fileName: string) {
  if (!trustMediaNamePattern.test(fileName) || path.basename(fileName) !== fileName) {
    throw new Error("Invalid verification media reference");
  }
  return fileName;
}

export async function loadTrustVerificationFile(fileName: string) {
  const safeName = assertTrustMediaFileName(fileName);
  if (env.STORAGE_DRIVER !== "s3") {
    const filePath = path.join(process.cwd(), "private-uploads", "trust-verification", safeName);
    await fs.access(filePath);
    return { filePath };
  }
  assertS3Ready();
  const object = await getS3Client().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: `trust-verification/${safeName}` }));
  if (!object.Body) throw new Error("Verification media not found");
  return { body: Buffer.from(await object.Body.transformToByteArray()), contentType: object.ContentType ?? "application/octet-stream" };
}

export function safeUploadName(userId: string, originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  return `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
}

export function getStorageHealth() {
  return {
    driver: env.STORAGE_DRIVER,
    ready: env.STORAGE_DRIVER === "local" || Boolean(env.S3_BUCKET && env.S3_REGION),
    bucketConfigured: Boolean(env.S3_BUCKET),
    publicBaseUrlConfigured: Boolean(env.S3_PUBLIC_BASE_URL)
  };
}
