import mongoose, { Schema } from "mongoose";

const giftTransactionSchema = new Schema(
  {
    roomId: { type: Schema.Types.ObjectId, ref: "Room", required: true },
    senderId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    receiverId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    giftId: { type: Schema.Types.ObjectId, ref: "Gift", required: true },
    coinAmount: { type: Number, required: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

giftTransactionSchema.index({ roomId: 1, createdAt: -1 });
giftTransactionSchema.index({ senderId: 1, createdAt: -1 });
giftTransactionSchema.index({ receiverId: 1, createdAt: -1 });

export const GiftTransaction = mongoose.model("GiftTransaction", giftTransactionSchema);
