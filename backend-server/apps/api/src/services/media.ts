import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import sharp from "sharp";
import { Block } from "../models/Block.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { MediaObject, type MediaDocument } from "../models/MediaObject.js";
import { MediaQuotaReservation } from "../models/MediaQuotaReservation.js";
import { MediaUploadSession } from "../models/MediaUploadSession.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/http.js";
import {
  buildMediaKey,
  buildStagingKey,
  calculateChecksum,
  copyObject,
  deleteObject,
  generateDownloadUrl,
  generateUploadUrl,
  getObject,
  newMediaVersionId,
  resolvePublicUrl,
  uploadObject,
  type MediaCategory,
  type MediaOwnerType,
  type R2Bucket
} from "./r2.js";

const SESSION_TTL_SECONDS = 15 * 60;
const MAX_IMAGE_DIMENSION = 8192;
const MAX_IMAGE_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION;
const USER_MEDIA_QUOTA_BYTES = 512 * 1024 * 1024;

const categoryLimits: Record<MediaCategory, { bytes: number; contentTypes: string[] }> = {
  AVATAR: { bytes: 5 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  COVER: { bytes: 10 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  GALLERY: { bytes: 25 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  CHAT_IMAGE: { bytes: 25 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  CHAT_VIDEO: { bytes: 25 * 1024 * 1024, contentTypes: ["video/mp4", "video/webm", "video/quicktime"] },
  VOICE_MESSAGE: { bytes: 25 * 1024 * 1024, contentTypes: ["audio/mp4", "audio/mpeg", "audio/ogg", "audio/wav", "audio/webm"] },
  ATTACHMENT: { bytes: 25 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "application/pdf"] },
  BADGE: { bytes: 8 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  COSMETIC: { bytes: 8 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] },
  STICKER: { bytes: 8 * 1024 * 1024, contentTypes: ["image/png", "image/webp", "image/gif"] },
  APPLICATION_ART: { bytes: 8 * 1024 * 1024, contentTypes: ["image/jpeg", "image/png", "image/webp", "image/gif"] }
};

/** Only the avatar vertical slice is wired in this phase; other categories use legacy uploads. */
const supportedCategories = new Set<MediaCategory>(["AVATAR"]);

export interface UploadSessionInput {
  category: string;
  contentType: string;
  bytes: number;
  fileName: string;
  actorId: string;
}

function assertCategory(category: string): MediaCategory {
  const config = categoryLimits[category as MediaCategory];
  if (!config) throw new HttpError(400, "Unsupported media category");
  if (!supportedCategories.has(category as MediaCategory)) {
    throw new HttpError(400, "This media category is not yet available through managed uploads");
  }
  return category as MediaCategory;
}

/** Pure validation shared by the route-facing session creator and its tests. */
export function validateUploadRequest(input: UploadSessionInput) {
  const category = assertCategory(input.category);
  const config = categoryLimits[category];
  const contentType = input.contentType.trim().toLowerCase();
  if (!config.contentTypes.includes(contentType)) throw new HttpError(400, "Unsupported media content type");
  if (!Number.isSafeInteger(input.bytes) || input.bytes < 1 || input.bytes > config.bytes) {
    throw new HttpError(413, `Media must be between 1 byte and ${config.bytes} bytes`);
  }
  if (!input.fileName || /[\\/\0]/.test(input.fileName)) throw new HttpError(400, "Invalid media file name");
  const extension = (input.fileName.split(".").pop() ?? "").toLowerCase();
  if (!/^[a-z0-9]{1,8}$/.test(extension)) throw new HttpError(400, "Invalid media file name");
  return { category, contentType, extension };
}

export function assertImageSignature(content: Buffer): void {
  const hex = content.subarray(0, 16).toString("hex");
  const ascii = content.subarray(0, 16).toString("ascii");
  const valid = hex.startsWith("ffd8ff") ||
    hex.startsWith("89504e470d0a1a0a") ||
    ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a") ||
    (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP");
  if (!valid) throw new HttpError(400, "Uploaded file is not a supported image");
}

/** Staged bytes are re-verified against the signed grant before publication. */
export function assertStagedUpload(expectedBytes: number, staged: { contentLength?: number; body: Buffer }) {
  if (staged.contentLength !== expectedBytes || staged.body.length !== expectedBytes) {
    throw new HttpError(400, "Uploaded file size does not match the upload session");
  }
  assertImageSignature(staged.body);
}

/** Pure quota rule shared by reservation checks and unit tests. */
export function exceedsUserQuota(usedBytes: number, incomingBytes: number): boolean {
  return usedBytes + incomingBytes > USER_MEDIA_QUOTA_BYTES;
}

async function committedMediaBytes(userId: string) {
  const rows = await MediaObject.aggregate<{ total: number }>([
    { $match: { ownerType: "USER", ownerId: userId, deletedAt: null } },
    { $group: { _id: null, total: { $sum: "$fileSize" } } }
  ]);
  return rows[0]?.total ?? 0;
}

/** Lazily seeds the counter from live reservations so older users are covered. */
async function ensureReservationCounter(userId: string) {
  if (await MediaQuotaReservation.findById(userId).lean()) return;
  const rows = await MediaUploadSession.aggregate<{ total: number }>([
    {
      $match: {
        userId,
        quotaReserved: true,
        status: { $in: ["PENDING", "PROCESSING"] },
        expiresAt: { $gt: new Date() }
      }
    },
    { $group: { _id: null, total: { $sum: "$expectedBytes" } } }
  ]);
  try {
    await MediaQuotaReservation.create({ _id: userId, bytes: rows[0]?.total ?? 0 });
  } catch (error) {
    // Another concurrent request already initialised it; its value is authoritative.
    if ((error as { code?: number }).code !== 11000) throw error;
  }
}

async function reserveQuota(userId: string, incomingBytes: number) {
  await ensureReservationCounter(userId);
  const committed = await committedMediaBytes(userId);
  // The condition and increment happen in one command, so concurrent grants
  // cannot both observe and spend the same free bytes.
  const updated = await MediaQuotaReservation.findOneAndUpdate(
    {
      _id: userId,
      $expr: {
        $lte: [{ $add: ["$bytes", committed, incomingBytes] }, USER_MEDIA_QUOTA_BYTES]
      }
    },
    { $inc: { bytes: incomingBytes } },
    { returnDocument: "after" }
  ).lean();
  if (!updated) throw new HttpError(413, "Your media storage quota has been reached");
}

async function releaseReservation(userId: string, bytes: number) {
  await MediaQuotaReservation.updateOne(
    { _id: userId },
    [{ $set: { bytes: { $max: [0, { $subtract: ["$bytes", bytes] }] } } }]
  ).catch(() => {});
}

/** Session creation never trusts client-supplied keys or owner identifiers. */
export async function createUploadSession(input: UploadSessionInput) {
  const { category, contentType, extension } = validateUploadRequest(input);
  const sessionId = randomUUID();
  const stagingKey = buildStagingKey(sessionId, extension);
  const ownerType: MediaOwnerType = "USER";
  const ownerId = input.actorId;
  const grant = await generateUploadUrl({ bucket: "staging", key: stagingKey, contentType });
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);
  await reserveQuota(input.actorId, input.bytes);
  try {
    await MediaUploadSession.create({
      _id: sessionId,
      userId: input.actorId,
      category,
      expectedContentType: contentType,
      expectedBytes: input.bytes,
      ownerType,
      ownerId,
      bucket: "staging",
      stagingKey,
      status: "PENDING",
      expiresAt,
      attempts: 0,
      quotaReserved: true
    });
  } catch (error) {
    await releaseReservation(input.actorId, input.bytes);
    throw error;
  }
  return {
    sessionId,
    uploadUrl: grant.url,
    method: grant.method,
    requiredHeaders: grant.headers,
    expiresAt,
    expiresIn: grant.expiresIn,
    maxBytes: categoryLimits[category].bytes,
    category
  };
}

/** Cancellation is idempotent and removes only the owned staging object. */
export async function cancelUploadSession(sessionId: string, actorId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) throw new HttpError(400, "Invalid upload session");
  await ensureReservationCounter(actorId);
  const session = await MediaUploadSession.findOneAndUpdate(
    { _id: sessionId, userId: actorId, status: "PENDING", quotaReserved: true },
    { $set: { status: "CANCELLED", quotaReserved: false } },
    { returnDocument: "after" }
  ).lean();
  if (!session) {
    const existing = await MediaUploadSession.findOne({ _id: sessionId, userId: actorId }).lean();
    if (!existing) throw new HttpError(404, "Upload session not found");
    if (existing.status === "COMPLETED") throw new HttpError(409, "Upload session is already completed");
    return { sessionId, status: existing.status };
  }
  await releaseReservation(actorId, session.expectedBytes);
  await deleteObject("staging", session.stagingKey).catch(() => {});
  return { sessionId, status: "CANCELLED" as const };
}

async function nextMediaVersion(ownerType: MediaOwnerType, ownerId: string, category: MediaCategory) {
  const db = mongoose.connection.db;
  if (!db) throw new HttpError(503, "Media registry is unavailable");
  const result = await db.collection<{ _id: string; seq: number }>("media.counters").findOneAndUpdate(
    { _id: `${ownerType}:${ownerId}:${category}` },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: "after" }
  );
  if (!result) throw new HttpError(503, "Media version could not be allocated");
  return result.seq;
}

async function buildAvatarVariants(input: {
  ownerId: string;
  versionId: string;
  content: Buffer;
  onObject: (bucket: R2Bucket, key: string) => void;
}) {
  const variants: {
    name: string;
    bucket: R2Bucket;
    key: string;
    contentType: string;
    bytes: number;
    width: number;
    height: number;
  }[] = [];
  for (const size of [64, 128, 256]) {
    // Avatars use the first frame and strip metadata; the private original
    // keeps provenance for moderation and rollback.
    const output = await sharp(input.content, { limitInputPixels: MAX_IMAGE_PIXELS })
      .rotate()
      .resize({ width: size, height: size, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 82, effort: 4 })
      .toBuffer({ resolveWithObject: true });
    const key = buildMediaKey({
      bucket: "public-media",
      ownerType: "USER",
      ownerId: input.ownerId,
      category: "AVATAR",
      versionId: input.versionId,
      variant: `avatar_${size}`,
      extension: "webp"
    });
    await uploadObject({ bucket: "public-media", key, body: output.data, contentType: "image/webp", isPrivate: false });
    input.onObject("public-media", key);
    variants.push({
      name: `avatar_${size}`,
      bucket: "public-media",
      key,
      contentType: "image/webp",
      bytes: output.data.length,
      width: output.info.width,
      height: output.info.height
    });
  }
  return variants;
}

/** Maps an unclaimable session to its stable client-facing failure. */
export function classifyCompletionFailure(
  session: { status?: string } | null | undefined
): { status: 409 | 410; message: string; markExpired?: boolean } {
  if (session?.status === "PENDING") {
    return { status: 410, message: "Upload session has expired", markExpired: true };
  }
  return { status: 409, message: "Upload session is no longer pending" };
}

/**
 * Complete a session only after independently reading and validating the
 * staged object. The atomic status transition makes repeated completions
 * idempotent; the previous avatar stays active and preserved until commit.
 */
export async function completeUploadSession(sessionId: string, actorId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(sessionId)) throw new HttpError(400, "Invalid upload session");
  const claimed = await MediaUploadSession.findOneAndUpdate(
    { _id: sessionId, userId: actorId, status: "PENDING", expiresAt: { $gt: new Date() } },
    { $set: { status: "PROCESSING" }, $inc: { attempts: 1 } },
    { returnDocument: "after" }
  ).lean();
  if (!claimed) {
    const existing = await MediaUploadSession.findOne({ _id: sessionId, userId: actorId, status: "COMPLETED" }).lean();
    if (existing?.mediaId) {
      const media = await MediaObject.findById(existing.mediaId).lean();
      const ready = media?.variants.find((variant) => variant.name === "avatar_256");
      if (ready?.key) {
        return {
          mediaId: existing.mediaId,
          avatarUrl: resolvePublicUrl("public-media", ready.key),
          version: media?.version ?? 0
        };
      }
    }
    const pending = await MediaUploadSession.findOne({ _id: sessionId, userId: actorId, status: "PENDING" }).lean();
    const failure = classifyCompletionFailure(pending);
    if (failure.markExpired) {
      await ensureReservationCounter(actorId);
      const expired = await MediaUploadSession.findOneAndUpdate(
        { _id: sessionId, userId: actorId, status: "PENDING", quotaReserved: true },
        { $set: { status: "EXPIRED", quotaReserved: false } },
        { returnDocument: "after" }
      ).lean();
      if (expired) await releaseReservation(actorId, expired.expectedBytes);
      else {
        await MediaUploadSession.updateOne(
          { _id: sessionId, status: "PENDING" },
          { $set: { status: "EXPIRED", quotaReserved: false } }
        );
      }
    }
    throw new HttpError(failure.status, failure.message);
  }

  const createdObjects: { bucket: R2Bucket; key: string }[] = [];
  let createdMediaId: string | undefined;
  let referenceCommitted = false;
  try {
    const staged = await getObject("staging", claimed.stagingKey);
    assertStagedUpload(claimed.expectedBytes, staged);
    const metadata = await sharp(staged.body, { animated: true, limitInputPixels: MAX_IMAGE_PIXELS }).metadata();
    if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION || metadata.height > MAX_IMAGE_DIMENSION) {
      throw new HttpError(400, "Uploaded image dimensions are outside the supported range");
    }

    const version = await nextMediaVersion(claimed.ownerType as MediaOwnerType, claimed.ownerId, claimed.category);
    const versionId = newMediaVersionId();
    const originalKey = buildMediaKey({
      bucket: "originals",
      ownerType: claimed.ownerType as MediaOwnerType,
      ownerId: claimed.ownerId,
      category: claimed.category,
      versionId,
      variant: "original",
      extension: claimed.stagingKey.split(".").pop() ?? "bin"
    });
    await copyObject({
      fromBucket: "staging",
      fromKey: claimed.stagingKey,
      toBucket: "originals",
      toKey: originalKey,
      contentType: claimed.expectedContentType,
      isPrivate: true
    });
    createdObjects.push({ bucket: "originals", key: originalKey });
    const variants = await buildAvatarVariants({
      ownerId: claimed.ownerId,
      versionId,
      content: staged.body,
      onObject: (bucket, key) => createdObjects.push({ bucket, key })
    });
    const full = variants.find((variant) => variant.name === "avatar_256");
    if (!full?.key) throw new HttpError(500, "Avatar variant was not produced");
    const avatarUrl = resolvePublicUrl("public-media", full.key);

    const media = await MediaObject.create({
      _id: randomUUID(),
      ownerType: claimed.ownerType,
      ownerId: claimed.ownerId,
      mediaType: "IMAGE",
      category: claimed.category,
      bucket: "public-media",
      storageKey: full.key,
      contentType: claimed.expectedContentType,
      fileSize: staged.body.length,
      width: metadata.width,
      height: metadata.height,
      checksum: calculateChecksum(staged.body),
      visibility: "PUBLIC",
      processingStatus: "READY",
      moderationStatus: "APPROVED",
      version,
      variants: [
        {
          name: "original",
          bucket: "originals",
          key: originalKey,
          contentType: claimed.expectedContentType,
          bytes: staged.body.length,
          width: metadata.width,
          height: metadata.height
        },
        ...variants
      ],
      createdBy: claimed.userId
    });
    createdMediaId = String(media._id);

    // Commit the entity reference only after all objects and the registry exist.
    const previous = await User.findByIdAndUpdate(
      claimed.userId,
      {
        $set: {
          avatar: avatarUrl,
          avatarMediaId: createdMediaId,
          avatarType: "UPLOADED",
          "activeCosmetics.avatarAsset": ""
        },
        $unset: { avatarParts: "" }
      },
      { new: false }
    ).select("avatarMediaId").lean();
    referenceCommitted = true;
    const completed = await MediaUploadSession.findOneAndUpdate(
      { _id: sessionId, userId: claimed.userId, status: "PROCESSING", quotaReserved: true },
      { $set: { status: "COMPLETED", completedAt: new Date(), mediaId: createdMediaId, quotaReserved: false } },
      { returnDocument: "after" }
    ).lean();
    if (completed) await releaseReservation(claimed.userId, completed.expectedBytes);
    else {
      await MediaUploadSession.updateOne(
        { _id: sessionId, status: "PROCESSING" },
        { $set: { status: "COMPLETED", completedAt: new Date(), mediaId: createdMediaId, quotaReserved: false } }
      );
    }

    if (previous?.avatarMediaId && previous.avatarMediaId !== createdMediaId) {
      // Keep the previous version and its objects for rollback/reconciliation.
      await MediaObject.updateOne(
        { _id: previous.avatarMediaId },
        { $set: { supersededById: createdMediaId } }
      ).catch(() => {});
    }
    // Staging is retained briefly for retry/forensics; lifecycle cleanup must
    // not run before the new reference is committed.
    return { mediaId: createdMediaId, avatarUrl, mediaType: media.mediaType, version };
  } catch (error) {
    if (!referenceCommitted) {
      await Promise.allSettled(createdObjects.map((object) => deleteObject(object.bucket, object.key)));
      if (createdMediaId) await MediaObject.deleteOne({ _id: createdMediaId }).catch(() => {});
    }
    const failed = await MediaUploadSession.findOneAndUpdate(
      { _id: sessionId, userId: claimed.userId, status: "PROCESSING", quotaReserved: true },
      { $set: { status: "FAILED", quotaReserved: false } },
      { returnDocument: "after" }
    ).lean().catch(() => null);
    if (failed) await releaseReservation(claimed.userId, failed.expectedBytes);
    else {
      await MediaUploadSession.updateOne(
        { _id: sessionId, status: "PROCESSING" },
        { $set: { status: "FAILED", quotaReserved: false } }
      ).catch(() => {});
    }
    throw error;
  }
}

/** Public DTO resolves delivery URLs at read time; canonical keys stay in the DB. */
export function toPublicMedia(media: MediaDocument) {
  return {
    id: String(media._id),
    ownerType: media.ownerType,
    ownerId: media.ownerId,
    mediaType: media.mediaType,
    category: media.category,
    visibility: media.visibility,
    version: media.version,
    processingStatus: media.processingStatus,
    moderationStatus: media.moderationStatus,
    fileSize: media.fileSize,
    checksum: media.checksum,
    variants: media.variants
      .filter((variant) => variant.bucket === "public-media" || variant.bucket === "assets")
      .map((variant) => ({
        name: variant.name,
        // Never echo a stored URL: public delivery is derived from the canonical
        // key so an expiring signed URL can never be persisted or disclosed.
        url: resolvePublicUrl(variant.bucket, variant.key),
        contentType: variant.contentType,
        width: variant.width,
        height: variant.height
      }))
  };
}

async function isMessageParticipant(media: MediaDocument, userId: string): Promise<boolean> {
  if (media.ownerType !== "MESSAGE" || !mongoose.isValidObjectId(media.ownerId)) return false;
  const message = await DirectMessage.findOne({
    _id: media.ownerId,
    $or: [{ senderId: userId }, { receiverId: userId }],
    hiddenFor: { $ne: userId }
  }).lean();
  if (!message) return false;
  const blocked = await Block.exists({
    $or: [
      { blockerId: message.senderId, blockedUserId: userId },
      { blockerId: userId, blockedUserId: message.senderId }
    ]
  });
  return !blocked;
}

export interface MediaAccessSubject {
  ownerType: string;
  ownerId: string;
  visibility: string;
  deletedAt?: unknown;
  processingStatus: string;
  moderationStatus: string;
}

export type MediaAccessDecision = "public" | "owner" | "participant" | "deny";

/** Pure resource-level decision; callers still perform the authoritative state check. */
export function mediaAccessDecision(
  media: MediaAccessSubject,
  userId: string,
  isParticipant: boolean
): MediaAccessDecision {
  if (media.deletedAt || media.processingStatus !== "READY" || media.moderationStatus === "REJECTED") {
    return "deny";
  }
  if (media.ownerType === "USER" && media.ownerId === userId) return "owner";
  if (media.visibility !== "PRIVATE") return "public";
  return isParticipant ? "participant" : "deny";
}

/** Private media access requires identity, resource, deletion and moderation checks. */
export async function authorizeMediaDownload(mediaId: string, userId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(mediaId)) throw new HttpError(400, "Invalid media id");
  const media = await MediaObject.findById(mediaId).lean();
  if (!media || media.deletedAt || media.processingStatus !== "READY" || media.moderationStatus === "REJECTED") {
    throw new HttpError(404, "Media not found");
  }
  const typed = media as unknown as MediaDocument;
  const ownerMatch = media.ownerType === "USER" && media.ownerId === userId;
  const participant = !ownerMatch && media.visibility === "PRIVATE"
    ? await isMessageParticipant(typed, userId)
    : false;
  const decision = mediaAccessDecision(media as MediaAccessSubject, userId, participant);
  if (decision === "deny") throw new HttpError(403, "Media access denied");
  if (decision === "public") return { media: toPublicMedia(typed) };
  const grant = await generateDownloadUrl({ bucket: media.bucket, key: media.storageKey });
  // The short-lived URL is returned in this response only; it is never stored
  // in the registry or written to logs.
  return { media: toPublicMedia(typed), downloadUrl: grant.url, expiresIn: grant.expiresIn };
}
