import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import {
  setMood, setActivity, getMood, clearMood,
  sendWave, getWaves, markWaveRead, getUnreadWaveCount,
  getTodaysQuestion, answerDailyQuestion, getDailyQuestionAnswers, getMyDailyAnswer,
  createVoicePoll, getActiveVoicePolls, voteVoicePoll, getMyVoicePolls,
  getActiveCountdowns, createCountdownEvent
} from "../services/social.js";

export const socialRouter = Router();
socialRouter.use(requireAuth);

// ─── Mood & Activity ───────────────────────────────────────────

socialRouter.get("/social/mood", asyncHandler(async (req: AuthRequest, res) => {
  const result = await getMood(req.user!.id);
  sendOk(res, result);
}));

const setMoodSchema = z.object({
  mood: z.string().min(1),
  emoji: z.string().optional()
});

socialRouter.post("/social/mood", validateBody(setMoodSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { mood, emoji } = req.body;
  const result = await setMood(req.user!.id, mood, emoji);
  sendOk(res, result);
}));

const setActivitySchema = z.object({
  activity: z.string().min(1),
  roomId: z.string().optional()
});

socialRouter.post("/social/activity", validateBody(setActivitySchema), asyncHandler(async (req: AuthRequest, res) => {
  const { activity, roomId } = req.body;
  if (roomId && !isValidObjectId(roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
  const result = await setActivity(req.user!.id, activity, roomId);
  sendOk(res, result);
}));

socialRouter.delete("/social/mood", asyncHandler(async (req: AuthRequest, res) => {
  const result = await clearMood(req.user!.id);
  sendOk(res, result);
}));

// ─── Wave / Nudge / Vibe Ping ──────────────────────────────────

const sendWaveSchema = z.object({
  receiverId: z.string().min(1),
  type: z.enum(["wave", "nudge", "vibe_ping"]),
  roomId: z.string().optional()
});

socialRouter.post("/social/wave", validateBody(sendWaveSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { receiverId, type, roomId } = req.body;
  if (!isValidObjectId(receiverId)) throw new HttpError(400, "Invalid receiverId", ErrorCode.VALIDATION);
  if (roomId && !isValidObjectId(roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
  const result = await sendWave(req.user!.id, receiverId, type, roomId);
  sendOk(res, result);
}));

socialRouter.get("/social/waves", asyncHandler(async (req: AuthRequest, res) => {
  const unreadOnly = req.query.unread === "true";
  const result = await getWaves(req.user!.id, unreadOnly);
  sendOk(res, result);
}));

socialRouter.get("/social/waves/unread-count", asyncHandler(async (req: AuthRequest, res) => {
  const result = await getUnreadWaveCount(req.user!.id);
  sendOk(res, result);
}));

socialRouter.post("/social/waves/:waveId/read", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.waveId)) throw new HttpError(400, "Invalid waveId", ErrorCode.VALIDATION);
  const result = await markWaveRead(req.params.waveId, req.user!.id);
  sendOk(res, result);
}));

// ─── Daily Question ────────────────────────────────────────────

socialRouter.get("/social/daily-question", asyncHandler(async (_req: AuthRequest, res) => {
  const result = await getTodaysQuestion();
  sendOk(res, result);
}));

const answerQuestionSchema = z.object({
  questionId: z.string().min(1),
  answer: z.string().min(1).max(500),
  isPublic: z.boolean().optional()
});

socialRouter.post("/social/daily-question/answer", validateBody(answerQuestionSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { questionId, answer, isPublic } = req.body;
  if (!isValidObjectId(questionId)) throw new HttpError(400, "Invalid questionId", ErrorCode.VALIDATION);
  const result = await answerDailyQuestion(req.user!.id, questionId, answer, isPublic);
  sendOk(res, result);
}));

socialRouter.get("/social/daily-question/answers/:questionId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.questionId)) throw new HttpError(400, "Invalid questionId", ErrorCode.VALIDATION);
  const result = await getDailyQuestionAnswers(req.params.questionId, req.user!.id);
  sendOk(res, result);
}));

socialRouter.get("/social/daily-question/my-answer/:questionId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.questionId)) throw new HttpError(400, "Invalid questionId", ErrorCode.VALIDATION);
  const result = await getMyDailyAnswer(req.user!.id, req.params.questionId);
  sendOk(res, result);
}));

// ─── Voice Polls ───────────────────────────────────────────────

const createVoicePollSchema = z.object({
  question: z.string().min(1).max(200),
  options: z.array(z.object({
    text: z.string().min(1).max(100),
    audioUrl: z.string().optional()
  })).min(2).max(6),
  audioUrl: z.string().optional(),
  duration: z.number().int().optional(),
  expiresInHours: z.number().int().min(1).max(168).optional()
});

socialRouter.post("/social/voice-polls", validateBody(createVoicePollSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { question, options, audioUrl, duration, expiresInHours } = req.body;
  const result = await createVoicePoll(req.user!.id, question, options, audioUrl, duration, expiresInHours);
  sendOk(res, result);
}));

socialRouter.get("/social/voice-polls", asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(req.query.limit) || 20));
  const result = await getActiveVoicePolls(page, limit);
  sendOk(res, result);
}));

const voteVoicePollSchema = z.object({
  optionIndex: z.number().int().min(0)
});

socialRouter.post("/social/voice-polls/:pollId/vote", validateBody(voteVoicePollSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.pollId)) throw new HttpError(400, "Invalid pollId", ErrorCode.VALIDATION);
  const { optionIndex } = req.body;
  const result = await voteVoicePoll(req.params.pollId, req.user!.id, optionIndex);
  sendOk(res, result);
}));

socialRouter.get("/social/voice-polls/mine", asyncHandler(async (req: AuthRequest, res) => {
  const result = await getMyVoicePolls(req.user!.id);
  sendOk(res, result);
}));

// ─── Countdown Events ──────────────────────────────────────────

socialRouter.get("/social/countdowns", asyncHandler(async (_req: AuthRequest, res) => {
  const result = await getActiveCountdowns();
  sendOk(res, result);
}));

const createCountdownSchema = z.object({
  title: z.string().min(1).max(100),
  targetDate: z.string().datetime(),
  description: z.string().max(500).optional(),
  type: z.enum(["event", "festival", "special"]).optional(),
  coverImage: z.string().optional(),
  color: z.string().optional()
});

socialRouter.post("/social/countdowns", validateBody(createCountdownSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { title, targetDate, description, type, coverImage, color } = req.body;
  const result = await createCountdownEvent(title, targetDate, description, type, coverImage, color);
  sendOk(res, result);
}));
