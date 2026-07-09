import mongoose, { Schema } from "mongoose";

export const pkInviteStatuses = ["PENDING", "ACCEPTED", "REJECTED", "EXPIRED", "CANCELLED"] as const;

const pkInviteSchema = new Schema(
  {
    battleId: { type: Schema.Types.ObjectId, ref: "PkBattle", required: true, index: true },
    inviterUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    inviteeUserId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
    inviterRoomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    inviteeRoomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    status: { type: String, enum: pkInviteStatuses, required: true, default: "PENDING", index: true },
    expiresAt: { type: Date, required: true, index: true },
    respondedAt: { type: Date }
  },
  { timestamps: true }
);

pkInviteSchema.index({ inviteeUserId: 1, status: 1, expiresAt: 1 });

export const PkInvite = mongoose.model("PkInvite", pkInviteSchema);
