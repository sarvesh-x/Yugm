import mongoose, { Schema } from "mongoose";

export const pkModes = ["GIFT", "REACTION", "MIXED"] as const;
export const pkStatuses = ["INVITED", "WAITING", "ACTIVE", "ENDED", "CANCELLED", "DECLINED", "EXPIRED", "FORCE_ENDED"] as const;
export const pkBattleTypes = ["VOICE", "VIDEO"] as const;
export const pkSides = ["LEFT", "RIGHT", "DRAW"] as const;

const pkBattleSchema = new Schema(
  {
    battleCode: { type: String, required: true, unique: true, index: true },
    title: { type: String, default: "" },
    mode: { type: String, enum: pkModes, required: true },
    status: { type: String, enum: pkStatuses, required: true, default: "INVITED", index: true },
    battleType: { type: String, enum: pkBattleTypes, required: true, index: true },
    durationSeconds: { type: Number, required: true, min: 30, max: 3600 },
    startedByUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leftRoomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    rightRoomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    leftHostId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    rightHostId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    leftScore: { type: Number, default: 0, min: 0 },
    rightScore: { type: Number, default: 0, min: 0 },
    winnerSide: { type: String, enum: pkSides, default: undefined },
    winnerUserId: { type: Schema.Types.ObjectId, ref: "User" },
    startedAt: { type: Date },
    endedAt: { type: Date }
  },
  { timestamps: true }
);

pkBattleSchema.index({ leftRoomId: 1, status: 1 });
pkBattleSchema.index({ rightRoomId: 1, status: 1 });
pkBattleSchema.index({ startedAt: 1, status: 1 });

export const PkBattle = mongoose.model("PkBattle", pkBattleSchema);
