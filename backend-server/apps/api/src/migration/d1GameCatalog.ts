import type { D1Database } from "@cloudflare/workers-types";
import { miniGameIds } from "@yugm/shared";
import type { GameCatalogScores } from "../services/gameCatalog.js";

type BestScoreRow = {
  game_id: string;
  score: number;
  created_at: string | null;
};

type RecentScoreRow = BestScoreRow & {
  source_id: string;
  user_id: string;
  duration_ms: number | null;
  rounds: number | null;
  metadata: string;
  updated_at: string | null;
  catalog_fields: string;
};

const bestScoresQuery = `
  SELECT game_id, score, created_at
  FROM mini_game_scores
  WHERE source_id IN (
    SELECT (
      SELECT source_id FROM mini_game_scores
      WHERE user_id = ? AND game_id = game.value
      ORDER BY score DESC, created_at ASC LIMIT 1
    )
    FROM json_each(?) AS game
  )
`;

const recentScoresQuery = `
  SELECT source_id, user_id, game_id, score, duration_ms, rounds, metadata,
         created_at, updated_at, catalog_fields
  FROM mini_game_scores
  WHERE user_id = ?
  ORDER BY created_at DESC LIMIT 10
`;

function projectRecentScore(row: RecentScoreRow) {
  return {
    ...JSON.parse(row.catalog_fields) as Record<string, unknown>,
    _id: row.source_id,
    userId: row.user_id,
    gameId: row.game_id,
    score: row.score,
    ...(row.duration_ms !== null && { durationMs: row.duration_ms }),
    ...(row.rounds !== null && { rounds: row.rounds }),
    ...(row.metadata !== "{}" && { metadata: JSON.parse(row.metadata) as unknown }),
    ...(row.created_at !== null && { createdAt: row.created_at }),
    ...(row.updated_at !== null && { updatedAt: row.updated_at })
  };
}

export async function readD1GameCatalog(db: Pick<D1Database, "prepare">, userId: string) {
  const best = await db.prepare(bestScoresQuery).bind(userId, JSON.stringify(miniGameIds)).all<BestScoreRow>();
  const recent = await db.prepare(recentScoresQuery).bind(userId).all<RecentScoreRow>();
  const scores: GameCatalogScores = {
    best: Object.fromEntries(best.results.map((row) => [
      row.game_id, { score: row.score, createdAt: row.created_at }
    ])),
    recent: recent.results.map(projectRecentScore)
  };
  return {
    scores,
    usage: {
      bestScoresRowsRead: best.meta.rows_read,
      recentScoresRowsRead: recent.meta.rows_read,
      rowsWritten: best.meta.rows_written + recent.meta.rows_written,
      databaseBytes: recent.meta.size_after
    }
  };
}
