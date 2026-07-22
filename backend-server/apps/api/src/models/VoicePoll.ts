import mongoose, { Schema } from "mongoose";

export interface IVoicePoll extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  question: string;
  audioUrl: string;
  duration: number;
  options: Array<{ text: string; audioUrl?: string; votes: number }>;
  voters: mongoose.Types.ObjectId[];
  isActive: boolean;
  expiresAt: Date;
}

const voicePollSchema = new Schema<IVoicePoll>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    question: { type: String, required: true, maxlength: 200 },
    audioUrl: { type: String, default: "" },
    duration: { type: Number, default: 0 },
    options: [{
      text: { type: String, required: true, maxlength: 100 },
      audioUrl: String,
      votes: { type: Number, default: 0 }
    }],
    voters: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isActive: { type: Boolean, default: true },
    expiresAt: { type: Date }
  },
  { timestamps: true }
);

voicePollSchema.index({ userId: 1, createdAt: -1 });
voicePollSchema.index({ isActive: 1, expiresAt: -1 });
voicePollSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const VoicePoll = mongoose.model<IVoicePoll>("VoicePoll", voicePollSchema);
