import type { CosmeticDocument } from "../models/Cosmetic.js";
import type { PublicAsset } from "./assets.js";

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

export type RawCosmetic = Pick<
  CosmeticDocument,
  "type" | "name" | "coinPrice" | "rarity" | "preview" | "isActive" | "assetKind" | "assetUrl" | "assetRef"
> & { _id: unknown };

export interface PublicAssetVariant {
  name: string;
  url: string;
  contentType: string;
  width?: number;
  height?: number;
}

export interface PublicCosmetic {
  id: string;
  type: string;
  name: string;
  coinPrice: number;
  rarity: string;
  preview: string;
  assetKind?: string;
  assetUrl?: string;
  /** Published AssetObject id, when the cosmetic uses managed art. */
  assetId?: string;
  assetVersion?: number;
  assetVariants?: PublicAssetVariant[];
}

/**
 * Map a catalogue document to its public DTO. A published managed asset wins;
 * the legacy `assetUrl` remains the compatibility fallback so older documents
 * and old clients keep working. The asset registry owns variants/version.
 */
export function toPublicCosmetic<Asset extends Pick<PublicAsset, "id" | "version" | "publicUrl" | "variants">>(
  cosmetic: RawCosmetic, asset?: Asset
): PublicCosmetic {
  const assetUrl = asset?.publicUrl
    ?? asset?.variants.find((variant) => variant.name === "full")?.url
    ?? cosmetic.assetUrl;
  return {
    id: String(cosmetic._id),
    type: cosmetic.type,
    name: cosmetic.name,
    coinPrice: cosmetic.coinPrice,
    rarity: cosmetic.rarity,
    preview: cosmetic.preview ?? "",
    ...(cosmetic.assetKind ? { assetKind: cosmetic.assetKind } : {}),
    ...(assetUrl ? { assetUrl } : {}),
    ...(asset ? {
      assetId: asset.id,
      assetVersion: asset.version,
      assetVariants: asset.variants.map((variant) => ({
        name: variant.name,
        url: variant.url,
        contentType: variant.contentType,
        ...(variant.width !== undefined ? { width: variant.width } : {}),
        ...(variant.height !== undefined ? { height: variant.height } : {})
      }))
    } : {})
  };
}

export function activeCosmeticKey(type: string) {
  return Object.hasOwn(activeCosmeticKeys, type) ? activeCosmeticKeys[type as keyof typeof activeCosmeticKeys] : undefined;
}
