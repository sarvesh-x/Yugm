import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Request } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { person, personJson, visiblePerson } from "./d1People.js";

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

export function createD1InboxRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, access);

  router.get("/", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const limit = Math.trunc(Math.min(Math.max(Number(req.query.limit) || 100, 1), 200));
    const timestamp = Date.parse(String(req.query.before ?? "").trim());
    const before = Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
    const { results } = await db.prepare(`SELECT m.*, ${personJson("sender")} AS sender_json,
      ${personJson("receiver")} AS receiver_json,
      (SELECT json_group_array(json_object('userId', user_id, 'type', type, 'createdAt', created_at))
        FROM (SELECT user_id, type, created_at FROM direct_message_reactions WHERE direct_messages_id = m.source_id ORDER BY position)
      ) AS reactions_json
      FROM direct_messages AS m
      JOIN users AS sender ON sender.source_id = m.sender_id
      JOIN users AS receiver ON receiver.source_id = m.receiver_id
      WHERE (m.sender_id = ?1 OR m.receiver_id = ?1) AND ${visibleMessage}
        AND ${visiblePerson("sender", "?1")} AND ${visiblePerson("receiver", "?1")}
        AND (?2 IS NULL OR m.created_at < ?2)
      ORDER BY m.created_at DESC, m.source_id DESC LIMIT ?3`).bind(user.id, before, limit + 1).all<InboxMessage>();
    const messages = results.slice(0, limit).map(presentMessage);
    sendOk(res, { messages, hasMore: results.length > limit, nextBefore: messages.at(-1)?.createdAt ?? null });
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
    const { results } = await db.prepare("SELECT partner_id FROM conversation_mutes WHERE owner_id = ? AND muted = 1")
      .bind(user.id).all<{ partner_id: string }>();
    sendOk(res, { partnerIds: results.map(row => row.partner_id) });
  }));
  return router;
}
