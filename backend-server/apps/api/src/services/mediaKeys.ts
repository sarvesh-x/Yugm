import { HttpError } from "../utils/http.js";

/** The five logical storage classes mandated for Yugm. Names are server-derived. */
export const r2Buckets = ["assets", "public-media", "private-media", "originals", "staging"] as const;
export type R2BucketName = (typeof r2Buckets)[number];

export const mediaOwnerTypes = [
  "USER", "ROOM", "CLAN", "MESSAGE", "COSMETIC", "ACHIEVEMENT", "EVENT", "APPLICATION"
] as const;
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

export function assertMediaBucket(bucket: R2BucketName): R2BucketName {
  if (!r2Buckets.includes(bucket)) throw new HttpError(400, "Unsupported media bucket");
  return bucket;
}

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
  bucket: R2BucketName;
  ownerType: MediaOwnerType;
  ownerId: string;
  category: MediaCategory;
  versionId: string;
  variant: string;
  extension: string;
}) {
  assertMediaBucket(input.bucket);
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
