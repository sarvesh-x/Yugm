import type { D1Database } from "@cloudflare/workers-types";
import { createHash } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { defaultSeason, monthlySeasonWindow } from "../services/seasonDefaults.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { clearProfileMarkers, newId, readWardrobe, seedDefaultCosmetics, walletFrozen, walletRow } from "./d1Cosmetics.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

type SeasonRow = {
  source_id: string; key: string; name: string; description: string; start_date: string; end_date: string;
  max_level: number; xp_per_level: number; premium_price: number; active: number;
  created_at: string | null; updated_at: string | null;
};
type SeasonRewardRow = { level: number; free_reward: string | null; premium_reward: string | null };
type PassRow = {
  source_id: string; season_id: string; season_name: string; user_id: string; tier: "free" | "premium";
  level: number; xp: number; premium: number; expires_at: string; created_at: string | null; updated_at: string | null;
};
type PassRewardRow = { level: number; claimed: number; free_claimed: number; premium_claimed: number };
type AccountRow = {
  wallet_balance: number; diamond_balance: number; xp: number; level: number; last_daily_check_in_at: string | null;
};
type TrackReward = { type: string; id?: string; amount?: number };

const seasonColumns = `source_id, key, name, description, start_date, end_date, max_level, xp_per_level,
  premium_price, active, created_at, updated_at`;
const passColumns = `source_id, season_id, season_name, user_id, tier, level, xp, premium, expires_at,
  created_at, updated_at`;
const activeSeason = `SELECT ${seasonColumns} FROM seasons WHERE active = 1 AND start_date <= ? AND end_date > ?
  ORDER BY start_date DESC, source_id DESC LIMIT 1`;
const defaultRewards = JSON.stringify(defaultSeason.rewards);
const claimExists = "EXISTS (SELECT 1 FROM user_auth_profile WHERE source_id = ? AND edit_token = ?)";
const claimSchema = z.object({ level: z.number().int().min(1).max(100), track: z.enum(["free", "premium"]) });
const passIdFor = (userId: string, seasonId: string) =>
  createHash("sha1").update(`${userId}:${seasonId}`).digest("hex").slice(0, 24);

function parseReward(raw: string | null): TrackReward | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw) as TrackReward | null;
    return value && typeof value.type === "string" ? value : null;
  } catch {
    return null;
  }
}

function presentSeason(row: SeasonRow, rewards: SeasonRewardRow[]) {
  return {
    _id: row.source_id,
    key: row.key,
    name: row.name,
    description: row.description,
    active: Boolean(row.active),
    startDate: row.start_date,
    endDate: row.end_date,
    maxLevel: row.max_level,
    xpPerLevel: row.xp_per_level,
    premiumPrice: row.premium_price,
    rewards: rewards.map(reward => ({
      level: reward.level,
      freeReward: parseReward(reward.free_reward),
      premiumReward: parseReward(reward.premium_reward)
    })),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {})
  };
}

function presentPass(row: PassRow, rewards: PassRewardRow[]) {
  return {
    _id: row.source_id,
    season: { id: row.season_id, name: row.season_name },
    userId: row.user_id,
    tier: row.tier,
    level: row.level,
    xp: row.xp,
    premium: Boolean(row.premium),
    expiresAt: row.expires_at,
    rewards: rewards.map(reward => ({
      level: reward.level,
      claimed: Boolean(reward.claimed),
      freeClaimed: Boolean(reward.free_claimed),
      premiumClaimed: Boolean(reward.premium_claimed)
    })),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {})
  };
}

async function readPassRewards(db: D1Database, passId: string) {
  const rewards = await db.prepare(`SELECT level, claimed, free_claimed, premium_claimed
    FROM battle_pass_rewards WHERE battle_passes_id = ? ORDER BY position`).bind(passId).all<PassRewardRow>();
  return rewards.results;
}

async function readSeasonRewards(db: D1Database, seasonId: string) {
  const rewards = await db.prepare(`SELECT level, free_reward, premium_reward
    FROM season_rewards WHERE seasons_id = ? ORDER BY position`).bind(seasonId).all<SeasonRewardRow>();
  return rewards.results;
}

async function ensureActiveSeason(db: D1Database, now: Date) {
  const time = now.toISOString();
  const window = monthlySeasonWindow(now);
  const seasonId = newId();
  await db.batch([
    db.prepare(`UPDATE seasons SET active = 0, updated_at = ? WHERE active = 1 AND NOT EXISTS (${activeSeason})`)
      .bind(time, time, time),
    db.prepare(`INSERT INTO seasons (source_id, key, name, description, start_date, end_date, max_level,
        xp_per_level, premium_price, active, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ? WHERE NOT EXISTS (${activeSeason})
      ON CONFLICT (key) DO UPDATE SET active = 1, name = excluded.name, start_date = excluded.start_date,
        end_date = excluded.end_date, updated_at = excluded.updated_at`)
      .bind(seasonId, window.key, window.name, defaultSeason.description, window.startDate.toISOString(),
        window.endDate.toISOString(), defaultSeason.maxLevel, defaultSeason.xpPerLevel,
        defaultSeason.premiumPrice, time, time, time, time),
    db.prepare(`INSERT INTO season_rewards (source_id, level, free_reward, premium_reward, seasons_id, position)
      SELECT ? || ':rewards:' || reward.key, json_extract(reward.value, '$.level'),
        json_extract(reward.value, '$.freeReward'), json_extract(reward.value, '$.premiumReward'), ?, reward.key
      FROM json_each(?) AS reward
      WHERE EXISTS (SELECT 1 FROM seasons WHERE source_id = ?)
        AND NOT EXISTS (SELECT 1 FROM season_rewards WHERE seasons_id = ?)`)
      .bind(seasonId, seasonId, defaultRewards, seasonId, seasonId)
  ]);
  const season = await db.prepare(`SELECT ${seasonColumns} FROM (${activeSeason})`).bind(time, time).first<SeasonRow>();
  if (!season) throw new HttpError(409, "Season requires reconciliation", ErrorCode.CONFLICT);
  return season;
}

async function ensureBattlePass(db: D1Database, userId: string, season: SeasonRow) {
  const passId = passIdFor(userId, season.source_id);
  const existing = await db.prepare(`SELECT ${passColumns} FROM battle_passes
    WHERE user_id = ? AND season_id = ?`).bind(userId, season.source_id).first<PassRow>();
  if (existing) return existing;
  const time = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO battle_passes (source_id, season_id, season_name, user_id, tier, level, xp,
        premium, expires_at, created_at, updated_at)
      SELECT ?, s.source_id, s.name, ?, 'free', 1, 0, 0, s.end_date, ?, ? FROM seasons AS s
      WHERE s.source_id = ? ON CONFLICT (user_id, season_id) DO NOTHING`)
      .bind(passId, userId, time, time, season.source_id),
    db.prepare(`INSERT INTO battle_pass_rewards (source_id, level, claimed, free_claimed, premium_claimed,
        battle_passes_id, position)
      SELECT ? || ':rewards:' || r.position, r.level, 0, 0, 0, ?, r.position
      FROM season_rewards AS r WHERE r.seasons_id = ? ON CONFLICT (source_id) DO NOTHING`)
      .bind(passId, passId, season.source_id)
  ]);
  const pass = await db.prepare(`SELECT ${passColumns} FROM battle_passes WHERE source_id = ?`).bind(passId).first<PassRow>();
  if (!pass) throw new HttpError(409, "Battle pass requires reconciliation", ErrorCode.CONFLICT);
  return pass;
}

async function previousSeasonSummary(db: D1Database, userId: string, season: SeasonRow) {
  const previous = await db.prepare(`SELECT source_id, name, max_level, end_date FROM seasons
    WHERE active = 0 AND end_date <= ? ORDER BY end_date DESC, source_id DESC LIMIT 1`)
    .bind(season.start_date).first<{ source_id: string; name: string; max_level: number; end_date: string }>();
  if (!previous) return undefined;
  const pass = await db.prepare("SELECT level, premium FROM battle_passes WHERE user_id = ? AND season_id = ?")
    .bind(userId, previous.source_id).first<{ level: number; premium: number }>();
  if (!pass) return undefined;
  const [seasonRewards, passRewards] = await db.batch([
    db.prepare("SELECT level, free_reward, premium_reward FROM season_rewards WHERE seasons_id = ? ORDER BY position")
      .bind(previous.source_id),
    db.prepare("SELECT level, claimed, free_claimed, premium_claimed FROM battle_pass_rewards WHERE battle_passes_id = ? ORDER BY level")
      .bind((await db.prepare("SELECT source_id FROM battle_passes WHERE user_id = ? AND season_id = ?")
        .bind(userId, previous.source_id).first<string>("source_id")) ?? "")
  ]);
  const claimed = new Map((passRewards.results as PassRewardRow[]).map(row => [row.level, row]));
  const unclaimedRewards = (seasonRewards.results as SeasonRewardRow[]).reduce((count, reward) => {
    if (reward.level > pass.level) return count;
    const state = claimed.get(reward.level);
    const freeUnclaimed = Boolean(reward.free_reward) && !state?.free_claimed && !state?.claimed;
    const premiumUnclaimed = Boolean(pass.premium && reward.premium_reward) && !state?.premium_claimed;
    return count + Number(freeUnclaimed) + Number(premiumUnclaimed);
  }, 0);
  return {
    name: previous.name,
    level: pass.level,
    maxLevel: previous.max_level,
    premium: Boolean(pass.premium),
    unclaimedRewards,
    endedAt: previous.end_date
  };
}

export function createD1BattlePassRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.session = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const userOf = (res: { locals: Record<string, unknown> }) => res.locals.session as { user: { id: string } };
  const userIdOf = (res: { locals: Record<string, unknown> }) => userOf(res).user.id;

  router.get("/battle-pass", authenticate, asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const now = new Date();
    const season = await ensureActiveSeason(db, now);
    const pass = await ensureBattlePass(db, userId, season);
    const [seasonRewards, passRewards, summary] = await Promise.all([
      readSeasonRewards(db, season.source_id),
      readPassRewards(db, pass.source_id),
      previousSeasonSummary(db, userId, season)
    ]);
    sendOk(res, {
      schemaVersion: 1,
      battlePass: presentPass(pass, passRewards),
      season: presentSeason(season, seasonRewards),
      ...(summary ? { previousSeasonSummary: summary } : {})
    });
  }));

  router.post("/battle-pass/purchase", authenticate, asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const now = new Date();
    const season = await ensureActiveSeason(db, now);
    const pass = await ensureBattlePass(db, userId, season);
    if (pass.premium) throw new HttpError(409, "Battle pass already purchased", ErrorCode.CONFLICT);
    const price = season.premium_price;
    const frozen = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE source_id = ?`)
      .bind(userId).first<{ frozen: number }>();
    if (frozen?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
    const row = walletRow(await db.prepare(readWardrobe).bind(userId).first());
    if (row.balance < price) throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);

    const time = now.toISOString();
    const remaining = row.balance - price;
    const ledgerId = newId();
    const token = newId();
    const idempotencyKey = `battle-pass-purchase:${season.source_id}:${userId}`;
    const claim = db.prepare(`INSERT INTO wallet_transactions
      (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, created_at, updated_at)
      SELECT ?, u.source_id, 'DEBIT', 'BATTLE_PASS_PURCHASE', ?, u.wallet_balance, ?, ?, ?, ? FROM users AS u
      WHERE u.source_id = ? AND u.wallet_balance = ? AND NOT ${walletFrozen}
        AND NOT EXISTS (SELECT 1 FROM wallet_transactions AS w WHERE w.user_id = u.source_id
          AND json_extract(w.metadata, '$.idempotencyKey') = ?)`)
      .bind(ledgerId, price, remaining, JSON.stringify({ seasonId: season.source_id, idempotencyKey }), time, time,
        userId, row.balance, idempotencyKey);
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, userId, token);
    const [ , debit, , , upgraded] = await db.batch([
      db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, missing_fields, edit_token)
        SELECT u.source_id, '[]', '[]', ? FROM users AS u WHERE u.source_id = ?
        ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token`).bind(token, userId),
      claim,
      write(`UPDATE users SET wallet_balance = ?, updated_at = ? WHERE source_id = ? AND ${claimExists}`,
        remaining, time, userId),
      clearProfileMarkers(db, userId, ["walletBalance"], claimExists, userId, token),
      write(`UPDATE battle_passes SET premium = 1, tier = 'premium', updated_at = ?
        WHERE source_id = ? AND premium = 0 AND ${claimExists}`, time, pass.source_id)
    ]);
    if (!debit.meta.changes || !upgraded.meta.changes) {
      const state = await db.prepare(`SELECT p.premium, u.wallet_balance, ${walletFrozen} AS frozen
        FROM battle_passes AS p JOIN users AS u ON u.source_id = p.user_id WHERE p.source_id = ?`)
        .bind(pass.source_id).first<{ premium: number; wallet_balance: number; frozen: number }>();
      if (state?.premium) throw new HttpError(409, "Battle pass was purchased in another request", ErrorCode.CONFLICT);
      if (state?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      if ((state?.wallet_balance ?? 0) < price) throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
      throw new HttpError(409, "Battle pass changed. Please retry.", ErrorCode.CONFLICT);
    }
    const [seasonRewards, passRewards] = await Promise.all([
      readSeasonRewards(db, season.source_id),
      readPassRewards(db, pass.source_id)
    ]);
    sendOk(res, { battlePass: presentPass({ ...pass, premium: 1, tier: "premium" }, passRewards), season: presentSeason(season, seasonRewards) });
  }));

  router.post("/battle-pass/claim", authenticate, validateBody(claimSchema), asyncHandler(async (req, res) => {
    const userId = userIdOf(res);
    const { level, track } = req.body as z.infer<typeof claimSchema>;
    const now = new Date();
    const season = await ensureActiveSeason(db, now);
    const pass = await ensureBattlePass(db, userId, season);
    if (level > pass.level) throw new HttpError(409, "Reach this level before claiming its reward", ErrorCode.CONFLICT);
    if (track === "premium" && !pass.premium) {
      throw new HttpError(403, "Premium rewards require the premium pass", ErrorCode.FORBIDDEN);
    }
    const [seasonRewards, passRewards] = await Promise.all([
      readSeasonRewards(db, season.source_id),
      readPassRewards(db, pass.source_id)
    ]);
    const seasonReward = seasonRewards.find(reward => reward.level === level);
    const reward = parseReward(track === "free" ? seasonReward?.free_reward ?? null : seasonReward?.premium_reward ?? null);
    if (!seasonReward || !reward) throw new HttpError(404, "No reward is configured for this track", ErrorCode.NOT_FOUND);
    const state = passRewards.find(item => item.level === level);
    if (track === "free" ? state?.free_claimed : state?.premium_claimed) {
      throw new HttpError(409, "This reward has already been claimed", ErrorCode.CONFLICT);
    }

    const user = await db.prepare(`SELECT wallet_balance, diamond_balance, xp, level, last_daily_check_in_at
      FROM users WHERE source_id = ?`).bind(userId).first<AccountRow>();
    if (!user) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    const time = now.toISOString();
    const token = newId();
    const field = track === "free" ? "free_claimed" : "premium_claimed";
    const claim = db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, missing_fields, edit_token)
      SELECT u.source_id, '[]', '[]', ? FROM users AS u WHERE u.source_id = ?
        AND EXISTS (SELECT 1 FROM battle_passes AS p WHERE p.source_id = ? AND p.user_id = ? AND p.level >= ?
          AND (? = 'free' OR p.premium = 1)
          AND EXISTS (SELECT 1 FROM battle_pass_rewards AS r WHERE r.battle_passes_id = p.source_id
            AND r.level = ? AND ${field} = 0))
      ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token`)
      .bind(token, userId, pass.source_id, userId, level, track, level);
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, userId, token);
    const statements = [claim, write(`UPDATE battle_pass_rewards SET ${field} = 1
      WHERE battle_passes_id = ? AND level = ? AND ${claimExists}`, pass.source_id, level)];
    const columns: Record<string, number | string> = { updated_at: time };
    const markers: string[] = [];
    const idempotencyKey = `bp:${season.source_id}:${userId}:${level}:${track}`;
    const metadata = { seasonId: season.source_id, level, track, rewardType: reward.type, rewardId: reward.id };
    let claimedReward: TrackReward;

    if (reward.type === "coins" && (reward.amount ?? 0) > 0) {
      const amount = reward.amount!;
      statements.push(write(`INSERT INTO wallet_transactions
        (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, ?, 'CREDIT', 'BATTLE_PASS_REWARD', ?, ?, ?, ?, ?, ?, ? WHERE ${claimExists}`,
      newId(), userId, amount, user.wallet_balance, user.wallet_balance + amount,
      JSON.stringify({ ...metadata, idempotencyKey: `${idempotencyKey}:coins` }), time, time, time));
      columns.wallet_balance = user.wallet_balance + amount;
      markers.push("walletBalance");
      claimedReward = { type: "coins", amount };
    } else if (reward.type === "diamonds" && (reward.amount ?? 0) > 0) {
      const amount = reward.amount!;
      statements.push(write(`INSERT INTO diamond_transactions
        (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, idempotency_key, created_at, updated_at)
        SELECT ?, ?, 'CREDIT', 'REWARD', ?, ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM diamond_transactions WHERE idempotency_key = ?) AND ${claimExists}`,
      newId(), userId, amount, user.diamond_balance, user.diamond_balance + amount,
      JSON.stringify({ ...metadata, idempotencyKey }), idempotencyKey, time, time, idempotencyKey));
      columns.diamond_balance = user.diamond_balance + amount;
      claimedReward = { type: "diamonds", amount };
    } else if (reward.type === "cosmetic" && reward.id) {
      await seedDefaultCosmetics(db);
      const cosmetic = await db.prepare("SELECT 1 FROM cosmetics WHERE source_id = ?").bind(reward.id).first();
      if (!cosmetic) throw new HttpError(404, "Reward cosmetic is unavailable", ErrorCode.NOT_FOUND);
      statements.push(write(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM user_owned_cosmetics WHERE users_id = ?), 0)
          WHERE NOT EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE users_id = ? AND value = ?) AND ${claimExists}`,
      newId(), reward.id, userId, userId, userId, reward.id));
      markers.push("ownedCosmeticIds");
      claimedReward = { type: "cosmetic", id: reward.id };
    } else if (reward.type === "title" && reward.id) {
      statements.push(write(`INSERT INTO user_owned_titles (source_id, value, users_id, position)
        SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM user_owned_titles WHERE users_id = ?), 0)
          WHERE NOT EXISTS (SELECT 1 FROM user_owned_titles WHERE users_id = ? AND value = ?) AND ${claimExists}`,
      newId(), reward.id, userId, userId, userId, reward.id));
      markers.push("ownedTitles");
      claimedReward = { type: "title", id: reward.id };
    } else if (reward.type === "xp" && (reward.amount ?? 0) > 0) {
      const amount = reward.amount!;
      const grant = prepareD1XpGrant(write, claimExists, now, {
        userId, event: "BATTLE_PASS_REWARD", actionKey: `${idempotencyKey}:xp`,
        requestedXp: amount, xpAwarded: amount, previousXp: user.xp, previousLevel: user.level,
        lastDailyCheckInAt: user.last_daily_check_in_at ?? undefined, balanceBefore: user.wallet_balance,
        skipBattlePass: true
      });
      statements.push(...grant.statements);
      Object.assign(columns, grant.columns);
      if (grant.xpGrant.levelUpReward > 0) markers.push("walletBalance");
      claimedReward = { type: "xp", amount };
    } else {
      throw new HttpError(409, "This reward is not claimable yet", ErrorCode.CONFLICT);
    }

    statements.push(write(`UPDATE users SET ${Object.keys(columns).map(key => `${key} = ?`).join(", ")}
      WHERE source_id = ? AND ${claimExists}`, ...Object.values(columns), userId));
    if (markers.length) statements.push(clearProfileMarkers(db, userId, markers, claimExists, userId, token));
    const [claimed] = await db.batch(statements);
    if (!claimed.meta.changes) throw new HttpError(409, "This reward has already been claimed", ErrorCode.CONFLICT);
    const [updatedPass, updatedRewards] = await Promise.all([
      db.prepare(`SELECT ${passColumns} FROM battle_passes WHERE source_id = ?`).bind(pass.source_id).first<PassRow>(),
      readPassRewards(db, pass.source_id)
    ]);
    if (!updatedPass) throw new HttpError(409, "Battle pass requires reconciliation", ErrorCode.CONFLICT);
    sendOk(res, { battlePass: presentPass(updatedPass, updatedRewards), season: presentSeason(season, seasonRewards), claimedReward, track });
  }));

  return router;
}
