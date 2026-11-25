import { randomInt } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId, walletFrozen } from "./d1Cosmetics.js";
import { person, personJson } from "./d1People.js";

export type GiftRow = {
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
type LeaderboardRow = { party_id: string; total_coins: number; gift_count: number; user_json: string | null };

const tradeGiftSchema = z.object({
  targetUserId: z.string().min(1),
  offerItems: z.array(z.string().min(1)).min(1).max(20),
  requestItems: z.array(z.string().min(1)).min(1).max(20)
});

function periodStart(period: string) {
  if (period === "daily") {
    const start = new Date(); start.setHours(0, 0, 0, 0); return start.toISOString();
  }
  if (period === "weekly") {
    const start = new Date(); start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0);
    return start.toISOString();
  }
  if (period === "monthly") {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0); return start.toISOString();
  }
  return null;
}

function leaderboardEntry(row: LeaderboardRow) {
  return {
    _id: row.party_id, totalCoins: row.total_coins, giftCount: row.gift_count,
    ...(row.user_json ? { user: person(row.user_json) } : {})
  };
}

const available = "g.is_active = 1 AND g.category <> 'bonds' AND (g.expires_at IS NULL OR g.expires_at > ?)";
export const d1GiftProjection = `g.*, (SELECT json_group_array(value) FROM (
  SELECT value FROM gift_upgrade_paths WHERE gifts_id = g.source_id ORDER BY position
)) AS upgrade_path`;
const projection = d1GiftProjection;
const byPrice = "ORDER BY g.coin_price, g.source_id";

export function presentGift(row: GiftRow) {
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

  router.get("/gift-leaderboard", authenticate, asyncHandler(async (req, res) => {
    const period = typeof req.query.period === "string" && req.query.period ? req.query.period : "all";
    const limit = Math.trunc(Math.min(Math.max(Number(req.query.limit) || 20, 1), 50));
    const skip = Math.trunc(Math.max(Number(req.query.skip) || 0, 0));
    const since = periodStart(period);
    const read = (party: "sender_id" | "receiver_id") => db.prepare(`SELECT g.${party} AS party_id,
        SUM(g.coin_amount) AS total_coins, COUNT(*) AS gift_count,
        CASE WHEN u.source_id IS NULL THEN NULL ELSE ${personJson("u")} END AS user_json
      FROM gift_transactions AS g LEFT JOIN users AS u ON u.source_id = g.${party}
      WHERE (?1 IS NULL OR g.created_at >= ?1)
      GROUP BY g.${party} ORDER BY total_coins DESC, party_id LIMIT ?2 OFFSET ?3`)
      .bind(since, limit, skip).all<LeaderboardRow>()
      .then(result => result.results.map(leaderboardEntry));
    const [topSenders, topReceivers] = await Promise.all([read("sender_id"), read("receiver_id")]);
    sendOk(res, { topSenders, topReceivers, period });
  }));

  const comboGiftSchema = z.object({
    roomId: z.string().min(1),
    giftId: z.string().min(1),
    participants: z.array(z.string().min(1)).min(2).max(50)
  });
  const roomWideGiftSchema = z.object({
    roomId: z.string().min(1),
    giftId: z.string().min(1),
    receiverIds: z.array(z.string().min(1)).min(1).max(100)
  });
  const surpriseBoxSchema = z.object({
    roomId: z.string().min(1).optional(),
    tier: z.enum(["basic", "premium", "luxury"])
  });
  const upgradeGiftSchema = z.object({ inventoryId: z.string().min(1) });
  const purchaseGiftSchema = z.object({ giftId: z.string().min(1) });

  const asNum = (value: unknown) => Number(value ?? 0);
  const readUser = (userId: string) => db.prepare(
    `SELECT source_id, name, username, avatar, wallet_balance, diamond_balance, xp, level, charm_exp, wealth_exp, last_daily_check_in_at, vip_level, vip_tier, vip_exp, vip_frozen, vip_freeze_started_at, vip_expires_at, role, is_blocked, suspended_until
     FROM users WHERE source_id = ?`
  ).bind(userId).first<Record<string, string | number | null>>();

  async function assertWalletActive(userId: string) {
    const row = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE source_id = ?`).bind(userId).first<{ frozen: number }>();
    if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    if (row.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
  }

  async function assertVipGiftAccess(userId: string, gift: GiftRow) {
    if (String(gift.category).toLowerCase() !== "vip") return;
    const user = await readUser(userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const vip = getVipStatus({
      vipTier: user.vip_tier, vipLevel: asNum(user.vip_level), vipExp: asNum(user.vip_exp),
      vipFrozen: Boolean(user.vip_frozen), vipFreezeStartedAt: user.vip_freeze_started_at, vipExpiresAt: user.vip_expires_at
    } as any);
    if ((vip.vipLevel ?? 0) < 1) throw new HttpError(403, "VIP gifts unlock at VIP 1", ErrorCode.FORBIDDEN);
  }

  router.post("/gifts/purchase", authenticate, validateBody(purchaseGiftSchema), asyncHandler(async (req, res) => {
    const { giftId } = req.body as z.infer<typeof purchaseGiftSchema>;
    if (!isValidObjectId(giftId)) throw new HttpError(400, "Invalid giftId", ErrorCode.VALIDATION);
    const userId = res.locals.giftViewer as string;
    await assertWalletActive(userId);
    const gift = await db.prepare(`SELECT ${d1GiftProjection} FROM gifts AS g WHERE g.source_id = ? AND g.is_active = 1 AND g.category <> 'bonds'`).bind(giftId).first<GiftRow>();
    if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
    await assertVipGiftAccess(userId, gift);

    const owned = await db.prepare("SELECT 1 AS ok FROM gift_inventories WHERE user_id = ? AND gift_id = ? LIMIT 1").bind(userId, giftId).first();
    if (owned) throw new HttpError(409, "Gift already in inventory", ErrorCode.CONFLICT);

    const txId = newId();
    const invId = newId();
    const now = new Date().toISOString();
    const price = Number(gift.coin_price);
    const batch = await db.batch([
      db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', 'GIFT_PURCHASE', ?, u.wallet_balance, u.wallet_balance - ?, json_object('giftId', ?, 'purchaseId', ?), NULL, ?, ?
        FROM users AS u WHERE u.source_id = ? AND NOT ${walletFrozen} AND u.wallet_balance >= ?`)
        .bind(txId, price, price, giftId, txId, now, now, userId, price),
      db.prepare("UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = ? WHERE source_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)")
        .bind(price, now, userId, txId),
      db.prepare(`INSERT INTO gift_inventories (source_id, user_id, gift_id, quantity, source, upgrade_level, tradable, created_at, updated_at)
        SELECT ?, ?, ?, 1, 'purchased', 1, 1, ?, ?
        WHERE EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ? AND user_id = ?)`)
        .bind(invId, userId, giftId, now, now, txId, userId)
    ]);
    if (Number(batch[0]?.meta?.changes ?? 0) < 1) {
      const frozen = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE source_id = ?`).bind(userId).first<{ frozen: number }>();
      if (frozen?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
    }
    if (Number(batch[2]?.meta?.changes ?? 0) < 1) {
      throw new HttpError(409, "Gift already in inventory", ErrorCode.CONFLICT);
    }
    sendOk(res, { gift: presentGift(gift) }, 201);
  }));

  router.post("/gifts/combo", authenticate, validateBody(comboGiftSchema), asyncHandler(async (req, res) => {
    const { giftId } = req.body as z.infer<typeof comboGiftSchema>;
    if (!isValidObjectId(giftId)) throw new HttpError(400, "Invalid giftId", ErrorCode.VALIDATION);
    throw new HttpError(409, "Combo gifts require approval from every payer and are currently unavailable. Send an individual gift instead.", ErrorCode.CONFLICT);
  }));

  router.post("/gifts/room-wide", authenticate, validateBody(roomWideGiftSchema), asyncHandler(async (req, res) => {
    const { roomId, giftId, receiverIds } = req.body as z.infer<typeof roomWideGiftSchema>;
    if (!isValidObjectId(giftId)) throw new HttpError(400, "Invalid giftId", ErrorCode.VALIDATION);
    const senderId = res.locals.giftViewer as string;
    await assertWalletActive(senderId);
    const gift = await db.prepare(`SELECT ${d1GiftProjection} FROM gifts AS g WHERE g.source_id = ? AND g.is_active = 1 AND g.category <> 'bonds'`).bind(giftId).first<GiftRow>();
    if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
    await assertVipGiftAccess(senderId, gift);

    const MAX_RECEIVERS = 100;
    const uniqueReceivers = [...new Set(receiverIds.filter((id): id is string => typeof id === "string" && id !== senderId))];
    if (uniqueReceivers.length > MAX_RECEIVERS) {
      throw new HttpError(400, `Cannot send room-wide gift to more than ${MAX_RECEIVERS} recipients`, ErrorCode.VALIDATION);
    }
    if (uniqueReceivers.length === 0) throw new HttpError(400, "No valid receivers", ErrorCode.VALIDATION);
    for (const rid of uniqueReceivers) {
      if (!isValidObjectId(rid)) throw new HttpError(400, "Invalid receiverId", ErrorCode.VALIDATION);
    }
    const placeholders = uniqueReceivers.map(() => "?").join(",");
    const found = await db.prepare(`SELECT source_id FROM users WHERE source_id IN (${placeholders})`).bind(...uniqueReceivers).all<{ source_id: string }>();
    if (found.results.length !== uniqueReceivers.length) throw new HttpError(404, "Recipient not found", ErrorCode.NOT_FOUND);
    const totalCost = Number(gift.coin_price) * uniqueReceivers.length;
    const now = new Date().toISOString();
    const actionId = newId();

    // Debit sender first with guard.
    const debitTxId = newId();
    const debit = await db.batch([
      db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', 'GIFT_SENT', ?, u.wallet_balance, u.wallet_balance - ?, json_object('giftId',?, 'roomId',?, 'type','room_wide','idempotencyKey',?), NULL, ?, ?
        FROM users AS u WHERE u.source_id = ? AND NOT ${walletFrozen} AND u.wallet_balance >= ?`)
        .bind(debitTxId, totalCost, totalCost, giftId, roomId, `room-wide:${actionId}:sender-debit`, now, now, senderId, totalCost),
      db.prepare("UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = ? WHERE source_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)")
        .bind(totalCost, now, senderId, debitTxId)
    ]);
    if (Number(debit[0]?.meta?.changes ?? 0) < 1) {
      const frozen = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE source_id = ?`).bind(senderId).first<{ frozen: number }>();
      if (frozen?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
    }

    const txns: any[] = [];
    try {
      for (const rid of uniqueReceivers) {
        const share = Math.floor(Number(gift.coin_price) * 0.7);
        const platformFee = Number(gift.coin_price) - share;
        const creditTxId = newId();
        const giftTxId = newId();
        const creditBatch = await db.batch([
          db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
            SELECT ?, u.source_id, 'CREDIT', 'GIFT_RECEIVED', ?, u.wallet_balance, u.wallet_balance + ?, json_object('giftId',?, 'roomId',?, 'type','room_wide','platformFee',?, 'idempotencyKey',?), ?, ?, ?
            FROM users AS u WHERE u.source_id = ?`)
            .bind(creditTxId, share, share, giftId, roomId, platformFee, `room-wide:${actionId}:${rid}:credit`, now, now, now, rid),
          db.prepare("UPDATE users SET wallet_balance = wallet_balance + ?, charm_exp = charm_exp + ?, updated_at = ? WHERE source_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)")
            .bind(share, Number(gift.coin_price) + platformFee, now, rid, creditTxId),
          db.prepare(`INSERT INTO gift_transactions (source_id, room_id, sender_id, receiver_id, gift_id, coin_amount, diamond_amount, currency, type, combo_count, total_value, effect, metadata, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, 0, 'COINS', 'room_wide', 1, ?, 'room_wide', ?, ?, ?)`)
            .bind(giftTxId, roomId, senderId, rid, giftId, Number(gift.coin_price), Number(gift.coin_price), JSON.stringify({ idempotencyKey: `room-wide:${actionId}:${rid}` }), now, now)
        ]);
        if (Number(creditBatch[0]?.meta?.changes ?? 0) < 1) {
          throw new HttpError(404, "Recipient not found", ErrorCode.NOT_FOUND);
        }
        txns.push({ _id: giftTxId, roomId, senderId, receiverId: rid, giftId, coinAmount: Number(gift.coin_price), type: "room_wide" });
      }
    } catch (error) {
      // Best-effort compensation: refund sender for unprocessed receivers. Partial receiver credits may have committed; mark for reconciliation.
      const processed = txns.length;
      const refundCoins = Number(gift.coin_price) * Math.max(0, uniqueReceivers.length - processed);
      if (refundCoins > 0) {
        const refundId = newId();
        const refundAt = new Date().toISOString();
        await db.batch([
          db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
            SELECT ?, u.source_id, 'CREDIT', 'ADMIN_ADJUSTMENT', ?, u.wallet_balance, u.wallet_balance + ?, json_object('reason','room_wide_partial_failure_refund','actionId',?, 'processed',?, 'total',?), ?, ?, ?
            FROM users AS u WHERE u.source_id = ?`)
            .bind(refundId, refundCoins, refundCoins, actionId, processed, uniqueReceivers.length, refundAt, refundAt, refundAt, senderId),
          db.prepare("UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = ? WHERE source_id = ?").bind(refundCoins, refundAt, senderId)
        ]);
      }
      throw error;
    }

    sendOk(res, { totalCost, receiverCount: uniqueReceivers.length, transactions: txns, xpGrant: { sender: undefined, receivers: uniqueReceivers.map(() => undefined) } });
  }));

  router.post("/gifts/surprise-box", authenticate, validateBody(surpriseBoxSchema), asyncHandler(async (req, res) => {
    const { tier } = req.body as z.infer<typeof surpriseBoxSchema>;
    const userId = res.locals.giftViewer as string;
    await assertWalletActive(userId);
    const tierPricing: Record<string, number> = { basic: 500, premium: 2000, luxury: 10000 };
    const price = tierPricing[tier];
    if (!price) throw new HttpError(400, "Invalid tier", ErrorCode.VALIDATION);
    const rarities: Record<string, string[]> = { basic: ["common", "rare"], premium: ["rare", "epic"], luxury: ["epic", "legendary", "mythic"] };
    const allowed = rarities[tier];
    const placeholders = allowed.map(() => "?").join(",");
    const pool = await db.prepare(`SELECT ${d1GiftProjection} FROM gifts AS g WHERE g.is_active = 1 AND g.category <> 'bonds' AND g.rarity IN (${placeholders})`).bind(...allowed).all<GiftRow>();
    if (pool.results.length === 0) throw new HttpError(500, "No gifts available in this tier");
    const randomGift = pool.results[randomInt(0, pool.results.length)];

    const txId = newId();
    const invId = newId();
    const now = new Date().toISOString();
    const batch = await db.batch([
      db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', 'SURPRISE_BOX', ?, u.wallet_balance, u.wallet_balance - ?, json_object('tier', ?), NULL, ?, ?
        FROM users AS u WHERE u.source_id = ? AND NOT ${walletFrozen} AND u.wallet_balance >= ?`)
        .bind(txId, price, price, tier, now, now, userId, price),
      db.prepare(`UPDATE gift_inventories SET quantity = quantity + 1, updated_at = ?
        WHERE user_id = ? AND gift_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ? AND user_id = ?)`)
        .bind(now, userId, randomGift.source_id, txId, userId),
      db.prepare(`INSERT INTO gift_inventories (source_id, user_id, gift_id, quantity, source, upgrade_level, tradable, created_at, updated_at)
        SELECT ?, ?, ?, 1, 'mystery', 1, 1, ?, ?
        WHERE EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ? AND user_id = ?)
          AND NOT EXISTS (SELECT 1 FROM gift_inventories WHERE user_id = ? AND gift_id = ?)`)
        .bind(invId, userId, randomGift.source_id, now, now, txId, userId, userId, randomGift.source_id),
      db.prepare("UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = ? WHERE source_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)")
        .bind(price, now, userId, txId)
    ]);
    if (Number(batch[0]?.meta?.changes ?? 0) < 1) {
      const frozen = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE source_id = ?`).bind(userId).first<{ frozen: number }>();
      if (frozen?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
    }
    sendOk(res, { tier, price, revealedGift: presentGift(randomGift), source: "mystery" });
  }));

  router.post("/gifts/upgrade", authenticate, validateBody(upgradeGiftSchema), asyncHandler(async (req, res) => {
    const { inventoryId } = req.body as z.infer<typeof upgradeGiftSchema>;
    if (!isValidObjectId(inventoryId)) throw new HttpError(400, "Invalid inventoryId", ErrorCode.VALIDATION);
    const userId = res.locals.giftViewer as string;
    await assertWalletActive(userId);

    const inv = await db.prepare(`SELECT i.source_id, i.user_id, i.gift_id, i.quantity, g.coin_price, g.upgradeable, g.is_active, g.name, g.source_id AS gift_source_id
      FROM gift_inventories i JOIN gifts g ON g.source_id = i.gift_id WHERE i.source_id = ?`).bind(inventoryId).first<Record<string, string | number | null>>();
    if (!inv) throw new HttpError(404, "Inventory item not found", ErrorCode.NOT_FOUND);
    if (String(inv.user_id) !== userId) throw new HttpError(403, "Not your item", ErrorCode.FORBIDDEN);
    if (!Number(inv.upgradeable)) throw new HttpError(400, "Gift is not upgradeable", ErrorCode.VALIDATION);

    // Legacy uses gift.upgradePath[0]; D1 normalizes upgrade paths into gift_upgrade_paths.
    const giftRow = await db.prepare(`SELECT ${d1GiftProjection} FROM gifts AS g WHERE g.source_id = ?`).bind(String(inv.gift_id)).first<GiftRow>();
    if (!giftRow) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
    const upgradePath = (() => { try { const v = JSON.parse(String((giftRow as any).upgrade_path ?? "[]")); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } })();
    if (upgradePath.length === 0) throw new HttpError(400, "No upgrade path", ErrorCode.VALIDATION);
    const nextGiftId = upgradePath[0];
    const upgradedGift = await db.prepare(`SELECT ${d1GiftProjection} FROM gifts AS g WHERE g.source_id = ?`).bind(nextGiftId).first<GiftRow>();
    if (!upgradedGift || !Number(upgradedGift.is_active)) throw new HttpError(409, "The next gift in this upgrade path is unavailable", ErrorCode.CONFLICT);

    const upgradeCost = Math.floor(Number(inv.coin_price) * 1.5);
    const txId = newId();
    const newInvId = newId();
    const now = new Date().toISOString();
    const quantity = Number(inv.quantity ?? 0);

    const statements = [
      db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', 'GIFT_UPGRADE', ?, u.wallet_balance, u.wallet_balance - ?, json_object('inventoryId',?, 'fromGiftId',?), NULL, ?, ?
        FROM users AS u WHERE u.source_id = ? AND NOT ${walletFrozen} AND u.wallet_balance >= ?`)
        .bind(txId, upgradeCost, upgradeCost, inventoryId, String(inv.gift_id), now, now, userId, upgradeCost),
      db.prepare("UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = ? WHERE source_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)")
        .bind(upgradeCost, now, userId, txId),
      ...(quantity > 1
        ? [db.prepare("UPDATE gift_inventories SET quantity = quantity - 1, updated_at = ? WHERE source_id = ? AND user_id = ? AND quantity > 0 AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)")
            .bind(now, inventoryId, userId, txId)]
        : [db.prepare("DELETE FROM gift_inventories WHERE source_id = ? AND user_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)")
            .bind(inventoryId, userId, txId)]),
      db.prepare(`UPDATE gift_inventories SET quantity = quantity + 1, updated_at = ?
        WHERE user_id = ? AND gift_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ? AND user_id = ?)`)
        .bind(now, userId, nextGiftId, txId, userId),
      db.prepare(`INSERT INTO gift_inventories (source_id, user_id, gift_id, quantity, source, upgrade_level, tradable, created_at, updated_at)
        SELECT ?, ?, ?, 1, 'upgrade', 1, 1, ?, ?
        WHERE EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ? AND user_id = ?)
          AND NOT EXISTS (SELECT 1 FROM gift_inventories WHERE user_id = ? AND gift_id = ?)`)
        .bind(newInvId, userId, nextGiftId, now, now, txId, userId, userId, nextGiftId)
    ];
    const batch = await db.batch(statements);
    if (Number(batch[0]?.meta?.changes ?? 0) < 1) {
      const frozen = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE source_id = ?`).bind(userId).first<{ frozen: number }>();
      if (frozen?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
    }

    sendOk(res, { upgradeCost, fromGift: presentGift(giftRow as unknown as GiftRow), upgradedGift: presentGift(upgradedGift) });
  }));

  router.post("/inventory/trade", authenticate, validateBody(tradeGiftSchema), asyncHandler(async (req, res) => {
    const { targetUserId, offerItems, requestItems } = req.body as z.infer<typeof tradeGiftSchema>;
    if (!isValidObjectId(targetUserId)) throw new HttpError(400, "Invalid targetUserId", ErrorCode.VALIDATION);
    for (const id of [...offerItems, ...requestItems]) {
      if (!isValidObjectId(id)) throw new HttpError(400, "Invalid inventory item ID", ErrorCode.VALIDATION);
    }
    // The legacy endpoint stays fail-closed until an authenticated offer/accept workflow exists.
    throw new HttpError(409,
      "Inventory trades require acceptance from both users and are currently unavailable. Your items have not moved.",
      ErrorCode.CONFLICT);
  }));
  return router;
}
