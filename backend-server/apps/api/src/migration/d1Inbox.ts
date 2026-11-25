import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import { reactionSchema } from "@yugm/shared";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { moderateContent } from "../services/contentModeration.js";
import { isActiveVip, normalizeReactionId } from "../services/reactionCatalog.js";
import type { AccessClaims } from "../services/accessSession.js";
import { getRelationshipStatus, relationshipPairKey } from "../services/relationshipPresentation.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { chatRestricted, recordD1ChatModeration } from "./d1ChatModeration.js";
import { sendD1DirectMessage } from "./d1MessageSend.js";
import { d1UserId, person, personJson, visiblePerson } from "./d1People.js";
import { ensureDefaultReactions } from "./d1RoomReactions.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

export type InboxMessage = {
  source_id: string; message: string; sender_json: string; receiver_json: string; room_id: string | null;
  media_url: string; media_type: string; duration: number; forwarded: number; is_edited: number; read: number;
  created_at: string | null; updated_at: string | null; edited_at: string | null; reactions_json: string;
  reply_to_message_id: string; reply_to_author: string; reply_to_author_id: string | null; reply_to_text: string; reply_to_media_url: string;
};

export function presentD1InboxMessage(row: InboxMessage) {
  return {
    _id: row.source_id, senderId: person(row.sender_json), receiverId: person(row.receiver_json),
    roomId: row.room_id ?? undefined, message: row.message, mediaUrl: row.media_url, mediaType: row.media_type,
    duration: row.duration, forwarded: Boolean(row.forwarded), isEdited: Boolean(row.is_edited),
    read: Boolean(row.read), createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined,
    editedAt: row.edited_at ?? undefined, reactions: JSON.parse(row.reactions_json),
    replyTo: row.reply_to_message_id ? {
      messageId: row.reply_to_message_id, author: row.reply_to_author, authorId: row.reply_to_author_id ?? undefined,
      text: row.reply_to_text, mediaUrl: row.reply_to_media_url
    } : undefined
  };
}

const visibleMessage = `NOT EXISTS (
  SELECT 1 FROM message_hidden_for WHERE direct_messages_id = m.source_id AND value = ?1
)`;
const conversationPair = "((m.sender_id = ?1 AND m.receiver_id = ?2) OR (m.sender_id = ?2 AND m.receiver_id = ?1))";
const visiblePeople = `${visiblePerson("sender", "?1")} AND ${visiblePerson("receiver", "?1")}`;
const activeActor = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL)`;
const chatActor = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL
  AND (u.muted_until IS NULL OR u.muted_until <= ?) AND NOT ${chatRestricted})`;
const messageList = `SELECT m.*, ${personJson("sender")} AS sender_json, ${personJson("receiver")} AS receiver_json,
  (SELECT json_group_array(json_object('userId', user_id, 'type', type, 'createdAt', created_at))
   FROM (SELECT user_id, type, created_at FROM direct_message_reactions WHERE direct_messages_id = m.source_id ORDER BY position)
  ) AS reactions_json
  FROM direct_messages AS m
  JOIN users AS sender ON sender.source_id = m.sender_id
  JOIN users AS receiver ON receiver.source_id = m.receiver_id`;
const mostRecent = "ORDER BY m.created_at DESC, m.source_id DESC";

type ConversationPeer = { deletion_requested_at: string | null; is_blocked: number; accessible: number };
type ConversationDetails = { muted: number; relationship_json: string | null };
type MessageActor = { muted_until: string | null; chat_restricted: number; vip_level: number;
  vip_tier: string | null; vip_frozen: number; vip_expires_at: string | null };
const newId = () => randomBytes(12).toString("hex");
const editWindow = 15 * 60 * 1000;
const missingMessage = () => new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
const writablePeer = `EXISTS (SELECT 1 FROM users peer WHERE peer.source_id = ?2 AND ${visiblePerson("peer", "?1")})`;

async function writableActor(db: D1Database, claims: AccessClaims, now: string) {
  const row = await db.prepare(`SELECT muted_until, ${chatRestricted} AS chat_restricted, vip_level, vip_tier, vip_frozen, vip_expires_at
    FROM users AS u WHERE ${d1LiveUserFilter} AND deletion_requested_at IS NULL`)
    .bind(...bindD1LiveUser(claims, now)).first<MessageActor>();
  if (!row) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
  if (row.muted_until && row.muted_until > now) throw new HttpError(403, `Account muted until ${row.muted_until}`, ErrorCode.FORBIDDEN);
  if (row.chat_restricted) throw new HttpError(403, "Chat access restricted", ErrorCode.FORBIDDEN);
  return row;
}

function messageId(value: unknown) {
  if (typeof value !== "string" || !isValidObjectId(value)) throw new HttpError(400, "Invalid message or user ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
}

function beforeDate(value: unknown) {
  const timestamp = Date.parse(String(value ?? "").trim());
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function pageLimit(value: unknown, max: number) {
  return Math.trunc(Math.min(Math.max(Number(value) || 100, 1), max));
}

function pageOfMessages(rows: InboxMessage[], limit: number, chronological = false) {
  const messages = rows.slice(0, limit).map(presentD1InboxMessage);
  const nextBefore = messages.at(-1)?.createdAt ?? null;
  if (chronological) messages.reverse();
  return { messages, hasMore: rows.length > limit, nextBefore };
}

function assertPeer(row: ConversationPeer | null | undefined, blockedMessage: string) {
  if (!row || row.deletion_requested_at || row.is_blocked) {
    throw new HttpError(404, "This account is no longer available", ErrorCode.NOT_FOUND);
  }
  if (!row.accessible) throw new HttpError(403, blockedMessage, ErrorCode.FORBIDDEN);
}

export function createD1InboxRouter(db: D1Database, allowDirectMessage?: D1UserRateLimit) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, access);
  const peerState = (actor: string, partner: string) => db.prepare(`SELECT peer.deletion_requested_at, peer.is_blocked,
    ${visiblePerson("peer", "?1")} AS accessible FROM users AS peer WHERE peer.source_id = ?2`).bind(actor, partner);
  const snapshot = (id: string) => db.prepare(`${messageList} WHERE m.source_id = ?`).bind(id);

  async function removeOwned(claims: AccessClaims, recipient: string, ids: string[]) {
    const filter = `SELECT m.source_id FROM direct_messages AS m WHERE m.sender_id = ?1 AND m.receiver_id = ?2
      AND m.source_id IN (SELECT value FROM json_each(?3)) AND ${activeActor}`;
    const args = [claims.sub, recipient, JSON.stringify(ids), ...bindD1LiveUser(claims, new Date().toISOString())];
    const [, , , deleted] = await db.batch<{ source_id: string }>([
      db.prepare(`DELETE FROM direct_message_reactions WHERE direct_messages_id IN (${filter})`).bind(...args),
      db.prepare(`DELETE FROM message_hidden_for WHERE direct_messages_id IN (${filter})`).bind(...args),
      db.prepare(`UPDATE direct_messages SET reply_to_message_id = '', reply_to_author = '', reply_to_author_id = NULL,
        reply_to_text = '', reply_to_media_url = '' WHERE reply_to_message_id IN (${filter})`).bind(...args),
      db.prepare(`DELETE FROM direct_messages WHERE source_id IN (${filter}) RETURNING source_id`).bind(...args)
    ]);
    return deleted.results.map(row => row.source_id);
  }

  function markUnread(claims: AccessClaims, time: string, partner?: string) {
    return db.prepare(`UPDATE direct_messages AS m SET read = 1, updated_at = ?2
      WHERE m.receiver_id = ?1 AND m.read = 0 AND ${visibleMessage}
        AND (m.created_at IS NULL OR m.created_at <= ?2)
        ${partner ? "AND m.sender_id = ?" : ""}
        AND EXISTS (SELECT 1 FROM users AS sender WHERE sender.source_id = m.sender_id AND ${visiblePerson("sender", "?1")})
        AND ${activeActor}`).bind(claims.sub, time, ...(partner ? [partner] : []), ...bindD1LiveUser(claims, time));
  }

  router.get("/", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const limit = pageLimit(req.query.limit, 200);
    const { results } = await db.prepare(`${messageList}
      WHERE (m.sender_id = ?1 OR m.receiver_id = ?1) AND ${visibleMessage}
        AND ${visiblePeople} AND (?2 IS NULL OR m.created_at < ?2)
      ${mostRecent} LIMIT ?3`).bind(user.id, beforeDate(req.query.before), limit + 1).all<InboxMessage>();
    sendOk(res, pageOfMessages(results, limit));
  }));

  router.get("/unread-counts", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const { results } = await db.prepare(`SELECT m.sender_id, COUNT(*) AS count
      FROM direct_messages AS m JOIN users AS sender ON sender.source_id = m.sender_id
      WHERE m.receiver_id = ?1 AND m.read = 0 AND ${visibleMessage} AND ${visiblePerson("sender", "?1")}
      GROUP BY m.sender_id`).bind(user.id).all<{ sender_id: string; count: number }>();
    sendOk(res, {
      unreadCounts: Object.fromEntries(results.map(row => [row.sender_id, row.count])),
      total: results.reduce((sum, row) => sum + row.count, 0)
    });
  }));

  router.get("/mutes", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const { results } = await db.prepare("SELECT DISTINCT partner_id FROM conversation_mutes WHERE owner_id = ? AND muted = 1")
      .bind(user.id).all<{ partner_id: string }>();
    sendOk(res, { partnerIds: results.map(row => row.partner_id) });
  }));

  router.post("/read-all", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    const result = await markUnread(claims, new Date().toISOString()).run();
    if (!result.meta.changes) await authenticate(req);
    sendOk(res, { updated: result.meta.changes });
  }));

  router.post("/:userId/read", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const partner = d1UserId(req.params.userId);
    const readThrough = new Date().toISOString();
    const [peer, updated] = await db.batch<ConversationPeer>([
      peerState(user.id, partner), markUnread(claims, readThrough, partner)
    ]);
    assertPeer(peer.results[0], "Cannot view this conversation");
    if (!updated.meta.changes) await authenticate(req);
    sendOk(res, { updated: updated.meta.changes, readThrough });
  }));

  router.post("/:userId", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const recipient = d1UserId(req.params.userId);
    await enforceD1UserRateLimit(allowDirectMessage, user.id, res, 10);
    const { message, relationship, xpGrant } = await sendD1DirectMessage<InboxMessage>(
      db, claims, recipient, req.body ?? {}, id => db.prepare(`${messageList} WHERE m.source_id = ?`).bind(id)
    );
    sendOk(res, { message: presentD1InboxMessage(message), relationship, xpGrant }, 201);
  }));

  router.put("/:userId/:messageId", asyncHandler(async (req, res, next) => {
    if (req.params.messageId === "mute") return next("route");
    const { claims, user } = await authenticate(req);
    const partner = d1UserId(req.params.userId);
    const id = messageId(req.params.messageId);
    await enforceD1UserRateLimit(allowDirectMessage, user.id, res, 10);
    const now = new Date();
    const time = now.toISOString();
    await writableActor(db, claims, time);
    const text = typeof req.body?.message === "string" ? req.body.message.trim() : "";
    const clean = sanitizeText(text);
    if (!clean || !text || text.length > 2000) throw new HttpError(400, "Message must be between 1 and 2000 characters", ErrorCode.VALIDATION);
    const existing = await db.prepare(`SELECT created_at, media_url FROM direct_messages m
      WHERE m.sender_id = ?1 AND m.receiver_id = ?2 AND m.source_id = ?3 AND ${visibleMessage}`)
      .bind(user.id, partner, id).first<{ created_at: string | null; media_url: string }>();
    if (!existing) throw missingMessage();
    const cutoff = new Date(now.valueOf() - editWindow).toISOString();
    if (!existing.created_at || existing.created_at < cutoff) {
      throw new HttpError(400, "Messages can only be edited for 15 minutes", ErrorCode.VALIDATION);
    }
    if (existing.media_url) throw new HttpError(400, "Media messages cannot be edited", ErrorCode.VALIDATION);
    assertPeer(await peerState(user.id, partner).first<ConversationPeer>(), "Cannot edit this conversation");
    const check = moderateContent(text);
    if (!check.isClean) {
      await recordD1ChatModeration(db, claims, time, check);
      if (check.action === "BLOCK") throw new HttpError(400, "Content was blocked by auto-moderation", ErrorCode.CONTENT_BLOCKED);
    }
    const [updated, message] = await db.batch<InboxMessage>([
      db.prepare(`UPDATE direct_messages AS m SET message = ?4, is_edited = 1, edited_at = ?5, updated_at = ?5
        WHERE m.sender_id = ?1 AND m.receiver_id = ?2 AND m.source_id = ?3 AND m.created_at >= ?6 AND m.media_url = ''
        AND ${visibleMessage} AND ${writablePeer} AND ${chatActor}`)
        .bind(user.id, partner, id, clean, time, cutoff, ...bindD1LiveUser(claims, time), time),
      snapshot(id)
    ]);
    if (!updated.meta.changes) {
      await writableActor(db, claims, time);
      throw new HttpError(409, "Message or conversation changed", ErrorCode.CONFLICT);
    }
    sendOk(res, { message: presentD1InboxMessage(message.results[0]) });
  }));

  router.post("/:userId/forward", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const partner = d1UserId(req.params.userId);
    const originalId = messageId(req.body?.messageId);
    if (partner === user.id) throw new HttpError(400, "Cannot forward a message to yourself", ErrorCode.VALIDATION);
    await enforceD1UserRateLimit(allowDirectMessage, user.id, res, 10);
    const time = new Date().toISOString();
    await writableActor(db, claims, time);
    const origin = `m.source_id = ?3 AND (m.sender_id = ?1 OR m.receiver_id = ?1) AND ${visibleMessage}`;
    const source = await db.prepare(`SELECT media_url FROM direct_messages m WHERE ${origin}`)
      .bind(user.id, partner, originalId).first<{ media_url: string }>();
    if (!source) throw missingMessage();
    if (source.media_url) throw new HttpError(415, "Message attachments cannot be forwarded", ErrorCode.VALIDATION);
    assertPeer(await peerState(user.id, partner).first<ConversationPeer>(), "Cannot message this user");
    const id = newId();
    const [created, , message] = await db.batch<InboxMessage>([
      db.prepare(`INSERT INTO direct_messages (source_id, sender_id, receiver_id, message, media_url, media_type,
        duration, forwarded, is_edited, read, created_at, updated_at, reply_to_message_id, reply_to_author, reply_to_text, reply_to_media_url)
        SELECT ?4, ?1, ?2, m.message, '', '', 0, 1, 0, 0, ?5, ?5, '', '', '', '' FROM direct_messages m
        WHERE ${origin} AND m.media_url = '' AND ${writablePeer} AND ${chatActor}`)
        .bind(user.id, partner, originalId, id, time, ...bindD1LiveUser(claims, time), time),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, m.receiver_id, 'MESSAGE', 'Forwarded message', sender.name || ' forwarded you a message',
          json_object('partnerId', m.sender_id, 'messageId', m.source_id), 0, ?, ?
        FROM direct_messages m JOIN users sender ON sender.source_id = m.sender_id WHERE m.source_id = ?
        AND NOT EXISTS (SELECT 1 FROM conversation_mutes WHERE owner_id = m.receiver_id AND partner_id = m.sender_id AND muted = 1)`)
        .bind(newId(), time, time, id),
      snapshot(id)
    ]);
    if (!created.meta.changes) {
      await writableActor(db, claims, time);
      throw new HttpError(409, "Message or conversation changed", ErrorCode.CONFLICT);
    }
    sendOk(res, { message: presentD1InboxMessage(message.results[0]) }, 201);
  }));

  router.post("/:userId/delete-selected", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const partner = d1UserId(req.params.userId);
    const ids: unknown = req.body?.messageIds;
    const scope = String(req.body?.scope ?? "").toUpperCase();
    if (!Array.isArray(ids) || ids.length < 1 || ids.length > 100 || !ids.every(id => typeof id === "string" && isValidObjectId(id))
        || !["ME", "EVERYONE"].includes(scope)) throw new HttpError(400, "Invalid message selection", ErrorCode.VALIDATION);
    await enforceD1UserRateLimit(allowDirectMessage, user.id, res, 10);
    const selection = [...new Set(ids.map((id: string) => id.toLowerCase()))];
    let deletedIds: string[];
    if (scope === "EVERYONE") deletedIds = await removeOwned(claims, partner, selection);
    else {
      const { results } = await db.prepare(`INSERT INTO message_hidden_for (source_id, value, direct_messages_id, position)
        SELECT lower(hex(randomblob(12))), ?1, m.source_id,
          COALESCE((SELECT MAX(position) + 1 FROM message_hidden_for WHERE direct_messages_id = m.source_id), 0)
        FROM direct_messages m WHERE ${conversationPair} AND ${visibleMessage} AND m.source_id IN (SELECT value FROM json_each(?3))
          AND ${activeActor} RETURNING direct_messages_id`)
        .bind(user.id, partner, JSON.stringify(selection), ...bindD1LiveUser(claims, new Date().toISOString()))
        .all<{ direct_messages_id: string }>();
      deletedIds = results.map(row => row.direct_messages_id);
    }
    if (!deletedIds.length) await authenticate(req);
    sendOk(res, { deletedIds, deletedCount: deletedIds.length, scope });
  }));

  router.delete("/:userId/:messageId", asyncHandler(async (req, res) => {
    const { claims } = await authenticate(req);
    if (!(await removeOwned(claims, d1UserId(req.params.userId), [messageId(req.params.messageId)])).length) throw missingMessage();
    sendOk(res, { deleted: true });
  }));

  router.post("/:userId/:messageId/reactions", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const partner = d1UserId(req.params.userId);
    const id = messageId(req.params.messageId);
    await enforceD1UserRateLimit(allowDirectMessage, user.id, res, 10);
    const parsed = reactionSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(422, "Invalid reaction type", ErrorCode.VALIDATION);
    const kind = normalizeReactionId(parsed.data.type);
    const time = new Date().toISOString();
    const context = `m.source_id = ?3 AND ${conversationPair} AND ${visibleMessage} AND ${writablePeer}`;
    assertPeer(await peerState(user.id, partner).first<ConversationPeer>(), "Cannot react in this conversation");
    if (!await db.prepare(`SELECT 1 FROM direct_messages m WHERE ${context}`).bind(user.id, partner, id).first()) throw missingMessage();
    await ensureDefaultReactions(db);
    // Reactions have a separate legacy permission path and can be removed after a catalog entry is disabled.
    const vip = await db.prepare(`SELECT vip_level, vip_tier, vip_expires_at, vip_frozen FROM users WHERE source_id = ?`)
      .bind(user.id).first<Pick<MessageActor, "vip_level" | "vip_tier" | "vip_expires_at" | "vip_frozen">>();
    const vipAllowed = Boolean(vip && isActiveVip({
      vipLevel: vip.vip_level, vipTier: vip.vip_tier, vipExpiresAt: vip.vip_expires_at, vipFrozen: Boolean(vip.vip_frozen)
    }));
    const reaction = newId();
    const actor = bindD1LiveUser(claims, time);
    const [added, removed, , updated] = await db.batch<InboxMessage>([
      db.prepare(`INSERT INTO direct_message_reactions (source_id, user_id, type, created_at, direct_messages_id, position)
        SELECT ?5, ?1, ?4, ?6, m.source_id,
          COALESCE((SELECT MAX(position) + 1 FROM direct_message_reactions WHERE direct_messages_id = m.source_id), 0)
        FROM direct_messages m JOIN room_reactions c ON c.source_id = ?4 AND c.is_active = 1
        WHERE ${context} AND (c.access = 'EVERYONE' OR (?7 = 1 AND EXISTS (SELECT 1 FROM users
          WHERE source_id = ?1 AND vip_level = ?8 AND vip_tier IS ?9 AND vip_expires_at IS ?10 AND vip_frozen = ?11)))
          AND ${activeActor}
        ON CONFLICT (direct_messages_id, user_id) DO UPDATE SET source_id = excluded.source_id, type = excluded.type,
          created_at = excluded.created_at, position = excluded.position
        WHERE lower(direct_message_reactions.type) <> excluded.type`)
        .bind(user.id, partner, id, kind, reaction, time, Number(vipAllowed), vip?.vip_level ?? 0,
          vip?.vip_tier ?? null, vip?.vip_expires_at ?? null, vip?.vip_frozen ?? 0, ...actor),
      db.prepare(`DELETE FROM direct_message_reactions WHERE direct_messages_id = ?3 AND user_id = ?1 AND lower(type) = ?4
        AND changes() = 0 AND EXISTS (SELECT 1 FROM direct_messages m WHERE ${context}) AND ${activeActor}`)
        .bind(user.id, partner, id, kind, ...actor),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, ?, 'MESSAGE', 'New reaction', u.name || ' reacted to your message',
          json_object('partnerId', u.source_id, 'messageId', ?), 0, ?, ?
        FROM users u WHERE u.source_id = ? AND EXISTS (SELECT 1 FROM direct_message_reactions WHERE source_id = ?)
        AND NOT EXISTS (SELECT 1 FROM conversation_mutes WHERE owner_id = ? AND partner_id = u.source_id AND muted = 1)`)
        .bind(newId(), partner, id, time, time, user.id, reaction, partner),
      snapshot(id)
    ]);
    if (!added.meta.changes && !removed.meta.changes) {
      await authenticate(req);
      const catalog = await db.prepare("SELECT access FROM room_reactions WHERE source_id = ? AND is_active = 1").bind(kind)
        .first<{ access: string }>();
      if (!catalog) throw new HttpError(400, "Reaction is not available", ErrorCode.VALIDATION);
      if (catalog.access === "VIP_EXCLUSIVE" && !vipAllowed) {
        throw new HttpError(403, "VIP membership required for this reaction", ErrorCode.FORBIDDEN);
      }
      throw new HttpError(409, "Message or conversation changed", ErrorCode.CONFLICT);
    }
    sendOk(res, { message: presentD1InboxMessage(updated.results[0]) });
  }));

  router.put("/:userId/mute", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    if (!isValidObjectId(req.params.userId) || typeof req.body?.muted !== "boolean") {
      throw new HttpError(400, "Invalid mute setting", ErrorCode.VALIDATION);
    }
    const partner = d1UserId(req.params.userId);
    if (partner === user.id) throw new HttpError(400, "Invalid mute setting", ErrorCode.VALIDATION);
    const muted: boolean = req.body.muted;
    const time = new Date().toISOString();
    const actor = bindD1LiveUser(claims, time);
    const allowed = `EXISTS (SELECT 1 FROM users AS peer WHERE peer.source_id = ?2 AND ${visiblePerson("peer", "?1")})`;
    const [peer, updated, inserted] = await db.batch<ConversationPeer>([
      peerState(user.id, partner),
      db.prepare(`UPDATE conversation_mutes SET muted = ?3, updated_at = ?4
        WHERE owner_id = ?1 AND partner_id = ?2 AND ${allowed} AND ${activeActor}`)
        .bind(user.id, partner, Number(muted), time, ...actor),
      db.prepare(`INSERT INTO conversation_mutes (source_id, owner_id, partner_id, muted, updated_at)
        SELECT ?5, ?1, ?2, ?3, ?4 WHERE ${allowed} AND ${activeActor}
          AND NOT EXISTS (SELECT 1 FROM conversation_mutes WHERE owner_id = ?1 AND partner_id = ?2)`)
        .bind(user.id, partner, Number(muted), time, randomBytes(12).toString("hex"), ...actor)
    ]);
    assertPeer(peer.results[0], "Cannot mute this conversation");
    if (!updated.meta.changes && !inserted.meta.changes) {
      await authenticate(req);
      throw new HttpError(404, "This account is no longer available", ErrorCode.NOT_FOUND);
    }
    sendOk(res, { muted });
  }));

  router.delete("/:userId", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const partner = d1UserId(req.params.userId);
    const result = await db.prepare(`INSERT INTO message_hidden_for (source_id, value, direct_messages_id, position)
      SELECT lower(hex(randomblob(12))), ?1, m.source_id,
        COALESCE((SELECT MAX(position) + 1 FROM message_hidden_for WHERE direct_messages_id = m.source_id), 0)
      FROM direct_messages AS m WHERE ${conversationPair} AND ${visibleMessage} AND ${activeActor}`)
      .bind(user.id, partner, ...bindD1LiveUser(claims, new Date().toISOString())).run();
    if (!result.meta.changes) await authenticate(req);
    sendOk(res, { deletedCount: result.meta.changes });
  }));

  router.get("/:userId/search", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const partner = d1UserId(req.params.userId);
    const query = String(req.query.q ?? "").trim();
    if (query.length < 2) throw new HttpError(400, "Search must be at least 2 characters", ErrorCode.VALIDATION);
    const limit = pageLimit(req.query.limit, 200);
    const [peer, page] = await db.batch<ConversationPeer | InboxMessage>([
      peerState(user.id, partner),
      db.prepare(`${messageList} WHERE ${conversationPair} AND ${visibleMessage} AND ${visiblePeople}
        AND instr(lower(m.message), lower(?3)) > 0 AND (?4 IS NULL OR m.created_at < ?4)
        ${mostRecent} LIMIT ?5`).bind(user.id, partner, query, beforeDate(req.query.before), limit + 1)
    ]);
    assertPeer(peer.results[0] as ConversationPeer | undefined, "Cannot search this conversation");
    sendOk(res, pageOfMessages(page.results as InboxMessage[], limit, true));
  }));

  router.get("/:userId", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const partner = d1UserId(req.params.userId);
    const limit = pageLimit(req.query.limit, 100);
    const cursor = String(req.query.before ?? "").trim();
    let before = beforeDate(cursor);
    if (!before && isValidObjectId(cursor)) {
      before = await db.prepare(`SELECT m.created_at FROM direct_messages AS m
        WHERE m.source_id = ?3 AND ${conversationPair} AND ${visibleMessage}`)
        .bind(user.id, partner, cursor.toLowerCase()).first<string>("created_at");
    }
    const markRead = !cursor && !["false", "0", "no"].includes(String(req.query.markRead ?? "").trim().toLowerCase());
    const [peer, page, details, updated] = await db.batch<ConversationPeer | InboxMessage | ConversationDetails>([
      peerState(user.id, partner),
      db.prepare(`${messageList} WHERE ${conversationPair} AND ${visibleMessage} AND ${visiblePeople}
        AND (?3 IS NULL OR m.created_at < ?3) ${mostRecent} LIMIT ?4`).bind(user.id, partner, before, limit + 1),
      db.prepare(`SELECT
        EXISTS (SELECT 1 FROM conversation_mutes WHERE owner_id = ? AND partner_id = ? AND muted = 1) AS muted,
        (SELECT json_object('xp', xp, 'level', level, 'streakDays', streak_days, 'lastInteractionAt', last_interaction_at)
         FROM relationships WHERE pair_key = ? ORDER BY source_id LIMIT 1) AS relationship_json`)
        .bind(user.id, partner, relationshipPairKey(user.id, partner)),
      ...(markRead ? [markUnread(claims, new Date().toISOString(), partner)] : [])
    ]);
    assertPeer(peer.results[0] as ConversationPeer | undefined, "Cannot view this conversation");
    if (updated && !updated.meta.changes) await authenticate(req);
    const info = details.results[0] as ConversationDetails;
    sendOk(res, {
      ...pageOfMessages(page.results as InboxMessage[], limit, true),
      muted: Boolean(info.muted),
      relationship: info.relationship_json ? getRelationshipStatus(JSON.parse(info.relationship_json)) : undefined
    });
  }));
  return router;
}
