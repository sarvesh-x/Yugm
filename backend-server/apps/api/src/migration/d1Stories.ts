import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";

type CommentRow = { source_id: string; story_id: string };

// story_comments.parent_id is a self reference, so the comment and every descendant
// must be removed together. The legacy handler also decremented replyCount by the
// top-level comment plus its replies, which this delete keeps consistent.
const descendants = `WITH RECURSIVE descendants(source_id) AS (
  SELECT source_id FROM story_comments WHERE source_id = ?1 AND user_id = ?2
  UNION ALL
  SELECT child.source_id FROM story_comments AS child
    JOIN descendants AS parent ON child.parent_id = parent.source_id
)`;

export function createD1StoriesRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");

  router.delete("/comments/:commentId", asyncHandler(async (req, res) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    const raw = String(req.params.commentId ?? "");
    if (!isValidObjectId(raw)) throw new HttpError(400, "Invalid comment ID", ErrorCode.VALIDATION);
    const commentId = raw.toLowerCase();
    const comment = await db.prepare("SELECT source_id, story_id FROM story_comments WHERE source_id = ? AND user_id = ?")
      .bind(commentId, user.id).first<CommentRow>();
    if (!comment) throw new HttpError(404, "Comment not found", ErrorCode.NOT_FOUND);
    const removed = (await db.prepare(`${descendants} SELECT COUNT(*) AS total FROM descendants`)
      .bind(comment.source_id, user.id).first<{ total: number }>())?.total ?? 1;
    await db.batch([
      db.prepare(`${descendants} DELETE FROM story_comments WHERE source_id IN (SELECT source_id FROM descendants)`)
        .bind(comment.source_id, user.id),
      db.prepare("UPDATE stories SET reply_count = reply_count - ?, updated_at = ? WHERE source_id = ?")
        .bind(removed, new Date().toISOString(), comment.story_id)
    ]);
    sendOk(res, { deleted: true });
  }));

  return router;
}
