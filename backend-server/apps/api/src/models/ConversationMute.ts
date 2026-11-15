import mongoose, { Schema } from "mongoose";

const conversationMuteSchema = new Schema({
  ownerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  partnerId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  muted: { type: Boolean, default: true },
  updatedAt: { type: Date, default: Date.now }
});

conversationMuteSchema.index({ ownerId: 1, partnerId: 1 }, { unique: true });

export const ConversationMute = mongoose.model("ConversationMute", conversationMuteSchema);
