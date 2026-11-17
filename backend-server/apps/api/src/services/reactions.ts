import { legacyReactionTypes } from "@yugm/shared";
import { RoomReaction, type RoomReactionDocument } from "../models/RoomReaction.js";

export const legacyReactionLabels: Record<string, string> = {
  heart: "Heart",
  fire: "Fire",
  laugh: "Laugh",
  clap: "Clap",
  wow: "Wow",
  crown: "Crown",
  stars: "Stars",
  party: "Party"
};

let defaultsPromise: Promise<void> | null = null;

export interface PublicRoomReaction {
  id: string;
  label: string;
  assetUrl: string;
  assetKind: "STATIC" | "ANIMATED";
  access: "EVERYONE" | "VIP_EXCLUSIVE";
  sortOrder: number;
}

export function toPublicRoomReaction(reaction: Pick<RoomReactionDocument, "_id" | "label" | "assetUrl" | "assetKind" | "access" | "sortOrder">): PublicRoomReaction {
  return {
    id: String(reaction._id),
    label: reaction.label,
    assetUrl: reaction.assetUrl ?? "",
    assetKind: reaction.assetKind ?? "STATIC",
    access: reaction.access ?? "EVERYONE",
    sortOrder: reaction.sortOrder ?? 0
  };
}

export async function syncDefaultRoomReactions(): Promise<number> {
  const ops = legacyReactionTypes.map((id, index) => ({
    updateOne: {
      filter: { _id: id },
      update: {
        $setOnInsert: {
          label: legacyReactionLabels[id] ?? id,
          access: "EVERYONE" as const,
          isActive: true,
          sortOrder: index,
          assetKind: "STATIC" as const
        }
      },
      upsert: true
    }
  }));
  const result = await RoomReaction.bulkWrite(ops, { ordered: false });
  return result.upsertedCount ?? 0;
}

export function ensureDefaultRoomReactions(): Promise<void> {
  if (!defaultsPromise) {
    defaultsPromise = syncDefaultRoomReactions().then(() => undefined).catch((error) => {
      defaultsPromise = null;
      throw error;
    });
  }
  return defaultsPromise;
}

export async function listActiveRoomReactions(): Promise<PublicRoomReaction[]> {
  await ensureDefaultRoomReactions();
  const reactions = await RoomReaction.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1, _id: 1 }).lean();
  return reactions.map((reaction) => toPublicRoomReaction(reaction as any));
}

export async function findActiveRoomReaction(id: string) {
  await ensureDefaultRoomReactions();
  return RoomReaction.findOne({ _id: id.trim().toLowerCase(), isActive: true }).lean();
}

export function isActiveVip(user: { vipExpiresAt?: Date | string | null } | null | undefined) {
  if (!user?.vipExpiresAt) return false;
  const expires = user.vipExpiresAt instanceof Date ? user.vipExpiresAt : new Date(user.vipExpiresAt);
  return Number.isFinite(expires.getTime()) && expires.getTime() > Date.now();
}

export function canUseRoomReaction(reaction: { access: "EVERYONE" | "VIP_EXCLUSIVE" }, user: { vipExpiresAt?: Date | string | null } | null | undefined) {
  return reaction.access !== "VIP_EXCLUSIVE" || isActiveVip(user);
}

export function normalizeReactionId(value: string) {
  return value.trim().toLowerCase();
}
