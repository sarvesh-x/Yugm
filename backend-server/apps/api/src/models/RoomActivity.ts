import mongoose, { Schema } from "mongoose";

export interface IRoomActivity extends mongoose.Document {
  roomId: mongoose.Types.ObjectId;
  userId?: mongoose.Types.ObjectId;
  type: "JOIN" | "LEAVE" | "GIFT" | "REACTION" | "SPEAKER_REQUEST" | "POLL" | "INVITE" | "MISSION";
  label: string;
  metadata: Record<string, unknown>;
}

const roomActivitySchema = new Schema<IRoomActivity>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    type: { type: String, required: true },
    label: { type: String, required: true },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: true }
);

roomActivitySchema.index({ roomId: 1, createdAt: -1 });

export const RoomActivity = mongoose.model<IRoomActivity>("RoomActivity", roomActivitySchema);
