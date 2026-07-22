import mongoose, { Schema } from "mongoose";

const giftSchema = new Schema(
  {
    name: { type: String, required: true, unique: true },
    icon: { type: String, required: true },
    coinPrice: { type: Number, required: true, min: 1 },
    diamondPrice: { type: Number, default: 0 },
    isActive: { type: Boolean, default: true },
    effect3d: { type: String, default: "" },
    interactive: { type: Boolean, default: false },
    comboMultiplier: { type: Number, default: 1 },
    category: { type: String, default: "normal", enum: ["normal", "premium", "limited", "seasonal", "mythology", "space", "dragon", "luxury"] },
    theme: { type: String, default: "" },
    rarity: { type: String, default: "common", enum: ["common", "rare", "epic", "legendary", "mythic"] },
    limitedEdition: {
      active: { type: Boolean, default: false },
      total: { type: Number, default: 0 },
      remaining: { type: Number, default: 0 }
    },
    collectionId: { type: Schema.Types.ObjectId, ref: "GiftCollection", default: null },
    tradable: { type: Boolean, default: false },
    upgradeable: { type: Boolean, default: false },
    upgradePath: [{ type: Schema.Types.ObjectId, ref: "Gift" }],
    achievementGift: { type: Boolean, default: false },
    petGift: { type: Boolean, default: false },
    vehicleGift: { type: Boolean, default: false }
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

giftSchema.index({ category: 1, rarity: 1 });
giftSchema.index({ collectionId: 1 });

export const Gift = mongoose.model("Gift", giftSchema);
