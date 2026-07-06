import { profileCosmetics } from "@yugm/shared";

const activeCosmeticKeys = {
  AVATAR_FRAME: "avatarFrame",
  PROFILE_THEME: "profileTheme",
  ENTRANCE_EFFECT: "entranceEffect"
} as const;

export function findProfileCosmetic(cosmeticId: string) {
  return profileCosmetics.find((item) => item.id === cosmeticId);
}

export function activeCosmeticKey(type: string) {
  return activeCosmeticKeys[type as keyof typeof activeCosmeticKeys];
}
