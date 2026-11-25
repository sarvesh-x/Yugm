import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import type { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { createCosmeticSchema, updateCosmeticSchema } from "../modules/admin/cosmeticSchemas.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { assertPublishedAssetReference, publishedAssetReference } from "./d1AssetReferences.js";
import { seedDefaultCosmetics } from "./d1Cosmetics.js";

type Row = Record<string, string | number | null>;
const columns = { type: "type", name: "name", coinPrice: "coin_price", rarity: "rarity", preview: "preview",
  isActive: "is_active", assetKind: "asset_kind", assetUrl: "asset_url", assetRef: "asset_ref" } as const;

function present(row: Row) {
  return {
    _id: row.source_id, type: row.type, name: row.name, coinPrice: row.coin_price,
    rarity: row.rarity, preview: row.preview, isActive: Boolean(row.is_active), rewardOnly: Boolean(row.reward_only),
    assetKind: row.asset_kind ?? undefined, assetUrl: row.asset_url ?? undefined, assetRef: row.asset_ref ?? undefined,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

export function createD1AdminCosmeticsRouter(db: D1Database, secret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const canRead = guard("cosmetics.read");
  const canWrite = guard("cosmetics.write");
  const find = (id: string) => db.prepare("SELECT * FROM cosmetics WHERE source_id = ?").bind(id).first<Row>();

  router.get("/cosmetics", canRead, asyncHandler(async (req, res) => {
    const { page, limit, skip } = pageParams(req.query);
    const { type, rarity, q } = req.query;
    const filters = [type, rarity, q].map(value => typeof value === "string" && value ? value : null);
    const where = `WHERE (?1 IS NULL OR type = ?1) AND (?2 IS NULL OR rarity = ?2)
      AND (?3 IS NULL OR instr(lower(name), lower(?3)) > 0)`;
    const [items, count] = await db.batch<Row>([
      db.prepare(`SELECT * FROM cosmetics ${where} ORDER BY created_at DESC, source_id LIMIT ?4 OFFSET ?5`)
        .bind(...filters, limit, skip),
      db.prepare(`SELECT COUNT(*) AS total FROM cosmetics ${where}`).bind(...filters)
    ]);
    adminOk(res, { data: items.results.map(present), meta: paginationMeta(page, limit, Number(count.results[0]?.total ?? 0)) });
  }));
  router.get("/cosmetics/:id", canRead, asyncHandler(async (req, res) => {
    const item = await find(req.params.id);
    if (!item) throw new HttpError(404, "Cosmetic not found");
    adminOk(res, { data: present(item) });
  }));
  router.post("/cosmetics", canWrite, validateBody(createCosmeticSchema), asyncHandler(async (req, res) => {
    const item = req.body as z.infer<typeof createCosmeticSchema>;
    await assertPublishedAssetReference(db, item.assetRef, "cosmetic", item.id);
    const now = new Date().toISOString();
    const [created] = await db.batch<Row>([
      db.prepare(`INSERT INTO cosmetics (source_id, type, name, coin_price, rarity, preview, is_active,
        reward_only, asset_kind, asset_url, asset_ref, created_at, updated_at)
        SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, ?8, ?9, ?10, ?11, ?12
        WHERE ${publishedAssetReference("?10", "cosmetic", "?1")} ON CONFLICT (source_id) DO NOTHING RETURNING *`)
        .bind(item.id, item.type, item.name, item.coinPrice, item.rarity, item.preview, Number(item.isActive),
          item.assetKind ?? null, item.assetUrl ?? null, item.assetRef ?? null, now, now),
      prepareD1AdminAudit(db, adminFrom(res), { action: "CREATE_COSMETIC", entityType: "Cosmetic", entityId: item.id,
        metadata: { name: item.name, type: item.type }, req }, true)
    ]);
    if (!created.results[0]) throw new HttpError(409, "Cosmetic ID already exists or art is unavailable", ErrorCode.CONFLICT);
    adminOk(res, { data: present(created.results[0]) }, {}, 201);
  }));
  router.put("/cosmetics/:id", canWrite, validateBody(updateCosmeticSchema), asyncHandler(async (req, res) => {
    const item = req.body as z.infer<typeof updateCosmeticSchema>;
    const id = req.params.id;
    await assertPublishedAssetReference(db, item.assetRef, "cosmetic", id);
    const fields = (Object.keys(columns) as Array<keyof typeof columns>).filter(field => item[field] !== undefined);
    const values = fields.map(field => field === "isActive" ? Number(item[field]) : item[field]);
    const assignments = [...fields.map((field, index) => `${columns[field]} = ?${index + 1}`), `updated_at = ?${fields.length + 1}`];
    const referenceParam = fields.length + 3;
    const idParam = `?${fields.length + 2}`;
    const [updated] = await db.batch<Row>([
      db.prepare(`UPDATE cosmetics SET ${assignments.join(", ")} WHERE source_id = ${idParam}
        AND ${publishedAssetReference(`?${referenceParam}`, "cosmetic", idParam)} RETURNING *`)
        .bind(...values, new Date().toISOString(), id, item.assetRef ?? null),
      prepareD1AdminAudit(db, adminFrom(res), { action: "UPDATE_COSMETIC", entityType: "Cosmetic", entityId: id,
        metadata: { id, updates: fields }, req }, true)
    ]);
    if (!updated.results[0]) {
      if (!await find(id)) throw new HttpError(404, "Cosmetic not found");
      throw new HttpError(409, "Cosmetic art changed during the update", ErrorCode.CONFLICT);
    }
    adminOk(res, { data: present(updated.results[0]) });
  }));
  router.delete("/cosmetics/:id", canWrite, asyncHandler(async (req, res) => {
    const id = req.params.id;
    const item = await find(id);
    if (!item) throw new HttpError(404, "Cosmetic not found");
    const [deleted] = await db.batch([
      db.prepare("DELETE FROM cosmetics WHERE source_id = ?").bind(id),
      prepareD1AdminAudit(db, adminFrom(res), { action: "DELETE_COSMETIC", entityType: "Cosmetic", entityId: id,
        metadata: { id, name: item.name }, req }, true)
    ]);
    if (!deleted.meta.changes) throw new HttpError(404, "Cosmetic not found");
    adminOk(res, { data: { deleted: true, id } });
  }));
  router.post("/cosmetics/seed", canWrite, asyncHandler(async (req, res) => {
    const seeded = await seedDefaultCosmetics(db);
    await insertD1AdminAudit(db, adminFrom(res), { action: "SEED_COSMETICS", entityType: "Cosmetic", metadata: { seeded }, req });
    adminOk(res, { data: { seeded } });
  }));
  return router;
}
