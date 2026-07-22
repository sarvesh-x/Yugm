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

interface ThemeSeed {
  key: string; name: string; type: "room_background" | "profile_theme" | "entrance_effect" | "border";
  category: string; colors: string[]; animation?: Record<string, unknown>; ambientSound?: string;
  price: { coins: number; diamonds: number }; premium: boolean; available: boolean;
}

export const themeSeeds: ThemeSeed[] = [
  { key: "theme_midnight", name: "Midnight Glow", type: "room_background", category: "nightclub", colors: ["#0a0a2e", "#1a1a4e", "#2d1b69"], animation: { type: "gradient", config: { speed: 0.5, direction: "diagonal" } }, ambientSound: "ambience_night", price: { coins: 499, diamonds: 0 }, premium: false, available: true },
  { key: "theme_saffron", name: "Saffron Wave", type: "room_background", category: "festival", colors: ["#FF9933", "#FFB347", "#FFD700"], animation: { type: "gradient", config: { speed: 0.6, direction: "horizontal" } }, ambientSound: "ambience_cafe", price: { coins: 799, diamonds: 0 }, premium: false, available: true },
  { key: "theme_aurora", name: "Aurora Glass", type: "room_background", category: "space", colors: ["#00F2FE", "#4FACFE", "#A18CD1"], animation: { type: "particles", config: { count: 80, size: 3, speed: 0.3, color: "#4FACFE" } }, ambientSound: "ambience_lofi", price: { coins: 999, diamonds: 0 }, premium: false, available: true },
  { key: "theme_sunset", name: "Sunset Bloom", type: "room_background", category: "beach", colors: ["#FF512F", "#DD2475", "#E94057"], animation: { type: "gradient", config: { speed: 0.4, direction: "vertical" } }, ambientSound: "ambience_rain", price: { coins: 1199, diamonds: 0 }, premium: true, available: true },
  { key: "theme_neon_club", name: "Neon Club", type: "room_background", category: "neon", colors: ["#0a0a2e", "#00F2FE", "#F20000"], animation: { type: "particles", config: { count: 120, size: 2, speed: 0.6, color: "#00F2FE" } }, ambientSound: "ambience_night", price: { coins: 899, diamonds: 0 }, premium: false, available: true },
  { key: "theme_festive", name: "Festive Room", type: "room_background", category: "festival", colors: ["#F12711", "#F5AF19", "#FFE000"], animation: { type: "particles", config: { count: 100, size: 4, speed: 0.5, color: "#F5AF19" } }, ambientSound: "ambience_cafe", price: { coins: 699, diamonds: 0 }, premium: false, available: true },
  { key: "theme_cozy", name: "Cozy Cafe", type: "room_background", category: "cafe", colors: ["#2C1810", "#4A2C1B", "#6B4226"], animation: { type: "gradient", config: { speed: 0.3, direction: "radial" } }, ambientSound: "ambience_cafe", price: { coins: 399, diamonds: 0 }, premium: false, available: true },
  { key: "theme_beach", name: "Beach Sunset", type: "room_background", category: "beach", colors: ["#0BDEFF", "#2AF598", "#00F260"], animation: { type: "gradient", config: { speed: 0.5, direction: "horizontal" } }, ambientSound: "ambience_rain", price: { coins: 599, diamonds: 0 }, premium: false, available: true },
  { key: "theme_cosmos", name: "Cosmos Drift", type: "room_background", category: "space", colors: ["#1A2980", "#26D0CE", "#00E1FD"], animation: { type: "particles", config: { count: 150, size: 2, speed: 0.4, color: "#26D0CE" } }, ambientSound: "ambience_lofi", price: { coins: 1499, diamonds: 50 }, premium: true, available: true },
  { key: "theme_fire", name: "Fire Dance", type: "room_background", category: "nightclub", colors: ["#F12711", "#E91429", "#8B0000"], animation: { type: "particles", config: { count: 90, size: 5, speed: 0.7, color: "#F12711" } }, ambientSound: "ambience_night", price: { coins: 999, diamonds: 0 }, premium: false, available: true },
  { key: "theme_royal", name: "Royal Court", type: "room_background", category: "luxury", colors: ["#141E30", "#E100FF", "#4A00E0"], animation: { type: "gradient", config: { speed: 0.3, direction: "diagonal" } }, ambientSound: "ambience_lofi", price: { coins: 1999, diamonds: 100 }, premium: true, available: true },
  { key: "theme_forest", name: "Forest Chill", type: "room_background", category: "library", colors: ["#0B3D0B", "#1B5E20", "#4CAF50"], animation: { type: "weather", config: { effect: "leaves", intensity: 0.4 } }, ambientSound: "ambience_forest", price: { coins: 799, diamonds: 0 }, premium: false, available: true },
  { key: "theme_cyberpunk", name: "Cyberpunk City", type: "room_background", category: "neon", colors: ["#0D0221", "#FF00FF", "#00FFFF"], animation: { type: "particles", config: { count: 200, size: 2, speed: 0.8, color: "#FF00FF" } }, ambientSound: "ambience_night", price: { coins: 2499, diamonds: 150 }, premium: true, available: true },
  { key: "theme_temple", name: "Temple Serenity", type: "room_background", category: "temple", colors: ["#FFD700", "#FF8C00", "#8B4513"], animation: { type: "weather", config: { effect: "glow", intensity: 0.3 } }, ambientSound: "ambience_cafe", price: { coins: 699, diamonds: 0 }, premium: false, available: true },
  { key: "theme_lofi", name: "Lo-fi Study", type: "room_background", category: "lofi", colors: ["#2C3E50", "#8E44AD", "#3498DB"], animation: { type: "gradient", config: { speed: 0.2, direction: "horizontal" } }, ambientSound: "ambience_lofi", price: { coins: 499, diamonds: 0 }, premium: false, available: true },
  { key: "theme_mountain", name: "Mountain Peak", type: "room_background", category: "mountain", colors: ["#1A1A2E", "#16213E", "#0F3460"], animation: { type: "weather", config: { effect: "snow", intensity: 0.5 } }, ambientSound: "ambience_forest", price: { coins: 899, diamonds: 0 }, premium: false, available: true },
  { key: "theme_gaming", name: "Gaming Arena", type: "room_background", category: "gaming", colors: ["#0F0C29", "#302B63", "#24243E"], animation: { type: "particles", config: { count: 100, size: 3, speed: 0.5, color: "#302B63" } }, ambientSound: "ambience_lofi", price: { coins: 799, diamonds: 0 }, premium: false, available: true },
  { key: "theme_villa", name: "Villa Evening", type: "room_background", category: "villa", colors: ["#1B1B2F", "#E43F5A", "#16213E"], animation: { type: "gradient", config: { speed: 0.4, direction: "vertical" } }, ambientSound: "ambience_cafe", price: { coins: 1299, diamonds: 25 }, premium: true, available: true },
];
