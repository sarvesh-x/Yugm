import mongoose, { Schema } from "mongoose";

const groupMessageSchema = new Schema({
  groupId: { type: Schema.Types.ObjectId, ref: "GroupChat", required: true, index: true },
  senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
  message: { type: String, required: true, trim: true },
  mediaUrl: { type: String, default: "" },
  mediaType: { type: String, enum: ["", "IMAGE", "VIDEO", "AUDIO"], default: "" },
  duration: { type: Number, default: 0 },
}, { timestamps: true });

groupMessageSchema.index({ groupId: 1, createdAt: -1 });
export const GroupMessage = mongoose.model("GroupMessage", groupMessageSchema);
