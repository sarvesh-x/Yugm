import { env } from "../config/env.js";
import { Gift } from "../models/Gift.js";
import { Cosmetic } from "../models/Cosmetic.js";
import { bondConfigValues, bondRewardItems, giftSeeds } from "./bondRulesCore.js";

export {
  anniversaryLeadMs, bondDefaults, bondKinds, bondLevel, bondLevels, bondRewardItems, dayMs,
  milestones, nextAnniversary, rankingPeriod, rankingWindows, weeklyPeriod
} from "./bondRulesCore.js";
export type { BondKind, RankingWindow } from "./bondRulesCore.js";

export const bondConfig = {
  get capacity() { return env.YUGM_BOND_SLOTS; },
  ...bondConfigValues
};

let seedPromise: Promise<void> | undefined;
export function ensureBondCatalog() {
  seedPromise ??= (async () => {
    await Gift.bulkWrite(giftSeeds.map(gift => ({
      updateOne: { filter: { name: gift.name }, update: { $setOnInsert: { ...gift, category: "bonds" as const, isActive: true } }, upsert: true }
    })), { ordered: false });
    await Cosmetic.bulkWrite([
      { _id: bondRewardItems.milestone, name: "Shared Memories", type: "PROFILE_BADGE", preview: "✦", rarity: "RARE" },
      { _id: bondRewardItems.weekly, name: "Bonds Champion", type: "AVATAR_FRAME", preview: "✧", rarity: "EPIC" }
    ].map(item => ({
      updateOne: { filter: { _id: item._id }, update: { $setOnInsert: { ...item, coinPrice: 0, isActive: true, rewardOnly: true } }, upsert: true }
    })), { ordered: false });
  })().catch(error => { seedPromise = undefined; throw error; });
  return seedPromise;
}

