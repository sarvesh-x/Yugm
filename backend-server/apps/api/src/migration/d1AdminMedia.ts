import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Request } from "express";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { buildQuotaReconciliation } from "../services/mediaQuotaReconciliation.js";
import { asyncHandler, ErrorCode, HttpError } from "../utils/http.js";
import { createD1AdminGuard } from "./d1AdminAuth.js";

type Row = Record<string, string | number | null>;
const categories = ["AVATAR", "COVER", "GALLERY", "CHAT_IMAGE", "CHAT_VIDEO", "VOICE_MESSAGE", "ATTACHMENT",
  "BADGE", "COSMETIC", "STICKER", "APPLICATION_ART"];
const visibilities = ["PUBLIC", "PRIVATE"];
const processing = ["PENDING", "PROCESSING", "READY", "FAILED"];
const uploadStatuses = ["PENDING", "PROCESSING", "COMPLETED", "CANCELLED", "EXPIRED", "FAILED"];
const param = (limit: number) => z.string().trim().min(1).max(limit).optional();
const mediaQuery = z.object({ ownerType: param(64), ownerId: param(128), category: param(64),
  visibility: param(32), status: param(32), deleted: z.enum(["true", "false"]).optional() });
const sessionQuery = z.object({ userId: param(128), status: param(32), category: param(64) });

function query<T>(schema: z.ZodType<T>, req: Request) {
  const parsed = schema.safeParse(req.query);
  if (!parsed.success) throw new HttpError(422, "Invalid media filters", ErrorCode.VALIDATION);
  return parsed.data;
}
const allowed = (value: string | undefined, values: string[]) => value && values.includes(value) ? value : null;

export function createD1AdminMediaRouter(db: D1Database, secret?: string) {
  const router = Router();
  const canRead = createD1AdminGuard(db, secret)("cosmetics.read");
  const readPage = async (req: Request, select: string, from: string, order: string, args: (string | null)[] = []) => {
    const { page, limit, skip } = pageParams(req.query);
    const [items, count] = await db.batch<Row>([
      db.prepare(`SELECT ${select} FROM ${from} ORDER BY ${order} LIMIT ? OFFSET ?`).bind(...args, limit, skip),
      db.prepare(`SELECT COUNT(*) AS total FROM ${from}`).bind(...args)
    ]);
    return { rows: items.results, meta: paginationMeta(page, limit, Number(count.results[0]?.total ?? 0)) };
  };
  router.get("/media", canRead, asyncHandler(async (req, res) => {
    const filter = query(mediaQuery, req);
    const { rows, meta } = await readPage(req, `m.source_id AS id, m.owner_type AS ownerType, m.owner_id AS ownerId,
      m.media_type AS mediaType, m.category, m.bucket, m.storage_key AS storageKey, m.checksum, m.file_size AS bytes,
      m.visibility, m.processing_status AS processingStatus, m.moderation_status AS moderationStatus, m.version,
      (SELECT COUNT(*) FROM media_variants v WHERE v.media_objects_id = m.source_id) AS variantCount,
      m.deleted_at AS deletedAt, m.created_at AS createdAt`,
    `media_objects m WHERE (?1 IS NULL OR m.owner_type = ?1) AND (?2 IS NULL OR m.owner_id = ?2)
      AND (?3 IS NULL OR m.category = ?3) AND (?4 IS NULL OR m.visibility = ?4) AND (?5 IS NULL OR m.processing_status = ?5)
      AND (?6 IS NULL OR (m.deleted_at IS NOT NULL) = (?6 = 'true'))`, "m.created_at DESC, m.source_id",
    [filter.ownerType ?? null, filter.ownerId ?? null, allowed(filter.category, categories),
      allowed(filter.visibility, visibilities), allowed(filter.status, processing), filter.deleted ?? null]);
    adminOk(res, { media: rows }, meta);
  }));
  router.get("/media/sessions", canRead, asyncHandler(async (req, res) => {
    const filter = query(sessionQuery, req);
    const { rows, meta } = await readPage(req, `source_id AS id, user_id AS userId, category, status,
      expected_bytes AS expectedBytes, owner_type AS ownerType, owner_id AS ownerId, expires_at AS expiresAt,
      quota_reserved AS quotaReserved`, `media_upload_sessions WHERE (?1 IS NULL OR user_id = ?1)
      AND (?2 IS NULL OR status = ?2) AND (?3 IS NULL OR category = ?3)`, "expires_at, source_id",
    [filter.userId ?? null, allowed(filter.status, uploadStatuses), allowed(filter.category, categories)]);
    adminOk(res, { sessions: rows.map(row => ({ ...row, quotaReserved: Boolean(row.quotaReserved) })) }, meta);
  }));
  router.get("/media/quotas", canRead, asyncHandler(async (req, res) => {
    const { rows, meta } = await readPage(req, "source_id AS userId, bytes, updated_at AS updatedAt",
      "media_quota_reservations", "bytes DESC, source_id");
    adminOk(res, { quotas: rows }, meta);
  }));
  router.get("/media/quota-reconciliation", canRead, asyncHandler(async (_req, res) => {
    const now = new Date().toISOString();
    const [counters, expected, stale] = await db.batch<{ userId: string; bytes: number }>([
      db.prepare("SELECT source_id AS userId, bytes FROM media_quota_reservations"),
      db.prepare(`SELECT user_id AS userId, SUM(expected_bytes) AS bytes FROM media_upload_sessions
        WHERE quota_reserved = 1 AND status IN ('PENDING','PROCESSING') AND expires_at > ? GROUP BY user_id`).bind(now),
      db.prepare(`SELECT COUNT(*) AS bytes FROM media_upload_sessions WHERE quota_reserved = 1
        AND (status NOT IN ('PENDING','PROCESSING') OR expires_at <= ?)`).bind(now)
    ]);
    adminOk(res, { reconciliation: buildQuotaReconciliation(counters.results, expected.results, stale.results[0].bytes, now) });
  }));
  return router;
}
