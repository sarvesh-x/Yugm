import mongoose, { Schema } from "mongoose";

export const pkEventTypes = [
  "PK_CREATED",
  "PK_READY",
  "PK_COUNTDOWN",
  "PK_FINAL_CRUNCH",
  "PK_FINALIZING",
  "PK_COMPLETED",
  "PK_CLOSED",
  "PK_CANCELLED",
  "PK_ABORTED",
  "PK_INVITE_SENT",
  "PK_INVITE_ACCEPTED",
  "PK_INVITE_REJECTED",
  "PK_INVITE_EXPIRED",
  "PK_STARTED",
  "GIFT_SENT",
  "REACTION_SENT",
  "VOTE_CAST",
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
    stateVersion: { type: Number, default: 1 },
    sequence: { type: Number, min: 1 },
    giftTransactionId: { type: Schema.Types.ObjectId, ref: "GiftTransaction" },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

pkEventSchema.index({ battleId: 1, createdAt: -1 });
pkEventSchema.index({ battleId: 1, sequence: 1 }, { unique: true, partialFilterExpression: { sequence: { $type: "number" } } });
pkEventSchema.index({ giftTransactionId: 1 }, { unique: true, sparse: true });

export const PkEvent = mongoose.model("PkEvent", pkEventSchema);
