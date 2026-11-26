import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";
import { pkBattleJoins, pkBattleProjection, presentPkBattle, type BattleRow } from "./d1RoomPkHistory.js";

type Row = Record<string, string | number | null>;
type WritableBattleRow = BattleRow & {
  in_room_battle: number;
  started_by_user_id: string;
  countdown_ends_at: string | null;
  event_sequence: number;
};

const roomPkSchema = z.object({
  roomId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id"),
  leftPlayerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id"),
  rightPlayerId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id"),
  leftPlayerIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id")).min(1).max(5).optional(),
  rightPlayerIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id")).min(1).max(5).optional(),
  format: z.enum(["PLAYER", "TEAM"]).optional(),
  mode: z.enum(["GIFT", "VOTE"]),
  durationSeconds: z.number().int().refine((value) => [60, 180, 300, 600, 1800].includes(value), "Invalid duration"),
  selectedGiftId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id").optional()
}).refine((value) => value.mode !== "GIFT" || Boolean(value.selectedGiftId), "Select a PK gift");
const inviteActionSchema = z.object({ inviteId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id") });
const battleActionSchema = z.object({ battleId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id") });

const allowedPkDurations = [60, 180, 300, 600, 900];
const cancellableStatuses = ["INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN"];
const closableStatuses = ["COMPLETED", "ABORTED", "CANCELLED", "DECLINED", "EXPIRED", "ENDED", "FORCE_ENDED"];

type EventOptions = { roomId?: string; userId?: string; metadata?: Record<string, unknown> };
type Guard = { sql: string; params: Array<string | number | null> };

const guardedEventInsert = (db: D1Database, guard: Guard, id: string, battleId: string, eventType: string,
  time: string, options: EventOptions = {}) =>
  db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE ${guard.sql})
    INSERT INTO pk_events (source_id, battle_id, room_id, user_id, event_type, side, points,
      state_version, sequence, gift_transaction_id, metadata, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, NULL, 0, 1, NULL, NULL, ?, ?, ? FROM guard WHERE allowed = 1`)
    .bind(...guard.params, id, battleId, options.roomId ?? null, options.userId ?? null, eventType,
      JSON.stringify(options.metadata ?? {}), time, time);

const releaseRoomLocks = (db: D1Database, battleId: string, roomIds: string[], time: string) => {
  const timeParam = roomIds.length + 1;
  const battleParam = roomIds.length + 2;
  return db.prepare(`UPDATE rooms SET active_pk_id = NULL, updated_at = ?${timeParam}
    WHERE source_id IN (${roomIds.map((_, index) => `?${index + 1}`).join(", ")}) AND active_pk_id = ?${battleParam}`)
    .bind(...roomIds, time, battleId);
};

export function createD1PkWritesRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.pkSession = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const viewerId = (res: any): string => res.locals.pkSession.user.id;

  const requireNotMuted = asyncHandler(async (_req, res, next) => {
    const row = await db.prepare("SELECT muted_until FROM users WHERE source_id = ?")
      .bind(viewerId(res)).first<{ muted_until: string | null }>();
    if (row?.muted_until && Date.parse(row.muted_until) > Date.now()) {
      throw new HttpError(403, `Account muted until ${row.muted_until}`, ErrorCode.FORBIDDEN);
    }
    next();
  });

  const readBattle = (battleId: string) => db.prepare(`SELECT ${pkBattleProjection}
    FROM pk_battles AS b ${pkBattleJoins} WHERE b.source_id = ? LIMIT 1`).bind(battleId).first<WritableBattleRow>();

  const assertLiveRoomManager = async (userId: string, roomId: string) => {
    const [roomRow, managerRow, userRow] = await db.batch([
      db.prepare("SELECT source_id, host_id, status FROM rooms WHERE source_id = ?").bind(roomId),
      db.prepare("SELECT 1 FROM room_admins WHERE rooms_id = ? AND value = ? LIMIT 1").bind(roomId, userId),
      db.prepare("SELECT role, is_blocked, muted_until, suspended_until FROM users WHERE source_id = ?").bind(userId)
    ]);
    const room = roomRow.results[0] as { source_id: string; host_id: string; status: string } | undefined;
    if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    if (room.status !== "LIVE") throw new HttpError(400, "Room must be live to start a PK", ErrorCode.VALIDATION);
    const user = userRow.results[0] as { role: string; is_blocked: number; muted_until: string | null; suspended_until: string | null } | undefined;
    const isManager = room.host_id === userId || Boolean(managerRow.results[0]) || user?.role === "ADMIN";
    if (!isManager) throw new HttpError(403, "Only the room host or an admin can manage PK", ErrorCode.FORBIDDEN);
    const now = Date.now();
    if (!user || user.is_blocked || (user.muted_until && Date.parse(user.muted_until) > now)
      || (user.suspended_until && Date.parse(user.suspended_until) > now)) {
      throw new HttpError(403, "Restricted room managers cannot start PK", ErrorCode.FORBIDDEN);
    }
  };

  const assertAnyRoomManager = async (userId: string, roomIds: string[], action: "close PK" | "manage PK") => {
    const [rooms, managers, userRow] = await db.batch([
      db.prepare(`SELECT source_id, host_id FROM rooms WHERE source_id IN (${roomIds.map((_, index) => `?${index + 1}`).join(", ")})`).bind(...roomIds),
      db.prepare(`SELECT 1 FROM room_admins WHERE rooms_id IN (${roomIds.map((_, index) => `?${index + 1}`).join(", ")}) AND value = ?${roomIds.length + 1} LIMIT 1`)
        .bind(...roomIds, userId),
      db.prepare("SELECT role FROM users WHERE source_id = ?").bind(userId)
    ]);
    const host = (rooms.results as Array<{ source_id: string; host_id: string }>).some((room) => room.host_id === userId);
    const isManager = host || Boolean(managers.results[0]) || (userRow.results[0] as { role: string } | undefined)?.role === "ADMIN";
    if (!isManager) throw new HttpError(403, `Only a room host or admin can ${action}`, ErrorCode.FORBIDDEN);
  };

  const assertCrossRoomManager = async (userId: string, roomId: string) => {
    const [roomRow, managerRow, userRow] = await db.batch([
      db.prepare("SELECT host_id FROM rooms WHERE source_id = ?").bind(roomId),
      db.prepare("SELECT 1 FROM room_admins WHERE rooms_id = ? AND value = ? LIMIT 1").bind(roomId, userId),
      db.prepare("SELECT role FROM users WHERE source_id = ?").bind(userId)
    ]);
    const room = roomRow.results[0] as { host_id: string } | undefined;
    const isManager = room?.host_id === userId || Boolean(managerRow.results[0]) || (userRow.results[0] as { role: string } | undefined)?.role === "ADMIN";
    if (!isManager) throw new HttpError(403, "Only the room host or admin can cancel PK", ErrorCode.FORBIDDEN);
  };

  const expireInvite = async (invite: Row) => {
    const time = new Date().toISOString();
    const battleId = String(invite.battle_id);
    const inviteId = String(invite.source_id);
    const roomIds = [String(invite.inviter_room_id), String(invite.invitee_room_id)];
    const guard: Guard = {
      sql: `EXISTS (SELECT 1 FROM pk_invites WHERE source_id = ? AND status = 'EXPIRED' AND responded_at = ?)
        AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'EXPIRED' AND ended_at = ?)`,
      params: [inviteId, time, battleId, time]
    };
    const committed = await db.batch([
      db.prepare("UPDATE pk_invites SET status = 'EXPIRED', responded_at = ?, updated_at = ? WHERE source_id = ? AND status = 'PENDING' AND expires_at <= ?")
        .bind(time, time, inviteId, time),
      db.prepare("UPDATE pk_battles SET status = 'EXPIRED', ended_at = ?, updated_at = ?, state_version = state_version + 1 WHERE source_id = ? AND status = 'INVITED'")
        .bind(time, time, battleId),
      releaseRoomLocks(db, battleId, roomIds, time),
      guardedEventInsert(db, guard, newId(), battleId, "PK_INVITE_EXPIRED", time, { userId: String(invite.invitee_user_id) })
    ]);
    return Boolean(committed[1]?.meta?.changes);
  };

  router.use(authenticate);

  router.post("/room-start", requireNotMuted, validateBody(roomPkSchema), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof roomPkSchema> & { durationSeconds: number };
    const userId = viewerId(res);
    const leftPlayerIds = body.leftPlayerIds?.length ? body.leftPlayerIds : [body.leftPlayerId];
    const rightPlayerIds = body.rightPlayerIds?.length ? body.rightPlayerIds : [body.rightPlayerId];
    if ([...leftPlayerIds, ...rightPlayerIds].some((id) => !isValidObjectId(id))) {
      throw new HttpError(400, "Invalid player selection", ErrorCode.VALIDATION);
    }
    if (new Set([...leftPlayerIds, ...rightPlayerIds]).size !== leftPlayerIds.length + rightPlayerIds.length) {
      throw new HttpError(400, "A player cannot be on both teams", ErrorCode.VALIDATION);
    }
    const format = body.format ?? "PLAYER";
    if (format === "PLAYER" && (leftPlayerIds.length !== 1 || rightPlayerIds.length !== 1)) {
      throw new HttpError(400, "Player PK requires one player per side", ErrorCode.VALIDATION);
    }
    if (format === "TEAM" && (leftPlayerIds.length < 2 || leftPlayerIds.length > 5 || rightPlayerIds.length !== leftPlayerIds.length)) {
      throw new HttpError(400, "Team PK requires balanced teams of 2–5 players", ErrorCode.VALIDATION);
    }
    if (!allowedPkDurations.includes(body.durationSeconds)) {
      throw new HttpError(400, "Invalid PK duration", ErrorCode.VALIDATION);
    }
    await assertLiveRoomManager(userId, body.roomId);

    const selectedPlayerIds = [...leftPlayerIds, ...rightPlayerIds];
    const placeholders = selectedPlayerIds.map((_, index) => `?${index + 2}`).join(", ");
    const { results: seatedRows } = await db.prepare(`SELECT DISTINCT user_id FROM room_participants
      WHERE room_id = ?1 AND user_id IN (${placeholders}) AND left_at IS NULL
        AND role IN ('HOST', 'SPEAKER', 'MODERATOR') AND seat_index IS NOT NULL
        AND mic_enabled = 1 AND moderator_muted = 0`).bind(body.roomId, ...selectedPlayerIds).all<Row>();
    if (seatedRows.length !== selectedPlayerIds.length) {
      throw new HttpError(400, "Both PK players must be on an active microphone seat", ErrorCode.VALIDATION);
    }

    let gift: { name: string; pk_points: number } | null | undefined;
    if (body.mode === "GIFT") {
      if (!body.selectedGiftId) throw new HttpError(400, "Choose the PK gift", ErrorCode.VALIDATION);
      gift = await db.prepare("SELECT name, pk_points FROM gifts WHERE source_id = ? AND is_active = 1")
        .bind(body.selectedGiftId).first<{ name: string; pk_points: number }>();
      if (!gift) throw new HttpError(404, "Selected PK gift is unavailable", ErrorCode.NOT_FOUND);
      if (!(gift.pk_points > 0)) {
        throw new HttpError(400, "Selected gift has no PK point value; update gift PK points first", ErrorCode.VALIDATION);
      }
    }

    const room = await db.prepare("SELECT type FROM rooms WHERE source_id = ?").bind(body.roomId).first<{ type: string }>();
    if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    const battleId = newId();
    const time = new Date().toISOString();
    const title = gift ? `${gift.name} ${format === "TEAM" ? "Team" : "Player"} PK` : `${format === "TEAM" ? "Team" : "Player"} Vote PK`;
    const statements = [
      db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE NOT EXISTS
        (SELECT 1 FROM rooms WHERE source_id = ? AND active_pk_id IS NOT NULL))
        INSERT INTO pk_battles (source_id, battle_code, title, mode, format, scope, team_size, status,
          battle_type, duration_seconds, selected_gift_id, in_room_battle, state_version, event_sequence,
          termination_reason, started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id,
          left_score, right_score, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, 'SAME_ROOM', ?, 'PREPARING', ?, ?, ?, 1, 1, 0, '', ?, ?, ?, ?, ?, 0, 0, ?, ?
        FROM guard WHERE allowed = 1`)
        .bind(body.roomId, battleId, `PK-${randomBytes(4).toString("hex").toUpperCase()}`, title, body.mode, format,
          leftPlayerIds.length, room.type, body.durationSeconds, body.selectedGiftId ?? null, userId, body.roomId,
          body.roomId, leftPlayerIds[0], rightPlayerIds[0], time, time),
      ...leftPlayerIds.map((id) => db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE EXISTS
        (SELECT 1 FROM pk_battles WHERE source_id = ?))
        INSERT INTO pk_participants (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at)
        SELECT ?, ?, ?, ?, 'LEFT', 'SPEAKER', 0, 'A', ? FROM guard WHERE allowed = 1`)
        .bind(battleId, newId(), battleId, id, body.roomId, time)),
      ...rightPlayerIds.map((id) => db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE EXISTS
        (SELECT 1 FROM pk_battles WHERE source_id = ?))
        INSERT INTO pk_participants (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at)
        SELECT ?, ?, ?, ?, 'RIGHT', 'SPEAKER', 0, 'B', ? FROM guard WHERE allowed = 1`)
        .bind(battleId, newId(), battleId, id, body.roomId, time)),
      guardedEventInsert(db, {
        sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ?)", params: [battleId]
      }, newId(), battleId, "PK_CREATED", time, {
        roomId: body.roomId, userId, metadata: { format, mode: body.mode, leftPlayerIds, rightPlayerIds }
      }),
      db.prepare(`UPDATE rooms SET active_pk_id = ?, updated_at = ?
        WHERE source_id = ? AND status = 'LIVE' AND active_pk_id IS NULL`).bind(battleId, time, body.roomId)
    ];
    const committed = await db.batch(statements);
    if (!committed[committed.length - 1]?.meta?.changes) {
      throw new HttpError(409, "A PK is already active in this room", ErrorCode.CONFLICT);
    }
    const battle = await readBattle(battleId);
    if (!battle) throw new HttpError(500, "Failed to load PK battle", ErrorCode.INTERNAL);
    sendOk(res, { battle: presentPkBattle(battle) }, 201);
  }));

  router.post("/reject", validateBody(inviteActionSchema), asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const inviteId = req.body.inviteId as string;
    const invite = await db.prepare("SELECT * FROM pk_invites WHERE source_id = ?").bind(inviteId).first<Row>();
    if (!invite) throw new HttpError(404, "PK invite not found", ErrorCode.NOT_FOUND);
    if (invite.invitee_user_id !== userId) throw new HttpError(403, "Only invitee can reject", ErrorCode.FORBIDDEN);
    if (invite.status !== "PENDING") throw new HttpError(409, "Invite is not pending", ErrorCode.CONFLICT);
    if (invite.expires_at && Date.parse(String(invite.expires_at)) < Date.now()) {
      await expireInvite(invite);
      throw new HttpError(409, "PK invite expired", ErrorCode.CONFLICT);
    }
    const time = new Date().toISOString();
    const battleId = String(invite.battle_id);
    const roomIds = [String(invite.inviter_room_id), String(invite.invitee_room_id)];
    const guard: Guard = {
      sql: `EXISTS (SELECT 1 FROM pk_invites WHERE source_id = ? AND status = 'REJECTED' AND responded_at = ?)
        AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'DECLINED' AND ended_at = ?)`,
      params: [inviteId, time, battleId, time]
    };
    const committed = await db.batch([
      db.prepare(`UPDATE pk_invites SET status = 'REJECTED', responded_at = ?, updated_at = ?
        WHERE source_id = ? AND status = 'PENDING' AND expires_at > ?
          AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'INVITED')`)
        .bind(time, time, inviteId, time, battleId),
      db.prepare("UPDATE pk_battles SET status = 'DECLINED', ended_at = ?, updated_at = ?, state_version = state_version + 1 WHERE source_id = ? AND status = 'INVITED'")
        .bind(time, time, battleId),
      releaseRoomLocks(db, battleId, roomIds, time),
      guardedEventInsert(db, guard, newId(), battleId, "PK_INVITE_REJECTED", time, { userId })
    ]);
    if (!committed[0]?.meta?.changes) {
      throw new HttpError(409, "Invitation was already answered or expired", ErrorCode.CONFLICT);
    }
    if (!committed[1]?.meta?.changes) throw new HttpError(409, "PK is no longer available", ErrorCode.CONFLICT);
    sendOk(res, { rejected: true });
  }));

  router.post("/cancel", validateBody(battleActionSchema), asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const battleId = req.body.battleId as string;
    const battle = await readBattle(battleId);
    if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    if (!cancellableStatuses.includes(battle.status)) {
      throw new HttpError(409, "An active PK must be ended, not cancelled", ErrorCode.CONFLICT);
    }
    if (battle.in_room_battle) await assertCrossRoomManager(userId, battle.left_room_id);
    else if (battle.left_host_id !== userId && battle.started_by_user_id !== userId) {
      throw new HttpError(403, "Cannot cancel this PK", ErrorCode.FORBIDDEN);
    }
    const time = new Date().toISOString();
    const roomIds = [battle.left_room_id, battle.right_room_id];
    const guard: Guard = {
      sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'CANCELLED' AND ended_at = ?)",
      params: [battleId, time]
    };
    const committed = await db.batch([
      db.prepare(`UPDATE pk_battles SET status = 'CANCELLED', ended_at = ?, updated_at = ?, state_version = state_version + 1
        WHERE source_id = ? AND status = ?`).bind(time, time, battleId, battle.status),
      db.prepare(`UPDATE pk_invites SET status = 'CANCELLED', responded_at = ?, updated_at = ? WHERE battle_id = ?
        AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'CANCELLED' AND ended_at = ?)`)
        .bind(time, time, battleId, battleId, time),
      releaseRoomLocks(db, battleId, roomIds, time),
      guardedEventInsert(db, guard, newId(), battleId, "PK_CANCELLED", time, { userId })
    ]);
    if (!committed[0]?.meta?.changes) throw new HttpError(409, "PK changed while cancelling", ErrorCode.CONFLICT);
    sendOk(res, { cancelled: true });
  }));

  router.post("/:battleId/close", validateBody(z.object({})), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const battleId = req.params.battleId.toLowerCase();
    const battle = await readBattle(battleId);
    if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    await assertAnyRoomManager(viewerId(res), [battle.left_room_id, battle.right_room_id], "close PK");
    if (battle.status === "CLOSED") {
      sendOk(res, { battle: presentPkBattle(battle) });
      return;
    }
    if (!closableStatuses.includes(battle.status)) {
      throw new HttpError(409, "Finalize or cancel PK before closing it", ErrorCode.CONFLICT);
    }
    const time = new Date().toISOString();
    const roomIds = [battle.left_room_id, battle.right_room_id];
    const guard: Guard = {
      sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'CLOSED' AND closed_at = ?)",
      params: [battleId, time]
    };
    await db.batch([
      db.prepare(`UPDATE pk_battles SET status = 'CLOSED', closed_at = ?, updated_at = ?, state_version = state_version + 1
        WHERE source_id = ? AND status = ?`).bind(time, time, battleId, battle.status),
      releaseRoomLocks(db, battleId, roomIds, time),
      guardedEventInsert(db, guard, newId(), battleId, "PK_CLOSED", time, { userId: viewerId(res) })
    ]);
    const closed = await readBattle(battleId);
    if (!closed) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    sendOk(res, { battle: presentPkBattle(closed) });
  }));

  return router;
}
