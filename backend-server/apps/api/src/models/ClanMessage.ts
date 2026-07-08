import mongoose, { Schema } from "mongoose";

const clanMessageSchema = new Schema(
  {
    clanId: { type: Schema.Types.ObjectId, ref: "Clan", required: true, index: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    message: { type: String, required: true, trim: true },
    reactions: [{
      userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
      type: { type: String, enum: ["heart", "fire", "laugh", "clap", "wow"], required: true },
      createdAt: { type: Date, default: Date.now }
    }]
  },
  { timestamps: true }
);

clanMessageSchema.index({ clanId: 1, createdAt: -1 });

export const ClanMessage = mongoose.model("ClanMessage", clanMessageSchema);
