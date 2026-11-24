import { profileCosmetics } from "@yugm/shared";
import { Cosmetic } from "../models/Cosmetic.js";
import { findPublishedAssetsByIds, type PublicAsset } from "./assets.js";

import { toPublicCosmetic, type RawCosmetic, type PublicCosmetic } from "./cosmeticPresentation.js";

export { activeCosmeticKey, toPublicCosmetic, type PublicAssetVariant, type PublicCosmetic } from "./cosmeticPresentation.js";

let defaultsPromise: Promise<void> | null = null;

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
