import { legacyReactionTypes } from "@yugm/shared";
import { RoomReaction } from "../models/RoomReaction.js";
import {
  additionalDefaultReactions, legacyReactionEmojis, legacyReactionLabels, toPublicRoomReaction,
  type PublicRoomReaction, type ReactionVipUser
} from "./reactionCatalog.js";

export {
  canUseRoomReaction, isActiveVip, legacyReactionEmojis, legacyReactionLabels, normalizeReactionId,
  toPublicRoomReaction, type PublicRoomReaction
} from "./reactionCatalog.js";

let defaultsPromise: Promise<void> | null = null;

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
  const additionalOps = additionalDefaultReactions.map(({ id, label, emoji, access }, index) => ({
    updateOne: {
      filter: { _id: id },
      update: {
        $setOnInsert: {
          label, emoji, access,
          isActive: true,
          sortOrder: legacyReactionTypes.length + index,
          assetKind: "STATIC" as const
        }
      },
      upsert: true
    }
  }));
  const result = await RoomReaction.bulkWrite([...ops, ...additionalOps], { ordered: false });
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

export async function listActiveRoomReactions(user?: ReactionVipUser | null): Promise<PublicRoomReaction[]> {
  await ensureDefaultRoomReactions();
  const reactions = await RoomReaction.find({ isActive: true }).sort({ sortOrder: 1, createdAt: 1, _id: 1 }).lean();
  return reactions.map((reaction) => toPublicRoomReaction(reaction, user));
}

export async function findActiveRoomReaction(id: string) {
  await ensureDefaultRoomReactions();
  return RoomReaction.findOne({ _id: id.trim().toLowerCase(), isActive: true }).lean();
}
