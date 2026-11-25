import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Response } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";

type StoryRow = {
  source_id: string;
  user_id: string;
  media_url: string;
  media_type: string;
  caption: string | null;
  background_color: string | null;
  text_color: string | null;
  font: string | null;
  sticker: string | null;
  link_url: string | null;
  duration: number | null;
  transcript: string | null;
  like_count: number;
  reply_count: number;
  expires_at: string;
  status: string;
  created_at: string | null;
  updated_at: string | null;
  user_json: string | null;
  view_ids: string | null;
};

type CommentRow = {
  source_id: string;
  story_id: string;
  user_id: string;
  parent_id: string | null;
  text: string;
  created_at: string | null;
  updated_at: string | null;
  user_json: string | null;
};

const storyId = (value: string, message = "Invalid identifier") => {
  if (!isValidObjectId(value)) throw new HttpError(400, message, ErrorCode.VALIDATION);
  return value.toLowerCase();
};

// The legacy populated projection selects only these fields from story, viewer
// and comment users. Absent values are omitted from the JSON projection.
const personJson = (alias: string) => `json_object('_id', ${alias}.source_id, 'name', ${alias}.name,
  'username', ${alias}.username, 'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
  'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}))`;

const personColumns = (alias: string) => `${alias}.source_id, ${alias}.name, ${alias}.username,
  ${alias}.avatar, ${alias}.avatar_type,
  ${AVATAR_PART_KEYS.map(key => `${alias}.avatar_parts_${key}`).join(", ")}`;

const storyColumns = `s.source_id, s.user_id, s.media_url, s.media_type, s.caption, s.background_color,
  s.text_color, s.font, s.sticker, s.link_url, s.duration, s.transcript, s.like_count, s.reply_count,
  s.expires_at, s.status, s.created_at, s.updated_at`;

const storySelect = `SELECT ${storyColumns},
  (SELECT ${personJson("author")} FROM users AS author WHERE author.source_id = s.user_id) AS user_json,
  (SELECT json_group_array(viewer.value) FROM (
    SELECT v.value FROM story_views AS v WHERE v.stories_id = s.source_id ORDER BY v.position, v.source_id
  ) AS viewer) AS view_ids
  FROM stories AS s`;

const commentSelect = `SELECT c.source_id, c.story_id, c.user_id, c.parent_id, c.text,
  c.created_at, c.updated_at,
  (SELECT ${personJson("author")} FROM users AS author WHERE author.source_id = c.user_id) AS user_json
  FROM story_comments AS c`;

const present = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item != null));

function parsePerson(record: string | null | undefined): Record<string, unknown> | null {
  if (!record) return null;
  const { avatarParts, ...fields } = JSON.parse(record) as Record<string, unknown>;
  const parts = present((avatarParts ?? {}) as Record<string, unknown>);
  return {
    ...present(fields),
    ...(Object.keys(parts).length ? { avatarParts: parts } : {})
  };
}

function parsePeople(record: string | null | undefined) {
  return (JSON.parse(record ?? "[]") as Array<Record<string, unknown>>).map(value => parsePerson(JSON.stringify(value)));
}

function presentStory(row: StoryRow, populateUser: boolean, idFirst = true) {
  const story: Record<string, unknown> = {};
  if (idFirst) story._id = row.source_id;
  story.userId = populateUser ? parsePerson(row.user_json) : row.user_id;
  story.mediaUrl = row.media_url;
  story.mediaType = row.media_type;
  for (const [key, value] of [
    ["caption", row.caption], ["backgroundColor", row.background_color], ["textColor", row.text_color],
    ["font", row.font], ["sticker", row.sticker], ["linkUrl", row.link_url], ["duration", row.duration],
    ["transcript", row.transcript]
  ] as Array<[string, unknown]>) {
    if (value != null) story[key] = value;
  }
  story.viewedBy = JSON.parse(row.view_ids ?? "[]") as string[];
  story.likeCount = row.like_count;
  story.replyCount = row.reply_count;
  story.expiresAt = row.expires_at;
  story.status = row.status;
  if (!idFirst) story._id = row.source_id;
  story.createdAt = row.created_at ?? undefined;
  story.updatedAt = row.updated_at ?? undefined;
  story.__v = 0;
  return story;
}

function presentComment(row: CommentRow, idFirst = true) {
  const comment: Record<string, unknown> = {};
  if (idFirst) comment._id = row.source_id;
  comment.storyId = row.story_id;
  comment.userId = parsePerson(row.user_json);
  comment.parentId = row.parent_id;
  comment.text = row.text;
  if (!idFirst) comment._id = row.source_id;
  comment.createdAt = row.created_at ?? undefined;
  comment.updatedAt = row.updated_at ?? undefined;
  comment.__v = 0;
  return comment;
}

const createSchema = z.object({
  mediaUrl: z.string().min(1),
  mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO"]),
  caption: z.string().max(200).optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  font: z.string().optional(),
  sticker: z.string().optional(),
  linkUrl: z.string().url().optional().or(z.literal("")),
  duration: z.number().int().min(1).max(300).optional(),
  transcript: z.string().max(1000).optional()
});

const commentSchema = z.object({ text: z.string().min(1).max(500) });

// story_comments.parent_id is a self reference, so the comment and every descendant
// must be removed together. The legacy handler also decremented replyCount by the
// top-level comment plus its replies, which this delete keeps consistent.
const descendants = `WITH RECURSIVE descendants(source_id) AS (
  SELECT source_id FROM story_comments WHERE source_id = ?1 AND user_id = ?2
  UNION ALL
  SELECT child.source_id FROM story_comments AS child
    JOIN descendants AS parent ON child.parent_id = parent.source_id
)`;

export function createD1StoriesRouter(db: D1Database, allowCreate?: D1UserRateLimit) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const requireStorySession = asyncHandler(async (req, res, next) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    res.locals.storyUserId = user.id;
    next();
  });
  const enforceCreateLimit = asyncHandler(async (_req, res, next) => {
    await enforceD1UserRateLimit(allowCreate, userIdOf(res), res, 60);
    next();
  });
  const userIdOf = (res: { locals: Record<string, unknown> }) => res.locals.storyUserId as string;

  async function readStory(id: string) {
    const row = await db.prepare(`${storySelect} WHERE s.source_id = ?`).bind(id).first<StoryRow>();
    if (!row) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);
    return row;
  }

  async function userName(id: string) {
    return (await db.prepare("SELECT name FROM users WHERE source_id = ?").bind(id).first<{ name: string }>())?.name ?? "";
  }

  function notification(user: string, type: "MOMENT" | "COMMENT", title: string, body: string,
    data: Record<string, unknown>, time: string) {
    return db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?)`)
      .bind(newId(), user, type, title, body, JSON.stringify(data), time, time);
  }

  router.post("/stories", requireStorySession, enforceCreateLimit, validateBody(createSchema),
    asyncHandler(async (req, res) => {
      const user = userIdOf(res);
      const input = req.body as z.infer<typeof createSchema>;
      const id = newId();
      const time = new Date().toISOString();
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
      const name = await userName(user);
      const { results: followers } = await db.prepare("SELECT follower_id FROM follows WHERE following_id = ?")
        .bind(user).all<{ follower_id: string }>();
      const statements = [db.prepare(`INSERT INTO stories
        (source_id, user_id, media_url, media_type, caption, background_color, text_color, font, sticker,
          link_url, duration, transcript, like_count, reply_count, expires_at, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0, ?, 'ACTIVE', ?, ?)`)
        .bind(id, user, input.mediaUrl, input.mediaType, input.caption?.trim() ?? null,
          input.backgroundColor ?? null, input.textColor ?? null, input.font ?? null, input.sticker ?? null,
          input.linkUrl ?? null, input.duration ?? null, input.transcript ?? null, expiresAt, time, time)];
      for (const follower of followers) {
        statements.push(notification(follower.follower_id, "MOMENT", "New story",
          `${name} shared a moment`, { storyId: id, userId: user }, time));
      }
      await db.batch(statements);
      const row = await db.prepare(`${storySelect} WHERE s.source_id = ?`).bind(id).first<StoryRow>();
      if (!row) throw new HttpError(500, "Story unavailable", ErrorCode.INTERNAL);
      sendOk(res, { story: presentStory(row, false, false) });
    }));

  router.get("/stories/feed", requireStorySession, asyncHandler(async (req, res) => {
    const user = userIdOf(res);
    const now = new Date().toISOString();
    const { results } = await db.prepare(`${storySelect}
      WHERE s.status = 'ACTIVE' AND s.expires_at > ?
        AND (s.user_id = ? OR EXISTS (
          SELECT 1 FROM follows AS f WHERE f.follower_id = ? AND f.following_id = s.user_id))
      ORDER BY s.created_at DESC, s.source_id DESC`)
      .bind(now, user, user).all<StoryRow>();
    const grouped: Record<string, { user: Record<string, unknown> | null; stories: Record<string, unknown>[] }> = {};
    for (const row of results) {
      if (!grouped[row.user_id]) grouped[row.user_id] = { user: parsePerson(row.user_json), stories: [] };
      grouped[row.user_id].stories.push(presentStory(row, true));
    }
    sendOk(res, { stories: grouped, count: Object.keys(grouped).length });
  }));

  router.get("/stories/user/:userId", requireStorySession, asyncHandler(async (req, res) => {
    const target = storyId(req.params.userId);
    const skip = Number(req.query.skip) || 0;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const { results } = await db.prepare(`${storySelect}
      WHERE s.user_id = ? AND s.status = 'ACTIVE' AND s.expires_at > ?
      ORDER BY s.created_at DESC, s.source_id DESC LIMIT ? OFFSET ?`)
      .bind(target, new Date().toISOString(), limit, skip).all<StoryRow>();
    sendOk(res, { stories: results.map(row => presentStory(row, true)) });
  }));

  router.post("/stories/:storyId/view", requireStorySession, asyncHandler(async (req, res) => {
    const id = storyId(req.params.storyId);
    const user = userIdOf(res);
    await readStory(id);
    const existing = await db.prepare("SELECT 1 FROM story_views WHERE stories_id = ? AND value = ?")
      .bind(id, user).first();
    if (!existing) {
      const position = (await db.prepare(`SELECT COALESCE(MAX(position), -1) AS position
        FROM story_views WHERE stories_id = ?`).bind(id).first<{ position: number }>())?.position ?? -1;
      await db.prepare(`INSERT INTO story_views (source_id, value, stories_id, position)
        SELECT ?, ?, ?, ? WHERE NOT EXISTS (
          SELECT 1 FROM story_views WHERE stories_id = ? AND value = ?)`)
        .bind(newId(), user, id, position + 1, id, user).run();
    }
    const count = (await db.prepare("SELECT COUNT(*) AS count FROM story_views WHERE stories_id = ?")
      .bind(id).first<{ count: number }>())?.count ?? 0;
    sendOk(res, { viewed: true, viewCount: count });
  }));

  router.post("/stories/:storyId/like", requireStorySession, asyncHandler(async (req, res) => {
    const id = storyId(req.params.storyId);
    await readStory(id);
    await db.prepare("UPDATE stories SET like_count = like_count + 1, updated_at = ? WHERE source_id = ?")
      .bind(new Date().toISOString(), id).run();
    const count = (await db.prepare("SELECT like_count FROM stories WHERE source_id = ?")
      .bind(id).first<{ like_count: number }>())?.like_count ?? 0;
    sendOk(res, { likeCount: count });
  }));

  router.post("/stories/:storyId/hide", requireStorySession, asyncHandler(async (req, res) => {
    const id = storyId(req.params.storyId);
    const updated = await db.prepare("UPDATE stories SET status = 'HIDDEN', updated_at = ? WHERE source_id = ? AND user_id = ?")
      .bind(new Date().toISOString(), id, userIdOf(res)).run();
    if (!updated.meta.changes) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);
    sendOk(res, { hidden: true });
  }));

  router.delete("/stories/:storyId", requireStorySession, asyncHandler(async (req, res) => {
    const id = storyId(req.params.storyId);
    const story = await db.prepare("SELECT user_id FROM stories WHERE source_id = ?").bind(id)
      .first<{ user_id: string }>();
    if (!story || story.user_id !== userIdOf(res)) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);
    // Legacy Mongoose left story comments and highlight references dangling after a
    // story delete. D1 enforces both foreign keys, so remove the dependent rows in
    // the same batch as the story instead of failing the owner's delete.
    await db.batch([
      db.prepare("DELETE FROM story_comments WHERE story_id = ?").bind(id),
      db.prepare("DELETE FROM story_highlight_stories WHERE value = ?").bind(id),
      db.prepare("DELETE FROM story_views WHERE stories_id = ?").bind(id),
      db.prepare("DELETE FROM stories WHERE source_id = ?").bind(id)
    ]);
    sendOk(res, { deleted: true });
  }));

  router.get("/stories/:storyId/views", requireStorySession, asyncHandler(async (req, res) => {
    const id = storyId(req.params.storyId);
    await readStory(id);
    const row = await db.prepare(`SELECT json_group_array(${personJson("viewer")}) AS viewers FROM (
      SELECT ${personColumns("u")} FROM story_views AS v JOIN users AS u ON u.source_id = v.value
      WHERE v.stories_id = ? ORDER BY v.position, v.source_id
    ) AS viewer`).bind(id).first<{ viewers: string }>();
    const viewers = parsePeople(row?.viewers);
    sendOk(res, { viewers, count: viewers.length });
  }));

  router.post("/stories/:storyId/comments", requireStorySession, validateBody(commentSchema),
    asyncHandler(async (req, res) => {
      const id = storyId(req.params.storyId);
      const user = userIdOf(res);
      const story = await readStory(id);
      const commentId = newId();
      const time = new Date().toISOString();
      const text = (req.body as z.infer<typeof commentSchema>).text.trim();
      const name = await userName(user);
      const statements = [
        db.prepare(`INSERT INTO story_comments (source_id, story_id, user_id, parent_id, text, created_at, updated_at)
          VALUES (?, ?, ?, NULL, ?, ?, ?)`).bind(commentId, id, user, text, time, time),
        db.prepare("UPDATE stories SET reply_count = reply_count + 1, updated_at = ? WHERE source_id = ?")
          .bind(time, id)
      ];
      if (story.user_id !== user) {
        statements.push(notification(story.user_id, "COMMENT", "New comment",
          `${name} commented on your story`, { storyId: id, commentId, userId: user }, time));
      }
      await db.batch(statements);
      const row = await db.prepare(`${commentSelect} WHERE c.source_id = ?`).bind(commentId).first<CommentRow>();
      if (!row) throw new HttpError(500, "Comment unavailable", ErrorCode.INTERNAL);
      sendOk(res, { comment: presentComment(row, false) });
    }));

  router.get("/stories/:storyId/comments", requireStorySession, asyncHandler(async (req, res) => {
    const id = storyId(req.params.storyId);
    const skip = Number(req.query.skip) || 0;
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    const { results: comments } = await db.prepare(`${commentSelect}
      WHERE c.story_id = ? AND c.parent_id IS NULL
      ORDER BY c.created_at DESC, c.source_id DESC LIMIT ? OFFSET ?`)
      .bind(id, limit, skip).all<CommentRow>();
    if (!comments.length) return sendOk(res, { comments: [] });
    const marks = comments.map(() => "?").join(", ");
    const { results: replies } = await db.prepare(`${commentSelect}
      WHERE c.parent_id IN (${marks}) ORDER BY c.created_at ASC, c.source_id ASC`)
      .bind(...comments.map(row => row.source_id)).all<CommentRow>();
    const grouped = new Map<string, Record<string, unknown>[]>();
    for (const reply of replies) {
      const key = reply.parent_id as string;
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(presentComment(reply));
    }
    sendOk(res, {
      comments: comments.map(row => ({ ...presentComment(row), replies: grouped.get(row.source_id) ?? [] }))
    });
  }));

  router.post("/stories/:storyId/comments/:commentId/reply", requireStorySession, validateBody(commentSchema),
    asyncHandler(async (req, res) => {
      const id = storyId(req.params.storyId);
      const parentId = storyId(req.params.commentId);
      const user = userIdOf(res);
      const parent = await db.prepare(`${commentSelect} WHERE c.source_id = ? AND c.story_id = ?`)
        .bind(parentId, id).first<CommentRow>();
      if (!parent) throw new HttpError(404, "Comment not found", ErrorCode.NOT_FOUND);
      const replyId = newId();
      const time = new Date().toISOString();
      const text = (req.body as z.infer<typeof commentSchema>).text.trim();
      const story = await db.prepare("SELECT source_id FROM stories WHERE source_id = ?").bind(id).first();
      const statements = [db.prepare(`INSERT INTO story_comments
        (source_id, story_id, user_id, parent_id, text, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).bind(replyId, id, user, parentId, text, time, time)];
      if (story) {
        statements.push(db.prepare("UPDATE stories SET reply_count = reply_count + 1, updated_at = ? WHERE source_id = ?")
          .bind(time, id));
      }
      if (parent.user_id !== user) {
        const name = await userName(user);
        statements.push(notification(parent.user_id, "COMMENT", "New reply",
          `${name} replied to your comment`,
          { storyId: id, commentId: parentId, replyId, userId: user }, time));
      }
      await db.batch(statements);
      const row = await db.prepare(`${commentSelect} WHERE c.source_id = ?`).bind(replyId).first<CommentRow>();
      if (!row) throw new HttpError(500, "Reply unavailable", ErrorCode.INTERNAL);
      sendOk(res, { reply: presentComment(row, false) });
    }));

  router.delete("/comments/:commentId", requireStorySession, asyncHandler(async (req, res) => {
    const raw = String(req.params.commentId ?? "");
    if (!isValidObjectId(raw)) throw new HttpError(400, "Invalid comment ID", ErrorCode.VALIDATION);
    const commentId = raw.toLowerCase();
    const comment = await db.prepare("SELECT source_id, story_id FROM story_comments WHERE source_id = ? AND user_id = ?")
      .bind(commentId, userIdOf(res)).first<{ source_id: string; story_id: string }>();
    if (!comment) throw new HttpError(404, "Comment not found", ErrorCode.NOT_FOUND);
    const removed = (await db.prepare(`${descendants} SELECT COUNT(*) AS total FROM descendants`)
      .bind(comment.source_id, userIdOf(res)).first<{ total: number }>())?.total ?? 1;
    await db.batch([
      db.prepare(`${descendants} DELETE FROM story_comments WHERE source_id IN (SELECT source_id FROM descendants)`)
        .bind(comment.source_id, userIdOf(res)),
      db.prepare("UPDATE stories SET reply_count = reply_count - ?, updated_at = ? WHERE source_id = ?")
        .bind(removed, new Date().toISOString(), comment.story_id)
    ]);
    sendOk(res, { deleted: true });
  }));

  return router;
}
