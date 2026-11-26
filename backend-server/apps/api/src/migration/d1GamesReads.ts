import type { D1Database } from "@cloudflare/workers-types";
import { miniGameIds } from "@yugm/shared";
import { Router, type Response } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";

type CountRow = { count: number };
export type ScoreRow = {
  source_id: string;
  user_id: string;
  game_id: string;
  score: number;
  created_at: string | null;
  updated_at: string | null;
  duration_ms: number | null;
  rounds: number | null;
  metadata: string;
  catalog_fields: string;
};
type BestScoreRow = { score: number };
type LeaderboardRow = {
  user_id: string;
  score: number;
  created_at: string | null;
  user_json: string;
};
type ChallengeRow = {
  source_id: string;
  challenger_id: string;
  target_user_id: string | null;
  clan_id: string | null;
  game_id: string;
  score: number;
  message: string | null;
  expires_at: string;
  created_at: string | null;
  challenger_json: string | null;
  target_json: string | null;
  clan_json: string | null;
};

const presentFields = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));

// The legacy populate projections select these fields only. Nulls are omitted
// from the populated lean objects, including unset avatar parts.
const gameUserJson = (alias: string) => `json_object('_id', ${alias}.source_id, 'name', ${alias}.name,
  'username', ${alias}.username, 'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
  'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}),
  'level', ${alias}.level, 'levelTitle', ${alias}.level_title)`;

const clanJson = (alias: string) => `json_object('_id', ${alias}.source_id, 'name', ${alias}.name,
  'slug', ${alias}.slug, 'avatar', ${alias}.avatar, 'familyLabel', ${alias}.family_label)`;

const challengeSelect = `SELECT c.source_id, c.challenger_id, c.target_user_id, c.clan_id,
  c.game_id, c.score, c.message, c.expires_at, c.created_at,
  (SELECT ${gameUserJson("u")} FROM users AS u WHERE u.source_id = c.challenger_id) AS challenger_json,
  (SELECT ${gameUserJson("u")} FROM users AS u WHERE u.source_id = c.target_user_id) AS target_json,
  (SELECT ${clanJson("cl")} FROM clans AS cl WHERE cl.source_id = c.clan_id) AS clan_json
  FROM mini_game_challenges AS c`;

function parseGameUser(record: string | null | undefined) {
  if (!record) return null;
  const { avatarParts, ...fields } = JSON.parse(record) as Record<string, unknown>;
  const parts = presentFields((avatarParts ?? {}) as Record<string, unknown>);
  return {
    ...presentFields(fields),
    ...(Object.keys(parts).length ? { avatarParts: parts } : {})
  };
}

function parseClan(record: string | null | undefined) {
  return record ? presentFields(JSON.parse(record) as Record<string, unknown>) : null;
}

function presentChallenge(row: ChallengeRow, populated: { challenger: boolean; target: boolean; clan: boolean }) {
  const payload: Record<string, unknown> = {
    _id: row.source_id,
    gameId: row.game_id,
    score: row.score,
    ...(row.message !== null ? { message: row.message } : {}),
    expiresAt: row.expires_at,
    ...(row.created_at ? { createdAt: row.created_at } : {})
  };
  payload.challenger = populated.challenger
    ? parseGameUser(row.challenger_json) ?? row.challenger_id
    : row.challenger_id;
  if (row.target_user_id) {
    payload.targetUser = populated.target ? parseGameUser(row.target_json) ?? row.target_user_id : row.target_user_id;
  }
  if (row.clan_id) {
    payload.clan = populated.clan ? parseClan(row.clan_json) ?? row.clan_id : row.clan_id;
  }
  return payload;
}

export function presentScore(row: ScoreRow) {
  return {
    ...JSON.parse(row.catalog_fields ?? "{}") as Record<string, unknown>,
    _id: row.source_id,
    userId: row.user_id,
    gameId: row.game_id,
    score: row.score,
    ...(row.duration_ms !== null ? { durationMs: row.duration_ms } : {}),
    ...(row.rounds !== null ? { rounds: row.rounds } : {}),
    metadata: JSON.parse(row.metadata ?? "{}") as unknown,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {})
  };
}

export function createD1GamesReadsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.session = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const userOf = (res: Response) => res.locals.session.user as { id: string };

  router.get("/games/missions", authenticate, asyncHandler(async (_req, res) => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const day = today.toISOString();
    const user = userOf(res);
    const [scores, best, challenges] = await db.batch([
      db.prepare("SELECT COUNT(*) AS count FROM mini_game_scores WHERE user_id = ? AND created_at >= ?")
        .bind(user.id, day),
      db.prepare(`SELECT score FROM mini_game_scores
        WHERE user_id = ? AND created_at >= ? ORDER BY score DESC LIMIT 1`).bind(user.id, day),
      db.prepare("SELECT COUNT(*) AS count FROM mini_game_challenges WHERE challenger_id = ? AND created_at >= ?")
        .bind(user.id, day)
    ]);
    const plays = (scores.results as CountRow[])[0]?.count ?? 0;
    const bestScore = ((best.results as BestScoreRow[])[0]?.score ?? 0);
    const sent = (challenges.results as CountRow[])[0]?.count ?? 0;
    sendOk(res, {
      date: day,
      missions: [
        { id: "play_3", title: "Play 3 arcade rounds", progress: Math.min(plays, 3), target: 3, rewardXp: 12, complete: plays >= 3 },
        { id: "score_500", title: "Score 500+ in any game", progress: Math.min(bestScore, 500), target: 500, rewardXp: 10, complete: bestScore >= 500 },
        { id: "send_challenge", title: "Challenge a friend or clan", progress: Math.min(sent, 1), target: 1, rewardXp: 8, complete: sent >= 1 }
      ]
    });
  }));

  router.get("/games/leaderboard", authenticate, asyncHandler(async (req, res) => {
    const requestedGame = String(req.query.gameId);
    const gameId = (miniGameIds as readonly string[]).includes(requestedGame) ? requestedGame : miniGameIds[0];
    const limit = Math.min(Number(req.query.limit) || 20, 50);
    if (limit < 0) {
      // MongoDB's aggregate rejects a negative $limit before any query runs.
      // The legacy error handler returns that message verbatim.
      res.status(500).json({
        ok: false,
        error: {
          message: `invalid argument to $limit stage: Expected a non-negative number in: $limit: ${limit}`,
          code: "INTERNAL",
          requestId: crypto.randomUUID()
        }
      });
      return;
    }
    const [leaderboard, personalBest] = await db.batch([
      db.prepare(`WITH ranked AS (
          SELECT user_id, score, created_at,
            ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY score DESC, created_at ASC, source_id ASC) AS position
          FROM mini_game_scores WHERE game_id = ?
        ), top AS (
          SELECT user_id, score, created_at FROM ranked WHERE position = 1
          ORDER BY score DESC, created_at ASC, user_id ASC LIMIT ?
        )
        SELECT top.user_id, top.score, top.created_at,
          ${gameUserJson("u")} AS user_json
        FROM top JOIN users AS u ON u.source_id = top.user_id
        ORDER BY top.score DESC, top.created_at ASC, top.user_id ASC`).bind(gameId, limit),
      db.prepare(`SELECT source_id, user_id, game_id, score, created_at, updated_at,
          duration_ms, rounds, metadata, catalog_fields
        FROM mini_game_scores WHERE user_id = ? AND game_id = ?
        ORDER BY score DESC, created_at ASC, source_id ASC LIMIT 1`).bind(userOf(res).id, gameId)
    ]);
    sendOk(res, {
      gameId,
      leaderboard: (leaderboard.results as LeaderboardRow[]).map(row => ({
        score: row.score,
        createdAt: row.created_at,
        user: parseGameUser(row.user_json),
        userId: row.user_id
      })),
      personalBest: (personalBest.results as ScoreRow[])[0]
        ? presentScore((personalBest.results as ScoreRow[])[0])
        : null
    });
  }));

  router.get("/games/challenges", authenticate, asyncHandler(async (_req, res) => {
    const user = userOf(res);
    const now = new Date().toISOString();
    const myClan = await db.prepare(`SELECT clans_id FROM clan_members
      WHERE value = ? ORDER BY clans_id LIMIT 1`).bind(user.id).first<{ clans_id: string }>();
    const statements = [
      db.prepare(`${challengeSelect} WHERE c.target_user_id = ? AND c.expires_at > ?
        ORDER BY c.created_at DESC, c.source_id DESC LIMIT 20`).bind(user.id, now),
      db.prepare(`${challengeSelect} WHERE c.challenger_id = ?
        ORDER BY c.created_at DESC, c.source_id DESC LIMIT 20`).bind(user.id)
    ];
    if (myClan) {
      statements.push(db.prepare(`${challengeSelect} WHERE c.clan_id = ? AND c.expires_at > ?
        ORDER BY c.created_at DESC, c.source_id DESC LIMIT 20`).bind(myClan.clans_id, now));
    }
    const results = await db.batch(statements);
    const incoming = (results[0].results as ChallengeRow[])
      .map(row => presentChallenge(row, { challenger: true, target: false, clan: false }));
    const outgoing = (results[1].results as ChallengeRow[])
      .map(row => presentChallenge(row, { challenger: false, target: true, clan: true }));
    const clan = myClan
      ? (results[2].results as ChallengeRow[])
        .map(row => presentChallenge(row, { challenger: true, target: false, clan: true }))
      : [];
    sendOk(res, { incoming, outgoing, clan });
  }));

  return router;
}
