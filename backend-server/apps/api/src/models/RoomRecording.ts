import mongoose, { Schema } from "mongoose";

export interface IRoomRecording extends mongoose.Document {
  roomId: mongoose.Types.ObjectId;
  hostId: mongoose.Types.ObjectId;
  title: string;
  recordingUrl: string;
  duration: number;
  viewCount: number;
  status: "PROCESSING" | "PUBLISHED" | "FAILED";
}

const roomRecordingSchema = new Schema<IRoomRecording>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    hostId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    title: { type: String, required: true },
    recordingUrl: { type: String, required: true },
    duration: { type: Number, default: 0 },
    viewCount: { type: Number, default: 0 },
    status: { type: String, enum: ["PROCESSING", "PUBLISHED", "FAILED"], default: "PROCESSING" },
  },
  { timestamps: true }
);

roomRecordingSchema.index({ hostId: 1, createdAt: -1 });

export const RoomRecording = mongoose.model<IRoomRecording>("RoomRecording", roomRecordingSchema);
