import mongoose, { Schema } from "mongoose";

export interface IWaveNudge extends mongoose.Document {
  senderId: mongoose.Types.ObjectId;
  receiverId: mongoose.Types.ObjectId;
  type: "wave" | "nudge" | "vibe_ping";
  read: boolean;
  roomId?: mongoose.Types.ObjectId;
}

const waveNudgeSchema = new Schema<IWaveNudge>(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    type: { type: String, enum: ["wave", "nudge", "vibe_ping"], required: true },
    read: { type: Boolean, default: false },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" }
  },
  { timestamps: true }
);

waveNudgeSchema.index({ receiverId: 1, read: 1, createdAt: -1 });
waveNudgeSchema.index({ senderId: 1, createdAt: -1 });

export const WaveNudge = mongoose.model<IWaveNudge>("WaveNudge", waveNudgeSchema);
