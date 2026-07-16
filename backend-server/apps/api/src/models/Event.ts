import mongoose, { Schema } from "mongoose";

export interface IEvent extends mongoose.Document {
  title: string;
  description?: string;
  hostId: mongoose.Types.ObjectId;
  coverImage?: string;
  category: string;
  type: "ROOM" | "TOURNAMENT" | "SPECIAL" | "WORKSHOP" | "PARTY";
  eventDate: Date;
  eventEndDate?: Date;
  timezone?: string;
  roomId?: mongoose.Types.ObjectId;
  maxParticipants?: number;
  participantIds: mongoose.Types.ObjectId[];
  tags: string[];
  status: "UPCOMING" | "LIVE" | "COMPLETED" | "CANCELLED";
  createdAt: Date;
}

const eventSchema = new Schema<IEvent>(
  {
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 2000 },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    coverImage: String,
    category: { type: String, required: true },
    type: { type: String, enum: ["ROOM", "TOURNAMENT", "SPECIAL", "WORKSHOP", "PARTY"], required: true },
    eventDate: { type: Date, required: true, index: true },
    eventEndDate: Date,
    timezone: String,
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    maxParticipants: Number,
    participantIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    tags: [{ type: String }],
    status: { type: String, enum: ["UPCOMING", "LIVE", "COMPLETED", "CANCELLED"], default: "UPCOMING", index: true }
  },
  { timestamps: true }
);

eventSchema.index({ eventDate: 1, status: 1 });
eventSchema.index({ status: 1, eventDate: -1 });

export const Event = mongoose.model<IEvent>("Event", eventSchema);
