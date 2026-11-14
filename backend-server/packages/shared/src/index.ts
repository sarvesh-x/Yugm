import { z } from "zod";

export const appName = "Yugm";
export const tagline = "Match the vibe.";

export const roles = ["USER", "HOST", "MODERATOR", "ADMIN"] as const;
export const roomTypes = ["VOICE", "VIDEO"] as const;
export const roomStatuses = ["LIVE", "ENDED", "SCHEDULED"] as const;
export const roomVisibilities = ["PUBLIC", "PRIVATE"] as const;
export const roomParticipantRoles = ["HOST", "SPEAKER", "AUDIENCE", "MODERATOR"] as const;
export const reactionTypes = ["heart", "fire", "laugh", "clap", "wow", "crown", "stars", "party"] as const;
export const miniGameIds = ["vibe_tap", "memory_match", "reflex_ring"] as const;

export type UserRole = (typeof roles)[number];
export type RoomType = (typeof roomTypes)[number];
export type RoomStatus = (typeof roomStatuses)[number];
export type RoomVisibility = (typeof roomVisibilities)[number];
export type RoomParticipantRole = (typeof roomParticipantRoles)[number];
export type ReactionType = (typeof reactionTypes)[number];
export type MiniGameId = (typeof miniGameIds)[number];

export const miniGames = [
  {
    id: "vibe_tap",
    title: "Vibe Tap",
    description: "Tap fast, hold a streak, and climb the daily arcade board.",
    durationSeconds: 10,
    scoring: "Higher score wins"
  },
  {
    id: "memory_match",
    title: "Memory Match",
    description: "Flip pairs and clear the board with fewer moves.",
    durationSeconds: 60,
    scoring: "Higher efficiency score wins"
  },
  {
    id: "reflex_ring",
    title: "Reflex Ring",
    description: "Wait for the signal and tap before the glow fades.",
    durationSeconds: 15,
    scoring: "Fast reactions score higher"
  }
] as const;

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
  directTypingStart: "direct:typing:start",
  directTypingStop: "direct:typing:stop",
  directTypingUpdate: "direct:typing:update",
  directMessageNew: "direct:message:new",
  groupMessageNew: "group:message:new",
  groupCreated: "group:created",
  groupParticipantAdd: "group:participant:add",
  groupParticipantRemove: "group:participant:remove",
  clanTypingStart: "clan:typing:start",
  clanTypingStop: "clan:typing:stop",
  clanTypingUpdate: "clan:typing:update",
  clanMessageNew: "clan:message:new",
  clanChatCleaned: "clan:chat:cleaned",
  notificationNew: "notification:new",
  watchPartyStarted: "room:watchparty:started",
  watchPartyStopped: "room:watchparty:stopped",
  watchPartySync: "room:watchparty:sync"
} as const;

export const giftCatalogSeed = [
  { name: "Rose", icon: "rose", coinPrice: 10, diamondPrice: 0, rarity: "common", category: "normal" },
  { name: "Diya", icon: "diya", coinPrice: 50, diamondPrice: 0, rarity: "common", category: "normal" },
  { name: "Lotus", icon: "lotus", coinPrice: 100, diamondPrice: 0, rarity: "rare", category: "normal" },
  { name: "Crown", icon: "crown", coinPrice: 500, diamondPrice: 0, rarity: "epic", category: "premium" },
  { name: "Astra", icon: "astra", coinPrice: 1000, diamondPrice: 0, rarity: "legendary", category: "premium" }
] as const;

export const giftV2CatalogSeed = [
  { name: "Rose", icon: "rose", coinPrice: 10, diamondPrice: 0, rarity: "common", category: "normal", effect3d: "rose_spin", interactive: false, comboMultiplier: 1, tradable: true, upgradeable: true, upgradePath: [] },
  { name: "Diya", icon: "diya", coinPrice: 50, diamondPrice: 0, rarity: "common", category: "normal", effect3d: "diya_glow", interactive: true, comboMultiplier: 1, tradable: true, upgradeable: true, upgradePath: [] },
  { name: "Lotus", icon: "lotus", coinPrice: 100, diamondPrice: 0, rarity: "rare", category: "normal", effect3d: "lotus_bloom", interactive: true, comboMultiplier: 2, tradable: true, upgradeable: true, upgradePath: [] },
  { name: "Crown", icon: "crown", coinPrice: 500, diamondPrice: 0, rarity: "epic", category: "premium", effect3d: "crown_sparkle", interactive: true, comboMultiplier: 3, tradable: false, upgradeable: true, upgradePath: [] },
  { name: "Astra", icon: "astra", coinPrice: 1000, diamondPrice: 0, rarity: "legendary", category: "premium", effect3d: "astra_galaxy", interactive: true, comboMultiplier: 5, tradable: false, upgradeable: false, upgradePath: [] },
  { name: "Galaxy Burst", icon: "galaxy", coinPrice: 5000, diamondPrice: 50, rarity: "legendary", category: "space", effect3d: "galaxy_explosion", interactive: true, comboMultiplier: 5, tradable: false, upgradeable: false, upgradePath: [] },
  { name: "Meteor Shower", icon: "meteor", coinPrice: 2000, diamondPrice: 20, rarity: "epic", category: "space", effect3d: "meteor_rain", interactive: true, comboMultiplier: 3, tradable: true, upgradeable: true, upgradePath: [] },
  { name: "Dragon Fire", icon: "dragon", coinPrice: 10000, diamondPrice: 100, rarity: "mythic", category: "dragon", effect3d: "dragon_inferno", interactive: true, comboMultiplier: 10, tradable: false, upgradeable: false, upgradePath: [] },
  { name: "Love Letter", icon: "letter", coinPrice: 25, diamondPrice: 0, rarity: "common", category: "normal", effect3d: "letter_unfold", interactive: true, comboMultiplier: 1, tradable: true, upgradeable: true, upgradePath: [] },
  { name: "Crystal Heart", icon: "crystal_heart", coinPrice: 300, diamondPrice: 3, rarity: "rare", category: "normal", effect3d: "heart_pulse", interactive: true, comboMultiplier: 2, tradable: true, upgradeable: true, upgradePath: [] },
  { name: "Moon Lamp", icon: "moon", coinPrice: 750, diamondPrice: 7, rarity: "epic", category: "space", effect3d: "moon_glow", interactive: true, comboMultiplier: 3, tradable: true, upgradeable: false, upgradePath: [] },
  { name: "Diamond Ring", icon: "ring", coinPrice: 25000, diamondPrice: 250, rarity: "mythic", category: "luxury", effect3d: "ring_shine", interactive: true, comboMultiplier: 15, tradable: false, upgradeable: false, upgradePath: [] }
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

export const diamondPacks = [
  { id: "diamonds_30", diamondAmount: 30, priceInr: 29, googleProductId: "yugm_diamonds_30" },
  { id: "diamonds_55", diamondAmount: 55, priceInr: 49, googleProductId: "yugm_diamonds_55" },
  { id: "diamonds_120", diamondAmount: 120, priceInr: 99, googleProductId: "yugm_diamonds_120" },
  { id: "diamonds_260", diamondAmount: 260, priceInr: 199, googleProductId: "yugm_diamonds_260" }
] as const;

export function findDiamondPack(id: string) {
  return diamondPacks.find((pack) => pack.id === id);
}

export const subscriptionPlans = [
  { id: "MONTHLY", name: "Monthly Creator Support", googleProductId: "yugm_creator_monthly", basePlanId: "monthly", coinPrice: 299 },
  { id: "YEARLY", name: "Yearly Creator Support", googleProductId: "yugm_creator_yearly", basePlanId: "yearly", coinPrice: 2999 }
] as const;

export type SubscriptionPlan = (typeof subscriptionPlans)[number];

export function findSubscriptionPlanByGoogleProductId(productId: string) {
  return subscriptionPlans.find((plan) => plan.googleProductId === productId);
}

export const profileCosmetics = [
  { id: "avatar_nova_static", type: "AVATAR_ASSET", name: "Nova Static Avatar", coinPrice: 299, rarity: "RARE", preview: "avatar_nova", assetKind: "STATIC", assetUrl: "https://api.dicebear.com/9.x/adventurer/png?seed=YugmNova&backgroundColor=ffd5dc" },
  { id: "avatar_pixel_gif", type: "AVATAR_ASSET", name: "Pixel Loop Avatar", coinPrice: 599, rarity: "EPIC", preview: "avatar_pixel_loop", assetKind: "ANIMATED", assetUrl: "https://media.giphy.com/media/3o7aD2saalBwwftBIY/giphy.gif" },
  { id: "avatar_cosmic_gif", type: "AVATAR_ASSET", name: "Cosmic Pulse Avatar", coinPrice: 999, rarity: "LEGENDARY", preview: "avatar_cosmic_loop", assetKind: "ANIMATED", assetUrl: "https://media.giphy.com/media/l0HlNaQ6gWfllcjDO/giphy.gif" },
  { id: "avatar_kitsune_gif", type: "AVATAR_ASSET", name: "Kitsune Mask Avatar", coinPrice: 699, rarity: "EPIC", preview: "avatar_kitsune", assetKind: "ANIMATED", assetUrl: "https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif" },
  { id: "frame_gold", type: "AVATAR_FRAME", name: "Golden Ring", coinPrice: 399, rarity: "RARE", preview: "gold" },
  { id: "frame_neon", type: "AVATAR_FRAME", name: "Neon Pulse", coinPrice: 699, rarity: "EPIC", preview: "neon" },
  { id: "frame_crystal", type: "AVATAR_FRAME", name: "Crystal Halo", coinPrice: 899, rarity: "EPIC", preview: "crystal" },
  { id: "frame_royal", type: "AVATAR_FRAME", name: "Royal Crown Frame", coinPrice: 1299, rarity: "LEGENDARY", preview: "royal" },
  { id: "frame_gradient", type: "AVATAR_FRAME", name: "Gradient Shift Frame", coinPrice: 799, rarity: "EPIC", preview: "gradient" },
  { id: "frame_floral", type: "AVATAR_FRAME", name: "Floral Vibe Frame", coinPrice: 499, rarity: "RARE", preview: "floral" },
  { id: "frame_iridescent", type: "AVATAR_FRAME", name: "Iridescent Halo", coinPrice: 1199, rarity: "LEGENDARY", preview: "iridescent" },
  { id: "frame_minimal", type: "AVATAR_FRAME", name: "Slim Line Frame", coinPrice: 199, rarity: "COMMON", preview: "minimal" },
  { id: "frame_dragon_fire", type: "AVATAR_FRAME", name: "Dragon Fire Ring", coinPrice: 1499, rarity: "LEGENDARY", preview: "dragon_fire" },
  { id: "frame_sakura_blossom", type: "AVATAR_FRAME", name: "Sakura Blossom Frame", coinPrice: 699, rarity: "EPIC", preview: "sakura" },
  { id: "frame_cyber_punk", type: "AVATAR_FRAME", name: "Cyberpunk Matrix Frame", coinPrice: 899, rarity: "EPIC", preview: "cyber" },
  { id: "frame_phoenix_wings", type: "AVATAR_FRAME", name: "Phoenix Flame Frame", coinPrice: 1999, rarity: "LEGENDARY", preview: "phoenix" },
  { id: "wave_soft", type: "SPEAKING_WAVE", name: "Soft Voice Wave", coinPrice: 249, rarity: "RARE", preview: "wave_soft" },
  { id: "wave_neon", type: "SPEAKING_WAVE", name: "Neon Speaker Wave", coinPrice: 699, rarity: "EPIC", preview: "wave_neon" },
  { id: "wave_royal", type: "SPEAKING_WAVE", name: "Royal Broadcast Wave", coinPrice: 999, rarity: "LEGENDARY", preview: "wave_royal" },
  { id: "wave_pulse", type: "SPEAKING_WAVE", name: "Pulse Wave", coinPrice: 149, rarity: "COMMON", preview: "wave_pulse" },
  { id: "wave_fire", type: "SPEAKING_WAVE", name: "Firestorm Wave", coinPrice: 799, rarity: "EPIC", preview: "wave_fire" },
  { id: "wave_rainbow", type: "SPEAKING_WAVE", name: "Rainbow Prism Wave", coinPrice: 999, rarity: "LEGENDARY", preview: "wave_rainbow" },
  { id: "wave_cyber", type: "SPEAKING_WAVE", name: "Cyber Matrix Wave", coinPrice: 599, rarity: "EPIC", preview: "wave_cyber" },
  { id: "theme_midnight", type: "PROFILE_THEME", name: "Midnight Glow", coinPrice: 499, rarity: "RARE", preview: "midnight" },
  { id: "theme_saffron", type: "PROFILE_THEME", name: "Saffron Wave", coinPrice: 799, rarity: "EPIC", preview: "saffron" },
  { id: "theme_aurora", type: "PROFILE_THEME", name: "Aurora Glass", coinPrice: 999, rarity: "EPIC", preview: "aurora" },
  { id: "theme_sunset", type: "PROFILE_THEME", name: "Sunset Bloom", coinPrice: 1199, rarity: "LEGENDARY", preview: "sunset" },
  { id: "entrance_spark", type: "ENTRANCE_EFFECT", name: "Spark Entrance", coinPrice: 599, rarity: "RARE", preview: "spark" },
  { id: "entrance_crown", type: "ENTRANCE_EFFECT", name: "Crown Drop", coinPrice: 999, rarity: "LEGENDARY", preview: "crown" },
  { id: "entrance_meteor", type: "ENTRANCE_EFFECT", name: "Meteor Arrival", coinPrice: 1299, rarity: "LEGENDARY", preview: "meteor" },
  { id: "entrance_galaxy", type: "ENTRANCE_EFFECT", name: "Galaxy Portal", coinPrice: 899, rarity: "EPIC", preview: "galaxy" },
  { id: "badge_early_host", type: "PROFILE_BADGE", name: "Early Host Badge", coinPrice: 199, rarity: "COMMON", preview: "Early Host" },
  { id: "badge_voice_star", type: "PROFILE_BADGE", name: "Voice Star Badge", coinPrice: 499, rarity: "RARE", preview: "Voice Star" },
  { id: "badge_top_gifter", type: "PROFILE_BADGE", name: "Top Gifter Badge", coinPrice: 799, rarity: "EPIC", preview: "Top Gifter" },
  { id: "badge_vip_loyal", type: "PROFILE_BADGE", name: "VIP Loyal Badge", coinPrice: 1299, rarity: "LEGENDARY", preview: "VIP Loyal" },
  { id: "name_gold_shimmer", type: "NAME_STYLE", name: "Gold Shimmer Name", coinPrice: 599, rarity: "RARE", preview: "gold" },
  { id: "name_neon_glow", type: "NAME_STYLE", name: "Neon Glow Name", coinPrice: 899, rarity: "EPIC", preview: "neon" },
  { id: "name_rainbow_pulse", type: "NAME_STYLE", name: "Rainbow Pulse Name", coinPrice: 1299, rarity: "LEGENDARY", preview: "rainbow" },
  { id: "name_fire_gradient", type: "NAME_STYLE", name: "Fire Gradient Name", coinPrice: 999, rarity: "EPIC", preview: "fire" },
  { id: "room_entry_confetti", type: "ROOM_ENTRY", name: "Confetti Room Entry", coinPrice: 499, rarity: "RARE", preview: "confetti" },
  { id: "room_entry_spotlight", type: "ROOM_ENTRY", name: "Spotlight Room Entry", coinPrice: 899, rarity: "EPIC", preview: "spotlight" },
  { id: "entry_rainbow", type: "ROOM_ENTRY", name: "Rainbow Slide Entry", coinPrice: 299, rarity: "COMMON", preview: "rainbow" },
  { id: "entry_ghost", type: "ROOM_ENTRY", name: "Ghost Glide Entry", coinPrice: 699, rarity: "RARE", preview: "ghost" },
  { id: "mood_chill", type: "MOOD_STATUS", name: "Chill Mood", coinPrice: 99, rarity: "COMMON", preview: "Chill" },
  { id: "mood_open_talk", type: "MOOD_STATUS", name: "Open To Talk", coinPrice: 99, rarity: "COMMON", preview: "Open to talk" },
  { id: "mood_late_night", type: "MOOD_STATUS", name: "Late Night Vibes", coinPrice: 199, rarity: "RARE", preview: "Late night" },
  { id: "mood_party", type: "MOOD_STATUS", name: "Party Mode", coinPrice: 299, rarity: "EPIC", preview: "Party" },
  { id: "music_lofi_intro", type: "PROFILE_MUSIC", name: "Lo-fi Profile Intro", coinPrice: 399, rarity: "RARE", preview: "lofi" },
  { id: "music_bollywood_pop", type: "PROFILE_MUSIC", name: "Bollywood Pop Intro", coinPrice: 499, rarity: "RARE", preview: "pop" },
  { id: "music_classical", type: "PROFILE_MUSIC", name: "Classical Fusion", coinPrice: 399, rarity: "RARE", preview: "classical" },
  { id: "music_indie", type: "PROFILE_MUSIC", name: "Indie Rock Intro", coinPrice: 699, rarity: "EPIC", preview: "indie" },
  { id: "voice_equalizer", type: "VOICE_BADGE", name: "Equalizer Voice Badge", coinPrice: 499, rarity: "RARE", preview: "equalizer" },
  { id: "voice_host_spotlight", type: "VOICE_BADGE", name: "Host Spotlight Badge", coinPrice: 999, rarity: "EPIC", preview: "spotlight" },
  { id: "voice_master", type: "VOICE_BADGE", name: "Voice Master Badge", coinPrice: 1299, rarity: "LEGENDARY", preview: "Voice Master" },
  { id: "voice_crowd", type: "VOICE_BADGE", name: "Crowd Favorite", coinPrice: 299, rarity: "COMMON", preview: "Crowd Favorite" },
  { id: "voice_rockstar", type: "VOICE_BADGE", name: "Rockstar Voice", coinPrice: 699, rarity: "EPIC", preview: "rockstar" },
  { id: "voice_legend", type: "VOICE_BADGE", name: "Legend Voice", coinPrice: 1499, rarity: "LEGENDARY", preview: "legend" },
  { id: "voice_superstar", type: "VOICE_BADGE", name: "Superstar Voice", coinPrice: 899, rarity: "EPIC", preview: "superstar" },
  { id: "room_theme_neon_club", type: "ROOM_THEME", name: "Neon Club Room", coinPrice: 899, rarity: "EPIC", preview: "neon_club" },
  { id: "room_theme_festive", type: "ROOM_THEME", name: "Festive Room", coinPrice: 699, rarity: "RARE", preview: "festive" },
  { id: "theme_cozy", type: "ROOM_THEME", name: "Cozy Cafe Room", coinPrice: 399, rarity: "COMMON", preview: "cozy" },
  { id: "theme_beach", type: "ROOM_THEME", name: "Beach Sunset Room", coinPrice: 599, rarity: "RARE", preview: "beach" },
  { id: "decor_crown", type: "AVATAR_DECORATION", name: "Mini Crown Decoration", coinPrice: 399, rarity: "RARE", preview: "crown" },
  { id: "decor_stars", type: "AVATAR_DECORATION", name: "Star Stickers", coinPrice: 299, rarity: "COMMON", preview: "stars" },
  { id: "decor_headphones", type: "AVATAR_DECORATION", name: "Neon Headphones", coinPrice: 599, rarity: "EPIC", preview: "headphones" },
  { id: "decor_halo", type: "AVATAR_DECORATION", name: "Golden Angel Halo", coinPrice: 999, rarity: "LEGENDARY", preview: "halo" },
  { id: "decor_dragon_horns", type: "AVATAR_DECORATION", name: "Dragon Horns", coinPrice: 1199, rarity: "LEGENDARY", preview: "dragon" },
  { id: "decor_cat_ears", type: "AVATAR_DECORATION", name: "Neon Cat Ears", coinPrice: 499, rarity: "RARE", preview: "neko" },
  { id: "decor_cyber_visor", type: "AVATAR_DECORATION", name: "Cyber Visor", coinPrice: 799, rarity: "EPIC", preview: "cyber" },
  { id: "decor_sakura_petals", type: "AVATAR_DECORATION", name: "Sakura Petals", coinPrice: 399, rarity: "RARE", preview: "sakura" },
  { id: "decor_fire_aura", type: "AVATAR_DECORATION", name: "Fire Aura", coinPrice: 1499, rarity: "LEGENDARY", preview: "fire" },
  { id: "reaction_hearts", type: "REACTION_PACK", name: "Heartstorm Reactions", coinPrice: 299, rarity: "COMMON", preview: "hearts" },
  { id: "reaction_festival", type: "REACTION_PACK", name: "Festival Reactions", coinPrice: 599, rarity: "RARE", preview: "festival" },
  { id: "reaction_anime", type: "REACTION_PACK", name: "Anime Blast Reactions", coinPrice: 699, rarity: "EPIC", preview: "anime" },
  { id: "reaction_classic", type: "REACTION_PACK", name: "Classic Vibes", coinPrice: 399, rarity: "RARE", preview: "classic" },
  { id: "layout_creator", type: "PROFILE_LAYOUT", name: "Creator Profile Layout", coinPrice: 499, rarity: "RARE", preview: "creator" },
  { id: "layout_vip_luxe", type: "PROFILE_LAYOUT", name: "VIP Luxe Layout", coinPrice: 999, rarity: "EPIC", preview: "vip_luxe" },
  { id: "layout_minimal", type: "PROFILE_LAYOUT", name: "Minimal Clean Layout", coinPrice: 299, rarity: "COMMON", preview: "minimal" },
  { id: "layout_bold", type: "PROFILE_LAYOUT", name: "Bold Grid Layout", coinPrice: 699, rarity: "RARE", preview: "bold" },
  { id: "banner_deep_purple", type: "PROFILE_BANNER", name: "Deep Velvet Purple Banner", coinPrice: 299, rarity: "COMMON", preview: "banner_purple" },
  { id: "banner_cosmic_aurora", type: "PROFILE_BANNER", name: "Cosmic Aurora Banner", coinPrice: 599, rarity: "RARE", preview: "banner_aurora" },
  { id: "banner_midnight_sky", type: "PROFILE_BANNER", name: "Midnight Sky Banner", coinPrice: 799, rarity: "EPIC", preview: "banner_midnight" },
  { id: "banner_royal_gold", type: "PROFILE_BANNER", name: "Royal Gold Banner", coinPrice: 1199, rarity: "LEGENDARY", preview: "banner_gold" },
  { id: "intro_ask_me", type: "INTRO_CARD", name: "Ask Me About Card", coinPrice: 199, rarity: "COMMON", preview: "Ask me about music, memes, and late-night rooms." },
  { id: "intro_my_vibe", type: "INTRO_CARD", name: "My Vibe Card", coinPrice: 199, rarity: "COMMON", preview: "My vibe is warm chaos and good playlists." },
  { id: "intro_two_truths", type: "INTRO_CARD", name: "Two Truths Card", coinPrice: 299, rarity: "RARE", preview: "Two truths and a lie — ask me which is which." },
  { id: "intro_fun_facts", type: "INTRO_CARD", name: "Fun Facts Card", coinPrice: 399, rarity: "EPIC", preview: "Fun fact: I never skip the outro." },
  { id: "title_night_owl", type: "COLLECTIBLE_TITLE", name: "Night Owl Title", coinPrice: 249, rarity: "COMMON", preview: "Night Owl" },
  { id: "title_room_royalty", type: "COLLECTIBLE_TITLE", name: "Room Royalty Title", coinPrice: 899, rarity: "EPIC", preview: "Room Royalty" },
  { id: "title_chat_champ", type: "COLLECTIBLE_TITLE", name: "Chat Champion Title", coinPrice: 499, rarity: "RARE", preview: "Chat Champion" },
  { id: "title_vibe_curator", type: "COLLECTIBLE_TITLE", name: "Vibe Curator Title", coinPrice: 1199, rarity: "LEGENDARY", preview: "Vibe Curator" },
  { id: "shelf_rose_wall", type: "GIFT_SHELF", name: "Rose Wall Gift Shelf", coinPrice: 499, rarity: "RARE", preview: "Rose Wall" },
  { id: "shelf_crown_case", type: "GIFT_SHELF", name: "Crown Case Gift Shelf", coinPrice: 999, rarity: "EPIC", preview: "Crown Case" },
  { id: "shelf_diamond", type: "GIFT_SHELF", name: "Diamond Pedestal Shelf", coinPrice: 1499, rarity: "LEGENDARY", preview: "Diamond Pedestal" },
  { id: "shelf_heart", type: "GIFT_SHELF", name: "Heart Shelf", coinPrice: 299, rarity: "COMMON", preview: "Heart Shelf" },
  { id: "bubble_gold", type: "CHAT_BUBBLE", name: "Gold Chat Bubbles", coinPrice: 299, rarity: "COMMON", preview: "gold" },
  { id: "bubble_neon", type: "CHAT_BUBBLE", name: "Neon Chat Bubbles", coinPrice: 599, rarity: "RARE", preview: "neon" },
  { id: "bubble_gradient", type: "CHAT_BUBBLE", name: "Gradient Chat Bubbles", coinPrice: 799, rarity: "EPIC", preview: "gradient" },
  { id: "bubble_rounded", type: "CHAT_BUBBLE", name: "Rounded Soft Bubbles", coinPrice: 199, rarity: "COMMON", preview: "rounded" },
  { id: "bubble_festive", type: "CHAT_BUBBLE", name: "Festive Burst Bubbles", coinPrice: 499, rarity: "RARE", preview: "festive" },
  { id: "bubble_royal", type: "CHAT_BUBBLE", name: "Royal Crown Bubbles", coinPrice: 1099, rarity: "LEGENDARY", preview: "royal" },
  { id: "season_holi", type: "SEASONAL_EVENT", name: "Holi Color Pack", coinPrice: 799, rarity: "EPIC", preview: "holi" },
  { id: "season_diwali", type: "SEASONAL_EVENT", name: "Diwali Glow Pack", coinPrice: 799, rarity: "EPIC", preview: "diwali" },
  { id: "season_monsoon", type: "SEASONAL_EVENT", name: "Monsoon Magic Pack", coinPrice: 499, rarity: "RARE", preview: "monsoon" },
  { id: "season_republic", type: "SEASONAL_EVENT", name: "Republic Day Pack", coinPrice: 299, rarity: "COMMON", preview: "republic" },
  { id: "call_soft_glow", type: "CALL_SCREEN", name: "Soft Glow Filter", coinPrice: 399, rarity: "RARE", preview: "soft_glow" },
  { id: "call_neon_frame", type: "CALL_SCREEN", name: "Neon Call Frame", coinPrice: 699, rarity: "EPIC", preview: "neon_frame" },
  { id: "call_bollywood_lights", type: "CALL_SCREEN", name: "Bollywood Lights", coinPrice: 999, rarity: "LEGENDARY", preview: "bollywood_lights" },
  { id: "call_vintage", type: "CALL_SCREEN", name: "Vintage Film Filter", coinPrice: 199, rarity: "COMMON", preview: "vintage" },
  { id: "badge_premium", type: "ROOM_BADGE", name: "Premium Room Badge", coinPrice: 599, rarity: "EPIC", preview: "Premium" },
  { id: "badge_featured", type: "ROOM_BADGE", name: "Featured Room Badge", coinPrice: 999, rarity: "LEGENDARY", preview: "Featured" },
  { id: "badge_vip_host", type: "ROOM_BADGE", name: "VIP Host Badge", coinPrice: 399, rarity: "RARE", preview: "VIP Host" },
  { id: "badge_top_room", type: "ROOM_BADGE", name: "Top Room Badge", coinPrice: 799, rarity: "EPIC", preview: "Top Room" },
  { id: "ambience_lofi", type: "ROOM_AMBIENCE", name: "Lo-fi Beats", coinPrice: 299, rarity: "RARE", preview: "lofi" },
  { id: "ambience_rain", type: "ROOM_AMBIENCE", name: "Rainy Day", coinPrice: 299, rarity: "RARE", preview: "rain" },
  { id: "ambience_cafe", type: "ROOM_AMBIENCE", name: "Cozy Cafe Ambience", coinPrice: 199, rarity: "COMMON", preview: "cafe" },
  { id: "ambience_night", type: "ROOM_AMBIENCE", name: "Night City Waves", coinPrice: 599, rarity: "EPIC", preview: "night" },
  { id: "ambience_forest", type: "ROOM_AMBIENCE", name: "Forest Chill", coinPrice: 499, rarity: "EPIC", preview: "forest" }
] as const;

export const streakCosmeticRewards: Record<number, string> = {
  3: "mood_chill",
  7: "frame_gold",
  14: "name_neon_glow",
  30: "avatar_cosmic_gif"
};

export const cosmeticBundles = [
  { id: "bundle_vibe_starter", name: "Vibe Starter Pack", cosmeticIds: ["mood_chill", "frame_minimal", "bubble_rounded"], coinPrice: 399, discount: "40%" },
  { id: "bundle_neon_nights", name: "Neon Nights Pack", cosmeticIds: ["frame_neon", "name_neon_glow", "wave_neon", "room_theme_neon_club"], coinPrice: 1999, discount: "35%" },
  { id: "bundle_royal", name: "Royal Collection", cosmeticIds: ["frame_royal", "name_rainbow_pulse", "badge_top_gifter", "entrance_crown", "bubble_royal"], coinPrice: 3999, discount: "30%" },
  { id: "bundle_call_pro", name: "Call Pro Pack", cosmeticIds: ["call_neon_frame", "call_bollywood_lights", "decor_headphones"], coinPrice: 1499, discount: "25%" },
  { id: "bundle_room_host", name: "Room Host Kit", cosmeticIds: ["room_theme_festive", "badge_premium", "ambience_lofi", "room_entry_confetti"], coinPrice: 1999, discount: "30%" }
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
  "PROFILE_BANNER",
  "INTRO_CARD",
  "COLLECTIBLE_TITLE",
  "GIFT_SHELF",
  "CHAT_BUBBLE",
  "SEASONAL_EVENT",
  "CALL_SCREEN",
  "ROOM_BADGE",
  "ROOM_AMBIENCE"
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
  FOLLOW_USER: 10,
  MINI_GAME_PLAY: 8
} as const;

export type XpEvent = keyof typeof xpEvents;

export const roomModes = ["coffee_date", "blind_date", "truth_or_dare", "never_have_i_ever", "would_you_rather"] as const;
export type RoomMode = (typeof roomModes)[number];

export const roomModesInfo = [
  { key: "coffee_date" as const, name: "Coffee Date", description: "Get to know each other with fun questions", minParticipants: 2 },
  { key: "blind_date" as const, name: "Blind Date", description: "Anonymously match and reveal after multiple rounds", minParticipants: 2 },
  { key: "truth_or_dare" as const, name: "Truth or Dare", description: "Classic party game", minParticipants: 2 },
  { key: "never_have_i_ever" as const, name: "Never Have I Ever", description: "Confess what you've never done", minParticipants: 2 },
  { key: "would_you_rather" as const, name: "Would You Rather", description: "Tough choices and fun debates", minParticipants: 2 },
];

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

export const diamondSources = [
  "ADMIN_ADJUSTMENT",
  "GIFT_SENT",
  "GIFT_RECEIVED",
  "RAZORPAY_PURCHASE",
  "GOOGLE_PLAY_PURCHASE",
  "REWARD",
  "REFUND"
] as const;

export const diamondSourceLabels = {
  ADMIN_ADJUSTMENT: "Admin adjustment",
  GIFT_SENT: "Gift sent",
  GIFT_RECEIVED: "Gift received",
  RAZORPAY_PURCHASE: "Razorpay purchase",
  GOOGLE_PLAY_PURCHASE: "Google Play purchase",
  REWARD: "Reward",
  REFUND: "Refund"
} as const satisfies Record<(typeof diamondSources)[number], string>;

export const walletSources = [
  "RECHARGE", "GIFT_SENT", "GIFT_RECEIVED", "GIFT_SENT_DM", "GIFT_RECEIVED_DM", "VIP_PURCHASE",
  "PROFILE_COSMETIC_PURCHASE", "COSMETIC_BUNDLE_PURCHASE", "COSMETIC_GIFT_SENT", "COSMETIC_GIFT_RECEIVED",
  "LEVEL_REWARD", "STREAK_BONUS", "DAILY_REWARD", "ADMIN_ADJUSTMENT", "RAZORPAY_PURCHASE",
  "GOOGLE_PLAY_PURCHASE", "PAYMENT_REFUND", "REFERRAL_BONUS", "STORY_REWARD", "SUBSCRIPTION"
] as const;

export const dailyRewardConfig = {
  coinAmount: 25,
  xpEvent: "DAILY_CHECKIN" as const
};

export const walletSourceLabels = {
  RECHARGE: "Recharge",
  GIFT_SENT: "Gift sent",
  GIFT_RECEIVED: "Gift received",
  GIFT_SENT_DM: "Direct gift sent",
  GIFT_RECEIVED_DM: "Direct gift received",
  VIP_PURCHASE: "VIP membership",
  PROFILE_COSMETIC_PURCHASE: "Profile cosmetic",
  COSMETIC_BUNDLE_PURCHASE: "Cosmetic bundle",
  COSMETIC_GIFT_SENT: "Cosmetic gift sent",
  COSMETIC_GIFT_RECEIVED: "Cosmetic gift received",
  LEVEL_REWARD: "Level reward",
  STREAK_BONUS: "Streak bonus",
  DAILY_REWARD: "Daily reward",
  ADMIN_ADJUSTMENT: "Admin adjustment",
  RAZORPAY_PURCHASE: "Razorpay recharge",
  GOOGLE_PLAY_PURCHASE: "Google Play recharge",
  SUBSCRIPTION: "Creator subscription"
  ,PAYMENT_REFUND: "Payment refund"
  ,REFERRAL_BONUS: "Referral bonus"
  ,STORY_REWARD: "Story reward"
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
  acceptTerms: z.literal(true).optional(),
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
  maxSpeakers: z.number().int().min(2).max(20).default(8),
  visibility: z.enum(roomVisibilities).default("PUBLIC"),
  coverImage: z.string().optional(),
  allowAudienceMicRequests: z.boolean().default(true),
  scheduledFor: z.string().datetime().optional(),
  theme: z.string().optional(),
  vipOnly: z.boolean().default(false),
  badge: z.string().optional(),
  ambience: z.string().optional()
});

export const chatMessageSchema = z.object({
  message: z.string().min(1).max(500)
});

const objectIdPattern = /^[0-9a-fA-F]{24}$/;

export const reportBaseSchema = z.object({
  targetUserId: z.string().regex(objectIdPattern, "Invalid targetUserId format").optional(),
  roomId: z.string().regex(objectIdPattern, "Invalid roomId format").optional(),
  reason: z.string().min(2).max(80),
  description: z.string().max(500).optional()
});

export const reportSchema = reportBaseSchema.refine((value) => Boolean(value.targetUserId || value.roomId), "Report must target a user or room");

export const sendGiftSchema = z.object({
  giftId: z.string().regex(objectIdPattern, "Invalid giftId format"),
  receiverId: z.string().regex(objectIdPattern, "Invalid receiverId format"),
  currency: z.enum(["COINS", "DIAMONDS"]).optional()
});

export const createPurchaseOrderSchema = z.object({
  packId: z.string(),
  provider: z.enum(["RAZORPAY", "GOOGLE_PLAY"])
});

export const purchaseVipSchema = z.object({
  planId: z.enum(vipPlanIds)
});

export const cosmeticBundleIds = cosmeticBundles.map((b) => b.id) as [typeof cosmeticBundles[number]["id"], ...typeof cosmeticBundles[number]["id"][]];

export const profileCosmeticIdSchema = z.string().min(2).max(64);

export const purchaseProfileCosmeticSchema = z.object({
  cosmeticId: profileCosmeticIdSchema
});

export const purchaseCosmeticBundleSchema = z.object({
  bundleId: z.enum(cosmeticBundleIds)
});

export const transferCosmeticSchema = z.object({
  cosmeticId: profileCosmeticIdSchema,
  receiverId: z.string().regex(objectIdPattern, "Invalid receiverId format")
});

export const equipProfileCosmeticSchema = z.object({
  cosmeticId: z.union([profileCosmeticIdSchema, z.literal(""), z.null()]).optional(),
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

export const createGroupChatSchema = z.object({
  name: z.string().min(2).max(60),
  participantIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(2).max(32)
});

export const groupMessageSchema = z.object({
  message: z.string().min(1).max(500),
  mediaUrl: z.string().optional(),
  mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO"]).optional(),
  duration: z.number().optional()
});

export const directMessageSchema = z.object({
  message: z.string().min(1).max(500),
  receiverId: z.string().regex(objectIdPattern, "Invalid receiverId format").optional()
});

export const livekitTokenSchema = z.object({
  roomId: z.string(),
  role: z.enum(roomParticipantRoles).optional()
});
