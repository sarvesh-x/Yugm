import { Room } from "../models/Room.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SpeakerRequest } from "../models/SpeakerRequest.js";
import { invalidateCache } from "./redis.js";
import { isAlwaysOnOfficialVoiceRoom } from "./officialRooms.js";
import { terminateLiveKitRoom } from "./livekit.js";

export type RoomExitResult = { changed: boolean; ended: boolean };

export async function endRoom(roomId: string, reason: string): Promise<boolean> {
  const room = await Room.findById(roomId).select("status type livekitRoomName activePkId").lean();
  if (!room || room.status !== "LIVE" || isAlwaysOnOfficialVoiceRoom(room)) return false;

  const now = new Date();
  const result = await Room.updateOne(
    { _id: roomId, status: "LIVE" },
    { $set: { status: "ENDED", endedAt: now, participantCount: 0 } }
  );
  if (result.modifiedCount === 0) return false;

  if (room.activePkId) {
    const { endPkBattle } = await import("./pk.js");
    await endPkBattle({ battleId: room.activePkId.toString(), force: true, reason: `Room ended: ${reason}` }).catch((error) => {
      console.warn(`Could not broadcast PK end for room ${roomId}:`, error instanceof Error ? error.message : String(error));
    });
  }

  // Marking LIVE -> ENDED is the synchronous close operation. Fan-out cleanup and
  // LiveKit teardown continue in the background so hosts and listeners are
  // released immediately instead of waiting on media-server timeouts.
  void Promise.all([
    // Room chat is session-only data. Remove it as soon as the room is closed.
    ChatMessage.deleteMany({ roomId }),
    RoomParticipant.updateMany(
      { roomId, leftAt: null },
      { $set: { leftAt: now, micEnabled: false, cameraEnabled: false }, $unset: { seatIndex: 1 } }
    ),
    SpeakerRequest.updateMany({ roomId, status: "PENDING" }, { $set: { status: "REJECTED" } }),
    invalidateCache("rooms:*"),
    terminateLiveKitRoom(room.livekitRoomName)
  ]).catch((error) => {
    console.warn(`Room cleanup failed for ${roomId}:`, error instanceof Error ? error.message : String(error));
  });
  console.info(`Ended room ${roomId}: ${reason}`);
  return true;
}

export async function recordRoomParticipantExit(roomId: string, userId: string, reason: string): Promise<RoomExitResult> {
  const room = await Room.findById(roomId).select("hostId status type livekitRoomName").lean();
  if (!room || room.status !== "LIVE") return { changed: false, ended: false };
  if (isAlwaysOnOfficialVoiceRoom(room) && room.hostId.toString() === userId) {
    return { changed: false, ended: false };
  }

  const now = new Date();
  const exited = await RoomParticipant.updateOne(
    { roomId, userId, leftAt: null },
    { $set: { leftAt: now, micEnabled: false, cameraEnabled: false }, $unset: { seatIndex: 1 } }
  );
  if (exited.modifiedCount === 0) return { changed: false, ended: false };

  await SpeakerRequest.updateMany({ roomId, userId, status: "PENDING" }, { $set: { status: "REJECTED" } });
  await Room.updateOne({ _id: roomId, participantCount: { $gt: 0 } }, { $inc: { participantCount: -1 } });
  await invalidateCache("rooms:*");

  const hostLeft = room.hostId.toString() === userId;
  const hasParticipants = await RoomParticipant.exists({ roomId, leftAt: null });
  const ended = (hostLeft || !hasParticipants) ? await endRoom(roomId, hostLeft ? "host left" : "last participant left") : false;
  console.info(`Participant ${userId} exited room ${roomId}: ${reason}`);
  return { changed: true, ended };
}
