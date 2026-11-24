import { randomBytes } from "node:crypto";
import type { D1PreparedStatement } from "@cloudflare/workers-types";
import type { XpEvent } from "@yugm/shared";
import { defaultSeason, monthlySeasonWindow } from "../models/Season.js";
import { getLevelPromotion, getLevelStatus } from "../services/levelPresentation.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export type D1GuardedStatement = (sql: string, ...values: Array<string | number | null>) => D1PreparedStatement;

interface GrantInput {
  userId: string;
  event: XpEvent;
  actionKey: string;
  requestedXp: number;
  xpAwarded: number;
  previousXp: number;
  previousLevel: number;
  lastDailyCheckInAt?: string;
  balanceBefore: number;
  cap?: { capped: boolean; cap: number; earnedToday: number; remainingToday: number };
}

const activeSeason = `SELECT source_id, name, end_date, max_level FROM seasons
  WHERE active = 1 AND start_date <= ? AND end_date > ? ORDER BY start_date DESC LIMIT 1`;
const defaultRewards = JSON.stringify(defaultSeason.rewards);
const newId = () => randomBytes(12).toString("hex");

function battlePassStatements(write: D1GuardedStatement, guard: string, userId: string, actionKey: string,
  event: XpEvent, xpAwarded: number, now: Date
) {
  const time = now.toISOString();
  const seasonId = newId();
  const passId = newId();
  const grantId = newId();
  const window = monthlySeasonWindow(now);

  return [
    write(`UPDATE seasons SET active = 0, updated_at = ?
      WHERE active = 1 AND NOT EXISTS (${activeSeason}) AND ${guard}`, time, time, time),
    write(`INSERT INTO seasons (source_id, key, name, description, start_date, end_date, max_level, xp_per_level,
        premium_price, active, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ? WHERE NOT EXISTS (${activeSeason}) AND ${guard}
      ON CONFLICT (key) DO UPDATE SET active = 1, name = excluded.name, start_date = excluded.start_date,
        end_date = excluded.end_date, updated_at = excluded.updated_at`,
    seasonId, window.key, window.name, defaultSeason.description, window.startDate.toISOString(), window.endDate.toISOString(),
    defaultSeason.maxLevel, defaultSeason.xpPerLevel, defaultSeason.premiumPrice, time, time, time, time),
    write(`INSERT INTO season_rewards (source_id, level, free_reward, premium_reward, seasons_id, position)
      SELECT ? || ':rewards:' || reward.key, json_extract(reward.value, '$.level'),
        json_extract(reward.value, '$.freeReward'), json_extract(reward.value, '$.premiumReward'), ?, reward.key
      FROM json_each(?) AS reward WHERE EXISTS (SELECT 1 FROM seasons WHERE source_id = ?) AND ${guard}`,
    seasonId, seasonId, defaultRewards, seasonId),
    write(`INSERT INTO battle_passes (source_id, season_id, season_name, user_id, tier, level, xp, premium, expires_at, created_at, updated_at)
      SELECT ?, s.source_id, s.name, ?, 'free', 1, 0, 0, s.end_date, ?, ? FROM (${activeSeason}) AS s
      WHERE ${guard} ON CONFLICT (user_id, season_id) DO NOTHING`, passId, userId, time, time, time, time),
    write(`INSERT INTO battle_pass_rewards (source_id, level, claimed, free_claimed, premium_claimed, battle_passes_id, position)
      SELECT p.source_id || ':rewards:' || r.position, r.level, 0, 0, 0, p.source_id, r.position
      FROM battle_passes AS p JOIN season_rewards AS r ON r.seasons_id = p.season_id
      WHERE p.source_id = ? AND ${guard}`, passId),
    write(`INSERT INTO battle_pass_xp_grants (source_id, user_id, season_id, action_key, xp_gained, created_at, updated_at)
      SELECT ?, p.user_id, p.season_id, ?, ?, ?, ? FROM battle_passes AS p
      JOIN (${activeSeason}) AS s ON s.source_id = p.season_id
      WHERE p.user_id = ? AND p.level < s.max_level AND ${guard}
      ON CONFLICT (user_id, season_id, action_key) DO NOTHING`, grantId, `${event}:${actionKey}`, xpAwarded, time, time, time, time, userId),
    write(`WITH progress AS (
        SELECT p.source_id, MIN(s.max_level, p.level + (MAX(0, p.xp) + g.xp_gained) / s.xp_per_level) AS next_level,
          (MAX(0, p.xp) + g.xp_gained) % s.xp_per_level AS remaining_xp, s.max_level
        FROM battle_pass_xp_grants AS g JOIN battle_passes AS p ON p.user_id = g.user_id AND p.season_id = g.season_id
        JOIN seasons AS s ON s.source_id = g.season_id WHERE g.source_id = ?
      )
      UPDATE battle_passes SET (level, xp, updated_at) = (
        SELECT next_level, CASE WHEN next_level = max_level THEN 0 ELSE remaining_xp END, ? FROM progress
      ) WHERE source_id = (SELECT source_id FROM progress) AND ${guard}`, grantId, time)
  ];
}

/** Stage XP and its progression effects under the caller's in-batch operation claim. */
export function prepareD1XpGrant(write: D1GuardedStatement, guard: string, now: Date, input: GrantInput) {
  const { userId, event, actionKey, requestedXp, xpAwarded, previousXp, previousLevel,
    lastDailyCheckInAt, balanceBefore, cap } = input;
  const time = now.toISOString();
  const xp = previousXp + xpAwarded;
  if (!Number.isSafeInteger(xp)) throw new HttpError(409, "XP requires reconciliation", ErrorCode.CONFLICT);
  const level = getLevelStatus({ xp, lastDailyCheckInAt: lastDailyCheckInAt });
  const { levelUpReward, levelsGained } = getLevelPromotion(previousLevel, xpAwarded > 0 ? level.level : previousLevel);
  const levelUp = levelsGained.length > 0;
  const walletBalance = balanceBefore + levelUpReward;
  if (!Number.isSafeInteger(walletBalance)) throw new HttpError(409, "Coin balance limit reached", ErrorCode.CONFLICT);

  const xpGrant = { event, xpAwarded, capped: false, ...cap, levelUpReward, levelsGained, levelUp, level, walletBalance };
  const columns = {
    ...(xpAwarded > 0 ? { xp } : {}),
    ...(levelUp ? { level: level.level, level_title: level.title } : {}),
    ...(levelUpReward > 0 ? { wallet_balance: walletBalance } : {})
  };
  const statements = [write(`INSERT INTO xp_grants (source_id, user_id, event, action_key, status, requested_xp, receipt, created_at, updated_at)
    SELECT ?, ?, ?, ?, 'COMPLETE', ?, ?, ?, ? WHERE ${guard}`,
  newId(), userId, event, actionKey, requestedXp, JSON.stringify(xpGrant), time, time)];
  if (levelUpReward > 0) {
    statements.push(write(`INSERT INTO wallet_transactions
      (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, credited_at, created_at, updated_at)
      SELECT ?, ?, 'CREDIT', 'LEVEL_REWARD', ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`,
    newId(), userId, levelUpReward, balanceBefore, walletBalance,
    JSON.stringify({ event, levels: levelsGained, idempotencyKey: actionKey }), time, time, time));
  }
  if (levelUp) {
    statements.push(write(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
      SELECT ?, ?, 'SYSTEM', 'Level up!', ?, ?, 0, ?, ? WHERE ${guard}`,
    newId(), userId, `You reached Level ${level.level}: ${level.title}.`,
    JSON.stringify({ type: "LEVEL_UP", level: level.level, reward: levelUpReward }), time, time));
  }
  if (xpAwarded > 0) statements.push(...battlePassStatements(write, guard, userId, actionKey, event, xpAwarded, now));
  return { xpGrant, columns, statements };
}
