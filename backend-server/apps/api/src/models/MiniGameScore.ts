import mongoose, { Schema } from "mongoose";
import type { MiniGameId } from "@yugm/shared";

export interface IMiniGameScore extends mongoose.Document {
  userId: mongoose.Types.ObjectId;
  gameId: MiniGameId;
  score: number;
  durationMs?: number;
  rounds?: number;
  metadata?: Record<string, unknown>;
  createdAt: Date;
}

const miniGameScoreSchema = new Schema<IMiniGameScore>(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    gameId: { type: String, enum: ["vibe_tap", "memory_match", "reflex_ring"], required: true, index: true },
    score: { type: Number, required: true, min: 0, max: 999999 },
    durationMs: { type: Number, min: 0, max: 300000 },
    rounds: { type: Number, min: 0, max: 1000 },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

miniGameScoreSchema.index({ gameId: 1, score: -1, createdAt: 1 });
miniGameScoreSchema.index({ userId: 1, gameId: 1, score: -1 });

export const MiniGameScore = mongoose.model<IMiniGameScore>("MiniGameScore", miniGameScoreSchema);
