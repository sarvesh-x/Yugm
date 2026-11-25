import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { getImageProcessor } from "../services/imageProcessor.js";
import { asyncHandler, ErrorCode, HttpError } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";

const ownerTypes = ["cosmetic", "badge", "gift"] as const;
const statuses = ["staging", "published", "archived"] as const;
const ownerId = z.string().trim().regex(/^[a-zA-Z0-9_-]{1,64}$/);
const fields = z.object({ ownerType: z.enum(ownerTypes), ownerId, originalName: z.string().trim().max(200).optional() });
const filters = z.object({ ownerType: z.enum(ownerTypes).optional(), ownerId: ownerId.optional(), status: z.enum(statuses).optional() });
const maxBytes = 8 * 1024 * 1024;
const allowedImages = new Map([["image/jpeg", "jpg"], ["image/jpg", "jpg"], ["image/png", "png"], ["image/webp", "webp"], ["image/gif", "gif"]]);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: maxBytes, files: 1, fields: 3, fieldSize: 1024, parts: 5 } });
type AssetBuckets = { assets: R2Bucket; staging: R2Bucket };
type Asset = {
  source_id: string; owner_type: typeof ownerTypes[number]; owner_id: string; status: typeof statuses[number];
  version: number; original_name: string; mime_type: string; bytes: number; width: number; height: number;
  sha256: string; staging_key: string; public_key: string | null; created_by: string;
  created_at: string | null; updated_at: string | null; published_at: string | null; archived_at: string | null;
  variants_json: string;
};
type Variant = { name: string; key: string; contentType: string; bytes: number; width: number; height: number };
const assetQuery = `SELECT a.*, (SELECT json_group_array(json_object('name', name, 'key', key, 'contentType', content_type,
  'bytes', bytes, 'width', width, 'height', height)) FROM (SELECT * FROM asset_variants
  WHERE assets_id = a.source_id ORDER BY position)) AS variants_json FROM assets a`;
const variants = (row: Asset) => JSON.parse(row.variants_json) as Variant[];
const missing = () => new HttpError(404, "Asset not found", ErrorCode.NOT_FOUND);
const contentBytes = (buffer: Buffer) => new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);

export function createD1AdminAssetsRouter(db: D1Database, origin: (req: Request) => string, buckets?: AssetBuckets, secret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const read = guard("cosmetics.read");
  const write = guard("cosmetics.write");
  const storage = () => {
    if (!buckets) throw new HttpError(503, "Managed asset storage is unavailable");
    return buckets;
  };
  const find = (id: string) => db.prepare(assetQuery + " WHERE a.source_id = ?").bind(id).first<Asset>();
  const publicUrl = (req: Request, id: string, name: string) =>
    `${origin(req)}/api/assets/published/${encodeURIComponent(id)}/${encodeURIComponent(name)}`;
  const present = (row: Asset, req: Request) => ({
    id: row.source_id, ownerType: row.owner_type, ownerId: row.owner_id, status: row.status, version: row.version,
    originalName: row.original_name, mimeType: row.mime_type, bytes: row.bytes, width: row.width, height: row.height,
    sha256: row.sha256, publicKey: row.public_key ?? undefined, publicUrl: row.public_key && row.status === "published"
      ? publicUrl(req, row.source_id, "full") : undefined,
    variants: row.status === "published" ? variants(row).map(variant => ({
      ...variant, url: publicUrl(req, row.source_id, variant.name)
    })) : [],
    createdBy: row.created_by, publishedAt: row.published_at ?? undefined, archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  });

  router.get("/assets", read, asyncHandler(async (req, res) => {
    const parsed = filters.safeParse(req.query);
    if (!parsed.success) throw new HttpError(422, "Invalid asset filters", ErrorCode.VALIDATION);
    const filter = parsed.data;
    const { page, limit, skip } = pageParams(req.query);
    const where = `WHERE (?1 IS NULL OR a.owner_type = ?1) AND (?2 IS NULL OR a.owner_id = ?2) AND (?3 IS NULL OR a.status = ?3)`;
    const params = [filter.ownerType ?? null, filter.ownerId ?? null, filter.status ?? null];
    const [assets, count] = await db.batch<Asset | { total: number }>([
      db.prepare(`${assetQuery} ${where} ORDER BY a.created_at DESC, a.source_id LIMIT ?4 OFFSET ?5`).bind(...params, limit, skip),
      db.prepare(`SELECT COUNT(*) AS total FROM assets a ${where}`).bind(...params)
    ]);
    adminOk(res, { assets: (assets.results as Asset[]).map(asset => present(asset, req)) },
      paginationMeta(page, limit, (count.results[0] as { total: number }).total));
  }));
  router.get("/assets/staging/:fileName", read, asyncHandler(async (req, res) => {
    const { fileName } = req.params;
    if (!/^[a-z0-9_-]{1,180}\.(jpe?g|png|webp|gif)$/i.test(fileName)) throw missing();
    const key = `assets-staging/${fileName}`;
    const row = await db.prepare("SELECT mime_type FROM assets WHERE staging_key = ? AND status <> 'archived'")
      .bind(key).first<{ mime_type: string }>();
    if (!row || !allowedImages.has(row.mime_type)) throw missing();
    const object = await storage().staging.get(key);
    if (!object) throw missing();
    res.set({ "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff",
      "Content-Type": row.mime_type, "Content-Length": String(object.size) });
    await pipeline(Readable.from(object.body.values()), res);
  }));
  router.get("/assets/:id", read, asyncHandler(async (req, res) => {
    const asset = await find(req.params.id);
    if (!asset) throw missing();
    adminOk(res, { asset: present(asset, req) });
  }));
  router.post("/assets", write, upload.single("asset"), asyncHandler(async (req, res) => {
    const { staging } = storage();
    const data = fields.safeParse(req.body);
    if (!data.success) throw new HttpError(422, "Invalid asset owner", ErrorCode.VALIDATION);
    const file = req.file;
    if (!file || !file.size) throw new HttpError(400, "An asset file is required", ErrorCode.VALIDATION);
    const mime = file.mimetype.toLowerCase();
    const extension = allowedImages.get(mime);
    if (!extension) throw new HttpError(400, "Only JPEG, PNG, WebP and GIF assets are supported");
    const processor = getImageProcessor();
    const dimensions = await processor.metadata(file.buffer, { animated: true, limitInputPixels: 8192 ** 2 }).catch(() => null);
    if (!dimensions || dimensions.width < 1 || dimensions.height < 1 || dimensions.width > 8192 || dimensions.height > 8192) {
      throw new HttpError(400, "Image is unsupported or outside the permitted dimensions", ErrorCode.VALIDATION);
    }
    const digest = createHash("sha256").update(file.buffer).digest("hex");
    const id = newId();
    const { ownerType, ownerId, originalName } = data.data;
    const name = `${id}.${extension}`;
    const key = `assets-staging/${name}`;
    const now = new Date().toISOString();
    const admin = adminFrom(res);
    await staging.put(key, contentBytes(file.buffer), { httpMetadata: { contentType: mime } });
    const [inserted, , matching] = await db.batch<Asset>([
      db.prepare(`INSERT INTO assets (source_id, owner_type, owner_id, kind, status, version, original_name, mime_type,
        bytes, width, height, sha256, staging_key, staging_url, created_by, created_at, updated_at)
        SELECT ?1, ?2, ?3, 'IMAGE', 'staging',
          (SELECT COALESCE(MAX(version), 0) + 1 FROM assets WHERE owner_type = ?2 AND owner_id = ?3),
          ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?13 WHERE NOT EXISTS (
            SELECT 1 FROM assets WHERE owner_type = ?2 AND owner_id = ?3 AND sha256 = ?9 AND status <> 'archived')`)
        .bind(id, ownerType, ownerId, (originalName ?? file.originalname).slice(0, 200), mime, file.size, dimensions.width,
          dimensions.height, digest, key, `/api/admin/assets/staging/${name}`, admin.id, now),
      prepareD1AdminAudit(db, admin, { action: "asset.staged", entityType: "AssetObject", entityId: id,
        metadata: { ownerType, ownerId, sha256: digest }, req }, true),
      db.prepare(`${assetQuery} WHERE a.owner_type = ? AND a.owner_id = ? AND a.sha256 = ? AND a.status <> 'archived'
        ORDER BY a.version DESC LIMIT 1`).bind(ownerType, ownerId, digest)
    ]);
    if (!inserted.meta.changes) await staging.delete(key);
    const asset = matching.results[0];
    if (!asset) throw missing();
    adminOk(res, { asset: present(asset, req) }, {}, 201);
  }));
  router.post("/assets/:id/publish", write, asyncHandler(async (req, res) => {
    const current = await find(req.params.id);
    if (!current) throw missing();
    if (current.status === "archived") throw new HttpError(409, "Archived assets cannot be published", ErrorCode.CONFLICT);
    if (current.status === "published") {
      adminOk(res, { asset: present(current, req) });
      return;
    }
    const { staging, assets } = storage();
    const object = await staging.get(current.staging_key);
    if (!object) throw new HttpError(409, "Staged asset bytes are missing", ErrorCode.CONFLICT);
    if (object.size !== current.bytes || object.size > maxBytes) {
      await object.body.cancel();
      throw new HttpError(409, "Staged asset size has changed", ErrorCode.CONFLICT);
    }
    const buffer = Buffer.from(await object.arrayBuffer());
    if (createHash("sha256").update(buffer).digest("hex") !== current.sha256) {
      throw new HttpError(409, "Staged asset checksum has changed", ErrorCode.CONFLICT);
    }
    const processor = getImageProcessor();
    const attempt = newId();
    const sizes = [["full", 1600], ["preview", 512]] as const;
    const outputs = await Promise.all(sizes.map(async ([name, width]) => ({
      name, key: `assets/${current.source_id}/${attempt}/${name}.webp`,
      ...(await processor.resizeToWebp(buffer, { width, withoutEnlargement: true,
        quality: 84, animated: true, limitInputPixels: 8192 ** 2 }))
    })));
    const outcome = await Promise.allSettled(outputs.map(output =>
      assets.put(output.key, contentBytes(output.data), { httpMetadata: { contentType: "image/webp" } })));
    if (outcome.some(item => item.status === "rejected")) {
      await assets.delete(outputs.map(output => output.key));
      throw new HttpError(503, "Asset upload failed");
    }
    const time = new Date().toISOString();
    const full = outputs[0].key;
    const id = current.source_id;
    const [updated, , ...remaining] = await db.batch<Asset>([
      db.prepare(`UPDATE assets SET status = 'published', public_key = ?, public_url = ?, published_at = ?, updated_at = ?
        WHERE source_id = ? AND status = 'staging'`).bind(full, publicUrl(req, id, "full"), time, time, id),
      prepareD1AdminAudit(db, adminFrom(res), { action: "asset.published", entityType: "AssetObject", entityId: id,
        metadata: { ownerType: current.owner_type, ownerId: current.owner_id, version: current.version }, req }, true),
      ...outputs.map((output, position) => db.prepare(`INSERT INTO asset_variants
        (source_id, name, key, url, content_type, bytes, width, height, assets_id, position)
        SELECT ?, ?, ?, ?, 'image/webp', ?, ?, ?, ?, ? WHERE EXISTS (
          SELECT 1 FROM assets WHERE source_id = ? AND status = 'published' AND public_key = ?)`)
        .bind(`${id}:${output.name}`, output.name, output.key, publicUrl(req, id, output.name), output.data.byteLength,
          output.info.width, output.info.height, id, position, id, full)),
      db.prepare(`${assetQuery} WHERE a.source_id = ?`).bind(id)
    ]);
    if (!updated.meta.changes) await assets.delete(outputs.map(output => output.key));
    const result = remaining.at(-1)?.results[0];
    if (result?.status !== "published") throw new HttpError(409, "Asset is no longer staged", ErrorCode.CONFLICT);
    adminOk(res, { asset: present(result, req) });
  }));
  router.delete("/assets/:id", write, asyncHandler(async (req, res) => {
    const id = req.params.id;
    const { staging, assets } = storage();
    const time = new Date().toISOString();
    const [, , result] = await db.batch<Asset>([
      db.prepare(`UPDATE assets SET status = 'archived', public_key = NULL, public_url = NULL, archived_at = ?2, updated_at = ?2
        WHERE source_id = ?1 AND status <> 'archived' AND NOT EXISTS (SELECT 1 FROM cosmetics WHERE asset_ref = ?1)
        AND NOT EXISTS (SELECT 1 FROM achievements WHERE asset_ref = ?1)`).bind(id, time),
      prepareD1AdminAudit(db, adminFrom(res), { action: "asset.archived", entityType: "AssetObject", entityId: id, req }, true),
      db.prepare(`${assetQuery} WHERE a.source_id = ?`).bind(id)
    ]);
    const asset = result.results[0];
    if (!asset) throw missing();
    if (asset.status !== "archived") throw new HttpError(409, "Asset is still referenced by a catalog item", ErrorCode.CONFLICT);
    const keys = variants(asset).map(variant => variant.key);
    if (keys.length) await assets.delete(keys);
    if (asset.staging_key.startsWith("assets-staging/")) await staging.delete(asset.staging_key);
    adminOk(res, { asset: present(asset, req) });
  }));
  router.use((error: unknown, _req: Request, _res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      next(new HttpError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "Upload one image up to 8 MB."));
      return;
    }
    next(error);
  });
  return router;
}
