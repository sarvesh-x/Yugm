import fs from "fs/promises";
import { createReadStream } from "fs";
import path from "path";
import { pipeline } from "stream/promises";
import mongoose from "mongoose";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { env } from "../config/env.js";
import { ErrorCode, HttpError } from "../utils/http.js";

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

function getMediaBucket() {
  const db = mongoose.connection.db;
  if (!db || mongoose.connection.readyState !== 1) throw new Error("MongoDB media storage is unavailable");
  return new mongoose.mongo.GridFSBucket(db, { bucketName: "media" });
}

export async function ensureMongoMediaIndexes() {
  if (env.STORAGE_DRIVER !== "mongodb") return;
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB media storage is unavailable");
  await db.collection("media.files").createIndex({ "metadata.publicName": 1, "metadata.private": 1 });
  const quota = db.collection<{ _id: string; usedBytes: number }>("media.quota");
  if (!await quota.findOne({ _id: "total" })) {
    const [summary] = await db.collection("media.files").aggregate<{ usedBytes: number }>([
      { $group: { _id: null, usedBytes: { $sum: "$length" } } }
    ]).toArray();
    try {
      await quota.insertOne({ _id: "total", usedBytes: summary?.usedBytes ?? 0 });
    } catch (error) {
      // Multiple processes may initialise simultaneously; never overwrite an
      // existing counter after another process starts serving uploads.
      if (!(typeof error === "object" && error !== null && "code" in error && error.code === 11000)) throw error;
    }
  }
}

async function reserveMongoMedia(bytes: number) {
  const db = mongoose.connection.db;
  if (!db || !Number.isSafeInteger(bytes) || bytes < 0) throw new Error("MongoDB media storage is unavailable");
  const quota = db.collection<{ _id: string; usedBytes: number }>("media.quota");
  const result = await quota.updateOne(
    { _id: "total", usedBytes: { $lte: env.MONGODB_MEDIA_MAX_BYTES - bytes } },
    { $inc: { usedBytes: bytes } }
  );
  if (result.matchedCount !== 1) throw new HttpError(507, "Media storage is full", ErrorCode.VALIDATION);
}

async function releaseMongoMedia(bytes: number) {
  const db = mongoose.connection.db;
  if (!db) throw new Error("MongoDB media storage is unavailable");
  await db.collection<{ _id: string; usedBytes: number }>("media.quota").updateOne(
    { _id: "total", usedBytes: { $gte: bytes } }, { $inc: { usedBytes: -bytes } }
  );
}

export async function persistUploadedFile(file: Express.Multer.File, folder: "avatars" | "covers" | "profile-media" | "trust-verification" | "stories" | "voice-notes" | "recordings" | "reactions") {
  if (env.STORAGE_DRIVER === "mongodb") {
    const key = `${folder}/${file.filename}`;
    const bucket = getMediaBucket();
    let reserved = false;
    let upload: ReturnType<typeof bucket.openUploadStream> | undefined;
    try {
      await reserveMongoMedia(file.size);
      reserved = true;
      upload = bucket.openUploadStream(key, {
        metadata: { contentType: file.mimetype, publicName: file.filename, private: folder === "trust-verification" }
      });
      await pipeline(createReadStream(file.path), upload);
    } catch (error) {
      let cleanupComplete = !upload;
      if (upload) {
        try {
          await bucket.delete(upload.id);
          cleanupComplete = true;
        } catch {
          // Keep the reservation if cleanup is uncertain; undercounting could
          // let media fill the database and prevent wallet or chat writes.
        }
      }
      if (reserved && cleanupComplete) await releaseMongoMedia(file.size).catch(() => {});
      throw error;
    } finally {
      await fs.unlink(file.path).catch(() => {});
    }
    return {
      url: folder === "trust-verification" ? `/api/trust-verification/media/${file.filename}` : `/uploads/${file.filename}`,
      storage: folder === "trust-verification" ? "private-mongodb" as const : "mongodb" as const,
      key
    };
  }
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
  if (env.STORAGE_DRIVER === "mongodb") {
    const bucket = getMediaBucket();
    const files = await bucket.find({ filename: `trust-verification/${safeName}`, "metadata.private": true }).sort({ uploadDate: -1 }).limit(1).toArray();
    if (!files.length) throw new Error("Verification media not found");
    const chunks: Buffer[] = [];
    for await (const chunk of bucket.openDownloadStream(files[0]._id)) chunks.push(Buffer.from(chunk));
    return { body: Buffer.concat(chunks), contentType: files[0].metadata?.contentType ?? "application/octet-stream" };
  }
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

export async function deleteStoredFile(folder: "reactions", fileNameOrKey?: string) {
  if (!fileNameOrKey) return;
  const fileName = path.basename(fileNameOrKey);
  if (!fileName) return;
  if (env.STORAGE_DRIVER === "mongodb") {
    const bucket = getMediaBucket();
    const key = fileNameOrKey.includes("/") ? fileNameOrKey : `${folder}/${fileName}`;
    const files = await bucket.find({ filename: key }).toArray();
    for (const file of files) {
      await bucket.delete(file._id);
      await releaseMongoMedia(file.length);
    }
    return;
  }
  if (env.STORAGE_DRIVER !== "s3") {
    await fs.unlink(path.join(process.cwd(), "uploads", fileName)).catch(() => {});
    return;
  }
  assertS3Ready();
  const key = fileNameOrKey.includes("/") ? fileNameOrKey : `${folder}/${fileName}`;
  const { DeleteObjectCommand } = await import("@aws-sdk/client-s3");
  await getS3Client().send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key })).catch(() => {});
}

export function safeUploadName(userId: string, originalName: string) {
  const ext = path.extname(originalName).toLowerCase();
  return `${userId}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}${ext}`;
}

export function getStorageHealth() {
  return {
    driver: env.STORAGE_DRIVER,
    ready: env.STORAGE_DRIVER === "local" || (env.STORAGE_DRIVER === "mongodb" ? mongoose.connection.readyState === 1 : Boolean(env.S3_BUCKET && env.S3_REGION)),
    bucketConfigured: Boolean(env.S3_BUCKET),
    publicBaseUrlConfigured: Boolean(env.S3_PUBLIC_BASE_URL)
  };
}

/** Stream public MongoDB media; private verification files never match. */
export async function getPublicMongoMedia(fileName: string) {
  if (!/^[0-9a-f]{24}_[0-9]+_[a-z0-9]{6}\.[a-z0-9]+$/i.test(fileName)) return undefined;
  const bucket = getMediaBucket();
  const files = await bucket.find({ "metadata.publicName": fileName, "metadata.private": false }).sort({ uploadDate: -1 }).limit(1).toArray();
  const file = files[0];
  if (!file) return undefined;
  return { file, bucket };
}
