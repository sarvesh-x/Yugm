import { z } from "zod";

const cosmeticTypes = [
  "AVATAR_ASSET", "AVATAR_FRAME", "SPEAKING_WAVE", "PROFILE_THEME",
  "ENTRANCE_EFFECT", "PROFILE_BADGE", "NAME_STYLE", "ROOM_ENTRY",
  "MOOD_STATUS", "PROFILE_MUSIC", "VOICE_BADGE", "ROOM_THEME",
  "AVATAR_DECORATION", "REACTION_PACK", "PROFILE_LAYOUT", "PROFILE_BANNER", "INTRO_CARD",
  "COLLECTIBLE_TITLE", "GIFT_SHELF", "CHAT_BUBBLE", "SEASONAL_EVENT",
  "CALL_SCREEN", "ROOM_BADGE", "ROOM_AMBIENCE"
] as const;

export const createCosmeticSchema = z.object({
  id: z.string().min(2).max(64),
  type: z.enum(cosmeticTypes),
  name: z.string().min(2).max(80),
  coinPrice: z.number().int().min(0),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).default("COMMON"),
  preview: z.string().max(120).default(""),
  isActive: z.boolean().default(true),
  assetKind: z.string().max(20).optional(),
  assetUrl: z.string().max(500).optional(),
  assetRef: z.string().max(64).optional()
});

export const updateCosmeticSchema = z.object({
  type: z.enum(cosmeticTypes).optional(),
  name: z.string().min(2).max(80).optional(),
  coinPrice: z.number().int().min(0).optional(),
  rarity: z.enum(["COMMON", "RARE", "EPIC", "LEGENDARY"]).optional(),
  preview: z.string().max(120).optional(),
  isActive: z.boolean().optional(),
  assetKind: z.string().max(20).optional(),
  assetUrl: z.string().max(500).optional(),
  assetRef: z.string().max(64).optional()
});
