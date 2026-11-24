import { createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import type { D1Database, R2Bucket as R2BucketBinding } from "@cloudflare/workers-types";
import type { Request as ExpressRequest } from "express";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { getImageProcessor } from "../services/imageProcessor.js";
import { buildMediaKey, buildStagingKey, type R2BucketName } from "../services/mediaKeys.js";
import {
  assertStagedUpload,
  MAX_IMAGE_DIMENSION,
  MAX_IMAGE_PIXELS,
  mediaUploadLimits as categoryLimits,
  SESSION_TTL_SECONDS,
  USER_MEDIA_QUOTA_BYTES,
  validateUploadRequest
} from "../services/mediaUploadPolicy.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";

interface MediaUploadSessionRow {
  source_id: string;
  user_id: string;
  category: string;
  expected_content_type: string;
  expected_bytes: number;
  owner_type: string;
  owner_id: string;
  bucket: string;
  staging_key: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "CANCELLED" | "EXPIRED" | "FAILED";
  expires_at: string;
  completed_at: string | null;
  media_id: string | null;
  attempts: number;
  quota_reserved: number;
  upload_token_hash: string;
  created_at: string;
  updated_at: string;
}

interface MediaObjectRow {
  source_id: string;
  owner_type: string;
  owner_id: string;
  category: string;
  bucket: R2BucketName;
  storage_key: string;
  content_type: string;
  file_size: number;
  visibility: "PUBLIC" | "PRIVATE";
  processing_status: string;
  moderation_status: string;
  deleted_at: string | null;
  version: number;
  superseded_by_id: string | null;
}

interface MediaVariantRow {
  name: string;
  bucket: R2BucketName;
  key: string;
  content_type: string;
  bytes: number;
}

export interface D1MediaRouterOptions {
  db: D1Database;
  buckets: Record<R2BucketName, R2BucketBinding>;
  /** The loopback origin used for absolute public/upload URLs in local development. */
  resolvePublicOrigin: (request: ExpressRequest) => string;
  /** Process-local signing key for short-lived private delivery grants. */
  grantSecret: string;
}

const SESSION_ID = /^[a-f0-9-]{36}$/i;
const MEDIA_ID = /^[a-f0-9-]{36}$/i;
const PUBLIC_VARIANT = /^([a-z0-9_]+)\.(webp|png|jpe?g|gif)$/i;
const PRIVATE_CACHE = "private, no-store";
const PUBLIC_CACHE = "public, max-age=31536000, immutable";

const hash = (value: string | Uint8Array) => createHash("sha256").update(value).digest("hex");
const bytesOf = (value: Buffer) => new Uint8Array(value.buffer, value.byteOffset, value.byteLength);

function signGrant(secret: string, payload: string) {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

function verifyGrant(secret: string, payload: string, grant: string) {
  const expected = Buffer.from(signGrant(secret, payload));
  const actual = Buffer.from(grant);
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function verifyUploadGrant(storedHash: string, grant: string) {
  const expected = Buffer.from(storedHash);
  const actual = Buffer.from(hash(grant));
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

function readSession(db: D1Database, sessionId: string) {
  if (!SESSION_ID.test(sessionId)) throw new HttpError(400, "Invalid upload session", ErrorCode.VALIDATION);
  return db.prepare("SELECT * FROM media_upload_sessions WHERE source_id = ?").bind(sessionId).first<MediaUploadSessionRow>();
}

function readMedia(db: D1Database, mediaId: string) {
  if (!MEDIA_ID.test(mediaId)) throw new HttpError(400, "Invalid media id");
  return db.prepare("SELECT * FROM media_objects WHERE source_id = ?").bind(mediaId).first<MediaObjectRow>();
}

function publicMediaUrl(origin: string, mediaId: string, variant: string, extension: string) {
  return `${origin}/api/media/public/${mediaId}/${variant}.${extension}`;
}

async function readObject(bucket: R2BucketBinding, key: string) {
  const object = await bucket.get(key);
  if (!object) return undefined;
  return { body: Buffer.from(await object.arrayBuffer()), size: object.size, contentType: object.httpMetadata?.contentType };
}

async function putObject(
  bucket: R2BucketBinding, key: string, body: Buffer, contentType: string, isPrivate: boolean
) {
  await bucket.put(key, bytesOf(body), {
    httpMetadata: { contentType, cacheControl: isPrivate ? PRIVATE_CACHE : PUBLIC_CACHE }
  });
}

async function transitionSession(
  db: D1Database, session: MediaUploadSessionRow, status: "EXPIRED" | "FAILED", now: string
) {
  await db.prepare(`UPDATE media_upload_sessions SET status = ?, quota_reserved = 0, updated_at = ?
    WHERE source_id = ? AND status = ?`).bind(status, now, session.source_id, session.status).run();
}

async function nextMediaVersion(db: D1Database, userId: string) {
  const counterId = `USER:${userId}:AVATAR`;
  await db.prepare("INSERT INTO media_counters (source_id, seq) VALUES (?, 0) ON CONFLICT (source_id) DO NOTHING")
    .bind(counterId).run();
  const version = await db.prepare("UPDATE media_counters SET seq = seq + 1 WHERE source_id = ? RETURNING seq")
    .bind(counterId).first<{ seq: number }>("seq");
  if (typeof version !== "number") throw new HttpError(503, "Media version could not be allocated", ErrorCode.INTERNAL);
  return version;
}

function classifyUnclaimable(session: MediaUploadSessionRow) {
  if (session.status === "EXPIRED") throw new HttpError(410, "Upload session has expired");
  if (session.status === "COMPLETED") throw new HttpError(409, "Upload session is already completed", ErrorCode.CONFLICT);
  throw new HttpError(409, "Upload session is no longer pending", ErrorCode.CONFLICT);
}

export function createD1MediaRouter(options: D1MediaRouterOptions) {
  const { db, buckets, resolvePublicOrigin, grantSecret } = options;
  const access = createD1AccessSessionReader(db, "http");
  const router = Router();

  const completedResult = async (req: ExpressRequest, mediaId: string) => {
    const media = await readMedia(db, mediaId);
    const variant = await db.prepare("SELECT key FROM media_variants WHERE media_objects_id = ? AND name = 'avatar_256'")
      .bind(mediaId).first<{ key: string }>();
    if (!media || !variant?.key.endsWith(".webp")) {
      throw new HttpError(409, "Upload session is already completed", ErrorCode.CONFLICT);
    }
    return {
      mediaId,
      avatarUrl: publicMediaUrl(resolvePublicOrigin(req), mediaId, "avatar_256", "webp"),
      mediaType: "IMAGE",
      version: media.version
    };
  };

  router.post("/uploads", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const body = (req.body ?? {}) as Record<string, unknown>;
    const { category, contentType, extension } = validateUploadRequest({
      category: String(body.category ?? ""),
      contentType: String(body.contentType ?? ""),
      bytes: Number(body.bytes),
      fileName: String(body.fileName ?? ""),
      actorId: user.id
    });
    if (!getImageProcessor()) {
      throw new HttpError(503, "Managed media uploads are unavailable on this host");
    }

    const sessionId = randomUUID();
    const grant = randomBytes(32).toString("base64url");
    const stagingKey = buildStagingKey(sessionId, extension);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + SESSION_TTL_SECONDS * 1000).toISOString();
    const time = now.toISOString();
    const bytes = Number(body.bytes);
    const [, opened] = await db.batch([
      db.prepare(`INSERT INTO media_quota_reservations (source_id, bytes, created_at, updated_at)
        VALUES (?, 0, ?, ?) ON CONFLICT (source_id) DO NOTHING`).bind(user.id, time, time),
      db.prepare(`INSERT INTO media_upload_sessions
        (source_id, user_id, category, expected_content_type, expected_bytes, owner_type, owner_id,
         bucket, staging_key, status, expires_at, attempts, quota_reserved, upload_token_hash, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, 'USER', ?, 'staging', ?, 'PENDING', ?, 0, 1, ?, ?, ?
        FROM media_quota_reservations WHERE source_id = ? AND bytes + ? + (
          SELECT COALESCE(SUM(file_size), 0) FROM media_objects
          WHERE owner_type = 'USER' AND owner_id = ? AND deleted_at IS NULL
        ) <= ?`).bind(sessionId, user.id, category, contentType, bytes, user.id, stagingKey, expiresAt,
          hash(grant), time, time, user.id, bytes, user.id, USER_MEDIA_QUOTA_BYTES),
      db.prepare(`UPDATE media_quota_reservations SET bytes = bytes + ?, updated_at = ? WHERE source_id = ?
        AND EXISTS (SELECT 1 FROM media_upload_sessions WHERE source_id = ?)`).bind(bytes, time, user.id, sessionId)
    ]);
    if (opened.meta.changes !== 1) {
      throw new HttpError(413, "Your media storage quota has been reached");
    }

    const uploadUrl = `${resolvePublicOrigin(req)}/api/media/uploads/${sessionId}/bytes?grant=${encodeURIComponent(grant)}`;
    sendOk(res, {
      sessionId,
      uploadUrl,
      method: "PUT",
      requiredHeaders: { "Content-Type": contentType },
      expiresAt,
      expiresIn: SESSION_TTL_SECONDS,
      maxBytes: categoryLimits[category].bytes,
      category
    }, 201);
  }));

  router.put("/uploads/:sessionId/bytes", asyncHandler(async (req, res) => {
    const session = await readSession(db, req.params.sessionId);
    if (!session) throw new HttpError(404, "Upload session not found", ErrorCode.NOT_FOUND);
    const grant = typeof req.query.grant === "string" ? req.query.grant : "";
    if (!grant || !verifyUploadGrant(session.upload_token_hash, grant)) {
      throw new HttpError(403, "Upload grant is invalid", ErrorCode.FORBIDDEN);
    }
    if (session.status !== "PENDING") classifyUnclaimable(session);
    if (Date.parse(session.expires_at) <= Date.now()) {
      await transitionSession(db, session, "EXPIRED", new Date().toISOString());
      throw new HttpError(410, "Upload session has expired");
    }
    const contentType = req.header("content-type")?.trim().toLowerCase() ?? "";
    if (contentType !== session.expected_content_type) {
      throw new HttpError(400, "Uploaded file has the wrong content type", ErrorCode.VALIDATION);
    }
    const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);
    if (body.byteLength !== session.expected_bytes) {
      throw new HttpError(400, "Uploaded file size does not match the upload session", ErrorCode.VALIDATION);
    }
    await putObject(buckets.staging, session.staging_key, body, session.expected_content_type, true);
    res.status(204).end();
  }));

  router.post("/uploads/:sessionId/complete", asyncHandler(async (req, res) => {
    const { user, claims } = await requireHttpSession(req.headers.authorization, access);
    let session = await readSession(db, req.params.sessionId);
    if (!session || session.user_id !== user.id) {
      throw new HttpError(404, "Upload session not found", ErrorCode.NOT_FOUND);
    }
    if (session.status === "COMPLETED") {
      if (!session.media_id) throw new HttpError(409, "Upload session is already completed", ErrorCode.CONFLICT);
      sendOk(res, await completedResult(req, session.media_id));
      return;
    }
    if (session.status !== "PENDING") classifyUnclaimable(session);
    if (Date.parse(session.expires_at) <= Date.now()) {
      await transitionSession(db, session, "EXPIRED", new Date().toISOString());
      throw new HttpError(410, "Upload session has expired");
    }

    const now = new Date();
    const claim = await db.prepare(`UPDATE media_upload_sessions SET status = 'PROCESSING', attempts = attempts + 1,
      updated_at = ? WHERE source_id = ? AND user_id = ? AND status = 'PENDING' AND expires_at > ?`)
      .bind(now.toISOString(), session.source_id, user.id, now.toISOString()).run();
    if (claim.meta.changes === 0) {
      session = await readSession(db, session.source_id);
      if (!session || session.user_id !== user.id) throw new HttpError(404, "Upload session not found", ErrorCode.NOT_FOUND);
      classifyUnclaimable(session);
      throw new HttpError(409, "Upload session is no longer pending", ErrorCode.CONFLICT);
    }
    session = { ...session, status: "PROCESSING" };
    const createdObjects: Array<{ bucket: R2BucketName; key: string }> = [];

    try {
      const staged = await readObject(buckets.staging, session.staging_key);
      if (!staged) throw new HttpError(400, "Uploaded file was not found", ErrorCode.VALIDATION);
      assertStagedUpload(session.expected_bytes, { contentLength: staged.size, body: staged.body });
      const processor = getImageProcessor();
      if (!processor) throw new HttpError(503, "Image processing is unavailable on this host");
      const metadata = await processor.metadata(staged.body);
      if (!metadata.width || !metadata.height || metadata.width > MAX_IMAGE_DIMENSION ||
        metadata.height > MAX_IMAGE_DIMENSION) {
        throw new HttpError(400, "Uploaded image dimensions are outside the supported range", ErrorCode.VALIDATION);
      }

      const mediaId = randomUUID();
      const versionId = randomUUID();
      const version = await nextMediaVersion(db, user.id);
      const extension = session.staging_key.split(".").pop() ?? "";
      const originalKey = buildMediaKey({
        bucket: "originals", ownerType: "USER", ownerId: user.id, category: "AVATAR",
        versionId, variant: "original", extension
      });
      await putObject(buckets.originals, originalKey, staged.body, session.expected_content_type, true);
      createdObjects.push({ bucket: "originals", key: originalKey });

      const variants: Array<{ row: MediaVariantRow; width: number; height: number }> = [{
        row: {
          name: "original", bucket: "originals", key: originalKey,
          content_type: session.expected_content_type, bytes: staged.body.byteLength
        },
        width: metadata.width,
        height: metadata.height
      }];
      let avatarUrl = "";
      let avatarKey = "";
      for (const size of [64, 128, 256]) {
        const output = await processor.resizeToWebp(staged.body, {
          width: size, height: size, fit: "inside", withoutEnlargement: true,
          quality: 82, animated: false, limitInputPixels: MAX_IMAGE_PIXELS
        });
        const key = buildMediaKey({
          bucket: "public-media", ownerType: "USER", ownerId: user.id, category: "AVATAR",
          versionId, variant: `avatar_${size}`, extension: "webp"
        });
        await putObject(buckets["public-media"], key, output.data, "image/webp", false);
        createdObjects.push({ bucket: "public-media", key });
        variants.push({
          row: {
            name: `avatar_${size}`, bucket: "public-media", key,
            content_type: "image/webp", bytes: output.data.byteLength
          },
          width: output.info.width,
          height: output.info.height
        });
        if (size === 256) {
          avatarUrl = publicMediaUrl(resolvePublicOrigin(req), mediaId, "avatar_256", "webp");
          avatarKey = key;
        }
      }

      const finishedAt = new Date().toISOString();
      const completed = `EXISTS (SELECT 1 FROM media_upload_sessions WHERE source_id = ? AND status = 'COMPLETED' AND media_id = ?)`;
      const sessionId = session.source_id;
      const write = (sql: string, ...args: Array<string | number | null>) => db.prepare(sql).bind(...args, sessionId, mediaId);
      const changedFields = JSON.stringify(["avatar", "avatarType", "avatarParts", "activeCosmetics", "activeCosmetics.avatarAsset",
        ...AVATAR_PART_KEYS.map(key => `avatarParts.${key}`)]);
      const statements = [
        db.prepare(`UPDATE media_upload_sessions SET status = 'COMPLETED', media_id = ?, completed_at = ?, quota_reserved = 0, updated_at = ?
          WHERE source_id = ? AND user_id = ? AND status = 'PROCESSING' AND EXISTS (
            SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL
          )`).bind(mediaId, finishedAt, finishedAt, session.source_id, user.id, ...bindD1LiveUser(claims, finishedAt)),
        write(`INSERT INTO media_objects
          (source_id, owner_type, owner_id, media_type, category, bucket, storage_key, content_type, file_size,
           width, height, duration, checksum, visibility, processing_status, moderation_status, version,
           created_by, superseded_by_id, deleted_at, created_at, updated_at)
          SELECT ?, 'USER', ?, 'IMAGE', 'AVATAR', 'public-media', ?, ?, ?, ?, ?, NULL, ?,
            'PUBLIC', 'READY', 'APPROVED', ?, ?, NULL, NULL, ?, ? WHERE ${completed}`,
        mediaId, user.id, avatarKey, session.expected_content_type, staged.body.byteLength,
        metadata.width, metadata.height, hash(staged.body), version, user.id, finishedAt, finishedAt)
      ];
      for (const [position, variant] of variants.entries()) {
        statements.push(write(`INSERT INTO media_variants
          (source_id, name, bucket, key, url, content_type, bytes, width, height, media_objects_id, position)
          SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${completed}`,
        `${mediaId}:${variant.row.name}`, variant.row.name, variant.row.bucket, variant.row.key,
        variant.row.bucket === "public-media" ? publicMediaUrl(resolvePublicOrigin(req), mediaId, variant.row.name, "webp") : null,
        variant.row.content_type, variant.row.bytes, variant.width, variant.height, mediaId, position));
      }
      statements.push(
        write(`UPDATE media_objects SET superseded_by_id = ?, updated_at = ? WHERE deleted_at IS NULL
          AND source_id = (SELECT avatar_media_id FROM users WHERE source_id = ?) AND ${completed}`, mediaId, finishedAt, user.id),
        write(`UPDATE users SET avatar = ?, avatar_media_id = ?, avatar_type = 'UPLOADED', active_cosmetics_avatar_asset = '',
          avatar_parts_background = NULL, avatar_parts_clothes = NULL, avatar_parts_head = NULL, avatar_parts_mouth = NULL,
          avatar_parts_eyes = NULL, avatar_parts_top = NULL, updated_at = ? WHERE source_id = ? AND ${completed}`,
        avatarUrl, mediaId, finishedAt, user.id),
        write(`UPDATE user_auth_profile SET
          null_fields = (SELECT json_group_array(value) FROM (SELECT value FROM json_each(null_fields)
            WHERE value NOT IN (SELECT value FROM json_each(?)) UNION ALL SELECT 'avatarParts')),
          missing_fields = (SELECT json_group_array(value) FROM json_each(missing_fields) WHERE value NOT IN (SELECT value FROM json_each(?)))
          WHERE source_id = ? AND ${completed}`, changedFields, changedFields, user.id)
      );

      const [committed] = await db.batch(statements);
      if (committed.meta.changes === 0) {
        throw new HttpError(409, "Upload session is no longer processing", ErrorCode.CONFLICT);
      }
      sendOk(res, { mediaId, avatarUrl, mediaType: "IMAGE", version });
    } catch (error) {
      await Promise.all(createdObjects.map(({ bucket, key }) => buckets[bucket].delete(key).catch(() => {})));
      await transitionSession(db, session, "FAILED", new Date().toISOString());
      throw error;
    }
  }));

  router.delete("/uploads/:sessionId", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const session = await readSession(db, req.params.sessionId);
    if (!session || session.user_id !== user.id) {
      throw new HttpError(404, "Upload session not found", ErrorCode.NOT_FOUND);
    }
    if (session.status === "COMPLETED") {
      throw new HttpError(409, "Upload session is already completed", ErrorCode.CONFLICT);
    }
    const now = new Date().toISOString();
    const claim = await db.prepare(`UPDATE media_upload_sessions SET status = 'CANCELLED', quota_reserved = 0,
      updated_at = ? WHERE source_id = ? AND user_id = ? AND status = 'PENDING' AND quota_reserved = 1`)
      .bind(now, session.source_id, user.id).run();
    if (claim.meta.changes === 1) {
      await buckets.staging.delete(session.staging_key).catch(() => {});
    }
    sendOk(res, { sessionId: session.source_id, status: "CANCELLED" });
  }));

  router.get("/public/:mediaId/:file", asyncHandler(async (req, res) => {
    const file = PUBLIC_VARIANT.exec(req.params.file);
    if (!file) throw new HttpError(400, "Invalid media variant", ErrorCode.VALIDATION);
    const variant = await db.prepare(`SELECT v.bucket, v.key, v.content_type FROM media_variants AS v
      JOIN media_objects AS m ON m.source_id = v.media_objects_id
      WHERE v.media_objects_id = ? AND v.name = ? AND m.visibility = 'PUBLIC'
        AND m.processing_status = 'READY' AND m.moderation_status <> 'REJECTED' AND m.deleted_at IS NULL`)
      .bind(req.params.mediaId, file[1]).first<Pick<MediaVariantRow, "bucket" | "key" | "content_type">>();
    if (!variant || !["assets", "public-media"].includes(variant.bucket)) {
      throw new HttpError(404, "Media not found", ErrorCode.NOT_FOUND);
    }
    const object = await readObject(buckets[variant.bucket], variant.key);
    if (!object) throw new HttpError(404, "Media not found", ErrorCode.NOT_FOUND);
    res.status(200);
    res.setHeader("Content-Type", variant.content_type);
    res.setHeader("Cache-Control", PUBLIC_CACHE);
    res.end(object.body);
  }));

  router.get("/private/:mediaId/:variant", asyncHandler(async (req, res) => {
    const expires = Number(req.query.expires);
    const grant = typeof req.query.grant === "string" ? req.query.grant : "";
    const payload = `${req.params.mediaId}:${req.params.variant}:${expires}`;
    if (!Number.isSafeInteger(expires) || expires <= Math.floor(Date.now() / 1000) ||
      !grant || !verifyGrant(grantSecret, payload, grant)) {
      throw new HttpError(403, "Media grant is invalid", ErrorCode.FORBIDDEN);
    }
    const variant = await db.prepare(`SELECT bucket, key, content_type FROM media_variants
      WHERE media_objects_id = ? AND name = ?`).bind(req.params.mediaId, req.params.variant)
      .first<Pick<MediaVariantRow, "bucket" | "key" | "content_type">>();
    if (!variant || !["private-media", "originals"].includes(variant.bucket)) {
      throw new HttpError(404, "Media not found", ErrorCode.NOT_FOUND);
    }
    const object = await readObject(buckets[variant.bucket], variant.key);
    if (!object) throw new HttpError(404, "Media not found", ErrorCode.NOT_FOUND);
    res.status(200);
    res.setHeader("Content-Type", variant.content_type);
    res.setHeader("Cache-Control", PRIVATE_CACHE);
    res.end(object.body);
  }));

  router.get("/:mediaId/download", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const media = await readMedia(db, req.params.mediaId);
    if (!media || media.deleted_at || media.processing_status !== "READY" || media.moderation_status === "REJECTED") {
      throw new HttpError(404, "Media not found", ErrorCode.NOT_FOUND);
    }
    const isOwner = media.owner_type === "USER" && media.owner_id === user.id;
    if (!isOwner && media.visibility !== "PUBLIC") {
      throw new HttpError(403, "Media access denied", ErrorCode.FORBIDDEN);
    }
    const expires = Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS;
    const payload = `${media.source_id}:original:${expires}`;
    const downloadUrl = `${resolvePublicOrigin(req)}/api/media/private/${media.source_id}/original?expires=${expires}` +
      `&grant=${encodeURIComponent(signGrant(grantSecret, payload))}`;
    sendOk(res, {
      media: {
        mediaId: media.source_id, ownerType: media.owner_type, ownerId: media.owner_id,
        category: media.category, mediaType: "IMAGE", bucket: media.bucket, storageKey: media.storage_key,
        contentType: media.content_type, fileSize: media.file_size, visibility: media.visibility,
        processingStatus: media.processing_status, moderationStatus: media.moderation_status, version: media.version
      },
      downloadUrl,
      expiresIn: SESSION_TTL_SECONDS
    });
  }));

  return router;
}
