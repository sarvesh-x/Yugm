import mongoose, { Schema } from "mongoose";

const giftCollectionSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    description: { type: String, default: "" },
    icon: { type: String, default: "" },
    bonus: {
      description: { type: String, default: "" },
      xpMultiplier: { type: Number, default: 1 },
      coinMultiplier: { type: Number, default: 1 }
    },
    gifts: [{ type: Schema.Types.ObjectId, ref: "Gift" }],
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const GiftCollection = mongoose.model("GiftCollection", giftCollectionSchema);
