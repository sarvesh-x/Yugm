import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Room } from "../models/Room.js";
import { RoomRecording } from "../models/RoomRecording.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { emitRoom } from "../services/socket.js";
import { socketEvents } from "@yugm/shared";

export const recordingsRouter = Router();
recordingsRouter.use(requireAuth);

const startSchema = z.object({
  roomId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  title: z.string().min(1).max(100).optional(),
});

const stopSchema = z.object({
  recordingUrl: z.string().url(),
  duration: z.number().int().min(1),
});

const updateSchema = z.object({
  title: z.string().min(1).max(100).optional(),
});

async function assertRoomHost(req: AuthRequest, roomId: string) {
  const room = await Room.findById(roomId).lean();
  if (!room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
  if (room.hostId.toString() !== req.user!.id) {
    throw new HttpError(403, "Only the room host can manage recordings", ErrorCode.FORBIDDEN);
  }
  return room;
}

async function getRecordingOrThrow(id: string) {
  if (!isValidObjectId(id)) throw new HttpError(400, "Invalid recording ID", ErrorCode.VALIDATION);
  const recording = await RoomRecording.findById(id).lean();
  if (!recording) throw new HttpError(404, "Recording not found", ErrorCode.NOT_FOUND);
  return recording;
}

recordingsRouter.post("/", validateBody(startSchema), asyncHandler(async (req: AuthRequest, res) => {
  const room = await assertRoomHost(req, req.body.roomId);
  if (room.status !== "LIVE") throw new HttpError(400, "Room must be live to record", ErrorCode.VALIDATION);

  const active = await RoomRecording.findOne({ roomId: room._id, status: "PROCESSING" }).lean();
  if (active) throw new HttpError(409, "A recording is already in progress for this room", ErrorCode.CONFLICT);

  const recording = await RoomRecording.create({
    roomId: room._id,
    hostId: req.user!.id,
    title: req.body.title ?? `Recording - ${room.title}`,
    status: "PROCESSING",
  });

  emitRoom(room._id.toString(), "recording:started", { recordingId: recording._id.toString() });
  sendOk(res, { recording }, 201);
}));

recordingsRouter.patch("/:id/stop", validateBody(stopSchema), asyncHandler(async (req: AuthRequest, res) => {
  const recording = await getRecordingOrThrow(req.params.id);
  if (recording.hostId.toString() !== req.user!.id) {
    throw new HttpError(403, "Only the host can stop this recording", ErrorCode.FORBIDDEN);
  }
  if (recording.status !== "PROCESSING") {
    throw new HttpError(409, "Recording is not in progress", ErrorCode.CONFLICT);
  }

  recording.recordingUrl = req.body.recordingUrl;
  recording.duration = req.body.duration;
  recording.status = "PUBLISHED";
  await recording.save();

  emitRoom(recording.roomId.toString(), "recording:stopped", {
    recordingId: recording._id.toString(),
    recordingUrl: recording.recordingUrl,
    duration: recording.duration,
  });

  sendOk(res, { recording });
}));

recordingsRouter.get("/room/:roomId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.roomId)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 50);
  const skip = (page - 1) * limit;

  const filter = { roomId: req.params.roomId, status: "PUBLISHED" };
  const [recordings, total] = await Promise.all([
    RoomRecording.find(filter)
      .populate("hostId", "name username avatar")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    RoomRecording.countDocuments(filter),
  ]);

  sendOk(res, { recordings, total, page, totalPages: Math.ceil(total / limit) });
}));

recordingsRouter.get("/:id", asyncHandler(async (req: AuthRequest, res) => {
  const recording = await RoomRecording.findById(req.params.id)
    .populate("hostId", "name username avatar")
    .populate("roomId", "title type")
    .lean();
  if (!recording) throw new HttpError(404, "Recording not found", ErrorCode.NOT_FOUND);

  const participated = await RoomParticipant.exists({
    roomId: recording.roomId,
    userId: req.user!.id,
    leftAt: null,
  });
  if (!participated && recording.hostId._id.toString() !== req.user!.id) {
    throw new HttpError(403, "You were not a participant in this room", ErrorCode.FORBIDDEN);
  }

  sendOk(res, { recording });
}));

recordingsRouter.patch("/:id", validateBody(updateSchema), asyncHandler(async (req: AuthRequest, res) => {
  const recording = await getRecordingOrThrow(req.params.id);
  if (recording.hostId.toString() !== req.user!.id) {
    throw new HttpError(403, "Only the host can edit this recording", ErrorCode.FORBIDDEN);
  }

  if (req.body.title !== undefined) recording.title = req.body.title;
  await recording.save();

  sendOk(res, { recording });
}));

recordingsRouter.delete("/:id", asyncHandler(async (req: AuthRequest, res) => {
  const recording = await getRecordingOrThrow(req.params.id);
  if (recording.hostId.toString() !== req.user!.id) {
    throw new HttpError(403, "Only the host can delete this recording", ErrorCode.FORBIDDEN);
  }

  await RoomRecording.findByIdAndDelete(req.params.id);
  sendOk(res, { deleted: true });
}));

recordingsRouter.post("/:id/view", asyncHandler(async (req: AuthRequest, res) => {
  const recording = await getRecordingOrThrow(req.params.id);
  await RoomRecording.findByIdAndUpdate(req.params.id, { $inc: { viewCount: 1 } });
  sendOk(res, { viewCount: recording.viewCount + 1 });
}));
