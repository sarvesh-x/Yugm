import { profileCosmetics } from "@yugm/shared";

const activeCosmeticKeys = {
  AVATAR_ASSET: "avatarAsset",
  AVATAR_FRAME: "avatarFrame",
  SPEAKING_WAVE: "speakingWave",
  PROFILE_THEME: "profileTheme",
  ENTRANCE_EFFECT: "entranceEffect",
  PROFILE_BADGE: "profileBadge",
  NAME_STYLE: "nameStyle",
  ROOM_ENTRY: "roomEntry",
  MOOD_STATUS: "moodStatus",
  PROFILE_MUSIC: "profileMusic",
  VOICE_BADGE: "voiceBadge",
  ROOM_THEME: "roomTheme",
  AVATAR_DECORATION: "avatarDecoration",
  REACTION_PACK: "reactionPack",
  PROFILE_LAYOUT: "profileLayout",
  INTRO_CARD: "introCard",
  COLLECTIBLE_TITLE: "collectibleTitle",
  GIFT_SHELF: "giftShelf",
  CHAT_BUBBLE: "chatBubble",
  SEASONAL_EVENT: "seasonalEvent",
  CALL_SCREEN: "videoCallOverlay",
  ROOM_BADGE: "roomBadge",
  ROOM_AMBIENCE: "roomAmbience"
} as const;

export function findProfileCosmetic(cosmeticId: string) {
  return profileCosmetics.find((item) => item.id === cosmeticId);
}

export function activeCosmeticKey(type: string) {
  return activeCosmeticKeys[type as keyof typeof activeCosmeticKeys];
}
