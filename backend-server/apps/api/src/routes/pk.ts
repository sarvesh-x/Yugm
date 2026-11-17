import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireNotMuted, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { PkBattle } from "../models/PkBattle.js";
import { PkVote } from "../models/PkVote.js";
import { PkParticipant } from "../models/PkParticipant.js";
import { PkEvent } from "../models/PkEvent.js";
import { PkInvite } from "../models/PkInvite.js";
import { PkLeaderboardEntry } from "../models/PkLeaderboardEntry.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import {
  acceptPkInvite,
  autoMatchPk,
  availableOpponents,
  cancelPk,
  createPkInvite,
  endPkBattle,
  getActivePk,
  pkState,
  rejectPkInvite,
  requestPkRematch,
  sendPkGift,
  sendPkReaction,
  createRoomPk,
  votePk,
  setPkReady,
  closePkBattle
} from "../services/pk.js";
import { mediaProvider } from "../services/livekit.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";

export const pkRouter = Router();
pkRouter.use(requireAuth);

const objectIdSchema = z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid object id");
const sideSchema = z.enum(["LEFT", "RIGHT"]);
const inviteSchema = z.object({
  roomId: objectIdSchema,
  opponentRoomId: objectIdSchema,
  opponentHostId: objectIdSchema,
  battleType: z.enum(["VOICE", "VIDEO"]),
  mode: z.enum(["GIFT", "VOTE", "REACTION", "MIXED"]).default("GIFT"),
  durationSeconds: z.number().int().refine((value) => [60, 180, 300, 600, 900].includes(value), "Invalid duration"),
  title: z.string().max(80).optional()
});
const autoMatchSchema = inviteSchema.omit({ opponentRoomId: true, opponentHostId: true });
const inviteActionSchema = z.object({ inviteId: objectIdSchema });
const battleActionSchema = z.object({ battleId: objectIdSchema });
const giftSchema = z.object({
  giftId: objectIdSchema,
  side: sideSchema,
  idempotencyKey: z.string().min(8).max(80),
  quantity: z.number().int().min(1).max(99).default(1)
});
const reactionSchema = z.object({
  side: sideSchema,
  type: z.string().min(1).max(24)
});
const roomPkSchema = z.object({
  roomId: objectIdSchema,
  leftPlayerId: objectIdSchema,
  rightPlayerId: objectIdSchema,
  leftPlayerIds: z.array(objectIdSchema).min(1).max(5).optional(),
  rightPlayerIds: z.array(objectIdSchema).min(1).max(5).optional(),
  format: z.enum(["PLAYER", "TEAM"]).optional(),
  mode: z.enum(["GIFT", "VOTE"]),
  durationSeconds: z.number().int().refine((value) => [60, 180, 300, 600, 1800].includes(value), "Invalid duration"),
  selectedGiftId: objectIdSchema.optional()
}).refine((value) => value.mode !== "GIFT" || Boolean(value.selectedGiftId), "Select a PK gift");
const voteSchema = z.object({ side: sideSchema });

pkRouter.post("/room-start", requireNotMuted, validateBody(roomPkSchema), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await createRoomPk({ userId: req.user!.id, ...req.body }), 201);
}));

pkRouter.post("/invite", requireNotMuted, validateBody(inviteSchema), asyncHandler(async (req: AuthRequest, res) => {
  const result = await createPkInvite({ userId: req.user!.id, ...req.body });
  sendOk(res, result, 201);
}));

pkRouter.post("/auto-match", requireNotMuted, validateBody(autoMatchSchema), asyncHandler(async (req: AuthRequest, res) => {
  const result = await autoMatchPk({ userId: req.user!.id, ...req.body });
  sendOk(res, result, 201);
}));

pkRouter.post("/accept", validateBody(inviteActionSchema), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await acceptPkInvite(req.user!.id, req.body.inviteId));
}));

pkRouter.post("/reject", validateBody(inviteActionSchema), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await rejectPkInvite(req.user!.id, req.body.inviteId));
}));

pkRouter.post("/cancel", validateBody(battleActionSchema), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await cancelPk(req.user!.id, req.body.battleId));
}));

pkRouter.post("/start", validateBody(inviteActionSchema), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await acceptPkInvite(req.user!.id, req.body.inviteId));
}));

pkRouter.post("/end", validateBody(battleActionSchema.extend({ reason: z.string().max(240).optional() })), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await endPkBattle({ userId: req.user!.id, battleId: req.body.battleId, reason: req.body.reason }));
}));

pkRouter.post("/:battleId/ready", validateBody(z.object({})), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
  sendOk(res, await setPkReady(req.user!.id, req.params.battleId));
}));

pkRouter.post("/:battleId/close", validateBody(z.object({})), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
  sendOk(res, await closePkBattle({ battleId: req.params.battleId, userId: req.user!.id }));
}));

pkRouter.post("/rematch", validateBody(battleActionSchema), asyncHandler(async (req: AuthRequest, res) => {
  const result = await requestPkRematch(req.user!.id, req.body.battleId);
  sendOk(res, result, 201);
}));

pkRouter.get("/active/:roomId", asyncHandler(async (req: AuthRequest, res) => {
  const battle = await getActivePk(req.params.roomId);
  const myVote = battle?.mode === "VOTE" ? await PkVote.findOne({ battleId: battle.id, voterId: req.user!.id }).select("side").lean() : null;
  const myReady = battle ? await PkParticipant.exists({ battleId: battle.id, userId: req.user!.id, isReady: true, leftAt: null }) : null;
  const invite = battle
    ? await PkInvite.findOne({
      battleId: battle.id,
      status: "PENDING",
      $or: [{ inviteeUserId: req.user!.id }, { inviterUserId: req.user!.id }]
    }).lean()
    : null;
  sendOk(res, { battle: battle ? { ...battle, myVote: myVote?.side ?? null, myReady: Boolean(myReady) } : null, invite });
}));

pkRouter.post("/:battleId/vote", requireNotMuted, validateBody(voteSchema), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await votePk({ userId: req.user!.id, battleId: req.params.battleId, ...req.body }), 201);
}));

pkRouter.get("/available-opponents", asyncHandler(async (req: AuthRequest, res) => {
  const opponents = await availableOpponents({
    userId: req.user!.id,
    battleType: typeof req.query.battleType === "string" ? req.query.battleType : undefined,
    search: typeof req.query.search === "string" ? req.query.search : undefined,
    limit: Number(req.query.limit) || 20
  });
  sendOk(res, { opponents });
}));

pkRouter.get("/history/user/:userId", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid userId", ErrorCode.VALIDATION);
  const participantBattles = await PkParticipant.find({ userId: req.params.userId }).distinct("battleId");
  const battles = await PkBattle.find({
    status: { $in: ["ENDED", "FORCE_ENDED", "COMPLETED", "CLOSED", "ABORTED", "CANCELLED"] },
    $or: [{ leftHostId: req.params.userId }, { rightHostId: req.params.userId }, { _id: { $in: participantBattles } }]
  }).sort({ endedAt: -1 }).limit(50).lean();
  sendOk(res, { battles: await Promise.all(battles.map((battle) => pkState(battle))) });
}));

pkRouter.get("/history/room/:roomId", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
  const battles = await PkBattle.find({
    status: { $in: ["ENDED", "FORCE_ENDED", "COMPLETED", "CLOSED", "ABORTED", "CANCELLED"] },
    $or: [{ leftRoomId: req.params.roomId }, { rightRoomId: req.params.roomId }]
  }).sort({ createdAt: -1 }).limit(50).lean();
  sendOk(res, { battles: await Promise.all(battles.map((battle) => pkState(battle))) });
}));

pkRouter.post("/:battleId/send-gift", requireNotMuted, validateBody(giftSchema), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await sendPkGift({ userId: req.user!.id, battleId: req.params.battleId, ...req.body }), 201);
}));

pkRouter.post("/:battleId/reactions", requireNotMuted, validateBody(reactionSchema), asyncHandler(async (req: AuthRequest, res) => {
  sendOk(res, await sendPkReaction({ userId: req.user!.id, battleId: req.params.battleId, ...req.body }), 201);
}));

pkRouter.get("/:battleId/events", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
  const events = await PkEvent.find({ battleId: req.params.battleId }).sort({ createdAt: 1 }).limit(200).lean();
  sendOk(res, { events });
}));

pkRouter.get("/:battleId/leaderboard", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
  const entries = await PkLeaderboardEntry.find({ battleId: req.params.battleId })
    .populate("userId", "name username avatar activeCosmetics")
    .sort({ totalPoints: -1 })
    .limit(50)
    .lean();
  sendOk(res, { entries });
}));

pkRouter.get("/:battleId/media-sessions", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
  const roomId = typeof req.query.roomId === "string" ? req.query.roomId : "";
  if (!isValidObjectId(roomId)) throw new HttpError(400, "Invalid roomId", ErrorCode.VALIDATION);
  const battle = await PkBattle.findById(req.params.battleId).lean();
  if (!battle || battle.status !== "ACTIVE" || battle.battleType !== "VIDEO") throw new HttpError(404, "Active video PK not found", ErrorCode.NOT_FOUND);
  const leftRoomId = battle.leftRoomId.toString();
  const rightRoomId = battle.rightRoomId.toString();
  if (roomId !== leftRoomId && roomId !== rightRoomId) throw new HttpError(403, "Room is not in this PK", ErrorCode.FORBIDDEN);
  const isHost = [battle.leftHostId.toString(), battle.rightHostId.toString()].includes(req.user!.id);
  const participant = await RoomParticipant.exists({ roomId, userId: req.user!.id, leftAt: null });
  if (!isHost && !participant) throw new HttpError(403, "Join your PK room before subscribing to opponent media", ErrorCode.FORBIDDEN);
  const opponentRoomId = roomId === leftRoomId ? rightRoomId : leftRoomId;
  const opponentRoom = await Room.findById(opponentRoomId).select("title livekitRoomName").lean();
  if (!opponentRoom) throw new HttpError(404, "Opponent room not found", ErrorCode.NOT_FOUND);
  const opponent = await mediaProvider.createToken({
    identity: `${req.user!.id}:pk:${req.params.battleId}:opponent`,
    roomName: opponentRoom.livekitRoomName,
    canPublish: false,
    canSubscribe: true
  });
  sendOk(res, {
    opponent: {
      ...opponent,
      roomId: opponentRoomId,
      roomName: opponentRoom.livekitRoomName,
      title: opponentRoom.title,
      role: "PK_OPPONENT_VIEWER"
    }
  });
}));

pkRouter.get("/:battleId", asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.battleId)) throw new HttpError(400, "Invalid battleId", ErrorCode.VALIDATION);
  const invite = await PkInvite.findOne({ battleId: req.params.battleId }).sort({ createdAt: -1 }).lean();
  sendOk(res, { battle: await pkState(req.params.battleId), invite });
}));
