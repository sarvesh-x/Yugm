import mongoose, { Schema } from "mongoose";

const roomFollowSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true, index: true }
  },
  { timestamps: true }
);

roomFollowSchema.index({ roomId: 1, userId: 1 }, { unique: true });
roomFollowSchema.index({ userId: 1, createdAt: -1 });

export const RoomFollow = mongoose.model("RoomFollow", roomFollowSchema);
