import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";

type MoodRow = {
  source_id: string; user_id: string; mood: string; emoji: string; activity: string;
  activity_room_id: string | null; activity_room_id_present: number;
  is_active: number; expires_at: string | null;
  created_at: string | null; updated_at: string | null;
};
type WaveRow = {
  source_id: string; sender_id: string; receiver_id: string; type: string; read: number;
  room_id: string | null; created_at: string | null; updated_at: string | null; sender_json: string | null;
};
type QuestionRow = {
  source_id: string; question: string; category: string; date: string; is_active: number;
  created_at: string | null; updated_at: string | null;
};
type AnswerRow = {
  source_id: string; user_id: string; question_id: string; answer: string; is_public: number;
  created_at: string | null; updated_at: string | null; user_json: string | null;
};
type PollRow = {
  source_id: string; user_id: string; question: string; audio_url: string; duration: number;
  is_active: number; expires_at: string | null; created_at: string | null; updated_at: string | null;
  user_json: string | null;
};
type PollChildren = {
  options: Array<{ source_id: string; text: string; audio_url: string | null; votes: number }>;
  voters: Array<{ value: string | null }>;
  ballots: Array<{ source_id: string; user_id: string; option_index: number }>;
};
type CountdownRow = {
  source_id: string; title: string; description: string; target_date: string; type: string;
  cover_image: string | null; color: string; is_active: number; created_at: string | null; updated_at: string | null;
};

const present = (value: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item !== null && item !== undefined));

// Legacy social routes populate only these fields from the sender/author/owner.
const compactUserJson = (alias: string) => `json_object('_id', ${alias}.source_id, 'name', ${alias}.name,
  'username', ${alias}.username, 'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
  'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}))`;

function parseCompactUser(record: string | null | undefined) {
  if (!record) return null;
  const { avatarParts, ...fields } = JSON.parse(record) as Record<string, unknown>;
  const parts = present((avatarParts ?? {}) as Record<string, unknown>);
  return {
    ...present(fields),
    ...(Object.keys(parts).length ? { avatarParts: parts } : {})
  };
}

const waveSelect = `SELECT w.source_id, w.sender_id, w.receiver_id, w.type, w.read, w.room_id,
  w.created_at, w.updated_at,
  (SELECT ${compactUserJson("u")} FROM users AS u WHERE u.source_id = w.sender_id) AS sender_json
  FROM wave_nudges AS w`;

const answerSelect = `SELECT a.source_id, a.user_id, a.question_id, a.answer, a.is_public,
  a.created_at, a.updated_at,
  (SELECT ${compactUserJson("u")} FROM users AS u WHERE u.source_id = a.user_id) AS user_json
  FROM user_daily_answers AS a`;

const pollSelect = `SELECT p.source_id, p.user_id, p.question, p.audio_url, p.duration, p.is_active,
  p.expires_at, p.created_at, p.updated_at,
  (SELECT ${compactUserJson("u")} FROM users AS u WHERE u.source_id = p.user_id) AS user_json
  FROM voice_polls AS p`;

function presentMood(row: MoodRow) {
  return {
    _id: row.source_id,
    userId: row.user_id,
    mood: row.mood,
    emoji: row.emoji,
    activity: row.activity,
    ...(row.activity_room_id
      ? { activityRoomId: row.activity_room_id }
      : row.activity_room_id_present ? { activityRoomId: null } : {}),
    isActive: Boolean(row.is_active),
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    __v: 0
  };
}

function presentWave(row: WaveRow, populateSender: boolean) {
  return {
    _id: row.source_id,
    senderId: populateSender ? parseCompactUser(row.sender_json) ?? row.sender_id : row.sender_id,
    receiverId: row.receiver_id,
    type: row.type,
    read: Boolean(row.read),
    ...(row.room_id ? { roomId: row.room_id } : {}),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    __v: 0
  };
}

function presentQuestion(row: QuestionRow) {
  return {
    _id: row.source_id,
    question: row.question,
    category: row.category,
    date: row.date,
    isActive: Boolean(row.is_active),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    __v: 0
  };
}

function presentAnswer(row: AnswerRow, populateUser: boolean) {
  return {
    _id: row.source_id,
    userId: populateUser ? parseCompactUser(row.user_json) ?? row.user_id : row.user_id,
    questionId: row.question_id,
    answer: row.answer,
    isPublic: Boolean(row.is_public),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    __v: 0
  };
}

function presentPoll(row: PollRow, children: PollChildren, populateUser: boolean) {
  const options = children.options.map(option => present({
    text: option.text, audioUrl: option.audio_url, votes: option.votes, _id: option.source_id
  }));
  const ballots = children.ballots.map(ballot => present({
    userId: ballot.user_id, optionIndex: ballot.option_index, _id: ballot.source_id
  }));
  return {
    _id: row.source_id,
    userId: populateUser ? parseCompactUser(row.user_json) ?? row.user_id : row.user_id,
    question: row.question,
    audioUrl: row.audio_url,
    duration: row.duration,
    options,
    voters: children.voters.map(voter => voter.value).filter((value): value is string => value !== null),
    isActive: Boolean(row.is_active),
    ...(row.expires_at ? { expiresAt: row.expires_at } : {}),
    ballots,
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    __v: 0
  };
}

function presentCountdown(row: CountdownRow) {
  return {
    _id: row.source_id,
    title: row.title,
    description: row.description,
    targetDate: row.target_date,
    type: row.type,
    ...(row.cover_image ? { coverImage: row.cover_image } : {}),
    color: row.color,
    isActive: Boolean(row.is_active),
    ...(row.created_at ? { createdAt: row.created_at } : {}),
    ...(row.updated_at ? { updatedAt: row.updated_at } : {}),
    __v: 0
  };
}

const idParam = (value: string, message: string) => {
  if (!isValidObjectId(value)) throw new HttpError(400, message, ErrorCode.VALIDATION);
  return value.toLowerCase();
};

const moodSchema = z.object({ mood: z.string().min(1), emoji: z.string().optional() });
const activitySchema = z.object({ activity: z.string().min(1), roomId: z.string().optional() });
const waveSchema = z.object({
  receiverId: z.string().min(1),
  type: z.enum(["wave", "nudge", "vibe_ping"]),
  roomId: z.string().optional()
});
const answerSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1).max(500),
  isPublic: z.boolean().optional()
});
const pollSchema = z.object({
  question: z.string().min(1).max(200),
  options: z.array(z.object({ text: z.string().min(1).max(100), audioUrl: z.string().optional() })).min(2).max(6),
  audioUrl: z.string().optional(),
  duration: z.number().int().optional(),
  expiresInHours: z.number().int().min(1).max(168).optional()
});
const voteSchema = z.object({ optionIndex: z.number().int().min(0) });
const countdownSchema = z.object({
  title: z.string().min(1).max(100),
  targetDate: z.string().datetime(),
  description: z.string().max(500).optional(),
  type: z.enum(["event", "festival", "special"]).optional(),
  coverImage: z.string().optional(),
  color: z.string().optional()
});

const moodOptions = [
  ["happy", "😊"], ["excited", "🎉"], ["chill", "😎"], ["romantic", "💕"], ["sad", "😢"],
  ["energetic", "🔥"], ["thoughtful", "🤔"], ["playful", "😜"], ["grateful", "🙏"], ["creative", "🎨"]
] as const;
const activityOptions = [
  "In a room", "Chatting", "Playing games", "Listening to music",
  "Watching videos", "Taking a break", "Busy", "AFK"
] as const;
const dailyQuestions = [
  "What's one thing that made you smile today?",
  "If you could have dinner with anyone, who would it be?",
  "What's your go-to karaoke song?",
  "What's the best advice you've ever received?",
  "What's a skill you'd love to learn?",
  "What's your favorite way to spend a weekend?",
  "What's the most beautiful place you've visited?",
  "What's a movie that always makes you cry?",
  "What's your guilty pleasure?",
  "If you could travel anywhere right now, where would you go?",
  "What's the nicest thing someone has done for you?",
  "What's your idea of a perfect date?",
  "What's a book that changed your perspective?",
  "What's your favorite season and why?",
  "What's a small thing that makes your day better?",
  "What's the most adventurous thing you've done?",
  "What's your love language?",
  "What's a dream you've given up on?",
  "What's the best concert you've ever been to?",
  "What's something you're really proud of?"
] as const;

export function createD1SocialFeaturesRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const requireSession = asyncHandler(async (req, res, next) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    res.locals.socialUserId = user.id;
    next();
  });
  const userIdOf = (res: { locals: Record<string, unknown> }) => res.locals.socialUserId as string;

  async function readMood(userId: string) {
    return db.prepare("SELECT * FROM user_moods WHERE user_id = ?").bind(userId).first<MoodRow>();
  }

  async function readWave(id: string, receiverId: string) {
    return db.prepare(`${waveSelect} WHERE w.source_id = ? AND w.receiver_id = ?`)
      .bind(id, receiverId).first<WaveRow>();
  }

  async function readQuestion(id: string) {
    return db.prepare("SELECT * FROM daily_questions WHERE source_id = ?").bind(id).first<QuestionRow>();
  }

  // SQLite cannot correlate a nested FROM subquery with the outer poll row, so
  // children are read directly and ordered by their imported array positions.
  async function pollChildren(pollId: string): Promise<PollChildren> {
    const [options, voters, ballots] = await Promise.all([
      db.prepare(`SELECT source_id, text, audio_url, votes FROM voice_poll_options
        WHERE voice_polls_id = ? ORDER BY position, source_id`)
        .bind(pollId).all<PollChildren["options"][number]>(),
      db.prepare(`SELECT value FROM voice_poll_votes
        WHERE voice_polls_id = ? ORDER BY position, source_id`)
        .bind(pollId).all<PollChildren["voters"][number]>(),
      db.prepare(`SELECT source_id, user_id, option_index FROM voice_poll_ballots
        WHERE voice_polls_id = ? ORDER BY position, source_id`)
        .bind(pollId).all<PollChildren["ballots"][number]>()
    ]);
    return { options: options.results, voters: voters.results, ballots: ballots.results };
  }

  async function loadPoll(id: string) {
    const row = await db.prepare(`${pollSelect} WHERE p.source_id = ?`).bind(id).first<PollRow>();
    if (!row) throw new HttpError(404, "Poll not found", ErrorCode.NOT_FOUND);
    return { row, children: await pollChildren(id) };
  }

  // Scope the guard to this router's paths so unrelated `/api/*` requests are
  // not challenged before the fetch-level routes get a chance to answer.
  router.use("/social", requireSession);

  router.get("/social/mood", asyncHandler(async (_req, res) => {
    const row = await db.prepare("SELECT * FROM user_moods WHERE user_id = ? AND is_active = 1")
      .bind(userIdOf(res)).first<MoodRow>();
    sendOk(res, { mood: row ? presentMood(row) : null });
  }));

  router.post("/social/mood", validateBody(moodSchema), asyncHandler(async (req, res) => {
    const { mood, emoji } = req.body as z.infer<typeof moodSchema>;
    const valid = moodOptions.find(option => option[0] === mood);
    if (!valid) throw new HttpError(400, "Invalid mood option", ErrorCode.VALIDATION);
    const time = new Date().toISOString();
    const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString();
    await db.prepare(`INSERT INTO user_moods (source_id, user_id, mood, emoji, activity, is_active, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, '', 1, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET mood = excluded.mood, emoji = excluded.emoji,
        is_active = 1, expires_at = excluded.expires_at, updated_at = excluded.updated_at`)
      .bind(newId(), userIdOf(res), mood, emoji || valid[1], expiresAt, time, time).run();
    sendOk(res, { mood: presentMood((await readMood(userIdOf(res)))!) });
  }));

  router.post("/social/activity", validateBody(activitySchema), asyncHandler(async (req, res) => {
    const { activity, roomId } = req.body as z.infer<typeof activitySchema>;
    if (!activityOptions.includes(activity as typeof activityOptions[number]) && activity !== "") {
      throw new HttpError(400, "Invalid activity option", ErrorCode.VALIDATION);
    }
    if (roomId && !isValidObjectId(roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
    const time = new Date().toISOString();
    const expiresAt = activity ? new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString() : null;
    const activityRoom = roomId ? roomId.toLowerCase() : null;
    await db.prepare(`INSERT INTO user_moods (source_id, user_id, mood, emoji, activity, activity_room_id,
      activity_room_id_present, is_active, expires_at, created_at, updated_at)
      VALUES (?, ?, '', '', ?, ?, 1, ?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET activity = excluded.activity,
        activity_room_id = excluded.activity_room_id,
        activity_room_id_present = 1,
        is_active = excluded.is_active,
        expires_at = excluded.expires_at,
        updated_at = excluded.updated_at`)
      .bind(newId(), userIdOf(res), activity, activityRoom, activity ? 1 : 0, expiresAt, time, time).run();
    sendOk(res, { mood: presentMood((await readMood(userIdOf(res)))!) });
  }));

  router.delete("/social/mood", asyncHandler(async (_req, res) => {
    await db.prepare("UPDATE user_moods SET is_active = 0, expires_at = ?, updated_at = ? WHERE user_id = ?")
      .bind(new Date(0).toISOString(), new Date().toISOString(), userIdOf(res)).run();
    sendOk(res, { cleared: true });
  }));

  router.post("/social/wave", validateBody(waveSchema), asyncHandler(async (req, res) => {
    const { receiverId, type, roomId } = req.body as z.infer<typeof waveSchema>;
    if (!isValidObjectId(receiverId)) throw new HttpError(400, "Invalid receiverId", ErrorCode.VALIDATION);
    if (roomId && !isValidObjectId(roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
    const waveId = newId();
    const receiver = receiverId.toLowerCase();
    const room = roomId ? roomId.toLowerCase() : undefined;
    const time = new Date().toISOString();
    const label = type === "vibe_ping" ? "vibe ping" : type;
    await db.batch([
      db.prepare(`INSERT INTO wave_nudges (source_id, sender_id, receiver_id, type, read, room_id, created_at, updated_at)
        VALUES (?, ?, ?, ?, 0, ?, ?, ?)`).bind(waveId, userIdOf(res), receiver, type, room ?? null, time, time),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        VALUES (?, ?, 'WAVE', ?, ?, ?, 0, ?, ?)`).bind(newId(), receiver, `New ${label}`,
        `Someone sent you a ${label}!`,
        JSON.stringify({ senderId: userIdOf(res), type, waveId, ...(room ? { roomId: room } : {}) }), time, time)
    ]);
    sendOk(res, { wave: presentWave((await readWave(waveId, receiver))!, false) });
  }));

  router.get("/social/waves", asyncHandler(async (req, res) => {
    const unreadOnly = req.query.unread === "true";
    const { results } = await db.prepare(`${waveSelect} WHERE w.receiver_id = ? ${unreadOnly ? "AND w.read = 0" : ""}
      ORDER BY w.created_at DESC, w.source_id DESC LIMIT 50`).bind(userIdOf(res)).all<WaveRow>();
    sendOk(res, { waves: results.map(row => presentWave(row, true)) });
  }));

  router.get("/social/waves/unread-count", asyncHandler(async (_req, res) => {
    const count = await db.prepare("SELECT COUNT(*) AS count FROM wave_nudges WHERE receiver_id = ? AND read = 0")
      .bind(userIdOf(res)).first<{ count: number }>();
    sendOk(res, { count: count?.count ?? 0 });
  }));

  router.post("/social/waves/:waveId/read", asyncHandler(async (req, res) => {
    const waveId = idParam(req.params.waveId, "Invalid waveId");
    const result = await db.prepare("UPDATE wave_nudges SET read = 1, updated_at = ? WHERE source_id = ? AND receiver_id = ?")
      .bind(new Date().toISOString(), waveId, userIdOf(res)).run();
    if (!result.meta.changes || !(await readWave(waveId, userIdOf(res)))) {
      throw new HttpError(404, "Wave not found", ErrorCode.NOT_FOUND);
    }
    sendOk(res, { wave: presentWave((await readWave(waveId, userIdOf(res)))!, false) });
  }));

  router.get("/social/daily-question", asyncHandler(async (_req, res) => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    let existing = await db.prepare(`SELECT * FROM daily_questions
      WHERE date >= ? AND date < ? AND is_active = 1 ORDER BY date DESC LIMIT 1`)
      .bind(start.toISOString(), end.toISOString()).first<QuestionRow>();
    if (!existing) {
      const dayOfYear = Math.floor((start.getTime() - new Date(start.getFullYear(), 0, 0).getTime()) / 86400000);
      const time = new Date().toISOString();
      const inserted = await db.prepare(`INSERT OR IGNORE INTO daily_questions
        (source_id, question, category, date, is_active, created_at, updated_at)
        VALUES (?, ?, 'general', ?, 1, ?, ?)`)
        .bind(newId(), dailyQuestions[dayOfYear % dailyQuestions.length], start.toISOString(), time, time).run();
      if (!inserted.meta.changes) {
        existing = await db.prepare(`SELECT * FROM daily_questions
          WHERE date >= ? AND date < ? AND is_active = 1 ORDER BY date DESC LIMIT 1`)
          .bind(start.toISOString(), end.toISOString()).first<QuestionRow>();
      } else {
        existing = await db.prepare("SELECT * FROM daily_questions WHERE date = ?").bind(start.toISOString()).first<QuestionRow>();
      }
    }
    sendOk(res, { question: existing ? presentQuestion(existing) : null });
  }));

  router.post("/social/daily-question/answer", validateBody(answerSchema), asyncHandler(async (req, res) => {
    const { questionId, answer, isPublic } = req.body as z.infer<typeof answerSchema>;
    const question = idParam(questionId, "Invalid questionId");
    const userId = userIdOf(res);
    if (await db.prepare("SELECT source_id FROM user_daily_answers WHERE user_id = ? AND question_id = ?")
      .bind(userId, question).first()) {
      throw new HttpError(409, "Already answered today", ErrorCode.CONFLICT);
    }
    const answerId = newId();
    const time = new Date().toISOString();
    const inserted = await db.prepare(`INSERT OR IGNORE INTO user_daily_answers
      (source_id, user_id, question_id, answer, is_public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(answerId, userId, question, answer, isPublic === false ? 0 : 1, time, time).run();
    if (!inserted.meta.changes) throw new HttpError(409, "Already answered today", ErrorCode.CONFLICT);
    const row = await db.prepare("SELECT * FROM user_daily_answers WHERE source_id = ?").bind(answerId).first<AnswerRow>();
    sendOk(res, { answer: presentAnswer(row!, false) });
  }));

  router.get("/social/daily-question/answers/:questionId", asyncHandler(async (req, res) => {
    const questionId = idParam(req.params.questionId, "Invalid questionId");
    const { results } = await db.prepare(`${answerSelect} WHERE a.question_id = ? AND a.is_public = 1
      ORDER BY a.created_at DESC, a.source_id DESC LIMIT 50`).bind(questionId).all<AnswerRow>();
    sendOk(res, { answers: results.map(row => presentAnswer(row, true)) });
  }));

  router.get("/social/daily-question/my-answer/:questionId", asyncHandler(async (req, res) => {
    const questionId = idParam(req.params.questionId, "Invalid questionId");
    const row = await db.prepare("SELECT * FROM user_daily_answers WHERE user_id = ? AND question_id = ?")
      .bind(userIdOf(res), questionId).first<AnswerRow>();
    sendOk(res, { answer: row ? presentAnswer(row, false) : null });
  }));

  router.post("/social/voice-polls", validateBody(pollSchema), asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof pollSchema>;
    if (input.options.length < 2 || input.options.length > 6) {
      throw new HttpError(400, "Voice poll needs 2-6 options", ErrorCode.VALIDATION);
    }
    const pollId = newId();
    const time = new Date().toISOString();
    const expiresAt = new Date(Date.now() + (input.expiresInHours ?? 24) * 60 * 60 * 1000).toISOString();
    const statements = [db.prepare(`INSERT INTO voice_polls
      (source_id, user_id, question, audio_url, duration, is_active, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?)`).bind(pollId, userIdOf(res), input.question,
      input.audioUrl || "", input.duration || 0, expiresAt, time, time)];
    input.options.forEach((option, position) => statements.push(db.prepare(`INSERT INTO voice_poll_options
      (source_id, text, audio_url, votes, voice_polls_id, position) VALUES (?, ?, ?, 0, ?, ?)`)
      .bind(newId(), option.text, option.audioUrl ?? null, pollId, position)));
    await db.batch(statements);
    const created = await loadPoll(pollId);
    sendOk(res, { poll: presentPoll(created.row, created.children, false) });
  }));

  router.get("/social/voice-polls", asyncHandler(async (req, res) => {
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
    const now = new Date().toISOString();
    const [rows, count] = await Promise.all([
      db.prepare(`${pollSelect} WHERE p.is_active = 1 AND p.expires_at > ?
        ORDER BY p.created_at DESC, p.source_id DESC LIMIT ? OFFSET ?`)
        .bind(now, limit, (page - 1) * limit).all<PollRow>(),
      db.prepare("SELECT COUNT(*) AS total FROM voice_polls WHERE is_active = 1 AND expires_at > ?")
        .bind(now).first<{ total: number }>()
    ]);
    const polls = await Promise.all(rows.results.map(async row =>
      presentPoll(row, await pollChildren(row.source_id), true)));
    sendOk(res, {
      polls,
      total: count?.total ?? 0,
      page,
      limit
    });
  }));

  router.get("/social/voice-polls/mine", asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`${pollSelect} WHERE p.user_id = ?
      ORDER BY p.created_at DESC, p.source_id DESC`).bind(userIdOf(res)).all<PollRow>();
    const polls = await Promise.all(results.map(async row =>
      presentPoll(row, await pollChildren(row.source_id), false)));
    sendOk(res, { polls });
  }));

  router.get("/social/voice-polls/:pollId", asyncHandler(async (req, res) => {
    const pollId = idParam(req.params.pollId, "Invalid pollId");
    const poll = await loadPoll(pollId);
    sendOk(res, { poll: presentPoll(poll.row, poll.children, true) });
  }));

  router.post("/social/voice-polls/:pollId/vote", validateBody(voteSchema), asyncHandler(async (req, res) => {
    const pollId = idParam(req.params.pollId, "Invalid pollId");
    const { optionIndex } = req.body as z.infer<typeof voteSchema>;
    const userId = userIdOf(res);
    const existing = await db.prepare(`SELECT p.is_active, p.expires_at,
      (SELECT COUNT(*) FROM voice_poll_options AS o WHERE o.voice_polls_id = p.source_id) AS options
      FROM voice_polls AS p WHERE p.source_id = ?`).bind(pollId).first<{
        is_active: number; expires_at: string | null; options: number
      }>();
    if (!existing) throw new HttpError(404, "Poll not found", ErrorCode.NOT_FOUND);
    if (!existing.is_active) throw new HttpError(400, "Poll is closed", ErrorCode.VALIDATION);
    if (existing.expires_at && existing.expires_at < new Date().toISOString()) {
      throw new HttpError(400, "Poll has expired", ErrorCode.VALIDATION);
    }
    if (optionIndex >= existing.options) throw new HttpError(400, "Invalid option", ErrorCode.VALIDATION);

    // A fresh attempt ID, combined with the unique (poll, voter) index, proves
    // this request won the guarded batch. A deterministic ID would make a
    // replay look like a successful claim and double-count the vote.
    const voteId = newId();
    const ballotId = newId();
    const time = new Date().toISOString();
    const claimed = `EXISTS (SELECT 1 FROM voice_poll_votes AS v WHERE v.source_id = ?)`;
    const [vote] = await db.batch([
      db.prepare(`INSERT OR IGNORE INTO voice_poll_votes (source_id, value, voice_polls_id, position)
        SELECT ?, ?, p.source_id, (SELECT COUNT(*) FROM voice_poll_votes AS v WHERE v.voice_polls_id = p.source_id)
        FROM voice_polls AS p WHERE p.source_id = ? AND p.is_active = 1 AND p.expires_at > ?
          AND NOT EXISTS (SELECT 1 FROM voice_poll_votes AS v WHERE v.voice_polls_id = p.source_id AND v.value = ?)`)
        .bind(voteId, userId, pollId, time, userId),
      db.prepare(`UPDATE voice_poll_options SET votes = votes + 1, voice_polls_id = voice_polls_id
        WHERE voice_polls_id = ? AND position = ? AND ${claimed}`).bind(pollId, optionIndex, voteId),
      db.prepare(`INSERT INTO voice_poll_ballots (source_id, user_id, option_index, voice_polls_id, position)
        SELECT ?, ?, ?, p.source_id, (SELECT COUNT(*) FROM voice_poll_ballots AS b WHERE b.voice_polls_id = p.source_id)
        FROM voice_polls AS p WHERE p.source_id = ? AND ${claimed}`)
        .bind(ballotId, userId, optionIndex, pollId, voteId),
      db.prepare(`UPDATE voice_polls SET updated_at = ? WHERE source_id = ? AND ${claimed}`)
        .bind(time, pollId, voteId)
    ]);
    if (vote.meta.changes) {
      const poll = await loadPoll(pollId);
      sendOk(res, { poll: presentPoll(poll.row, poll.children, true) });
      return;
    }
    const latest = await db.prepare(`SELECT p.is_active, p.expires_at,
      EXISTS (SELECT 1 FROM voice_poll_votes AS v WHERE v.voice_polls_id = p.source_id AND v.value = ?) AS voted
      FROM voice_polls AS p WHERE p.source_id = ?`).bind(userId, pollId).first<{
        is_active: number; expires_at: string | null; voted: number
      }>();
    if (!latest) throw new HttpError(404, "Poll not found", ErrorCode.NOT_FOUND);
    if (!latest.is_active) throw new HttpError(400, "Poll is closed", ErrorCode.VALIDATION);
    if (latest.expires_at && latest.expires_at < new Date().toISOString()) {
      throw new HttpError(400, "Poll has expired", ErrorCode.VALIDATION);
    }
    if (latest.voted) throw new HttpError(409, "Already voted", ErrorCode.CONFLICT);
    throw new HttpError(409, "Could not record vote", ErrorCode.CONFLICT);
  }));

  router.post("/social/voice-polls/:pollId/close", asyncHandler(async (req, res) => {
    const pollId = idParam(req.params.pollId, "Invalid pollId");
    const owner = await db.prepare("SELECT user_id, is_active FROM voice_polls WHERE source_id = ?")
      .bind(pollId).first<{ user_id: string; is_active: number }>();
    if (!owner) throw new HttpError(404, "Poll not found", ErrorCode.NOT_FOUND);
    if (owner.user_id !== userIdOf(res)) {
      throw new HttpError(403, "Only the poll creator can close this poll", ErrorCode.FORBIDDEN);
    }
    if (owner.is_active) {
      await db.prepare("UPDATE voice_polls SET is_active = 0, updated_at = ? WHERE source_id = ?")
        .bind(new Date().toISOString(), pollId).run();
    }
    const poll = await loadPoll(pollId);
    sendOk(res, { poll: presentPoll(poll.row, poll.children, true) });
  }));

  router.get("/social/countdowns", asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`SELECT * FROM countdown_events
      WHERE is_active = 1 AND target_date > ? ORDER BY target_date ASC, source_id ASC`)
      .bind(new Date().toISOString()).all<CountdownRow>();
    sendOk(res, { events: results.map(presentCountdown) });
  }));

  router.post("/social/countdowns", validateBody(countdownSchema), asyncHandler(async (req, res) => {
    const input = req.body as z.infer<typeof countdownSchema>;
    const id = newId();
    const time = new Date().toISOString();
    await db.prepare(`INSERT INTO countdown_events
      (source_id, title, description, target_date, type, cover_image, color, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`)
      .bind(id, input.title, input.description ?? "", new Date(input.targetDate).toISOString(),
        input.type ?? "event", input.coverImage ?? null, input.color ?? "#E91E63", time, time).run();
    const row = await db.prepare("SELECT * FROM countdown_events WHERE source_id = ?").bind(id).first<CountdownRow>();
    sendOk(res, { event: presentCountdown(row!) });
  }));

  return router;
}
