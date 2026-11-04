import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { roomModes, roomModesInfo } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Room } from "../models/Room.js";
import { RoomModeState } from "../models/RoomModeState.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { emitRoom } from "../services/socket.js";

export const roomModesRouter = Router();

const setModeSchema = z.object({
  mode: z.enum(roomModes),
});

const modeActionSchema = z.object({
  action: z.enum(["start", "next_round", "submit_answer", "submit_dare", "vote", "end"]),
  data: z.record(z.unknown()).optional(),
});

async function getRoomOrThrow(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const room = await Room.findById(id).lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  return room;
}

async function assertHost(req: AuthRequest, roomId: string) {
  const room = await getRoomOrThrow(roomId);
  if (room.hostId.toString() !== req.user!.id && req.user!.role !== "ADMIN") {
    throw new HttpError(403, "Host control required", ErrorCode.FORBIDDEN);
  }
  return room;
}

const coffeeDateQuestions = [
  "What's your favorite way to spend a Sunday morning?",
  "If you could travel anywhere right now, where would you go?",
  "What's a food you could eat every day?",
  "What's the best piece of advice you've ever received?",
  "What's your go-to karaoke song?",
  "What's a hobby you've always wanted to try?",
  "What's your favorite season and why?",
  "If you wrote a book, what would it be about?",
  "What's the most spontaneous thing you've ever done?",
  "What does your ideal Friday night look like?",
];

const blindDateRevealRounds = 3;

const truthQuestions = [
  "What's the most embarrassing thing in your search history?",
  "Have you ever lied to get out of a plan?",
  "What's a secret you've never told anyone?",
  "Have you ever had a crush on a friend?",
  "What's the worst date you've ever been on?",
  "What's your biggest pet peeve?",
  "Have you ever sent a text to the wrong person?",
  "What's the silliest thing you're afraid of?",
  "Have you ever stalked someone's social media?",
  "What's the most trouble you've ever been in?",
];

const dareActions = [
  "Say something flirty to the person to your left",
  "Do your best celebrity impression",
  "Sing the chorus of your favorite song",
  "Make up a 30-second rap about the room",
  "Speak in an accent for the next 2 rounds",
  " Compliment everyone in the room one by one",
  "Act out your favorite movie scene",
  "Share the last photo in your camera roll",
  "Do 10 pushups right now",
  "Say tongue twister: 'I saw Susie sitting in a shoeshine shop' 3x fast",
];

const neverHaveIEverPrompts = [
  "Faked a laugh at a joke I didn't get",
  "Googled myself",
  "Fallen asleep in a movie theater",
  "Eaten food off the floor",
  "Forgot someone's name right after meeting them",
  "Pretended to like a song to impress someone",
  "Cried during a commercial",
  "Taken a picture with a celebrity",
  "Stalked an ex's new partner online",
  "Gone a whole day without brushing my teeth",
  "Been on a blind date before",
  "Sent a risky text I regretted",
  "Worn mismatched socks on purpose",
  "Joined a voice room just to listen without talking",
];

const wouldYouRatherQuestions = [
  ["Have the ability to fly", "Be invisible"],
  ["Always be slightly early", "Always be 5 minutes late"],
  ["Live without music", "Live without movies"],
  ["Have a rewind button for life", "Have a pause button"],
  ["Be famous for something embarrassing", "Be completely unknown"],
  ["Never eat pizza again", "Only eat pizza forever"],
  ["Travel to the past", "Travel to the future"],
  ["Have unlimited money", "Have unlimited time"],
  ["Speak all languages", "Play all instruments"],
  ["Be able to read minds", "Be able to teleport"],
  ["Live in the mountains", "Live on the beach"],
  ["Host a room every day", "Join a room every day"],
  ["Be the funniest person in the room", "Be the smartest person in the room"],
  ["Always lose at games", "Always win at games no one cares about"],
];

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// GET /v1/rooms/modes
roomModesRouter.get(
  "/modes",
  asyncHandler(async (_req, res) => {
    sendOk(res, { modes: roomModesInfo });
  })
);

// POST /v1/rooms/:id/mode
roomModesRouter.post(
  "/:id/mode",
  requireAuth,
  validateBody(setModeSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const room = await assertHost(req, req.params.id);
    const { mode } = req.body as z.infer<typeof setModeSchema>;

    const existingState = await RoomModeState.findOne({ roomId: room._id });
    if (existingState) {
      throw new HttpError(409, "Room already has an active mode", ErrorCode.CONFLICT);
    }

    const participants = await RoomParticipant.find({ roomId: room._id, leftAt: null }).lean();
    const participantIds = [room.hostId, ...participants.map((p) => p.userId)];

    const modeInfo = roomModesInfo.find((m) => m.key === mode) || roomModesInfo[0];
    if (participantIds.length < modeInfo.minParticipants) {
      throw new HttpError(400, `Need at least ${modeInfo.minParticipants} participants for ${modeInfo.name}`, ErrorCode.VALIDATION);
    }

    const state = await RoomModeState.create({
      roomId: room._id,
      mode,
      status: "WAITING",
      participants: participantIds,
      round: 1,
      scores: Object.fromEntries(participantIds.map((id) => [id.toString(), 0])),
      metadata: { shuffledParticipants: shuffleArray(participantIds.map((id) => id.toString())) },
    });

    const updatedRoom = await Room.findByIdAndUpdate(room._id, { mode }, { new: true }).lean();

    emitRoom(req.params.id, "room:mode:set", { mode, state });

    sendOk(res, { room: updatedRoom, modeState: state });
  })
);

// GET /v1/rooms/:id/mode-state
roomModesRouter.get(
  "/:id/mode-state",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const room = await getRoomOrThrow(req.params.id);
    const state = await RoomModeState.findOne({ roomId: room._id }).lean();
    if (!state) {
      sendOk(res, { mode: null, modeState: null });
      return;
    }
    sendOk(res, { mode: room.mode, modeState: state });
  })
);

// POST /v1/rooms/:id/mode/action
roomModesRouter.post(
  "/:id/mode/action",
  requireAuth,
  validateBody(modeActionSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    const room = await getRoomOrThrow(req.params.id);
    const state = await RoomModeState.findOne({ roomId: room._id });
    if (!state) {
      throw new HttpError(404, "No active mode for this room", ErrorCode.NOT_FOUND);
    }

    const { action, data } = req.body as z.infer<typeof modeActionSchema>;
    const userId = req.user!.id;
    const userIdStr = req.user!.id;

    switch (action) {
      case "start": {
        if (state.status !== "WAITING") {
          throw new HttpError(400, "Mode already started", ErrorCode.VALIDATION);
        }
        state.status = "ACTIVE";
        state.roundStartTime = new Date();
        state.roundEndTime = new Date(Date.now() + 60000);

        if (state.mode === "coffee_date") {
          state.currentQuestion = pickRandom(coffeeDateQuestions);
          state.metadata.currentQuestionIndex = 0;
          state.metadata.questions = shuffleArray(coffeeDateQuestions);
        } else if (state.mode === "blind_date") {
          state.currentQuestion = "Tell us something about yourself!";
          state.metadata.revealCountdown = blindDateRevealRounds;
          state.metadata.hostRevealed = false;
        } else if (state.mode === "truth_or_dare") {
          state.currentTurnUserId = new mongoose.Types.ObjectId(pickRandom(state.participants.map((p) => p.toString())) as string);
          state.currentQuestion = "Truth or Dare?";
        } else if (state.mode === "never_have_i_ever") {
          state.currentQuestion = pickRandom(neverHaveIEverPrompts);
          state.metadata.usedPrompts = [state.currentQuestion];
          state.metadata.promptPool = shuffleArray(neverHaveIEverPrompts.filter((p) => p !== state.currentQuestion));
        } else if (state.mode === "would_you_rather") {
          const pair = pickRandom(wouldYouRatherQuestions);
          state.currentQuestion = pair[0];
          state.currentOptions = pair;
          state.metadata.usedPairs = [pair];
          state.metadata.pairPool = shuffleArray(wouldYouRatherQuestions.filter((p) => p[0] !== pair[0]));
        }

        await state.save();
        emitRoom(req.params.id, "room:mode:state", { state });
        break;
      }

      case "next_round": {
        if (state.status === "FINISHED") {
          throw new HttpError(400, "Mode already finished", ErrorCode.VALIDATION);
        }
        state.round += 1;
        state.roundStartTime = new Date();
        state.roundEndTime = new Date(Date.now() + 60000);
        state.status = "ACTIVE";

        if (state.mode === "coffee_date") {
          const qs = (state.metadata.questions as string[]) || shuffleArray(coffeeDateQuestions);
          const idx = ((state.metadata.currentQuestionIndex as number) ?? 0) + 1;
          if (idx >= qs.length) {
            state.status = "FINISHED";
          } else {
            state.currentQuestion = qs[idx];
            state.metadata.currentQuestionIndex = idx;
          }
        } else if (state.mode === "blind_date") {
          const countdown = (state.metadata.revealCountdown as number) - 1;
          state.metadata.revealCountdown = countdown;
          if (countdown <= 0) {
            state.metadata.hostRevealed = true;
            state.currentQuestion = "The masks are off! Say hi!";
          } else {
            state.currentQuestion = `Tell more about yourself (${countdown} questions until reveal!)`;
          }
        } else if (state.mode === "truth_or_dare") {
          const shuffled = state.metadata.shuffledParticipants as string[] || [];
          const currentIdx = shuffled.indexOf(state.currentTurnUserId?.toString() || "");
          const nextIdx = (currentIdx + 1) % shuffled.length;
          state.currentTurnUserId = new mongoose.Types.ObjectId(shuffled[nextIdx]);
          state.currentQuestion = "Truth or Dare?";
        } else if (state.mode === "never_have_i_ever") {
          const pool = state.metadata.promptPool as string[] || [];
          if (pool.length === 0) {
            state.status = "FINISHED";
          } else {
            const prompt = pool.shift()!;
            state.currentQuestion = prompt;
            (state.metadata.usedPrompts as string[]).push(prompt);
            state.metadata.promptPool = pool;
          }
        } else if (state.mode === "would_you_rather") {
          const pool = state.metadata.pairPool as [string, string][] || [];
          if (pool.length === 0) {
            state.status = "FINISHED";
          } else {
            const pair = pool.shift()!;
            state.currentQuestion = pair[0];
            state.currentOptions = pair;
            (state.metadata.usedPairs as [string, string][]).push(pair);
            state.metadata.pairPool = pool;
          }
        }

        await state.save();
        emitRoom(req.params.id, "room:mode:state", { state });
        break;
      }

      case "submit_answer": {
        if (state.status !== "ACTIVE") {
          throw new HttpError(400, "Mode is not active", ErrorCode.VALIDATION);
        }
        const answer = data?.answer as string | undefined;
        if (!answer || answer.trim().length === 0) {
          throw new HttpError(400, "Answer is required", ErrorCode.VALIDATION);
        }
        const answers = (state.metadata.answers as Record<string, string>) || {};
        answers[userIdStr] = answer.trim();
        state.metadata.answers = answers;

        const participantCount = state.participants.length;
        const answeredCount = Object.keys(answers).length;
        if (answeredCount >= participantCount) {
          state.status = "ROUND_END";
        }

        await state.save();
        emitRoom(req.params.id, "room:mode:answer", { userId: userIdStr, round: state.round });
        break;
      }

      case "submit_dare": {
        if (state.mode !== "truth_or_dare" || state.status !== "ACTIVE") {
          throw new HttpError(400, "Dare can only be submitted during active Truth or Dare", ErrorCode.VALIDATION);
        }
        const dare = data?.dare as string | undefined;
        if (!dare || dare.trim().length === 0) {
          throw new HttpError(400, "Dare description is required", ErrorCode.VALIDATION);
        }
        state.metadata.currentDare = dare.trim();
        await state.save();
        emitRoom(req.params.id, "room:mode:dare", { dare: dare.trim(), targetUserId: state.currentTurnUserId });
        break;
      }

      case "vote": {
        const targetUserId = data?.targetUserId as string | undefined;
        if (!targetUserId || !isValidObjectId(targetUserId)) {
          throw new HttpError(400, "Valid targetUserId is required for vote", ErrorCode.VALIDATION);
        }
        const currentScore = state.scores.get(targetUserId) || 0;
        const voteValue = (data?.value as number) ?? 1;
        state.scores.set(targetUserId, currentScore + voteValue);
        await state.save();
        emitRoom(req.params.id, "room:mode:scores", { scores: Object.fromEntries(state.scores) });
        break;
      }

      case "end": {
        state.status = "FINISHED";
        await state.save();
        await Room.findByIdAndUpdate(room._id, { mode: undefined });
        emitRoom(req.params.id, "room:mode:ended", { state });
        break;
      }
    }

    sendOk(res, { modeState: state });
  })
);

// POST /v1/rooms/mode/random
roomModesRouter.post(
  "/mode/random",
  requireAuth,
  asyncHandler(async (req: AuthRequest, res) => {
    const mode = pickRandom([...roomModes]);
    const modeRooms = await Room.find({ mode, status: "LIVE", visibility: "PUBLIC" })
      .sort({ participantCount: -1 })
      .limit(20)
      .lean();
    if (modeRooms.length === 0) {
      const anyMode = pickRandom([...roomModesInfo]);
      const availableRooms = await Room.find({ status: "LIVE", visibility: "PUBLIC" })
        .sort({ participantCount: -1 })
        .limit(20)
        .lean();
      const targetMode = anyMode.key;
      sendOk(res, { mode: targetMode, room: availableRooms[0] || null, rooms: availableRooms });
      return;
    }
    sendOk(res, { mode, room: modeRooms[0], rooms: modeRooms });
  })
);
