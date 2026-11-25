import { randomBytes } from "node:crypto";
import { getRelationshipStatus, relationshipStreak } from "../services/relationshipPresentation.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import type { D1GuardedStatement } from "./d1XpGrant.js";

const newId = () => randomBytes(12).toString("hex");

export type Relationship = { source_id: string; xp: number; level: number; streak_days: number; last_streak_at: string | null; last_interaction_at: string | null };
export type PairDailyTable = "relationship_message_xp_daily" | "relationship_room_dm_xp_daily" | "relationship_gift_xp_daily";

export function prepareRelationship(
  write: D1GuardedStatement, guard: string, previous: Relationship | undefined, amount: number,
  actors: [string, string], now: Date, pair: string, day: string, dailyTable: PairDailyTable
) {
  const prior = previous ? getRelationshipStatus({
    xp: previous.xp, level: previous.level, streakDays: previous.streak_days, lastInteractionAt: previous.last_interaction_at
  }) : undefined;
  if (!amount) return { status: prior, statements: [] };
  const time = now.toISOString();
  const id = previous?.source_id ?? newId();
  const xp = (previous?.xp ?? 0) + amount;
  if (!Number.isSafeInteger(xp)) throw new HttpError(409, "Relationship XP requires reconciliation", ErrorCode.CONFLICT);
  const streak = relationshipStreak(previous?.last_streak_at, previous?.streak_days ?? 0, now);
  const lastStreak = new Date(streak.lastStreakAt).toISOString();
  const status = getRelationshipStatus({ xp, level: previous?.level, streakDays: streak.streakDays, lastInteractionAt: time });
  const statements = [write(`INSERT INTO ${dailyTable} (pair_key, day, amount)
    SELECT ?, ?, ? WHERE ${guard} ON CONFLICT (pair_key, day)
    DO UPDATE SET amount = amount + excluded.amount`, pair, day, amount)];

  if (previous) {
    statements.push(write(`UPDATE relationships SET xp = ?, level = ?, level_title = ?, streak_days = ?,
      last_streak_at = ?, last_interaction_at = ?, updated_at = ? WHERE source_id = ? AND ${guard}`,
    xp, status.level, status.title, status.streakDays, lastStreak, time, time, id));
  } else {
    statements.push(
      write(`INSERT INTO relationships (source_id, pair_key, xp, level, level_title, streak_days, last_streak_at,
        last_interaction_at, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${guard}`,
      id, pair, xp, status.level, status.title, status.streakDays, lastStreak, time, time, time),
      ...pair.split(":").map((member, position) => write(`INSERT INTO relationship_users (source_id, value, relationships_id, position)
        SELECT ?, ?, ?, ? WHERE ${guard}`, `${id}:users:${position}`, member, id, position))
    );
  }

  const notices = [];
  if (status.level > (prior?.level ?? 1)) notices.push({
    title: "Relationship level up!", body: `Your bond reached Level ${status.level}: ${status.title}.`,
    data: { type: "RELATIONSHIP_LEVEL_UP", partnerIds: actors, level: status.level }
  });
  if (status.streakDays > 1 && status.streakDays % 7 === 0 && status.streakDays !== prior?.streakDays) notices.push({
    title: "Duo streak!", body: `You have a ${status.streakDays}-day relationship streak.`,
    data: { type: "RELATIONSHIP_STREAK", partnerIds: actors, streakDays: status.streakDays }
  });
  for (const notice of notices) for (const actor of actors) {
    statements.push(write(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
      SELECT ?, ?, 'SYSTEM', ?, ?, ?, 0, ?, ? WHERE ${guard}`,
    newId(), actor, notice.title, notice.body, JSON.stringify(notice.data), time, time));
  }
  return { status, statements };
}
