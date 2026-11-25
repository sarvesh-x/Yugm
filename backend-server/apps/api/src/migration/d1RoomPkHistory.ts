import type { D1Database } from "@cloudflare/workers-types";
import { person, personJson } from "./d1People.js";

interface BattleRow {
  source_id: string; battle_code: string; title: string; status: string; state_version: number;
  mode: string; format: string; scope: string; team_size: number; selected_gift_id: string | null;
  battle_type: string; duration_seconds: number; countdown_ends_at: string | null; termination_reason: string;
  started_at: string | null; ended_at: string | null; winner_side: string | null;
  left_room_id: string; left_title: string; left_host_id: string; left_score: number; left_count: number;
  left_host: string; right_room_id: string; right_title: string; right_host_id: string; right_score: number;
  right_count: number; right_host: string; members: string;
}

type ParticipantRow = { side: "LEFT" | "RIGHT"; userId: string; user: unknown; isReady: number; team: string | null };
type RoomAccess = (viewer: string, alias?: string) => string;

function side(row: BattleRow, members: ParticipantRow[], name: "left" | "right") {
  const host = person(row[`${name}_host`]) as {
    name?: string; avatar?: string; avatarType?: string; avatarParts?: unknown; activeCosmetics: unknown;
  };
  return {
    roomId: row[`${name}_room_id`], roomTitle: row[`${name}_title`], hostId: row[`${name}_host_id`],
    hostName: host.name ?? "Yugm Host", hostAvatar: host.avatar, hostAvatarType: host.avatarType,
    hostAvatarParts: host.avatarParts, activeCosmetics: host.activeCosmetics, score: row[`${name}_score`],
    participantCount: row[`${name}_count`],
    members: members.filter(member => member.side === name.toUpperCase()).map(member => {
      const user = person(JSON.stringify(member.user)) as {
        name?: string; avatar?: string; avatarType?: string; avatarParts?: unknown;
      };
      return { userId: member.userId, name: user.name ?? "Player", avatar: user.avatar, avatarType: user.avatarType,
        avatarParts: user.avatarParts, isReady: Boolean(member.isReady), team: member.team ?? (name === "left" ? "A" : "B") };
    })
  };
}

const roomCount = (alias: string) => `COALESCE(NULLIF((
  SELECT COUNT(*) FROM room_participants WHERE room_id = ${alias}.source_id AND left_at IS NULL
), 0), ${alias}.participant_count, 0)`;
const ended = "status IN ('ENDED', 'FORCE_ENDED')";

export async function readD1RoomPkHistory(db: D1Database, room: string, viewer: string, roomAccess: RoomAccess) {
  const { results } = await db.prepare(`WITH matching AS (
    SELECT source_id FROM pk_battles WHERE left_room_id = ?1 AND ${ended}
    UNION SELECT source_id FROM pk_battles WHERE right_room_id = ?1 AND ${ended}
  )
  SELECT b.*, l.title AS left_title, r.title AS right_title, ${roomCount("l")} AS left_count,
    ${roomCount("r")} AS right_count, ${personJson("lh")} AS left_host, ${personJson("rh")} AS right_host,
    (SELECT json_group_array(json_object('side', p.side, 'userId', p.user_id, 'user', ${personJson("u")}, 'isReady', p.is_ready, 'team', p.team_name))
      FROM pk_participants AS p JOIN users AS u ON u.source_id = p.user_id
      WHERE p.battle_id = b.source_id AND p.left_at IS NULL) AS members
  FROM matching AS m JOIN pk_battles AS b ON b.source_id = m.source_id
  JOIN rooms AS l ON l.source_id = b.left_room_id JOIN rooms AS r ON r.source_id = b.right_room_id
  JOIN users AS lh ON lh.source_id = b.left_host_id JOIN users AS rh ON rh.source_id = b.right_host_id
  WHERE (${roomAccess("?2", "l")}) AND (${roomAccess("?2", "r")})
  ORDER BY b.created_at DESC, b.source_id DESC LIMIT 50`).bind(room, viewer).all<BattleRow>();
  const now = Date.now();
  return results.map(row => {
    const members = JSON.parse(row.members) as ParticipantRow[];
    const countdown = row.countdown_ends_at ? Math.max(0, Math.ceil((Date.parse(row.countdown_ends_at) - now) / 1000)) : 0;
    const remaining = row.started_at ? Math.max(0, row.duration_seconds - Math.floor((now - Date.parse(row.started_at)) / 1000))
      : row.duration_seconds;
    return {
      battleId: row.source_id, id: row.source_id, battleCode: row.battle_code, title: row.title, status: row.status,
      stateVersion: row.state_version, mode: row.mode, format: row.format, scope: row.scope, teamSize: row.team_size,
      selectedGiftId: row.selected_gift_id ?? "", battleType: row.battle_type, durationSeconds: row.duration_seconds,
      remainingSeconds: remaining, countdownEndsAt: row.countdown_ends_at ?? undefined, countdownSecondsRemaining: countdown,
      left: side(row, members, "left"), right: side(row, members, "right"),
      leader: row.left_score === row.right_score ? "DRAW" : row.left_score > row.right_score ? "LEFT" : "RIGHT",
      winnerSide: row.winner_side ?? undefined, terminationReason: row.termination_reason,
      startedAt: row.started_at ?? undefined, endedAt: row.ended_at ?? undefined
    };
  });
}
