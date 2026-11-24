import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import type { AccessClaims } from "../services/accessSession.js";
import type { ModerationResult } from "../services/contentModeration.js";
import { bindD1LiveUser, d1LiveUserFilter } from "./d1AccessSession.js";

export const chatRestricted = `EXISTS (SELECT 1 FROM user_safety_statuses
  WHERE user_id = u.source_id AND is_chat_restricted = 1)`;

export async function recordD1ChatModeration(
  db: D1Database, claims: AccessClaims, time: string, result: ModerationResult
) {
  const actor = [...bindD1LiveUser(claims, time), time];
  const eligible = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}
    AND u.deletion_requested_at IS NULL AND (u.muted_until IS NULL OR u.muted_until <= ?) AND NOT ${chatRestricted})`;
  const status = `(SELECT source_id FROM user_safety_statuses WHERE user_id = ? ORDER BY source_id LIMIT 1)`;
  const block = result.action === "BLOCK" ? 1 : 0;
  const trustScore = "CASE WHEN warning_count >= 7 AND is_shadow_banned = 0 THEN MAX(0, trust_score - 30) ELSE trust_score END";
  await db.batch([
    db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level, warning_count,
        report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted, is_wallet_frozen, created_at, updated_at)
      SELECT ?, ?, 100, 'LOW', 0, 0, 0, 0, 0, 0, 0, ?, ? WHERE ${status} IS NULL AND ${eligible}`)
      .bind(randomBytes(12).toString("hex"), claims.sub, time, time, claims.sub, ...actor),
    db.prepare(`INSERT INTO moderation_actions (source_id, target_user_id, action, reason, duration_hours, automated, created_at)
      SELECT ?, user_id, 'MUTE', ?, CASE WHEN warning_count >= 4 THEN 48 ELSE 24 END, 1, ?
      FROM user_safety_statuses WHERE source_id = ${status} AND (? = 1 OR warning_count >= 2) AND ${eligible}`)
      .bind(randomBytes(12).toString("hex"), "Auto-moderation: " + result.flaggedWords.join(", "), time, claims.sub, block, ...actor),
    db.prepare(`UPDATE users SET moderation_strikes = moderation_strikes + 1,
        moderation_reason = 'Shadow banned: repeated moderation violations'
      WHERE source_id = ? AND ${eligible} AND EXISTS (
        SELECT 1 FROM user_safety_statuses WHERE source_id = ${status} AND warning_count >= 7 AND is_shadow_banned = 0
      )`).bind(claims.sub, ...actor, claims.sub),
    db.prepare(`UPDATE user_safety_statuses SET warning_count = warning_count + 1, report_count = report_count + 1,
        is_chat_restricted = MAX(is_chat_restricted, ? = 1 OR warning_count >= 2),
        is_room_restricted = MAX(is_room_restricted, warning_count >= 4),
        is_shadow_banned = MAX(is_shadow_banned, warning_count >= 7),
        trust_score = ${trustScore},
        risk_level = CASE WHEN (${trustScore}) >= 80 THEN 'LOW' WHEN (${trustScore}) >= 50 THEN 'MEDIUM'
          WHEN (${trustScore}) >= 20 THEN 'HIGH' ELSE 'CRITICAL' END, updated_at = ?
      WHERE source_id = ${status} AND ${eligible}`).bind(block, time, claims.sub, ...actor)
  ]);
}
