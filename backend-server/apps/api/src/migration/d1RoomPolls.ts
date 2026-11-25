import type { D1Database } from "@cloudflare/workers-types";

const pollDurationSeconds = 45;
const deadline = `strftime('%Y-%m-%dT%H:%M:%fZ', p.created_at, '+${pollDurationSeconds} seconds')`;
export const pollOpen = `p.is_active = 1 AND ${deadline} > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')`;
export const pollProjection = `p.*, CASE WHEN ${pollOpen} THEN 1 ELSE 0 END AS open,
  CASE WHEN p.is_active = 1 AND ${deadline} <= strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
    THEN ${deadline} ELSE p.updated_at END AS effective_updated_at,
  (SELECT json_group_array(json_object('_id', source_id, 'text', text, 'votes', votes))
    FROM (SELECT source_id, text, votes FROM poll_options WHERE polls_id = p.source_id ORDER BY position)) AS options,
  (SELECT json_group_array(value) FROM
    (SELECT value FROM poll_votes WHERE polls_id = p.source_id ORDER BY position)) AS voters`;

export function presentPoll(row: Record<string, string | number | null>) {
  return {
    _id: row.source_id, roomId: row.room_id, createdBy: row.created_by, question: row.question,
    options: JSON.parse(String(row.options)), voters: JSON.parse(String(row.voters)), isActive: Boolean(row.open),
    createdAt: row.created_at ?? undefined, updatedAt: row.effective_updated_at ?? undefined
  };
}

export function closeExpiredD1Polls(db: D1Database, now: Date, limit: number) {
  const cutoff = new Date(now.getTime() - pollDurationSeconds * 1000).toISOString();
  return db.prepare(`UPDATE polls AS p SET is_active = 0, updated_at = ${deadline}
    WHERE p.source_id IN (SELECT source_id FROM polls WHERE is_active = 1 AND created_at <= ?
      ORDER BY created_at, source_id LIMIT ?)`).bind(cutoff, limit);
}
