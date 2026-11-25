import type { D1Database } from "@cloudflare/workers-types";
import { createHash } from "node:crypto";
import { Router, type Response } from "express";
import { z } from "zod";
import { missionSeeds } from "../data/missionSeeds.js";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { clearProfileMarkers, newId } from "./d1Cosmetics.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

type MissionRow = {
  source_id: string; key: string; type: string; title: string; description: string;
  requirements_action: string; requirements_target: number; requirements_unit: string;
  rewards_xp: number; rewards_coins: number; rewards_diamonds: number;
  rewards_cosmetic_id: string | null; rewards_title_id: string | null;
  badge_icon: string | null; badge_color: string | null;
  season_id: string | null; start_date: string | null; end_date: string | null;
  active: number; created_at: string | null; updated_at: string | null;
};
type UserMissionRow = { source_id: string; user_id: string; mission_id: string; progress: number;
  completed: number; completed_at: string | null; claimed: number; streak_day: number };
type UserProgressRow = { mission_id: string; progress: number; completed: number; claimed: number };
type AccountRow = { xp: number; level: number; wallet_balance: number; last_daily_check_in_at: string | null };

const missionColumns = `source_id, key, type, title, description, requirements_action, requirements_target,
  requirements_unit, rewards_xp, rewards_coins, rewards_diamonds, rewards_cosmetic_id, rewards_title_id,
  badge_icon, badge_color, season_id, start_date, end_date, active, created_at, updated_at`;
const activeWindow = "(start_date IS NULL OR start_date <= ?) AND (end_date IS NULL OR end_date >= ?)";
const claimExists = "EXISTS (SELECT 1 FROM user_auth_profile WHERE source_id = ? AND edit_token = ?)";
const seedId = (key: string) => createHash("sha1").update(key).digest("hex").slice(0, 24);

const progressSchema = z.object({
  action: z.string().min(1),
  delta: z.number().int().min(1).default(1)
});
const claimSchema = z.object({ missionId: z.string().min(1) });

function presentMission(row: MissionRow, userMission?: UserProgressRow) {
  const badge = row.badge_icon || row.badge_color
    ? { ...(row.badge_icon ? { icon: row.badge_icon } : {}), ...(row.badge_color ? { color: row.badge_color } : {}) }
    : undefined;
  return {
    _id: row.source_id,
    key: row.key,
    type: row.type,
    title: row.title,
    description: row.description,
    requirements: { action: row.requirements_action, target: row.requirements_target, unit: row.requirements_unit },
    rewards: {
      xp: row.rewards_xp, coins: row.rewards_coins, diamonds: row.rewards_diamonds,
      ...(row.rewards_cosmetic_id ? { cosmeticId: row.rewards_cosmetic_id } : {}),
      ...(row.rewards_title_id ? { titleId: row.rewards_title_id } : {})
    },
    ...(badge ? { badge } : {}),
    ...(row.season_id ? { seasonId: row.season_id } : {}),
    ...(row.start_date ? { startDate: row.start_date } : {}),
    ...(row.end_date ? { endDate: row.end_date } : {}),
    active: Boolean(row.active),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    ...(userMission ? {
      progress: userMission.progress,
      completed: Boolean(userMission.completed),
      claimed: Boolean(userMission.claimed)
    } : {})
  };
}

/** The legacy missions route lazily inserts the catalog when no active mission exists. */
async function ensureMissionSeeds(db: D1Database) {
  const active = await db.prepare("SELECT COUNT(*) AS count FROM missions WHERE active = 1").first<{ count: number }>();
  if (active?.count) return;
  const time = new Date().toISOString();
  const statements = missionSeeds.map(seed => db.prepare(`INSERT OR IGNORE INTO missions
    (${missionColumns}) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
    .bind(seedId(seed.key), seed.key, seed.type, seed.title, seed.description,
      seed.requirements.action, seed.requirements.target, seed.requirements.unit,
      seed.rewards.xp, seed.rewards.coins, seed.rewards.diamonds, null, null,
      seed.badge?.icon ?? null, seed.badge?.color ?? null, null, null, null, time, time));
  if (statements.length) await db.batch(statements);
}

export function createD1MissionsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.session = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const userOf = (res: Response) => res.locals.session.user as { id: string };

  router.get("/missions", authenticate, asyncHandler(async (req, res) => {
    await ensureMissionSeeds(db);
    const type = req.query.type as string | undefined;
    const rows = await db.prepare(`SELECT ${missionColumns} FROM missions WHERE active = 1
      ORDER BY created_at, source_id`).all<MissionRow>();
    sendOk(res, { missions: rows.results.filter(row => !type || row.type === type).map(row => presentMission(row)) });
  }));

  router.get("/missions/active", authenticate, asyncHandler(async (req, res) => {
    await ensureMissionSeeds(db);
    const user = userOf(res);
    const now = new Date().toISOString();
    const [missions, progress] = await db.batch([
      db.prepare(`SELECT ${missionColumns} FROM missions WHERE active = 1 AND ${activeWindow}
        ORDER BY created_at, source_id`).bind(now, now),
      db.prepare("SELECT mission_id, progress, completed, claimed FROM user_missions WHERE user_id = ?")
        .bind(user.id)
    ]);
    const byMission = new Map((progress.results as UserProgressRow[]).map(row => [row.mission_id, row]));
    const attach = (type: string) => (missions.results as MissionRow[])
      .filter(row => row.type === type).map(row => presentMission(row,
        byMission.get(row.source_id) ?? { mission_id: row.source_id, progress: 0, completed: 0, claimed: 0 }));
    sendOk(res, {
      daily: attach("daily"), weekly: attach("weekly"), monthly: attach("monthly"), seasonal: attach("seasonal")
    });
  }));

  router.post("/missions/progress", authenticate, validateBody(progressSchema), asyncHandler(async (req, res) => {
    const user = userOf(res);
    const { action, delta } = req.body as z.infer<typeof progressSchema>;
    await ensureMissionSeeds(db);
    const now = new Date().toISOString();
    const rows = await db.prepare(`SELECT source_id, key, requirements_target AS target FROM missions
      WHERE active = 1 AND requirements_action = ? AND ${activeWindow}
      ORDER BY created_at, source_id`).bind(action, now, now)
      .all<{ source_id: string; key: string; target: number }>();
    const statements = rows.results.flatMap(row => [
      db.prepare(`INSERT INTO user_missions (source_id, user_id, mission_id, progress, completed, completed_at,
          claimed, streak_day, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, NULL, 0, 1, ?, ?)
        ON CONFLICT (user_id, mission_id) DO UPDATE SET
          progress = user_missions.progress + excluded.progress, updated_at = excluded.updated_at`)
        .bind(newId(), user.id, row.source_id, delta, now, now),
      db.prepare(`UPDATE user_missions SET completed = 1, completed_at = ?
        WHERE user_id = ? AND mission_id = ? AND progress >= ? AND completed = 0`)
        .bind(now, user.id, row.source_id, row.target)
    ]);
    if (statements.length) await db.batch(statements);
    const stored = await db.prepare("SELECT mission_id, progress, completed, claimed FROM user_missions WHERE user_id = ?")
      .bind(user.id).all<UserProgressRow>();
    const byMission = new Map(stored.results.map(row => [row.mission_id, row]));
    sendOk(res, {
      results: rows.results.map(row => {
        const current = byMission.get(row.source_id);
        const progress = Math.min(current?.progress ?? 0, row.target);
        return { missionId: row.source_id, key: row.key, completed: progress >= row.target,
          progress, target: row.target };
      })
    });
  }));

  router.post("/missions/claim", authenticate, validateBody(claimSchema), asyncHandler(async (req, res) => {
    const user = userOf(res);
    const { missionId } = req.body as z.infer<typeof claimSchema>;
    if (!isValidObjectId(missionId)) throw new HttpError(400, "Invalid mission ID", ErrorCode.VALIDATION);
    const id = missionId.toLowerCase();
    const [missionResult, userMissionResult, accountResult] = await db.batch([
      db.prepare(`SELECT ${missionColumns} FROM missions WHERE source_id = ?`).bind(id),
      db.prepare("SELECT * FROM user_missions WHERE user_id = ? AND mission_id = ?").bind(user.id, id),
      db.prepare("SELECT xp, level, wallet_balance, last_daily_check_in_at FROM users WHERE source_id = ?").bind(user.id)
    ]);
    const mission = missionResult.results[0] as MissionRow | undefined;
    const userMission = userMissionResult.results[0] as UserMissionRow | undefined;
    const account = accountResult.results[0] as AccountRow | undefined;
    if (!mission) throw new HttpError(404, "Mission not found", ErrorCode.NOT_FOUND);
    if (!userMission || !userMission.completed) throw new HttpError(409, "Mission not completed", ErrorCode.CONFLICT);
    if (userMission.claimed) throw new HttpError(409, "Mission already claimed", ErrorCode.CONFLICT);
    if (!account) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);

    const now = new Date();
    const time = now.toISOString();
    const xpKey = `mission:${user.id}:${id}`;
    const coinsKey = `${xpKey}:coins`;
    const existingGrant = await db.prepare(`SELECT source_id FROM xp_grants
      WHERE user_id = ? AND event = 'MISSION_REWARD' AND action_key = ?`).bind(user.id, xpKey).first();
    if (existingGrant) throw new HttpError(409, "Mission reward requires reconciliation", ErrorCode.CONFLICT);

    const token = newId();
    const claim = db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, missing_fields, edit_token)
      SELECT u.source_id, '[]', '[]', ? FROM users AS u
      WHERE u.source_id = ? AND EXISTS (SELECT 1 FROM user_missions
        WHERE source_id = ? AND user_id = ? AND completed = 1 AND claimed = 0)
      ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token`)
      .bind(token, user.id, userMission.source_id, user.id);
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, user.id, token);
    const coins = mission.rewards_coins;
    const grant = prepareD1XpGrant(write, claimExists, now, {
      userId: user.id, event: "MISSION_REWARD", actionKey: xpKey,
      requestedXp: mission.rewards_xp, xpAwarded: mission.rewards_xp,
      previousXp: account.xp, previousLevel: account.level,
      lastDailyCheckInAt: account.last_daily_check_in_at ?? undefined,
      balanceBefore: account.wallet_balance
    });
    const finalBalance = grant.xpGrant.walletBalance + coins;
    const fields: Record<string, number | string> = {
      ...grant.columns,
      ...(coins > 0 ? { wallet_balance: finalBalance } : {}),
      updated_at: time
    };
    const statements = [claim, ...grant.statements];
    if (coins > 0) statements.push(write(`INSERT INTO wallet_transactions
      (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
      SELECT ?, ?, 'CREDIT', 'MISSION_REWARD', ?, ?, ?, ?, ?, ?, ? WHERE ${claimExists}`,
    newId(), user.id, coins, grant.xpGrant.walletBalance, finalBalance,
    JSON.stringify({ missionId: id, idempotencyKey: coinsKey }), time, time, time));
    if (finalBalance !== account.wallet_balance) {
      statements.push(clearProfileMarkers(db, user.id, ["walletBalance"], claimExists, user.id, token));
    }
    statements.push(write(`UPDATE users SET ${Object.keys(fields).map(key => `${key} = ?`).join(", ")}
      WHERE source_id = ? AND ${claimExists}`, ...Object.values(fields), user.id));
    statements.push(write(`UPDATE user_missions SET claimed = 1, updated_at = ?
      WHERE source_id = ? AND user_id = ? AND ${claimExists}`, time, userMission.source_id, user.id));

    const results = await db.batch(statements);
    if (!results[0]!.meta.changes) {
      const latest = await db.prepare("SELECT completed, claimed FROM user_missions WHERE user_id = ? AND mission_id = ?")
        .bind(user.id, id).first<{ completed: number; claimed: number }>();
      if (!latest || !latest.completed) throw new HttpError(409, "Mission not completed", ErrorCode.CONFLICT);
      if (latest.claimed) throw new HttpError(409, "Mission already claimed", ErrorCode.CONFLICT);
      throw new HttpError(409, "Mission changed. Please try again.", ErrorCode.CONFLICT);
    }
    const rewards: { xp?: number; coins?: number } = {};
    if (mission.rewards_xp > 0) rewards.xp = mission.rewards_xp;
    if (coins > 0) rewards.coins = coins;
    sendOk(res, { missionId: id, key: mission.key, rewards });
  }));

  return router;
}
