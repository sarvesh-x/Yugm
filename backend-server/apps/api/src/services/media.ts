import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import { Block } from "../models/Block.js";
import { Clan } from "../models/Clan.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { MediaObject, type MediaDocument } from "../models/MediaObject.js";
import { MediaQuotaReservation } from "../models/MediaQuotaReservation.js";
import { MediaUploadSession } from "../models/MediaUploadSession.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { User } from "../models/User.js";
import { HttpError } from "../utils/http.js";
import { getImageProcessor, hasImageProcessor } from "./imageProcessor.js";
import { decideMediaAccess, type MediaAccessActor, type MediaAccessSubject } from "./mediaAccessPolicy.js";
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
import {
  assertImageSignature,
  assertStagedUpload,
  exceedsUserQuota,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  mediaUploadLimits as categoryLimits,
  SESSION_TTL_SECONDS,
  USER_MEDIA_QUOTA_BYTES,
  validateUploadRequest,
  type UploadSessionInput
} from "./mediaUploadPolicy.js";

export { assertImageSignature, assertStagedUpload, exceedsUserQuota, validateUploadRequest };
export type { UploadSessionInput };

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
  // Managed uploads cannot be completed without a processor. Report the
  // capability up front so clients can use the documented legacy fallback
  // instead of staging bytes that can never be published.
  if (!hasImageProcessor()) throw new HttpError(503, "Managed media uploads are unavailable on this host");
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

/**
 * Sweeps expired staging sessions and releases their held quota exactly once.
 * The atomic claim prevents a concurrent completion/cancel from double-releasing.
 */
export async function sweepExpiredUploadSessions(now = new Date(), limit = 100) {
  const boundedLimit = Math.max(1, Math.min(500, Math.floor(limit)));
  const due = await MediaUploadSession.find({
    status: { $in: ["PENDING", "PROCESSING"] },
    quotaReserved: true,
    expiresAt: { $lte: now }
  })
    .select("_id userId expectedBytes stagingKey")
    .sort({ expiresAt: 1 })
    .limit(boundedLimit)
    .lean();

  let swept = 0;
  let releasedBytes = 0;
  let deletedObjects = 0;
  for (const session of due) {
    const claimed = await MediaUploadSession.findOneAndUpdate(
      {
        _id: session._id,
        status: { $in: ["PENDING", "PROCESSING"] },
        quotaReserved: true,
        expiresAt: { $lte: now }
      },
      { $set: { status: "EXPIRED", quotaReserved: false } },
      { returnDocument: "after" }
    ).lean();
    if (!claimed) continue;

    swept += 1;
    releasedBytes += claimed.expectedBytes;
    await releaseReservation(claimed.userId, claimed.expectedBytes);
    try {
      await deleteObject("staging", claimed.stagingKey);
      deletedObjects += 1;
    } catch {
      // Staging deletion is best-effort; the quota release is already committed.
    }
  }
  return { swept, releasedBytes, deletedObjects };
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
    const output = await getImageProcessor().resizeToWebp(input.content, {
      width: size,
      height: size,
      fit: "inside",
      withoutEnlargement: true,
      quality: 82,
      animated: false,
      limitInputPixels: MAX_IMAGE_PIXELS
    });
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
    const metadata = await getImageProcessor().metadata(staged.body, {
      animated: true,
      limitInputPixels: MAX_IMAGE_PIXELS
    });
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

export type { MediaAccessSubject } from "./mediaAccessPolicy.js";

function includesId(ids: readonly unknown[] | undefined, userId: string): boolean {
  return Array.isArray(ids) && ids.some((id) => String(id) === userId);
}

async function isBlockedBetween(userId: string, otherUserId: string): Promise<boolean> {
  if (!mongoose.isValidObjectId(otherUserId)) return false;
  return Boolean(await Block.exists({
    $or: [
      { blockerId: userId, blockedUserId: otherUserId },
      { blockerId: otherUserId, blockedUserId: userId }
    ]
  }));
}

/** Resolves authoritative resource facts for the pure media access policy. */
export async function resolveMediaActor(media: MediaDocument, userId: string): Promise<MediaAccessActor> {
  const actor: MediaAccessActor = {
    userId,
    isMediaOwner: false,
    isResourceOwner: false,
    isResourceAdmin: false,
    isAcceptedParticipant: false,
    isBlocked: false,
    isHiddenForActor: false,
  };

  if (media.ownerType === "USER") {
    actor.isMediaOwner = media.ownerId === userId;
    return actor;
  }
  if (!mongoose.isValidObjectId(media.ownerId)) return actor;

  if (media.ownerType === "MESSAGE") {
    const message = await DirectMessage.findOne({
      _id: media.ownerId,
      $or: [{ senderId: userId }, { receiverId: userId }]
    }).lean();
    if (!message) return actor;
    actor.isAcceptedParticipant = true;
    actor.isHiddenForActor = includesId(message.hiddenFor as unknown[] | undefined, userId);
    const senderId = String(message.senderId);
    const otherParty = senderId === userId ? String(message.receiverId) : senderId;
    actor.isBlocked = await isBlockedBetween(userId, otherParty);
    return actor;
  }

  if (media.ownerType === "ROOM") {
    const room = await Room.findOne({ _id: media.ownerId })
      .select("hostId speakerIds moderatorIds roomAdminIds coHostIds")
      .lean();
    if (!room) return actor;
    actor.isResourceOwner = String(room.hostId) === userId;
    actor.isResourceAdmin = includesId(room.moderatorIds, userId) ||
      includesId(room.roomAdminIds, userId) ||
      includesId(room.coHostIds, userId);
    actor.isAcceptedParticipant = includesId(room.speakerIds, userId) || Boolean(
      await RoomParticipant.exists({ roomId: media.ownerId, userId, leftAt: null })
    );
    actor.isBlocked = await isBlockedBetween(userId, String(room.hostId));
    return actor;
  }

  if (media.ownerType === "CLAN") {
    const clan = await Clan.findOne({ _id: media.ownerId })
      .select("ownerId memberIds memberRoles")
      .lean();
    if (!clan) return actor;
    actor.isResourceOwner = String(clan.ownerId) === userId;
    actor.isResourceAdmin = (clan.memberRoles ?? []).some((role) =>
      String(role.userId) === userId && ["LEADER", "CO_LEADER", "OFFICER"].includes(role.role)
    );
    actor.isAcceptedParticipant = includesId(clan.memberIds, userId);
    actor.isBlocked = await isBlockedBetween(userId, String(clan.ownerId));
  }

  return actor;
}

/** Legacy pure decision helper retained for existing unit tests. */
export type MediaAccessDecision = "public" | "owner" | "participant" | "deny";

export function mediaAccessDecision(
  media: MediaAccessSubject,
  userId: string,
  isParticipant: boolean
): MediaAccessDecision {
  const result = decideMediaAccess(media, {
    userId,
    isMediaOwner: media.ownerType === "USER" && media.ownerId === userId,
    isResourceOwner: false,
    isResourceAdmin: false,
    isAcceptedParticipant: isParticipant,
  });
  if (!result.allowed) return "deny";
  return result.decision === "resource-admin" ? "participant" : result.decision;
}

/** Private media access requires identity, resource, deletion and moderation checks. */
export async function authorizeMediaDownload(mediaId: string, userId: string) {
  if (!/^[a-f0-9-]{36}$/i.test(mediaId)) throw new HttpError(400, "Invalid media id");
  const media = await MediaObject.findById(mediaId).lean();
  if (!media || media.deletedAt || media.processingStatus !== "READY" || media.moderationStatus === "REJECTED") {
    throw new HttpError(404, "Media not found");
  }
  const typed = media as unknown as MediaDocument;
  const actor = await resolveMediaActor(typed, userId);
  const decision = decideMediaAccess(typed, actor);
  if (!decision.allowed) throw new HttpError(403, "Media access denied");
  if (decision.decision === "public") return { media: toPublicMedia(typed) };
  const grant = await generateDownloadUrl({ bucket: media.bucket, key: media.storageKey });
  // The short-lived URL is returned in this response only; it is never stored
  // in the registry or written to logs.
  return { media: toPublicMedia(typed), downloadUrl: grant.url, expiresIn: grant.expiresIn };
}
