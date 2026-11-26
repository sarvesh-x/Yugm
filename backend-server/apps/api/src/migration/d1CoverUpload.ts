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

export interface D1CoverUploadOptions {
  db: D1Database;
  buckets: Record<R2BucketName, R2BucketBinding>;
  resolvePublicOrigin: (request: ExpressRequest) => string;
}

// Legacy /api/upload/cover uses the image multer config: 5 MB, image MIME,
// jpg/jpeg/png/gif/webp extensions and a byte-signature check. Its D1
// counterpart stores original bytes in public-media and registers a public
// media object so the existing media delivery route can serve the URL.
const MAX_COVER_BYTES = 5 * 1024 * 1024;
const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const PUBLIC_CACHE = "public, max-age=31536000, immutable";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytesOf = (value: Buffer) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

export function createD1CoverUploadRouter(options: D1CoverUploadOptions) {
  const { db, buckets, resolvePublicOrigin } = options;
  const access = createD1AccessSessionReader(db, "http");
  const auth = createHttpSessionAuth(access, (_req, res, user) => {
    res.locals.coverUploadUser = user;
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_COVER_BYTES },
    fileFilter: (_req, file, cb) => {
      // The legacy filter throws a generic Error, which the D1 error handler
      // masks. Surface the same rule with the legacy message and a validation
      // status so callers keep an actionable response.
      if (!allowedExtensions.includes(path.extname(file.originalname).toLowerCase())) {
        cb(new HttpError(400, "Only images (jpg, jpeg, png, gif, webp) allowed", ErrorCode.VALIDATION));
        return;
      }
      if (!file.mimetype.startsWith("image/")) {
        cb(new HttpError(400, "Only image uploads are allowed", ErrorCode.VALIDATION));
        return;
      }
      cb(null, true);
    }
  });
  const router = Router();

  // Authentication runs before the multipart parser, matching legacy
  // requireAuth -> multer -> handler validation order.
  router.post("/cover", auth.required, upload.single("cover"),
    asyncHandler(async (req, res) => {
      const user = res.locals.coverUploadUser as { id: string } | undefined;
      if (!user) throw new HttpError(401, "Missing auth token", ErrorCode.UNAUTHORIZED);
      const file = req.file;
      if (!file) throw new HttpError(400, "No file uploaded", ErrorCode.VALIDATION);
      try {
        assertImageSignature(file.buffer);
      } catch {
        throw new HttpError(400, "Invalid image file", ErrorCode.VALIDATION);
      }

      const extension = path.extname(file.originalname).toLowerCase().slice(1);
      const mediaId = randomUUID();
      const key = buildMediaKey({
        bucket: "public-media",
        ownerType: "USER",
        ownerId: user.id,
        category: "COVER",
        versionId: randomUUID(),
        variant: "cover",
        extension
      });
      const url = `${resolvePublicOrigin(req)}/api/media/public/${mediaId}/cover.${extension}`;
      const checksum = sha256(file.buffer);
      // media_objects owns one row per owner/category/version. Allocate a new
      // version so repeated direct cover uploads do not collide.
      const version = await nextD1MediaVersion(db, user.id, "COVER");
      const now = new Date().toISOString();
      await buckets["public-media"].put(key, bytesOf(file.buffer), {
        httpMetadata: { contentType: file.mimetype, cacheControl: PUBLIC_CACHE }
      });

      try {
        const [object, variant] = await db.batch([
          db.prepare(`INSERT INTO media_objects
            (source_id, owner_type, owner_id, media_type, category, bucket, storage_key, content_type, file_size,
             width, height, duration, checksum, visibility, processing_status, moderation_status, version,
             created_by, superseded_by_id, deleted_at, created_at, updated_at)
            VALUES (?, 'USER', ?, 'IMAGE', 'COVER', 'public-media', ?, ?, ?, NULL, NULL, NULL, ?,
              'PUBLIC', 'READY', 'APPROVED', ?, ?, NULL, NULL, ?, ?)`)
            .bind(mediaId, user.id, key, file.mimetype, file.size, checksum, version, user.id, now, now),
          db.prepare(`INSERT INTO media_variants
            (source_id, name, bucket, key, url, content_type, bytes, width, height, media_objects_id, position)
            VALUES (?, 'cover', 'public-media', ?, ?, ?, ?, NULL, NULL, ?, 0)`)
            .bind(`${mediaId}:cover`, key, url, file.mimetype, file.size, mediaId)
        ]);
        if (object.meta.changes !== 1 || variant.meta.changes !== 1) {
          throw new HttpError(503, "Cover media registry could not be committed");
        }
      } catch (error) {
        await buckets["public-media"].delete(key).catch(() => {});
        throw error;
      }

      sendOk(res, { url, storage: "s3" });
    }));

  // Multer's size error is normalized to the legacy responseError mapping;
  // filter errors already carry the legacy validation message.
  router.use((error: unknown, _req: ExpressRequest, _res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      next(new HttpError(413, "Uploaded file is too large", ErrorCode.VALIDATION));
      return;
    }
    next(error);
  });

  return router;
}
