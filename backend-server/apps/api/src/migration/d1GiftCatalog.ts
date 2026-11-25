import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";

type GiftRow = {
  source_id: string; name: string; icon: string; coin_price: number; diamond_price: number; pk_points: number;
  is_active: number; effect3d: string; interactive: number; animation_key: string; expires_at: string | null;
  combo_multiplier: number; category: string; theme: string; rarity: string; collection_id: string | null;
  limited_edition_active: number; limited_edition_total: number; limited_edition_remaining: number;
  tradable: number; upgradeable: number; achievement_gift: number; pet_gift: number; vehicle_gift: number;
  bond_purpose: string | null; bond_kind: string | null; bond_points: number; bond_minimum_days: number;
  bond_cosmetic_id: string | null; upgrade_path: string; created_at: string | null;
};
type CollectionRow = {
  source_id: string; name: string; description: string; icon: string; bonus_description: string;
  bonus_xp_multiplier: number; bonus_coin_multiplier: number; created_at: string | null; updated_at: string | null;
};
type InventoryRow = GiftRow & {
  inventory_id: string; inventory_source: string; inventory_tradable: number; quantity: number; upgrade_level: number;
};
type CollectionGift = GiftRow & { collection: string };

const available = "g.is_active = 1 AND g.category <> 'bonds' AND (g.expires_at IS NULL OR g.expires_at > ?)";
const projection = `g.*, (SELECT json_group_array(value) FROM (
  SELECT value FROM gift_upgrade_paths WHERE gifts_id = g.source_id ORDER BY position
)) AS upgrade_path`;
const byPrice = "ORDER BY g.coin_price, g.source_id";

function presentGift(row: GiftRow) {
  return {
    _id: row.source_id, name: row.name, icon: row.icon, coinPrice: row.coin_price, diamondPrice: row.diamond_price,
    pkPoints: row.pk_points, isActive: Boolean(row.is_active), effect3d: row.effect3d, interactive: Boolean(row.interactive),
    animationKey: row.animation_key, expiresAt: row.expires_at, comboMultiplier: row.combo_multiplier, category: row.category,
    theme: row.theme, rarity: row.rarity, collectionId: row.collection_id, tradable: Boolean(row.tradable),
    upgradeable: Boolean(row.upgradeable), achievementGift: Boolean(row.achievement_gift),
    petGift: Boolean(row.pet_gift), vehicleGift: Boolean(row.vehicle_gift), upgradePath: JSON.parse(row.upgrade_path),
    limitedEdition: { active: Boolean(row.limited_edition_active), total: row.limited_edition_total, remaining: row.limited_edition_remaining },
    bondPurpose: row.bond_purpose ?? undefined, bondKind: row.bond_kind ?? undefined, bondPoints: row.bond_points,
    bondMinimumDays: row.bond_minimum_days, bondCosmeticId: row.bond_cosmetic_id ?? undefined,
    createdAt: row.created_at ?? undefined
  };
}

export function createD1GiftCatalogRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.giftViewer = (await requireHttpSession(req.headers.authorization, access)).user.id;
    next();
  });

  router.get("/gifts", authenticate, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`SELECT ${projection} FROM gifts AS g WHERE ${available} ${byPrice}`)
      .bind(new Date().toISOString()).all<GiftRow>();
    sendOk(res, { gifts: results.map(presentGift) });
  }));

  router.get("/gifts/v2", authenticate, asyncHandler(async (req, res) => {
    const category = typeof req.query.category === "string" && req.query.category && req.query.category !== "bonds"
      ? req.query.category : null;
    const rarity = typeof req.query.rarity === "string" && req.query.rarity ? req.query.rarity : null;
    const page = Math.min(Math.floor(Number.MAX_SAFE_INTEGER / 50), Math.max(1, Math.trunc(Number(req.query.page) || 1)));
    const limit = Math.min(50, Math.max(1, Math.trunc(Number(req.query.limit) || 20)));
    const predicate = `WHERE ${available} AND (?2 IS NULL OR g.category = ?2) AND (?3 IS NULL OR g.rarity = ?3)`;
    const args = [new Date().toISOString(), category, rarity];
    const [rows, count] = await db.batch<GiftRow | { total: number }>([
      db.prepare(`SELECT ${projection} FROM gifts AS g ${predicate} ${byPrice} LIMIT ?4 OFFSET ?5`).bind(...args, limit, (page - 1) * limit),
      db.prepare(`SELECT COUNT(*) AS total FROM gifts AS g ${predicate}`).bind(...args)
    ]);
    sendOk(res, { gifts: (rows.results as GiftRow[]).map(presentGift), total: (count.results[0] as { total: number }).total, page, limit });
  }));

  router.get("/gifts/collections", authenticate, asyncHandler(async (_req, res) => {
    const [collections, items] = await db.batch<CollectionRow | CollectionGift>([
      db.prepare("SELECT * FROM gift_collections WHERE is_active = 1 ORDER BY created_at, source_id"),
      db.prepare(`SELECT ${projection}, c.source_id AS collection FROM gift_collections AS c
        JOIN gift_collection_items AS i ON i.gift_collections_id = c.source_id
        JOIN gifts AS g ON g.source_id = i.value WHERE c.is_active = 1 ORDER BY c.source_id, i.position`)
    ]);
    const gifts = new Map<string, ReturnType<typeof presentGift>[]>();
    for (const row of items.results as CollectionGift[]) {
      const list = gifts.get(row.collection) ?? [];
      list.push(presentGift(row));
      gifts.set(row.collection, list);
    }
    sendOk(res, { collections: (collections.results as CollectionRow[]).map(row => ({
      _id: row.source_id, name: row.name, description: row.description, icon: row.icon, isActive: true,
      bonus: { description: row.bonus_description, xpMultiplier: row.bonus_xp_multiplier, coinMultiplier: row.bonus_coin_multiplier },
      gifts: gifts.get(row.source_id) ?? [], createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
    })) });
  }));

  router.get("/inventory", authenticate, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`SELECT ${projection}, i.source_id AS inventory_id, i.quantity,
        i.source AS inventory_source, i.tradable AS inventory_tradable, i.upgrade_level
      FROM gift_inventories AS i JOIN gifts AS g ON g.source_id = i.gift_id
      WHERE i.user_id = ? ORDER BY i.created_at, i.source_id`).bind(res.locals.giftViewer).all<InventoryRow>();
    sendOk(res, { items: results.map(row => ({
      id: row.inventory_id, gift: { ...presentGift(row), upgradeLevel: row.upgrade_level }, quantity: row.quantity,
      tradable: Boolean(row.inventory_tradable), source: row.inventory_source, upgradeLevel: row.upgrade_level,
      upgradeCost: row.upgradeable ? Math.floor(row.coin_price * 1.5) : 0
    })) });
  }));
  return router;
}
