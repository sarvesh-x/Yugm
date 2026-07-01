import mongoose, { Schema } from "mongoose";

const giftSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    icon: { type: String, required: true },
    coinPrice: { type: Number, required: true, min: 1 },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

export const Gift = mongoose.model("Gift", giftSchema);
