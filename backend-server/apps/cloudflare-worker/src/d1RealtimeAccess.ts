import type { D1Database } from "@cloudflare/workers-types";
import { createD1AccessSessionReader } from "../../api/src/migration/d1AccessSession.js";
import { matchesAccessGeneration, type AccessClaims } from "../../api/src/services/accessGeneration.js";

export async function canReceiveRealtime(db: D1Database, auth: AccessClaims, scope: string) {
  if (auth.expiresAt !== undefined && auth.expiresAt <= Date.now()) return false;
  const { user, session } = await createD1AccessSessionReader(db, "socket")(auth);
  if (!user || !session || user.isBlocked || (user.suspendedUntil && user.suspendedUntil.getTime() > Date.now()) ||
      !matchesAccessGeneration(auth, user, session)) return false;
  if (scope === `user:${user.id}`) return true;
  if (!scope.startsWith("room:")) return false;
  return Boolean(await db.prepare(`SELECT 1 FROM rooms r JOIN room_participants p ON p.room_id = r.source_id
    WHERE r.source_id = ? AND r.status = 'LIVE' AND p.user_id = ? AND p.left_at IS NULL LIMIT 1`)
    .bind(scope.slice(5), user.id).first());
}
