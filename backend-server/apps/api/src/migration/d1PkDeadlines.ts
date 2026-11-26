import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import type { DeliveryClass } from "@yugm/shared";
import { emitD1PkBattleEvent } from "./d1PkRealtime.js";
import { emitD1Realtime, noD1Realtime, type D1RealtimePort } from "./d1Realtime.js";

type Row = Record<string, string | number | null>;

function newId() {
  return randomBytes(12).toString("hex");
}

type DeadlineBattleRow = Row & {
  source_id: string;
  status: string;
  state_version: number;
  event_sequence: number;
  duration_seconds: number;
  left_score: number;
  right_score: number;
  left_host_id: string;
  right_host_id: string;
  left_room_id: string;
  right_room_id: string;
};
type EventOptions = { roomId?: string; userId?: string; side?: string; points?: number; metadata?: Record<string, unknown> };

const activeStatuses = ["ACTIVE", "FINAL_CRUNCH", "FINALIZING"];
const closableStatuses = ["COMPLETED", "ABORTED", "CANCELLED", "DECLINED", "EXPIRED", "ENDED", "FORCE_ENDED"];
const tickMs = 5_000;
const readyGraceMs = 2_000;
const closeGraceMs = 60_000;

const battleFields = `source_id, status, state_version, event_sequence, duration_seconds, started_at,
  countdown_ends_at, left_score, right_score, left_host_id, right_host_id, left_room_id, right_room_id`;

function remainingSeconds(battle: DeadlineBattleRow, now: Date) {
  if (!battle.started_at) return Number(battle.duration_seconds);
  const elapsed = Math.floor((now.getTime() - Date.parse(String(battle.started_at))) / 1000);
  return Math.max(0, Number(battle.duration_seconds) - elapsed);
}

function winnerSide(battle: DeadlineBattleRow) {
  if (Number(battle.left_score) > Number(battle.right_score)) return "LEFT";
  if (Number(battle.right_score) > Number(battle.left_score)) return "RIGHT";
  return "DRAW";
}

function readBattle(db: D1Database, battleId: string) {
  return db.prepare(`SELECT ${battleFields} FROM pk_battles WHERE source_id = ?`).bind(battleId).first<DeadlineBattleRow>();
}

type BattlePublisher = (battleId: string, event: string, data?: unknown,
  extraScopes?: string[], delivery?: DeliveryClass) => Promise<void>;

function battlePublisher(db: D1Database, realtime: D1RealtimePort): BattlePublisher {
  // Delivery is best effort and only called after the guarded transition commits.
  return (battleId, event, data, extraScopes = [], delivery = "durable") =>
    emitD1PkBattleEvent(db, realtime, battleId, event, data, extraScopes, delivery);
}

function releaseRoomLocks(db: D1Database, battle: DeadlineBattleRow, time: string) {
  return db.prepare("UPDATE rooms SET active_pk_id = NULL, updated_at = ? WHERE source_id IN (?, ?) AND active_pk_id = ?")
    .bind(time, battle.left_room_id, battle.right_room_id, battle.source_id);
}

function guardedEvent(db: D1Database, battleId: string, eventType: string, expectedStatus: string,
  version: number, sequence: number, time: string, options: EventOptions = {}) {
  return db.prepare(`INSERT INTO pk_events (source_id, battle_id, room_id, user_id, event_type, side, points,
      state_version, sequence, gift_transaction_id, metadata, created_at, updated_at)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, ? FROM pk_battles
    WHERE source_id = ? AND status = ? AND state_version = ? AND event_sequence = ?
      AND NOT EXISTS (SELECT 1 FROM pk_events WHERE battle_id = ? AND event_type = ? AND sequence = ?)`)
    .bind(newId(), battleId, options.roomId ?? null, options.userId ?? null, eventType, options.side ?? null,
      options.points ?? 0, version, sequence, JSON.stringify(options.metadata ?? {}), time, time,
      battleId, expectedStatus, version, sequence, battleId, eventType, sequence);
}

async function transitionBattle(db: D1Database, battle: DeadlineBattleRow, fromStatuses: string[], toStatus: string,
  time: string, eventType: string, assignments = "", assignmentParams: Array<string | number | null> = [],
  eventOptions: EventOptions = {}, extraStatements: Array<ReturnType<D1Database["prepare"]>> = []) {
  const version = Number(battle.state_version) + 1;
  const sequence = Number(battle.event_sequence) + 1;
  const statusGuard = fromStatuses.length === 1 ? "status = ?" : `status IN (${fromStatuses.map(() => "?").join(", ")})`;
  const setClause = ["status = ?", assignments, "state_version = state_version + 1", "event_sequence = event_sequence + 1", "updated_at = ?"]
    .filter(Boolean).join(", ");
  try {
    const committed = await db.batch([
      db.prepare(`UPDATE pk_battles SET ${setClause} WHERE source_id = ? AND ${statusGuard}`)
        .bind(toStatus, ...assignmentParams, time, battle.source_id, ...fromStatuses),
      guardedEvent(db, battle.source_id, eventType, toStatus, version, sequence, time, eventOptions),
      ...extraStatements
    ]);
    return Boolean(committed[0]?.meta?.changes);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`D1 PK transition ${battle.source_id} ${fromStatuses.join("/")} -> ${toStatus} (${eventType}) failed: ${detail}`);
  }
}

async function expireInvite(db: D1Database, invite: Row, time: string, publish: BattlePublisher,
  realtime: D1RealtimePort) {
  const battleId = String(invite.battle_id);
  const inviteId = String(invite.source_id);
  const battle = await readBattle(db, battleId);
  if (!battle) return false;
  const roomIds = [String(invite.inviter_room_id), String(invite.invitee_room_id)];
  const roomPlaceholders = roomIds.map((_, index) => `?${index + 1}`).join(", ");
  const roomTimeParam = roomIds.length + 1;
  const roomBattleParam = roomIds.length + 2;
  const version = Number(battle.state_version) + 1;
  const sequence = Number(battle.event_sequence) + 1;
  try {
    const committed = await db.batch([
      db.prepare(`UPDATE pk_invites SET status = 'EXPIRED', responded_at = ?, updated_at = ?
        WHERE source_id = ? AND status = 'PENDING' AND expires_at <= ?
          AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'INVITED')`)
        .bind(time, time, inviteId, time, battleId),
      db.prepare(`UPDATE pk_battles SET status = 'EXPIRED', ended_at = ?, updated_at = ?,
        state_version = state_version + 1, event_sequence = event_sequence + 1
        WHERE source_id = ? AND status = 'INVITED'`).bind(time, time, battleId),
      db.prepare(`UPDATE rooms SET active_pk_id = NULL, updated_at = ?${roomTimeParam}
        WHERE source_id IN (${roomPlaceholders}) AND active_pk_id = ?${roomBattleParam}`)
        .bind(...roomIds, time, battleId),
      guardedEvent(db, battleId, "PK_INVITE_EXPIRED", "EXPIRED", version, sequence, time,
        { userId: String(invite.invitee_user_id) })
    ]);
    const expired = Boolean(committed[1]?.meta?.changes);
    if (expired) {
      const payload = { battleId, inviteId };
      await publish(battleId, "pk:ended");
      // Legacy expiry targets the inviter room and the invitee user only.
      await emitD1Realtime(realtime, {
        event: "pk:invite:expired", scope: `room:${roomIds[0]}`, delivery: "durable", data: payload
      });
      await emitD1Realtime(realtime, {
        event: "pk:invite:expired", scope: `user:${String(invite.invitee_user_id)}`,
        delivery: "durable", data: payload
      });
    }
    return expired;
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`D1 PK invite expiry ${inviteId} failed: ${detail}`);
  }
}

async function finishBattle(db: D1Database, battle: DeadlineBattleRow, time: string, publish: BattlePublisher) {
  let current = battle;
  if (current.status === "ACTIVE" || current.status === "FINAL_CRUNCH") {
    if (!await transitionBattle(db, current, [current.status], "FINALIZING", time, "PK_FINALIZING")) return;
    const changed = await readBattle(db, current.source_id);
    if (!changed) return;
    current = changed;
    await publish(current.source_id, "pk:state");
  }
  if (current.status !== "FINALIZING") return;
  const side = winnerSide(current);
  const winnerUserId = side === "LEFT" ? current.left_host_id : side === "RIGHT" ? current.right_host_id : null;
  if (await transitionBattle(db, current, ["FINALIZING"], "COMPLETED", time, "PK_COMPLETED",
    "winner_side = ?, winner_user_id = ?, ended_at = ?, finalized_at = ?, termination_reason = ?",
    [side, winnerUserId, time, time, ""],
    { side, metadata: { reason: "" } },
    [releaseRoomLocks(db, current, time)])) {
    await publish(current.source_id, "pk:ended");
  }
}

export async function runD1PkDeadlines(db: D1Database, now = new Date(), realtime: D1RealtimePort = noD1Realtime) {
  const publish = battlePublisher(db, realtime);
  const time = now.toISOString();
  const readyThreshold = new Date(now.getTime() - readyGraceMs).toISOString();
  const closeThreshold = new Date(now.getTime() - closeGraceMs).toISOString();
  const [ready, countdowns, active, completed, expiredInvites] = await Promise.all([
    db.prepare("SELECT source_id FROM pk_battles WHERE status = 'READY' AND updated_at <= ?").bind(readyThreshold).all<Row>(),
    db.prepare(`SELECT source_id FROM pk_battles WHERE status = 'COUNTDOWN' AND countdown_ends_at <= ?`).bind(time).all<Row>(),
    db.prepare(`SELECT ${battleFields} FROM pk_battles WHERE status IN ('ACTIVE', 'FINAL_CRUNCH', 'FINALIZING')`).all<DeadlineBattleRow>(),
    db.prepare("SELECT source_id FROM pk_battles WHERE status = 'COMPLETED' AND ended_at <= ?").bind(closeThreshold).all<Row>(),
    db.prepare("SELECT * FROM pk_invites WHERE status = 'PENDING' AND expires_at <= ?").bind(time).all<Row>()
  ]);

  // Recover if the process stopped between READY and COUNTDOWN.
  for (const row of ready.results) {
    const battle = await readBattle(db, String(row.source_id));
    if (battle?.status !== "READY") continue;
    if (await transitionBattle(db, battle, ["READY"], "COUNTDOWN", time, "PK_COUNTDOWN",
      "countdown_ends_at = ?", [new Date(now.getTime() + 3000).toISOString()])) {
      await publish(battle.source_id, "pk:state");
    }
  }
  for (const row of countdowns.results) {
    const battle = await readBattle(db, String(row.source_id));
    if (battle?.status !== "COUNTDOWN" || !battle.countdown_ends_at) continue;
    if (await transitionBattle(db, battle, ["COUNTDOWN"], "ACTIVE", time, "PK_STARTED",
      "started_at = ?, countdown_ends_at = NULL", [String(battle.countdown_ends_at)])) {
      await publish(battle.source_id, "pk:started");
      await publish(battle.source_id, "pk:timer:tick", undefined, [], "ephemeral");
    }
  }
  for (const row of active.results) {
    let battle = await readBattle(db, String(row.source_id));
    if (!battle || !activeStatuses.includes(battle.status)) continue;
    if (battle.status === "FINALIZING") {
      await finishBattle(db, battle, time, publish);
      continue;
    }
    if (battle.status === "ACTIVE" && remainingSeconds(battle, now) <= 10 &&
      await transitionBattle(db, battle, ["ACTIVE"], "FINAL_CRUNCH", time, "PK_FINAL_CRUNCH")) {
      await publish(battle.source_id, "pk:state");
      await publish(battle.source_id, "pk:timer:tick", undefined, [], "ephemeral");
      const changed = await readBattle(db, battle.source_id);
      if (!changed) continue;
      battle = changed;
    }
    if (remainingSeconds(battle, now) > 0) continue;
    if (!await transitionBattle(db, battle, [battle.status], "FINALIZING", time, "PK_FINALIZING")) continue;
    await publish(battle.source_id, "pk:state");
    const finalizing = await readBattle(db, battle.source_id);
    if (finalizing) await finishBattle(db, finalizing, time, publish);
  }
  for (const row of completed.results) {
    const battle = await readBattle(db, String(row.source_id));
    if (!battle || battle.status !== "COMPLETED" || !closableStatuses.includes(battle.status)) continue;
    if (await transitionBattle(db, battle, ["COMPLETED"], "CLOSED", time, "PK_CLOSED",
      "closed_at = ?", [time], {}, [releaseRoomLocks(db, battle, time)])) {
      await publish(battle.source_id, "pk:ended");
    }
  }
  for (const row of expiredInvites.results) {
    const invite = await db.prepare("SELECT * FROM pk_invites WHERE source_id = ? AND status = 'PENDING' AND expires_at <= ?")
      .bind(String(row.source_id), time).first<Row>();
    if (invite) await expireInvite(db, invite, time, publish, realtime);
  }
}

/** Expires a pending invite with the same guarded commit used by deadline recovery. */
export async function expireD1PkInvite(db: D1Database,
  invite: Record<string, string | number | null>, now = new Date(), realtime: D1RealtimePort = noD1Realtime) {
  return expireInvite(db, invite, now.toISOString(), battlePublisher(db, realtime), realtime);
}

/** Earliest persisted PK deadline; active battles need a five-second tick. */
export async function nextD1PkDeadline(db: D1Database, now = new Date()) {
  const [active, ready, countdown, completed, invite] = await Promise.all([
    db.prepare(`SELECT 1 FROM pk_battles WHERE status IN ('ACTIVE', 'FINAL_CRUNCH', 'FINALIZING') LIMIT 1`).first(),
    db.prepare("SELECT updated_at FROM pk_battles WHERE status = 'READY' AND updated_at IS NOT NULL ORDER BY updated_at ASC LIMIT 1")
      .first<{ updated_at: string }>(),
    db.prepare("SELECT countdown_ends_at FROM pk_battles WHERE status = 'COUNTDOWN' AND countdown_ends_at IS NOT NULL ORDER BY countdown_ends_at ASC LIMIT 1")
      .first<{ countdown_ends_at: string }>(),
    db.prepare("SELECT ended_at FROM pk_battles WHERE status = 'COMPLETED' AND ended_at IS NOT NULL ORDER BY ended_at ASC LIMIT 1")
      .first<{ ended_at: string }>(),
    db.prepare("SELECT expires_at FROM pk_invites WHERE status = 'PENDING' ORDER BY expires_at ASC LIMIT 1")
      .first<{ expires_at: string }>()
  ]);
  const candidates = [
    active ? now.getTime() + tickMs : undefined,
    ready?.updated_at ? Date.parse(ready.updated_at) + readyGraceMs : undefined,
    countdown?.countdown_ends_at ? Date.parse(countdown.countdown_ends_at) : undefined,
    completed?.ended_at ? Date.parse(completed.ended_at) + closeGraceMs : undefined,
    invite?.expires_at ? Date.parse(invite.expires_at) : undefined
  ].filter((value): value is number => value !== undefined && Number.isFinite(value));
  return candidates.length ? Math.min(...candidates) : undefined;
}
