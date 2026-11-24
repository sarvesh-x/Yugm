import type { D1Database } from "@cloudflare/workers-types";
import type { UserRole } from "@yugm/shared";
import type { AccessAccount, ReadAccessContext } from "../services/accessSession.js";

type D1AccessAccount = AccessAccount & { id: string; role: UserRole };

interface AccessRow {
  source_id: string;
  role: UserRole;
  is_blocked: number;
  moderation_reason: string | null;
  suspended_until: string | null;
  account_version: number;
  session_id: string | null;
  session_version: number | null;
  session_version_present: number | null;
}

export function createD1AccessSessionReader(db: D1Database, surface: "http" | "socket"): ReadAccessContext<D1AccessAccount> {
  return async ({ sub, sid }) => {
    // Direct binding reads use the primary. Read the account and active
    // session together so they both reflect the same database state.
    const row = await db.prepare(`
      SELECT u.source_id, u.role, u.is_blocked, u.moderation_reason, u.suspended_until,
             u.token_version AS account_version, s.source_id AS session_id,
             s.token_version AS session_version, s.token_version_present AS session_version_present
      FROM users AS u
      LEFT JOIN auth_sessions AS s ON s.source_id = ? AND s.user_id = u.source_id
        AND s.revoked_at IS NULL AND s.expires_at > ?
      WHERE u.source_id = ?
    `).bind(sid, new Date().toISOString(), sub).first<AccessRow>();
    if (!row) return { user: null, session: null };

    // Mongo HTTP auth hydrates omitted fields to zero. Socket.IO uses a lean
    // read, where an omitted generation takes the JWT generation fallback.
    const tokenVersion = surface === "http" && row.session_version_present === 0 ? 0 : row.session_version;
    return {
      user: {
        id: row.source_id,
        role: row.role,
        tokenVersion: row.account_version,
        isBlocked: Boolean(row.is_blocked),
        moderationReason: row.moderation_reason ?? undefined,
        suspendedUntil: row.suspended_until ? new Date(row.suspended_until) : undefined
      },
      session: row.session_id ? { tokenVersion } : null
    };
  };
}
