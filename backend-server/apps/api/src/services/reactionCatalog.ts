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

export const additionalDefaultReactions = [
  { id: "wave", label: "Wave", emoji: "👋", access: "EVERYONE" },
  { id: "wink", label: "Wink", emoji: "😉", access: "EVERYONE" },
  { id: "cool", label: "Cool", emoji: "😎", access: "EVERYONE" },
  { id: "heart_eyes", label: "Heart eyes", emoji: "😍", access: "EVERYONE" },
  { id: "vip_diamond", label: "Diamond", emoji: "💎", access: "VIP_EXCLUSIVE" },
  { id: "vip_fireworks", label: "Fireworks", emoji: "🎆", access: "VIP_EXCLUSIVE" },
  { id: "vip_comet", label: "Comet", emoji: "☄️", access: "VIP_EXCLUSIVE" },
  { id: "vip_heart", label: "Sparkling heart", emoji: "💖", access: "VIP_EXCLUSIVE" }
] as const;

export interface ReactionVipUser {
  vipExpiresAt?: Date | string | null;
  vipTier?: string | null;
  vipLevel?: number;
  vipFrozen?: boolean;
}

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
  reaction: {
    _id: unknown; label: string; emoji?: string | null; assetUrl?: string | null;
    assetKind?: PublicRoomReaction["assetKind"]; access?: PublicRoomReaction["access"]; sortOrder?: number;
  },
  user?: ReactionVipUser | null
): PublicRoomReaction {
  const access = reaction.access ?? "EVERYONE";
  const usable = canUseRoomReaction({ access }, user);
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

export function isActiveVip(user?: ReactionVipUser | null) {
  return getVipStatus(user).vipLevel >= 3;
}

export function canUseRoomReaction(reaction: { access: PublicRoomReaction["access"] }, user?: ReactionVipUser | null) {
  return reaction.access !== "VIP_EXCLUSIVE" || isActiveVip(user);
}

export function normalizeReactionId(value: string) {
  return value.trim().toLowerCase();
}
