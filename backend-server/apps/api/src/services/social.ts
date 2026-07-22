import { UserMood } from "../models/UserMood.js";
import { WaveNudge } from "../models/WaveNudge.js";
import { DailyQuestion, UserDailyAnswer } from "../models/DailyQuestion.js";
import { VoicePoll } from "../models/VoicePoll.js";
import { CountdownEvent } from "../models/CountdownEvent.js";
import { createNotification } from "./notifications.js";
import { HttpError, ErrorCode } from "../utils/http.js";

// ─── Mood & Activity ───────────────────────────────────────────

const MOOD_OPTIONS = [
  { mood: "happy", emoji: "😊" },
  { mood: "excited", emoji: "🎉" },
  { mood: "chill", emoji: "😎" },
  { mood: "romantic", emoji: "💕" },
  { mood: "sad", emoji: "😢" },
  { mood: "energetic", emoji: "🔥" },
  { mood: "thoughtful", emoji: "🤔" },
  { mood: "playful", emoji: "😜" },
  { mood: "grateful", emoji: "🙏" },
  { mood: "creative", emoji: "🎨" },
] as const;

const ACTIVITY_OPTIONS = [
  "In a room", "Chatting", "Playing games", "Listening to music",
  "Watching videos", "Taking a break", "Busy", "AFK"
] as const;

export async function setMood(userId: string, mood: string, emoji?: string) {
  const valid = MOOD_OPTIONS.find((m) => m.mood === mood);
  if (!valid) throw new HttpError(400, "Invalid mood option", ErrorCode.VALIDATION);

  const expiresAt = new Date(Date.now() + 4 * 60 * 60 * 1000);
  const updated = await UserMood.findOneAndUpdate(
    { userId },
    { mood, emoji: emoji || valid.emoji, isActive: true, expiresAt },
    { upsert: true, new: true }
  );
  return { mood: updated };
}

export async function setActivity(userId: string, activity: string, roomId?: string) {
  if (!ACTIVITY_OPTIONS.includes(activity as any) && activity !== "") {
    throw new HttpError(400, "Invalid activity option", ErrorCode.VALIDATION);
  }
  const expiresAt = activity ? new Date(Date.now() + 2 * 60 * 60 * 1000) : undefined;
  const updated = await UserMood.findOneAndUpdate(
    { userId },
    { activity, activityRoomId: roomId || null, isActive: !!activity, expiresAt },
    { upsert: true, new: true }
  );
  return { mood: updated };
}

export async function getMood(userId: string) {
  const mood = await UserMood.findOne({ userId, isActive: true }).lean();
  return { mood };
}

export async function clearMood(userId: string) {
  await UserMood.findOneAndUpdate({ userId }, { isActive: false, expiresAt: new Date(0) });
  return { cleared: true };
}

// ─── Wave / Nudge / Vibe Ping ──────────────────────────────────

export async function sendWave(userId: string, receiverId: string, type: "wave" | "nudge" | "vibe_ping", roomId?: string) {
  const wave = await WaveNudge.create({ senderId: userId, receiverId, type, roomId });

  const label = type === "vibe_ping" ? "vibe ping" : type;
  await createNotification(receiverId, "WAVE", `New ${label}`, `Someone sent you a ${label}!`, {
    senderId: userId,
    type,
    waveId: wave.id,
    roomId
  });

  return { wave };
}

export async function getWaves(userId: string, unreadOnly = false) {
  const filter: Record<string, unknown> = { receiverId: userId };
  if (unreadOnly) filter.read = false;

  const waves = await WaveNudge.find(filter)
    .sort({ createdAt: -1 })
    .limit(50)
    .populate("senderId", "name username avatar")
    .lean();

  return { waves };
}

export async function markWaveRead(waveId: string, userId: string) {
  const wave = await WaveNudge.findOneAndUpdate(
    { _id: waveId, receiverId: userId },
    { read: true },
    { new: true }
  );
  if (!wave) throw new HttpError(404, "Wave not found", ErrorCode.NOT_FOUND);
  return { wave };
}

export async function getUnreadWaveCount(userId: string) {
  const count = await WaveNudge.countDocuments({ receiverId: userId, read: false });
  return { count };
}

// ─── Daily Question ────────────────────────────────────────────

export async function getTodaysQuestion() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existing = await DailyQuestion.findOne({ date: { $gte: today, $lt: tomorrow }, isActive: true }).lean();
  if (existing) {
    return { question: existing };
  }
  const questions = [
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
    "What's something you're really proud of?",
  ];
  const dayOfYear = Math.floor((today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000);
  const selected = questions[dayOfYear % questions.length];
  const question = await DailyQuestion.create({ question: selected, category: "general", date: today });
  return { question: question.toObject() };
  return { question };
}

export async function answerDailyQuestion(userId: string, questionId: string, answer: string, isPublic = true) {
  const existing = await UserDailyAnswer.findOne({ userId, questionId }).lean();
  if (existing) throw new HttpError(409, "Already answered today", ErrorCode.CONFLICT);

  const answerDoc = await UserDailyAnswer.create({ userId, questionId, answer, isPublic });
  return { answer: answerDoc };
}

export async function getDailyQuestionAnswers(questionId: string, userId: string) {
  const answers = await UserDailyAnswer.find({ questionId, isPublic: true })
    .populate("userId", "name username avatar")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  return { answers };
}

export async function getMyDailyAnswer(userId: string, questionId: string) {
  const answer = await UserDailyAnswer.findOne({ userId, questionId }).lean();
  return { answer };
}

// ─── Voice Polls ───────────────────────────────────────────────

export async function createVoicePoll(
  userId: string,
  question: string,
  options: Array<{ text: string; audioUrl?: string }>,
  audioUrl?: string,
  duration?: number,
  expiresInHours = 24
) {
  if (options.length < 2 || options.length > 6) {
    throw new HttpError(400, "Voice poll needs 2-6 options", ErrorCode.VALIDATION);
  }

  const expiresAt = new Date(Date.now() + expiresInHours * 60 * 60 * 1000);
  const poll = await VoicePoll.create({
    userId,
    question,
    audioUrl: audioUrl || "",
    duration: duration || 0,
    options: options.map((o) => ({ text: o.text, audioUrl: o.audioUrl, votes: 0 })),
    expiresAt
  });
  return { poll };
}

export async function getActiveVoicePolls(page = 1, limit = 20) {
  const polls = await VoicePoll.find({ isActive: true, expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .skip((page - 1) * limit).limit(limit)
    .populate("userId", "name username avatar")
    .lean();
  const total = await VoicePoll.countDocuments({ isActive: true, expiresAt: { $gt: new Date() } });
  return { polls, total, page, limit };
}

export async function voteVoicePoll(pollId: string, userId: string, optionIndex: number) {
  const poll = await VoicePoll.findById(pollId);
  if (!poll) throw new HttpError(404, "Poll not found", ErrorCode.NOT_FOUND);
  if (!poll.isActive) throw new HttpError(400, "Poll is closed", ErrorCode.VALIDATION);
  if (poll.expiresAt && poll.expiresAt < new Date()) throw new HttpError(400, "Poll has expired", ErrorCode.VALIDATION);

  const alreadyVoted = poll.voters.some((v) => v.toString() === userId);
  if (alreadyVoted) throw new HttpError(409, "Already voted", ErrorCode.CONFLICT);
  if (optionIndex < 0 || optionIndex >= poll.options.length) throw new HttpError(400, "Invalid option", ErrorCode.VALIDATION);

  poll.options[optionIndex].votes += 1;
  poll.voters.push(userId as any);
  await poll.save();

  return { poll };
}

export async function getMyVoicePolls(userId: string) {
  const polls = await VoicePoll.find({ userId }).sort({ createdAt: -1 }).lean();
  return { polls };
}

// ─── Countdown Events ──────────────────────────────────────────

export async function getActiveCountdowns() {
  const events = await CountdownEvent.find({ isActive: true, targetDate: { $gt: new Date() } })
    .sort({ targetDate: 1 })
    .lean();
  return { events };
}

export async function createCountdownEvent(
  title: string,
  targetDate: string,
  description?: string,
  type?: string,
  coverImage?: string,
  color?: string
) {
  const event = await CountdownEvent.create({
    title,
    targetDate: new Date(targetDate),
    description: description || "",
    type: type || "event",
    coverImage,
    color: color || "#E91E63"
  });
  return { event };
}
