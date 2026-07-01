import mongoose, { Schema } from "mongoose";
import type { RoomStatus, RoomType, RoomVisibility } from "@yugm/shared";

export interface IRoom extends mongoose.Document {
  title: string;
  description?: string;
  type: RoomType;
  hostId: mongoose.Types.ObjectId;
  coverImage?: string;
  category: string;
  tags: string[];
  language: string;
  status: RoomStatus;
  visibility: RoomVisibility;
  maxSpeakers: number;
  participantCount: number;
  speakerIds: mongoose.Types.ObjectId[];
  moderatorIds: mongoose.Types.ObjectId[];
  livekitRoomName: string;
  allowAudienceMicRequests: boolean;
  scheduledFor?: Date;
  startedAt?: Date;
  endedAt?: Date;
}

const roomSchema = new Schema<IRoom>(
  {
    title: { type: String, required: true, trim: true },
    description: String,
    type: { type: String, enum: ["VOICE", "VIDEO"], required: true },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    coverImage: String,
    category: { type: String, required: true },
    tags: [{ type: String }],
    language: { type: String, required: true },
    status: { type: String, enum: ["LIVE", "ENDED", "SCHEDULED"], default: "LIVE", index: true },
    visibility: { type: String, enum: ["PUBLIC", "PRIVATE"], default: "PUBLIC" },
    maxSpeakers: { type: Number, default: 6 },
    participantCount: { type: Number, default: 0 },
    speakerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    moderatorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    livekitRoomName: { type: String, required: true, unique: true },
    allowAudienceMicRequests: { type: Boolean, default: true },
    scheduledFor: Date,
    startedAt: Date,
    endedAt: Date
  },
  { timestamps: true }
);

roomSchema.index({ status: 1, type: 1, participantCount: -1 });

export const Room = mongoose.model<IRoom>("Room", roomSchema);
