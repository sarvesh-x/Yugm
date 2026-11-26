import type { D1Database } from "@cloudflare/workers-types";
import { miniGameIds, miniGames, xpDailyCaps, xpEvents } from "@yugm/shared";
import { Router, type Response } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sanitizeText, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { createNotification } from "./d1AdminUsers.js";
import { newId } from "./d1Cosmetics.js";
import { presentScore, type ScoreRow } from "./d1GamesReads.js";
import { messageList, presentD1InboxMessage, type InboxMessage } from "./d1Inbox.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

const scoreSchema = z.object({
  gameId: z.enum(miniGameIds),
  score: z.number().int().min(0).max(999999),
  durationMs: z.number().int().min(0).max(300000).optional(),
  rounds: z.number().int().min(0).max(1000).optional(),
  metadata: z.record(z.unknown()).optional()
});
const challengeSchema = z.object({
  gameId: z.enum(miniGameIds),
  score: z.number().int().min(0).max(999999),
  scoreId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  clanId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  message: z.string().max(180).optional()
}).refine((value) => Boolean(value.targetUserId) !== Boolean(value.clanId), "Challenge either a user or a clan");
const shareScoreSchema = z.object({
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/)
});

const maxScores: Record<(typeof miniGameIds)[number], number> = {
  vibe_tap: 6000,
  memory_match: 1200,
  reflex_ring: 1000
};
const gameTitle = (gameId: string) => miniGames.find(game => game.id === gameId)?.title ?? "Mini Game";
const event = "MINI_GAME_PLAY" as const;
const legacyScore = (row: ScoreRow) => ({ ...presentScore(row), __v: 0 });
const challengeId = (value: string) => {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid challenge ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
};
const scoreIdParam = (value: string) => {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid score ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
};

type Account = { xp: number; level: number; wallet_balance: number; last_daily_check_in_at: string | null };
type Challenge = { source_id: string; challenger_id: string; target_user_id: string | null; clan_id: string | null;
  game_id: string; score: number; score_id: string | null; message: string | null; expires_at: string; created_at: string | null; updated_at: string | null };

function presentChallenge(row: Challenge) {
  return {
    _id: row.source_id, challengerId: row.challenger_id,
    ...(row.target_user_id ? { targetUserId: row.target_user_id } : {}),
    ...(row.clan_id ? { clanId: row.clan_id } : {}),
    gameId: row.game_id, score: row.score,
    ...(row.score_id ? { scoreId: row.score_id } : {}),
    ...(row.message !== null ? { message: row.message } : {}),
    expiresAt: row.expires_at,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    __v: 0
  };
}

export function createD1GamesRouter(db: D1Database, allowChat?: D1UserRateLimit) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const insertMessage = (id: string, sender: string, receiver: string, message: string, time: string) =>
    db.prepare(`INSERT INTO direct_messages (source_id, sender_id, receiver_id, message, media_url, media_type,
      duration, forwarded, is_edited, read, created_at, updated_at,
      reply_to_message_id, reply_to_author, reply_to_text, reply_to_media_url)
     SELECT ?, u.source_id, p.source_id, ?, '', '', 0, 0, 0, 0, ?, ?, '', '', '', ''
     FROM users AS u JOIN users AS p ON p.source_id = ? WHERE u.source_id = ?`)
      .bind(id, message, time, time, receiver, sender);
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.session = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const gamer = (res: Response) => res.locals.session.user as { id: string };
  const chatGate = asyncHandler(async (_req, res, next) => {
    await enforceD1UserRateLimit(allowChat, gamer(res).id, res, 10);
    next();
  });

  async function assertCanMessage(actor: string, partner: string) {
    if (actor === partner) throw new HttpError(400, "Choose someone else", ErrorCode.VALIDATION);
    const target = await db.prepare("SELECT name FROM users WHERE source_id = ?").bind(partner).first();
    if (!target) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const blocked = await db.prepare(`SELECT 1 FROM blocks
      WHERE (blocker_id = ?1 AND blocked_user_id = ?2) OR (blocker_id = ?2 AND blocked_user_id = ?1) LIMIT 1`)
      .bind(actor, partner).first();
    if (blocked) throw new HttpError(403, "Cannot interact with this user", ErrorCode.FORBIDDEN);
  }

  router.post("/games/scores", authenticate, chatGate, validateBody(scoreSchema), asyncHandler(async (req, res) => {
    const gamerId = gamer(res).id;
    const { gameId, score, durationMs, rounds, metadata } = scoreSchema.parse(req.body);
    if (score > maxScores[gameId]) {
      throw new HttpError(400, "Score is outside the valid range for this game", ErrorCode.VALIDATION);
    }

    const now = new Date();
    const time = now.toISOString();
    const day = startOfUtcDay(now).toISOString();
    const [accountRow, earnedRow, previousRow] = await db.batch([
      db.prepare("SELECT xp, level, wallet_balance, last_daily_check_in_at FROM users WHERE source_id = ?").bind(gamerId),
      db.prepare("SELECT COALESCE(SUM(amount), 0) AS earned FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ?")
        .bind(gamerId, event, day),
      db.prepare(`SELECT source_id, user_id, game_id, score, created_at, updated_at, duration_ms, rounds, metadata, catalog_fields
        FROM mini_game_scores WHERE user_id = ? AND game_id = ? ORDER BY score DESC, created_at ASC, source_id ASC LIMIT 1`)
        .bind(gamerId, gameId)
    ]);
    const account = accountRow.results[0] as Account | undefined;
    if (!account) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
    const earnedToday = Number((earnedRow.results[0] as { earned: number } | undefined)?.earned ?? 0);
    const cap = xpDailyCaps[event]!;
    const xpAwarded = Math.max(0, Math.min(xpEvents[event], cap - earnedToday));
    const previous = previousRow.results[0] as ScoreRow | undefined;

    const id = newId();
    const guard = `EXISTS (SELECT 1 FROM mini_game_scores WHERE source_id = ?)`;
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, id);
    const grant = prepareD1XpGrant(write, guard, now, {
      userId: gamerId, event, actionKey: `game-score:${id}`,
      requestedXp: xpEvents[event], xpAwarded,
      previousXp: account.xp, previousLevel: account.level, balanceBefore: account.wallet_balance,
      lastDailyCheckInAt: account.last_daily_check_in_at ?? undefined,
      cap: { capped: earnedToday + xpAwarded >= cap, cap, earnedToday: earnedToday + xpAwarded,
        remainingToday: Math.max(0, cap - earnedToday - xpAwarded) }
    });
    const statements = [
      db.prepare(`INSERT INTO mini_game_scores (source_id, user_id, game_id, score, duration_ms, rounds, metadata, catalog_fields, created_at, updated_at)
        SELECT ?, u.source_id, ?, ?, ?, ?, ?, '{}', ?, ? FROM users AS u WHERE u.source_id = ?`)
        .bind(id, gameId, score, durationMs ?? null, rounds ?? null, JSON.stringify(metadata ?? {}), time, time, gamerId),
      ...grant.statements
    ];
    const columns = Object.entries(grant.columns);
    if (columns.length) {
      statements.push(write(`UPDATE users SET ${columns.map(([key]) => `${key} = ?`).join(", ")}, updated_at = ?
        WHERE source_id = ? AND ${guard}`, ...columns.map(([, value]) => value), time, gamerId));
    }
    if (xpAwarded > 0) {
      statements.push(
        write(`UPDATE xp_daily_caps SET amount = amount + ?, updated_at = ?
          WHERE source_id = (SELECT source_id FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ? ORDER BY source_id LIMIT 1)
          AND ${guard}`, xpAwarded, time, gamerId, event, day),
        write(`INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount, created_at, updated_at)
          SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM xp_daily_caps
            WHERE user_id = ? AND event = ? AND day = ?) AND ${guard}`,
        newId(), gamerId, event, day, xpAwarded, time, time, gamerId, event, day)
      );
    }
    const committed = await db.batch(statements);
    if (!committed[0]?.meta?.changes) throw new HttpError(409, "Score was not saved", ErrorCode.CONFLICT);

    const created: ScoreRow = {
      source_id: id, user_id: gamerId, game_id: gameId, score,
      created_at: time, updated_at: time, duration_ms: durationMs ?? null, rounds: rounds ?? null,
      metadata: JSON.stringify(metadata ?? {}), catalog_fields: "{}"
    };
    const isPersonalBest = !previous || score > previous.score;
    sendOk(res, {
      score: legacyScore(created), isPersonalBest,
      personalBest: isPersonalBest ? legacyScore(created) : previous ? legacyScore(previous) : null,
      reward: grant.xpGrant
    }, 201);
  }));

  router.post("/games/challenges", authenticate, chatGate, validateBody(challengeSchema), asyncHandler(async (req, res) => {
    const gamerId = gamer(res).id;
    const parsed = challengeSchema.parse(req.body);
    const { gameId, score, scoreId, targetUserId, clanId, message } = parsed;
    if (score > maxScores[gameId]) {
      throw new HttpError(400, "Score is outside the valid range for this game", ErrorCode.VALIDATION);
    }
    if (scoreId && !await db.prepare(`SELECT 1 FROM mini_game_scores
      WHERE source_id = ? AND user_id = ? AND game_id = ?`).bind(scoreId.toLowerCase(), gamerId, gameId).first()) {
      throw new HttpError(404, "Score not found", ErrorCode.NOT_FOUND);
    }

    let memberIds: string[] = [];
    if (targetUserId) {
      const target = targetUserId.toLowerCase();
      await assertCanMessage(gamerId, target);
      memberIds = [target];
    }
    if (clanId) {
      const clan = clanId.toLowerCase();
      const membership = await db.prepare(`SELECT 1 FROM clans AS c JOIN clan_members AS m ON m.clans_id = c.source_id
        WHERE c.source_id = ? AND m.value = ? LIMIT 1`).bind(clan, gamerId).first();
      if (!membership) throw new HttpError(403, "Join this clan to send challenges", ErrorCode.FORBIDDEN);
      const rows = await db.prepare("SELECT value FROM clan_members WHERE clans_id = ?").bind(clan).all<{ value: string }>();
      memberIds = rows.results.map(row => row.value).filter(id => id !== gamerId);
    }

    const id = newId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000).toISOString();
    const time = now.toISOString();
    const created = await db.prepare(`INSERT INTO mini_game_challenges
      (source_id, challenger_id, target_user_id, clan_id, game_id, score, score_id, message, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, gamerId, targetUserId?.toLowerCase() ?? null, clanId?.toLowerCase() ?? null, gameId, score,
        scoreId?.toLowerCase() ?? null, message ? sanitizeText(message) : null, expiresAt, time, time).run();
    if (!created.meta.changes) throw new HttpError(409, "Challenge was not saved", ErrorCode.CONFLICT);

    const name = (await db.prepare("SELECT name FROM users WHERE source_id = ?").bind(gamerId).first<{ name: string }>())?.name ?? "A player";
    await Promise.all(memberIds.slice(0, 50).map(memberId => createNotification(db, memberId, "SYSTEM", "Arcade challenge",
      `${name} challenged you to beat ${score} in ${gameTitle(gameId)}`,
      { gameId, challengeId: id, userId: gamerId, clanId: clanId?.toLowerCase() })));

    sendOk(res, { challenge: presentChallenge({
      source_id: id, challenger_id: gamerId, target_user_id: targetUserId?.toLowerCase() ?? null,
      clan_id: clanId?.toLowerCase() ?? null, game_id: gameId, score, score_id: scoreId?.toLowerCase() ?? null,
      message: message ? sanitizeText(message) : null, expires_at: expiresAt, created_at: time, updated_at: time
    }) }, 201);
  }));

  router.post("/games/challenges/:challengeId/accept", authenticate, asyncHandler(async (req, res) => {
    const id = challengeId(req.params.challengeId);
    const gamerId = gamer(res).id;
    const challenge = await db.prepare(`SELECT source_id, challenger_id, target_user_id, game_id, score
      FROM mini_game_challenges WHERE source_id = ?`).bind(id).first<Challenge>();
    if (!challenge) throw new HttpError(404, "Challenge not found", ErrorCode.NOT_FOUND);
    if (!challenge.target_user_id || challenge.target_user_id !== gamerId) {
      throw new HttpError(403, "This challenge is not for you", ErrorCode.FORBIDDEN);
    }

    const time = new Date().toISOString();
    const messageId = newId();
    const text = `Challenge accepted! I beat your score of ${challenge.score} in ${gameTitle(challenge.game_id)}.`;
    const [message, removed] = await db.batch([
      insertMessage(messageId, gamerId, challenge.challenger_id, text, time),
      db.prepare("DELETE FROM mini_game_challenges WHERE source_id = ? AND target_user_id = ?").bind(id, gamerId)
    ]);
    if (!message.meta.changes || !removed.meta.changes) {
      throw new HttpError(409, "Challenge changed. Please try again.", ErrorCode.CONFLICT);
    }
    sendOk(res, { accepted: true, gameId: challenge.game_id, score: challenge.score,
      challengerId: challenge.challenger_id });
  }));

  router.post("/games/challenges/:challengeId/decline", authenticate, asyncHandler(async (req, res) => {
    const id = challengeId(req.params.challengeId);
    const gamerId = gamer(res).id;
    const challenge = await db.prepare("SELECT target_user_id FROM mini_game_challenges WHERE source_id = ?")
      .bind(id).first<{ target_user_id: string | null }>();
    if (!challenge) throw new HttpError(404, "Challenge not found", ErrorCode.NOT_FOUND);
    if (!challenge.target_user_id || challenge.target_user_id !== gamerId) {
      throw new HttpError(403, "This challenge is not for you", ErrorCode.FORBIDDEN);
    }
    await db.prepare("DELETE FROM mini_game_challenges WHERE source_id = ? AND target_user_id = ?").bind(id, gamerId).run();
    sendOk(res, { declined: true });
  }));

  router.post("/games/scores/:scoreId/share", authenticate, chatGate, validateBody(shareScoreSchema), asyncHandler(async (req, res) => {
    const scoreId = scoreIdParam(req.params.scoreId);
    const gamerId = gamer(res).id;
    const target = shareScoreSchema.parse(req.body).targetUserId.toLowerCase();
    await assertCanMessage(gamerId, target);
    const score = await db.prepare("SELECT game_id, score FROM mini_game_scores WHERE source_id = ? AND user_id = ?")
      .bind(scoreId, gamerId).first<{ game_id: string; score: number }>();
    if (!score) throw new HttpError(404, "Score not found", ErrorCode.NOT_FOUND);

    const time = new Date().toISOString();
    const messageId = newId();
    const text = `Arcade score: ${score.score} in ${gameTitle(score.game_id)}. Can you beat it?`;
    const name = (await db.prepare("SELECT name FROM users WHERE source_id = ?").bind(gamerId).first<{ name: string }>())?.name ?? "A player";
    const result = await db.batch([
      insertMessage(messageId, gamerId, target, text, time),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        VALUES (?, ?, 'MESSAGE', 'Arcade score shared', ?, ?, 0, ?, ?)`)
        .bind(newId(), target, `${name}: ${text}`, JSON.stringify({ partnerId: gamerId, gameId: score.game_id, scoreId }), time, time),
      db.prepare(`${messageList} WHERE m.source_id = ?`).bind(messageId)
    ]);
    if (!result[0]?.meta?.changes) throw new HttpError(409, "Score share was not saved", ErrorCode.CONFLICT);
    const message = (result[2].results as InboxMessage[])[0];
    if (!message) throw new HttpError(500, "Shared message unavailable", ErrorCode.INTERNAL);
    sendOk(res, { message: presentD1InboxMessage(message) });
  }));

  return router;
}
