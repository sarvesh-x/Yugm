import { giftCatalogSeed } from "@yugm/shared";
import { pathToFileURL } from "url";
import { connectDatabase } from "../config/db.js";
import { Gift } from "../models/Gift.js";
import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";

const avatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12"
];

export async function seedDatabase({ clear = true } = {}) {
  if (clear) {
    await Promise.all([
      User.deleteMany({}),
      Room.deleteMany({}),
      RoomParticipant.deleteMany({}),
      Gift.deleteMany({}),
      WalletTransaction.deleteMany({})
    ]);
  }

  const existingUsers = await User.countDocuments();
  if (existingUsers > 0) {
    console.log("Seed skipped: users already exist");
    return;
  }

  const users = await User.create([
    { name: "Aarav Mehta", username: "aarav.live", city: "Mumbai", avatar: avatars[1], interests: ["Gaming", "Hip-hop"], languages: ["Hindi", "English"], role: "HOST", isVerified: true, walletBalance: 1200 },
    { name: "Kiara Rao", username: "kiara.vibes", city: "Bengaluru", avatar: avatars[0], interests: ["Music", "Chill"], languages: ["English", "Kannada"], role: "HOST", isVerified: true, walletBalance: 1800 },
    { name: "Zoya Khan", username: "zoya.onair", city: "Delhi", avatar: avatars[2], interests: ["Poetry", "Friends"], languages: ["Hindi", "Urdu"], role: "USER", isVerified: true, walletBalance: 750 },
    { name: "Kabir Sethi", username: "kabircam", city: "Pune", avatar: avatars[3], interests: ["Fitness", "Video"], languages: ["Hindi", "Marathi"], role: "USER", isVerified: true, walletBalance: 500 }
  ]);

  await Gift.insertMany(giftCatalogSeed.map((gift) => ({ ...gift, isActive: true })));

  const rooms = await Room.create([
    {
      title: "Late night Mumbai beats",
      description: "Lo-fi, indie, and soft chaos.",
      type: "VOICE",
      hostId: users[0].id,
      coverImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
      category: "Music",
      tags: ["indie", "lofi", "mumbai"],
      language: "Hindi",
      status: "LIVE",
      visibility: "PUBLIC",
      maxSpeakers: 8,
      participantCount: 86,
      speakerIds: [users[0].id],
      livekitRoomName: "seed-voice-mumbai",
      startedAt: new Date()
    },
    {
      title: "Campus gaming lobby",
      description: "BGMI, Valorant, and random banter.",
      type: "VOICE",
      hostId: users[1].id,
      coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e",
      category: "Gaming",
      tags: ["gaming", "squad", "rankpush"],
      language: "English",
      status: "LIVE",
      visibility: "PUBLIC",
      maxSpeakers: 6,
      participantCount: 58,
      speakerIds: [users[1].id],
      livekitRoomName: "seed-voice-gaming",
      startedAt: new Date()
    },
    {
      title: "Bengaluru rooftop cam",
      description: "Open video table for creators.",
      type: "VIDEO",
      hostId: users[1].id,
      coverImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4",
      category: "Friends",
      tags: ["video", "creators", "bengaluru"],
      language: "English",
      status: "LIVE",
      visibility: "PUBLIC",
      maxSpeakers: 4,
      participantCount: 43,
      speakerIds: [users[1].id, users[3].id],
      livekitRoomName: "seed-video-rooftop",
      startedAt: new Date()
    }
  ]);

  await RoomParticipant.insertMany(rooms.map((room) => ({ roomId: room.id, userId: room.hostId, role: "HOST" })));

  await WalletTransaction.insertMany(users.map((user) => ({
    userId: user.id,
    type: "CREDIT",
    source: "RECHARGE",
    amount: user.walletBalance,
    balanceBefore: 0,
    balanceAfter: user.walletBalance,
    metadata: { seed: true },
    creditedAt: new Date()
  })));

  console.log("Seeded Yugm demo data");
}

async function main() {
  await connectDatabase();
  await seedDatabase();
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
