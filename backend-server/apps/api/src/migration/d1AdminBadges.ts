import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { badgeIcons, badgeId, badgeMetrics, badgeTiers, definitionSchema, honorMetrics } from "../modules/admin/badgeDefinition.js";
import { adminOk } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { assertPublishedAssetReference, publishedAssetReference } from "./d1AssetReferences.js";
import { newId } from "./d1Cosmetics.js";

type Row = Record<string, string | number | null>;
const imageUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 512 * 1024, files: 1, fields: 1 } });
const badgeQuery = `SELECT a.*, (SELECT json_group_array(json_object('tier', tier, 'target', target,
  'rewardCoins', reward_coins, 'rewardCosmetic', reward_cosmetic))
  FROM (SELECT * FROM achievement_tiers WHERE achievements_id = a.source_id ORDER BY position)) AS tiers,
  EXISTS (SELECT 1 FROM assets art WHERE art.source_id = a.asset_ref AND art.status = 'published'
    AND art.owner_type = 'badge' AND art.owner_id = a.id) AS has_managed_art FROM achievements a`;
const missing = () => new HttpError(404, "Badge not found", ErrorCode.NOT_FOUND);

function parseDefinition(req: Request) {
  let candidate: unknown = req.body;
  if (typeof req.body?.definition === "string") {
    try { candidate = JSON.parse(req.body.definition); }
    catch { throw new HttpError(400, "Invalid badge definition"); }
  }
  const result = definitionSchema.safeParse(candidate);
  if (!result.success) throw new HttpError(400, result.error.issues.map(issue => issue.message).join(" "));
  return result.data;
}

async function storeInlineArt(bucket: R2Bucket | undefined, id: string, file: Express.Multer.File | undefined) {
  if (!file) return null;
  const bytes = file.buffer;
  const signature = bytes.subarray(0, 8).toString("hex");
  const mime = signature.startsWith("ffd8ff") ? "image/jpeg"
    : signature === "89504e470d0a1a0a" ? "image/png"
      : bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP" ? "image/webp" : null;
  if (!mime || mime !== file.mimetype) throw new HttpError(400, "Upload a PNG, JPEG, or WebP image.");
  if (!bucket) throw new HttpError(503, "Badge art storage is unavailable");
  const key = `badge-art/${id}/${newId()}`;
  await bucket.put(key, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), { httpMetadata: { contentType: mime } });
  return { key, url: `/api/${key}`, mime };
}

function tiers(db: D1Database, id: string, definitions: ReturnType<typeof parseDefinition>["tiers"], auditId: string) {
  return db.prepare(`INSERT INTO achievement_tiers (source_id, tier, target, reward_coins, reward_cosmetic, achievements_id, position)
    SELECT ?1 || ':tiers:' || key, value ->> '$.tier', value ->> '$.target', value ->> '$.rewardCoins',
      value ->> '$.rewardCosmetic', ?1, key FROM json_each(?2)
    WHERE EXISTS (SELECT 1 FROM admin_audit_logs WHERE source_id = ?3)`)
    .bind(id, JSON.stringify(definitions), auditId);
}

export function createD1AdminBadgesRouter(db: D1Database, secret?: string, bucket?: R2Bucket) {
  const router = Router();
  const manage = createD1AdminGuard(db, secret)("cosmetics.write");
  router.get("/badges", manage, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`${badgeQuery} ORDER BY a.hidden, a."order", a.id`).all<Row>();
    adminOk(res, { badges: results.map(row => ({
      _id: row.source_id, id: row.id, title: row.title, description: row.description, category: row.category,
      icon: row.icon, kind: row.kind, metric: row.metric ?? row.id, weeklyTarget: row.weekly_target ?? undefined,
      hidden: Boolean(row.hidden), order: row.order, assetRef: row.asset_ref ?? undefined,
      imageUrl: row.has_managed_art ? `/api/assets/published/${encodeURIComponent(String(row.asset_ref))}/full` : row.image_url ?? undefined,
      tiers: JSON.parse(String(row.tiers ?? "[]")) as unknown, createdAt: row.created_at, updatedAt: row.updated_at
    })), metrics: badgeMetrics, honorMetrics, icons: badgeIcons, tierNames: badgeTiers });
  }));
  router.post("/badges", manage, imageUpload.single("image"), asyncHandler(async (req, res) => {
    const definition = parseDefinition(req);
    const id = newId();
    const ref = definition.removeImage ? null : definition.assetRef ?? null;
    await assertPublishedAssetReference(db, ref ?? undefined, "badge", definition.id);
    const art = await storeInlineArt(bucket, definition.id, req.file);
    const now = new Date().toISOString();
    const auditId = newId();
    const [inserted] = await db.batch([
      db.prepare(`INSERT INTO achievements (source_id, id, title, description, category, icon, kind, metric, weekly_target,
        hidden, "order", image_mime, image_url, asset_ref, created_at, updated_at)
        SELECT ?1, ?2, ?3, ?4, 'MISC', ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?14
        WHERE NOT EXISTS (SELECT 1 FROM achievements WHERE id = ?2) AND ${publishedAssetReference("?13", "badge", "?2")}`)
        .bind(id, definition.id, definition.title, definition.description, definition.icon, definition.kind, definition.metric,
          definition.weeklyTarget ?? null, Number(definition.hidden), definition.order, art?.mime ?? null, art?.url ?? null, ref, now),
      prepareD1AdminAudit(db, adminFrom(res), { action: "badge.created", entityType: "achievement", entityId: id, auditId,
        metadata: { badgeId: definition.id }, req }, true),
      tiers(db, id, definition.tiers, auditId)
    ]);
    if (!inserted.meta.changes) {
      if (art) await bucket?.delete(art.key);
      throw new HttpError(409, "Badge ID already exists or art is unavailable", ErrorCode.CONFLICT);
    }
    adminOk(res, { id: definition.id }, {}, 201);
  }));
  router.put("/badges/:id", manage, imageUpload.single("image"), asyncHandler(async (req, res) => {
    const definition = parseDefinition(req);
    if (req.params.id !== definition.id) throw new HttpError(400, "Badge IDs cannot be changed");
    const existing = await db.prepare("SELECT source_id, kind, image_url FROM achievements WHERE id = ?")
      .bind(definition.id).first<{ source_id: string; kind: string; image_url: string | null }>();
    if (!existing) throw missing();
    if (existing.kind !== definition.kind) throw new HttpError(400, "Badge types cannot be changed after creation");
    const ref = definition.removeImage ? null : definition.assetRef ?? null;
    await assertPublishedAssetReference(db, ref ?? undefined, "badge", definition.id);
    const art = await storeInlineArt(bucket, definition.id, req.file);
    const replaceInline = Boolean(art || definition.removeImage);
    const id = existing.source_id;
    const now = new Date().toISOString();
    const auditId = newId();
    const [updated] = await db.batch([
      db.prepare(`UPDATE achievements SET title = ?1, description = ?2, icon = ?3, metric = ?4, weekly_target = ?5,
        hidden = ?6, "order" = ?7, asset_ref = CASE WHEN ?8 THEN NULL ELSE COALESCE(?9, asset_ref) END,
        image_mime = CASE WHEN ?10 THEN ?11 ELSE image_mime END, image_url = CASE WHEN ?10 THEN ?12 ELSE image_url END,
        updated_at = ?13 WHERE source_id = ?14 AND ${publishedAssetReference("?9", "badge", "achievements.id")}`)
        .bind(definition.title, definition.description, definition.icon, definition.metric, definition.weeklyTarget ?? null,
          Number(definition.hidden), definition.order, Number(Boolean(definition.removeImage)), ref,
          Number(replaceInline), art?.mime ?? null, art?.url ?? null, now, id),
      prepareD1AdminAudit(db, adminFrom(res), { action: "badge.updated", entityType: "achievement", entityId: id, auditId,
        metadata: { badgeId: definition.id }, req }, true),
      db.prepare(`DELETE FROM achievement_tiers WHERE achievements_id = ? AND EXISTS (
        SELECT 1 FROM admin_audit_logs WHERE source_id = ?)`).bind(id, auditId),
      tiers(db, id, definition.tiers, auditId)
    ]);
    if (!updated.meta.changes) {
      if (art) await bucket?.delete(art.key);
      throw new HttpError(409, "Badge or art changed during the update", ErrorCode.CONFLICT);
    }
    if (replaceInline && existing.image_url?.startsWith(`/api/badge-art/${definition.id}/`)) {
      await bucket?.delete(existing.image_url.slice("/api/".length));
    }
    adminOk(res, { id: definition.id });
  }));
  router.delete("/badges/:id", manage, asyncHandler(async (req, res) => {
    const key = badgeId.safeParse(req.params.id);
    if (!key.success) throw new HttpError(400, "Invalid badge ID");
    const row = await db.prepare("SELECT source_id FROM achievements WHERE id = ?").bind(key.data).first<string>("source_id");
    if (!row) throw missing();
    await db.batch([
      db.prepare("UPDATE achievements SET hidden = 1, updated_at = ? WHERE source_id = ? AND COALESCE(hidden, 0) = 0")
        .bind(new Date().toISOString(), row),
      prepareD1AdminAudit(db, adminFrom(res), { action: "badge.archived", entityType: "achievement", entityId: row,
        metadata: { badgeId: key.data }, req }, true)
    ]);
    adminOk(res, { archived: true });
  }));
  router.use("/badges", (error: unknown, _req: Request, _res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError) {
      next(new HttpError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "Upload one badge image up to 512 KB."));
      return;
    }
    next(error);
  });
  return router;
}

export function createD1BadgeArtRouter(db: D1Database, bucket?: R2Bucket) {
  const router = Router();
  router.get("/:id/:version", asyncHandler(async (req, res) => {
    const { id, version } = req.params;
    if (!badgeId.safeParse(id).success || !/^[a-f0-9-]{24,36}$/i.test(version)) throw missing();
    const key = `badge-art/${id}/${version}`;
    const mime = await db.prepare(`SELECT image_mime FROM achievements WHERE id = ? AND image_url = ?
      AND COALESCE(hidden, 0) = 0`).bind(id, `/api/${key}`).first<string>("image_mime");
    if (!mime || !["image/png", "image/jpeg", "image/webp"].includes(mime)) throw missing();
    const object = await bucket?.get(key);
    if (!object) throw missing();
    res.type(mime).set({ "Cache-Control": "public, max-age=3600, immutable",
      "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff" }).send(Buffer.from(await object.arrayBuffer()));
  }));
  return router;
}
