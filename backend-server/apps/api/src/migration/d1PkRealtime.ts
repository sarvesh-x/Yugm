import type { D1Database } from "@cloudflare/workers-types";
import type { DeliveryClass } from "@yugm/shared";
import { emitD1Realtime, type D1RealtimePort } from "./d1Realtime.js";
import { pkBattleJoins, pkBattleProjection, presentPkBattle, type BattleRow } from "./d1RoomPkHistory.js";

export type D1PkState = ReturnType<typeof presentPkBattle>;
type ScopedState = { left: { roomId: string }; right: { roomId: string } };

export async function readD1PkRealtimeState(db: D1Database, battleId: string) {
  return db.prepare(`SELECT ${pkBattleProjection}
    FROM pk_battles AS b ${pkBattleJoins} WHERE b.source_id = ? LIMIT 1`)
    .bind(battleId).first<BattleRow>();
}

function roomScopes(state: ScopedState) {
  return [`room:${state.left.roomId}`, `room:${state.right.roomId}`];
}

async function publishState(realtime: D1RealtimePort, state: D1PkState, event: string,
  data: unknown, extraScopes: string[], delivery: DeliveryClass) {
  const scopes = [...new Set([...roomScopes(state), ...extraScopes])];
  await Promise.all(scopes.map(scope => emitD1Realtime(realtime, {
    event, scope, delivery, data
  })));
}

/** Publishes an already-loaded authoritative state after a guarded commit. */
export async function emitD1PkBattleState(realtime: D1RealtimePort, state: D1PkState,
  event: string, data: unknown = state, extraScopes: string[] = [],
  delivery: DeliveryClass = "durable") {
  await publishState(realtime, state, event, data, extraScopes, delivery);
}

/** Re-reads committed state, then fans it out to both PK rooms. */
export async function emitD1PkBattleEvent(db: D1Database, realtime: D1RealtimePort, battleId: string,
  event: string, data?: unknown, extraScopes: string[] = [],
  delivery: DeliveryClass = "durable") {
  const row = await readD1PkRealtimeState(db, battleId);
  if (!row) return;
  const state = presentPkBattle(row);
  await publishState(realtime, state, event, data === undefined ? state : data, extraScopes, delivery);
}
