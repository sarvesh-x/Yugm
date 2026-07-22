import mongoose, { Schema } from "mongoose";
import type { RoomMode } from "@yugm/shared";

export interface IRoomModeState extends mongoose.Document {
  roomId: mongoose.Types.ObjectId;
  mode: RoomMode;
  round: number;
  status: "WAITING" | "ACTIVE" | "ROUND_END" | "FINISHED";
  scores: Map<string, number>;
  currentTurnUserId?: mongoose.Types.ObjectId;
  currentQuestion?: string;
  currentOptions?: string[];
  participants: mongoose.Types.ObjectId[];
  roundStartTime?: Date;
  roundEndTime?: Date;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const roomModeStateSchema = new Schema<IRoomModeState>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true, unique: true },
    mode: { type: String, enum: ["coffee_date", "blind_date", "truth_or_dare", "never_have_i_ever", "would_you_rather"], required: true },
    round: { type: Number, default: 1 },
    status: { type: String, enum: ["WAITING", "ACTIVE", "ROUND_END", "FINISHED"], default: "WAITING" },
    scores: { type: Map, of: Number, default: {} },
    currentTurnUserId: { type: Schema.Types.ObjectId, ref: "User" },
    currentQuestion: String,
    currentOptions: [String],
    participants: [{ type: Schema.Types.ObjectId, ref: "User" }],
    roundStartTime: Date,
    roundEndTime: Date,
    metadata: { type: Schema.Types.Mixed, default: {} },
  },
  { timestamps: true }
);

export const RoomModeState = mongoose.model<IRoomModeState>("RoomModeState", roomModeStateSchema);
