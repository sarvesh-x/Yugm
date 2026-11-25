import mongoose, { Schema } from "mongoose";

export interface IImmersiveTheme extends mongoose.Document {
  key: string;
  name: string;
  type: "room_background" | "profile_theme" | "entrance_effect" | "border";
  category: string;
  colors: string[];
  animation?: { type: string; config: Record<string, unknown> };
  ambientSound?: string;
  price: { coins: number; diamonds: number };
  premium: boolean;
  available: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const immersiveThemeSchema = new Schema<IImmersiveTheme>(
  {
    key: { type: String, required: true, unique: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["room_background", "profile_theme", "entrance_effect", "border"], required: true },
    category: { type: String, required: true },
    colors: [{ type: String }],
    animation: { type: Schema.Types.Mixed },
    ambientSound: String,
    price: {
      coins: { type: Number, default: 0 },
      diamonds: { type: Number, default: 0 }
    },
    premium: { type: Boolean, default: false },
    available: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const ImmersiveTheme = mongoose.model<IImmersiveTheme>("ImmersiveTheme", immersiveThemeSchema);

export { themeSeeds } from "../services/immersiveThemeCatalog.js";
