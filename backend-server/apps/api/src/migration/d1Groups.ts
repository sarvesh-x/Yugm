import type { D1Database } from "@cloudflare/workers-types";
import { createGroupChatSchema, groupMessageSchema } from "@yugm/shared";
import { Router, type Response } from "express";
import { z } from "zod";
import { createHttpSessionAuth } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

type GroupRow = {
  source_id: string;
  name: string;
  created_by: string;
  last_message: string;
  last_message_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  creator_json: string | null;
  participant_json: string | null;
  participant_ids: string | null;
};

type MessageRow = {
  source_id: string;
  group_id: string;
  sender_id: string;
  message: string;
  media_url: string;
  media_type: string;
  duration: number;
  created_at: string | null;
  updated_at: string | null;
  sender_json: string | null;
};

const groupId = (value: string) => {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid group ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
};

const userId = (value: string, message = "Invalid user ID") => {
  if (!isValidObjectId(value)) throw new HttpError(400, message, ErrorCode.VALIDATION);
  return value.toLowerCase();
};

// Legacy populate selects only these fields from group and message users.
const groupPersonJson = (alias: string) => `json_object('_id', ${alias}.source_id, 'name', ${alias}.name,
  'username', ${alias}.username, 'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
  'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}))`;

const groupSelect = `SELECT g.source_id, g.name, g.created_by, g.last_message, g.last_message_at,
  g.created_at, g.updated_at,
  (SELECT ${groupPersonJson("creator")} FROM users AS creator WHERE creator.source_id = g.created_by) AS creator_json,
  (SELECT json_group_array(${groupPersonJson("member")}) FROM (
    SELECT u.source_id, u.name, u.username, u.avatar, u.avatar_type,
      ${AVATAR_PART_KEYS.map(key => `u.avatar_parts_${key}`).join(", ")}
    FROM conversation_participants AS p JOIN users AS u ON u.source_id = p.value
    WHERE p.group_chats_id = g.source_id ORDER BY p.position, p.source_id
  ) AS member) AS participant_json,
  (SELECT json_group_array(ids.value) FROM (
    SELECT p.value FROM conversation_participants AS p
    WHERE p.group_chats_id = g.source_id ORDER BY p.position, p.source_id
  ) AS ids) AS participant_ids
  FROM group_chats AS g`;

const messageSelect = `SELECT m.source_id, m.group_id, m.sender_id, m.message, m.media_url,
  m.media_type, m.duration, m.created_at, m.updated_at,
  (SELECT ${groupPersonJson("sender")} FROM users AS sender WHERE sender.source_id = m.sender_id) AS sender_json
  FROM group_messages AS m`;

const present = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item != null));

function presentPerson(record: string | null | undefined): Record<string, unknown> | null {
  if (!record) return null;
  const { avatarParts, ...fields } = JSON.parse(record) as Record<string, unknown>;
  const parts = present((avatarParts ?? {}) as Record<string, unknown>);
  return {
    ...present(fields),
    ...(Object.keys(parts).length ? { avatarParts: parts } : {})
  };
}

function parsePeople(record: string | null | undefined) {
  const values = JSON.parse(record ?? "[]") as Array<Record<string, unknown>>;
  return values.map(value => presentPerson(JSON.stringify(value)));
}

function presentGroup(row: GroupRow) {
  return {
    _id: row.source_id,
    name: row.name,
    createdBy: presentPerson(row.creator_json),
    participantIds: parsePeople(row.participant_json),
    lastMessage: row.last_message,
    ...(row.last_message_at != null ? { lastMessageAt: row.last_message_at } : {}),
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    __v: 0
  };
}

function presentMessage(row: MessageRow) {
  return {
    _id: row.source_id,
    groupId: row.group_id,
    senderId: presentPerson(row.sender_json),
    message: row.message,
    mediaUrl: row.media_url,
    mediaType: row.media_type,
    duration: row.duration,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined,
    __v: 0
  };
}

export function createD1GroupsRouter(db: D1Database, allowChat?: D1UserRateLimit) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const { required } = createHttpSessionAuth(access, (_req, res, user) => {
    res.locals.user = user;
  });
  const viewerId = (res: Response) => (res.locals.user as { id: string }).id;

  async function readGroup(id: string) {
    const row = await db.prepare(`${groupSelect} WHERE g.source_id = ?`).bind(id).first<GroupRow>();
    if (!row) return null;
    return {
      row,
      group: presentGroup(row),
      participants: JSON.parse(row.participant_ids ?? "[]")
        .filter((value: string | null) => Boolean(value)) as string[]
    };
  }

  async function requireParticipant(rawId: string, user: string) {
    const id = groupId(rawId);
    const found = await readGroup(id);
    if (!found) throw new HttpError(404, "Group not found", ErrorCode.NOT_FOUND);
    if (!found.participants.includes(user)) {
      throw new HttpError(403, "You are not a participant of this group", ErrorCode.FORBIDDEN);
    }
    return { id, ...found };
  }

  function insertParticipant(groupIdValue: string, value: string, position: number) {
    return db.prepare(`INSERT INTO conversation_participants (source_id, value, group_chats_id, position)
      SELECT ?, ?, ?, ? WHERE NOT EXISTS (
        SELECT 1 FROM conversation_participants WHERE group_chats_id = ? AND value = ?)`)
      .bind(`${groupIdValue}:participantIds:${value}`, value, groupIdValue, position, groupIdValue, value);
  }

  router.post("/groups", required, validateBody(createGroupChatSchema), asyncHandler(async (req, res) => {
    const user = viewerId(res);
    const allIds = [...new Set([...req.body.participantIds as string[], user].map(value => userId(value)))];
    const id = newId();
    const time = new Date().toISOString();
    const statements = [db.prepare(`INSERT INTO group_chats
      (source_id, name, created_by, last_message, last_message_at, created_at, updated_at)
      VALUES (?, ?, ?, '', NULL, ?, ?)`).bind(id, sanitizeText(req.body.name as string), user, time, time)];
    allIds.forEach((value, position) => statements.push(insertParticipant(id, value, position)));
    await db.batch(statements);
    const found = await readGroup(id);
    if (!found) throw new HttpError(500, "Group unavailable", ErrorCode.INTERNAL);
    sendOk(res, { group: found.group }, 201);
  }));

  router.get("/groups", required, asyncHandler(async (req, res) => {
    const user = viewerId(res);
    const { results } = await db.prepare(`${groupSelect}
      WHERE EXISTS (SELECT 1 FROM conversation_participants AS p
        WHERE p.group_chats_id = g.source_id AND p.value = ?)
      ORDER BY g.last_message_at DESC, g.created_at DESC, g.source_id DESC`).bind(user).all<GroupRow>();
    sendOk(res, { groups: results.map(presentGroup) });
  }));

  router.get("/groups/:id", required, asyncHandler(async (req, res) => {
    const { group } = await requireParticipant(req.params.id, viewerId(res));
    const { results } = await db.prepare("SELECT source_id FROM group_messages WHERE group_id = ?")
      .bind(group._id as string).all();
    sendOk(res, { group, messageCount: results.length });
  }));

  router.post("/groups/:id/message", required, asyncHandler(async (_req, res, next) => {
    await enforceD1UserRateLimit(allowChat, viewerId(res), res, 10);
    next();
  }), validateBody(groupMessageSchema), asyncHandler(async (req, res) => {
    const user = viewerId(res);
    const { id } = await requireParticipant(req.params.id, user);
    const input = req.body as z.infer<typeof groupMessageSchema>;
    const messageId = newId();
    const time = new Date().toISOString();
    const message = sanitizeText(input.message);
    const statements = [
      db.prepare(`INSERT INTO group_messages
        (source_id, group_id, sender_id, message, media_url, media_type, duration, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(messageId, id, user, message, input.mediaUrl ?? "", input.mediaType ?? "", input.duration ?? 0, time, time),
      db.prepare(`UPDATE group_chats SET last_message = ?, last_message_at = ?, updated_at = ?
        WHERE source_id = ? AND EXISTS (
          SELECT 1 FROM conversation_participants WHERE group_chats_id = ? AND value = ?)`)
        .bind(message, time, time, id, id, user)
    ];
    await db.batch(statements);
    const row = await db.prepare(`${messageSelect} WHERE m.source_id = ?`).bind(messageId).first<MessageRow>();
    if (!row) throw new HttpError(500, "Message unavailable", ErrorCode.INTERNAL);
    sendOk(res, { message: presentMessage(row) }, 201);
  }));

  router.get("/groups/:id/messages", required, asyncHandler(async (req, res) => {
    const { id } = await requireParticipant(req.params.id, viewerId(res));
    const skip = Math.trunc(Math.max(0, Number(req.query.skip) || 0));
    const limit = Math.trunc(Math.min(Math.max(1, Number(req.query.limit) || 30), 100));
    const { results } = await db.prepare(`${messageSelect}
      WHERE m.group_id = ? ORDER BY m.created_at DESC, m.source_id DESC LIMIT ? OFFSET ?`)
      .bind(id, limit, skip).all<MessageRow>();
    sendOk(res, { messages: results.reverse().map(presentMessage) });
  }));

  const participantIdsSchema = z.object({
    participantIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).max(32)
  });

  router.post("/groups/:id/add", required, asyncHandler(async (req, res) => {
    const { id, group, participants } = await requireParticipant(req.params.id, viewerId(res));
    if (group.createdBy?._id !== viewerId(res)) {
      throw new HttpError(403, "Only the group creator can add participants", ErrorCode.FORBIDDEN);
    }
    const parsed = participantIdsSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(422, "Invalid participantIds", ErrorCode.VALIDATION);
    const newIds = parsed.data.participantIds
      .map(value => userId(value))
      .filter(value => !participants.includes(value));
    if (newIds.length === 0) return sendOk(res, { group });
    const time = new Date().toISOString();
    const statements = [db.prepare("UPDATE group_chats SET updated_at = ? WHERE source_id = ?").bind(time, id)];
    const { results: positions } = await db.prepare(`SELECT COALESCE(MAX(position), -1) AS position
      FROM conversation_participants WHERE group_chats_id = ?`).bind(id).all<{ position: number }>();
    let position = (positions[0]?.position ?? -1) + 1;
    newIds.forEach(value => statements.push(insertParticipant(id, value, position++)));
    await db.batch(statements);
    const updated = await readGroup(id);
    if (!updated) throw new HttpError(404, "Group not found", ErrorCode.NOT_FOUND);
    sendOk(res, { group: updated.group });
  }));

  const userIdSchema = z.object({ userId: z.string().regex(/^[0-9a-fA-F]{24}$/) });

  router.post("/groups/:id/remove", required, asyncHandler(async (req, res) => {
    const user = viewerId(res);
    const { id, group, participants } = await requireParticipant(req.params.id, user);
    if (group.createdBy?._id !== user) {
      throw new HttpError(403, "Only the group creator can remove participants", ErrorCode.FORBIDDEN);
    }
    const parsed = userIdSchema.safeParse(req.body);
    if (!parsed.success) throw new HttpError(422, "Invalid userId", ErrorCode.VALIDATION);
    const target = userId(parsed.data.userId);
    if (!participants.includes(target)) throw new HttpError(404, "User not in group", ErrorCode.NOT_FOUND);
    if (target === group.createdBy?._id) {
      throw new HttpError(400, "Creator cannot be removed", ErrorCode.VALIDATION);
    }
    const time = new Date().toISOString();
    await db.batch([
      db.prepare("DELETE FROM conversation_participants WHERE group_chats_id = ? AND value = ?").bind(id, target),
      db.prepare("UPDATE group_chats SET updated_at = ? WHERE source_id = ?").bind(time, id)
    ]);
    const updated = await readGroup(id);
    if (!updated) throw new HttpError(404, "Group not found", ErrorCode.NOT_FOUND);
    sendOk(res, { group: updated.group });
  }));

  router.post("/groups/:id/leave", required, asyncHandler(async (req, res) => {
    const user = viewerId(res);
    const { id, group, participants } = await requireParticipant(req.params.id, user);
    const remaining = participants.filter(value => value !== user);
    if (remaining.length === 0) {
      await db.batch([
        db.prepare("DELETE FROM group_messages WHERE group_id = ?").bind(id),
        db.prepare("DELETE FROM conversation_participants WHERE group_chats_id = ?").bind(id),
        db.prepare("DELETE FROM group_chats WHERE source_id = ?").bind(id)
      ]);
      return sendOk(res, { left: true });
    }
    const statements = [
      db.prepare("DELETE FROM conversation_participants WHERE group_chats_id = ? AND value = ?").bind(id, user)
    ];
    if (group.createdBy?._id === user) {
      statements.push(db.prepare("UPDATE group_chats SET created_by = ?, updated_at = ? WHERE source_id = ?")
        .bind(remaining[0], new Date().toISOString(), id));
    } else {
      statements.push(db.prepare("UPDATE group_chats SET updated_at = ? WHERE source_id = ?")
        .bind(new Date().toISOString(), id));
    }
    await db.batch(statements);
    sendOk(res, { left: true });
  }));

  return router;
}
