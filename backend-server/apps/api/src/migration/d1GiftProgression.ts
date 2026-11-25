import { randomBytes } from "node:crypto";
import { xpDailyCaps, xpEvents } from "@yugm/shared";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

export type GiftXpEvent = "GIFT_SENT" | "GIFT_RECEIVED";
export interface GiftXpActor {
  source_id: string;
  xp: number;
  level: number;
  wallet_balance: number;
  last_daily_check_in_at: string | null;
  earned: number;
}

export const giftEarnedXp = (user: string) => `SELECT COALESCE(SUM(amount), 0) FROM xp_daily_caps
  WHERE user_id = ${user} AND event = ? AND day = ?`;

export function prepareGiftXp(write: D1GuardedStatement, guard: string, now: Date, day: string,
  actionKey: string, event: GiftXpEvent, actor: GiftXpActor, balanceBefore: number) {
  const time = now.toISOString();
  const cap = xpDailyCaps[event]!;
  const award = xpEvents[event];
  const xpAwarded = Math.min(award, Math.max(0, cap - actor.earned));
  const earnedToday = actor.earned + xpAwarded;
  const progress = prepareD1XpGrant(write, guard, now, {
    userId: actor.source_id, event, actionKey, requestedXp: award, xpAwarded,
    previousXp: actor.xp, previousLevel: actor.level, balanceBefore,
    lastDailyCheckInAt: actor.last_daily_check_in_at ?? undefined,
    cap: { capped: earnedToday >= cap, cap, earnedToday, remainingToday: Math.max(0, cap - earnedToday) }
  });
  if (xpAwarded > 0) {
    progress.statements.push(
      write(`UPDATE xp_daily_caps SET amount = amount + ?, updated_at = ? WHERE source_id = (
        SELECT source_id FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ? ORDER BY source_id LIMIT 1
      ) AND ${guard}`, xpAwarded, time, actor.source_id, event, day),
      write(`INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ?)
        AND ${guard}`, randomBytes(12).toString("hex"), actor.source_id, event, day, xpAwarded, time, time, actor.source_id, event, day)
    );
  }
  return progress;
}
