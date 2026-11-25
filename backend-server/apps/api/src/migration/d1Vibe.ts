import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Response } from "express";
import { z } from "zod";
import { createHttpSessionAuth } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";
import { d1UserId } from "./d1People.js";

type VibeRow = {
  source_id: string; user_id: string; city: string; vibe_score: number; total_interactions: number;
  last_vibe_update: string; created_at: string | null; updated_at: string | null;
  interests_json: string | null; languages_json: string | null;
};

type UserVibeRow = {
  source_id: string; name: string; username: string; avatar: string | null; avatar_type: string | null;
  avatar_parts: string | null; level: number; level_title: string | null; city: string | null;
  interests_json: string | null; languages_json: string | null;
};

type VibeInput = { interests: string[]; languages: string[]; city: string };

const updateSchema = z.object({
  interactionType: z.enum(["message", "room_join", "gift", "room_host", "story_reply"]),
  targetUserId: z.string().optional()
});

const interactionPoints: Record<string, number> = {
  message: 2, room_join: 3, gift: 5, room_host: 4, story_reply: 2
};

const avatarPartsJson = (alias: string) => `json_object(${AVATAR_PART_KEYS
  .map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")})`;

const orderedChildren = (table: string, parent: string) =>
  `(SELECT json_group_array(value) FROM (SELECT value FROM ${table} WHERE ${parent} = %1$s ORDER BY position))`;

const userSelect = `SELECT u.source_id, u.name, u.username, u.avatar, u.avatar_type,
  ${avatarPartsJson("u")} AS avatar_parts, u.level, u.level_title, u.city,
  ${orderedChildren("user_interests", "users_id").replace("%1$s", "u.source_id")} AS interests_json,
  ${orderedChildren("user_languages", "users_id").replace("%1$s", "u.source_id")} AS languages_json
  FROM users AS u`;

const vibeSelect = `SELECT v.source_id, v.user_id, v.city, v.vibe_score, v.total_interactions,
  v.last_vibe_update, v.created_at, v.updated_at,
  ${orderedChildren("vibe_graph_interests", "vibe_graphs_id").replace("%1$s", "v.source_id")} AS interests_json,
  ${orderedChildren("vibe_graph_languages", "vibe_graphs_id").replace("%1$s", "v.source_id")} AS languages_json
  FROM vibe_graphs AS v`;

function asList(value: string | null | undefined) {
  return JSON.parse(String(value ?? "[]")) as string[];
}

function presentVibe(row: VibeRow) {
  return {
    _id: row.source_id, userId: row.user_id, interests: asList(row.interests_json),
    languages: asList(row.languages_json), city: row.city, vibeScore: row.vibe_score,
    totalInteractions: row.total_interactions, lastVibeUpdate: row.last_vibe_update,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

function presentVibeUser(row: UserVibeRow, defaults = false) {
  const { avatarParts } = JSON.parse(row.avatar_parts ?? "{}") as Record<string, unknown>;
  const parts = Object.fromEntries(Object.entries((avatarParts ?? {}) as Record<string, unknown>)
    .filter(([, value]) => value != null));
  return {
    _id: row.source_id, name: row.name, avatar: row.avatar, avatarType: row.avatar_type,
    username: row.username, level: row.level ?? (defaults ? 1 : undefined),
    levelTitle: row.level_title ?? (defaults ? "New Vibe" : undefined),
    ...(Object.keys(parts).length ? { avatarParts: parts } : {})
  };
}

function computeVibeScore(a: VibeInput, b: VibeInput) {
  let score = 50;
  const sharedInterests = a.interests.filter(interest => b.interests.includes(interest));
  const sharedLanguages = a.languages.filter(language => b.languages.includes(language));
  score += Math.min(sharedInterests.length * 8, 25);
  score += Math.min(sharedLanguages.length * 6, 15);
  if (a.city && b.city && a.city.toLowerCase() === b.city.toLowerCase()) score += 10;
  return Math.min(Math.max(Math.round(score), 0), 100);
}

function pageValue(value: unknown, fallback: number, max: number) {
  return Math.min(Math.max(Number.parseInt(String(value ?? fallback), 10), 1), max);
}

function vibeInput(row: UserVibeRow): VibeInput {
  return { interests: asList(row.interests_json), languages: asList(row.languages_json), city: row.city ?? "" };
}

export function createD1VibeRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const { required } = createHttpSessionAuth(access, (_req, res, user) => {
    res.locals.user = user;
  });
  router.use("/vibe", required);
  const viewerId = (res: Response) => (res.locals.user as { id: string }).id;

  const readVibeRow = (userId: string) =>
    db.prepare(`${vibeSelect} WHERE v.user_id = ?`).bind(userId).first<VibeRow>();
  const readUserRow = (userId: string) =>
    db.prepare(`${userSelect} WHERE u.source_id = ?`).bind(userId).first<UserVibeRow>();

  async function insertVibe(user: UserVibeRow, score: number, copyLists: boolean, city = user.city ?? "") {
    const time = new Date().toISOString();
    const graphId = newId();
    const statements = [db.prepare(`INSERT INTO vibe_graphs
      (source_id, user_id, city, vibe_score, total_interactions, last_vibe_update, created_at, updated_at)
      SELECT ?, ?, ?, ?, 0, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM vibe_graphs WHERE user_id = ?)`)
      .bind(graphId, user.source_id, city, score, time, time, time, user.source_id)];
    if (copyLists) {
      for (const [field, table] of [["interests", "vibe_graph_interests"], ["languages", "vibe_graph_languages"]] as const) {
        asList(user[`${field}_json`]).forEach((value, position) => statements.push(db.prepare(
          `INSERT INTO ${table} (source_id, value, vibe_graphs_id, position)
           SELECT ?, ?, ?, ? WHERE ? IN (SELECT source_id FROM vibe_graphs WHERE user_id = ?)`)
          .bind(`${graphId}:${field}:${position}`, value, graphId, position, graphId, user.source_id)));
      }
    }
    const results = await db.batch(statements);
    return Boolean(results[0].meta.changes);
  }

  async function ensureVibe(userId: string) {
    const existing = await readVibeRow(userId);
    if (existing) return { row: existing, created: false };
    const user = await readUserRow(userId);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const created = await insertVibe(user, 50, true);
    const row = await readVibeRow(userId);
    if (!row) throw new HttpError(500, "Vibe graph unavailable", ErrorCode.INTERNAL);
    return { row, created };
  }

  router.post("/vibe/init", asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const { row, created } = await ensureVibe(userId);
    sendOk(res, { vibe: presentVibe(row) }, created ? 201 : 200);
  }));

  router.post("/vibe/update", validateBody(updateSchema), asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const { row } = await ensureVibe(userId);
    const gain = interactionPoints[req.body.interactionType] ?? 1;
    const time = new Date().toISOString();
    await db.prepare(`UPDATE vibe_graphs SET vibe_score = ?, total_interactions = total_interactions + 1,
      last_vibe_update = ?, updated_at = ? WHERE source_id = ?`)
      .bind(Math.min(row.vibe_score + gain, 100), time, time, row.source_id).run();
    const updated = await readVibeRow(userId);
    if (!updated) throw new HttpError(500, "Vibe graph unavailable", ErrorCode.INTERNAL);
    sendOk(res, {
      vibe: presentVibe(updated), vibeChange: gain, improved: true,
      message: gain > 0 ? "Your vibe is getting stronger!" : undefined
    });
  }));

  router.get("/vibe/match/:userId", asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const targetId = d1UserId(req.params.userId);
    const [current, target] = await Promise.all([readUserRow(userId), readUserRow(targetId)]);
    if (!current) throw new HttpError(404, "Current user not found", ErrorCode.NOT_FOUND);
    if (!target) throw new HttpError(404, "Target user not found", ErrorCode.NOT_FOUND);
    const score = computeVibeScore(vibeInput(current), vibeInput(target));
    const vibe = await readVibeRow(userId);
    const label = score >= 85 ? "Soulmate Vibe" : score >= 70 ? "Perfect Match" : score >= 55
      ? "Good Vibes" : score >= 40 ? "Getting There" : "New Connection";
    const currentInput = vibeInput(current);
    const targetInput = vibeInput(target);
    sendOk(res, {
      compatibility: {
        score, label,
        sharedInterests: currentInput.interests.filter(interest => targetInput.interests.includes(interest)),
        sharedLanguages: currentInput.languages.filter(language => targetInput.languages.includes(language)),
        sameCity: current.city?.toLowerCase() === target.city?.toLowerCase()
      },
      vibe: vibe ? { score: vibe.vibe_score, totalInteractions: vibe.total_interactions } : null,
      targetUser: presentVibeUser(target)
    });
  }));

  router.get("/vibe/matches", asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const page = pageValue(req.query.page, 1, Number.MAX_SAFE_INTEGER);
    const limit = pageValue(req.query.limit, 20, 50);
    const current = await readUserRow(userId);
    if (!current) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const input = vibeInput(current);
    const binds: unknown[] = [userId];
    const sharedInterest = input.interests.length
      ? ` AND EXISTS (SELECT 1 FROM user_interests AS i WHERE i.users_id = u.source_id
           AND i.value IN (SELECT value FROM json_each(?2)))`
      : "";
    if (input.interests.length) binds.push(JSON.stringify(input.interests));
    // Mongoose treats NaN limit/skip as unbounded, matching the legacy parseInt path.
    const paged = Number.isFinite(page) && Number.isFinite(limit);
    let paging = "";
    if (paged) {
      binds.push(limit * 5, (page - 1) * limit * 5);
      paging = ` LIMIT ?${binds.length - 1} OFFSET ?${binds.length}`;
    }
    const { results } = await db.prepare(`${userSelect} WHERE u.source_id <> ?1${sharedInterest}
      ORDER BY u.created_at, u.source_id${paging}`).bind(...binds).all<UserVibeRow>();
    const scored = results.map(candidate => {
      const score = computeVibeScore(input, vibeInput(candidate));
      return { candidate, score };
    });
    scored.sort((a, b) => b.score - a.score);
    sendOk(res, { matches: scored.slice(0, paged ? limit : scored.length).map(({ candidate, score }) => ({
      user: presentVibeUser(candidate, true),
      scores: { overall: score, compatibility: score, interestSimilarity: score }
    })) });
  }));

  router.get("/vibe/graph", asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const vibe = await readVibeRow(userId);
    sendOk(res, { vibeGraph: vibe ? presentVibe(vibe) : null });
  }));

  router.get("/vibe/trend", asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const vibe = await readVibeRow(userId);
    if (!vibe) return sendOk(res, { trend: "stable", history: [] });
    const now = Date.now();
    const history = Array.from({ length: 7 }, (_, index) => {
      const daysAgo = 6 - index;
      return {
        score: Math.max(0, Math.round(vibe.vibe_score - daysAgo * 2)),
        date: new Date(now - daysAgo * 86_400_000).toISOString().slice(0, 10)
      };
    });
    const first = history[0]?.score ?? 0;
    const last = history[history.length - 1]?.score ?? 0;
    const trend = last > first + 5 ? "up" : last < first - 5 ? "down" : "stable";
    sendOk(res, { trend, history });
  }));

  router.get("/vibe/dimensions", asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const [vibe, current] = await Promise.all([readVibeRow(userId), readUserRow(userId)]);
    const baseScore = vibe?.vibe_score ?? 50;
    const input = current ? vibeInput(current) : { interests: [], languages: [], city: "" };
    const dimensions = [
      { name: "Overall Vibe", score: baseScore, description: "Your overall vibe energy" },
      { name: "Conversation", score: Math.min(100, baseScore + 5), description: "How you connect in chat" },
      { name: "Humor", score: Math.min(100, baseScore - 3), description: "Your humor compatibility" },
      { name: "Energy", score: Math.min(100, baseScore + 8), description: "Your social energy level" },
      { name: "Music", score: input.interests.includes("music") ? Math.min(100, baseScore + 12) : baseScore - 5,
        description: "Music taste alignment" },
      { name: "Gaming", score: input.interests.includes("gaming") ? Math.min(100, baseScore + 10) : baseScore - 8,
        description: "Gaming interest match" },
      { name: "Language", score: input.languages.length > 1 ? Math.min(100, baseScore + 6) : baseScore,
        description: "Language compatibility" },
      { name: "Late Night", score: Math.min(100, baseScore - 2), description: "Late-night conversation vibe" }
    ].map(dimension => ({ ...dimension, score: Math.max(0, Math.min(100, Math.round(dimension.score))) }));
    sendOk(res, { dimensions });
  }));

  router.post("/vibe/preferences", asyncHandler(async (req, res) => {
    const userId = viewerId(res);
    const time = new Date().toISOString();
    const existing = await readVibeRow(userId);
    if (existing) {
      await db.prepare("UPDATE vibe_graphs SET updated_at = ? WHERE source_id = ?").bind(time, existing.source_id).run();
    } else {
      const current = await readUserRow(userId);
      if (!current) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      const inserted = await insertVibe(current, 0, false, "");
      if (!inserted) {
        await db.prepare("UPDATE vibe_graphs SET updated_at = ? WHERE user_id = ?").bind(time, userId).run();
      }
    }
    const vibe = await readVibeRow(userId);
    if (!vibe) throw new HttpError(500, "Vibe graph unavailable", ErrorCode.INTERNAL);
    sendOk(res, { vibeGraph: presentVibe(vibe) });
  }));

  return router;
}
