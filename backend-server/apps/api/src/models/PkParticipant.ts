import mongoose, { Schema } from "mongoose";

const pkParticipantSchema = new Schema(
  {
    battleId: { type: Schema.Types.ObjectId, ref: "PkBattle", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    side: { type: String, enum: ["LEFT", "RIGHT"], required: true },
    role: { type: String, enum: ["HOST", "SPEAKER", "AUDIENCE", "MODERATOR"], required: true },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date }
  },
  { timestamps: false }
);

pkParticipantSchema.index({ battleId: 1, userId: 1 }, { unique: true });

export const PkParticipant = mongoose.model("PkParticipant", pkParticipantSchema);
