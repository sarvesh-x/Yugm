import mongoose, { Schema } from "mongoose";

const clanInviteSchema = new Schema({
  clanId: { type: Schema.Types.ObjectId, ref: "Clan", required: true, index: true },
  inviterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  inviteeId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true },
  status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED", "EXPIRED", "CANCELLED"], default: "PENDING", index: true },
  expiresAt: { type: Date, required: true, index: true }
}, { timestamps: true });

clanInviteSchema.index({ clanId: 1, inviteeId: 1 }, { unique: true, partialFilterExpression: { status: "PENDING" } });
clanInviteSchema.index({ inviteeId: 1, status: 1, createdAt: -1 });

export const ClanInvite = mongoose.model("ClanInvite", clanInviteSchema);
