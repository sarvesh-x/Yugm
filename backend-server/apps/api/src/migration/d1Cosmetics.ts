import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { coinPacks, cosmeticBundles, equipProfileCosmeticSchema, profileCosmetics, purchaseCosmeticBundleSchema,
  purchaseProfileCosmeticSchema, transferCosmeticSchema, vipPlans, walletSourceLabels, xpDailyCaps, xpEvents } from "@yugm/shared";
import { Router, type Request as ExpressRequest } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { activeCosmeticKey, toPublicCosmetic } from "../services/cosmeticPresentation.js";
import type { AccessClaims } from "../services/accessSession.js";
import { DAILY_REWARD_COINS, DAILY_REWARD_SOURCE, nextUtcDay, startOfUtcDay } from "../services/dailyWalletReward.js";
import { getLevelStatus } from "../services/levelPresentation.js";
import { getVipStatus, VIP_CYCLE_DAYS, VIP_LEVEL_REQUIREMENTS } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { ACTIVE_COSMETIC_KEYS } from "./authProfileFields.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

type CosmeticKey = (typeof ACTIVE_COSMETIC_KEYS)[number];
type CosmeticRow = {
  source_id: string;
  type: string;
  name: string;
  coin_price: number;
  rarity: string;
  preview: string;
  is_active: number;
  asset_kind: string | null;
  asset_url: string | null;
  asset_ref: string | null;
  published_asset_id: string | null;
  asset_version: number;
  variants_json: string;
};
type AssetVariant = {
  name: string;
  key: string;
  contentType: string;
  bytes: number;
  width: number | null;
  height: number | null;
};
export type WardrobeRow = Record<string, string | number | null> & {
  balance: number;
  stored_level: number;
  diamond_balance: number;
  xp: number;
  last_daily_check_in_at: string | null;
  owned_ids_json: string;
  null_fields: string | null;
  vip_level: number;
  vip_exp: number;
};
type GiftRow = { quantity: number; tradable: number; upgradeable: number; coinPrice: number };

function activeColumn(key: CosmeticKey) {
  return `active_cosmetics_${key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`)}`;
}

export const readWardrobe = `SELECT u.wallet_balance AS balance, u.diamond_balance, u.xp, u.level AS stored_level, u.last_daily_check_in_at,
  u.vip_tier, u.vip_level, u.vip_exp, u.vip_started_at, u.vip_expires_at, u.vip_frozen, u.vip_freeze_started_at,
  ${ACTIVE_COSMETIC_KEYS.map(key => `u.${activeColumn(key)}`).join(", ")}, p.null_fields,
  (SELECT json_group_array(value) FROM (
    SELECT value FROM user_owned_cosmetics WHERE users_id = u.source_id AND value IS NOT NULL ORDER BY position
  )) AS owned_ids_json
  FROM users AS u LEFT JOIN user_auth_profile AS p ON p.source_id = u.source_id WHERE u.source_id = ?`;

export function walletRow(row: unknown) {
  if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  return row as WardrobeRow;
}

function wardrobe(row: WardrobeRow) {
  const nulls = new Set<string>(JSON.parse(row.null_fields ?? "[]"));
  const activeCosmetics: Partial<Record<CosmeticKey, string | null>> = {};
  if (!nulls.has("activeCosmetics")) {
    for (const key of ACTIVE_COSMETIC_KEYS) {
      const value = row[activeColumn(key)];
      if (nulls.has(`activeCosmetics.${key}`)) activeCosmetics[key] = null;
      else if (typeof value === "string") activeCosmetics[key] = value;
    }
  }
  return { ownedCosmeticIds: JSON.parse(row.owned_ids_json) as string[], activeCosmetics };
}

export function walletVip(row: WardrobeRow, now = new Date()) {
  return getVipStatus({
    vipTier: row.vip_tier, vipLevel: row.vip_level, vipExp: row.vip_exp, vipStartedAt: row.vip_started_at ?? undefined,
    vipExpiresAt: row.vip_expires_at, vipFrozen: row.vip_frozen, vipFreezeStartedAt: row.vip_freeze_started_at
  }, now);
}

export function walletLevel(row: WardrobeRow) {
  return getLevelStatus({ xp: row.xp, lastDailyCheckInAt: row.last_daily_check_in_at ?? undefined });
}

export async function seedDefaultCosmetics(db: D1Database) {
  const now = new Date().toISOString();
  const result = await db.prepare(`INSERT INTO cosmetics
    (source_id, type, name, coin_price, rarity, preview, is_active, reward_only, asset_kind, asset_url, created_at, updated_at)
    SELECT value ->> '$.id', value ->> '$.type', value ->> '$.name', value ->> '$.coinPrice',
      value ->> '$.rarity', value ->> '$.preview', 1, 0, value ->> '$.assetKind', value ->> '$.assetUrl', ?2, ?2
    FROM json_each(?1) AS defaults
    WHERE NOT EXISTS (SELECT 1 FROM cosmetics WHERE source_id = defaults.value ->> '$.id')
    ON CONFLICT (source_id) DO NOTHING`).bind(JSON.stringify(profileCosmetics), now).run();
  return result.meta.changes ?? 0;
}

const ownerHasCosmetic = `EXISTS (SELECT 1 FROM user_owned_cosmetics AS owned
  WHERE owned.users_id = ? AND owned.value = c.source_id)`;
const publicImageTypes = "('image/webp', 'image/png', 'image/jpeg', 'image/gif', 'image/avif')";
const readCosmetics = `SELECT c.*, a.source_id AS published_asset_id, a.version AS asset_version,
  (SELECT json_group_array(json_object(
    'name', name, 'key', key, 'contentType', content_type, 'bytes', bytes, 'width', width, 'height', height
  )) FROM (
    SELECT name, key, content_type, bytes, width, height FROM asset_variants
    WHERE assets_id = a.source_id AND key <> a.staging_key AND content_type IN ${publicImageTypes} ORDER BY position
  )) AS variants_json
  FROM cosmetics AS c LEFT JOIN assets AS a ON a.source_id = c.asset_ref AND a.status = 'published'
    AND a.owner_type = 'cosmetic' AND a.owner_id = c.source_id`;
const sortCosmetics = "ORDER BY c.type, c.coin_price, c.name";
export const walletFrozen = `EXISTS (SELECT 1 FROM user_safety_statuses AS safety
  WHERE safety.user_id = u.source_id AND safety.is_wallet_frozen = 1)`;

export function clearProfileMarkers(db: D1Database, userId: string, fields: string[], guard: string, ...guardValues: unknown[]) {
  const markers = JSON.stringify(fields);
  return db.prepare(`UPDATE user_auth_profile SET
    null_fields = (SELECT json_group_array(value) FROM json_each(null_fields) WHERE value NOT IN (SELECT value FROM json_each(?))),
    missing_fields = (SELECT json_group_array(value) FROM json_each(missing_fields) WHERE value NOT IN (SELECT value FROM json_each(?)))
    WHERE source_id = ? AND ${guard}`).bind(markers, markers, userId, ...guardValues);
}

const publishedAssetPath = "/api/assets/published";

function presentCosmetic(row: CosmeticRow, origin: string) {
  const assetId = row.published_asset_id;
  return toPublicCosmetic({
    _id: row.source_id, type: row.type, name: row.name, coinPrice: row.coin_price, rarity: row.rarity,
    preview: row.preview, isActive: Boolean(row.is_active), assetKind: row.asset_kind ?? undefined,
    assetUrl: row.asset_url ?? undefined, assetRef: row.asset_ref ?? undefined
  }, assetId ? {
    id: assetId,
    version: row.asset_version,
    variants: (JSON.parse(row.variants_json) as AssetVariant[]).map(variant => ({
      ...variant,
      width: variant.width ?? undefined,
      height: variant.height ?? undefined,
      url: `${origin}${publishedAssetPath}/${encodeURIComponent(assetId)}/${encodeURIComponent(variant.name)}`
    }))
  } : undefined);
}

async function readCatalog(db: D1Database, userId: string, origin: string, includeOwnedRewards: boolean) {
  const [user, items] = await db.batch([
    db.prepare(readWardrobe).bind(userId),
    db.prepare(`${readCosmetics} WHERE c.is_active = 1 AND (c.reward_only = 0 OR (? AND ${ownerHasCosmetic}))
      ${sortCosmetics}`).bind(Number(includeOwnedRewards), userId)
  ]);
  const row = walletRow(user.results[0]);
  return {
    ...wardrobe(row), cosmetics: (items.results as CosmeticRow[]).map(item => presentCosmetic(item, origin)),
    balance: row.balance
  };
}

const readGifts = `SELECT i.source_id AS id, i.gift_id AS giftId, g.name, g.icon, g.coin_price AS coinPrice, g.rarity,
  i.quantity, i.source, i.tradable, i.upgrade_level AS upgradeLevel, g.upgradeable
  FROM gift_inventories AS i JOIN gifts AS g ON g.source_id = i.gift_id
  WHERE i.user_id = ? AND i.quantity > 0 ORDER BY i.updated_at DESC`;

const readBadges = `SELECT t.achievement_id AS achievementId, t.tier, t.claimed_at AS claimedAt,
  COALESCE(a.title, t.achievement_id) AS title, COALESCE(a.description, '') AS description,
  COALESCE(a.icon, '🏅') AS icon
  FROM user_claimed_achievement_tiers AS t LEFT JOIN achievements AS a ON a.id = t.achievement_id
  WHERE t.users_id = ? ORDER BY t.position`;

async function readInventory(db: D1Database, userId: string, origin: string) {
  const [user, items, giftRows, badgeRows] = await db.batch([
    db.prepare(readWardrobe).bind(userId),
    db.prepare(`${readCosmetics} WHERE ${ownerHasCosmetic} ${sortCosmetics}`).bind(userId),
    db.prepare(readGifts).bind(userId),
    db.prepare(readBadges).bind(userId)
  ]);
  const row = walletRow(user.results[0]);
  const { activeCosmetics } = wardrobe(row);
  const cosmetics = (items.results as CosmeticRow[]).map(item => {
    const key = activeCosmeticKey(item.type);
    return { ...presentCosmetic(item, origin), isEquipped: key !== undefined && activeCosmetics[key] === item.source_id };
  });
  const gifts = (giftRows.results as GiftRow[]).map(gift => ({
    ...gift, tradable: Boolean(gift.tradable), upgradeable: Boolean(gift.upgradeable),
    upgradeCost: gift.upgradeable ? Math.floor(gift.coinPrice * 1.5) : 0
  }));
  const badges = badgeRows.results;
  return {
    cosmetics, activeCosmetics, gifts, badges,
    summary: {
      totalCosmetics: cosmetics.length,
      equippedCosmetics: cosmetics.filter(item => item.isEquipped).length,
      totalGifts: gifts.reduce((total, gift) => total + gift.quantity, 0),
      totalBadges: badges.length,
      walletBalance: row.balance
    }
  };
}

type CosmeticPurchase = { cosmeticId: string } | { bundle: (typeof cosmeticBundles)[number] };
const purchaseXpEvent = "COSMETIC_PURCHASE";
const dailyCap = xpDailyCaps[purchaseXpEvent]!;
const requestedXp = xpEvents[purchaseXpEvent];
const readDailyXp = `SELECT COALESCE(SUM(amount), 0) AS amount FROM xp_daily_caps
  WHERE user_id = ? AND event = ? AND day = ?`;
const debitClaim = "EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)";

export function newId() {
  return randomBytes(12).toString("hex");
}

async function purchaseCosmetics(db: D1Database, claims: AccessClaims, origin: string, purchase: CosmeticPurchase) {
  const userId = claims.sub;
  const bundle = "bundle" in purchase ? purchase.bundle : undefined;
  const ids = "cosmeticId" in purchase ? [purchase.cosmeticId] : purchase.bundle.cosmeticIds;
  const idsJson = JSON.stringify(ids);

  for (let attempt = 0; attempt < 4; attempt++) {
    const now = new Date();
    const time = now.toISOString();
    const day = startOfUtcDay(now).toISOString();
    const dayKey = [userId, purchaseXpEvent, day];
    const [users, candidates, dailyXp, safety] = await db.batch([
      db.prepare(readWardrobe).bind(userId),
      db.prepare(`${readCosmetics} WHERE c.source_id IN (SELECT value FROM json_each(?))`).bind(idsJson),
      db.prepare(readDailyXp).bind(...dayKey),
      db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE source_id = ?`).bind(userId)
    ]);
    if ((safety.results[0] as { frozen: number } | undefined)?.frozen) {
      throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
    }

    const row = walletRow(users.results[0]);
    const items = candidates.results as Array<CosmeticRow & { reward_only: number }>;
    const item = bundle ? undefined : items[0];
    if (item?.reward_only) throw new HttpError(403, "This cosmetic is earned through Bonds", ErrorCode.FORBIDDEN);
    if (items.length !== ids.length || items.some(candidate => !candidate.is_active || candidate.reward_only)) {
      if (bundle) throw new HttpError(409, "This bundle is temporarily unavailable", ErrorCode.CONFLICT);
      throw new HttpError(400, "Invalid profile cosmetic", ErrorCode.VALIDATION);
    }

    const existing = new Set(wardrobe(row).ownedCosmeticIds);
    const newCosmetics = ids.filter(id => !existing.has(id));
    if (newCosmetics.length === 0) {
      if (bundle) throw new HttpError(409, "You already own all cosmetics in this bundle", ErrorCode.CONFLICT);
      return { status: 200, data: { ...await readCatalog(db, userId, origin, false), cosmetic: presentCosmetic(items[0], origin) } };
    }

    const price = bundle?.coinPrice ?? items[0].coin_price;
    if (!Number.isSafeInteger(price) || price <= 0) {
      throw new HttpError(400, "Coin amount must be a positive safe integer", ErrorCode.VALIDATION);
    }
    if (!Number.isSafeInteger(row.balance)) throw new HttpError(409, "Coin balance requires reconciliation", ErrorCode.CONFLICT);
    if (row.balance < price) {
      throw new HttpError(bundle ? 403 : 402, bundle ? "Insufficient balance" : "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
    }

    const remaining = row.balance - price;
    const previousDailyXp = (dailyXp.results[0] as { amount: number }).amount;
    const xpAwarded = Math.min(requestedXp, Math.max(0, dailyCap - previousDailyXp));
    const earnedToday = previousDailyXp + xpAwarded;
    const debitId = newId();
    const source = bundle ? "COSMETIC_BUNDLE_PURCHASE" : "PROFILE_COSMETIC_PURCHASE";
    const metadata = bundle ? { bundleId: bundle.id } : { cosmeticId: items[0].source_id, type: items[0].type };
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, debitId);
    const progress = prepareD1XpGrant(write, debitClaim, now, {
      userId, event: purchaseXpEvent, actionKey: `wallet-txn:${debitId}`, requestedXp, xpAwarded,
      previousXp: row.xp, previousLevel: row.stored_level, lastDailyCheckInAt: row.last_daily_check_in_at ?? undefined,
      balanceBefore: remaining, cap: { capped: earnedToday >= dailyCap, cap: dailyCap, earnedToday,
        remainingToday: Math.max(0, dailyCap - earnedToday) }
    });
    const key = item && activeCosmeticKey(item.type);
    const newIdsJson = JSON.stringify(newCosmetics);

    // The debit claims the exact wallet, XP cap, catalog price and relevant ownership.
    // All other writes depend on that debit in the same transaction.
    const claim = db.prepare(`INSERT INTO wallet_transactions
      (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, created_at, updated_at)
      SELECT ?, u.source_id, 'DEBIT', ?, ?, u.wallet_balance, ?, ?, ?, ? FROM users AS u
      WHERE ${d1LiveUserFilter} AND NOT ${walletFrozen}
        AND u.wallet_balance = ? AND u.xp = ? AND u.level = ? AND u.last_daily_check_in_at IS ?
        AND (${readDailyXp}) = ?
        AND (SELECT COUNT(*) FROM cosmetics AS c WHERE c.source_id IN (SELECT value FROM json_each(?))
          AND c.is_active = 1 AND c.reward_only = 0 AND (? OR (c.coin_price = ? AND c.type = ?))) = ?
        AND (SELECT COUNT(DISTINCT value) FROM user_owned_cosmetics
          WHERE users_id = u.source_id AND value IN (SELECT value FROM json_each(?))) = ?
        AND NOT EXISTS (SELECT 1 FROM user_owned_cosmetics
          WHERE users_id = u.source_id AND value IN (SELECT value FROM json_each(?)))`)
      .bind(debitId, source, price, remaining, JSON.stringify(metadata), time, time, ...bindD1LiveUser(claims, time),
        row.balance, row.xp, row.stored_level, row.last_daily_check_in_at, ...dayKey, previousDailyXp,
        idsJson, Number(bundle !== undefined), price, item?.type ?? null, ids.length, idsJson, ids.length - newCosmetics.length, newIdsJson);
    const columns = {
      wallet_balance: remaining, ...progress.columns, updated_at: time,
      ...(item && key ? { [activeColumn(key)]: item.source_id } : {})
    };
    const statements = [
      claim,
      write(`UPDATE users SET ${Object.keys(columns).map(column => `${column} = ?`).join(", ")}
        WHERE source_id = ? AND ${debitClaim}`, ...Object.values(columns), userId),
      write(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
        SELECT ? || ':ownedCosmeticIds:' || item.key, item.value, ?, item.key + start.position
        FROM json_each(?) AS item
        CROSS JOIN (SELECT COALESCE(MAX(position) + 1, 0) AS position FROM user_owned_cosmetics WHERE users_id = ?) AS start
        WHERE ${debitClaim}`, debitId, userId, newIdsJson, userId),
      clearProfileMarkers(db, userId, ["walletBalance", "ownedCosmeticIds", ...(key ? ["activeCosmetics", `activeCosmetics.${key}`] : [])],
        debitClaim, debitId),
      ...progress.statements
    ];
    if (xpAwarded > 0) {
      statements.push(
        write(`UPDATE xp_daily_caps SET amount = amount + ?, updated_at = ? WHERE source_id = (
          SELECT source_id FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ? ORDER BY source_id LIMIT 1
        ) AND ${debitClaim}`, xpAwarded, time, ...dayKey),
        write(`INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ?)
          AND ${debitClaim}`, newId(), ...dayKey, xpAwarded, time, time, ...dayKey)
      );
    }
    const [debit] = await db.batch(statements);
    if (!debit.meta.changes) continue;
    const catalog = await readCatalog(db, userId, origin, false);
    const xpGrant = progress.xpGrant;
    return bundle
      ? { status: 200, data: { ...catalog, newCosmetics, xpGrant } }
      : { status: 201, data: { ...catalog, cosmetic: presentCosmetic(items[0], origin), level: xpGrant.level, xpGrant } };
  }

  throw new HttpError(409, "Wallet or catalog changed. Please try again.", ErrorCode.CONFLICT);
}

async function transferCosmetic(db: D1Database, claims: AccessClaims, cosmeticId: string, receiverId: string) {
  const userId = claims.sub;
  if (userId === receiverId) throw new HttpError(400, "Choose another recipient", ErrorCode.VALIDATION);
  const [item, sender, receiver] = await db.batch([
    db.prepare("SELECT type, reward_only FROM cosmetics WHERE source_id = ?").bind(cosmeticId),
    db.prepare(`SELECT ${walletFrozen} AS frozen, EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE users_id = u.source_id AND value = ?) AS owned
      FROM users AS u WHERE source_id = ?`).bind(cosmeticId, userId),
    db.prepare(`SELECT EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE users_id = u.source_id AND value = ?) AS owned
      FROM users AS u WHERE source_id = ?`).bind(cosmeticId, receiverId)
  ]);
  const senderState = sender.results[0] as { frozen: number; owned: number } | undefined;
  const cosmetic = item.results[0] as { type: string; reward_only: number } | undefined;
  if (senderState?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
  if (!cosmetic) throw new HttpError(404, "Cosmetic not found", ErrorCode.NOT_FOUND);
  if (cosmetic.reward_only) throw new HttpError(403, "Bond rewards cannot be transferred", ErrorCode.FORBIDDEN);
  if (!senderState?.owned) throw new HttpError(403, "You don't own this cosmetic", ErrorCode.FORBIDDEN);
  if (!receiver.results.length) throw new HttpError(404, "Receiver not found", ErrorCode.NOT_FOUND);
  if ((receiver.results[0] as { owned: number }).owned) throw new HttpError(409, "Recipient already owns this cosmetic", ErrorCode.CONFLICT);

  const notificationId = newId();
  const time = new Date().toISOString();
  const claim = "EXISTS (SELECT 1 FROM notifications WHERE source_id = ?)";
  const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, notificationId);
  const key = activeCosmeticKey(cosmetic.type);
  const activeSlot = key ? activeColumn(key) : undefined;
  const statements = [
    db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
      SELECT ?, receiver.source_id, 'GIFT', 'Cosmetic Gift', u.name || ' gifted you ' || c.name || '!',
        json_object('cosmeticId', c.source_id), 0, ?, ?
      FROM users AS u JOIN users AS receiver ON receiver.source_id = ?
      JOIN cosmetics AS c ON c.source_id = ? AND c.type = ? AND c.reward_only = 0
      WHERE ${d1LiveUserFilter} AND NOT ${walletFrozen}
        AND EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE users_id = u.source_id AND value = c.source_id)
        AND NOT EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE users_id = receiver.source_id AND value = c.source_id)`)
      .bind(notificationId, time, time, receiverId, cosmeticId, cosmetic.type, ...bindD1LiveUser(claims, time)),
    write(`DELETE FROM user_owned_cosmetics WHERE users_id = ? AND value = ? AND ${claim}`, userId, cosmeticId),
    write(`INSERT INTO user_owned_cosmetics (source_id, users_id, value, position)
      SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM user_owned_cosmetics WHERE users_id = ?), 0) WHERE ${claim}`,
    `${notificationId}:cosmetic`, receiverId, cosmeticId, receiverId),
    clearProfileMarkers(db, receiverId, ["ownedCosmeticIds"], claim, notificationId)
  ];
  if (activeSlot) {
    statements.push(
      clearProfileMarkers(db, userId, [`activeCosmetics.${key}`],
        `${claim} AND EXISTS (SELECT 1 FROM users WHERE source_id = ? AND ${activeSlot} = ?)`, notificationId, userId, cosmeticId),
      write(`UPDATE users SET ${activeSlot} = NULL, updated_at = ?
        WHERE source_id = ? AND ${activeSlot} = ? AND ${claim}`, time, userId, cosmeticId)
    );
  }
  const [notification] = await db.batch(statements);
  if (!notification.meta.changes) throw new HttpError(409, "Ownership or wallet changed. Please try again.", ErrorCode.CONFLICT);
  return { transferred: true, cosmeticId };
}

export function createD1CosmeticsRouter(db: D1Database, publicOrigin: (req: ExpressRequest) => string) {
  const router = Router();
  const readAccess = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    const { user, claims } = await requireHttpSession(req.headers.authorization, readAccess);
    res.locals.userId = user.id;
    res.locals.claims = claims;
    next();
  });

  router.get("/wallet", authenticate, asyncHandler(async (_req, res) => {
    const userId: string = res.locals.userId;
    const now = new Date();
    const [users, transactions] = await db.batch([
      db.prepare(readWardrobe).bind(userId),
      db.prepare("SELECT 1 FROM wallet_transactions WHERE user_id = ? AND source = ? AND created_at >= ? LIMIT 1")
        .bind(userId, DAILY_REWARD_SOURCE, startOfUtcDay(now).toISOString())
    ]);
    const row = walletRow(users.results[0]);
    const claimedToday = transactions.results.length > 0;
    sendOk(res, {
      balance: row.balance,
      diamondBalance: row.diamond_balance,
      vip: walletVip(row, now),
      level: walletLevel(row),
      cosmetics: wardrobe(row),
      dailyReward: {
        canClaim: !claimedToday, coinReward: DAILY_REWARD_COINS, xpReward: 0,
        nextClaimAt: claimedToday ? nextUtcDay(now).toISOString() : null
      }
    });
  }));

  router.get("/wallet/packs", authenticate, (_req, res) => sendOk(res, { packs: coinPacks }));

  router.get("/wallet/vip/plans", authenticate, asyncHandler(async (_req, res) => {
    const row = walletRow(await db.prepare(readWardrobe).bind(res.locals.userId).first());
    sendOk(res, {
      plans: vipPlans,
      levels: VIP_LEVEL_REQUIREMENTS.slice(1).map((requiredExp, index) => ({ level: index + 1, requiredExp })),
      cycleDays: VIP_CYCLE_DAYS, vip: walletVip(row), balance: row.balance
    });
  }));

  router.get("/wallet/transactions", authenticate, asyncHandler(async (req, res) => {
    const limit = Math.trunc(Math.min(Math.max(Number(req.query.limit) || 100, 1), 200));
    const { results } = await db.prepare(`SELECT source_id AS _id, user_id AS userId, type, source, amount,
      balance_before AS balanceBefore, balance_after AS balanceAfter, metadata, purchase_token AS purchaseToken,
      product_id AS productId, platform, verification_status AS verificationStatus, credited_at AS creditedAt,
      created_at AS createdAt, updated_at AS updatedAt FROM wallet_transactions
      WHERE user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT ?`).bind(res.locals.userId, limit)
      .all<Record<string, unknown> & { source: keyof typeof walletSourceLabels; metadata: string }>();
    sendOk(res, {
      transactions: results.map(({ metadata, ...transaction }) => ({
        ...Object.fromEntries(Object.entries(transaction).filter(([, value]) => value != null)),
        metadata: JSON.parse(metadata), label: walletSourceLabels[transaction.source] ?? transaction.source
      }))
    });
  }));

  router.post("/wallet/rewards/daily", authenticate, asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    const now = new Date();
    const time = now.toISOString();
    const dayStart = startOfUtcDay(now).toISOString();
    const dayKey = dayStart.slice(0, 10);
    const operationId = newId();
    const claim = "EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)";
    const today = `EXISTS (SELECT 1 FROM wallet_transactions WHERE user_id = ? AND source = ?
      AND (created_at >= ? OR json_extract(metadata, '$.day') = ?))`;
    const todayArgs = [claims.sub, DAILY_REWARD_SOURCE, dayStart, dayKey];
    const [credit, , , account, eligibility] = await db.batch([
      db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after,
        metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'CREDIT', ?, ?, u.wallet_balance, u.wallet_balance + ?, ?, ?, ?, ? FROM users AS u
        WHERE ${d1LiveUserFilter} AND NOT ${walletFrozen} AND u.wallet_balance <= ? AND NOT ${today}`)
        .bind(operationId, DAILY_REWARD_SOURCE, DAILY_REWARD_COINS, DAILY_REWARD_COINS,
          JSON.stringify({ day: dayKey, reason: "daily_reward" }), time, time, time,
          ...bindD1LiveUser(claims, time), Number.MAX_SAFE_INTEGER - DAILY_REWARD_COINS, ...todayArgs),
      db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = ? WHERE source_id = ? AND ${claim}`)
        .bind(DAILY_REWARD_COINS, time, claims.sub, operationId),
      clearProfileMarkers(db, claims.sub, ["walletBalance"], claim, operationId),
      db.prepare(readWardrobe).bind(claims.sub),
      db.prepare(`SELECT ${walletFrozen} AS frozen, ${today} AS claimed FROM users AS u WHERE source_id = ?`)
        .bind(...todayArgs, claims.sub)
    ]);
    const row = walletRow(account.results[0]);
    const claimed = credit.meta.changes > 0;
    const state = eligibility.results[0] as { frozen: number; claimed: number };
    if (!claimed) {
      await requireHttpSession(req.headers.authorization, readAccess);
      if (state.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      if (!state.claimed) throw new HttpError(409, "Coin balance limit reached", ErrorCode.CONFLICT);
    }
    sendOk(res, {
      claimed, alreadyClaimed: !claimed, rewardCoins: DAILY_REWARD_COINS, rewardXp: 0,
      balance: row.balance, level: walletLevel(row),
      dailyReward: { canClaim: false, coinReward: DAILY_REWARD_COINS, xpReward: 0, nextClaimAt: nextUtcDay(now).toISOString() }
    }, claimed ? 201 : 200);
  }));

  router.get("/wallet/cosmetics", authenticate, asyncHandler(async (req, res) => {
    await seedDefaultCosmetics(db);
    const { cosmetics, ownedCosmeticIds, activeCosmetics } = await readCatalog(db, res.locals.userId, publicOrigin(req), true);
    sendOk(res, { cosmetics, ownedCosmeticIds, activeCosmetics });
  }));

  router.get("/users/me/inventory", authenticate, asyncHandler(async (req, res) => {
    await seedDefaultCosmetics(db);
    sendOk(res, await readInventory(db, res.locals.userId, publicOrigin(req)));
  }));

  router.post("/wallet/cosmetics/purchase", authenticate, validateBody(purchaseProfileCosmeticSchema), asyncHandler(async (req, res) => {
    await seedDefaultCosmetics(db);
    const result = await purchaseCosmetics(db, res.locals.claims, publicOrigin(req), { cosmeticId: req.body.cosmeticId });
    sendOk(res, result.data, result.status);
  }));

  router.post("/wallet/cosmetics/bundle-purchase", authenticate, validateBody(purchaseCosmeticBundleSchema), asyncHandler(async (req, res) => {
    const bundle = cosmeticBundles.find(item => item.id === req.body.bundleId);
    if (!bundle) throw new HttpError(404, "Bundle not found", ErrorCode.NOT_FOUND);
    await seedDefaultCosmetics(db);
    const result = await purchaseCosmetics(db, res.locals.claims, publicOrigin(req), { bundle });
    sendOk(res, result.data, result.status);
  }));

  router.post("/wallet/cosmetics/transfer", authenticate, validateBody(transferCosmeticSchema), asyncHandler(async (req, res) => {
    await seedDefaultCosmetics(db);
    sendOk(res, await transferCosmetic(db, res.locals.claims, req.body.cosmeticId, req.body.receiverId.toLowerCase()));
  }));

  router.post("/wallet/cosmetics/equip", authenticate, validateBody(equipProfileCosmeticSchema), asyncHandler(async (req, res) => {
    const userId: string = res.locals.userId;
    const key = activeCosmeticKey(req.body.type);
    if (!key) throw new HttpError(400, "Invalid cosmetic type", ErrorCode.VALIDATION);
    const cosmeticId: string | null = req.body.cosmeticId?.trim() || null;
    await seedDefaultCosmetics(db);

    const time = new Date().toISOString();
    const claims: AccessClaims = res.locals.claims;
    // Both statements run in a D1 transaction and use the same eligibility check.
    // The profile sidecar must stop masking slots once they are changed by the owner.
    const eligible = `${d1LiveUserFilter}
      AND (? IS NULL OR EXISTS (
        SELECT 1 FROM cosmetics AS c JOIN user_owned_cosmetics AS owned ON owned.value = c.source_id
        WHERE c.source_id = ? AND c.type = ? AND owned.users_id = u.source_id
      ))`;
    const filter = [...bindD1LiveUser(claims, time), cosmeticId, cosmeticId, req.body.type];
    const slot = `activeCosmetics.${key}`;
    const [, updated] = await db.batch([
      clearProfileMarkers(db, userId, ["activeCosmetics", slot], `EXISTS (SELECT 1 FROM users AS u WHERE ${eligible})`, ...filter),
      db.prepare(`UPDATE users AS u SET ${activeColumn(key)} = ?, updated_at = ? WHERE ${eligible}`)
        .bind(cosmeticId, time, ...filter)
    ]);

    if (!updated.meta.changes) {
      await requireHttpSession(req.headers.authorization, readAccess);
      const type = cosmeticId && await db.prepare("SELECT type FROM cosmetics WHERE source_id = ?").bind(cosmeticId).first("type");
      if (cosmeticId && type !== req.body.type) throw new HttpError(400, "Cosmetic type mismatch", ErrorCode.VALIDATION);
      if (cosmeticId) throw new HttpError(403, "Cosmetic is not owned", ErrorCode.FORBIDDEN);
      throw new HttpError(409, "Account changed. Please try again.", ErrorCode.CONFLICT);
    }

    sendOk(res, await readCatalog(db, userId, publicOrigin(req), false));
  }));
  return router;
}

export async function readD1PublishedCosmeticAsset(db: D1Database, bucket: R2Bucket, request: Request) {
  if (request.method !== "GET" && request.method !== "HEAD") return;
  const pathname = new URL(request.url).pathname;
  if (!pathname.startsWith(`${publishedAssetPath}/`)) return;
  const match = /^([a-f0-9]{24}|[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12})\/([a-z0-9_-]{1,64})\/?$/i
    .exec(pathname.slice(publishedAssetPath.length + 1));
  const notFound = () => new Response(null, { status: 404 });
  if (!match) return notFound();

  const variant = await db.prepare(`SELECT v.key, v.content_type
    FROM asset_variants AS v JOIN assets AS a ON a.source_id = v.assets_id
    WHERE a.source_id = ? AND v.name = ? AND a.status = 'published'
      AND v.key <> a.staging_key AND v.content_type IN ${publicImageTypes}`)
    .bind(match[1], match[2]).first<{ key: string; content_type: string }>();
  if (!variant) return notFound();

  const object = await bucket.get(variant.key);
  if (!object) return notFound();
  const headers = {
    "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff",
    "Content-Type": variant.content_type, "Content-Length": String(object.size)
  };
  if (request.method === "HEAD") {
    await object.body.cancel();
    return new Response(null, { headers });
  }
  // Workerd's stream and the Node/DOM stream declarations differ on
  // reader.closed, but both expose the same async iterator.
  const chunks = object.body.values();
  const body = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const chunk = await chunks.next();
      if (chunk.done) controller.close();
      else controller.enqueue(chunk.value);
    },
    async cancel() { await chunks.return?.(); }
  });
  return new Response(body, { headers });
}
