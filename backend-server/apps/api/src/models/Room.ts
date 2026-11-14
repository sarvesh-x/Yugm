import mongoose, { Schema } from "mongoose";
import { roomModes, type RoomMode, type RoomStatus, type RoomType, type RoomVisibility } from "@yugm/shared";

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
  roomAdminIds?: mongoose.Types.ObjectId[];
  coHostIds: mongoose.Types.ObjectId[];
  isDuet: boolean;
  livekitRoomName: string;
  allowAudienceMicRequests: boolean;
  micLocked: boolean;
  lockedSeatIndices: number[];
  theme?: string;
  vipOnly: boolean;
  badge?: string;
  ambience?: string;
  scheduledFor?: Date;
  startedAt?: Date;
  endedAt?: Date;
  mode?: RoomMode;
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
    maxSpeakers: { type: Number, default: 8 },
    participantCount: { type: Number, default: 0 },
    speakerIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    moderatorIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    roomAdminIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    coHostIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isDuet: { type: Boolean, default: false },
    livekitRoomName: { type: String, required: true, unique: true },
    allowAudienceMicRequests: { type: Boolean, default: true },
    micLocked: { type: Boolean, default: false },
    lockedSeatIndices: { type: [Number], default: [] },
    theme: String,
    vipOnly: { type: Boolean, default: false },
    badge: String,
    ambience: String,
    scheduledFor: Date,
    startedAt: Date,
    endedAt: Date,
    mode: { type: String, enum: roomModes }
  },
  { timestamps: true }
);

roomSchema.index({ status: 1, type: 1, participantCount: -1 });

export const Room = mongoose.model<IRoom>("Room", roomSchema);
