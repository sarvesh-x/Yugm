import mongoose, { Schema } from "mongoose";
import type { RoomParticipantRole } from "@yugm/shared";

export interface IRoomParticipant extends mongoose.Document {
  roomId: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  role: RoomParticipantRole;
  micEnabled: boolean;
  moderatorMuted: boolean;
  seatIndex?: number;
  cameraEnabled: boolean;
  joinedAt: Date;
  leftAt?: Date;
}

const roomParticipantSchema = new Schema<IRoomParticipant>({
  roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
  userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  role: { type: String, enum: ["HOST", "SPEAKER", "AUDIENCE", "MODERATOR"], default: "AUDIENCE" },
  micEnabled: { type: Boolean, default: true },
  moderatorMuted: { type: Boolean, default: false },
  seatIndex: { type: Number, min: 0 },
  cameraEnabled: { type: Boolean, default: true },
  joinedAt: { type: Date, default: Date.now },
  leftAt: Date
});

roomParticipantSchema.index({ roomId: 1, userId: 1, leftAt: 1 });
roomParticipantSchema.index(
  { roomId: 1, seatIndex: 1 },
  { unique: true, partialFilterExpression: { seatIndex: { $type: "number" }, leftAt: null } }
);

export const RoomParticipant = mongoose.model<IRoomParticipant>("RoomParticipant", roomParticipantSchema);
