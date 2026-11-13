import { Router } from "express";
import { livekitTokenSchema } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { mediaProvider } from "../services/livekit.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";

export const livekitRouter = Router();
livekitRouter.use(requireAuth);

livekitRouter.post("/token", validateBody(livekitTokenSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.body.roomId)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const room = await Room.findById(req.body.roomId);
  if (!room || room.status !== "LIVE") throw new HttpError(404, "Live room not found", ErrorCode.NOT_FOUND);

  const participant = await RoomParticipant.findOne({ roomId: room.id, userId: req.user!.id, leftAt: null });
  if (!participant) throw new HttpError(403, "Join the room before requesting a media token", ErrorCode.FORBIDDEN);
  const role = participant?.role ?? "AUDIENCE";
  const canPublish = participant.micEnabled && !participant.moderatorMuted && (role === "HOST" || role === "SPEAKER" || role === "MODERATOR");
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
