import { Router } from "express";
import { socketEvents } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { WatchParty } from "../models/WatchParty.js";
import { Room } from "../models/Room.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { emitRoom } from "../services/socket.js";

export const watchPartyRouter = Router();

const startSchema = z.object({
  title: z.string().min(1).max(120),
  mediaUrl: z.string().url(),
});

const syncSchema = z.object({
  position: z.number().min(0),
  isPlaying: z.boolean(),
});

watchPartyRouter.post("/rooms/:roomId/watch-party", requireAuth, validateBody(startSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await Room.findById(req.params.roomId);
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  if (room.hostId.toString() !== req.user!._id.toString()) throw new HttpError(403, "Only host can start a watch party", ErrorCode.FORBIDDEN);

  const existing = await WatchParty.findOneAndDelete({ roomId: req.params.roomId });
  const wp = await WatchParty.create({
    roomId: req.params.roomId,
    hostId: req.user!._id,
    title: req.body.title,
    mediaUrl: req.body.mediaUrl,
    position: 0,
    isPlaying: true,
  });

  emitRoom(req.params.roomId, socketEvents.watchPartyStarted, { watchParty: wp });
  sendOk(res, { watchParty: wp });
}));

watchPartyRouter.get("/rooms/:roomId/watch-party", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const wp = await WatchParty.findOne({ roomId: req.params.roomId });
  if (!wp) throw new HttpError(404, "No active watch party", ErrorCode.NOT_FOUND);
  sendOk(res, { watchParty: wp });
}));

watchPartyRouter.patch("/rooms/:roomId/watch-party/sync", requireAuth, validateBody(syncSchema), asyncHandler(async (req: AuthRequest, res) => {
  const wp = await WatchParty.findOne({ roomId: req.params.roomId });
  if (!wp) throw new HttpError(404, "No active watch party", ErrorCode.NOT_FOUND);
  if (wp.hostId.toString() !== req.user!._id.toString()) throw new HttpError(403, "Only host can sync", ErrorCode.FORBIDDEN);

  wp.position = req.body.position;
  wp.isPlaying = req.body.isPlaying;
  await wp.save();

  emitRoom(req.params.roomId, socketEvents.watchPartySync, { position: wp.position, isPlaying: wp.isPlaying });
  sendOk(res, { watchParty: wp });
}));

watchPartyRouter.delete("/rooms/:roomId/watch-party", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const wp = await WatchParty.findOneAndDelete({ roomId: req.params.roomId, hostId: req.user!._id });
  if (!wp) throw new HttpError(404, "No active watch party", ErrorCode.NOT_FOUND);
  emitRoom(req.params.roomId, socketEvents.watchPartyStopped, {});
  sendOk(res, { deleted: true });
}));
