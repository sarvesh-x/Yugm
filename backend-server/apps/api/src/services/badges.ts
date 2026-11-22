import mongoose from "mongoose";
import { Achievement, ACHIEVEMENT_TIER_ORDER, type AchievementTier, type IAchievement } from "../models/Achievement.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Room } from "../models/Room.js";
import { User, type IUser } from "../models/User.js";
import { findPublishedAssetsByIds, type PublicAsset } from "./assets.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export const maxWornBadges = 5;
const weekMs = 7 * 86400_000;
type Definition = Pick<IAchievement, "id" | "title" | "description" | "category" | "kind" | "icon" | "imageUrl" | "assetRef" | "metric" | "weeklyTarget" | "tiers" | "order">;
/** Read-time asset projection; the registry remains the source of truth for URLs. */
export type BadgeArtAsset = Pick<PublicAsset, "id" | "version" | "publicUrl" | "variants">;
export type BadgeDefinition = Definition & { asset?: BadgeArtAsset };
type Grant = IUser["badgeGrants"][number];
type BadgeUser = Pick<IUser, "badgeGrants" | "showcasedBadgeIds" | "badgeRevision" | "claimedAchievementTiers" | "claimedAchievementIds">;

export function weeklyHonorWindow(now: Date) {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - now.getUTCDay()));
  return { from: new Date(start.getTime() - weekMs), start, expiresAt: new Date(start.getTime() + weekMs) };
}

/** Load the visible badge catalogue, batch-resolving published art by asset id. */
export async function badgeCatalog(): Promise<BadgeDefinition[]> {
  const definitions = await Achievement.find({ hidden: { $ne: true } }).sort({ order: 1, id: 1 }).lean().exec();
  const assets = await findPublishedAssetsByIds(definitions.map(def => def.assetRef ?? ""));
  return definitions.map(def => {
    const asset = def.assetRef ? assets.get(def.assetRef) : undefined;
    return {
      ...def,
      ...(asset ? {
        asset: {
          id: asset.id,
          version: asset.version,
          ...(asset.publicUrl ? { publicUrl: asset.publicUrl } : {}),
          variants: asset.variants
        }
      } : {})
    } as BadgeDefinition;
  });
}

function tierRank(tier?: string) {
  return ACHIEVEMENT_TIER_ORDER[tier as AchievementTier] ?? -1;
}

function grantsFor(user: BadgeUser, definitions: Definition[]) {
  const grants = new Map((user.badgeGrants ?? []).map(grant => [grant.badgeId, grant]));
  for (const claim of user.claimedAchievementTiers ?? []) {
    const existing = grants.get(claim.achievementId);
    if (tierRank(claim.tier) > tierRank(existing?.tier)) {
      grants.set(claim.achievementId, { badgeId: claim.achievementId, tier: claim.tier, earnedAt: existing?.earnedAt ?? claim.claimedAt });
    }
  }
  for (const id of user.claimedAchievementIds ?? []) {
    const tier = definitions.find(def => def.id === id && def.kind !== "HONOR")?.tiers[0]?.tier;
    if (tier && !grants.has(id)) grants.set(id, { badgeId: id, tier, earnedAt: new Date(0) });
  }
  return grants;
}

function owned(definition: Definition, grant: Grant | undefined, now: Date) {
  if (!grant) return false;
  return definition.kind === "HONOR"
    ? !!grant.expiresAt && grant.expiresAt > now
    : tierRank(grant.tier) >= 0 && !grant.expiresAt;
}

/**
 * Managed art wins over the legacy badge `imageUrl`; an unpublished or missing
 * asset silently falls back. Variants come only from the registry, never from
 * the badge document, so published URLs stay immutable.
 */
export function badgePublicArt(definition: Pick<BadgeDefinition, "imageUrl" | "asset">) {
  const asset = definition.asset;
  const imageUrl = asset?.publicUrl
    ?? asset?.variants.find((variant) => variant.name === "full")?.url
    ?? definition.imageUrl
    ?? "";
  return {
    imageUrl,
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

export function publicBadge(definition: BadgeDefinition, grant: Grant | undefined, now: Date) {
  const unlocked = owned(definition, grant, now);
  return {
    id: definition.id, title: definition.title, description: definition.description, icon: definition.icon,
    kind: definition.kind ?? "ACHIEVEMENT", category: definition.category, ...badgePublicArt(definition),
    unlocked, tier: unlocked ? grant?.tier ?? null : null, expiresAt: unlocked ? grant?.expiresAt : undefined,
    weeklyTarget: definition.weeklyTarget
  };
}

export function wornBadges(user: BadgeUser, definitions: BadgeDefinition[], now = new Date()) {
  const grants = grantsFor(user, definitions);
  const byId = new Map(definitions.map(def => [def.id, def]));
  return [...new Set(user.showcasedBadgeIds ?? [])].flatMap(id => {
    const definition = byId.get(id);
    const grant = grants.get(id);
    return definition && owned(definition, grant, now) ? [publicBadge(definition, grant, now)] : [];
  }).slice(0, maxWornBadges);
}

export async function syncBadgeState(
  userId: string,
  definitions: BadgeDefinition[],
  earned: Grant[],
  now: Date,
  selection?: string[]
) {
  for (let attempt = 0; attempt < 6; attempt++) {
    const user = await User.findById(userId).select("badgeGrants badgeRevision showcasedBadgeIds claimedAchievementTiers claimedAchievementIds").lean();
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    const grants = grantsFor(user, definitions);
    const newIds: string[] = [];
    for (const incoming of earned) {
      const previous = grants.get(incoming.badgeId);
      if (incoming.expiresAt) {
        if (previous?.expiresAt && previous.expiresAt >= incoming.expiresAt) continue;
        if (!previous?.expiresAt || previous.expiresAt <= now) newIds.push(incoming.badgeId);
      } else {
        if (tierRank(previous?.tier) >= tierRank(incoming.tier)) continue;
        if (!previous) newIds.push(incoming.badgeId);
      }
      grants.set(incoming.badgeId, { ...incoming, earnedAt: incoming.expiresAt ? incoming.earnedAt : previous?.earnedAt ?? incoming.earnedAt });
    }
    const nextGrants = [...grants.values()];
    const available = new Set(definitions.filter(def => owned(def, grants.get(def.id), now)).map(def => def.id));
    if (selection?.some(id => !available.has(id))) {
      throw new HttpError(400, "Only earned, active badges can be worn", ErrorCode.VALIDATION);
    }
    const wornIds = selection ?? [...new Set([...(user.showcasedBadgeIds ?? []), ...newIds])].filter(id => available.has(id)).slice(0, maxWornBadges);
    if (JSON.stringify(user.badgeGrants ?? []) !== JSON.stringify(nextGrants) ||
        JSON.stringify(user.showcasedBadgeIds ?? []) !== JSON.stringify(wornIds)) {
      const write = await User.updateOne(
        { _id: userId, badgeRevision: user.badgeRevision ?? null },
        { $set: { badgeGrants: nextGrants, showcasedBadgeIds: wornIds }, $inc: { badgeRevision: 1 } }
      );
      if (!write.matchedCount) continue;
    }
    return {
      wornIds,
      badges: definitions.map(def => publicBadge(def, grants.get(def.id), now))
    };
  }
  throw new HttpError(409, "Your badges changed. Refresh and try again.", ErrorCode.CONFLICT);
}

function honorActivity(def: Definition, window: ReturnType<typeof weeklyHonorWindow>) {
  if (!def.weeklyTarget) return null;
  const timeRange = { $gte: window.from, $lt: window.start };
  if (def.metric === "host_3") return { collection: Room.collection, field: "hostId", filter: { startedAt: timeRange } };
  if (def.metric === "gift_5" || def.metric === "gift_received_5") {
    return { collection: GiftTransaction.collection, field: def.metric === "gift_5" ? "senderId" : "receiverId", filter: {
      createdAt: timeRange, type: { $in: ["send", "combo", "room_wide"] }
    } };
  }
  return null;
}

function honorGrant(def: Definition, window: ReturnType<typeof weeklyHonorWindow>): Grant {
  return { badgeId: def.id, earnedAt: window.start, expiresAt: window.expiresAt };
}

export async function currentHonors(userId: string, definitions: Definition[], now: Date) {
  const window = weeklyHonorWindow(now);
  const user = new mongoose.Types.ObjectId(userId);
  const honors = await Promise.all(definitions.filter(def => def.kind === "HONOR").map(async def => {
    const activity = honorActivity(def, window);
    if (!activity) return null;
    const count = await activity.collection.countDocuments({ ...activity.filter, [activity.field]: user }, { limit: def.weeklyTarget });
    return count >= def.weeklyTarget! ? honorGrant(def, window) : null;
  }));
  return honors.filter((grant): grant is Grant => grant !== null);
}

export async function awardWeeklyHonors(now = new Date()) {
  const window = weeklyHonorWindow(now);
  const runs = mongoose.connection.collection<{ _id: string; completedAt: Date }>("badge_honor_runs");
  const definitions = await badgeCatalog();
  for (const def of definitions.filter(item => item.kind === "HONOR")) {
    const activity = honorActivity(def, window);
    if (!activity) continue;
    const runId = `${window.start.toISOString()}:${def.id}:${def.metric}:${def.weeklyTarget}`;
    if (await runs.findOne({ _id: runId })) continue;
    const candidates = activity.collection.aggregate<{ _id: mongoose.Types.ObjectId }>([
      { $match: activity.filter },
      { $group: { _id: `$${activity.field}`, count: { $sum: 1 } } },
      { $match: { count: { $gte: def.weeklyTarget } } }
    ]);
    for await (const candidate of candidates) {
      if (!candidate._id) continue;
      await syncBadgeState(candidate._id.toString(), definitions, [honorGrant(def, window)], now)
        .catch(error => { if (!(error instanceof HttpError) || error.status !== 404) throw error; });
    }
    await runs.updateOne({ _id: runId }, { $setOnInsert: { completedAt: now } }, { upsert: true });
  }
}
