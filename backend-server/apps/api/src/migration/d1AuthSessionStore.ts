import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import type { AuthSessionAccount, AuthSessionStore } from "../services/authSessionStore.js";

interface SessionRow {
  source_id: string;
  user_id: string;
  family_id: string;
  token_version: number | null;
  token_version_present: number;
  expires_at: string;
  revoked_at: string | null;
  replaced_by_hash: string | null;
}

const sessionColumns = `source_id, user_id, family_id, refresh_hash,
  token_version, token_version_present, expires_at, last_used_at, ip, user_agent, created_at, updated_at`;
const advanceGeneration = `UPDATE users SET token_version = token_version + 1, updated_at = ? WHERE source_id = ?`;
const revokeAccountSessions = `UPDATE auth_sessions SET revoked_at = ?, updated_at = ? WHERE user_id = ? AND revoked_at IS NULL`;

export function createD1AuthSessionStore(db: Pick<D1Database, "batch" | "prepare">): AuthSessionStore {
  return {
    async findAccount(userId) {
      const row = await db.prepare(
        "SELECT role, token_version, is_blocked FROM users WHERE source_id = ?"
      ).bind(userId).first<{ role: AuthSessionAccount["role"]; token_version: number; is_blocked: number }>();
      return row && { id: userId, role: row.role, tokenVersion: row.token_version, isBlocked: Boolean(row.is_blocked) };
    },

    async findRefreshSession(refreshHash) {
      const row = await db.prepare(`
        SELECT source_id, user_id, family_id, token_version, token_version_present, expires_at, revoked_at, replaced_by_hash
        FROM auth_sessions WHERE refresh_hash = ?
      `).bind(refreshHash).first<SessionRow>();
      if (!row) return null;
      return {
        id: row.source_id, userId: row.user_id, familyId: row.family_id,
        // Mongo's hydrated model applies a default of 0 to omitted fields, but retains explicit null.
        tokenVersion: row.token_version_present ? row.token_version ?? undefined : 0,
        expiresAt: new Date(row.expires_at),
        revokedAt: row.revoked_at ? new Date(row.revoked_at) : null,
        replacedByHash: row.replaced_by_hash
      };
    },

    async issue(userId, familyId, next, now) {
      const id = randomBytes(12).toString("hex");
      const ts = now.toISOString();
      const [account] = await db.batch<{ token_version: number }>([
        db.prepare(`${advanceGeneration} RETURNING token_version`).bind(ts, userId),
        db.prepare(`${revokeAccountSessions}
          AND (token_version_present = 0 OR token_version < (SELECT token_version FROM users WHERE source_id = ?))
        `).bind(ts, ts, userId, userId),
        db.prepare(`
          INSERT INTO auth_sessions (${sessionColumns})
          SELECT ?, source_id, ?, ?, token_version, 1, ?, ?, ?, ?, ?, ?
          FROM users WHERE source_id = ?
        `).bind(id, familyId, next.refreshHash, next.expiresAt.toISOString(), ts,
          next.ip ?? null, next.userAgent ?? null, ts, ts, userId)
      ]);
      const user = account.results[0];
      return user ? { id, tokenVersion: user.token_version } : null;
    },

    async rotate(old, tokenVersion, replacement, now) {
      const id = randomBytes(12).toString("hex");
      const ts = now.toISOString();
      // Claim and create in one transaction so replay cannot revoke an empty family
      // between those writes. A failed insert also rolls back the claim.
      const [claim] = await db.batch([
        db.prepare(`
          UPDATE auth_sessions SET revoked_at = ?, replaced_by_hash = ?, last_used_at = ?, updated_at = ?
          WHERE source_id = ? AND revoked_at IS NULL AND replaced_by_hash IS NULL AND expires_at > ?
        `).bind(ts, replacement.refreshHash, ts, ts, old.id, ts),
        db.prepare(`
          INSERT INTO auth_sessions (${sessionColumns})
          SELECT ?, user_id, family_id, ?, ?, 1, ?, ?, ?, ?, ?, ?
          FROM auth_sessions WHERE source_id = ? AND replaced_by_hash = ?
        `).bind(id, replacement.refreshHash, tokenVersion, replacement.expiresAt.toISOString(), ts,
          replacement.ip ?? null, replacement.userAgent ?? null, ts, ts, old.id, replacement.refreshHash)
      ]);
      return claim.meta.changes === 1 ? id : null;
    },

    async revokeById(sessionId, now) {
      const ts = now.toISOString();
      await db.prepare(`
        UPDATE auth_sessions SET revoked_at = ?, updated_at = ? WHERE source_id = ? AND revoked_at IS NULL
      `).bind(ts, ts, sessionId).run();
    },

    async revokeFamily(familyId, now) {
      const ts = now.toISOString();
      await db.prepare(`
        UPDATE auth_sessions SET revoked_at = ?, updated_at = ? WHERE family_id = ? AND revoked_at IS NULL
      `).bind(ts, ts, familyId).run();
    },

    async revokeAll(userId, now) {
      const ts = now.toISOString();
      await db.prepare(revokeAccountSessions).bind(ts, ts, userId).run();
    },

    async logout(userId, _refreshHash, now, deviceToken) {
      const ts = now.toISOString();
      await db.batch([
        ...(deviceToken ? [db.prepare("DELETE FROM device_tokens WHERE user_id = ? AND token = ?").bind(userId, deviceToken)] : []),
        db.prepare(advanceGeneration).bind(ts, userId),
        db.prepare(revokeAccountSessions).bind(ts, ts, userId)
      ]);
    }
  };
}
