import { Router } from "express";
import { livekitTokenSchema } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { mediaProvider } from "../services/livekit.js";
import { asyncHandler, sendOk } from "../utils/http.js";

export const livekitRouter = Router();
livekitRouter.use(requireAuth);

livekitRouter.post("/token", validateBody(livekitTokenSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await Room.findById(req.body.roomId);
  if (!room || room.status !== "LIVE") throw { status: 404, message: "Live room not found" };

  const participant = await RoomParticipant.findOne({ roomId: room.id, userId: req.user!.id, leftAt: null });
  const role = participant?.role ?? "AUDIENCE";
  const canPublish = role === "HOST" || role === "SPEAKER" || role === "MODERATOR";
  const token = await mediaProvider.createToken({
    identity: req.user!.id,
    roomName: room.livekitRoomName,
    canPublish,
    canSubscribe: true
  });

  sendOk(res, {
    ...token,
    identity: req.user!.id,
    roomName: room.livekitRoomName,
    role
  });
}));
