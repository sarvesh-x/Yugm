import { createHash, randomUUID } from "node:crypto";
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http.js";
import { buildPublicStorageUrl, getManagedS3Client } from "./storage.js";

/** The five storage classes mandated for Yugm. Names are resolved only on the server. */
export const r2Buckets = ["assets", "public-media", "private-media", "originals", "staging"] as const;
export type R2Bucket = (typeof r2Buckets)[number];

export const mediaOwnerTypes = ["USER", "ROOM", "CLAN", "MESSAGE", "COSMETIC", "ACHIEVEMENT", "EVENT", "APPLICATION"] as const;
export type MediaOwnerType = (typeof mediaOwnerTypes)[number];

export const mediaCategories = [
  "AVATAR",
  "COVER",
  "GALLERY",
  "CHAT_IMAGE",
  "CHAT_VIDEO",
  "VOICE_MESSAGE",
  "ATTACHMENT",
  "BADGE",
  "COSMETIC",
  "STICKER",
  "APPLICATION_ART"
] as const;
export type MediaCategory = (typeof mediaCategories)[number];

const bucketEnv: Record<R2Bucket, string | undefined> = {
  assets: env.R2_ASSETS_BUCKET,
  "public-media": env.R2_PUBLIC_MEDIA_BUCKET,
  "private-media": env.R2_PRIVATE_MEDIA_BUCKET,
  originals: env.R2_ORIGINALS_BUCKET,
  staging: env.R2_STAGING_BUCKET
};

const ownerFolders: Record<MediaOwnerType, string> = {
  USER: "users",
  ROOM: "rooms",
  CLAN: "clans",
  MESSAGE: "messages",
  COSMETIC: "cosmetics",
  ACHIEVEMENT: "achievements",
  EVENT: "events",
  APPLICATION: "application"
};

const categoryFolders: Record<MediaCategory, string> = {
  AVATAR: "avatars",
  COVER: "covers",
  GALLERY: "gallery",
  CHAT_IMAGE: "chat-images",
  CHAT_VIDEO: "chat-videos",
  VOICE_MESSAGE: "voice-messages",
  ATTACHMENT: "attachments",
  BADGE: "badges",
  COSMETIC: "cosmetics",
  STICKER: "stickers",
  APPLICATION_ART: "art"
};

function assertBucket(bucket: R2Bucket): R2Bucket {
  if (!r2Buckets.includes(bucket)) throw new HttpError(400, "Unsupported media bucket");
  return bucket;
}

/** Explicit bucket name for a storage class. Legacy S3_BUCKET is a fallback only. */
export function resolveBucketName(bucket: R2Bucket): string {
  assertBucket(bucket);
  const name = bucketEnv[bucket] ?? env.S3_BUCKET;
  if (!name) throw new HttpError(503, "Object storage is not configured");
  return name;
}

function assertR2Ready() {
  if (env.STORAGE_DRIVER !== "s3") {
    throw new HttpError(503, "Direct media uploads require the R2/S3 storage driver");
  }
  if (!env.S3_REGION || (!env.S3_ENDPOINT && !env.S3_BUCKET)) {
    throw new HttpError(503, "Object storage is not configured");
  }
}

function publicBaseFor(bucket: R2Bucket): string | undefined {
  if (bucket === "assets") return env.R2_ASSETS_PUBLIC_URL ?? env.S3_PUBLIC_BASE_URL;
  if (bucket === "public-media") return env.R2_MEDIA_PUBLIC_URL ?? env.S3_PUBLIC_BASE_URL;
  return undefined;
}

/** Public delivery URL for a canonical bucket/key. Private buckets have no public URL. */
export function resolvePublicUrl(bucket: R2Bucket, key: string): string {
  assertBucket(bucket);
  if (publicBaseFor(bucket)) {
    return buildPublicStorageUrl(key, {
      publicBaseUrl: publicBaseFor(bucket),
      endpoint: env.S3_ENDPOINT,
      bucket: resolveBucketName(bucket),
      region: env.S3_REGION
    });
  }
  if (bucket === "assets" || bucket === "public-media") {
    // The legacy AWS-style fallback is only valid without a custom endpoint.
    return buildPublicStorageUrl(key, { bucket: resolveBucketName(bucket), region: env.S3_REGION });
  }
  throw new HttpError(400, "Private media has no public URL");
}

/** Backward-compatible name used by the asset registry integration. */
export const resolveR2PublicUrl = resolvePublicUrl;

const safeSegment = (value: string) => {
  const clean = value.trim().replace(/[^a-zA-Z0-9_-]/g, "_");
  if (!clean || clean.length > 96) throw new HttpError(400, "Invalid media identifier");
  return clean;
};

/**
 * Structured, immutable key. Callers supply only validated enums and opaque
 * identifiers; no client-supplied path is ever used as a storage key.
 */
export function buildMediaKey(input: {
  bucket: R2Bucket;
  ownerType: MediaOwnerType;
  ownerId: string;
  category: MediaCategory;
  versionId: string;
  variant: string;
  extension: string;
}) {
  assertBucket(input.bucket);
  if (!mediaOwnerTypes.includes(input.ownerType)) throw new HttpError(400, "Unsupported media owner");
  if (!mediaCategories.includes(input.category)) throw new HttpError(400, "Unsupported media category");
  if (!/^[a-z0-9_]+$/.test(input.variant) || input.variant.length > 24) throw new HttpError(400, "Invalid media variant");
  if (!/^[a-z0-9]{1,8}$/.test(input.extension)) throw new HttpError(400, "Invalid media extension");
  return [
    ownerFolders[input.ownerType],
    safeSegment(input.ownerId),
    categoryFolders[input.category],
    safeSegment(input.versionId),
    `${input.variant}.${input.extension}`
  ].join("/");
}

/** Staging keys are unique per upload session and never expose the original path. */
export function buildStagingKey(sessionId: string, extension: string) {
  if (!/^[a-z0-9_-]{1,96}$/.test(sessionId)) throw new HttpError(400, "Invalid upload session");
  if (!/^[a-z0-9]{1,8}$/.test(extension)) throw new HttpError(400, "Invalid media extension");
  return `staging/${sessionId}/original.${extension}`;
}

export function calculateChecksum(content: Buffer): string {
  return createHash("sha256").update(content).digest("hex");
}

export function newMediaVersionId(): string {
  return randomUUID();
}

export async function uploadObject(input: {
  bucket: R2Bucket;
  key: string;
  body: Buffer;
  contentType: string;
  isPrivate: boolean;
}) {
  assertR2Ready();
  await getManagedS3Client().send(new PutObjectCommand({
    Bucket: resolveBucketName(input.bucket),
    Key: input.key,
    Body: input.body,
    ContentType: input.contentType,
    CacheControl: input.isPrivate ? "private, no-store" : "public, max-age=31536000, immutable"
  }));
  return { bucket: input.bucket, key: input.key };
}

export async function getObject(bucket: R2Bucket, key: string) {
  assertR2Ready();
  const object = await getManagedS3Client().send(new GetObjectCommand({
    Bucket: resolveBucketName(bucket),
    Key: key
  }));
  if (!object.Body) throw new HttpError(404, "Media object not found");
  return {
    body: Buffer.from(await object.Body.transformToByteArray()),
    contentType: object.ContentType ?? "application/octet-stream",
    contentLength: object.ContentLength,
    checksum: object.ChecksumSHA256
  };
}

export async function deleteObject(bucket: R2Bucket, key: string) {
  assertR2Ready();
  await getManagedS3Client().send(new DeleteObjectCommand({ Bucket: resolveBucketName(bucket), Key: key }));
}

export async function objectExists(bucket: R2Bucket, key: string): Promise<boolean> {
  assertR2Ready();
  try {
    await getManagedS3Client().send(new HeadObjectCommand({ Bucket: resolveBucketName(bucket), Key: key }));
    return true;
  } catch (error) {
    if (typeof error === "object" && error !== null && "name" in error && error.name === "NotFound") return false;
    if (typeof error === "object" && error !== null && "$metadata" in error) {
      const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
      if (status === 404) return false;
    }
    throw error;
  }
}

export async function getObjectMetadata(bucket: R2Bucket, key: string) {
  assertR2Ready();
  const result = await getManagedS3Client().send(new HeadObjectCommand({ Bucket: resolveBucketName(bucket), Key: key }));
  return {
    contentType: result.ContentType,
    contentLength: result.ContentLength,
    checksum: result.ChecksumSHA256,
    lastModified: result.LastModified
  };
}

export async function copyObject(input: { fromBucket: R2Bucket; fromKey: string; toBucket: R2Bucket; toKey: string; contentType: string; isPrivate: boolean }) {
  assertR2Ready();
  const source = `${resolveBucketName(input.fromBucket)}/${input.fromKey.split("/").map(encodeURIComponent).join("/")}`;
  await getManagedS3Client().send(new CopyObjectCommand({
    Bucket: resolveBucketName(input.toBucket),
    Key: input.toKey,
    CopySource: source,
    ContentType: input.contentType,
    CacheControl: input.isPrivate ? "private, no-store" : "public, max-age=31536000, immutable",
    MetadataDirective: "REPLACE"
  }));
  return { bucket: input.toBucket, key: input.toKey };
}

/** Short-lived presigned PUT. The URL is returned to the caller and never logged. */
export async function generateUploadUrl(input: { bucket: R2Bucket; key: string; contentType: string; expiresIn?: number }) {
  assertR2Ready();
  const command = new PutObjectCommand({
    Bucket: resolveBucketName(input.bucket),
    Key: input.key,
    ContentType: input.contentType,
    CacheControl: "private, no-store"
  });
  const url = await getSignedUrl(getManagedS3Client(), command, {
    expiresIn: input.expiresIn ?? env.R2_SIGNED_URL_TTL_SECONDS,
    signableHeaders: new Set(["content-type"])
  });
  return { url, method: "PUT" as const, headers: { "Content-Type": input.contentType }, expiresIn: input.expiresIn ?? env.R2_SIGNED_URL_TTL_SECONDS };
}

/** Short-lived presigned GET for authorized private delivery. */
export async function generateDownloadUrl(input: { bucket: R2Bucket; key: string; expiresIn?: number }) {
  assertR2Ready();
  const command = new GetObjectCommand({ Bucket: resolveBucketName(input.bucket), Key: input.key });
  const url = await getSignedUrl(getManagedS3Client(), command, {
    expiresIn: input.expiresIn ?? env.R2_SIGNED_URL_TTL_SECONDS
  });
  return { url, expiresIn: input.expiresIn ?? env.R2_SIGNED_URL_TTL_SECONDS };
}
