import { Achievement } from "../models/Achievement.js";

const baseAchievementDefs = [
  { id: "profile_complete", title: "Profile Spark", description: "Complete more of your profile to unlock each tier", category: "CONTENT" as const, icon: "sparkles", order: 1, tiers: [
    { tier: "BRONZE" as const, target: 60, rewardCoins: 25, rewardCosmetic: "frame_minimal" },
    { tier: "SILVER" as const, target: 80, rewardCoins: 50 },
    { tier: "GOLD" as const, target: 100, rewardCoins: 100 }
  ]},
  { id: "daily_streak_3", title: "Three Day Rhythm", description: "Maintain your daily check-in streak", category: "LOYALTY" as const, icon: "flame", order: 2, tiers: [
    { tier: "BRONZE" as const, target: 3, rewardCoins: 50, rewardCosmetic: "mood_chill" },
    { tier: "SILVER" as const, target: 7, rewardCoins: 100 },
    { tier: "GOLD" as const, target: 30, rewardCoins: 200 },
    { tier: "PLATINUM" as const, target: 100, rewardCoins: 500 }
  ]},
  { id: "follow_10", title: "Circle Builder", description: "Follow creators and grow your network", category: "SOCIAL" as const, icon: "users", order: 3, tiers: [
    { tier: "BRONZE" as const, target: 10, rewardCoins: 75 },
    { tier: "SILVER" as const, target: 25, rewardCoins: 150 },
    { tier: "GOLD" as const, target: 50, rewardCoins: 300 },
    { tier: "PLATINUM" as const, target: 100, rewardCoins: 500 }
  ]},
  { id: "host_3", title: "Room Starter", description: "Host voice or video rooms", category: "CONTENT" as const, icon: "radio", order: 4, tiers: [
    { tier: "BRONZE" as const, target: 3, rewardCoins: 100, rewardCosmetic: "badge_early_host" },
    { tier: "SILVER" as const, target: 10, rewardCoins: 200 },
    { tier: "GOLD" as const, target: 25, rewardCoins: 400 },
    { tier: "PLATINUM" as const, target: 50, rewardCoins: 750 }
  ]},
  { id: "gift_5", title: "Gift Spark", description: "Send gifts to other creators", category: "ENGAGEMENT" as const, icon: "gift", order: 5, tiers: [
    { tier: "BRONZE" as const, target: 5, rewardCoins: 120 },
    { tier: "SILVER" as const, target: 15, rewardCoins: 250 },
    { tier: "GOLD" as const, target: 30, rewardCoins: 500 }
  ]},
  { id: "chat_25", title: "Conversation Flow", description: "Send chat messages in rooms", category: "SOCIAL" as const, icon: "message-circle", order: 6, tiers: [
    { tier: "BRONZE" as const, target: 25, rewardCoins: 80 },
    { tier: "SILVER" as const, target: 100, rewardCoins: 200 },
    { tier: "GOLD" as const, target: 500, rewardCoins: 500 },
    { tier: "PLATINUM" as const, target: 1000, rewardCoins: 1000 }
  ]},
  { id: "level_5", title: "Yugm Star", description: "Reach XP levels and unlock your potential", category: "LOYALTY" as const, icon: "star", order: 7, tiers: [
    { tier: "BRONZE" as const, target: 5, rewardCoins: 150, rewardCosmetic: "name_neon_glow" },
    { tier: "SILVER" as const, target: 10, rewardCoins: 300 },
    { tier: "GOLD" as const, target: 15, rewardCoins: 600 },
    { tier: "PLATINUM" as const, target: 20, rewardCoins: 1000 }
  ]},
  { id: "room_join_10", title: "Room Hopper", description: "Join different live rooms and meet the community", category: "SOCIAL" as const, icon: "headphones", order: 8, tiers: [
    { tier: "BRONZE" as const, target: 10, rewardCoins: 60 },
    { tier: "SILVER" as const, target: 30, rewardCoins: 140 },
    { tier: "GOLD" as const, target: 75, rewardCoins: 300 }
  ]},
  { id: "game_plays_10", title: "Playful Spirit", description: "Play mini games with friends", category: "ENGAGEMENT" as const, icon: "gamepad-2", order: 9, tiers: [
    { tier: "BRONZE" as const, target: 10, rewardCoins: 60 },
    { tier: "SILVER" as const, target: 30, rewardCoins: 140 },
    { tier: "GOLD" as const, target: 100, rewardCoins: 300 }
  ]},
  { id: "gift_received_5", title: "Community Favorite", description: "Receive gifts from the community", category: "ENGAGEMENT" as const, icon: "heart", order: 10, tiers: [
    { tier: "BRONZE" as const, target: 5, rewardCoins: 80 },
    { tier: "SILVER" as const, target: 20, rewardCoins: 180 },
    { tier: "GOLD" as const, target: 50, rewardCoins: 400 }
  ]}
];

export async function seedAchievements() {
  const result = await Achievement.bulkWrite(baseAchievementDefs.map((def, i) => ({
    updateOne: {
      filter: { id: def.id },
      update: { $setOnInsert: { ...def, order: i + 1 } },
      upsert: true
    }
  })), { ordered: false });
  const inserted = result.upsertedCount ?? 0;
  const profileAchievement = baseAchievementDefs.find((def) => def.id === "profile_complete");
  if (profileAchievement) {
    await Achievement.updateOne(
      { id: profileAchievement.id },
      { $set: { description: profileAchievement.description, tiers: profileAchievement.tiers } }
    );
  }
  if (inserted > 0) console.log(`Seeded ${inserted} progression achievements`);
}
