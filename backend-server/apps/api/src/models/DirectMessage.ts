import mongoose, { Schema } from "mongoose";

const replyToSchema = new Schema(
  {
    messageId: { type: Schema.Types.ObjectId, required: true },
    author: { type: String, default: "" },
    authorId: { type: Schema.Types.ObjectId, ref: "User" },
    text: { type: String, default: "" },
    mediaUrl: { type: String, default: "" }
  },
  { _id: false }
);

const directMessageSchema = new Schema(
  {
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    message: { type: String, required: true, trim: true },
    mediaUrl: { type: String, default: "" },
    mediaType: { type: String, enum: ["", "IMAGE", "VIDEO", "AUDIO"], default: "" },
    duration: { type: Number, default: 0 },
    replyTo: { type: replyToSchema, default: undefined },
    forwarded: { type: Boolean, default: false },
    hiddenFor: [{ type: Schema.Types.ObjectId, ref: "User" }],
    isEdited: { type: Boolean, default: false },
    editedAt: Date,
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
