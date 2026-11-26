import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { createLiveKitToken, type D1LiveKitConfig } from "./d1LiveKit.js";
import { person, personJson } from "./d1People.js";
import { pkBattleJoins, pkBattleProjection, presentPkBattle, type BattleRow } from "./d1RoomPkHistory.js";

type Row = Record<string, string | number | null>;

const activeStatuses = "'INVITED', 'WAITING', 'PREPARING', 'READY', 'COUNTDOWN', 'ACTIVE', 'FINAL_CRUNCH', 'FINALIZING', 'COMPLETED'";
const terminalStatuses = "'ENDED', 'FORCE_ENDED', 'COMPLETED', 'CLOSED', 'ABORTED', 'CANCELLED'";
const optional = (field: string, value: unknown) => value == null ? {} : { [field]: value };

function parseJson(value: unknown, fallback: unknown) {
  if (typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function presentUser(record: string) {
  const user = person(record) as Record<string, any>;
  return {
    _id: user._id,
    ...optional("name", user.name),
    ...optional("username", user.username),
    ...optional("avatar", user.avatar),
    ...optional("avatarType", user.avatarType),
    ...optional("avatarParts", user.avatarParts),
    activeCosmetics: user.activeCosmetics ?? {}
  };
}

function presentInvite(row: Row) {
  return {
    _id: row.source_id,
    battleId: row.battle_id,
    inviterUserId: row.inviter_user_id,
    inviteeUserId: row.invitee_user_id,
    inviterRoomId: row.inviter_room_id,
    inviteeRoomId: row.invitee_room_id,
    status: row.status,
    expiresAt: row.expires_at,
    ...optional("respondedAt", row.responded_at),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    __v: 0
  };
}

function presentEvent(row: Row) {
  return {
    _id: row.source_id,
    battleId: row.battle_id,
    ...optional("roomId", row.room_id),
    ...optional("userId", row.user_id),
    ...optional("side", row.side),
    eventType: row.event_type,
    points: row.points,
    stateVersion: row.state_version,
    ...optional("sequence", row.sequence),
    ...optional("giftTransactionId", row.gift_transaction_id),
    metadata: parseJson(row.metadata, {}),
    createdAt: row.created_at,
    __v: 0
  };
}

function presentLeaderboardEntry(row: Row) {
  return {
    _id: row.source_id,
    battleId: row.battle_id,
    userId: presentUser(String(row.user_json ?? "{}")),
    side: row.side,
    totalPoints: row.total_points,
    totalGiftsSent: row.total_gifts_sent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    __v: 0
  };
}

export function createD1PkReadsRouter(db: D1Database, livekit: D1LiveKitConfig = {}) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.pkSession = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const viewerId = (res: any): string => res.locals.pkSession.user.id;

  const readBattle = (id: string) => db.prepare(`SELECT ${pkBattleProjection}
    FROM pk_battles AS b ${pkBattleJoins} WHERE b.source_id = ? LIMIT 1`).bind(id).first<BattleRow>();

  const readInvite = (battleId: string, options: { viewer?: string; pending?: boolean } = {}) => {
    const clauses = ["battle_id = ?"];
    const values: string[] = [battleId];
    if (options.pending) clauses.push("status = 'PENDING'");
    if (options.viewer) {
      clauses.push("(invitee_user_id = ? OR inviter_user_id = ?)");
      values.push(options.viewer, options.viewer);
    }
    return db.prepare(`SELECT * FROM pk_invites WHERE ${clauses.join(" AND ")}
      ORDER BY created_at DESC, source_id DESC LIMIT 1`).bind(...values).first<Row>();
  };

  router.use(authenticate);

  router.get("/active/:roomId", asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
    const row = await db.prepare(`SELECT ${pkBattleProjection}
      FROM pk_battles AS b ${pkBattleJoins}
      WHERE b.status IN (${activeStatuses}) AND (b.left_room_id = ?1 OR b.right_room_id = ?1)
      ORDER BY b.created_at DESC, b.source_id DESC LIMIT 1`).bind(req.params.roomId.toLowerCase()).first<BattleRow>();
    if (!row) {
      sendOk(res, { battle: null, invite: null });
      return;
    }
    const viewer = viewerId(res);
    const [vote, ready, invite] = await Promise.all([
      row.mode === "VOTE"
        ? db.prepare("SELECT side FROM pk_votes WHERE battle_id = ? AND voter_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 1")
          .bind(row.source_id, viewer).first<Row>()
        : Promise.resolve(null),
      db.prepare("SELECT 1 FROM pk_participants WHERE battle_id = ? AND user_id = ? AND is_ready = 1 AND left_at IS NULL LIMIT 1")
        .bind(row.source_id, viewer).first(),
      readInvite(row.source_id, { viewer, pending: true })
    ]);
    sendOk(res, {
      battle: { ...presentPkBattle(row), myVote: vote?.side ?? null, myReady: Boolean(ready) },
      invite: invite ? presentInvite(invite) : null
    });
  }));

  router.get("/available-opponents", asyncHandler(async (req, res) => {
    const rawLimit = Number(req.query.limit) || 20;
    const limit = Math.min(Math.abs(Math.trunc(rawLimit)), 50);
    const battleType = typeof req.query.battleType === "string" ? req.query.battleType : undefined;
    const search = typeof req.query.search === "string" ? req.query.search : undefined;
    const clauses = [
      "r.status = 'LIVE'",
      "r.visibility = 'PUBLIC'",
      "u.is_blocked = 0",
      "u.source_id <> ?1",
      `r.source_id NOT IN (
        SELECT left_room_id FROM pk_battles WHERE status IN (${activeStatuses})
        UNION SELECT right_room_id FROM pk_battles WHERE status IN (${activeStatuses})
      )`
    ];
    const bindings: Array<string | number> = [viewerId(res)];
    if (battleType !== undefined) {
      clauses.push(`r.type = ?${bindings.length + 1}`);
      bindings.push(battleType);
    }
    if (search) {
      const pattern = `%${search.replace(/[\\%_]/g, "\\$&")}%`;
      clauses.push(`(r.title LIKE ?${bindings.length + 1} ESCAPE '\\' OR r.category LIKE ?${bindings.length + 2} ESCAPE '\\' OR r.language LIKE ?${bindings.length + 3} ESCAPE '\\')`);
      bindings.push(pattern, pattern, pattern);
    }
    bindings.push(limit);
    const { results } = await db.prepare(`SELECT r.source_id, r.title, r.type, r.category, r.language,
        r.participant_count, ${personJson("u")} AS host_json
      FROM rooms AS r JOIN users AS u ON u.source_id = r.host_id
      WHERE ${clauses.join(" AND ")}
      ORDER BY r.participant_count DESC, r.created_at DESC, r.source_id DESC
      LIMIT ?${bindings.length}`).bind(...bindings).all<Row>();
    sendOk(res, {
      opponents: results.map((row) => {
        const host = person(String(row.host_json ?? "{}")) as Record<string, any>;
        return {
          roomId: row.source_id,
          roomTitle: row.title,
          battleType: row.type,
          category: row.category,
          language: row.language,
          participantCount: row.participant_count ?? 0,
          hostId: host._id ?? "",
          hostName: host.name ?? "Host",
          ...optional("hostAvatar", host.avatar),
          ...optional("hostAvatarType", host.avatarType),
          ...optional("hostAvatarParts", host.avatarParts),
          activeCosmetics: host.activeCosmetics ?? {}
        };
      })
    });
  }));

  router.get("/history/user/:userId", asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid userId", ErrorCode.VALIDATION);
    const userId = req.params.userId.toLowerCase();
    const { results } = await db.prepare(`SELECT ${pkBattleProjection}
      FROM pk_battles AS b ${pkBattleJoins}
      WHERE b.status IN (${terminalStatuses})
        AND (b.left_host_id = ?1 OR b.right_host_id = ?1 OR EXISTS (
          SELECT 1 FROM pk_participants AS p WHERE p.battle_id = b.source_id AND p.user_id = ?1
        ))
      ORDER BY b.ended_at DESC, b.source_id DESC LIMIT 50`).bind(userId).all<BattleRow>();
    sendOk(res, { battles: results.map(row => presentPkBattle(row)) });
  }));

  router.get("/history/room/:roomId", asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
    const roomId = req.params.roomId.toLowerCase();
    const { results } = await db.prepare(`SELECT ${pkBattleProjection}
      FROM pk_battles AS b ${pkBattleJoins}
      WHERE b.status IN (${terminalStatuses}) AND (b.left_room_id = ?1 OR b.right_room_id = ?1)
      ORDER BY b.created_at DESC, b.source_id DESC LIMIT 50`).bind(roomId).all<BattleRow>();
    sendOk(res, { battles: results.map(row => presentPkBattle(row)) });
  }));

  router.get("/:battleId/events", asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const { results } = await db.prepare("SELECT * FROM pk_events WHERE battle_id = ? ORDER BY created_at ASC, source_id ASC LIMIT 200")
      .bind(req.params.battleId.toLowerCase()).all<Row>();
    sendOk(res, { events: results.map(presentEvent) });
  }));

  router.get("/:battleId/leaderboard", asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const { results } = await db.prepare(`SELECT e.*, ${personJson("u")} AS user_json
      FROM pk_leaderboard_entries AS e JOIN users AS u ON u.source_id = e.user_id
      WHERE e.battle_id = ? ORDER BY e.total_points DESC, e.source_id ASC LIMIT 50`)
      .bind(req.params.battleId.toLowerCase()).all<Row>();
    sendOk(res, { entries: results.map(presentLeaderboardEntry) });
  }));

  router.get("/:battleId/media-sessions", asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const battleId = req.params.battleId.toLowerCase();
    const roomId = typeof req.query.roomId === "string" ? req.query.roomId : "";
    if (!isValidObjectId(roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
    const battle = await db.prepare(`SELECT source_id, status, battle_type, left_room_id, right_room_id, left_host_id, right_host_id
      FROM pk_battles WHERE source_id = ?`).bind(battleId).first<Row>();
    if (!battle || battle.status !== "ACTIVE" || battle.battle_type !== "VIDEO") {
      throw new HttpError(404, "Active video PK not found", ErrorCode.NOT_FOUND);
    }
    const leftRoomId = String(battle.left_room_id);
    const rightRoomId = String(battle.right_room_id);
    if (roomId !== leftRoomId && roomId !== rightRoomId) {
      throw new HttpError(403, "Room is not in this PK", ErrorCode.FORBIDDEN);
    }
    const viewer = viewerId(res);
    const isHost = [String(battle.left_host_id), String(battle.right_host_id)].includes(viewer);
    const participant = isHost ? true : await db.prepare(
      "SELECT 1 FROM room_participants WHERE room_id = ? AND user_id = ? AND left_at IS NULL LIMIT 1"
    ).bind(roomId, viewer).first();
    if (!participant) {
      throw new HttpError(403, "Join your PK room before subscribing to opponent media", ErrorCode.FORBIDDEN);
    }
    const opponentRoomId = roomId === leftRoomId ? rightRoomId : leftRoomId;
    const opponentRoom = await db.prepare("SELECT title, livekit_room_name FROM rooms WHERE source_id = ?")
      .bind(opponentRoomId).first<Row>();
    if (!opponentRoom) throw new HttpError(404, "Opponent room not found", ErrorCode.NOT_FOUND);
    if (!livekit.apiKey || !livekit.apiSecret) {
      throw new HttpError(503, "LiveKit credentials are not configured");
    }
    if (!livekit.url?.trim() || (livekit.production && !livekit.url.startsWith("wss://"))) {
      throw new HttpError(503, "LiveKit URL is not configured for production");
    }
    const token = await createLiveKitToken({ apiKey: livekit.apiKey, apiSecret: livekit.apiSecret, url: livekit.url }, {
      identity: `${viewerId(res)}:pk:${req.params.battleId}:opponent`,
      roomName: String(opponentRoom.livekit_room_name),
      publishSources: []
    });
    sendOk(res, {
      opponent: {
        token,
        url: livekit.url,
        roomId: opponentRoomId,
        roomName: opponentRoom.livekit_room_name,
        title: opponentRoom.title,
        role: "PK_OPPONENT_VIEWER"
      }
    });
  }));

  router.get("/:battleId", asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
    const battle = await readBattle(req.params.battleId.toLowerCase());
    if (!battle) throw new HttpError(404, "PK battle not found", ErrorCode.NOT_FOUND);
    const invite = await readInvite(battle.source_id);
    sendOk(res, { battle: presentPkBattle(battle), invite: invite ? presentInvite(invite) : null });
  }));

  return router;
}
