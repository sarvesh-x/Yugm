import { pathToFileURL } from "url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { Event } from "../models/Event.js";
import { Gift } from "../models/Gift.js";
import { ImmersiveTheme } from "../models/ImmersiveTheme.js";
import { User } from "../models/User.js";

const FESTIVALS = ["diwali", "holi", "new_year", "valentines", "independence_day"] as const;

const festivalGifts: Array<{
  name: string; icon: string; coinPrice: number; diamondPrice: number;
  category: string; theme: string; rarity: "common" | "rare" | "epic" | "legendary" | "mythic";
  limitedEdition: { active: boolean; total: number; remaining: number };
  interactive?: boolean; effect3d?: string;
}> = [
  // Diwali
  { name: "Diya Glow", icon: "🪔", coinPrice: 50, diamondPrice: 0, category: "seasonal", theme: "diwali", rarity: "common", limitedEdition: { active: true, total: 5000, remaining: 5000 }, interactive: true },
  { name: "Rocket Blast", icon: "🎆", coinPrice: 150, diamondPrice: 0, category: "seasonal", theme: "diwali", rarity: "rare", limitedEdition: { active: true, total: 3000, remaining: 3000 }, interactive: true, effect3d: "fireworks" },
  { name: "Lakshmi Puja Crown", icon: "👑", coinPrice: 999, diamondPrice: 50, category: "seasonal", theme: "diwali", rarity: "legendary", limitedEdition: { active: true, total: 500, remaining: 500 }, effect3d: "gold_particles" },
  // Holi
  { name: "Gulal Splash", icon: "🎨", coinPrice: 80, diamondPrice: 0, category: "seasonal", theme: "holi", rarity: "common", limitedEdition: { active: true, total: 5000, remaining: 5000 }, interactive: true },
  { name: "Color Cannon", icon: "🌈", coinPrice: 200, diamondPrice: 0, category: "seasonal", theme: "holi", rarity: "epic", limitedEdition: { active: true, total: 2000, remaining: 2000 }, interactive: true, effect3d: "color_blast" },
  { name: "Rang Holi Veil", icon: "🪁", coinPrice: 500, diamondPrice: 25, category: "seasonal", theme: "holi", rarity: "legendary", limitedEdition: { active: true, total: 800, remaining: 800 }, effect3d: "rainbow_swirl" },
  // New Year
  { name: "Midnight Confetti", icon: "🎉", coinPrice: 60, diamondPrice: 0, category: "seasonal", theme: "new_year", rarity: "common", limitedEdition: { active: true, total: 8000, remaining: 8000 }, interactive: true },
  { name: "Countdown Rocket", icon: "🚀", coinPrice: 250, diamondPrice: 0, category: "seasonal", theme: "new_year", rarity: "epic", limitedEdition: { active: true, total: 2000, remaining: 2000 }, interactive: true, effect3d: "rocket_launch" },
  { name: "Golden Hourglass", icon: "⏳", coinPrice: 999, diamondPrice: 100, category: "seasonal", theme: "new_year", rarity: "mythic", limitedEdition: { active: true, total: 200, remaining: 200 }, effect3d: "gold_dust" },
  // Valentine's
  { name: "Rose Bloom", icon: "🌹", coinPrice: 100, diamondPrice: 0, category: "seasonal", theme: "valentines", rarity: "rare", limitedEdition: { active: true, total: 4000, remaining: 4000 }, interactive: true },
  { name: "Cupid Arrow", icon: "🏹", coinPrice: 300, diamondPrice: 0, category: "seasonal", theme: "valentines", rarity: "epic", limitedEdition: { active: true, total: 1500, remaining: 1500 }, interactive: true, effect3d: "heart_arrow" },
  { name: "Eternal Vow Ring", icon: "💍", coinPrice: 1499, diamondPrice: 150, category: "seasonal", theme: "valentines", rarity: "mythic", limitedEdition: { active: true, total: 150, remaining: 150 }, effect3d: "sparkle_ring" },
  // Independence Day
  { name: "Tiranga Badge", icon: "🇮🇳", coinPrice: 40, diamondPrice: 0, category: "seasonal", theme: "independence_day", rarity: "common", limitedEdition: { active: true, total: 10000, remaining: 10000 } },
  { name: "Dove Release", icon: "🕊️", coinPrice: 180, diamondPrice: 0, category: "seasonal", theme: "independence_day", rarity: "rare", limitedEdition: { active: true, total: 3000, remaining: 3000 }, interactive: true },
  { name: "Flag Wave Fireworks", icon: "🎇", coinPrice: 400, diamondPrice: 20, category: "seasonal", theme: "independence_day", rarity: "epic", limitedEdition: { active: true, total: 1200, remaining: 1200 }, interactive: true, effect3d: "flag_fireworks" }
];

const festivalThemes: Array<{
  key: string; name: string; type: "room_background" | "profile_theme" | "entrance_effect" | "border";
  category: string; colors: string[]; animation?: Record<string, unknown>; ambientSound?: string;
  price: { coins: number; diamonds: number }; premium: boolean; available: boolean;
}> = [
  { key: "theme_diwali", name: "Diwali Rooftop", type: "room_background", category: "festival", colors: ["#1a0b00", "#ff9a3d", "#ffd166"], animation: { type: "particles", config: { count: 120, size: 3, speed: 0.5, color: "#ffd166" } }, ambientSound: "ambience_night", price: { coins: 999, diamonds: 0 }, premium: false, available: true },
  { key: "theme_holi", name: "Holi Color Burst", type: "room_background", category: "festival", colors: ["#ff4d4d", "#ffd166", "#06d6a0", "#4d96ff"], animation: { type: "particles", config: { count: 150, size: 5, speed: 0.6, color: "#ff4d4d" } }, ambientSound: "ambience_cafe", price: { coins: 899, diamonds: 0 }, premium: false, available: true },
  { key: "theme_newyear", name: "New Year Gala", type: "room_background", category: "festival", colors: ["#0a0a2e", "#e8e8ff", "#ffd700"], animation: { type: "particles", config: { count: 180, size: 2, speed: 0.8, color: "#ffd700" } }, ambientSound: "ambience_lofi", price: { coins: 1299, diamonds: 25 }, premium: true, available: true },
  { key: "theme_valentine", name: "Valentine's Rooftop", type: "room_background", category: "festival", colors: ["#2b0a1a", "#ff6b9d", "#ffd1dc"], animation: { type: "particles", config: { count: 110, size: 4, speed: 0.4, color: "#ff6b9d" } }, ambientSound: "ambience_cafe", price: { coins: 999, diamonds: 0 }, premium: false, available: true },
  { key: "theme_independence", name: "Tricolor Skyline", type: "room_background", category: "festival", colors: ["#ff9933", "#ffffff", "#138808"], animation: { type: "gradient", config: { speed: 0.5, direction: "horizontal" } }, ambientSound: "ambience_night", price: { coins: 799, diamonds: 0 }, premium: false, available: true }
];

const festivalEvents: Array<{
  title: string; description: string; category: string; type: "ROOM" | "TOURNAMENT" | "SPECIAL" | "WORKSHOP" | "PARTY";
  festival: "none" | "diwali" | "holi" | "new_year" | "valentines" | "independence_day";
  eventDateOffsetDays: number; tags: string[]; featured: boolean; maxParticipants: number;
}> = [
  { title: "Diwali Night Jam", description: "Live music, diya lighting countdown and the biggest gift battle of the season. Join the rooftop room for a night of sparkle and sound.", category: "Music", type: "PARTY", festival: "diwali", eventDateOffsetDays: 3, tags: ["diwali", "music", "party"], featured: true, maxParticipants: 100 },
  { title: "Holi Colour Battle", description: "Drop gulal bombs, splash the chat with colour and compete for the most vibrant room. Winner gets a seasonal badge.", category: "Games", type: "TOURNAMENT", festival: "holi", eventDateOffsetDays: 5, tags: ["holi", "tournament", "gifts"], featured: true, maxParticipants: 60 },
  { title: "New Year Countdown Gala", description: "Midnight confetti drop, top 12 DJ sets and a golden hourglass raffle. Dress code: your most extra outfit.", category: "Music", type: "PARTY", festival: "new_year", eventDateOffsetDays: 7, tags: ["new_year", "countdown", "party"], featured: true, maxParticipants: 200 },
  { title: "Valentine's Speed Chat", description: "Five minutes per conversation, curated matches, no pressure. End the night with the rose bouquet ceremony.", category: "Dating", type: "SPECIAL", festival: "valentines", eventDateOffsetDays: 9, tags: ["valentines", "dating", "social"], featured: true, maxParticipants: 40 },
  { title: "Independence Day Open Mic", description: "Poetry, patriotic covers and stories of home. Wear the Tiranga badge, take the stage, fly the dove.", category: "Talk", type: "SPECIAL", festival: "independence_day", eventDateOffsetDays: 11, tags: ["independence_day", "open_mic", "talk"], featured: true, maxParticipants: 80 }
];

async function seedFestivals() {
  let hosts: Array<{ _id: { toString(): string } }> = [];
  try {
    hosts = await User.find({ role: "HOST" }).select("_id").limit(5).lean() as unknown as Array<{ _id: { toString(): string } }>;
  } catch {
    hosts = [];
  }

  for (const gift of festivalGifts) {
    await Gift.updateOne(
      { name: gift.name },
      { $setOnInsert: { ...gift, isActive: true, tradable: true } },
      { upsert: true }
    );
  }

  for (const theme of festivalThemes) {
    await ImmersiveTheme.updateOne(
      { key: theme.key },
      { $setOnInsert: theme },
      { upsert: true }
    );
  }

  if (hosts.length > 0) {
    for (let i = 0; i < festivalEvents.length; i++) {
      const ev = festivalEvents[i];
      const host = hosts[i % hosts.length];
      const eventDate = new Date();
      eventDate.setDate(eventDate.getDate() + ev.eventDateOffsetDays);
      eventDate.setHours(20, 30, 0, 0);
      const endDate = new Date(eventDate);
      endDate.setHours(endDate.getHours() + 3);
      await Event.updateOne(
        { title: ev.title, festival: ev.festival },
        {
          $setOnInsert: {
            ...ev,
            hostId: host._id.toString(),
            eventDate,
            eventEndDate: endDate,
            timezone: "Asia/Kolkata",
            status: "UPCOMING",
            participantIds: [],
            description: ev.description
          }
        },
        { upsert: true }
      );
    }
  }

  console.log(
    `Seeded festival content: ${festivalGifts.length} gifts, ${festivalThemes.length} themes, ` +
    `${hosts.length > 0 ? festivalEvents.length : 0} events (${hosts.length > 0 ? `${hosts.length} hosts` : "no hosts found - events skipped"})`
  );
}

async function main() {
  await connectDatabase();
  await seedFestivals();
  await disconnectDatabase();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
