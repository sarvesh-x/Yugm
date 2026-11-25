import type { D1Database, D1PreparedStatement } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { xpDailyCaps, relationshipXpEvents, xpEvents } from "@yugm/shared";
import type { AccessClaims } from "../services/accessSession.js";
import { moderateContent } from "../services/contentModeration.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { dailyRelationshipMessageXpCap, dailyRelationshipRoomDmXpCap, relationshipPairKey } from "../services/relationshipPresentation.js";
import { getVipStatus } from "../services/vip.js";
import { ErrorCode, HttpError, isValidObjectId, sanitizeText } from "../utils/http.js";
import { bindD1LiveUser, d1LiveUserFilter } from "./d1AccessSession.js";
import { chatRestricted, recordD1ChatModeration } from "./d1ChatModeration.js";
import { visiblePerson } from "./d1People.js";
import { prepareRelationship, type PairDailyTable, type Relationship } from "./d1RelationshipAward.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

const event = "CHAT_MESSAGE";
const dailyCap = xpDailyCaps[event]!;
const newId = () => randomBytes(12).toString("hex");
const messageExists = "EXISTS (SELECT 1 FROM direct_messages WHERE source_id = ?)";
const userAward = `SELECT COALESCE(SUM(amount), 0) FROM xp_daily_caps WHERE user_id = ? AND event = 'CHAT_MESSAGE' AND day = ?`;
const relationshipRow = "SELECT * FROM relationships WHERE pair_key = ? ORDER BY source_id LIMIT 1";
const actorQuery = `SELECT u.xp, u.level, u.wallet_balance, u.last_daily_check_in_at, u.muted_until,
  u.vip_level, u.vip_tier, u.vip_expires_at, u.vip_frozen, ${chatRestricted} AS chat_restricted
  FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL`;
const peerQuery = `SELECT ${visiblePerson("peer", "?2")} AS visible, peer.vip_chat_privacy, peer.deletion_requested_at,
  EXISTS (SELECT 1 FROM follows WHERE follower_id = ?2 AND following_id = ?1) AS sender_follows_peer
  FROM users AS peer WHERE peer.source_id = ?1`;
const profileFields: Record<string, string> = { level_title: "levelTitle", wallet_balance: "walletBalance" };

type Actor = {
  xp: number; level: number; wallet_balance: number; last_daily_check_in_at: string | null;
  muted_until: string | null; chat_restricted: number; vip_level: number; vip_tier: string | null;
  vip_expires_at: string | null; vip_frozen: number;
};
type Peer = { visible: number; vip_chat_privacy: string; sender_follows_peer: number; deletion_requested_at: string | null };
const roomMember = (user: string) => `EXISTS (SELECT 1 FROM room_participants
  WHERE room_id = r.source_id AND user_id = ${user} AND left_at IS NULL)`;

function assertSender(actor?: Actor | null): asserts actor is Actor {
  if (!actor) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
  if (actor.muted_until && Date.parse(actor.muted_until) > Date.now()) {
    throw new HttpError(403, `Account muted until ${actor.muted_until}`, ErrorCode.FORBIDDEN);
  }
  if (actor.chat_restricted) throw new HttpError(403, "Chat access restricted", ErrorCode.FORBIDDEN);
}

function messageInput(body: Record<string, unknown>) {
  if (body.mediaUrl) throw new HttpError(415, "Chat attachment uploads are unavailable", ErrorCode.VALIDATION);
  const original = typeof body.message === "string" ? body.message.trim() : "";
  const message = sanitizeText(original).trim();
  if (!message) throw new HttpError(400, "Message cannot be empty", ErrorCode.VALIDATION);
  if (body.replyToId && (typeof body.replyToId !== "string" || !isValidObjectId(body.replyToId))) {
    throw new HttpError(400, "Invalid reply target", ErrorCode.VALIDATION);
  }
  return { original, message, replyId: typeof body.replyToId === "string" && body.replyToId ? body.replyToId.toLowerCase() : null };
}

export async function sendD1DirectMessage<MessageRow>(
  db: D1Database, claims: AccessClaims, recipient: string, body: Record<string, unknown>,
  readMessage: (id: string) => D1PreparedStatement, roomId: string | null = null
) {
  const sender = claims.sub;
  if (recipient === sender) throw new HttpError(400, "Cannot message yourself", ErrorCode.VALIDATION);
  const input = messageInput(body);
  const check = moderateContent(input.original);
  if (!check.isClean) {
    const time = new Date().toISOString();
    assertSender(await db.prepare(actorQuery).bind(...bindD1LiveUser(claims, time)).first<Actor>());
    await recordD1ChatModeration(db, claims, time, check);
    if (check.action === "BLOCK") throw new HttpError(400, "Content was blocked by auto-moderation", ErrorCode.CONTENT_BLOCKED);
  }

  const id = newId();
  const pair = relationshipPairKey(sender, recipient);
  const dailyTable: PairDailyTable = roomId ? "relationship_room_dm_xp_daily" : "relationship_message_xp_daily";
  const pairAward = `SELECT COALESCE(SUM(amount), 0) FROM ${dailyTable} WHERE pair_key = ? AND day = ?`;
  const pairCap = roomId ? dailyRelationshipRoomDmXpCap : dailyRelationshipMessageXpCap;
  const pairEvent = roomId ? "ROOM_DM_SENT" : "MESSAGE_SENT";
  const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, id);
  const replyQuery = `SELECT r.*, author.name FROM direct_messages AS r JOIN users AS author ON author.source_id = r.sender_id
    WHERE r.source_id = ?3 AND ((r.sender_id = ?1 AND r.receiver_id = ?2) OR (r.sender_id = ?2 AND r.receiver_id = ?1))
      AND NOT EXISTS (SELECT 1 FROM message_hidden_for WHERE direct_messages_id = r.source_id AND value = ?1)`;
  for (let attempt = 0; attempt < 5; attempt++) {
    const now = new Date();
    const time = now.toISOString();
    const day = startOfUtcDay(now).toISOString();
    const actorArgs = bindD1LiveUser(claims, time);
    const [actorRead, peerRead, points, relationshipRead] = await db.batch([
      db.prepare(actorQuery).bind(...actorArgs),
      db.prepare(peerQuery).bind(recipient, sender),
      db.prepare(`SELECT (${userAward}) AS user_xp, (${pairAward}) AS pair_xp`).bind(sender, day, pair, day),
      db.prepare(relationshipRow).bind(pair)
    ]);
    const state = actorRead.results[0] as Actor | undefined;
    assertSender(state);
    const peer = peerRead.results[0] as Peer | undefined;
    if (!peer || peer.deletion_requested_at) throw new HttpError(404, "This account is no longer available", ErrorCode.NOT_FOUND);
    if (!peer.visible) throw new HttpError(403, "Cannot message this user", ErrorCode.FORBIDDEN);
    const vip = getVipStatus({
      vipTier: state.vip_tier, vipLevel: state.vip_level, vipExpiresAt: state.vip_expires_at, vipFrozen: state.vip_frozen
    }, now).isVip;
    if (!roomId && peer.vip_chat_privacy === "FOLLOWERS" && !vip && !peer.sender_follows_peer) {
      throw new HttpError(403, "This user only accepts messages from followers", ErrorCode.FORBIDDEN);
    }
    if (roomId) {
      const room = await db.prepare(`SELECT r.host_id, ${roomMember("?2")} AS sender_active, ${roomMember("?3")} AS receiver_active
        FROM rooms AS r WHERE r.source_id = ?1`).bind(roomId, sender, recipient)
        .first<{ host_id: string; sender_active: number; receiver_active: number }>();
      if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
      if (!room.sender_active || (room.host_id !== sender && room.host_id !== recipient)) {
        throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
      }
      if (!room.receiver_active) throw new HttpError(400, "Receiver is not in the room", ErrorCode.VALIDATION);
    }
    if (input.replyId && !await db.prepare(replyQuery).bind(sender, recipient, input.replyId).first()) {
      throw new HttpError(404, "Reply target not found", ErrorCode.NOT_FOUND);
    }
    const { user_xp: earned, pair_xp: sharedEarned } = points.results[0] as { user_xp: number; pair_xp: number };
    const previous = relationshipRead.results[0] as Relationship | undefined;
    const xpAwarded = Math.max(0, Math.min(xpEvents[event], dailyCap - earned));
    const relationship = prepareRelationship(write, messageExists, previous,
      Math.max(0, Math.min(relationshipXpEvents[pairEvent], pairCap - sharedEarned)),
      [sender, recipient], now, pair, day, dailyTable);
    const progression = prepareD1XpGrant(write, messageExists, now, {
      userId: sender, event, actionKey: "message:" + id, requestedXp: xpEvents[event], xpAwarded,
      previousXp: state.xp, previousLevel: state.level, balanceBefore: state.wallet_balance,
      lastDailyCheckInAt: state.last_daily_check_in_at ?? undefined,
      cap: { capped: earned + xpAwarded >= dailyCap, cap: dailyCap,
        earnedToday: earned + xpAwarded, remainingToday: Math.max(0, dailyCap - earned - xpAwarded) }
    });
    const claim = db.prepare(`WITH reply AS (${replyQuery})
      INSERT INTO direct_messages (source_id, sender_id, receiver_id, room_id, message, media_url, media_type,
        duration, forwarded, is_edited, read, created_at, updated_at,
        reply_to_message_id, reply_to_author, reply_to_author_id, reply_to_text, reply_to_media_url)
      SELECT ?4, u.source_id, peer.source_id, ?8, ?5, '', '', 0, 0, 0, 0, ?6, ?6,
        COALESCE(reply.source_id, ''), COALESCE(reply.name, ''), reply.sender_id,
        COALESCE(reply.message, ''), COALESCE(reply.media_url, '')
      FROM users AS u JOIN users AS peer ON peer.source_id = ?2 LEFT JOIN reply ON 1 = 1
      WHERE ((?8 IS NULL AND (peer.vip_chat_privacy <> 'FOLLOWERS' OR ?7 = 1
          OR EXISTS (SELECT 1 FROM follows WHERE follower_id = ?1 AND following_id = ?2)))
        OR EXISTS (SELECT 1 FROM rooms AS r WHERE r.source_id = ?8 AND (r.host_id = ?1 OR r.host_id = ?2)
          AND ${roomMember("?1")} AND ${roomMember("?2")}))
        AND ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL
        AND (u.muted_until IS NULL OR u.muted_until <= ?6) AND NOT ${chatRestricted}
        AND ${visiblePerson("peer", "?1")}
        AND (?3 IS NULL OR reply.source_id IS NOT NULL)
        AND u.xp = ? AND u.level = ? AND u.wallet_balance = ? AND u.last_daily_check_in_at IS ?
        AND u.vip_tier IS ? AND u.vip_level IS ? AND u.vip_expires_at IS ? AND u.vip_frozen IS ?
        AND (${userAward}) = ? AND (${pairAward}) = ?
        AND (SELECT json_array(source_id, xp, level, streak_days, last_streak_at) FROM relationships
          WHERE pair_key = ? ORDER BY source_id LIMIT 1) IS ?`)
      .bind(sender, recipient, input.replyId, id, input.message, time, Number(vip), roomId, ...actorArgs,
        state.xp, state.level, state.wallet_balance, state.last_daily_check_in_at,
        state.vip_tier, state.vip_level, state.vip_expires_at, state.vip_frozen,
        sender, day, earned, pair, day, sharedEarned, pair,
        previous ? JSON.stringify([previous.source_id, previous.xp, previous.level, previous.streak_days, previous.last_streak_at]) : null);

    const writes = [
      claim,
      ...(!roomId ? [write(`UPDATE direct_messages SET read = 1, updated_at = ? WHERE sender_id = ? AND receiver_id = ? AND read = 0
        AND (created_at IS NULL OR created_at <= ?) AND NOT EXISTS (
          SELECT 1 FROM message_hidden_for WHERE direct_messages_id = direct_messages.source_id AND value = ?
        ) AND ${messageExists}`, time, recipient, sender, time, sender)] : []),
      write(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, m.receiver_id, 'MESSAGE', 'New message', u.name || ': ' || m.message,
          CASE WHEN m.room_id IS NULL THEN json_object('partnerId', m.sender_id, 'messageId', m.source_id)
            ELSE json_object('roomId', m.room_id, 'partnerId', m.sender_id, 'messageId', m.source_id) END, 0, ?, ?
        FROM direct_messages AS m JOIN users AS u ON u.source_id = m.sender_id
        WHERE (m.room_id IS NOT NULL OR NOT EXISTS (
          SELECT 1 FROM conversation_mutes WHERE owner_id = m.receiver_id AND partner_id = m.sender_id AND muted = 1
        )) AND m.source_id = ?`, newId(), time, time),
      ...progression.statements,
      ...relationship.statements
    ];
    if (xpAwarded > 0) {
      const columns = Object.entries(progression.columns);
      const fields = JSON.stringify(columns.map(([field]) => profileFields[field] ?? field));
      writes.push(
        write(`UPDATE users SET ${columns.map(([key]) => key + " = ?").join(", ")}, updated_at = ?
          WHERE source_id = ? AND ${messageExists}`, ...columns.map(([, value]) => value), time, sender),
        write(`UPDATE user_auth_profile SET
          null_fields = (SELECT json_group_array(value) FROM json_each(null_fields) WHERE value NOT IN (SELECT value FROM json_each(?))),
          missing_fields = (SELECT json_group_array(value) FROM json_each(missing_fields) WHERE value NOT IN (SELECT value FROM json_each(?)))
          WHERE source_id = ? AND ${messageExists}`, fields, fields, sender),
        write(`UPDATE xp_daily_caps SET amount = amount + ?, updated_at = ?
          WHERE source_id = (SELECT source_id FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ? ORDER BY source_id LIMIT 1)
          AND ${messageExists}`, xpAwarded, time, sender, event, day),
        write(`INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ?)
            AND ${messageExists}`, newId(), sender, event, day, xpAwarded, time, time, sender, event, day)
      );
    }
    const committed = await db.batch<MessageRow>([...writes, readMessage(id)]);
    if (committed[0].meta.changes > 0) {
      const message = committed.at(-1)?.results[0];
      if (!message) throw new HttpError(500, "Committed message unavailable", ErrorCode.INTERNAL);
      return { message, relationship: relationship.status, xpGrant: progression.xpGrant };
    }
  }
  throw new HttpError(409, "Conversation changed. Please try again.", ErrorCode.CONFLICT);
}
