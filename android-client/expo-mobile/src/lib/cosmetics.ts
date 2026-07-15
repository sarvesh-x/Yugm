import { profileCosmetics, cosmeticBundles } from "@yugm/shared";

export type ActiveCosmetics = {
  avatarAsset?: string;
  avatarFrame?: string;
  speakingWave?: string;
  profileTheme?: string;
  entranceEffect?: string;
  profileBadge?: string;
  nameStyle?: string;
  roomEntry?: string;
  moodStatus?: string;
  profileMusic?: string;
  voiceBadge?: string;
  roomTheme?: string;
  avatarDecoration?: string;
  reactionPack?: string;
  profileLayout?: string;
  introCard?: string;
  collectibleTitle?: string;
  giftShelf?: string;
  chatBubble?: string;
  seasonalEvent?: string;
};

export type CosmeticItem = (typeof profileCosmetics)[number];

export const cosmeticCatalog = profileCosmetics;
export { cosmeticBundles };

export function findCosmetic(id?: string) {
  return id ? cosmeticCatalog.find((item) => item.id === id) : undefined;
}

export function cosmeticSlot(type: string) {
  if (type === "AVATAR_ASSET") return "avatarAsset";
  if (type === "AVATAR_FRAME") return "avatarFrame";
  if (type === "SPEAKING_WAVE") return "speakingWave";
  if (type === "PROFILE_THEME") return "profileTheme";
  if (type === "ENTRANCE_EFFECT") return "entranceEffect";
  if (type === "PROFILE_BADGE") return "profileBadge";
  if (type === "NAME_STYLE") return "nameStyle";
  if (type === "ROOM_ENTRY") return "roomEntry";
  if (type === "MOOD_STATUS") return "moodStatus";
  if (type === "PROFILE_MUSIC") return "profileMusic";
  if (type === "VOICE_BADGE") return "voiceBadge";
  if (type === "ROOM_THEME") return "roomTheme";
  if (type === "AVATAR_DECORATION") return "avatarDecoration";
  if (type === "REACTION_PACK") return "reactionPack";
  if (type === "PROFILE_LAYOUT") return "profileLayout";
  if (type === "INTRO_CARD") return "introCard";
  if (type === "COLLECTIBLE_TITLE") return "collectibleTitle";
  if (type === "GIFT_SHELF") return "giftShelf";
  if (type === "CHAT_BUBBLE") return "chatBubble";
  if (type === "SEASONAL_EVENT") return "seasonalEvent";
  return "avatarFrame";
}

export function cosmeticTypeLabel(type: string) {
  return type.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function profileThemeColors(themeId?: string): [string, string] {
  if (themeId === "season_holi") return ["rgba(255,62,147,0.2)", "rgba(39,211,255,0.14)"];
  if (themeId === "season_diwali") return ["rgba(246,180,75,0.2)", "rgba(255,138,34,0.12)"];
  if (themeId === "theme_saffron") return ["rgba(255,138,34,0.18)", "rgba(246,180,75,0.08)"];
  if (themeId === "theme_aurora") return ["rgba(39,211,255,0.16)", "rgba(124,45,255,0.12)"];
  if (themeId === "theme_midnight") return ["rgba(124,45,255,0.16)", "rgba(5,7,19,0.2)"];
  return ["rgba(255,255,255,0.04)", "rgba(255,255,255,0.02)"];
}

export function roomThemeColors(themeId?: string): [string, string, string] {
  if (themeId === "room_theme_neon_club") return ["#100A28", "#7C2DFF", "#FF3E93"];
  if (themeId === "room_theme_festive") return ["#231104", "#FF8A22", "#F6B44B"];
  return ["#10162D", "#232A43", "#111827"];
}

export function nameStyleColors(styleId?: string): [string, string] {
  if (styleId === "name_neon_glow") return ["#FF3E93", "#27D3FF"];
  if (styleId === "name_rainbow_pulse") return ["#FF3E93", "#F6B44B"];
  return ["#F6B44B", "#FFE8A3"];
}

export function cosmeticPreviewText(id?: string) {
  const item = findCosmetic(id) as { preview?: string; name?: string } | undefined;
  return item?.preview ? String(item.preview) : item?.name;
}
