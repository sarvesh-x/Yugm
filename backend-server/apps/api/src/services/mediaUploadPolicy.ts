import { HttpError } from "../utils/http.js";
import type { MediaCategory } from "./mediaKeys.js";

export const SESSION_TTL_SECONDS = 15 * 60;
export const MAX_IMAGE_DIMENSION = 8192;
export const MAX_IMAGE_PIXELS = MAX_IMAGE_DIMENSION * MAX_IMAGE_DIMENSION;
export const USER_MEDIA_QUOTA_BYTES = 512 * 1024 * 1024;

export const mediaUploadLimits: Record<MediaCategory, { bytes: number; contentTypes: string[] }> = {
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

/** Only the avatar vertical slice is wired through managed uploads. */
const supportedCategories = new Set<MediaCategory>(["AVATAR"]);

export interface UploadSessionInput {
  category: string;
  contentType: string;
  bytes: number;
  fileName: string;
  actorId: string;
}

function assertCategory(category: string): MediaCategory {
  const config = mediaUploadLimits[category as MediaCategory];
  if (!config) throw new HttpError(400, "Unsupported media category");
  if (!supportedCategories.has(category as MediaCategory)) {
    throw new HttpError(400, "This media category is not yet available through managed uploads");
  }
  return category as MediaCategory;
}

/** Pure validation shared by the route-facing session creators and their tests. */
export function validateUploadRequest(input: UploadSessionInput) {
  const category = assertCategory(input.category);
  const config = mediaUploadLimits[category];
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

export function assertImageSignature(content: Uint8Array): void {
  const head = content.subarray(0, 16);
  const hex = Array.from(head, byte => byte.toString(16).padStart(2, "0")).join("");
  const ascii = new TextDecoder("ascii").decode(head);
  const valid = hex.startsWith("ffd8ff") ||
    hex.startsWith("89504e470d0a1a0a") ||
    ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a") ||
    (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP");
  if (!valid) throw new HttpError(400, "Uploaded file is not a supported image");
}

/** Staged bytes are re-verified against the signed grant before publication. */
export function assertStagedUpload(expectedBytes: number, staged: { contentLength?: number; body: Uint8Array }) {
  if (staged.contentLength !== expectedBytes || staged.body.byteLength !== expectedBytes) {
    throw new HttpError(400, "Uploaded file size does not match the upload session");
  }
  assertImageSignature(staged.body);
}

/** Pure quota rule shared by reservation checks and unit tests. */
export function exceedsUserQuota(usedBytes: number, incomingBytes: number): boolean {
  return usedBytes + incomingBytes > USER_MEDIA_QUOTA_BYTES;
}
