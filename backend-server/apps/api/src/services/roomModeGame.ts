import type { RoomMode } from "@yugm/shared";
import { z } from "zod";
import { ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import {
  blindDateRevealRounds, coffeeDateQuestions, neverHaveIEverPrompts, pickRandom, shuffleArray, wouldYouRatherQuestions
} from "./roomModePrompts.js";

export const modeActionSchema = z.object({
  action: z.enum(["start", "next_round", "submit_answer", "submit_dare", "vote", "end"]),
  data: z.record(z.unknown()).optional(),
  // Installed Android builds send these fields beside action.
  answer: z.unknown().optional(),
  dare: z.unknown().optional(),
  targetUserId: z.unknown().optional(),
  value: z.unknown().optional()
});

export type ModeAction = z.infer<typeof modeActionSchema>;
export type ModeMetadata = {
  [key: string]: unknown;
  shuffledParticipants?: string[];
  currentQuestionIndex?: number;
  questions?: string[];
  revealCountdown?: number;
  hostRevealed?: boolean;
  promptPool?: string[];
  usedPrompts?: string[];
  pairPool?: string[][];
  usedPairs?: string[][];
  answers?: Record<string, string>;
  currentDare?: string;
};

export interface ModeState {
  _id: string;
  roomId: string;
  mode: RoomMode;
  round: number;
  status: "WAITING" | "ACTIVE" | "ROUND_END" | "FINISHED";
  scores: Record<string, number>;
  participants: string[];
  currentTurnUserId: string | null;
  currentQuestion: string | null;
  currentOptions: string[];
  roundStartTime: string | null;
  roundEndTime: string | null;
  metadata: ModeMetadata;
  createdAt: string | null;
  updatedAt: string | null;
}

function validation(message: string): never {
  throw new HttpError(400, message, ErrorCode.VALIDATION);
}

function beginRound(state: ModeState, now: Date) {
  state.status = "ACTIVE";
  state.roundStartTime = now.toISOString();
  state.roundEndTime = new Date(now.getTime() + 60_000).toISOString();
  delete state.metadata.answers;
  delete state.metadata.currentDare;
}

function start(state: ModeState, now: Date) {
  if (state.status !== "WAITING") validation("Mode already started");
  beginRound(state, now);
  const meta = state.metadata;
  switch (state.mode) {
    case "coffee_date":
      meta.questions = shuffleArray(coffeeDateQuestions);
      meta.currentQuestionIndex = 0;
      state.currentQuestion = meta.questions[0];
      break;
    case "blind_date":
      state.currentQuestion = "Tell us something about yourself!";
      meta.revealCountdown = blindDateRevealRounds;
      meta.hostRevealed = false;
      break;
    case "truth_or_dare":
      state.currentTurnUserId = pickRandom(state.participants);
      state.currentQuestion = "Truth or Dare?";
      break;
    case "never_have_i_ever":
      meta.promptPool = shuffleArray(neverHaveIEverPrompts);
      state.currentQuestion = meta.promptPool.shift()!;
      meta.usedPrompts = [state.currentQuestion];
      break;
    case "would_you_rather":
      meta.pairPool = shuffleArray(wouldYouRatherQuestions);
      state.currentOptions = meta.pairPool.shift()!;
      state.currentQuestion = state.currentOptions[0];
      meta.usedPairs = [state.currentOptions];
      break;
  }
}

function nextRound(state: ModeState, now: Date) {
  if (state.status === "WAITING") validation("Mode has not started");
  state.round += 1;
  beginRound(state, now);
  const meta = state.metadata;
  switch (state.mode) {
    case "coffee_date": {
      const questions = meta.questions ?? shuffleArray(coffeeDateQuestions);
      const index = (meta.currentQuestionIndex ?? 0) + 1;
      if (index >= questions.length) state.status = "FINISHED";
      else {
        state.currentQuestion = questions[index];
        meta.questions = questions;
        meta.currentQuestionIndex = index;
      }
      break;
    }
    case "blind_date": {
      const countdown = Math.max(0, (meta.revealCountdown ?? blindDateRevealRounds) - 1);
      meta.revealCountdown = countdown;
      meta.hostRevealed = countdown === 0;
      state.currentQuestion = countdown === 0 ? "The masks are off! Say hi!"
        : `Tell more about yourself (${countdown} questions until reveal!)`;
      break;
    }
    case "truth_or_dare": {
      const players = meta.shuffledParticipants?.length ? meta.shuffledParticipants : state.participants;
      const current = players.indexOf(state.currentTurnUserId ?? "");
      state.currentTurnUserId = players[(current + 1) % players.length];
      state.currentQuestion = "Truth or Dare?";
      break;
    }
    case "never_have_i_ever": {
      const prompt = meta.promptPool?.shift();
      if (!prompt) state.status = "FINISHED";
      else {
        state.currentQuestion = prompt;
        (meta.usedPrompts ??= []).push(prompt);
      }
      break;
    }
    case "would_you_rather": {
      const pair = meta.pairPool?.shift();
      if (!pair) state.status = "FINISHED";
      else {
        state.currentQuestion = pair[0];
        state.currentOptions = pair;
        (meta.usedPairs ??= []).push(pair);
      }
      break;
    }
  }
}

export function applyModeAction(state: ModeState, input: ModeAction, userId: string, now: Date) {
  if (state.status === "FINISHED") validation("Mode already finished");
  const data = input.data ?? input;
  switch (input.action) {
    case "start":
      start(state, now);
      break;
    case "next_round":
      nextRound(state, now);
      break;
    case "submit_answer": {
      if (state.status !== "ACTIVE") validation("Mode is not active");
      const answer = typeof data.answer === "string" ? data.answer.trim() : "";
      if (!answer || answer.length > 500) validation("Answer must contain 1 to 500 characters");
      const answers = state.metadata.answers ??= {};
      answers[userId] = answer;
      if (state.participants.every(id => Object.hasOwn(answers, id))) state.status = "ROUND_END";
      break;
    }
    case "submit_dare": {
      if (state.mode !== "truth_or_dare" || state.status !== "ACTIVE") {
        validation("Dare can only be submitted during active Truth or Dare");
      }
      const dare = typeof data.dare === "string" ? data.dare.trim() : "";
      if (!dare || dare.length > 500) validation("Dare description must contain 1 to 500 characters");
      state.metadata.currentDare = dare;
      break;
    }
    case "vote": {
      if (state.status === "WAITING") validation("Mode has not started");
      const target = typeof data.targetUserId === "string" ? data.targetUserId.toLowerCase() : "";
      if (!isValidObjectId(target) || !state.participants.includes(target)) validation("Valid participant targetUserId is required for vote");
      const value = data.value ?? 1;
      if (typeof value !== "number" || !Number.isSafeInteger(value)) validation("Vote value must be a whole number");
      const score = (state.scores[target] ?? 0) + value;
      if (!Number.isSafeInteger(score)) validation("Vote would exceed the score limit");
      state.scores[target] = score;
      break;
    }
    case "end":
      state.status = "FINISHED";
      break;
  }
  state.updatedAt = now.toISOString();
}
