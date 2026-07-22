import mongoose, { Schema } from "mongoose";

const giftTransactionSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room" },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    giftId: { type: Schema.Types.ObjectId, ref: "Gift", required: true },
    coinAmount: { type: Number, required: true },
    type: { type: String, default: "send", enum: ["send", "combo", "room_wide", "trade", "auction"] },
    comboCount: { type: Number, default: 1 },
    totalValue: { type: Number, default: 0 },
    effect: { type: String, default: "" },
    metadata: { type: Schema.Types.Mixed, default: {} }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

giftTransactionSchema.index({ roomId: 1, createdAt: -1 });
giftTransactionSchema.index({ senderId: 1, createdAt: -1 });
giftTransactionSchema.index({ receiverId: 1, createdAt: -1 });
giftTransactionSchema.index({ type: 1, createdAt: -1 });

export const GiftTransaction = mongoose.model("GiftTransaction", giftTransactionSchema);
