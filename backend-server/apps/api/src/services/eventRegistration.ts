import mongoose from "mongoose";
import { Event } from "../models/Event.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export async function joinEvent(eventId: string, userId: string) {
  if (!mongoose.isValidObjectId(eventId)) throw new HttpError(400, "Invalid event ID", ErrorCode.VALIDATION);
  const participant = new mongoose.Types.ObjectId(userId);
  // A single conditional document write serializes joins with capacity changes
  // and cancellation. Existing members never consume another seat on retry.
  const event = await Event.findOneAndUpdate({
    _id: eventId, status: "UPCOMING", participantIds: { $ne: participant },
    $expr: { $or: [
      { $eq: [{ $ifNull: ["$maxParticipants", null] }, null] },
      { $lt: [{ $size: { $ifNull: ["$participantIds", []] } }, "$maxParticipants"] }
    ] }
  }, { $addToSet: { participantIds: participant } }, { new: true });
  if (event) return { event, alreadyJoined: false };
  const current = await Event.findById(eventId);
  if (!current) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
  if (current.status !== "UPCOMING") throw new HttpError(409, "Event is not open for joining", ErrorCode.CONFLICT);
  if (current.participantIds.some(id => id.toString() === userId)) return { event: current, alreadyJoined: true };
  throw new HttpError(409, "Event is full. Try again if a place becomes available.", ErrorCode.CONFLICT);
}

export async function leaveEvent(eventId: string, userId: string) {
  if (!mongoose.isValidObjectId(eventId)) throw new HttpError(400, "Invalid event ID", ErrorCode.VALIDATION);
  const event = await Event.findByIdAndUpdate(eventId, { $pull: { participantIds: new mongoose.Types.ObjectId(userId) } }, { new: true });
  if (!event) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
  return event;
}
