import type { D1Database } from "@cloudflare/workers-types";
import { createHash, randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { rankPkOpponents } from "../services/pkMatch.js";
import { assertPkTransition } from "../services/pkStateMachine.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { createNotification } from "./d1AdminUsers.js";
import { newId } from "./d1Cosmetics.js";
import { expireD1PkInvite } from "./d1PkDeadlines.js";
import { person, personJson } from "./d1People.js";
import { emitD1PkBattleState } from "./d1PkRealtime.js";
import { presentInvite } from "./d1PkReads.js";
import { emitD1Realtime, noD1Realtime, type D1RealtimePort } from "./d1Realtime.js";
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
const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id");
const sideSchema = z.enum(["LEFT", "RIGHT"]);
const inviteSchema = z.object({
  roomId: objectIdSchema,
  opponentRoomId: objectIdSchema,
  opponentHostId: objectIdSchema,
  battleType: z.enum(["VOICE", "VIDEO"]),
  mode: z.enum(["GIFT", "VOTE", "REACTION", "MIXED"]).default("GIFT"),
  durationSeconds: z.number().int().refine((value) => [60, 180, 300, 600, 900].includes(value), "Invalid duration"),
  title: z.string().max(80).optional()
});
const autoMatchSchema = inviteSchema.omit({ opponentRoomId: true, opponentHostId: true });
const inviteActionSchema = z.object({ inviteId: objectIdSchema });
const battleActionSchema = z.object({ battleId: objectIdSchema });
const endSchema = battleActionSchema.extend({ reason: z.string().max(240).optional() });
const voteSchema = z.object({ side: sideSchema });
const pkGiftSchema = z.object({
  giftId: objectIdSchema,
  side: sideSchema,
  idempotencyKey: z.string().min(8).max(80),
  quantity: z.number().int().min(1).max(99).default(1)
});
const pkReactionSchema = z.object({ side: sideSchema, type: z.string().min(1).max(24) });

const allowedPkDurations = [60, 180, 300, 600, 900];
const activePkStatuses = "'INVITED', 'WAITING', 'PREPARING', 'READY', 'COUNTDOWN', 'ACTIVE', 'FINAL_CRUNCH', 'FINALIZING', 'COMPLETED'";
const cancellableStatuses = ["INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN"];
const closableStatuses = ["COMPLETED", "ABORTED", "CANCELLED", "DECLINED", "EXPIRED", "ENDED", "FORCE_ENDED"];
const endableStatuses = ["INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN", "ACTIVE", "FINAL_CRUNCH", "FINALIZING", "OVERTIME"];
const rematchableStatuses = ["ENDED", "FORCE_ENDED", "COMPLETED", "CLOSED"];
const giftKeyMatch = "json_type(metadata, '$.idempotencyKey') = 'text' AND json_extract(metadata, '$.idempotencyKey') = ?";
const reactionPoints: Record<string, number> = { heart: 1, clap: 1, fire: 2, wow: 2, laugh: 1, sparkle: 1 };
const reactionBuckets = new Map<string, { points: number; resetAt: number }>();
const giftCombos = new Map<string, { count: number; resetAt: number }>();
const deterministicId = (key: string) => createHash("sha1").update(key).digest("hex").slice(0, 24);

type EventOptions = {
  roomId?: string; userId?: string; side?: string; points?: number; stateVersion?: number;
  sequence?: number | null; giftTransactionId?: string; metadata?: Record<string, unknown>;
};
type Guard = { sql: string; params: Array<string | number | null> };

const guardedEventInsert = (db: D1Database, guard: Guard, id: string, battleId: string, eventType: string,
  time: string, options: EventOptions = {}) =>
  db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE ${guard.sql})
    INSERT INTO pk_events (source_id, battle_id, room_id, user_id, event_type, side, points,
      state_version, sequence, gift_transaction_id, metadata, created_at, updated_at)
      SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? FROM guard WHERE allowed = 1`)
    .bind(...guard.params, id, battleId, options.roomId ?? null, options.userId ?? null, eventType,
      options.side ?? null, options.points ?? 0, options.stateVersion ?? 1, options.sequence ?? null,
      options.giftTransactionId ?? null, JSON.stringify(options.metadata ?? {}), time, time);

const parseJson = (value: unknown, fallback: unknown) => {
  if (typeof value !== "string") return fallback;
  try { return JSON.parse(value); } catch { return fallback; }
};

const presentGiftTransaction = (row: Row) => ({
  _id: row.source_id,
  roomId: row.room_id,
  senderId: row.sender_id,
  receiverId: row.receiver_id,
  giftId: row.gift_id,
  coinAmount: row.coin_amount,
  diamondAmount: row.diamond_amount,
  currency: row.currency,
  type: row.type,
  comboCount: row.combo_count,
  totalValue: row.total_value,
  effect: row.effect,
  metadata: parseJson(row.metadata, {}) as Record<string, unknown>,
  createdAt: row.created_at,
  __v: 0
});

const pkLeader = (left: number, right: number) => left > right ? "LEFT" : right > left ? "RIGHT" : "DRAW";
const remainingPkSeconds = (battle: { started_at: string | null; duration_seconds: number }, now: number = Date.now()) =>
  battle.started_at
    ? Math.max(0, battle.duration_seconds - Math.floor((now - Date.parse(battle.started_at)) / 1000))
    : battle.duration_seconds;

const releaseRoomLocks = (db: D1Database, battleId: string, roomIds: string[], time: string) => {
  const timeParam = roomIds.length + 1;
  const battleParam = roomIds.length + 2;
  return db.prepare(`UPDATE rooms SET active_pk_id = NULL, updated_at = ?${timeParam}
    WHERE source_id IN (${roomIds.map((_, index) => `?${index + 1}`).join(", ")}) AND active_pk_id = ?${battleParam}`)
    .bind(...roomIds, time, battleId);
};

export function createD1PkWritesRouter(db: D1Database, realtime: D1RealtimePort = noD1Realtime) {
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

  // Every call below happens after a guarded D1 batch has been checked. Delivery
  // is best effort: a publish failure never rewrites or invalidates the commit.
  const publishToRooms = (battle: WritableBattleRow, event: string, data?: unknown) =>
    emitD1PkBattleState(realtime, presentPkBattle(battle), event, data);
  const publishToScope = (scope: string, event: string, data: Record<string, unknown>) =>
    emitD1Realtime(realtime, { event, scope, delivery: "durable", data });
  const publishToUser = (userId: string, event: string, data: Record<string, unknown>) =>
    publishToScope(`user:${userId}`, event, data);
  const publishToRoom = (roomId: string, event: string, data: Record<string, unknown>) =>
    publishToScope(`room:${roomId}`, event, data);

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

  const assertAnyRoomManager = async (userId: string, roomIds: string[], action: "close PK" | "end PK" | "manage PK") => {
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

  const acceptInvite = async (userId: string, inviteId: string) => {
    const invite = await db.prepare("SELECT * FROM pk_invites WHERE source_id = ?").bind(inviteId).first<Row>();
    if (!invite) throw new HttpError(404, "PK invite not found", ErrorCode.NOT_FOUND);
    if (String(invite.invitee_user_id) !== userId) throw new HttpError(403, "Only invitee can accept", ErrorCode.FORBIDDEN);
    if (invite.status !== "PENDING") throw new HttpError(409, "Invite is not pending", ErrorCode.CONFLICT);
    if (invite.expires_at && Date.parse(String(invite.expires_at)) < Date.now()) {
      await expireD1PkInvite(db, invite, new Date(), realtime);
      throw new HttpError(409, "PK invite expired", ErrorCode.CONFLICT);
    }
    const battleId = String(invite.battle_id);
    const battle = await readBattle(battleId);
    if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    const [leftRoom, rightRoom] = await db.batch([
      db.prepare("SELECT status FROM rooms WHERE source_id = ?").bind(battle.left_room_id),
      db.prepare("SELECT status FROM rooms WHERE source_id = ?").bind(battle.right_room_id)
    ]);
    if ((leftRoom.results[0] as Row | undefined)?.status !== "LIVE"
      || (rightRoom.results[0] as Row | undefined)?.status !== "LIVE") {
      throw new HttpError(400, "Both rooms must be live", ErrorCode.VALIDATION);
    }
    assertPkTransition(battle.status, "PREPARING");
    const time = new Date().toISOString();
    const nextVersion = Number(battle.state_version) + 1;
    const guard: Guard = {
      sql: `EXISTS (SELECT 1 FROM pk_invites WHERE source_id = ? AND status = 'ACCEPTED' AND responded_at = ?)
        AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'PREPARING' AND state_version = ?)`,
      params: [inviteId, time, battleId, nextVersion]
    };
    const hosts = [
      [battle.left_host_id, battle.left_room_id, "LEFT", "A"],
      [battle.right_host_id, battle.right_room_id, "RIGHT", "B"]
    ] as const;
    const committed = await db.batch([
      db.prepare(`UPDATE pk_invites SET status = 'ACCEPTED', responded_at = ?, updated_at = ?
        WHERE source_id = ? AND status = 'PENDING' AND expires_at > ?
          AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'INVITED')`)
        .bind(time, time, inviteId, time, battleId),
      db.prepare(`UPDATE pk_battles SET status = 'PREPARING', state_version = state_version + 1, updated_at = ?
        WHERE source_id = ? AND status = 'INVITED' AND state_version = ?`)
        .bind(time, battleId, battle.state_version),
      ...hosts.flatMap(([hostId, roomId, side, team]) => [
        db.prepare(`UPDATE pk_participants SET room_id = ?, side = ?, role = 'HOST', is_ready = 0, joined_at = ?
          WHERE battle_id = ? AND user_id = ?
            AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'PREPARING' AND state_version = ?)`)
          .bind(roomId, side, time, battleId, hostId, battleId, nextVersion),
        db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE
            EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'PREPARING' AND state_version = ?)
            AND NOT EXISTS (SELECT 1 FROM pk_participants WHERE battle_id = ? AND user_id = ?))
          INSERT INTO pk_participants (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at)
          SELECT ?, ?, ?, ?, ?, 'HOST', 0, ?, ? FROM guard WHERE allowed = 1`)
          .bind(battleId, nextVersion, battleId, hostId, newId(), battleId, hostId, roomId, side, team, time)
      ]),
      guardedEventInsert(db, guard, newId(), battleId, "PK_INVITE_ACCEPTED", time, { userId })
    ]);
    if (!committed[0]?.meta?.changes) {
      throw new HttpError(409, "Invitation was already answered or expired", ErrorCode.CONFLICT);
    }
    if (!committed[1]?.meta?.changes) throw new HttpError(409, "PK is no longer available", ErrorCode.CONFLICT);
    const [acceptedBattle, acceptedInvite] = await Promise.all([
      readBattle(battleId),
      db.prepare("SELECT * FROM pk_invites WHERE source_id = ?").bind(inviteId).first<Row>()
    ]);
    if (!acceptedBattle || !acceptedInvite) {
      throw new HttpError(500, "Failed to load accepted PK invite", ErrorCode.INTERNAL);
    }
    await publishToRooms(acceptedBattle, "pk:state");
    await publishToUser(battle.left_host_id, "pk:invite:accepted", presentPkBattle(acceptedBattle));
    return { battle: presentPkBattle(acceptedBattle), invite: presentInvite(acceptedInvite) };
  };

  type InviteHostRoom = Row & { source_id: string; title: string; host_id: string; status: string; type: string };
  type CrossRoomInviteInput = {
    userId: string;
    roomId: string;
    opponentRoomId: string;
    opponentHostId: string;
    battleType: "VOICE" | "VIDEO";
    mode: "GIFT" | "VOTE" | "REACTION" | "MIXED";
    durationSeconds: number;
    title?: string;
    previousBattleId?: string;
  };

  const assertInviteHost = async (userId: string, roomId: string): Promise<InviteHostRoom> => {
    const [roomResult, managerResult, userResult] = await db.batch([
      db.prepare("SELECT source_id, title, host_id, status, type, category, language, participant_count FROM rooms WHERE source_id = ?").bind(roomId),
      db.prepare("SELECT 1 FROM room_admins WHERE rooms_id = ? AND value = ? LIMIT 1").bind(roomId, userId),
      db.prepare("SELECT role, is_blocked, muted_until, suspended_until FROM users WHERE source_id = ?").bind(userId)
    ]);
    const room = roomResult.results[0] as InviteHostRoom | undefined;
    if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
    if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
    const user = userResult.results[0] as Row | undefined;
    const isManager = room.host_id === userId || Boolean(managerResult.results[0]) || user?.role === "ADMIN";
    if (!isManager) throw new HttpError(403, "Only the room host or an admin can manage PK", ErrorCode.FORBIDDEN);
    const now = Date.now();
    if (!user || user.is_blocked
      || (user.muted_until && Date.parse(String(user.muted_until)) > now)
      || (user.suspended_until && Date.parse(String(user.suspended_until)) > now)) {
      throw new HttpError(403, "Restricted hosts cannot start PK", ErrorCode.FORBIDDEN);
    }
    return room;
  };

  const assertEngagementParticipant = async (battleId: string, roomIds: string[], userId: string) => {
    const participant = await db.prepare(`SELECT 1 FROM room_participants
      WHERE room_id IN (?, ?) AND user_id = ? AND left_at IS NULL LIMIT 1`)
      .bind(roomIds[0], roomIds[1], userId).first();
    if (!participant) throw new HttpError(403, "Join a PK room before engaging", ErrorCode.FORBIDDEN);
  };

  const findPkGiftReplay = (senderId: string, key: string) => db.prepare(
    `SELECT * FROM gift_transactions WHERE sender_id = ? AND ${giftKeyMatch}`
  ).bind(senderId, key).first<Row>();

  const createCrossRoomInvite = async (input: CrossRoomInviteInput) => {
    if (!isValidObjectId(input.roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
    if (!isValidObjectId(input.opponentRoomId)) throw new HttpError(400, "Invalid opponentRoomId", ErrorCode.VALIDATION);
    if (!isValidObjectId(input.opponentHostId)) throw new HttpError(400, "Invalid opponentHostId", ErrorCode.VALIDATION);
    const roomId = input.roomId.toLowerCase();
    const opponentRoomId = input.opponentRoomId.toLowerCase();
    const opponentHostId = input.opponentHostId.toLowerCase();
    if (roomId === opponentRoomId) {
      throw new HttpError(400, "Cross-room PK requires two different rooms", ErrorCode.VALIDATION);
    }
    if (!allowedPkDurations.includes(input.durationSeconds)) {
      throw new HttpError(400, "Invalid PK duration", ErrorCode.VALIDATION);
    }
    const room = await assertInviteHost(input.userId, roomId);
    const opponentRoom = await db.prepare("SELECT host_id, status, type FROM rooms WHERE source_id = ?")
      .bind(opponentRoomId).first<Row>();
    if (!opponentRoom || opponentRoom.status !== "LIVE") {
      throw new HttpError(404, "Opponent room is not live", ErrorCode.NOT_FOUND);
    }
    if (opponentRoom.host_id !== opponentHostId) {
      throw new HttpError(400, "Opponent host does not own that room", ErrorCode.VALIDATION);
    }
    if (room.type !== input.battleType || opponentRoom.type !== input.battleType) {
      throw new HttpError(400, "PK type must match both rooms", ErrorCode.VALIDATION);
    }
    const blocked = await db.prepare(`SELECT 1 FROM blocks
      WHERE (blocker_id = ?1 AND blocked_user_id = ?2) OR (blocker_id = ?2 AND blocked_user_id = ?1) LIMIT 1`)
      .bind(input.userId, opponentHostId).first();
    if (blocked) throw new HttpError(403, "Cannot invite this host", ErrorCode.FORBIDDEN);

    const battleId = newId();
    const inviteId = newId();
    const time = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 60_000).toISOString();
    const sortedRooms = [roomId, opponentRoomId].sort();
    const format = input.battleType === "VIDEO" ? "LIVESTREAM" : "ROOM";
    // The battle insert is the single claim. Later statements only write when that battle exists,
    // so a stale room lock cannot leave an invite or battle behind.
    const lockRoom = (targetRoomId: string) => db.prepare(`UPDATE rooms SET active_pk_id = ?, updated_at = ?
      WHERE source_id = ? AND status = 'LIVE' AND active_pk_id IS NULL
        AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'INVITED')`)
      .bind(battleId, time, targetRoomId, battleId);
    const committed = await db.batch([
      db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE
          EXISTS (SELECT 1 FROM rooms WHERE source_id = ?1 AND status = 'LIVE' AND active_pk_id IS NULL)
          AND EXISTS (SELECT 1 FROM rooms WHERE source_id = ?2 AND status = 'LIVE' AND active_pk_id IS NULL))
        INSERT INTO pk_battles (source_id, battle_code, title, mode, format, scope, team_size, status,
          battle_type, duration_seconds, selected_gift_id, in_room_battle, state_version, event_sequence,
          termination_reason, started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id,
          left_score, right_score, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, 'CROSS_ROOM', 1, 'INVITED', ?, ?, NULL, 0, 1, 0, '', ?, ?, ?, ?, ?, 0, 0, ?, ?
        FROM guard WHERE allowed = 1`)
        .bind(sortedRooms[0], sortedRooms[1], battleId,
          `PK-${randomBytes(4).toString("hex").toUpperCase()}`, sanitizeText(input.title ?? ""), input.mode,
          format, input.battleType, input.durationSeconds, input.userId, roomId, opponentRoomId,
          input.userId, opponentHostId, time, time),
      lockRoom(sortedRooms[0]),
      lockRoom(sortedRooms[1]),
      db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE
          EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'INVITED'))
        INSERT INTO pk_invites (source_id, battle_id, inviter_user_id, invitee_user_id,
          inviter_room_id, invitee_room_id, status, expires_at, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ? FROM guard WHERE allowed = 1`)
        .bind(battleId, inviteId, battleId, input.userId, opponentHostId, roomId, opponentRoomId,
          expiresAt, time, time),
      guardedEventInsert(db, { sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ?)", params: [battleId] },
        newId(), battleId, "PK_CREATED", time, { roomId, userId: input.userId }),
      guardedEventInsert(db, { sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ?)", params: [battleId] },
        newId(), battleId, "PK_INVITE_SENT", time, { roomId: opponentRoomId, userId: input.userId })
    ]);
    if (!committed[0]?.meta?.changes) {
      throw new HttpError(409, "One of the rooms is already in a PK", ErrorCode.CONFLICT);
    }
    if (!committed[1]?.meta?.changes || !committed[2]?.meta?.changes) {
      throw new HttpError(500, "Failed to lock PK rooms", ErrorCode.INTERNAL);
    }
    if (!committed[3]?.meta?.changes || !committed[4]?.meta?.changes || !committed[5]?.meta?.changes) {
      throw new HttpError(500, "Failed to record PK invite", ErrorCode.INTERNAL);
    }
    await createNotification(db, opponentHostId, "SYSTEM", "PK Battle Invite",
      `${room.title} invited you to a PK Battle`, {
        battleId, inviteId, roomId: opponentRoomId, inviterRoomId: roomId, type: "PK_INVITE"
      });
    const [battle, invite] = await Promise.all([
      readBattle(battleId),
      db.prepare("SELECT * FROM pk_invites WHERE source_id = ?").bind(inviteId).first<Row>()
    ]);
    if (!battle || !invite) throw new HttpError(500, "Failed to load PK invite", ErrorCode.INTERNAL);
    const presentedBattle = presentPkBattle(battle);
    const presentedInvite = presentInvite(invite);
    await publishToUser(opponentHostId, "pk:invite:received", { battle: presentedBattle, invite: presentedInvite });
    await publishToRoom(roomId, "pk:invite:sent", { battle: presentedBattle, invite: presentedInvite });
    if (input.previousBattleId) {
      await publishToUser(opponentHostId, "pk:rematch:requested", {
        battleId, previousBattleId: input.previousBattleId, userId: input.userId
      });
    }
    return { battle: presentedBattle, invite: presentedInvite };
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
    await publishToRooms(battle, "pk:state");
    sendOk(res, { battle: presentPkBattle(battle) }, 201);
  }));

  router.post("/invite", requireNotMuted, validateBody(inviteSchema), asyncHandler(async (req, res) => {
    sendOk(res, await createCrossRoomInvite({ userId: viewerId(res), ...(req.body as z.infer<typeof inviteSchema>) }), 201);
  }));

  router.post("/auto-match", requireNotMuted, validateBody(autoMatchSchema), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof autoMatchSchema>;
    const userId = viewerId(res);
    const room = await assertInviteHost(userId, body.roomId.toLowerCase());
    const clauses = [
      "r.status = 'LIVE'",
      "r.visibility = 'PUBLIC'",
      "u.is_blocked = 0",
      "u.source_id <> ?1",
      `r.source_id NOT IN (
        SELECT left_room_id FROM pk_battles WHERE status IN (${activePkStatuses})
        UNION SELECT right_room_id FROM pk_battles WHERE status IN (${activePkStatuses})
      )`
    ];
    const bindings: Array<string | number> = [userId];
    clauses.push(`r.type = ?${bindings.length + 1}`);
    bindings.push(body.battleType);
    bindings.push(50);
    const { results } = await db.prepare(`SELECT r.source_id, r.category, r.language, r.participant_count,
        ${personJson("u")} AS host_json
      FROM rooms AS r JOIN users AS u ON u.source_id = r.host_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY r.participant_count DESC, r.created_at DESC, r.source_id DESC
      LIMIT ?${bindings.length}`).bind(...bindings).all<Row>();
    const candidates = results.map((row) => {
      const host = person(String(row.host_json ?? "{}")) as Record<string, any>;
      return {
        roomId: String(row.source_id),
        hostId: String(host._id ?? ""),
        category: typeof row.category === "string" ? row.category : undefined,
        language: typeof row.language === "string" ? row.language : undefined,
        participantCount: Number(row.participant_count ?? 0)
      };
    });
    const ranked = rankPkOpponents(room as { category?: string; language?: string }, body.roomId.toLowerCase(), candidates);
    const opponent = ranked[0];
    if (!opponent) throw new HttpError(404, "No live PK opponent is available right now", ErrorCode.NOT_FOUND);
    sendOk(res, await createCrossRoomInvite({
      userId, roomId: body.roomId, opponentRoomId: opponent.roomId, opponentHostId: opponent.hostId,
      battleType: body.battleType, mode: body.mode, durationSeconds: body.durationSeconds, title: body.title
    }), 201);
  }));

  router.post("/reject", validateBody(inviteActionSchema), asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const inviteId = req.body.inviteId as string;
    const invite = await db.prepare("SELECT * FROM pk_invites WHERE source_id = ?").bind(inviteId).first<Row>();
    if (!invite) throw new HttpError(404, "PK invite not found", ErrorCode.NOT_FOUND);
    if (invite.invitee_user_id !== userId) throw new HttpError(403, "Only invitee can reject", ErrorCode.FORBIDDEN);
    if (invite.status !== "PENDING") throw new HttpError(409, "Invite is not pending", ErrorCode.CONFLICT);
    if (invite.expires_at && Date.parse(String(invite.expires_at)) < Date.now()) {
      await expireD1PkInvite(db, invite, new Date(), realtime);
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
    await publishToRoom(roomIds[0], "pk:invite:rejected", { battleId, inviteId });
    const rejectedBattle = await readBattle(battleId);
    if (rejectedBattle) await publishToRooms(rejectedBattle, "pk:ended");
    sendOk(res, { rejected: true });
  }));

  router.post("/accept", validateBody(inviteActionSchema), asyncHandler(async (req, res) => {
    sendOk(res, await acceptInvite(viewerId(res), req.body.inviteId as string));
  }));

  router.post("/start", validateBody(inviteActionSchema), asyncHandler(async (req, res) => {
    sendOk(res, await acceptInvite(viewerId(res), req.body.inviteId as string));
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
    const cancelledBattle = await readBattle(battleId);
    if (cancelledBattle) await publishToRooms(cancelledBattle, "pk:ended");
    sendOk(res, { cancelled: true });
  }));

  router.post("/end", validateBody(endSchema), asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof endSchema>;
    const battleId = body.battleId.toLowerCase();
    const battle = await readBattle(battleId);
    if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    await assertAnyRoomManager(viewerId(res), [battle.left_room_id, battle.right_room_id], "end PK");
    if (!endableStatuses.includes(battle.status)) {
      sendOk(res, { battle: presentPkBattle(battle) });
      return;
    }
    const winnerSide = pkLeader(Number(battle.left_score), Number(battle.right_score));
    const preStart = ["INVITED", "WAITING", "PREPARING", "READY", "COUNTDOWN"].includes(battle.status);
    const time = new Date().toISOString();
    let finalizing: WritableBattleRow = battle;
    if (!preStart && battle.status !== "FINALIZING") {
      assertPkTransition(battle.status, "FINALIZING");
      const finalizingVersion = Number(battle.state_version) + 1;
      const committed = await db.batch([
        db.prepare(`UPDATE pk_battles SET status = 'FINALIZING', state_version = state_version + 1, updated_at = ?
          WHERE source_id = ? AND status = ? AND state_version = ?`)
          .bind(time, battleId, battle.status, battle.state_version),
        guardedEventInsert(db, {
          sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'FINALIZING' AND state_version = ?)",
          params: [battleId, finalizingVersion]
        }, newId(), battleId, "PK_FINALIZING", time)
      ]);
      if (!committed[0]?.meta?.changes) {
        const current = await readBattle(battleId);
        sendOk(res, { battle: presentPkBattle(current ?? battle) });
        return;
      }
      const changed = await readBattle(battleId);
      if (!changed) throw new HttpError(500, "Failed to load PK battle", ErrorCode.INTERNAL);
      finalizing = changed;
      await publishToRooms(changed, "pk:state");
    }
    const terminalStatus = preStart ? "CANCELLED" : "COMPLETED";
    assertPkTransition(finalizing.status, terminalStatus);
    const terminalVersion = Number(finalizing.state_version) + 1;
    const terminalEvent = preStart ? "PK_CANCELLED" : "PK_COMPLETED";
    const winnerUserId = winnerSide === "LEFT" ? finalizing.left_host_id
      : winnerSide === "RIGHT" ? finalizing.right_host_id : null;
    const committed = await db.batch([
      db.prepare(`UPDATE pk_battles SET status = ?, winner_side = ?, winner_user_id = ?, ended_at = ?,
        finalized_at = ?, termination_reason = ?, state_version = state_version + 1, updated_at = ?
        WHERE source_id = ? AND status = ? AND state_version = ?`)
        .bind(terminalStatus, winnerSide, winnerUserId, time, time, body.reason ?? "", time,
          battleId, finalizing.status, finalizing.state_version),
      guardedEventInsert(db, {
        sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = ? AND state_version = ?)",
        params: [battleId, terminalStatus, terminalVersion]
      }, newId(), battleId, terminalEvent, time, {
        side: winnerSide, metadata: { reason: body.reason }
      }),
      releaseRoomLocks(db, battleId, [battle.left_room_id, battle.right_room_id], time)
    ]);
    if (!committed[0]?.meta?.changes) {
      const current = await readBattle(battleId);
      sendOk(res, { battle: presentPkBattle(current ?? finalizing) });
      return;
    }
    const ended = await readBattle(battleId);
    if (!ended) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    await publishToRooms(ended, "pk:ended");
    sendOk(res, { battle: presentPkBattle(ended) });
  }));

  router.post("/rematch", validateBody(battleActionSchema), asyncHandler(async (req, res) => {
    const battleId = (req.body as z.infer<typeof battleActionSchema>).battleId.toLowerCase();
    const oldBattle = await readBattle(battleId);
    if (!oldBattle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    if (!rematchableStatuses.includes(oldBattle.status)) {
      throw new HttpError(400, "Can only rematch ended battles", ErrorCode.VALIDATION);
    }
    const userId = viewerId(res);
    const isLeftHost = oldBattle.left_host_id === userId;
    const isRightHost = oldBattle.right_host_id === userId;
    if (!isLeftHost && !isRightHost) {
      throw new HttpError(403, "Only battle participants can request rematch", ErrorCode.FORBIDDEN);
    }
    const myRoomId = isLeftHost ? oldBattle.left_room_id : oldBattle.right_room_id;
    const opponentRoomId = isLeftHost ? oldBattle.right_room_id : oldBattle.left_room_id;
    const opponentHostId = isLeftHost ? oldBattle.right_host_id : oldBattle.left_host_id;
    const room = await db.prepare("SELECT status, host_id FROM rooms WHERE source_id = ?").bind(myRoomId).first<Row>();
    if (!room || room.status !== "LIVE") throw new HttpError(400, "Your room must be live", ErrorCode.VALIDATION);
    if (room.host_id !== userId) throw new HttpError(403, "Only room host can request rematch", ErrorCode.FORBIDDEN);
    sendOk(res, await createCrossRoomInvite({
      userId, roomId: myRoomId, opponentRoomId, opponentHostId,
      battleType: oldBattle.battle_type as "VOICE" | "VIDEO",
      mode: oldBattle.mode as "GIFT" | "VOTE" | "REACTION" | "MIXED",
      durationSeconds: oldBattle.duration_seconds,
      title: `Rematch: ${oldBattle.title || "PK Battle"}`,
      previousBattleId: battleId
    }), 201);
  }));

  router.post("/:battleId/ready", validateBody(z.object({})), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const battleId = req.params.battleId.toLowerCase();
    const battle = await readBattle(battleId);
    if (!battle || battle.status !== "PREPARING") {
      throw new HttpError(409, "PK preparation is closed", ErrorCode.CONFLICT);
    }
    assertPkTransition(battle.status, "READY");
    const userId = viewerId(res);
    const participant = await db.prepare(`SELECT side, room_id FROM pk_participants
      WHERE battle_id = ? AND user_id = ? AND left_at IS NULL LIMIT 1`).bind(battleId, userId).first<Row>();
    if (!participant) throw new HttpError(403, "Only a PK participant can ready up", ErrorCode.FORBIDDEN);
    const time = new Date().toISOString();
    const readyGuard: Guard = {
      sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'PREPARING' AND state_version = ?)",
      params: [battleId, battle.state_version]
    };
    const committed = await db.batch([
      db.prepare(`UPDATE pk_participants SET is_ready = 1 WHERE battle_id = ? AND user_id = ? AND left_at IS NULL
        AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'PREPARING' AND state_version = ?)`)
        .bind(battleId, userId, battleId, battle.state_version),
      guardedEventInsert(db, readyGuard, newId(), battleId, "PK_READY", time, {
        roomId: String(participant.room_id), userId, metadata: { side: participant.side }
      }),
      db.prepare(`SELECT COUNT(*) AS required, COALESCE(SUM(is_ready), 0) AS ready
        FROM pk_participants WHERE battle_id = ? AND left_at IS NULL`).bind(battleId)
    ]);
    if (!committed[0]?.meta?.changes) {
      throw new HttpError(403, "Only a PK participant can ready up", ErrorCode.FORBIDDEN);
    }
    const counts = committed[2].results[0] as { required: number; ready: number } | undefined;
    if (counts && Number(counts.required) > 0 && Number(counts.ready) === Number(counts.required)) {
      const readyVersion = Number(battle.state_version) + 1;
      const countdownVersion = readyVersion + 1;
      const countdownEndsAt = new Date(Date.now() + 3_000).toISOString();
      const allReadyGuard: Guard = {
        sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'READY' AND state_version = ?)",
        params: [battleId, readyVersion]
      };
      const countdownGuard: Guard = {
        sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'COUNTDOWN' AND state_version = ?)",
        params: [battleId, countdownVersion]
      };
      const readyCommitted = await db.batch([
        db.prepare(`UPDATE pk_battles SET status = 'READY', state_version = state_version + 1, updated_at = ?
          WHERE source_id = ? AND status = 'PREPARING' AND state_version = ?`)
          .bind(time, battleId, battle.state_version),
        guardedEventInsert(db, allReadyGuard, newId(), battleId, "PK_READY", time, {
          metadata: { participantsReady: Number(counts.ready) }
        })
      ]);
      if (readyCommitted[0]?.meta?.changes) {
        const readyBattle = await readBattle(battleId);
        if (readyBattle) await publishToRooms(readyBattle, "pk:state");
        const countdownCommitted = await db.batch([
          db.prepare(`UPDATE pk_battles SET status = 'COUNTDOWN', countdown_ends_at = ?,
            state_version = state_version + 1, updated_at = ?
            WHERE source_id = ? AND status = 'READY' AND state_version = ?`)
            .bind(countdownEndsAt, time, battleId, readyVersion),
          guardedEventInsert(db, countdownGuard, newId(), battleId, "PK_COUNTDOWN", time)
        ]);
        if (countdownCommitted[0]?.meta?.changes) {
          const countdownBattle = await readBattle(battleId);
          if (countdownBattle) await publishToRooms(countdownBattle, "pk:state");
        }
      }
    }
    const current = await readBattle(battleId);
    if (!current) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    sendOk(res, { battle: { ...presentPkBattle(current), myReady: true }, ready: true });
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
    const committed = await db.batch([
      db.prepare(`UPDATE pk_battles SET status = 'CLOSED', closed_at = ?, updated_at = ?, state_version = state_version + 1
        WHERE source_id = ? AND status = ?`).bind(time, time, battleId, battle.status),
      releaseRoomLocks(db, battleId, roomIds, time),
      guardedEventInsert(db, guard, newId(), battleId, "PK_CLOSED", time, { userId: viewerId(res) })
    ]);
    const closed = await readBattle(battleId);
    if (!closed) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    if (committed[0]?.meta?.changes) await publishToRooms(closed, "pk:ended");
    sendOk(res, { battle: presentPkBattle(closed) });
  }));

  router.post("/:battleId/vote", requireNotMuted, validateBody(voteSchema), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const battleId = req.params.battleId.toLowerCase();
    const battle = await readBattle(battleId);
    if (!battle || !["ACTIVE", "FINAL_CRUNCH"].includes(battle.status)
      || remainingPkSeconds(battle) <= 0 || battle.mode !== "VOTE") {
      throw new HttpError(409, "This vote PK is no longer accepting votes", ErrorCode.CONFLICT);
    }
    await assertEngagementParticipant(battleId, [battle.left_room_id, battle.right_room_id], viewerId(res));
    const side = (req.body as z.infer<typeof voteSchema>).side;
    const userId = viewerId(res);
    const time = new Date().toISOString();
    const cutoff = new Date(Date.now() - battle.duration_seconds * 1000).toISOString();
    const voteId = deterministicId(`pk-vote:${battleId}:${userId}`);
    const eventId = deterministicId(`pk-vote-event:${voteId}`);
    let committed;
    try {
      // The score update is the claim. A deterministic vote id makes a concurrent duplicate
      // violate the primary key and roll the whole batch back instead of double-counting.
      committed = await db.batch([
        db.prepare(`UPDATE pk_battles SET left_score = left_score + ?, right_score = right_score + ?,
            state_version = state_version + 1, event_sequence = event_sequence + 1, updated_at = ?
          WHERE source_id = ? AND status IN ('ACTIVE', 'FINAL_CRUNCH') AND mode = 'VOTE'
            AND started_at IS NOT NULL AND started_at > ?`)
          .bind(side === "LEFT" ? 1 : 0, side === "RIGHT" ? 1 : 0, time, battleId, cutoff),
        db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE
            EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status IN ('ACTIVE', 'FINAL_CRUNCH')
              AND mode = 'VOTE' AND started_at IS NOT NULL AND started_at > ?)
            AND NOT EXISTS (SELECT 1 FROM pk_votes WHERE battle_id = ? AND voter_id = ?))
          INSERT INTO pk_votes (source_id, battle_id, voter_id, side, room_id, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ? FROM guard WHERE allowed = 1`)
          .bind(battleId, cutoff, battleId, userId,
            voteId, battleId, userId, side, battle.left_room_id, time, time),
        db.prepare(`WITH updated AS (SELECT state_version, event_sequence FROM pk_battles WHERE source_id = ?),
            guard AS (SELECT 1 AS allowed WHERE
              EXISTS (SELECT 1 FROM pk_votes WHERE source_id = ? AND battle_id = ? AND voter_id = ?))
          INSERT INTO pk_events (source_id, battle_id, room_id, user_id, event_type, side, points,
            state_version, sequence, gift_transaction_id, metadata, created_at, updated_at)
          SELECT ?, ?, ?, ?, 'VOTE_CAST', ?, 1, updated.state_version, updated.event_sequence, NULL, ?, ?, ?
          FROM updated, guard WHERE allowed = 1`)
          .bind(battleId, voteId, battleId, userId,
            eventId, battleId, battle.left_room_id, userId, side, JSON.stringify({}), time, time)
      ]);
    } catch (error) {
      const duplicate = await db.prepare("SELECT 1 FROM pk_votes WHERE battle_id = ? AND voter_id = ?")
        .bind(battleId, userId).first();
      if (duplicate) throw new HttpError(409, "You already voted in this PK", ErrorCode.CONFLICT);
      throw error;
    }
    if (!committed[0]?.meta?.changes) throw new HttpError(409, "PK has already ended", ErrorCode.CONFLICT);
    if (!committed[1]?.meta?.changes || !committed[2]?.meta?.changes) {
      throw new HttpError(500, "Failed to record PK vote", ErrorCode.INTERNAL);
    }
    const updated = await readBattle(battleId);
    if (!updated) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    await publishToRooms(updated, "pk:score:update");
    sendOk(res, { battle: { ...presentPkBattle(updated), myVote: side }, voted: true }, 201);
  }));

  router.post("/:battleId/send-gift", requireNotMuted, validateBody(pkGiftSchema), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const body = req.body as z.infer<typeof pkGiftSchema>;
    const battleId = req.params.battleId.toLowerCase();
    const giftId = body.giftId.toLowerCase();
    if (!isValidObjectId(body.giftId)) throw new HttpError(400, "Invalid giftId", ErrorCode.VALIDATION);
    const userId = viewerId(res);
    const previous = await findPkGiftReplay(userId, body.idempotencyKey);
    if (previous) {
      if (String((parseJson(previous.metadata, {}) as Record<string, unknown>).pkBattleId) !== battleId) {
        throw new HttpError(409, "Gift request key was already used", ErrorCode.CONFLICT);
      }
      const replayBattle = await readBattle(battleId);
      if (!replayBattle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
      sendOk(res, { battle: presentPkBattle(replayBattle), giftTransaction: presentGiftTransaction(previous) }, 201);
      return;
    }
    const battle = await readBattle(battleId);
    const gift = await db.prepare("SELECT source_id, name, coin_price, pk_points, is_active FROM gifts WHERE source_id = ? AND is_active = 1")
      .bind(giftId).first<Row>();
    if (!battle || !["ACTIVE", "FINAL_CRUNCH"].includes(battle.status) || remainingPkSeconds(battle) <= 0) {
      throw new HttpError(404, "Active PK not found", ErrorCode.NOT_FOUND);
    }
    if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
    if (battle.mode === "VOTE") throw new HttpError(400, "This PK accepts votes only", ErrorCode.VALIDATION);
    if (battle.in_room_battle && battle.selected_gift_id !== giftId) {
      throw new HttpError(400, "Only the selected PK gift counts toward this battle", ErrorCode.VALIDATION);
    }
    if (!(Number(gift.pk_points) > 0)) {
      throw new HttpError(400, "This gift has no configured PK point value", ErrorCode.VALIDATION);
    }
    const roomIds = [battle.left_room_id, battle.right_room_id];
    const receiverId = body.side === "LEFT" ? battle.left_host_id : battle.right_host_id;
    const [participantResult, senderResult, receiverResult, safetyResult, teamResult] = await db.batch([
      db.prepare("SELECT 1 FROM room_participants WHERE room_id IN (?, ?) AND user_id = ? AND left_at IS NULL LIMIT 1")
        .bind(roomIds[0], roomIds[1], userId),
      db.prepare("SELECT source_id, wallet_balance FROM users WHERE source_id = ?").bind(userId),
      db.prepare("SELECT source_id, charm_exp FROM users WHERE source_id = ?").bind(receiverId),
      db.prepare("SELECT 1 FROM user_safety_statuses WHERE user_id = ? AND is_wallet_frozen = 1 LIMIT 1").bind(userId),
      db.prepare(`SELECT side FROM pk_participants WHERE battle_id = ? AND user_id = ? AND left_at IS NULL
        ORDER BY joined_at ASC, source_id ASC LIMIT 1`).bind(battleId, userId)
    ]);
    if (!participantResult.results[0]) throw new HttpError(403, "Join a PK room before engaging", ErrorCode.FORBIDDEN);
    const sender = senderResult.results[0] as Row | undefined;
    const receiver = receiverResult.results[0] as Row | undefined;
    if (!sender) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    if (!receiver) throw new HttpError(404, "Receiver not found", ErrorCode.NOT_FOUND);
    const senderTeam = teamResult.results[0] as Row | undefined;
    if (senderTeam?.side === body.side) {
      throw new HttpError(400, "Support the opposing side with PK gifts", ErrorCode.VALIDATION);
    }
    if (receiverId === userId) throw new HttpError(400, "Cannot send gifts to yourself", ErrorCode.VALIDATION);
    const quantity = Math.min(99, Math.max(1, Math.floor(body.quantity ?? 1)));
    const totalPrice = Number(gift.coin_price) * quantity;
    const totalPoints = Number(gift.pk_points) * quantity;
    if (!Number.isSafeInteger(totalPrice) || totalPrice <= 0) {
      throw new HttpError(400, "Coin amount must be a positive safe integer", ErrorCode.VALIDATION);
    }
    if (safetyResult.results[0]) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
    if (Number(sender.wallet_balance) < totalPrice) {
      throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
    }
    const comboKey = `${battleId}:${userId}:${body.side}:gift`;
    const existingCombo = giftCombos.get(comboKey);
    const combo = existingCombo && existingCombo.resetAt > Date.now() ? existingCombo.count + 1 : 1;
    giftCombos.set(comboKey, { count: combo, resetAt: Date.now() + 12_000 });

    const time = new Date().toISOString();
    const cutoff = new Date(Date.now() - battle.duration_seconds * 1000).toISOString();
    const giftTransactionId = deterministicId(`pk-gift:${userId}:${body.idempotencyKey}`);
    const walletLedgerId = newId();
    const roomId = body.side === "LEFT" ? battle.left_room_id : battle.right_room_id;
    const metadata = {
      pkBattleId: battleId, side: body.side, quantity, idempotencyKey: body.idempotencyKey
    };
    const oldLeader = pkLeader(Number(battle.left_score), Number(battle.right_score));
    const newLeader = pkLeader(
      Number(battle.left_score) + (body.side === "LEFT" ? totalPoints : 0),
      Number(battle.right_score) + (body.side === "RIGHT" ? totalPoints : 0)
    );
    const leaderboard = await db.prepare(`SELECT total_points, total_gifts_sent FROM pk_leaderboard_entries
      WHERE battle_id = ? AND user_id = ? ORDER BY source_id ASC LIMIT 1`).bind(battleId, userId).first<Row>();
    const claimParams: Array<string | number | null> = [
      battleId, cutoff, giftId, giftId, gift.coin_price, gift.pk_points,
      userId, sender.wallet_balance, totalPrice,
      userId,
      receiverId, receiver.charm_exp,
      roomIds[0], roomIds[1], userId,
      battleId, userId, senderTeam?.side ?? null,
      userId, body.idempotencyKey,
      userId, body.idempotencyKey
    ];
    let committed;
    try {
      // The score update is the claim; every later write is guarded by the gift transaction.
      // A duplicate idempotency key violates a deterministic id and rolls the batch back.
      committed = await db.batch([
        db.prepare(`UPDATE pk_battles SET left_score = left_score + ?, right_score = right_score + ?,
            state_version = state_version + 1, event_sequence = event_sequence + 1, updated_at = ?
          WHERE source_id = ? AND status IN ('ACTIVE', 'FINAL_CRUNCH') AND mode <> 'VOTE'
            AND started_at IS NOT NULL AND started_at > ?`)
          .bind(body.side === "LEFT" ? totalPoints : 0, body.side === "RIGHT" ? totalPoints : 0,
            time, battleId, cutoff),
        db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE
            EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status IN ('ACTIVE', 'FINAL_CRUNCH')
              AND started_at IS NOT NULL AND started_at > ? AND mode <> 'VOTE'
              AND (in_room_battle = 0 OR selected_gift_id = ?))
            AND EXISTS (SELECT 1 FROM gifts WHERE source_id = ? AND is_active = 1 AND coin_price = ? AND pk_points = ?)
            AND EXISTS (SELECT 1 FROM users WHERE source_id = ? AND wallet_balance = ? AND wallet_balance >= ?)
            AND NOT EXISTS (SELECT 1 FROM user_safety_statuses WHERE user_id = ? AND is_wallet_frozen = 1)
            AND EXISTS (SELECT 1 FROM users WHERE source_id = ? AND charm_exp = ?)
            AND EXISTS (SELECT 1 FROM room_participants WHERE room_id IN (?, ?) AND user_id = ? AND left_at IS NULL)
            AND (SELECT side FROM pk_participants WHERE battle_id = ? AND user_id = ? AND left_at IS NULL
              ORDER BY joined_at ASC, source_id ASC LIMIT 1) IS ?
            AND NOT EXISTS (SELECT 1 FROM gift_transactions WHERE sender_id = ? AND ${giftKeyMatch})
            AND NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE user_id = ? AND ${giftKeyMatch}))
          INSERT INTO gift_transactions (source_id, room_id, sender_id, receiver_id, gift_id, coin_amount,
            diamond_amount, currency, type, combo_count, total_value, effect, metadata, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, 0, 'COINS', 'send', ?, ?, '', ?, ?, ? FROM guard WHERE allowed = 1`)
          .bind(...claimParams, giftTransactionId, roomId, userId, receiverId, giftId, totalPrice,
            quantity, totalPrice, JSON.stringify(metadata), time, time),
      db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE
          EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)
          AND NOT EXISTS (SELECT 1 FROM wallet_transactions WHERE user_id = ? AND ${giftKeyMatch}))
        INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
          balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, ?, 'DEBIT', 'GIFT_SENT', ?, ?, ?, ?, NULL, ?, ? FROM guard WHERE allowed = 1`)
        .bind(giftTransactionId, userId, body.idempotencyKey, walletLedgerId, userId, totalPrice,
          sender.wallet_balance, Number(sender.wallet_balance) - totalPrice,
          JSON.stringify(metadata), time, time),
      db.prepare(`UPDATE users SET wallet_balance = ?, updated_at = ? WHERE source_id = ? AND wallet_balance = ?
        AND EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)`)
        .bind(Number(sender.wallet_balance) - totalPrice, time, userId, sender.wallet_balance, giftTransactionId),
      db.prepare(`UPDATE users SET charm_exp = charm_exp + ?, updated_at = ? WHERE source_id = ? AND charm_exp = ?
        AND EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)`)
        .bind(totalPrice, time, receiverId, receiver.charm_exp, giftTransactionId),
      db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE
          EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)
          AND NOT EXISTS (SELECT 1 FROM pk_leaderboard_entries WHERE battle_id = ? AND user_id = ?))
        INSERT INTO pk_leaderboard_entries (source_id, battle_id, user_id, side, total_points, total_gifts_sent, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, ?, ? FROM guard WHERE allowed = 1`)
        .bind(giftTransactionId, battleId, userId, newId(), battleId, userId, body.side,
          totalPoints, quantity, time, time),
      db.prepare(`UPDATE pk_leaderboard_entries SET total_points = total_points + ?,
          total_gifts_sent = total_gifts_sent + ?, updated_at = ?
        WHERE battle_id = ? AND user_id = ? AND total_points = ? AND total_gifts_sent = ?
          AND EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)`)
        .bind(totalPoints, quantity, time, battleId, userId, leaderboard?.total_points ?? -1,
          leaderboard?.total_gifts_sent ?? -1, giftTransactionId),
      db.prepare(`WITH updated AS (SELECT state_version, event_sequence FROM pk_battles WHERE source_id = ?),
          guard AS (SELECT 1 AS allowed WHERE
            EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)
            AND EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status IN ('ACTIVE', 'FINAL_CRUNCH'))
            AND NOT EXISTS (SELECT 1 FROM pk_events WHERE battle_id = ? AND gift_transaction_id = ?))
        INSERT INTO pk_events (source_id, battle_id, room_id, user_id, event_type, side, points,
          state_version, sequence, gift_transaction_id, metadata, created_at, updated_at)
        SELECT ?, ?, ?, ?, 'GIFT_SENT', ?, ?, updated.state_version, updated.event_sequence, ?, ?, ?, ?
        FROM updated, guard WHERE allowed = 1`)
        .bind(battleId, giftTransactionId, battleId, battleId, giftTransactionId,
          newId(), battleId, roomId, userId, body.side, totalPoints, giftTransactionId,
          JSON.stringify({ giftId, giftName: gift.name, quantity, unitPkPoints: gift.pk_points, combo }),
          time, time),
      ...(newLeader !== oldLeader && newLeader !== "DRAW" ? [guardedEventInsert(db, {
        sql: `EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)
          AND NOT EXISTS (SELECT 1 FROM pk_events WHERE battle_id = ? AND event_type = 'LEAD_CHANGED'
            AND side = ? AND json_extract(metadata, '$.from') = ?)`,
        params: [giftTransactionId, battleId, newLeader, oldLeader]
      }, newId(), battleId, "LEAD_CHANGED", time, { side: newLeader, metadata: { from: oldLeader } })] : []),
      db.prepare(`WITH guard AS (SELECT 1 AS allowed WHERE
          EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?))
        INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at, updated_at)
        SELECT ?, ?, ?, 'GIFT', ?, ?, ?, ? FROM guard WHERE allowed = 1`)
        .bind(giftTransactionId, newId(), roomId, userId, `PK gift: ${gift.name} +${gift.coin_price}`,
          JSON.stringify({ pkBattleId: battleId, side: body.side }), time, time)
    ]);
    } catch (error) {
      const replay = await findPkGiftReplay(userId, body.idempotencyKey);
      if (replay) {
        if (String((parseJson(replay.metadata, {}) as Record<string, unknown>).pkBattleId) !== battleId) {
          throw new HttpError(409, "Gift request key was already used", ErrorCode.CONFLICT);
        }
        const current = await readBattle(battleId);
        if (!current) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
        sendOk(res, { battle: presentPkBattle(current), giftTransaction: presentGiftTransaction(replay) }, 201);
        return;
      }
      throw error;
    }
    if (!committed[0]?.meta?.changes) throw new HttpError(500, "Failed to update PK battle", ErrorCode.INTERNAL);
    if (!committed[1]?.meta?.changes) throw new HttpError(500, "Failed to record PK gift", ErrorCode.INTERNAL);
    if (!committed[2]?.meta?.changes) {
      throw new HttpError(409, "Wallet operation key was already used for a different mutation", ErrorCode.CONFLICT);
    }
    if (!committed[3]?.meta?.changes) {
      throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
    }
    if (!committed[4]?.meta?.changes) throw new HttpError(404, "Receiver not found", ErrorCode.NOT_FOUND);
    if (!committed[7]?.meta?.changes) throw new HttpError(500, "Failed to record PK gift event", ErrorCode.INTERNAL);
    const [updatedBattle, transaction] = await Promise.all([
      readBattle(battleId),
      db.prepare("SELECT * FROM gift_transactions WHERE source_id = ?").bind(giftTransactionId).first<Row>()
    ]);
    if (!updatedBattle || !transaction) throw new HttpError(500, "Failed to load PK gift", ErrorCode.INTERNAL);
    const state = presentPkBattle(updatedBattle);
    if (newLeader !== oldLeader && newLeader !== "DRAW" && committed[8]?.meta?.changes) {
      const leadData = {
        battleId, leader: newLeader, leftScore: Number(updatedBattle.left_score),
        rightScore: Number(updatedBattle.right_score)
      };
      await publishToRoom(state.left.roomId, "pk:lead:changed", leadData);
      if (state.right.roomId !== state.left.roomId) {
        await publishToRoom(state.right.roomId, "pk:lead:changed", leadData);
      }
    }
    await publishToRooms(updatedBattle, "pk:score:update");
    const giftData = {
      battleId, side: body.side, senderId: userId, giftId, giftName: gift.name,
      coinAmount: totalPrice, quantity, pointsAdded: totalPoints, combo,
      leftScore: Number(updatedBattle.left_score), rightScore: Number(updatedBattle.right_score)
    };
    await publishToRoom(state.left.roomId, "pk:gift:received", giftData);
    if (state.right.roomId !== state.left.roomId) {
      await publishToRoom(state.right.roomId, "pk:gift:received", giftData);
    }
    sendOk(res, { battle: state, giftTransaction: presentGiftTransaction(transaction) }, 201);
  }));

  router.post("/:battleId/reactions", requireNotMuted, validateBody(pkReactionSchema), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const battleId = req.params.battleId.toLowerCase();
    const body = req.body as z.infer<typeof pkReactionSchema>;
    const battle = await readBattle(battleId);
    if (!battle || battle.status !== "ACTIVE") throw new HttpError(404, "Active PK not found", ErrorCode.NOT_FOUND);
    if (battle.in_room_battle) {
      throw new HttpError(400, "Room PK supports its configured gift or one-time votes", ErrorCode.VALIDATION);
    }
    const userId = viewerId(res);
    await assertEngagementParticipant(battleId, [battle.left_room_id, battle.right_room_id], userId);
    const sideHostId = body.side === "LEFT" ? battle.left_host_id : battle.right_host_id;
    if (sideHostId === userId) throw new HttpError(400, "Cannot react for your own side", ErrorCode.VALIDATION);
    const now = Date.now();
    const bucketKey = `${battleId}:${userId}`;
    const bucket = reactionBuckets.get(bucketKey);
    const resetAt = bucket && bucket.resetAt > now ? bucket.resetAt : now + 10_000;
    const points = reactionPoints[body.type] ?? 1;
    const used = bucket && bucket.resetAt > now ? bucket.points : 0;
    if (used + points > 10) throw new HttpError(429, "Reaction limit reached", ErrorCode.RATE_LIMITED);
    reactionBuckets.set(bucketKey, { points: used + points, resetAt });
    const oldLeader = pkLeader(Number(battle.left_score), Number(battle.right_score));
    const newLeft = Number(battle.left_score) + (body.side === "LEFT" ? points : 0);
    const newRight = Number(battle.right_score) + (body.side === "RIGHT" ? points : 0);
    const newLeader = pkLeader(newLeft, newRight);
    const time = new Date().toISOString();
    const committed = await db.batch([
      db.prepare(`UPDATE pk_battles SET left_score = ?, right_score = ?, updated_at = ?
        WHERE source_id = ? AND status = 'ACTIVE' AND left_score = ? AND right_score = ?`)
        .bind(newLeft, newRight, time, battleId, battle.left_score, battle.right_score),
      ...(newLeader !== oldLeader && newLeader !== "DRAW" ? [guardedEventInsert(db, {
        sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'ACTIVE' AND left_score = ? AND right_score = ?)",
        params: [battleId, newLeft, newRight]
      }, newId(), battleId, "LEAD_CHANGED", time, { side: newLeader, metadata: { from: oldLeader } })] : []),
      guardedEventInsert(db, {
        sql: "EXISTS (SELECT 1 FROM pk_battles WHERE source_id = ? AND status = 'ACTIVE' AND left_score = ? AND right_score = ?)",
        params: [battleId, newLeft, newRight]
      }, newId(), battleId, "REACTION_SENT", time, {
        userId, side: body.side, points, metadata: { type: body.type }
      })
    ]);
    if (!committed[0]?.meta?.changes) throw new HttpError(500, "Failed to update PK battle", ErrorCode.INTERNAL);
    const leadChanged = newLeader !== oldLeader && newLeader !== "DRAW";
    if (leadChanged && !committed[1]?.meta?.changes) {
      throw new HttpError(500, "Failed to record PK lead change", ErrorCode.INTERNAL);
    }
    const reactionEventIndex = leadChanged ? 2 : 1;
    if (!committed[reactionEventIndex]?.meta?.changes) {
      throw new HttpError(500, "Failed to record PK reaction", ErrorCode.INTERNAL);
    }
    const updated = await readBattle(battleId);
    if (!updated) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    const state = presentPkBattle(updated);
    if (leadChanged) {
      const leadData = {
        battleId, leader: newLeader, leftScore: Number(updated.left_score), rightScore: Number(updated.right_score)
      };
      await publishToRoom(state.left.roomId, "pk:lead:changed", leadData);
      if (state.right.roomId !== state.left.roomId) {
        await publishToRoom(state.right.roomId, "pk:lead:changed", leadData);
      }
    }
    await publishToRooms(updated, "pk:score:update");
    const reactionData = {
      battleId, side: body.side, type: body.type, pointsAdded: points,
      bucketRemaining: Math.max(0, 10 - (used + points))
    };
    await publishToRoom(state.left.roomId, "pk:reaction:received", reactionData);
    if (state.right.roomId !== state.left.roomId) {
      await publishToRoom(state.right.roomId, "pk:reaction:received", reactionData);
    }
    sendOk(res, { battle: state }, 201);
  }));

  return router;
}
