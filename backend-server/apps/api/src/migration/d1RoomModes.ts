import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import type { RoomMode } from "@yugm/shared";
import type { AccessClaims } from "../services/accessSession.js";
import type { ModeMetadata, ModeState } from "../services/roomModeGame.js";
import { shuffleArray } from "../services/roomModePrompts.js";
import { bindD1LiveUser, d1LiveUserFilter } from "./d1AccessSession.js";

interface ModeRow {
  source_id: string;
  room_id: string;
  mode: RoomMode;
  round: number;
  status: ModeState["status"];
  scores: string;
  participants: string;
  current_turn_user_id: string | null;
  current_question: string | null;
  current_options: string;
  round_start_time: string | null;
  round_end_time: string | null;
  metadata: string;
  created_at: string | null;
  updated_at: string | null;
  revision: string;
}

const roster = `(SELECT json_group_array(user_id) FROM (
  SELECT user_id FROM room_participants WHERE room_id = r.source_id AND left_at IS NULL
  UNION SELECT r.host_id ORDER BY user_id
))`;
const hostControl = "(r.host_id = u.source_id OR u.role = 'ADMIN')";
const playerControl = `EXISTS (SELECT 1 FROM room_mode_participants
  WHERE room_mode_states_id = s.source_id AND value = u.source_id)
  AND EXISTS (SELECT 1 FROM room_participants WHERE room_id = r.source_id AND user_id = u.source_id AND left_at IS NULL)`;
const id = () => randomBytes(12).toString("hex");

export async function readRoomMode(db: D1Database, roomId: string) {
  const row = await db.prepare(`SELECT s.*, (SELECT json_group_array(value) FROM (
      SELECT value FROM room_mode_participants WHERE room_mode_states_id = s.source_id AND value IS NOT NULL ORDER BY position
    )) AS participants FROM room_mode_states AS s WHERE s.room_id = ?`).bind(roomId).first<ModeRow>();
  if (!row) return null;
  const state: ModeState = {
    _id: row.source_id, roomId: row.room_id, mode: row.mode, round: row.round, status: row.status,
    scores: JSON.parse(row.scores) as Record<string, number>, participants: JSON.parse(row.participants) as string[],
    currentTurnUserId: row.current_turn_user_id, currentQuestion: row.current_question,
    currentOptions: JSON.parse(row.current_options) as string[],
    roundStartTime: row.round_start_time, roundEndTime: row.round_end_time,
    metadata: JSON.parse(row.metadata) as ModeMetadata, createdAt: row.created_at, updatedAt: row.updated_at
  };
  return { state, revision: row.revision };
}

export async function readRoomModeRoster(db: D1Database, roomId: string) {
  const row = await db.prepare(`SELECT ${roster} AS players FROM rooms AS r WHERE source_id = ?`)
    .bind(roomId).first<string>("players");
  return JSON.parse(row ?? "[]") as string[];
}

export async function createRoomMode(db: D1Database, claims: AccessClaims, roomId: string, mode: RoomMode, players: string[]) {
  const key = id();
  const time = new Date().toISOString();
  const participants = JSON.stringify(players);
  const scores = JSON.stringify(Object.fromEntries(players.map(player => [player, 0])));
  const metadata = JSON.stringify({ shuffledParticipants: shuffleArray(players) });
  const [created] = await db.batch([
    db.prepare(`INSERT INTO room_mode_states (source_id, room_id, mode, round, status, scores, current_options, metadata, created_at, updated_at)
      SELECT ?, r.source_id, ?, 1, 'WAITING', ?, '[]', ?, ?, ? FROM rooms AS r CROSS JOIN users AS u
      WHERE r.source_id = ? AND r.status = 'LIVE' AND ${hostControl} AND ${d1LiveUserFilter}
        AND ${roster} = ? AND NOT EXISTS (SELECT 1 FROM room_mode_states WHERE room_id = r.source_id)`)
      .bind(key, mode, scores, metadata, time, time, roomId, ...bindD1LiveUser(claims, time), participants),
    db.prepare(`INSERT INTO room_mode_participants (source_id, value, room_mode_states_id, position)
      SELECT s.source_id || ':participants:' || p.key, p.value, s.source_id, p.key
      FROM room_mode_states AS s CROSS JOIN json_each(?) AS p WHERE s.source_id = ?`).bind(participants, key),
    db.prepare(`UPDATE rooms SET mode = ?, updated_at = ? WHERE source_id = ?
      AND EXISTS (SELECT 1 FROM room_mode_states WHERE source_id = ?)`).bind(mode, time, roomId, key)
  ]);
  return Boolean(created.meta.changes);
}

export async function updateRoomMode(db: D1Database, claims: AccessClaims, state: ModeState, prior: string, hostOnly: boolean, time: string) {
  const revision = id();
  const update = db.prepare(`UPDATE room_mode_states AS s SET round = ?, status = ?, scores = ?, current_turn_user_id = ?,
    current_question = ?, current_options = ?, round_start_time = ?, round_end_time = ?, metadata = ?, updated_at = ?, revision = ?
    WHERE s.source_id = ? AND s.revision = ? AND EXISTS (
      SELECT 1 FROM rooms AS r CROSS JOIN users AS u WHERE r.source_id = s.room_id AND r.status = 'LIVE'
      AND ${d1LiveUserFilter} AND (${hostOnly ? hostControl : playerControl}))`)
    .bind(state.round, state.status, JSON.stringify(state.scores), state.currentTurnUserId, state.currentQuestion,
      JSON.stringify(state.currentOptions), state.roundStartTime, state.roundEndTime, JSON.stringify(state.metadata),
      time, revision, state._id, prior, ...bindD1LiveUser(claims, time));
  if (state.status !== "FINISHED") return Boolean((await update.run()).meta.changes);
  const [finished] = await db.batch([
    update,
    db.prepare(`UPDATE rooms SET mode = NULL, updated_at = ? WHERE source_id = ?
      AND EXISTS (SELECT 1 FROM room_mode_states WHERE source_id = ? AND revision = ?)`)
      .bind(time, state.roomId, state._id, revision)
  ]);
  return Boolean(finished.meta.changes);
}
