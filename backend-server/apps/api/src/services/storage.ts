import fs from "fs/promises";
import path from "path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

export async function persistUploadedFile(file: Express.Multer.File, folder: "avatars" | "covers" | "profile-media" | "trust-verification") {
  if (env.STORAGE_DRIVER !== "s3") {
    return { url: `/uploads/${file.filename}`, storage: "local" as const };
  }
  assertS3Ready();
  const key = `${folder}/${file.filename}`;
  const body = await fs.readFile(file.path);
  await getS3Client().send(new PutObjectCommand({
    Bucket: env.S3_BUCKET,
    Key: key,
    Body: body,
    ContentType: file.mimetype,
    CacheControl: "public, max-age=31536000, immutable"
  }));
  await fs.unlink(file.path).catch(() => {});
  const base = env.S3_PUBLIC_BASE_URL?.replace(/\/$/, "");
  const url = base
    ? `${base}/${key}`
    : `https://${env.S3_BUCKET}.s3.${env.S3_REGION}.amazonaws.com/${key}`;
  return { url, storage: "s3" as const, key };
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
