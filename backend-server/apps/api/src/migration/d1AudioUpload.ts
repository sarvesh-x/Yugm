import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { D1Database, R2Bucket as R2BucketBinding } from "@cloudflare/workers-types";
import type { NextFunction, Request as ExpressRequest, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { createHttpSessionAuth } from "../middleware/httpAccessSession.js";
import { buildMediaKey, type MediaCategory, type R2BucketName } from "../services/mediaKeys.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { nextD1MediaVersion } from "./d1Media.js";

export interface D1AudioUploadOptions {
  db: D1Database;
  buckets: Record<R2BucketName, R2BucketBinding>;
  resolvePublicOrigin: (request: ExpressRequest) => string;
}

// Both legacy routes cap at 10 MB on the Worker runtime. Unlike profile-media,
// neither legacy route performs an audio/video signature check.
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const VOICE_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".webm", ".ogg"];
const RECORDING_EXTENSIONS = [".mp3", ".m4a", ".aac", ".wav", ".webm", ".ogg", ".mp4", ".mov", ".m4v"];
const PUBLIC_CACHE = "public, max-age=31536000, immutable";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytesOf = (value: Buffer) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

export function createD1AudioUploadRouter(options: D1AudioUploadOptions) {
  const { db, buckets, resolvePublicOrigin } = options;
  const access = createD1AccessSessionReader(db, "http");
  const auth = createHttpSessionAuth(access, (_req, res, user) => {
    res.locals.audioUploadUser = user;
  });
  const uploader = (kind: "voice" | "recording") => multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MEDIA_BYTES },
    fileFilter: (_req, file, cb) => {
      const extension = path.extname(file.originalname).toLowerCase();
      const isAudio = file.mimetype.startsWith("audio/");
      const isVideo = file.mimetype.startsWith("video/");
      if (kind === "voice") {
        // Keep the legacy messages; the D1 handler maps generic filter errors
        // to 400 VALIDATION instead of a masked 500.
        if (!VOICE_EXTENSIONS.includes(extension)) {
          cb(new HttpError(400, "Only audio files are allowed", ErrorCode.VALIDATION));
          return;
        }
        if (!isAudio && file.mimetype !== "video/webm") {
          cb(new HttpError(400, "Only audio uploads are allowed", ErrorCode.VALIDATION));
          return;
        }
      } else {
        if (!RECORDING_EXTENSIONS.includes(extension)) {
          cb(new HttpError(400, "Only audio/video recording files are allowed", ErrorCode.VALIDATION));
          return;
        }
        if (!isAudio && !isVideo) {
          cb(new HttpError(400, "Only audio/video uploads are allowed", ErrorCode.VALIDATION));
          return;
        }
      }
      cb(null, true);
    }
  });
  const router = Router();

  const persist = (kind: "voice" | "recording") => asyncHandler(async (req: ExpressRequest, res: Response) => {
    const user = res.locals.audioUploadUser as { id: string } | undefined;
    if (!user) throw new HttpError(401, "Missing auth token", ErrorCode.UNAUTHORIZED);
    const file = req.file;
    if (!file) throw new HttpError(400, "No file uploaded", ErrorCode.VALIDATION);

    const extension = path.extname(file.originalname).toLowerCase().slice(1);
    const category: MediaCategory = kind === "voice" ? "VOICE_MESSAGE" : "ATTACHMENT";
    const variant = kind === "voice" ? "voice_note" : "recording";
    const type = kind === "voice" || file.mimetype.startsWith("audio/") ? "AUDIO" : "VIDEO";
    const mediaId = randomUUID();
    const key = buildMediaKey({
      bucket: "public-media",
      ownerType: "USER",
      ownerId: user.id,
      category,
      versionId: randomUUID(),
      variant,
      extension
    });
    const url = `${resolvePublicOrigin(req)}/api/media/public/${mediaId}/${variant}.${extension}`;
    const checksum = sha256(file.buffer);
    const version = await nextD1MediaVersion(db, user.id, category);
    const now = new Date().toISOString();
    await buckets["public-media"].put(key, bytesOf(file.buffer), {
      httpMetadata: { contentType: file.mimetype, cacheControl: PUBLIC_CACHE }
    });

    try {
      const [object, variantRow] = await db.batch([
        db.prepare(`INSERT INTO media_objects
          (source_id, owner_type, owner_id, media_type, category, bucket, storage_key, content_type, file_size,
           width, height, duration, checksum, visibility, processing_status, moderation_status, version,
           created_by, superseded_by_id, deleted_at, created_at, updated_at)
          VALUES (?, 'USER', ?, ?, ?, 'public-media', ?, ?, ?, NULL, NULL, NULL, ?,
            'PUBLIC', 'READY', 'APPROVED', ?, ?, NULL, NULL, ?, ?)`)
          .bind(mediaId, user.id, type, category, key, file.mimetype, file.size, checksum, version, user.id, now, now),
        db.prepare(`INSERT INTO media_variants
          (source_id, name, bucket, key, url, content_type, bytes, width, height, media_objects_id, position)
          VALUES (?, ?, 'public-media', ?, ?, ?, ?, NULL, NULL, ?, 0)`)
          .bind(`${mediaId}:${variant}`, variant, key, url, file.mimetype, file.size, mediaId)
      ]);
      if (object.meta.changes !== 1 || variantRow.meta.changes !== 1) {
        throw new HttpError(503, "Media registry could not be committed");
      }
    } catch (error) {
      await buckets["public-media"].delete(key).catch(() => {});
      throw error;
    }

    sendOk(res, { url, type, storage: "s3" });
  });

  // Authentication runs before the multipart parser, matching legacy
  // requireAuth -> multer -> handler validation order.
  router.post("/voice-note", auth.required, uploader("voice").single("media"), persist("voice"));
  router.post("/recording", auth.required, uploader("recording").single("media"), persist("recording"));

  router.use((error: unknown, _req: ExpressRequest, _res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "Uploaded file is too large", ErrorCode.VALIDATION));
      return;
    }
    next(error);
  });

  return router;
}
