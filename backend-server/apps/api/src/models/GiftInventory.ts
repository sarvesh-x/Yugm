import mongoose, { Schema } from "mongoose";

const giftInventorySchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    giftId: { type: Schema.Types.ObjectId, ref: "Gift", required: true },
    quantity: { type: Number, required: true, min: 1 },
    source: { type: String, default: "purchased", enum: ["purchased", "received", "reward", "mystery"] },
    tradable: { type: Boolean, default: false }
  },
  { timestamps: true }
);

giftInventorySchema.index({ userId: 1 });
giftInventorySchema.index({ userId: 1, giftId: 1 }, { unique: true });
giftInventorySchema.index({ tradable: 1, userId: 1 });

export const GiftInventory = mongoose.model("GiftInventory", giftInventorySchema);
