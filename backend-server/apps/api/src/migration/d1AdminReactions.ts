import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { Router, type NextFunction, type Request, type Response } from "express";
import multer from "multer";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { normalizeReactionId, toPublicRoomReaction } from "../services/reactionCatalog.js";
import { asyncHandler, ErrorCode, HttpError } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";
import { ensureDefaultReactions, type ReactionRow } from "./d1RoomReactions.js";

type Row = ReactionRow & { is_active: number; asset_storage_key: string | null; mime_type: string | null;
  created_at: string | null; updated_at: string | null };
const mimeTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1, fields: 10 } });
const reactionSchema = z.object({
  id: z.string().trim().min(1).max(64).regex(/^[a-z0-9_-]+$/i).optional(),
  label: z.string().trim().min(1).max(60), emoji: z.string().trim().max(16).optional(),
  assetUrl: z.string().trim().url().max(2048).optional(), imageUrl: z.string().trim().url().max(2048).optional(),
  access: z.enum(["EVERYONE", "VIP_EXCLUSIVE"]).optional(), assetKind: z.enum(["STATIC", "ANIMATED"]).optional(),
  isActive: z.union([z.boolean(), z.enum(["true", "false"])]).transform(value => value === true || value === "true").optional(),
  sortOrder: z.coerce.number().int().min(-10000).max(10000).optional()
});
const missing = () => new HttpError(404, "Reaction not found", ErrorCode.NOT_FOUND);
const fileKey = /^reaction-art\/[a-f0-9]{24}$/;
const publicPath = "/api/reaction-art/";

function external(data: { assetUrl?: string; imageUrl?: string }) {
  const value = data.assetUrl ?? data.imageUrl;
  if (value && !/^https?:\/\//i.test(value)) {
    throw new HttpError(400, "Reaction image URL must start with http:// or https://", ErrorCode.VALIDATION);
  }
  return value ?? null;
}

function present(row: Row) {
  return { ...toPublicRoomReaction({ _id: row.source_id, label: row.label, emoji: row.emoji, assetUrl: row.asset_url,
    access: row.access, assetKind: row.asset_kind, sortOrder: row.sort_order }),
    isActive: Boolean(row.is_active), createdAt: row.created_at, updatedAt: row.updated_at,
    mimeType: row.mime_type ?? "", assetStorageKey: row.asset_storage_key ?? "" };
}

async function storeArt(file: Express.Multer.File | undefined, bucket: R2Bucket | undefined, origin: string) {
  if (!file) return null;
  const bytes = file.buffer;
  const ascii = bytes.toString("ascii", 0, 12);
  const hex = bytes.subarray(0, 8).toString("hex");
  const mime = hex.startsWith("ffd8ff") ? "image/jpeg" : hex === "89504e470d0a1a0a" ? "image/png"
    : ascii.startsWith("GIF87a") || ascii.startsWith("GIF89a") ? "image/gif"
      : ascii.startsWith("RIFF") && ascii.endsWith("WEBP") ? "image/webp" : null;
  if (!mime || mime !== file.mimetype) throw new HttpError(400, "Invalid image file", ErrorCode.VALIDATION);
  if (!bucket) throw new HttpError(503, "Reaction art storage is unavailable");
  const version = newId();
  const key = `reaction-art/${version}`;
  await bucket.put(key, new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength), { httpMetadata: { contentType: mime } });
  return { url: origin + publicPath + version, key, mime };
}

export function createD1AdminReactionsRouter(db: D1Database, origin: (req: Request) => string, secret?: string, bucket?: R2Bucket) {
  const router = Router();
  const canWrite = createD1AdminGuard(db, secret)("cosmetics.write");
  const parse = (req: Request, patch = false) => {
    const result = (patch ? reactionSchema.partial() : reactionSchema).safeParse(req.body);
    if (!result.success) throw new HttpError(422, "Invalid reaction fields", ErrorCode.VALIDATION);
    return result.data;
  };
  const remove = (key: string | null | undefined) => key && fileKey.test(key) ? bucket?.delete(key) : undefined;
  const read = (id: string) => db.prepare("SELECT * FROM room_reactions WHERE source_id = ?").bind(id).first<Row>();
  router.get("/reactions", canWrite, asyncHandler(async (req, res) => {
    await ensureDefaultReactions(db);
    const { page, limit, skip } = pageParams(req.query);
    const q = typeof req.query.q === "string" ? req.query.q.trim().toLowerCase() || null : null;
    const access = req.query.access === "EVERYONE" || req.query.access === "VIP_EXCLUSIVE" ? req.query.access : null;
    const active = typeof req.query.active === "string" ? Number(req.query.active === "true") : null;
    const query = `FROM room_reactions WHERE (?1 IS NULL OR instr(lower(source_id), ?1) > 0 OR instr(lower(label), ?1) > 0)
      AND (?2 IS NULL OR access = ?2) AND (?3 IS NULL OR is_active = ?3)`;
    const [items, count] = await db.batch<Row | { total: number }>([
      db.prepare(`SELECT * ${query} ORDER BY sort_order, created_at, source_id LIMIT ?4 OFFSET ?5`).bind(q, access, active, limit, skip),
      db.prepare(`SELECT COUNT(*) AS total ${query}`).bind(q, access, active)
    ]);
    adminOk(res, { reactions: (items.results as Row[]).map(present) }, paginationMeta(page, limit, (count.results[0] as { total: number }).total));
  }));
  router.post("/reactions", canWrite, upload.single("asset"), asyncHandler(async (req, res) => {
    const data = parse(req);
    const url = external(data);
    if (!req.file && !data.emoji && !url) throw new HttpError(400, "Provide a reaction image file, image URL, or an emoji");
    if (!data.label) throw new HttpError(422, "Reaction label is required", ErrorCode.VALIDATION);
    await ensureDefaultReactions(db);
    const fileName = req.file?.originalname.replace(/\.[^.]+$/, "").replace(/[^a-z0-9_-]+/gi, "_");
    const id = normalizeReactionId(data.id || fileName || `reaction_${newId()}`);
    const art = await storeArt(req.file, bucket, origin(req));
    const now = new Date().toISOString();
    const admin = adminFrom(res);
    const [created] = await db.batch<Row>([
      db.prepare(`INSERT INTO room_reactions (source_id, label, emoji, asset_url, asset_storage_key, asset_kind, mime_type,
        access, is_active, sort_order, created_by, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (source_id) DO NOTHING RETURNING *`)
        .bind(id, data.label, data.emoji ?? "", art?.url ?? url, art?.key ?? null, data.assetKind ?? "STATIC",
          art?.mime ?? null, data.access ?? "EVERYONE", Number(data.isActive ?? true), data.sortOrder ?? 0, admin.id, now, now),
      prepareD1AdminAudit(db, admin, { action: "CREATE_REACTION", entityType: "RoomReaction", entityId: id,
        metadata: { hasAsset: Boolean(art || url), hasEmoji: Boolean(data.emoji) }, req }, true)
    ]);
    if (!created.results[0]) {
      await remove(art?.key);
      throw new HttpError(409, "A reaction with this id already exists", ErrorCode.CONFLICT);
    }
    adminOk(res, { reaction: present(created.results[0]) }, {}, 201);
  }));
  router.patch("/reactions/:id", canWrite, upload.single("asset"), asyncHandler(async (req, res) => {
    const id = normalizeReactionId(req.params.id);
    await ensureDefaultReactions(db);
    const before = await read(id);
    if (!before) throw missing();
    const data = parse(req, true);
    const url = external(data);
    const art = await storeArt(req.file, bucket, origin(req));
    const replaceArt = Boolean(art || url);
    const [updated] = await db.batch<Row>([
      db.prepare(`UPDATE room_reactions SET label = COALESCE(?1, label), emoji = COALESCE(?2, emoji),
        access = COALESCE(?3, access), asset_kind = COALESCE(?4, asset_kind), is_active = COALESCE(?5, is_active),
        sort_order = COALESCE(?6, sort_order), asset_url = CASE WHEN ?7 THEN ?8 ELSE asset_url END,
        asset_storage_key = CASE WHEN ?7 THEN ?9 ELSE asset_storage_key END, mime_type = CASE WHEN ?7 THEN ?10 ELSE mime_type END,
        updated_at = ?11 WHERE source_id = ?12 AND (?7 = 0 OR asset_storage_key IS ?13) RETURNING *`)
        .bind(data.label ?? null, data.emoji ?? null, data.access ?? null, data.assetKind ?? null,
          data.isActive === undefined ? null : Number(data.isActive), data.sortOrder ?? null, Number(replaceArt), art?.url ?? url,
          art?.key ?? null, art?.mime ?? null, new Date().toISOString(), id, before.asset_storage_key),
      prepareD1AdminAudit(db, adminFrom(res), { action: "UPDATE_REACTION", entityType: "RoomReaction", entityId: id,
        metadata: { updates: Object.keys(data), replacedAsset: replaceArt }, req }, true)
    ]);
    if (!updated.results[0]) {
      await remove(art?.key);
      throw new HttpError(409, "Reaction changed during the update", ErrorCode.CONFLICT);
    }
    if (replaceArt) await remove(before.asset_storage_key);
    adminOk(res, { reaction: present(updated.results[0]) });
  }));
  router.delete("/reactions/:id", canWrite, asyncHandler(async (req, res) => {
    const id = normalizeReactionId(req.params.id);
    const [removed] = await db.batch<Row>([
      db.prepare("DELETE FROM room_reactions WHERE source_id = ? RETURNING *").bind(id),
      prepareD1AdminAudit(db, adminFrom(res), { action: "DELETE_REACTION", entityType: "RoomReaction", entityId: id, req }, true)
    ]);
    if (!removed.results[0]) throw missing();
    await remove(removed.results[0].asset_storage_key);
    adminOk(res, { deleted: true, id });
  }));
  router.use("/reactions", (error: unknown, _req: Request, _res: Response, next: NextFunction) => {
    if (error instanceof multer.MulterError) next(new HttpError(error.code === "LIMIT_FILE_SIZE" ? 413 : 400, "Upload one image up to 2 MB."));
    else next(error);
  });
  return router;
}

export function createD1ReactionArtRouter(db: D1Database, bucket?: R2Bucket) {
  const router = Router();
  router.get("/:version", asyncHandler(async (req, res) => {
    const key = `reaction-art/${req.params.version}`;
    if (!fileKey.test(key)) throw missing();
    const mime = await db.prepare("SELECT mime_type FROM room_reactions WHERE is_active = 1 AND asset_storage_key = ?").bind(key)
      .first<string>("mime_type");
    if (!mime || !mimeTypes.includes(mime)) throw missing();
    const object = await bucket?.get(key);
    if (!object) throw missing();
    res.type(mime).set({ "Cache-Control": "public, max-age=300",
      "Cross-Origin-Resource-Policy": "cross-origin", "X-Content-Type-Options": "nosniff" }).send(Buffer.from(await object.arrayBuffer()));
  }));
  return router;
}
