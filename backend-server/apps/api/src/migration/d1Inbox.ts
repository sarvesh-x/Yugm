import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import type { AccessClaims } from "../services/accessSession.js";
import { getRelationshipStatus, relationshipPairKey } from "../services/relationshipPresentation.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { sendD1DirectMessage } from "./d1MessageSend.js";
import { d1UserId, person, personJson, visiblePerson } from "./d1People.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

type InboxMessage = {
  source_id: string; message: string; sender_json: string; receiver_json: string; room_id: string | null;
  media_url: string; media_type: string; duration: number; forwarded: number; is_edited: number; read: number;
  created_at: string | null; updated_at: string | null; edited_at: string | null; reactions_json: string;
  reply_to_message_id: string; reply_to_author: string; reply_to_author_id: string | null; reply_to_text: string; reply_to_media_url: string;
};

function presentMessage(row: InboxMessage) {
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

function beforeDate(value: unknown) {
  const timestamp = Date.parse(String(value ?? "").trim());
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

function pageLimit(value: unknown, max: number) {
  return Math.trunc(Math.min(Math.max(Number(value) || 100, 1), max));
}

function pageOfMessages(rows: InboxMessage[], limit: number, chronological = false) {
  const messages = rows.slice(0, limit).map(presentMessage);
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
    sendOk(res, { message: presentMessage(message), relationship, xpGrant }, 201);
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
