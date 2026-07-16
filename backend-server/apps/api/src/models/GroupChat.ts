import mongoose, { Schema } from "mongoose";

const groupChatSchema = new Schema({
  name: { type: String, required: true, trim: true },
  createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
  participantIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
  lastMessage: { type: String, default: "" },
  lastMessageAt: Date,
}, { timestamps: true });

groupChatSchema.index({ participantIds: 1 });
export const GroupChat = mongoose.model("GroupChat", groupChatSchema);
