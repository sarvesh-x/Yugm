import mongoose, { Schema, Document } from "mongoose";

export interface CosmeticDocument extends Document<string> {
  type: string;
  name: string;
  coinPrice: number;
  rarity: string;
  preview: string;
  isActive: boolean;
  assetKind?: string;
  assetUrl?: string;
  createdAt: Date;
  updatedAt: Date;
}

const cosmeticSchema = new Schema<CosmeticDocument>(
  {
    _id: { type: String, required: true },
    type: { type: String, required: true, index: true },
    name: { type: String, required: true },
    coinPrice: { type: Number, required: true, min: 0 },
    rarity: { type: String, enum: ["COMMON", "RARE", "EPIC", "LEGENDARY"], default: "COMMON" },
    preview: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    assetKind: { type: String },
    assetUrl: { type: String }
  },
  { timestamps: true, _id: false }
);

export const Cosmetic = mongoose.model<CosmeticDocument>("Cosmetic", cosmeticSchema);
