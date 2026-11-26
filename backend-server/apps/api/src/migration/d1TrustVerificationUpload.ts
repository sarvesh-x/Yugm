import { createHash, randomBytes, randomUUID } from "node:crypto";
import path from "node:path";
import type { D1Database, R2Bucket as R2BucketBinding } from "@cloudflare/workers-types";
import type { NextFunction, Request as ExpressRequest, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { createHttpSessionAuth } from "../middleware/httpAccessSession.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { nextD1MediaVersion } from "./d1Media.js";
import { trustMediaKey, trustMediaPath } from "./d1TrustMedia.js";

export interface D1TrustVerificationUploadOptions {
  db: D1Database;
  buckets: { "private-media": R2BucketBinding };
}

// Legacy /api/upload/trust-verification caps multipart requests at the Worker
// ceiling of 10 MB and enforces purpose-specific extension/MIME/signature
// checks. The owner-facing URL stays relative and private; R2 bytes live under
// the legacy trust-verification key so the admin delivery route can reuse them.
const MAX_MULTIPART_BYTES = 10 * 1024 * 1024;
const PRIVATE_CACHE = "private, no-store";
const faceExtensions = [".jpg", ".jpeg", ".png", ".webp", ".mp4", ".mov", ".m4v", ".webm"];
const voiceExtensions = [".mp3", ".m4a", ".aac", ".wav", ".webm", ".ogg"];

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytesOf = (value: Buffer) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
const purposeOf = (request: ExpressRequest) => String(request.body?.purpose || "");

function hasImageSignature(buffer: Buffer) {
  const head = buffer.subarray(0, 16);
  const hex = head.toString("hex");
  const ascii = head.toString("ascii");
  return hex.startsWith("ffd8ff") ||
    hex.startsWith("89504e470d0a1a0a") ||
    ascii.startsWith("GIF87a") ||
    ascii.startsWith("GIF89a") ||
    (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WEBP");
}

function hasVideoSignature(buffer: Buffer) {
  const ascii = buffer.subarray(0, 64).toString("ascii");
  return ascii.includes("ftyp") || ascii.includes("webm") || ascii.includes("matroska");
}

function hasAudioSignature(buffer: Buffer) {
  const head = buffer.subarray(0, 64);
  const hex = head.toString("hex");
  const ascii = head.toString("ascii");
  return ascii.startsWith("ID3") ||
    hex.startsWith("fff") ||
    (ascii.startsWith("RIFF") && ascii.slice(8, 12) === "WAVE") ||
    ascii.includes("ftypM4A") ||
    ascii.includes("OggS") ||
    ascii.includes("webm");
}

function assertSafeTrustMedia(file: Express.Multer.File | undefined, purpose: string) {
  if (!file) throw new HttpError(400, "No file uploaded", ErrorCode.VALIDATION);
  const normalizedPurpose = purpose.toUpperCase();
  const valid = normalizedPurpose === "VOICE"
    ? hasAudioSignature(file.buffer) || hasVideoSignature(file.buffer)
    : file.mimetype.startsWith("image/")
      ? hasImageSignature(file.buffer)
      : hasVideoSignature(file.buffer);
  if (!valid) throw new HttpError(400, "Invalid verification media file", ErrorCode.VALIDATION);
  return normalizedPurpose;
}

export function createD1TrustVerificationUploadRouter(options: D1TrustVerificationUploadOptions) {
  const { db, buckets } = options;
  const access = createD1AccessSessionReader(db, "http");
  const auth = createHttpSessionAuth(access, (_req, res, user) => {
    res.locals.trustUploadUser = user;
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MULTIPART_BYTES },
    fileFilter: (req, file, cb) => {
      const purpose = purposeOf(req).toUpperCase();
      const ext = path.extname(file.originalname).toLowerCase();
      if (purpose === "VOICE") {
        if (!voiceExtensions.includes(ext) || !file.mimetype.startsWith("audio/") && file.mimetype !== "video/webm") {
          cb(new HttpError(400, "Only audio uploads are allowed for voice verification", ErrorCode.VALIDATION));
          return;
        }
        cb(null, true);
        return;
      }
      if (purpose !== "FACE" && purpose !== "LIVENESS") {
        cb(new HttpError(400, "Invalid trust verification upload purpose", ErrorCode.VALIDATION));
        return;
      }
      if (!faceExtensions.includes(ext) || !file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/")) {
        cb(new HttpError(400, "Only image/video uploads are allowed for face and liveness verification", ErrorCode.VALIDATION));
        return;
      }
      cb(null, true);
    }
  });
  const router = Router();

  // Authentication runs before the multipart parser, matching legacy
  // requireAuth -> multer -> handler validation order.
  router.post("/trust-verification", auth.required, upload.single("media"),
    asyncHandler(async (req, res) => {
      const user = res.locals.trustUploadUser as { id: string } | undefined;
      if (!user) throw new HttpError(401, "Missing auth token", ErrorCode.UNAUTHORIZED);
      const file = req.file;
      const purpose = assertSafeTrustMedia(file, purposeOf(req));
      const uploaded = file!;

      const extension = path.extname(uploaded.originalname).toLowerCase().slice(1);
      const name = `${user.id}_${Date.now()}_${randomBytes(3).toString("hex")}.${extension}`;
      const key = trustMediaKey(name);
      const url = `${trustMediaPath}${name}`;
      const mediaId = randomUUID();
      const mediaType = uploaded.mimetype.startsWith("image/")
        ? "IMAGE"
        : uploaded.mimetype.startsWith("video/") ? "VIDEO" : "AUDIO";
      const category = purpose === "VOICE" ? "VOICE_MESSAGE" : "ATTACHMENT";
      const variantName = purpose.toLowerCase();
      const checksum = sha256(uploaded.buffer);
      const version = await nextD1MediaVersion(db, user.id, category);
      const now = new Date().toISOString();

      await buckets["private-media"].put(key, bytesOf(uploaded.buffer), {
        httpMetadata: { contentType: uploaded.mimetype, cacheControl: PRIVATE_CACHE }
      });
      try {
        const [object, variant] = await db.batch([
          db.prepare(`INSERT INTO media_objects
            (source_id, owner_type, owner_id, media_type, category, bucket, storage_key, content_type, file_size,
             width, height, duration, checksum, visibility, processing_status, moderation_status, version,
             created_by, superseded_by_id, deleted_at, created_at, updated_at)
            VALUES (?, 'USER', ?, ?, ?, 'private-media', ?, ?, ?, NULL, NULL, NULL, ?,
              'PRIVATE', 'READY', 'APPROVED', ?, ?, NULL, NULL, ?, ?)`)
            .bind(mediaId, user.id, mediaType, category, key, uploaded.mimetype, uploaded.size,
              checksum, version, user.id, now, now),
          db.prepare(`INSERT INTO media_variants
            (source_id, name, bucket, key, url, content_type, bytes, width, height, media_objects_id, position)
            VALUES (?, ?, 'private-media', ?, ?, ?, ?, NULL, NULL, ?, 0)`)
            .bind(`${mediaId}:${variantName}`, variantName, key, url, uploaded.mimetype, uploaded.size, mediaId)
        ]);
        if (object.meta.changes !== 1 || variant.meta.changes !== 1) {
          throw new HttpError(503, "Verification media registry could not be committed", ErrorCode.INTERNAL);
        }
      } catch (error) {
        await buckets["private-media"].delete(key).catch(() => {});
        throw error;
      }

      sendOk(res, { url, purpose, storage: "private-s3" });
    }));

  router.use((error: unknown, _req: ExpressRequest, _res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "Uploaded file is too large", ErrorCode.VALIDATION));
      return;
    }
    next(error);
  });

  return router;
}
