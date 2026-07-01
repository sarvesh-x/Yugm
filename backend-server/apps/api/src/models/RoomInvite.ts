import mongoose, { Schema } from "mongoose";

const roomInviteSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    inviterId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    inviteeId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    status: { type: String, enum: ["PENDING", "ACCEPTED", "DECLINED"], default: "PENDING" }
  },
  { timestamps: true }
);

roomInviteSchema.index({ roomId: 1, inviteeId: 1, status: 1 });

export const RoomInvite = mongoose.model("RoomInvite", roomInviteSchema);
