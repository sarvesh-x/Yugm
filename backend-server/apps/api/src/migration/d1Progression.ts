import type { D1Database } from "@cloudflare/workers-types";
import { streakCoinBonuses, streakCosmeticRewards, xpEvents } from "@yugm/shared";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import type { AccessClaims } from "../services/accessSession.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { nextStreakMilestone, presentLevelOverview } from "../services/levelOverview.js";
import { getLevelStatus } from "../services/levelPresentation.js";
import { serializePublicProfile } from "../services/profilePresentation.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { person, personJson } from "./d1People.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

type ProgressionRow = {
  xp: number; level: number; wallet_balance: number; streak_count: number;
  last_daily_check_in_at: string | null; wealth_exp: number; charm_exp: number;
};

const event = "DAILY_CHECKIN";
const dayMs = 86_400_000;
const activeProfile = `${d1LiveUserFilter} AND u.deletion_requested_at IS NULL`;
const userProgress = `SELECT xp, level, wallet_balance, streak_count, last_daily_check_in_at, wealth_exp, charm_exp
  FROM users AS u WHERE ${activeProfile}`;
const eligibleLeaderboardUser = "u.is_blocked = 0 AND u.deletion_requested_at IS NULL";
const claimExists = "EXISTS (SELECT 1 FROM user_auth_profile WHERE source_id = ? AND edit_token = ?)";
const id = () => randomBytes(12).toString("hex");

function presentLevel(row: ProgressionRow) {
  return getLevelStatus({ xp: row.xp, lastDailyCheckInAt: row.last_daily_check_in_at ?? undefined });
}

async function checkIn(db: D1Database, claims: AccessClaims) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const now = new Date();
    const time = now.toISOString();
    const day = startOfUtcDay(now);
    const today = day.toISOString();
    const yesterday = new Date(day.getTime() - dayMs).toISOString();
    const actor = bindD1LiveUser(claims, time);
    const userId = claims.sub;
    const row = await db.prepare(userProgress).bind(...actor).first<ProgressionRow>();
    if (!row) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    if (row.last_daily_check_in_at && row.last_daily_check_in_at >= today) {
      return { alreadyClaimed: true, level: presentLevel(row), balance: row.wallet_balance, streak: row.streak_count };
    }

    const streak = (row.last_daily_check_in_at && row.last_daily_check_in_at >= yesterday ? row.streak_count : 0) + 1;
    const bonus = streakCoinBonuses[streak] ?? 0;
    const cosmetic = streakCosmeticRewards[streak];
    const token = id();
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, userId, token);
    const actionKey = `check-in:${userId}:${today}`;
    const grant = prepareD1XpGrant(write, claimExists, now, {
      userId, event, actionKey: `${actionKey}:xp`, requestedXp: xpEvents[event], xpAwarded: xpEvents[event],
      previousXp: row.xp, previousLevel: row.level, lastDailyCheckInAt: time, balanceBefore: row.wallet_balance + bonus
    });
    const statements = [
      db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, missing_fields, edit_token)
        SELECT u.source_id, '[]', '[]', ? FROM users AS u WHERE ${activeProfile} AND u.last_daily_check_in_at IS ?
          AND u.xp = ? AND u.level = ? AND u.wallet_balance = ? AND u.streak_count = ?
        ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token`)
        .bind(token, ...actor, row.last_daily_check_in_at, row.xp, row.level, row.wallet_balance, row.streak_count)
    ];
    if (bonus) statements.push(write(`INSERT INTO wallet_transactions
      (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
      SELECT ?, ?, 'CREDIT', 'STREAK_BONUS', ?, ?, ?, ?, ?, ?, ? WHERE ${claimExists}`,
    id(), userId, bonus, row.wallet_balance, row.wallet_balance + bonus,
    JSON.stringify({ streak, milestone: streak, idempotencyKey: `${actionKey}:streak` }), time, time, time));

    const cosmeticIndex = cosmetic ? statements.push(write(`INSERT INTO user_owned_cosmetics (source_id, value, users_id, position)
      SELECT ?, ?, ?, COALESCE((SELECT MAX(position) + 1 FROM user_owned_cosmetics WHERE users_id = ?), 0)
      WHERE NOT EXISTS (SELECT 1 FROM user_owned_cosmetics WHERE users_id = ? AND value = ?) AND ${claimExists}`,
    id(), cosmetic, userId, userId, userId, cosmetic)) - 1 : -1;
    const fields = {
      ...grant.columns, last_daily_check_in_at: time, streak_count: streak,
      wallet_balance: grant.xpGrant.walletBalance, updated_at: time
    };
    statements.push(...grant.statements, write(`UPDATE users SET ${Object.keys(fields).map(key => `${key} = ?`).join(", ")}
      WHERE source_id = ? AND ${claimExists}`, ...Object.values(fields), userId));
    if (grant.xpGrant.walletBalance !== row.wallet_balance) statements.push(write(`UPDATE user_auth_profile SET
      null_fields = (SELECT json_group_array(value) FROM json_each(null_fields) WHERE value <> 'walletBalance'),
      missing_fields = (SELECT json_group_array(value) FROM json_each(missing_fields) WHERE value <> 'walletBalance')
      WHERE source_id = ? AND ${claimExists}`, userId));

    const results = await db.batch(statements);
    if (!results[0].meta.changes) continue;
    return {
      schemaVersion: 1, alreadyClaimed: false, streak, unlockedCosmetic: results[cosmeticIndex]?.meta.changes ? cosmetic : undefined,
      streakBonus: bonus, nextMilestone: nextStreakMilestone(streak), balance: grant.xpGrant.walletBalance,
      xpGrant: grant.xpGrant, ...grant.xpGrant
    };
  }
  throw new HttpError(409, "Check-in changed. Please try again.", ErrorCode.CONFLICT);
}

export function createD1ProgressionRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");

  const rank = (userId: string, level: number, xp: number) => db.prepare(`SELECT COUNT(*) AS total FROM users AS u
    WHERE ${eligibleLeaderboardUser} AND u.source_id <> ?
      AND (u.level > ? OR (u.level = ? AND (u.xp > ? OR (u.xp = ? AND u.source_id < ?))))`)
    .bind(userId, level, level, xp, xp, userId);

  router.get("/users/me/level", asyncHandler(async (req, res) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const row = await db.prepare(userProgress).bind(...bindD1LiveUser(claims, new Date().toISOString())).first<ProgressionRow>();
    if (!row) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    sendOk(res, { schemaVersion: 1, level: presentLevel(row) });
  }));

  router.get("/users/me/level-overview", asyncHandler(async (req, res) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const now = new Date();
    const [user, caps, top] = await db.batch([
      db.prepare(userProgress).bind(...bindD1LiveUser(claims, now.toISOString())),
      db.prepare("SELECT event, SUM(amount) AS amount FROM xp_daily_caps WHERE user_id = ? AND day = ? GROUP BY event")
        .bind(claims.sub, startOfUtcDay(now).toISOString()),
      db.prepare(`SELECT ${personJson("u")} AS member, u.xp FROM users AS u WHERE ${eligibleLeaderboardUser}
        ORDER BY u.level DESC, u.xp DESC, u.source_id LIMIT 10`)
    ]);
    const row = user.results[0] as ProgressionRow | undefined;
    if (!row) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    const level = presentLevel(row);
    const ahead = await rank(claims.sub, level.level, level.xp).first<number>("total");
    const leaders = top.results as Array<{ member: string; xp: number }>;
    const leaderboard = leaders.map((entry, index) => {
      const member: Record<string, unknown> = person(entry.member);
      const { _id, name, username, avatar, avatarType, avatarParts, activeCosmetics } = member;
      const score = getLevelStatus({ xp: entry.xp });
      return { rank: index + 1, id: _id, name, username, avatar, avatarType, avatarParts, activeCosmetics,
        xp: score.xp, level: score.level, levelTitle: score.title };
    });
    sendOk(res, presentLevelOverview(level, row.streak_count, row.wealth_exp, row.charm_exp,
      caps.results as Array<{ event: string; amount: number }>, (ahead ?? 0) + 1, leaderboard));
  }));

  router.get(["/users/leaderboard/levels", "/leaderboard/levels"], asyncHandler(async (req, res) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    const page = Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, Number.parseInt(String(req.query.page ?? "1"), 10) || 1));
    const pageSize = Math.min(50, Math.max(1, Number.parseInt(String(req.query.pageSize ?? "25"), 10) || 25));
    const offset = Math.min(Number.MAX_SAFE_INTEGER, (page - 1) * pageSize);
    const row = await db.prepare(userProgress).bind(...bindD1LiveUser(claims, new Date().toISOString())).first<ProgressionRow>();
    if (!row) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    const [items, population, ahead] = await db.batch([
      db.prepare(`SELECT ${personJson("u")} AS member, u.followers_count FROM users AS u WHERE ${eligibleLeaderboardUser}
        ORDER BY u.level DESC, u.xp DESC, u.source_id LIMIT ? OFFSET ?`).bind(pageSize, offset),
      db.prepare(`SELECT COUNT(*) AS total FROM users AS u WHERE ${eligibleLeaderboardUser}`),
      rank(claims.sub, row.level, row.xp)
    ]);
    const ranked = (items.results as Array<{ member: string; followers_count: number }>).map((entry, index) => ({
      ...serializePublicProfile({ ...person(entry.member), followersCount: entry.followers_count }, false),
      rank: offset + index + 1
    }));
    sendOk(res, { users: ranked, leaderboard: ranked, page, pageSize, total: (population.results[0] as { total: number }).total,
      requesterId: claims.sub, requesterRank: (ahead.results[0] as { total: number }).total + 1 });
  }));

  router.post("/users/me/check-in", asyncHandler(async (req, res) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    sendOk(res, await checkIn(db, claims));
  }));
  return router;
}
