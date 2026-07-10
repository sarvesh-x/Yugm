import mongoose, { Schema } from "mongoose";

export const pkEventTypes = [
  "PK_CREATED",
  "PK_INVITE_SENT",
  "PK_INVITE_ACCEPTED",
  "PK_INVITE_REJECTED",
  "PK_INVITE_EXPIRED",
  "PK_STARTED",
  "GIFT_SENT",
  "REACTION_SENT",
  "SCORE_UPDATED",
  "LEAD_CHANGED",
  "PK_ENDED",
  "PK_FORCE_ENDED",
  "PK_REMATCH_REQUESTED"
] as const;

const pkEventSchema = new Schema(
  {
    battleId: { type: Schema.Types.ObjectId, ref: "PkBattle", required: true, index: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    userId: { type: Schema.Types.ObjectId, ref: "User" },
    eventType: { type: String, enum: pkEventTypes, required: true, index: true },
    side: { type: String, enum: ["LEFT", "RIGHT", "DRAW"] },
    points: { type: Number, default: 0 },
    giftTransactionId: { type: Schema.Types.ObjectId, ref: "GiftTransaction" },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

pkEventSchema.index({ battleId: 1, createdAt: -1 });

export const PkEvent = mongoose.model("PkEvent", pkEventSchema);
