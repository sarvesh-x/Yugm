import mongoose, { Schema, type Model } from "mongoose";

export interface IChatMessage extends mongoose.Document {
  roomId: mongoose.Types.ObjectId;
  senderId: mongoose.Types.ObjectId;
  message: string;
  type: "TEXT" | "SYSTEM" | "GIFT" | "REACTION";
}

const chatMessageSchema = new Schema<IChatMessage>(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true },
    type: { type: String, enum: ["TEXT", "SYSTEM", "GIFT", "REACTION"], default: "TEXT" }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

chatMessageSchema.index({ roomId: 1, createdAt: -1 });

export const ChatMessage: Model<IChatMessage> = mongoose.model<IChatMessage>("ChatMessage", chatMessageSchema);
