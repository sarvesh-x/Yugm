import { profileCosmetics } from "@yugm/shared";
import { Cosmetic, type CosmeticDocument } from "../models/Cosmetic.js";

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
  PROFILE_BANNER: "profileBanner",
  INTRO_CARD: "introCard",
  COLLECTIBLE_TITLE: "collectibleTitle",
  GIFT_SHELF: "giftShelf",
  CHAT_BUBBLE: "chatBubble",
  SEASONAL_EVENT: "seasonalEvent",
  CALL_SCREEN: "videoCallOverlay",
  ROOM_BADGE: "roomBadge",
  ROOM_AMBIENCE: "roomAmbience"
} as const;

type RawCosmetic = Pick<
  CosmeticDocument,
  "type" | "name" | "coinPrice" | "rarity" | "preview" | "isActive" | "assetKind" | "assetUrl"
> & { _id: unknown };

export interface PublicCosmetic {
  id: string;
  type: string;
  name: string;
  coinPrice: number;
  rarity: string;
  preview: string;
  assetKind?: string;
  assetUrl?: string;
}

let defaultsPromise: Promise<void> | null = null;

export function toPublicCosmetic(cosmetic: RawCosmetic): PublicCosmetic {
  return {
    id: String(cosmetic._id),
    type: cosmetic.type,
    name: cosmetic.name,
    coinPrice: cosmetic.coinPrice,
    rarity: cosmetic.rarity,
    preview: cosmetic.preview ?? "",
    ...(cosmetic.assetKind ? { assetKind: cosmetic.assetKind } : {}),
    ...(cosmetic.assetUrl ? { assetUrl: cosmetic.assetUrl } : {})
  };
}

function defaultCosmeticUpdates() {
  return profileCosmetics.map((cosmetic) => ({
    updateOne: {
      filter: { _id: cosmetic.id },
      update: {
        $setOnInsert: {
          type: cosmetic.type,
          name: cosmetic.name,
          coinPrice: cosmetic.coinPrice,
          rarity: cosmetic.rarity,
          preview: cosmetic.preview,
          isActive: true,
          ...("assetKind" in cosmetic && cosmetic.assetKind ? { assetKind: cosmetic.assetKind } : {}),
          ...("assetUrl" in cosmetic && cosmetic.assetUrl ? { assetUrl: cosmetic.assetUrl } : {})
        }
      },
      upsert: true
    }
  }));
}

export async function syncDefaultCosmetics(): Promise<number> {
  const result = await Cosmetic.bulkWrite(defaultCosmeticUpdates(), { ordered: false });
  return result.upsertedCount ?? 0;
}

export function ensureDefaultCosmetics(): Promise<void> {
  if (!defaultsPromise) {
    defaultsPromise = syncDefaultCosmetics().then(() => undefined).catch((error) => {
      defaultsPromise = null;
      throw error;
    });
  }
  return defaultsPromise;
}

export async function findProfileCosmetic(cosmeticId: string) {
  if (!cosmeticId) return null;
  return Cosmetic.findById(cosmeticId).lean();
}

export async function listPublicCosmetics(): Promise<PublicCosmetic[]> {
  const cosmetics = await Cosmetic.find({ isActive: true })
    .sort({ type: 1, coinPrice: 1, name: 1 })
    .lean();
  return cosmetics.map((cosmetic) => toPublicCosmetic(cosmetic as unknown as RawCosmetic));
}

export async function listCosmeticsByIds(ids: string[]): Promise<PublicCosmetic[]> {
  if (ids.length === 0) return [];
  const cosmetics = await Cosmetic.find({ _id: { $in: ids } })
    .sort({ type: 1, coinPrice: 1, name: 1 })
    .lean();
  return cosmetics.map((cosmetic) => toPublicCosmetic(cosmetic as unknown as RawCosmetic));
}

export function activeCosmeticKey(type: string) {
  return activeCosmeticKeys[type as keyof typeof activeCosmeticKeys];
}
