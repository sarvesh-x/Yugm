import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Request } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { themeSeeds } from "../services/immersiveThemeCatalog.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { clearProfileMarkers, walletFrozen } from "./d1Cosmetics.js";

interface ThemeRow {
  source_id: string;
  key: string;
  name: string;
  type: string;
  category: string;
  colors: string;
  animation: string | null;
  ambient_sound: string | null;
  price_coins: number;
  price_diamonds: number;
  premium: number;
  available: number;
  created_at: string | null;
  updated_at: string | null;
}

const slots = { room: "roomTheme", profile: "profileTheme", entrance: "entranceEffect" } as const;
const columns = {
  room: "active_cosmetics_room_theme",
  profile: "active_cosmetics_profile_theme",
  entrance: "active_cosmetics_entrance_effect"
} as const;
const themeKey = z.string().min(1).max(64);
export const setThemeSchema = z.object({ themeKey });
const equipSchema = z.object({ slot: z.enum(["room", "profile", "entrance"]), themeKey: themeKey.nullable() });
const id = () => randomBytes(12).toString("hex");
const owned = `EXISTS (SELECT 1 FROM user_owned_cosmetics AS o WHERE o.users_id = u.source_id AND o.value = t.key)`;
export const usableTheme = `EXISTS (SELECT 1 FROM immersive_themes AS t
  WHERE t.key = ? AND t.available = 1 AND ((t.price_coins = 0 AND t.price_diamonds = 0) OR ${owned}))`;

function presentTheme(row: ThemeRow) {
  return {
    _id: row.source_id, key: row.key, name: row.name, type: row.type, category: row.category,
    colors: JSON.parse(row.colors), animation: row.animation ? JSON.parse(row.animation) : undefined,
    ambientSound: row.ambient_sound ?? undefined,
    price: { coins: row.price_coins, diamonds: row.price_diamonds },
    premium: Boolean(row.premium), available: Boolean(row.available),
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

async function seedEmptyCatalog(db: D1Database) {
  if (await db.prepare("SELECT 1 FROM immersive_themes LIMIT 1").first()) return;
  const time = new Date().toISOString();
  const seeds = themeSeeds.map(theme => ({ ...theme, id: id() }));
  await db.prepare(`INSERT INTO immersive_themes (source_id, key, name, type, category, colors, animation,
    ambient_sound, price_coins, price_diamonds, premium, available, created_at, updated_at)
    SELECT json_extract(value, '$.id'), json_extract(value, '$.key'), json_extract(value, '$.name'),
      json_extract(value, '$.type'), json_extract(value, '$.category'), json_extract(value, '$.colors'),
      json_extract(value, '$.animation'), json_extract(value, '$.ambientSound'), json_extract(value, '$.price.coins'),
      json_extract(value, '$.price.diamonds'), json_extract(value, '$.premium'), json_extract(value, '$.available'), ?, ?
    FROM json_each(?) WHERE NOT EXISTS (SELECT 1 FROM immersive_themes)`)
    .bind(time, time, JSON.stringify(seeds)).run();
}

async function availableTheme(db: D1Database, key: string) {
  const theme = await db.prepare("SELECT * FROM immersive_themes WHERE key = ? AND available = 1 LIMIT 1")
    .bind(key).first<ThemeRow>();
  if (!theme) throw new HttpError(404, "Theme not found", ErrorCode.NOT_FOUND);
  return theme;
}

export async function assertD1ThemeEntitlement(db: D1Database, userId: string, key: string) {
  const theme = await availableTheme(db, key);
  if (theme.price_coins === 0 && theme.price_diamonds === 0) return;
  const ownership = await db.prepare("SELECT 1 FROM user_owned_cosmetics WHERE users_id = ? AND value = ?")
    .bind(userId, key).first();
  if (!ownership) throw new HttpError(403, "Purchase this theme before using it", ErrorCode.FORBIDDEN);
}

function readEquipped(db: D1Database, userId: string) {
  return db.prepare(`SELECT ${columns.room} AS room, ${columns.profile} AS profile, ${columns.entrance} AS entrance
    FROM users WHERE source_id = ?`).bind(userId).first<Record<keyof typeof columns, string | null>>();
}

async function purchaseTheme(db: D1Database, claims: AccessClaims, key: string) {
  const theme = await availableTheme(db, key);
  const price = theme.price_coins;
  if (!Number.isSafeInteger(price) || price < 0) {
    throw new HttpError(400, "This theme has an invalid price", ErrorCode.VALIDATION);
  }
  if (price === 0 && theme.price_diamonds !== 0) {
    throw new HttpError(409, "This theme cannot be purchased with coins", ErrorCode.CONFLICT);
  }

  const time = new Date().toISOString();
  const grantId = id();
  // Only the batch that creates this entitlement can write its debit.
  const claimed = "EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE source_id = ?)";
  const grant = db.prepare(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
    SELECT ?, t.key, u.source_id,
      COALESCE((SELECT MAX(position) + 1 FROM user_owned_cosmetics WHERE users_id = u.source_id), 0)
    FROM users AS u CROSS JOIN immersive_themes AS t
    WHERE ${d1LiveUserFilter} AND t.source_id = ? AND t.key = ? AND t.available = 1
      AND t.price_coins = ? AND t.price_diamonds = ? AND NOT ${owned}
      AND (? = 0 OR (NOT ${walletFrozen} AND typeof(u.wallet_balance) = 'integer'
        AND u.wallet_balance BETWEEN ? AND ?))`)
    .bind(grantId, ...bindD1LiveUser(claims, time), theme.source_id, key, price, theme.price_diamonds,
      price, price, Number.MAX_SAFE_INTEGER);
  const statements = [grant];
  if (price > 0) {
    const metadata = JSON.stringify({ cosmeticId: key, idempotencyKey: `theme-purchase:${claims.sub}:${grantId}:debit` });
    statements.push(db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, created_at, updated_at)
        SELECT ?, source_id, 'DEBIT', 'PROFILE_COSMETIC_PURCHASE', ?, wallet_balance, wallet_balance - ?, ?, ?, ?
        FROM users WHERE source_id = ? AND ${claimed}`)
        .bind(id(), price, price, metadata, time, time, claims.sub, grantId));
  }
  statements.push(
    db.prepare(`UPDATE users SET wallet_balance = CASE WHEN ? > 0 THEN wallet_balance - ? ELSE wallet_balance END,
      updated_at = ? WHERE source_id = ? AND ${claimed}`).bind(price, price, time, claims.sub, grantId),
    clearProfileMarkers(db, claims.sub, ["ownedCosmeticIds"], claimed, grantId)
  );
  const [result] = await db.batch(statements);
  return { theme, granted: Boolean(result.meta.changes) };
}

export function createD1ThemesRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, access);
  const requireThemeSession = asyncHandler(async (req, res, next) => {
    res.locals.themeClaims = (await authenticate(req)).claims;
    next();
  });

  router.get("/themes", asyncHandler(async (req, res) => {
    await authenticate(req);
    await seedEmptyCatalog(db);
    const { results } = await db.prepare("SELECT * FROM immersive_themes WHERE available = 1 ORDER BY rowid")
      .all<ThemeRow>();
    sendOk(res, { themes: results.map(presentTheme) });
  }));

  router.post("/themes/purchase", requireThemeSession, validateBody(setThemeSchema), asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.themeClaims;
    const { theme, granted } = await purchaseTheme(db, claims, req.body.themeKey);
    if (!granted) {
      await authenticate(req);
      const current = await availableTheme(db, theme.key);
      const state = await db.prepare(`SELECT u.wallet_balance, ${walletFrozen} AS frozen, ${owned} AS owned
        FROM users AS u CROSS JOIN immersive_themes AS t WHERE u.source_id = ? AND t.source_id = ?`)
        .bind(claims.sub, current.source_id).first<{ wallet_balance: number; frozen: number; owned: number }>();
      if (!state?.owned) {
        if (current.source_id !== theme.source_id || current.price_coins !== theme.price_coins ||
          current.price_diamonds !== theme.price_diamonds) {
          throw new HttpError(409, "Theme changed. Please try again.", ErrorCode.CONFLICT);
        }
        if (state?.frozen && theme.price_coins > 0) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
        if (state && state.wallet_balance < theme.price_coins) {
          throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
        }
        throw new HttpError(409, "Theme purchase could not be completed. Please try again.", ErrorCode.CONFLICT);
      }
    }
    sendOk(res, { theme: presentTheme(theme) });
  }));

  router.get("/user/themes", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const [themes, equipped] = await Promise.all([
      db.prepare(`SELECT t.* FROM immersive_themes AS t WHERE EXISTS
        (SELECT 1 FROM user_owned_cosmetics AS o WHERE o.users_id = ? AND o.value = t.key) ORDER BY t.rowid`)
        .bind(user.id).all<ThemeRow>(),
      readEquipped(db, user.id)
    ]);
    sendOk(res, { owned: themes.results.map(presentTheme), equipped });
  }));

  router.post("/user/themes/equip", requireThemeSession, validateBody(equipSchema), asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.themeClaims;
    const { slot, themeKey: key } = req.body as z.infer<typeof equipSchema>;
    if (key !== null) await assertD1ThemeEntitlement(db, claims.sub, key);
    const time = new Date().toISOString();
    const eligible = `${d1LiveUserFilter} AND (? IS NULL OR ${usableTheme})`;
    const filter = [...bindD1LiveUser(claims, time), key, key];
    const profileSlot = `activeCosmetics.${slots[slot]}`;
    const [, result] = await db.batch([
      clearProfileMarkers(db, claims.sub, ["activeCosmetics", profileSlot],
        `EXISTS (SELECT 1 FROM users AS u WHERE ${eligible})`, ...filter),
      db.prepare(`UPDATE users AS u SET ${columns[slot]} = ?, updated_at = ? WHERE ${eligible}`)
        .bind(key, time, ...filter)
    ]);
    if (!result.meta.changes) {
      await authenticate(req);
      throw new HttpError(403, "Theme is no longer available for this account", ErrorCode.FORBIDDEN);
    }
    sendOk(res, { equipped: await readEquipped(db, claims.sub) });
  }));
  return router;
}
