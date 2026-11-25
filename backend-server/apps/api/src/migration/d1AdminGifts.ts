import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";
import { d1GiftProjection, presentGift, type GiftRow } from "./d1GiftCatalog.js";

const giftSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().min(1).max(500),
  coinPrice: z.number().int().min(1),
  diamondPrice: z.number().int().min(0).optional(),
  animationKey: z.string().max(80).optional(),
  isActive: z.boolean().optional()
});
const columns = { name: "name", icon: "icon", coinPrice: "coin_price", diamondPrice: "diamond_price",
  animationKey: "animation_key", isActive: "is_active" } as const;
const giftQuery = `SELECT ${d1GiftProjection} FROM gifts AS g`;

function giftId(value: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid giftId", ErrorCode.VALIDATION);
  return value;
}

export function createD1AdminGiftsRouter(db: D1Database, secret?: string) {
  const router = Router();
  const canManage = createD1AdminGuard(db, secret)("gifts.manage");
  const find = (id: string) => db.prepare(`${giftQuery} WHERE g.source_id = ?`).bind(id).first<GiftRow>();

  router.get("/gifts", canManage, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`${giftQuery} ORDER BY g.coin_price, g.source_id`).all<GiftRow>();
    adminOk(res, results.map(presentGift));
  }));

  router.get("/gifts/:giftId", canManage, asyncHandler(async (req, res) => {
    const gift = await find(giftId(req.params.giftId));
    adminOk(res, gift ? presentGift(gift) : null);
  }));

  router.post("/gifts", canManage, validateBody(giftSchema), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof giftSchema>;
    const id = newId();
    const [created, , stored] = await db.batch<GiftRow>([
      db.prepare(`INSERT INTO gifts
        (source_id, name, icon, coin_price, diamond_price, pk_points, is_active, effect3d, interactive,
         animation_key, combo_multiplier, category, bond_points, bond_minimum_days, theme, rarity,
         limited_edition_active, limited_edition_total, limited_edition_remaining, tradable,
         upgradeable, achievement_gift, pet_gift, vehicle_gift, created_at)
        SELECT ?2, ?1, ?, ?, ?, 0, ?, '', 0, ?, 1, 'normal', 0, 0, '', 'common', 0, 0, 0, 0, 0, 0, 0, 0, ?
        WHERE NOT EXISTS (SELECT 1 FROM gifts WHERE name = ?1)`)
        .bind(body.name, id, body.icon, body.coinPrice, body.diamondPrice ?? 0, Number(body.isActive ?? true),
          body.animationKey ?? "", new Date().toISOString()),
      prepareD1AdminAudit(db, adminFrom(res), { action: "gift.created", entityType: "gift",
        entityId: id, metadata: body, req }, true),
      db.prepare(`${giftQuery} WHERE g.source_id = ?`).bind(id)
    ]);
    if (!created.meta.changes) throw new HttpError(409, "Gift name already exists", ErrorCode.CONFLICT);
    adminOk(res, { gift: presentGift(stored.results[0]) }, {}, 201);
  }));

  router.patch("/gifts/:giftId", canManage, validateBody(giftSchema.partial()), asyncHandler(async (req, res) => {
    const id = giftId(req.params.giftId);
    const body = req.body as Partial<z.infer<typeof giftSchema>>;
    const fields = (Object.keys(columns) as Array<keyof typeof columns>).filter(field => body[field] !== undefined);
    const before = await find(id);
    if (!before || !fields.length) {
      adminOk(res, { gift: before ? presentGift(before) : null });
      return;
    }
    const values = fields.map(field => field === "isActive" ? Number(body[field]) : body[field]);
    const [updated, , stored] = await db.batch<GiftRow>([
      db.prepare(`UPDATE gifts SET ${fields.map(field => `${columns[field]} = ?`).join(", ")}
        WHERE source_id = ? AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM gifts WHERE name = ? AND source_id <> ?))`)
        .bind(...values, id, body.name ?? null, body.name ?? null, id),
      prepareD1AdminAudit(db, adminFrom(res), { action: "gift.updated", entityType: "gift",
        entityId: id, metadata: { before: presentGift(before), changes: body }, req }, true),
      db.prepare(`${giftQuery} WHERE g.source_id = ?`).bind(id)
    ]);
    const after = stored.results[0];
    if (!updated.meta.changes && after) throw new HttpError(409, "Gift name already exists", ErrorCode.CONFLICT);
    adminOk(res, { gift: after ? presentGift(after) : null });
  }));

  const setActive = (active: boolean) => asyncHandler(async (req, res) => {
    const id = giftId(req.params.giftId);
    const [, , stored] = await db.batch<GiftRow>([
      db.prepare("UPDATE gifts SET is_active = ? WHERE source_id = ?").bind(Number(active), id),
      prepareD1AdminAudit(db, adminFrom(res), { action: active ? "gift.activated" : "gift.deactivated",
        entityType: "gift", entityId: id, req }, true),
      db.prepare(`${giftQuery} WHERE g.source_id = ?`).bind(id)
    ]);
    const gift = stored.results[0];
    adminOk(res, { gift: gift ? presentGift(gift) : null });
  });
  router.post("/gifts/:giftId/activate", canManage, setActive(true));
  router.post("/gifts/:giftId/deactivate", canManage, setActive(false));

  router.delete("/gifts/:giftId", canManage, asyncHandler(async (req, res) => {
    const id = giftId(req.params.giftId);
    const admin = adminFrom(res);
    const [before, removed, , deactivated] = await db.batch<GiftRow>([
      db.prepare(`${giftQuery} WHERE g.source_id = ?`).bind(id),
      db.prepare(`DELETE FROM gifts WHERE source_id = ?1
        AND NOT EXISTS (SELECT 1 FROM gift_transactions WHERE gift_id = ?1)
        AND NOT EXISTS (SELECT 1 FROM gift_inventories WHERE gift_id = ?1)
        AND NOT EXISTS (SELECT 1 FROM gift_collection_items WHERE value = ?1)
        AND NOT EXISTS (SELECT 1 FROM gift_upgrade_paths WHERE value = ?1 OR gifts_id = ?1)
        AND NOT EXISTS (SELECT 1 FROM pk_battles WHERE selected_gift_id = ?1)
        AND NOT EXISTS (SELECT 1 FROM wishlist_items WHERE gift_id = ?1)`).bind(id),
      prepareD1AdminAudit(db, admin, { action: "gift.deleted", entityType: "gift", entityId: id, req }, true),
      db.prepare("UPDATE gifts SET is_active = 0 WHERE source_id = ?").bind(id),
      prepareD1AdminAudit(db, admin, { action: "gift.soft_deleted", entityType: "gift", entityId: id, req }, true)
    ]);
    const softDeleted = !removed.meta.changes && Boolean(deactivated.meta.changes);
    const gift = before.results[0];
    adminOk(res, { gift: gift ? presentGift({ ...gift, is_active: softDeleted ? 0 : gift.is_active }) : null, softDeleted });
  }));

  return router;
}
