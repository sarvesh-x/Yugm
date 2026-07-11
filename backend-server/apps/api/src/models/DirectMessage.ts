import mongoose, { Schema } from "mongoose";

const directMessageSchema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    message: { type: String, required: true, trim: true },
    mediaUrl: { type: String, default: "" },
    mediaType: { type: String, enum: ["", "IMAGE", "VIDEO"], default: "" },
    reactions: [{
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      type: { type: String, enum: ["heart", "fire", "laugh", "clap", "wow"], required: true },
      createdAt: { type: Date, default: Date.now }
    }],
    read: { type: Boolean, default: false }
  },
  { timestamps: true }
);

directMessageSchema.index({ senderId: 1, receiverId: 1, createdAt: -1 });

export const DirectMessage = mongoose.model("DirectMessage", directMessageSchema);
