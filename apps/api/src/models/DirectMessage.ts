import mongoose, { Schema } from "mongoose";

const directMessageSchema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    message: { type: String, required: true, trim: true },
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

directMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

export const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);
