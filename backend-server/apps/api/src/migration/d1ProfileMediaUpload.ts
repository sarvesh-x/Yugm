import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { D1Database, R2Bucket as R2BucketBinding } from "@cloudflare/workers-types";
import type { NextFunction, Request as ExpressRequest, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { createHttpSessionAuth } from "../middleware/httpAccessSession.js";
import { buildMediaKey, type R2BucketName } from "../services/mediaKeys.js";
import { assertImageSignature } from "../services/mediaUploadPolicy.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { nextD1MediaVersion } from "./d1Media.js";

export interface D1ProfileMediaUploadOptions {
  db: D1Database;
  buckets: Record<R2BucketName, R2BucketBinding>;
  resolvePublicOrigin: (request: ExpressRequest) => string;
}

type MediaKind = "IMAGE" | "VIDEO";

// Legacy profile-media and story uploads share the image/video multer config.
// The Node runtime allowed 25 MB; the Worker runtime clamped it to 10 MB, so
// the D1 Worker keeps the 10 MB host boundary.
const MAX_MEDIA_BYTES = 10 * 1024 * 1024;
const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".mp4", ".mov", ".m4v", ".webm"];
const PUBLIC_CACHE = "public, max-age=31536000, immutable";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytesOf = (value: Buffer) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

function assertVideoSignature(content: Uint8Array) {
  const head = new TextDecoder("ascii").decode(content.subarray(0, 64));
  if (!head.includes("ftyp") && !head.includes("webm") && !head.includes("matroska")) {
    throw new HttpError(400, "Invalid media file", ErrorCode.VALIDATION);
  }
}

function assertMediaSignature(file: Express.Multer.File): MediaKind {
  const isImage = file.mimetype.startsWith("image/");
  try {
    if (isImage) assertImageSignature(file.buffer);
    else assertVideoSignature(file.buffer);
  } catch {
    throw new HttpError(400, "Invalid media file", ErrorCode.VALIDATION);
  }
  return isImage ? "IMAGE" : "VIDEO";
}

export function createD1ProfileMediaUploadRouter(options: D1ProfileMediaUploadOptions) {
  const { db, buckets, resolvePublicOrigin } = options;
  const access = createD1AccessSessionReader(db, "http");
  const auth = createHttpSessionAuth(access, (_req, res, user) => {
    res.locals.profileMediaUploadUser = user;
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MEDIA_BYTES },
    fileFilter: (_req, file, cb) => {
      // The legacy filter throws a generic Error, which the D1 error handler
      // masks. Keep the legacy rule and message with an actionable status.
      if (!allowedExtensions.includes(path.extname(file.originalname).toLowerCase()) ||
          (!file.mimetype.startsWith("image/") && !file.mimetype.startsWith("video/"))) {
        cb(new HttpError(400, "Only image/video uploads are allowed", ErrorCode.VALIDATION));
        return;
      }
      cb(null, true);
    }
  });
  const router = Router();

  const persist = (variant: "profile" | "story") => asyncHandler(async (req: ExpressRequest, res: Response) => {
    const user = res.locals.profileMediaUploadUser as { id: string } | undefined;
    if (!user) throw new HttpError(401, "Missing auth token", ErrorCode.UNAUTHORIZED);
    const file = req.file;
    if (!file) throw new HttpError(400, "No file uploaded", ErrorCode.VALIDATION);
    const type = assertMediaSignature(file);

    const extension = path.extname(file.originalname).toLowerCase().slice(1);
    const mediaId = randomUUID();
    const key = buildMediaKey({
      bucket: "public-media",
      ownerType: "USER",
      ownerId: user.id,
      category: "GALLERY",
      versionId: randomUUID(),
      variant,
      extension
    });
    const url = `${resolvePublicOrigin(req)}/api/media/public/${mediaId}/${variant}.${extension}`;
    const checksum = sha256(file.buffer);
    // Profile-media and story share the GALLERY category, so each upload needs
    // its own owner/category version under the media_objects unique index.
    const version = await nextD1MediaVersion(db, user.id, "GALLERY");
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
          VALUES (?, 'USER', ?, ?, 'GALLERY', 'public-media', ?, ?, ?, NULL, NULL, NULL, ?,
            'PUBLIC', 'READY', 'APPROVED', ?, ?, NULL, NULL, ?, ?)`)
          .bind(mediaId, user.id, type, key, file.mimetype, file.size, checksum, version, user.id, now, now),
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
  router.post("/profile-media", auth.required, upload.single("media"), persist("profile"));
  router.post("/story", auth.required, upload.single("media"), persist("story"));

  router.use((error: unknown, _req: ExpressRequest, _res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "Uploaded file is too large", ErrorCode.VALIDATION));
      return;
    }
    next(error);
  });

  return router;
}
