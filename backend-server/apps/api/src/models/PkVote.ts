import mongoose, { Schema } from "mongoose";

const pkVoteSchema = new Schema({
  battleId: { type: Schema.Types.ObjectId, ref: "PkBattle", required: true },
  voterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  side: { type: String, enum: ["LEFT", "RIGHT"], required: true },
  roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

pkVoteSchema.index({ battleId: 1, voterId: 1 }, { unique: true });
export const PkVote = mongoose.model("PkVote", pkVoteSchema);
