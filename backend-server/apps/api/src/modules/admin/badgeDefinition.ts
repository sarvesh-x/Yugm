import { z } from "zod";

export const badgeTiers = ["BRONZE", "SILVER", "GOLD", "PLATINUM", "DIAMOND", "MASTER"] as const;
export type AchievementTier = typeof badgeTiers[number];
export const badgeMetrics = ["profile_complete", "daily_streak_3", "follow_10", "host_3", "gift_5", "chat_25", "level_5", "room_join_10", "game_plays_10", "gift_received_5"] as const;
export const honorMetrics = ["host_3", "gift_5", "gift_received_5"] as const;
export const badgeIcons = ["trophy", "sparkles", "flame", "users", "radio", "gift", "message-circle", "star", "headphones", "gamepad-2", "heart", "shield", "medal"] as const;

export const badgeId = z.string().trim().regex(/^[a-z0-9_-]{1,64}$/);
export const definitionSchema = z.object({
  id: badgeId,
  title: z.string().trim().min(1).max(60),
  description: z.string().trim().min(1).max(240),
  kind: z.enum(["ACHIEVEMENT", "HONOR"]),
  metric: z.enum(badgeMetrics),
  icon: z.enum(badgeIcons),
  order: z.number().int().min(0).max(10000),
  hidden: z.boolean().default(false),
  assetRef: z.string().max(64).optional(),
  removeImage: z.boolean().optional(),
  weeklyTarget: z.number().int().min(1).max(1_000_000).optional(),
  tiers: z.array(z.object({
    tier: z.enum(badgeTiers),
    target: z.number().int().min(1).max(1_000_000),
    rewardCoins: z.number().int().min(0).max(1_000_000),
    rewardCosmetic: z.string().max(64).optional()
  })).max(badgeTiers.length)
}).superRefine((definition, ctx) => {
  if (definition.kind === "HONOR") {
    if (!definition.weeklyTarget || !honorMetrics.some(metric => metric === definition.metric) || definition.tiers.length) {
      ctx.addIssue({ code: "custom", message: "Honor badges need a weekly hosting or gifting target and no tiers." });
    }
  } else if (!definition.tiers.length || definition.weeklyTarget || definition.tiers.some((tier, index, tiers) =>
    tier.tier !== badgeTiers[index] || (index > 0 && tier.target <= tiers[index - 1].target))) {
    ctx.addIssue({ code: "custom", message: "Achievement tiers must start at Bronze and have strictly increasing targets." });
  }
});
