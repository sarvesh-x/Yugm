import mongoose, { Schema } from "mongoose";
import type { RoomParticipantRole } from "@yugm/shared";

export interface IRoomParticipant extends mongoose.Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: RoomParticipantRole;
  micEnabled: boolean;
  cameraEnabled: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

const roomParticipantSchema = new Schema<IRoomParticipant>({
  roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["HOST", "SPEAKER", "AUDIENCE", "MODERATOR"], default: "AUDIENCE" },
  micEnabled: { type: Boolean, default: true },
  cameraEnabled: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date
});

roomParticipantSchema.index({ roomId: 1, userId: 1, leftAt: 1 });

export const RoomParticipant = mongoose.model<IRoomParticipant>("RoomParticipant", roomParticipantSchema);
