import { profileCosmetics } from "@yugm/shared";
import { Cosmetic, type CosmeticDocument } from "../models/Cosmetic.js";
import { findPublishedAssetsByIds, type PublicAsset } from "./assets.js";

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

let defaultsPromise: Promise<void> | null = null;

/**
 * Map a catalogue document to its public DTO. A published managed asset wins;
 * the legacy `assetUrl` remains the compatibility fallback so older documents
 * and old clients keep working. The asset registry owns variants/version.
 */
export function toPublicCosmetic(cosmetic: RawCosmetic, asset?: PublicAsset): PublicCosmetic {
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

async function mapWithResolvedAssets(cosmetics: RawCosmetic[]): Promise<PublicCosmetic[]> {
  const assets = await findPublishedAssetsByIds(cosmetics.map((cosmetic) => cosmetic.assetRef ?? ""));
  return cosmetics.map((cosmetic) => toPublicCosmetic(
    cosmetic,
    cosmetic.assetRef ? assets.get(cosmetic.assetRef) : undefined
  ));
}

export async function listPublicCosmetics(ownedIds: string[] = []): Promise<PublicCosmetic[]> {
  const cosmetics = await Cosmetic.find({ isActive: true, $or: [{ rewardOnly: { $ne: true } }, { _id: { $in: ownedIds } }] })
    .sort({ type: 1, coinPrice: 1, name: 1 })
    .lean();
  return mapWithResolvedAssets(cosmetics as unknown as RawCosmetic[]);
}

export async function listCosmeticsByIds(ids: string[]): Promise<PublicCosmetic[]> {
  if (ids.length === 0) return [];
  const cosmetics = await Cosmetic.find({ _id: { $in: ids } })
    .sort({ type: 1, coinPrice: 1, name: 1 })
    .lean();
  return mapWithResolvedAssets(cosmetics as unknown as RawCosmetic[]);
}

/** Single-cosmetic variant of the list mappers, for purchase responses. */
export async function toPublicCosmeticWithAsset(cosmetic: RawCosmetic): Promise<PublicCosmetic> {
  const assets = await findPublishedAssetsByIds(cosmetic.assetRef ? [cosmetic.assetRef] : []);
  return toPublicCosmetic(cosmetic, cosmetic.assetRef ? assets.get(cosmetic.assetRef) : undefined);
}

export function activeCosmeticKey(type: string) {
  return activeCosmeticKeys[type as keyof typeof activeCosmeticKeys];
}
