import type { D1Database } from "@cloudflare/workers-types";
import { person, personJson } from "./d1People.js";

export type D1StoryRow = {
  source_id: string; media_url: string; media_type: "IMAGE" | "VIDEO" | "AUDIO"; caption: string | null;
  background_color: string | null; text_color: string | null; font: string | null; sticker: string | null;
  link_url: string | null; duration: number | null; transcript: string | null; viewed_by_json: string;
  like_count: number; reply_count: number; expires_at: string; status: "ACTIVE" | "EXPIRED" | "HIDDEN";
  created_at: string | null; updated_at: string | null; user_json: string;
};

export const d1StoryProjection = `s.*, ${personJson("u")} AS user_json,
  (SELECT json_group_array(value) FROM (
    SELECT value FROM story_views WHERE stories_id = s.source_id ORDER BY position
  )) AS viewed_by_json`;

export function presentD1Story(row: D1StoryRow) {
  return {
    _id: row.source_id, userId: person(row.user_json), mediaUrl: row.media_url, mediaType: row.media_type,
    caption: row.caption ?? undefined, backgroundColor: row.background_color ?? undefined,
    textColor: row.text_color ?? undefined, font: row.font ?? undefined, sticker: row.sticker ?? undefined,
    linkUrl: row.link_url ?? undefined, duration: row.duration ?? undefined, transcript: row.transcript ?? undefined,
    viewedBy: JSON.parse(String(row.viewed_by_json)), likeCount: row.like_count, replyCount: row.reply_count,
    expiresAt: row.expires_at, status: row.status,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

export async function readD1StoriesByIds(db: D1Database, ids: string[]) {
  if (!ids.length) return [];
  const normalized = ids.map(value => value.toLowerCase());
  const { results } = await db.prepare(`SELECT ${d1StoryProjection} FROM stories AS s
    JOIN users AS u ON u.source_id = s.user_id
    WHERE s.source_id IN (SELECT value FROM json_each(?))`).bind(JSON.stringify(normalized)).all<D1StoryRow>();
  const byId = new Map(results.map(row => [row.source_id, presentD1Story(row)]));
  return normalized.map(id => byId.get(id)).filter(Boolean);
}
