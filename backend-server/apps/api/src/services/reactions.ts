import { legacyReactionTypes } from "@yugm/shared";
import { RoomReaction, type RoomReactionDocument } from "../models/RoomReaction.js";
import { getVipStatus } from "./vip.js";

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

export const legacyReactionEmojis: Record<string, string> = {
  heart: "❤️",
  fire: "🔥",
  laugh: "😂",
  clap: "👏",
  wow: "😮",
  crown: "👑",
  stars: "✨",
  party: "🎉"
};

let defaultsPromise: Promise<void> | null = null;

export interface PublicRoomReaction {
  id: string;
  label: string;
  emoji: string;
  assetUrl: string;
  assetKind: "STATIC" | "ANIMATED";
  access: "EVERYONE" | "VIP_EXCLUSIVE";
  sortOrder: number;
  usable: boolean;
  lockedReason: "VIP" | null;
}

export function toPublicRoomReaction(
  reaction: Pick<RoomReactionDocument, "_id" | "label" | "emoji" | "assetUrl" | "assetKind" | "access" | "sortOrder">,
  user?: { vipExpiresAt?: Date | string | null } | null
): PublicRoomReaction {
  const access = reaction.access ?? "EVERYONE";
  const usable = canUseRoomReaction({ access } as any, user ?? null);
  return {
    id: String(reaction._id),
    label: reaction.label,
    emoji: reaction.emoji ?? "",
    assetUrl: reaction.assetUrl ?? "",
    assetKind: reaction.assetKind ?? "STATIC",
    access,
    sortOrder: reaction.sortOrder ?? 0,
    usable,
    lockedReason: usable ? null : (access === "VIP_EXCLUSIVE" ? "VIP" : null)
  };
}

export async function syncDefaultRoomReactions(): Promise<number> {
  const ops = legacyReactionTypes.flatMap((id, index) => ([
    {
      updateOne: {
        filter: { _id: id },
        update: {
          $setOnInsert: {
            label: legacyReactionLabels[id] ?? id,
            emoji: legacyReactionEmojis[id] ?? "",
            access: "EVERYONE" as const,
            isActive: true,
            sortOrder: index,
            assetKind: "STATIC" as const
          }
        },
        upsert: true
      }
    },
    {
      updateOne: {
        filter: { _id: id, $or: [{ emoji: { $exists: false } }, { emoji: "" }, { emoji: null }] },
        update: { $set: { emoji: legacyReactionEmojis[id] ?? "" } }
      }
    }
  ]));
  const result = await RoomReaction.bulkWrite(ops as any, { ordered: false });
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

export async function listActiveRoomReactions(user?: { vipExpiresAt?: Date | string | null } | null): Promise<PublicRoomReaction[]> {
  await ensureDefaultRoomReactions();
  const reactions = await RoomReaction.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1, _id: 1 }).lean();
  return reactions.map((reaction) => toPublicRoomReaction(reaction as any, user ?? null));
}

export async function findActiveRoomReaction(id: string) {
  await ensureDefaultRoomReactions();
  return RoomReaction.findOne({ _id: id.trim().toLowerCase(), isActive: true }).lean();
}

export function isActiveVip(user: { vipExpiresAt?: Date | string | null; vipTier?: string | null; vipLevel?: number; vipExp?: number; vipFrozen?: boolean; vipFreezeStartedAt?: Date | string | null } | null | undefined) {
  return getVipStatus(user).vipLevel >= 3;
}

export function canUseRoomReaction(reaction: { access: "EVERYONE" | "VIP_EXCLUSIVE" }, user: { vipExpiresAt?: Date | string | null; vipTier?: string | null; vipLevel?: number; vipExp?: number; vipFrozen?: boolean; vipFreezeStartedAt?: Date | string | null } | null | undefined) {
  return reaction.access !== "VIP_EXCLUSIVE" || isActiveVip(user);
}

export function normalizeReactionId(value: string) {
  return value.trim().toLowerCase();
}
