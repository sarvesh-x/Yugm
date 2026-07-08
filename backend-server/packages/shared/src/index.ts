import { z } from "zod";

export const appName = "Yugm";
export const tagline = "Match the vibe.";

export const roles = ["USER", "HOST", "MODERATOR", "ADMIN"] as const;
export const roomTypes = ["VOICE", "VIDEO"] as const;
export const roomStatuses = ["LIVE", "ENDED", "SCHEDULED"] as const;
export const roomVisibilities = ["PUBLIC", "PRIVATE"] as const;
export const roomParticipantRoles = ["HOST", "SPEAKER", "AUDIENCE", "MODERATOR"] as const;
export const reactionTypes = ["heart", "fire", "laugh", "clap", "wow"] as const;

export type UserRole = (typeof roles)[number];
export type RoomType = (typeof roomTypes)[number];
export type RoomStatus = (typeof roomStatuses)[number];
export type RoomVisibility = (typeof roomVisibilities)[number];
export type RoomParticipantRole = (typeof roomParticipantRoles)[number];
export type ReactionType = (typeof reactionTypes)[number];

export const socketEvents = {
  roomJoin: "room:join",
  roomLeave: "room:leave",
  roomParticipantUpdate: "room:participant:update",
  roomChatMessage: "room:chat:message",
  roomGiftSend: "room:gift:send",
  roomReactionSend: "room:reaction:send",
  roomActivityNew: "room:activity:new",
  roomPollNew: "room:poll:new",
  roomPollVote: "room:poll:vote",
  roomSpeakerRequest: "room:speaker:request",
  roomSpeakerApprove: "room:speaker:approve",
  roomSpeakerReject: "room:speaker:reject",
  roomUserMute: "room:user:mute",
  roomUserRemove: "room:user:remove",
  roomEnded: "room:ended",
  userOnline: "user:online",
  userOffline: "user:offline",
  notificationNew: "notification:new"
} as const;

export const giftCatalogSeed = [
  { name: "Rose", icon: "rose", coinPrice: 10 },
  { name: "Diya", icon: "diya", coinPrice: 50 },
  { name: "Lotus", icon: "lotus", coinPrice: 100 },
  { name: "Crown", icon: "crown", coinPrice: 500 },
  { name: "Astra", icon: "astra", coinPrice: 1000 }
] as const;

export const coinPacks = [
  { id: "coins_290", coinAmount: 290, priceInr: 29, googleProductId: "yugm_coins_290" },
  { id: "coins_490", coinAmount: 490, priceInr: 49, googleProductId: "yugm_coins_490" },
  { id: "coins_990", coinAmount: 990, priceInr: 99, googleProductId: "yugm_coins_990" },
  { id: "coins_1990", coinAmount: 1990, priceInr: 199, googleProductId: "yugm_coins_1990" },
  { id: "coins_4990", coinAmount: 4990, priceInr: 499, googleProductId: "yugm_coins_4990" },
  { id: "coins_9990", coinAmount: 9990, priceInr: 999, googleProductId: "yugm_coins_9990" },
  { id: "coins_24990", coinAmount: 24990, priceInr: 2499, googleProductId: "yugm_coins_24990" }
] as const;

export const profileCosmetics = [
  { id: "avatar_nova_static", type: "AVATAR_ASSET", name: "Nova Static Avatar", coinPrice: 299, rarity: "RARE", preview: "avatar_nova", assetKind: "STATIC", assetUrl: "https://api.dicebear.com/9.x/adventurer/png?seed=YugmNova&backgroundColor=ffd5dc" },
  { id: "avatar_pixel_gif", type: "AVATAR_ASSET", name: "Pixel Loop Avatar", coinPrice: 599, rarity: "EPIC", preview: "avatar_pixel_loop", assetKind: "ANIMATED", assetUrl: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif" },
  { id: "avatar_cosmic_gif", type: "AVATAR_ASSET", name: "Cosmic Pulse Avatar", coinPrice: 999, rarity: "LEGENDARY", preview: "avatar_cosmic_loop", assetKind: "ANIMATED", assetUrl: "https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif" },
  { id: "frame_gold", type: "AVATAR_FRAME", name: "Golden Ring", coinPrice: 399, rarity: "RARE", preview: "gold" },
  { id: "frame_neon", type: "AVATAR_FRAME", name: "Neon Pulse", coinPrice: 699, rarity: "EPIC", preview: "neon" },
  { id: "frame_crystal", type: "AVATAR_FRAME", name: "Crystal Halo", coinPrice: 899, rarity: "EPIC", preview: "crystal" },
  { id: "frame_royal", type: "AVATAR_FRAME", name: "Royal Crown Frame", coinPrice: 1299, rarity: "LEGENDARY", preview: "royal" },
  { id: "wave_soft", type: "SPEAKING_WAVE", name: "Soft Voice Wave", coinPrice: 249, rarity: "RARE", preview: "wave_soft" },
  { id: "wave_neon", type: "SPEAKING_WAVE", name: "Neon Speaker Wave", coinPrice: 699, rarity: "EPIC", preview: "wave_neon" },
  { id: "wave_royal", type: "SPEAKING_WAVE", name: "Royal Broadcast Wave", coinPrice: 999, rarity: "LEGENDARY", preview: "wave_royal" },
  { id: "theme_midnight", type: "PROFILE_THEME", name: "Midnight Glow", coinPrice: 499, rarity: "RARE", preview: "midnight" },
  { id: "theme_saffron", type: "PROFILE_THEME", name: "Saffron Wave", coinPrice: 799, rarity: "EPIC", preview: "saffron" },
  { id: "theme_aurora", type: "PROFILE_THEME", name: "Aurora Glass", coinPrice: 999, rarity: "EPIC", preview: "aurora" },
  { id: "entrance_spark", type: "ENTRANCE_EFFECT", name: "Spark Entrance", coinPrice: 599, rarity: "RARE", preview: "spark" },
  { id: "entrance_crown", type: "ENTRANCE_EFFECT", name: "Crown Drop", coinPrice: 999, rarity: "LEGENDARY", preview: "crown" },
  { id: "entrance_meteor", type: "ENTRANCE_EFFECT", name: "Meteor Arrival", coinPrice: 1299, rarity: "LEGENDARY", preview: "meteor" },
  { id: "badge_early_host", type: "PROFILE_BADGE", name: "Early Host Badge", coinPrice: 199, rarity: "COMMON", preview: "Early Host" },
  { id: "badge_voice_star", type: "PROFILE_BADGE", name: "Voice Star Badge", coinPrice: 499, rarity: "RARE", preview: "Voice Star" },
  { id: "badge_top_gifter", type: "PROFILE_BADGE", name: "Top Gifter Badge", coinPrice: 799, rarity: "EPIC", preview: "Top Gifter" },
  { id: "name_gold_shimmer", type: "NAME_STYLE", name: "Gold Shimmer Name", coinPrice: 599, rarity: "RARE", preview: "gold" },
  { id: "name_neon_glow", type: "NAME_STYLE", name: "Neon Glow Name", coinPrice: 899, rarity: "EPIC", preview: "neon" },
  { id: "name_rainbow_pulse", type: "NAME_STYLE", name: "Rainbow Pulse Name", coinPrice: 1299, rarity: "LEGENDARY", preview: "rainbow" },
  { id: "room_entry_confetti", type: "ROOM_ENTRY", name: "Confetti Room Entry", coinPrice: 499, rarity: "RARE", preview: "confetti" },
  { id: "room_entry_spotlight", type: "ROOM_ENTRY", name: "Spotlight Room Entry", coinPrice: 899, rarity: "EPIC", preview: "spotlight" },
  { id: "mood_chill", type: "MOOD_STATUS", name: "Chill Mood", coinPrice: 99, rarity: "COMMON", preview: "Chill" },
  { id: "mood_open_talk", type: "MOOD_STATUS", name: "Open To Talk", coinPrice: 99, rarity: "COMMON", preview: "Open to talk" },
  { id: "mood_late_night", type: "MOOD_STATUS", name: "Late Night Vibes", coinPrice: 199, rarity: "RARE", preview: "Late night" },
  { id: "music_lofi_intro", type: "PROFILE_MUSIC", name: "Lo-fi Profile Intro", coinPrice: 399, rarity: "RARE", preview: "lofi" },
  { id: "music_bollywood_pop", type: "PROFILE_MUSIC", name: "Bollywood Pop Intro", coinPrice: 499, rarity: "RARE", preview: "pop" },
  { id: "voice_equalizer", type: "VOICE_BADGE", name: "Equalizer Voice Badge", coinPrice: 499, rarity: "RARE", preview: "equalizer" },
  { id: "voice_host_spotlight", type: "VOICE_BADGE", name: "Host Spotlight Badge", coinPrice: 999, rarity: "EPIC", preview: "spotlight" },
  { id: "room_theme_neon_club", type: "ROOM_THEME", name: "Neon Club Room", coinPrice: 899, rarity: "EPIC", preview: "neon_club" },
  { id: "room_theme_festive", type: "ROOM_THEME", name: "Festive Room", coinPrice: 699, rarity: "RARE", preview: "festive" },
  { id: "decor_crown", type: "AVATAR_DECORATION", name: "Mini Crown Decoration", coinPrice: 399, rarity: "RARE", preview: "crown" },
  { id: "decor_stars", type: "AVATAR_DECORATION", name: "Star Stickers", coinPrice: 299, rarity: "COMMON", preview: "stars" },
  { id: "reaction_hearts", type: "REACTION_PACK", name: "Heartstorm Reactions", coinPrice: 299, rarity: "COMMON", preview: "hearts" },
  { id: "reaction_festival", type: "REACTION_PACK", name: "Festival Reactions", coinPrice: 599, rarity: "RARE", preview: "festival" },
  { id: "layout_creator", type: "PROFILE_LAYOUT", name: "Creator Profile Layout", coinPrice: 499, rarity: "RARE", preview: "creator" },
  { id: "layout_vip_luxe", type: "PROFILE_LAYOUT", name: "VIP Luxe Layout", coinPrice: 999, rarity: "EPIC", preview: "vip_luxe" },
  { id: "intro_ask_me", type: "INTRO_CARD", name: "Ask Me About Card", coinPrice: 199, rarity: "COMMON", preview: "Ask me about music, memes, and late-night rooms." },
  { id: "intro_my_vibe", type: "INTRO_CARD", name: "My Vibe Card", coinPrice: 199, rarity: "COMMON", preview: "My vibe is warm chaos and good playlists." },
  { id: "title_night_owl", type: "COLLECTIBLE_TITLE", name: "Night Owl Title", coinPrice: 249, rarity: "COMMON", preview: "Night Owl" },
  { id: "title_room_royalty", type: "COLLECTIBLE_TITLE", name: "Room Royalty Title", coinPrice: 899, rarity: "EPIC", preview: "Room Royalty" },
  { id: "shelf_rose_wall", type: "GIFT_SHELF", name: "Rose Wall Gift Shelf", coinPrice: 499, rarity: "RARE", preview: "Rose Wall" },
  { id: "shelf_crown_case", type: "GIFT_SHELF", name: "Crown Case Gift Shelf", coinPrice: 999, rarity: "EPIC", preview: "Crown Case" },
  { id: "bubble_gold", type: "CHAT_BUBBLE", name: "Gold Chat Bubbles", coinPrice: 299, rarity: "COMMON", preview: "gold" },
  { id: "bubble_neon", type: "CHAT_BUBBLE", name: "Neon Chat Bubbles", coinPrice: 599, rarity: "RARE", preview: "neon" },
  { id: "season_holi", type: "SEASONAL_EVENT", name: "Holi Color Pack", coinPrice: 799, rarity: "EPIC", preview: "holi" },
  { id: "season_diwali", type: "SEASONAL_EVENT", name: "Diwali Glow Pack", coinPrice: 799, rarity: "EPIC", preview: "diwali" }
] as const;

export const profileCosmeticIds = profileCosmetics.map((item) => item.id) as [typeof profileCosmetics[number]["id"], ...typeof profileCosmetics[number]["id"][]];
export const profileCosmeticTypes = [
  "AVATAR_ASSET",
  "AVATAR_FRAME",
  "SPEAKING_WAVE",
  "PROFILE_THEME",
  "ENTRANCE_EFFECT",
  "PROFILE_BADGE",
  "NAME_STYLE",
  "ROOM_ENTRY",
  "MOOD_STATUS",
  "PROFILE_MUSIC",
  "VOICE_BADGE",
  "ROOM_THEME",
  "AVATAR_DECORATION",
  "REACTION_PACK",
  "PROFILE_LAYOUT",
  "INTRO_CARD",
  "COLLECTIBLE_TITLE",
  "GIFT_SHELF",
  "CHAT_BUBBLE",
  "SEASONAL_EVENT"
] as const;
export const moderationActionTypes = ["WARN", "MUTE", "SUSPEND", "BAN", "UNBAN"] as const;

export const levelMilestones = [
  { level: 1, requiredXp: 0, title: "New Vibe", coinReward: 0 },
  { level: 2, requiredXp: 100, title: "Rising Vibe", coinReward: 25 },
  { level: 3, requiredXp: 250, title: "Room Regular", coinReward: 50 },
  { level: 4, requiredXp: 500, title: "Vibe Maker", coinReward: 75 },
  { level: 5, requiredXp: 900, title: "Yugm Star", coinReward: 100 },
  { level: 6, requiredXp: 1400, title: "Crowd Puller", coinReward: 150 },
  { level: 7, requiredXp: 2100, title: "Gift Magnet", coinReward: 200 },
  { level: 8, requiredXp: 3000, title: "Prime Host", coinReward: 250 },
  { level: 9, requiredXp: 4200, title: "Vibe Icon", coinReward: 350 },
  { level: 10, requiredXp: 6000, title: "Yugm Legend", coinReward: 500 }
] as const;

export const xpEvents = {
  PROFILE_COMPLETE: 80,
  DAILY_CHECKIN: 25,
  ROOM_CREATE: 40,
  ROOM_JOIN: 10,
  CHAT_MESSAGE: 5,
  GIFT_SENT: 15,
  GIFT_RECEIVED: 10,
  VIP_PURCHASE: 100,
  COSMETIC_PURCHASE: 60,
  FOLLOW_USER: 10
} as const;

export type XpEvent = keyof typeof xpEvents;

export const relationshipLevelMilestones = [
  { level: 1, requiredXp: 0, title: "First Spark", perk: "Bond badge" },
  { level: 2, requiredXp: 50, title: "Good Vibes", perk: "Chat bond meter" },
  { level: 3, requiredXp: 150, title: "Warm Bond", perk: "Duo profile tag" },
  { level: 4, requiredXp: 350, title: "Close Connection", perk: "Priority match reminder" },
  { level: 5, requiredXp: 700, title: "Yugm Duo", perk: "Special chat glow" },
  { level: 6, requiredXp: 1200, title: "Trusted Pair", perk: "Duo streak badge" },
  { level: 7, requiredXp: 2000, title: "Deep Match", perk: "Premium duo frame" },
  { level: 8, requiredXp: 3200, title: "Unbreakable Vibe", perk: "Legendary duo badge" }
] as const;

export const relationshipXpEvents = {
  MATCH_CREATED: 50,
  SUPER_LIKE_MATCH: 75,
  MESSAGE_SENT: 8,
  ROOM_DM_SENT: 8,
  GIFT_SENT: 25
} as const;

export type RelationshipXpEvent = keyof typeof relationshipXpEvents;

export const walletSourceLabels = {
  RECHARGE: "Recharge",
  GIFT_SENT: "Gift sent",
  GIFT_RECEIVED: "Gift received",
  GIFT_SENT_DM: "Direct gift sent",
  GIFT_RECEIVED_DM: "Direct gift received",
  VIP_PURCHASE: "VIP membership",
  PROFILE_COSMETIC_PURCHASE: "Profile cosmetic",
  LEVEL_REWARD: "Level reward",
  ADMIN_ADJUSTMENT: "Admin adjustment",
  RAZORPAY_PURCHASE: "Razorpay recharge",
  GOOGLE_PLAY_PURCHASE: "Google Play recharge"
} as const;

export const vipPlans = [
  {
    id: "vip_7d",
    name: "VIP Weekly",
    durationDays: 7,
    coinPrice: 299,
    benefits: ["VIP badge", "Priority discovery", "Golden profile glow"]
  },
  {
    id: "vip_30d",
    name: "VIP Monthly",
    durationDays: 30,
    coinPrice: 999,
    benefits: ["VIP badge", "Priority discovery", "Golden profile glow", "Best value"]
  },
  {
    id: "vip_90d",
    name: "VIP Season",
    durationDays: 90,
    coinPrice: 2499,
    benefits: ["VIP badge", "Priority discovery", "Golden profile glow", "Longest boost"]
  }
] as const;

export const vipPlanIds = vipPlans.map((plan) => plan.id) as [typeof vipPlans[number]["id"], ...typeof vipPlans[number]["id"][]];

export const categories = [
  "Trending",
  "Nearby",
  "Voice",
  "Video",
  "Music",
  "Gaming",
  "Chill",
  "Dating",
  "Friends"
] as const;

const otpContactSchema = z.object({
  email: z.string().email().optional(),
  phone: z.string().min(8).max(16).optional()
});

export const requestOtpSchema = otpContactSchema.refine((value) => value.email || value.phone, "Email or phone is required");

export const verifyOtpSchema = otpContactSchema.extend({
  otp: z.string().min(4).max(8)
}).refine((value) => value.email || value.phone, "Email or phone is required");

export const profileSchema = z.object({
  name: z.string().min(2).max(60),
  username: z.string().min(3).max(24).regex(/^[a-z0-9_.]+$/i),
  gender: z.string().max(32).optional(),
  age: z.number().int().min(18).max(80).optional(),
  city: z.string().max(60).optional(),
  state: z.string().max(60).optional(),
  bio: z.string().max(180).optional(),
  vibeLine: z.string().max(120).optional(),
  interests: z.array(z.string().min(1).max(24)).default([]),
  hobbies: z.array(z.string().min(1).max(32)).max(16).default([]),
  languages: z.array(z.string().min(1).max(24)).default(["Hindi", "English"]),
  avatar: z.string().url().optional(),
  interestedIn: z.string().max(32).optional(),
  lookingFor: z.string().max(60).optional(),
  datingAgeMin: z.number().int().min(18).max(80).optional(),
  datingAgeMax: z.number().int().min(18).max(80).optional()
});

export const createRoomSchema = z.object({
  type: z.enum(roomTypes),
  title: z.string().min(3).max(80),
  description: z.string().max(240).optional(),
  tags: z.array(z.string().min(1).max(24)).max(8).default([]),
  language: z.string().min(2).max(32),
  category: z.string().min(2).max(32),
  maxSpeakers: z.number().int().min(1).max(12).default(6),
  visibility: z.enum(roomVisibilities).default("PUBLIC"),
  coverImage: z.string().optional(),
  allowAudienceMicRequests: z.boolean().default(true),
  scheduledFor: z.string().datetime().optional()
});

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(500)
});

export const reportSchema = z.object({
  targetUserId: z.string().optional(),
  roomId: z.string().optional(),
  reason: z.string().min(2).max(80),
  description: z.string().max(500).optional()
});

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const sendGiftSchema = z.object({
  giftId: z.string().regex(objectIdPattern, "Invalid giftId format"),
  receiverId: z.string().regex(objectIdPattern, "Invalid receiverId format")
});

export const createPurchaseOrderSchema = z.object({
  packId: z.string(),
  provider: z.enum(["RAZORPAY", "GOOGLE_PLAY"])
});

export const purchaseVipSchema = z.object({
  planId: z.enum(vipPlanIds)
});

export const purchaseProfileCosmeticSchema = z.object({
  cosmeticId: z.enum(profileCosmeticIds)
});

export const equipProfileCosmeticSchema = z.object({
  cosmeticId: z.enum(profileCosmeticIds).nullable(),
  type: z.enum(profileCosmeticTypes)
});

export const moderationActionSchema = z.object({
  targetUserId: z.string().regex(objectIdPattern, "Invalid targetUserId format"),
  action: z.enum(moderationActionTypes),
  reason: z.string().min(2).max(160),
  durationHours: z.number().int().min(1).max(24 * 365).optional(),
  reportId: z.string().regex(objectIdPattern, "Invalid reportId format").optional()
});

export const verifyRazorpayPurchaseSchema = z.object({
  purchaseId: z.string().regex(objectIdPattern, "Invalid purchaseId format"),
  razorpay_order_id: z.string().min(3),
  razorpay_payment_id: z.string().min(3),
  razorpay_signature: z.string().min(16)
});

export const verifyGooglePlayPurchaseSchema = z.object({
  packId: z.string(),
  productId: z.string().min(3),
  purchaseToken: z.string().min(10),
  orderId: z.string().optional()
});

export const reactionSchema = z.object({
  type: z.enum(reactionTypes)
});

export const createPollSchema = z.object({
  question: z.string().min(3).max(120),
  options: z.array(z.string().min(1).max(40)).min(2).max(4)
});

export const votePollSchema = z.object({
  optionIndex: z.number().int().min(0).max(3)
});

export const inviteSchema = z.object({
  userId: z.string().regex(objectIdPattern, "Invalid userId format")
});

export const directMessageSchema = z.object({
  message: z.string().min(1).max(500),
  receiverId: z.string().regex(objectIdPattern, "Invalid receiverId format").optional()
});

export const livekitTokenSchema = z.object({
  roomId: z.string(),
  role: z.enum(roomParticipantRoles).optional()
});
