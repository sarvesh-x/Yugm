import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router, type Request } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { readD1StoriesByIds } from "./d1StoryPresentation.js";

type HighlightRow = {
  source_id: string; user_id: string; title: string; cover_media_url: string | null;
  created_at: string | null; updated_at: string | null;
};

const storyId = z.string().regex(/^[0-9a-fA-F]{24}$/);
const createSchema = z.object({ title: z.string().min(1).max(40), storyIds: z.array(storyId).min(1) });
const updateSchema = z.object({
  title: z.string().min(1).max(40).optional(),
  storyIds: z.array(storyId).optional()
});
const addStoriesSchema = z.object({ storyIds: z.array(storyId).min(1) });

const newId = () => randomBytes(12).toString("hex");
const insertLinks = `INSERT INTO story_highlight_stories (source_id, value, story_highlights_id, position)
  SELECT json_extract(item.value, '$.sourceId'), s.source_id, ?1, json_extract(item.value, '$.position')
  FROM json_each(?2) AS item JOIN stories AS s ON s.source_id = json_extract(item.value, '$.id')`;

function links(ids: string[], offset = 0) {
  return JSON.stringify(ids.map((id, index) => ({ id: id.toLowerCase(), position: offset + index, sourceId: newId() })));
}

async function readHighlight(db: D1Database, id: string) {
  const row = await db.prepare("SELECT * FROM story_highlights WHERE source_id = ?").bind(id).first<HighlightRow>();
  if (!row) return null;
  const { results } = await db.prepare(`SELECT value FROM story_highlight_stories
    WHERE story_highlights_id = ? ORDER BY position, source_id`).bind(row.source_id).all<{ value: string }>();
  return {
    _id: row.source_id, userId: row.user_id, title: row.title,
    coverMediaUrl: row.cover_media_url ?? undefined,
    storyIds: await readD1StoriesByIds(db, results.map(item => item.value)),
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

export function createD1HighlightsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, access);
  const owned = (id: string, userId: string) => db.prepare(
    "SELECT source_id FROM story_highlights WHERE source_id = ? AND user_id = ?"
  ).bind(id, userId).first<{ source_id: string }>();
  const highlightId = (value: string, message: string) => {
    if (!isValidObjectId(value)) throw new HttpError(400, message, ErrorCode.VALIDATION);
    return value.toLowerCase();
  };

  router.post("/highlights", validateBody(createSchema), asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const input = req.body as z.infer<typeof createSchema>;
    const ids = input.storyIds.map(value => value.toLowerCase());
    const first = await db.prepare("SELECT media_url FROM stories WHERE source_id = ?")
      .bind(ids[0]).first<{ media_url: string }>();
    if (!first) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);
    const key = newId();
    const time = new Date().toISOString();
    await db.batch([
      db.prepare(`INSERT INTO story_highlights (source_id, user_id, title, cover_media_url, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)`).bind(key, user.id, input.title, first.media_url, time, time),
      db.prepare(insertLinks).bind(key, links(ids))
    ]);
    sendOk(res, { highlight: await readHighlight(db, key) }, 201);
  }));

  router.get("/highlights/:userId", asyncHandler(async (req, res) => {
    await authenticate(req);
    const userId = highlightId(req.params.userId, "Invalid user ID");
    const { results } = await db.prepare(`SELECT source_id FROM story_highlights
      WHERE user_id = ? ORDER BY created_at DESC, source_id DESC`).bind(userId).all<{ source_id: string }>();
    const highlights = [];
    for (const row of results) highlights.push(await readHighlight(db, row.source_id));
    sendOk(res, { highlights });
  }));

  router.put("/highlights/:id", validateBody(updateSchema), asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = highlightId(req.params.id, "Invalid highlight ID");
    if (!await owned(id, user.id)) throw new HttpError(404, "Highlight not found", ErrorCode.NOT_FOUND);
    const input = req.body as z.infer<typeof updateSchema>;
    const time = new Date().toISOString();
    const statements = [];
    if (input.title !== undefined) {
      statements.push(db.prepare("UPDATE story_highlights SET title = ? WHERE source_id = ? AND user_id = ?")
        .bind(input.title, id, user.id));
    }
    if (input.storyIds !== undefined) {
      statements.push(db.prepare("DELETE FROM story_highlight_stories WHERE story_highlights_id = ?").bind(id));
      statements.push(db.prepare(insertLinks).bind(id, links(input.storyIds)));
    }
    if (statements.length) {
      statements.push(db.prepare("UPDATE story_highlights SET updated_at = ? WHERE source_id = ? AND user_id = ?")
        .bind(time, id, user.id));
      await db.batch(statements);
    }
    sendOk(res, { highlight: await readHighlight(db, id) });
  }));

  router.delete("/highlights/:id", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = highlightId(req.params.id, "Invalid highlight ID");
    if (!await owned(id, user.id)) throw new HttpError(404, "Highlight not found", ErrorCode.NOT_FOUND);
    await db.batch([
      db.prepare("DELETE FROM story_highlight_stories WHERE story_highlights_id = ?").bind(id),
      db.prepare("DELETE FROM story_highlights WHERE source_id = ? AND user_id = ?").bind(id, user.id)
    ]);
    sendOk(res, { deleted: true });
  }));

  router.post("/highlights/:id/stories", validateBody(addStoriesSchema), asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = highlightId(req.params.id, "Invalid highlight ID");
    if (!await owned(id, user.id)) throw new HttpError(404, "Highlight not found", ErrorCode.NOT_FOUND);
    const max = await db.prepare(`SELECT COALESCE(MAX(position) + 1, 0) AS next FROM story_highlight_stories
      WHERE story_highlights_id = ?`).bind(id).first<{ next: number }>();
    const time = new Date().toISOString();
    await db.batch([
      db.prepare(insertLinks).bind(id, links((req.body as z.infer<typeof addStoriesSchema>).storyIds, max?.next ?? 0)),
      db.prepare("UPDATE story_highlights SET updated_at = ? WHERE source_id = ? AND user_id = ?").bind(time, id, user.id)
    ]);
    sendOk(res, { highlight: await readHighlight(db, id) });
  }));

  router.delete("/highlights/:id/stories/:storyId", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = highlightId(req.params.id, "Invalid highlight ID");
    const rawStory = String(req.params.storyId ?? "");
    if (!isValidObjectId(rawStory)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
    if (!await owned(id, user.id)) throw new HttpError(404, "Highlight not found", ErrorCode.NOT_FOUND);
    await db.batch([
      db.prepare("DELETE FROM story_highlight_stories WHERE story_highlights_id = ? AND value = ?")
        .bind(id, rawStory.toLowerCase()),
      db.prepare("UPDATE story_highlights SET updated_at = ? WHERE source_id = ? AND user_id = ?")
        .bind(new Date().toISOString(), id, user.id)
    ]);
    sendOk(res, { highlight: await readHighlight(db, id) });
  }));

  return router;
}
