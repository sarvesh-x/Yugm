import mongoose, { Schema } from "mongoose";

const pkLeaderboardEntrySchema = new Schema(
  {
    battleId: { type: Schema.Types.ObjectId, ref: "PkBattle", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    side: { type: String, enum: ["LEFT", "RIGHT"], required: true },
    totalPoints: { type: Number, default: 0 },
    totalGiftsSent: { type: Number, default: 0 }
  },
  { timestamps: true }
);

pkLeaderboardEntrySchema.index({ battleId: 1, userId: 1 }, { unique: true });
pkLeaderboardEntrySchema.index({ battleId: 1, totalPoints: -1 });

export const PkLeaderboardEntry = mongoose.model("PkLeaderboardEntry", pkLeaderboardEntrySchema);
