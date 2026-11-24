import type { D1Database } from "@cloudflare/workers-types";
import { xpEvents } from "@yugm/shared";
import { ErrorCode, HttpError } from "../utils/http.js";
import type { ProfileRow } from "./d1ProfileReads.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

export const profileEditClaim = "EXISTS (SELECT 1 FROM user_auth_profile WHERE source_id = ? AND edit_token = ?)";
export type ProfileStatement = D1GuardedStatement;

const event = "PROFILE_COMPLETE";
const xpAwarded = xpEvents[event];

/** All returned writes depend on the profile edit claim in the same D1 batch. */
export async function prepareD1ProfileCompletion(db: D1Database, row: ProfileRow, now: Date, write: ProfileStatement) {
  const userId = row.source_id;
  const actionKey = `profile-complete:${userId}`;
  const existing = await db.prepare("SELECT status, receipt FROM xp_grants WHERE user_id = ? AND event = ? AND action_key = ?")
    .bind(userId, event, actionKey).first<{ status: string; receipt: string | null }>();
  if (existing) {
    if (existing.status !== "COMPLETE" || !existing.receipt) {
      throw new HttpError(409, "Profile completion reward requires reconciliation", ErrorCode.CONFLICT);
    }
    const xpGrant: Record<string, unknown> = { ...JSON.parse(existing.receipt), duplicate: true };
    return { xpGrant, columns: {}, statements: [] };
  }

  return prepareD1XpGrant(write, profileEditClaim, now, {
    userId, event, actionKey, requestedXp: xpAwarded, xpAwarded, previousXp: row.xp, previousLevel: row.stored_level,
    lastDailyCheckInAt: typeof row.last_daily_check_in_at === "string" ? row.last_daily_check_in_at : undefined,
    balanceBefore: row.wallet_balance ?? 0
  });
}
