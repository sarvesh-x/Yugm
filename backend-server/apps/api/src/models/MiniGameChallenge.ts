import mongoose, { Schema } from "mongoose";
import type { MiniGameId } from "@yugm/shared";

export interface IMiniGameChallenge extends mongoose.Document {
  challengerId: mongoose.Types.ObjectId;
  targetUserId?: mongoose.Types.ObjectId;
  clanId?: mongoose.Types.ObjectId;
  gameId: MiniGameId;
  score: number;
  scoreId?: mongoose.Types.ObjectId;
  message?: string;
  expiresAt: Date;
  createdAt: Date;
}

const miniGameChallengeSchema = new Schema<IMiniGameChallenge>(
  {
    challengerId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    targetUserId: { type: Schema.Types.ObjectId, ref: "User", index: true },
    clanId: { type: Schema.Types.ObjectId, ref: "Clan", index: true },
    gameId: { type: String, enum: ["vibe_tap", "memory_match", "reflex_ring"], required: true, index: true },
    score: { type: Number, required: true, min: 0, max: 999999 },
    scoreId: { type: Schema.Types.ObjectId, ref: "MiniGameScore" },
    message: { type: String, trim: true, maxlength: 180 },
    expiresAt: { type: Date, required: true, index: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

miniGameChallengeSchema.index({ targetUserId: 1, createdAt: -1 });
miniGameChallengeSchema.index({ clanId: 1, createdAt: -1 });

export const MiniGameChallenge = mongoose.model<IMiniGameChallenge>("MiniGameChallenge", miniGameChallengeSchema);
