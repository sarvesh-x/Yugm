import { createHash, randomUUID } from "node:crypto";
import path from "node:path";
import type { D1Database, R2Bucket as R2BucketBinding } from "@cloudflare/workers-types";
import type { NextFunction, Request as ExpressRequest, Response } from "express";
import { Router } from "express";
import multer from "multer";
import { createHttpSessionAuth, requireHttpSession } from "../middleware/httpAccessSession.js";
import { buildMediaKey, type R2BucketName } from "../services/mediaKeys.js";
import { assertImageSignature } from "../services/mediaUploadPolicy.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { clearProfileMarkers } from "./d1Cosmetics.js";
import { nextD1MediaVersion } from "./d1Media.js";

export interface D1AvatarUploadOptions {
  db: D1Database;
  buckets: Record<R2BucketName, R2BucketBinding>;
  resolvePublicOrigin: (request: ExpressRequest) => string;
}

// Legacy /api/upload/avatar uses the image multer config (5 MB multipart cap)
// and then applies its own 220 KB avatar limit after the signature check.
const MAX_MULTIPART_BYTES = 5 * 1024 * 1024;
const AVATAR_MAX_BYTES = 220 * 1024;
const allowedExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];
const PUBLIC_CACHE = "public, max-age=31536000, immutable";

const sha256 = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytesOf = (value: Buffer) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

export function createD1AvatarUploadRouter(options: D1AvatarUploadOptions) {
  const { db, buckets, resolvePublicOrigin } = options;
  const access = createD1AccessSessionReader(db, "http");
  const auth = createHttpSessionAuth(access, (_req, res, user) => {
    res.locals.avatarUploadUser = user;
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_MULTIPART_BYTES },
    fileFilter: (_req, file, cb) => {
      // The legacy filter throws a generic Error, which the D1 error handler
      // masks. Keep the legacy rule and message with an actionable status.
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

  router.post("/avatar", auth.required, upload.single("avatar"), asyncHandler(async (req, res) => {
    const user = res.locals.avatarUploadUser as { id: string } | undefined;
    if (!user) throw new HttpError(401, "Missing auth token", ErrorCode.UNAUTHORIZED);
    const file = req.file;
    if (!file) throw new HttpError(400, "No file uploaded", ErrorCode.VALIDATION);
    try {
      assertImageSignature(file.buffer);
    } catch {
      throw new HttpError(400, "Invalid image file", ErrorCode.VALIDATION);
    }
    if (file.size > AVATAR_MAX_BYTES) {
      throw new HttpError(400, "Avatar image is too large. Please choose or crop a smaller image.", ErrorCode.VALIDATION);
    }

    // Revalidate the session at the write boundary so the profile update and
    // media registry cannot commit after a logout or token generation change.
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const now = new Date().toISOString();
    const live = bindD1LiveUser(claims, now);
    const liveGuard = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter})`;
    const write = (sql: string, ...values: Array<string | number | null>) => db.prepare(sql).bind(...values, ...live);

    const previous = await db.prepare(`SELECT o.bucket, o.storage_key FROM media_objects AS o
      WHERE o.source_id = (SELECT avatar_media_id FROM users WHERE source_id = ?) AND o.deleted_at IS NULL`)
      .bind(user.id).first<{ bucket: string; storage_key: string }>();

    const extension = path.extname(file.originalname).toLowerCase().slice(1);
    const mediaId = randomUUID();
    const key = buildMediaKey({
      bucket: "public-media",
      ownerType: "USER",
      ownerId: user.id,
      category: "AVATAR",
      versionId: randomUUID(),
      variant: "avatar",
      extension
    });
    const url = `${resolvePublicOrigin(req)}/api/media/public/${mediaId}/avatar.${extension}`;
    const checksum = sha256(file.buffer);
    const version = await nextD1MediaVersion(db, user.id, "AVATAR");
    await buckets["public-media"].put(key, bytesOf(file.buffer), {
      httpMetadata: { contentType: file.mimetype, cacheControl: PUBLIC_CACHE }
    });

    const changedFields = ["avatar", "avatarType", "avatarParts", "activeCosmetics", "activeCosmetics.avatarAsset",
      ...AVATAR_PART_KEYS.map(part => `avatarParts.${part}`)];
    try {
      const results = await db.batch([
        write(`UPDATE media_objects SET superseded_by_id = ?, updated_at = ? WHERE deleted_at IS NULL
          AND source_id = (SELECT avatar_media_id FROM users WHERE source_id = ?) AND ${liveGuard}`,
        mediaId, now, user.id),
        write(`INSERT INTO media_objects
          (source_id, owner_type, owner_id, media_type, category, bucket, storage_key, content_type, file_size,
           width, height, duration, checksum, visibility, processing_status, moderation_status, version,
           created_by, superseded_by_id, deleted_at, created_at, updated_at)
          SELECT ?, 'USER', ?, 'IMAGE', 'AVATAR', 'public-media', ?, ?, ?, NULL, NULL, NULL, ?,
            'PUBLIC', 'READY', 'APPROVED', ?, ?, NULL, NULL, ?, ? WHERE ${liveGuard}`,
        mediaId, user.id, key, file.mimetype, file.size, checksum, version, user.id, now, now),
        write(`INSERT INTO media_variants
          (source_id, name, bucket, key, url, content_type, bytes, width, height, media_objects_id, position)
          SELECT ?, 'avatar', 'public-media', ?, ?, ?, ?, NULL, NULL, ?, 0 WHERE ${liveGuard}`,
        `${mediaId}:avatar`, key, url, file.mimetype, file.size, mediaId),
        write(`UPDATE users SET avatar = ?, avatar_media_id = ?, avatar_type = 'UPLOADED', active_cosmetics_avatar_asset = '',
          avatar_parts_background = NULL, avatar_parts_clothes = NULL, avatar_parts_head = NULL, avatar_parts_mouth = NULL,
          avatar_parts_eyes = NULL, avatar_parts_top = NULL, updated_at = ? WHERE source_id = ? AND ${liveGuard}`,
        url, mediaId, now, user.id),
        clearProfileMarkers(db, user.id, changedFields, liveGuard, ...live)
      ]);
      if (results[3].meta.changes !== 1) {
        throw new HttpError(409, "Avatar upload is no longer authorized", ErrorCode.CONFLICT);
      }
    } catch (error) {
      await buckets["public-media"].delete(key).catch(() => {});
      throw error;
    }

    if (previous?.bucket === "public-media" && previous.storage_key !== key) {
      await buckets["public-media"].delete(previous.storage_key).catch(() => {});
    }
    sendOk(res, { url, storage: "s3" });
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
