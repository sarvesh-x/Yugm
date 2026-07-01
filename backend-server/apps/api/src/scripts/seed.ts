import { giftCatalogSeed } from "@yugm/shared";
import { pathToFileURL } from "url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { ensureAuthIndexes } from "../services/authIndexes.js";
import { ensureOfficialRooms } from "../services/officialRooms.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { Gift } from "../models/Gift.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Notification } from "../models/Notification.js";
import { Poll } from "../models/Poll.js";
import { Purchase } from "../models/Purchase.js";
import { Report } from "../models/Report.js";
import { Room } from "../models/Room.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SpeakerRequest } from "../models/SpeakerRequest.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";

const now = new Date();

const avatars = [
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce",
  "https://images.unsplash.com/photo-1527980965255-d3b416303d12",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d",
  "https://images.unsplash.com/photo-1517841905240-472988babdf9",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d"
];

const demoUsers = [
  {
    name: "Aarav Mehta",
    username: "aarav.live",
    email: "aarav@yugm.demo",
    city: "Mumbai",
    avatar: avatars[5],
    bio: "Late-night host. Music, memes, Mumbai rain.",
    interests: ["Music", "Gaming", "Chill", "Dating"],
    languages: ["Hindi", "English"],
    role: "HOST",
    gender: "MALE",
    age: 24,
    followersCount: 18400,
    followingCount: 210,
    walletBalance: 2200
  },
  {
    name: "Kiara Rao",
    username: "kiara.vibes",
    email: "kiara@yugm.demo",
    city: "Bengaluru",
    avatar: avatars[0],
    bio: "Creator tables, startup gossip, playlists.",
    interests: ["Video", "Friends", "Music", "Dating"],
    languages: ["English", "Kannada", "Hindi"],
    role: "HOST",
    gender: "FEMALE",
    age: 22,
    followersCount: 26300,
    followingCount: 188,
    walletBalance: 3400
  },
  {
    name: "Zoya Khan",
    username: "zoya.onair",
    email: "zoya@yugm.demo",
    city: "Delhi",
    avatar: avatars[2],
    bio: "Poetry, films, and soft-spoken chaos.",
    interests: ["Poetry", "Dating", "Friends"],
    languages: ["Hindi", "Urdu", "English"],
    role: "HOST",
    gender: "FEMALE",
    age: 23,
    followersCount: 12100,
    followingCount: 133,
    walletBalance: 1600
  },
  {
    name: "Kabir Sethi",
    username: "kabircam",
    email: "kabir@yugm.demo",
    city: "Pune",
    avatar: avatars[3],
    bio: "Fitness, creator collabs, and camera-on rooms.",
    interests: ["Fitness", "Video", "Chill", "Friends"],
    languages: ["Hindi", "Marathi", "English"],
    role: "HOST",
    gender: "MALE",
    age: 25,
    followersCount: 8800,
    followingCount: 97,
    walletBalance: 900
  },
  {
    name: "Meera Nair",
    username: "meera.music",
    email: "meera@yugm.demo",
    city: "Kochi",
    avatar: avatars[4],
    bio: "Indie music scout. Send recs.",
    interests: ["Music", "Chill", "Dating"],
    languages: ["English", "Malayalam", "Hindi"],
    role: "USER",
    gender: "FEMALE",
    age: 21,
    followersCount: 4200,
    followingCount: 321,
    walletBalance: 750
  },
  {
    name: "Rohan Gill",
    username: "rohan.ranked",
    email: "rohan@yugm.demo",
    city: "Chandigarh",
    avatar: avatars[1],
    bio: "Valorant, BGMI, and weekend scrims.",
    interests: ["Gaming", "Friends", "Chill"],
    languages: ["Hindi", "Punjabi", "English"],
    role: "USER",
    gender: "MALE",
    age: 20,
    followersCount: 3600,
    followingCount: 144,
    walletBalance: 520
  },
  {
    name: "Ananya Shah",
    username: "ananya.books",
    email: "ananya@yugm.demo",
    city: "Ahmedabad",
    avatar: avatars[6],
    bio: "Book club energy with chai breaks.",
    interests: ["Chill", "Friends", "Poetry", "Dating"],
    languages: ["Hindi", "Gujarati", "English"],
    role: "USER",
    gender: "FEMALE",
    age: 19,
    followersCount: 2700,
    followingCount: 176,
    walletBalance: 420
  },
  {
    name: "Ishaan Bose",
    username: "ishaan.afterhours",
    email: "ishaan@yugm.demo",
    city: "Kolkata",
    avatar: avatars[7],
    bio: "Films, football, and after-hours adda.",
    interests: ["Friends", "Chill", "Music", "Dating"],
    languages: ["Bengali", "Hindi", "English"],
    role: "USER",
    gender: "MALE",
    age: 23,
    followersCount: 3100,
    followingCount: 201,
    walletBalance: 610
  }
] as const;

const roomSeeds = [
  {
    title: "Mumbai midnight music club",
    description: "Bollywood hooks, indie finds, and lo-fi dedications.",
    type: "VOICE",
    host: "aarav.live",
    coverImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
    category: "Music",
    tags: ["bollywood", "indie", "mumbai"],
    language: "Hindi",
    maxSpeakers: 8,
    participantCount: 86,
    livekitRoomName: "demo-mumbai-midnight-music"
  },
  {
    title: "Bengaluru creator table",
    description: "Camera-on room for reels, collabs, and startup tea.",
    type: "VIDEO",
    host: "kiara.vibes",
    coverImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4",
    category: "Video",
    tags: ["creators", "reels", "bengaluru"],
    language: "English",
    maxSpeakers: 4,
    participantCount: 43,
    livekitRoomName: "demo-bengaluru-creator-table"
  },
  {
    title: "Delhi poetry after dark",
    description: "Shayari, spoken word, and gentle audience snaps.",
    type: "VOICE",
    host: "zoya.onair",
    coverImage: "https://images.unsplash.com/photo-1477281765962-ef34e8bb0967",
    category: "Chill",
    tags: ["poetry", "shayari", "delhi"],
    language: "Hindi",
    maxSpeakers: 6,
    participantCount: 61,
    livekitRoomName: "demo-delhi-poetry-after-dark"
  },
  {
    title: "Rank push squad finder",
    description: "Find teammates for BGMI, Valorant, and late-night queues.",
    type: "VOICE",
    host: "aarav.live",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e",
    category: "Gaming",
    tags: ["gaming", "bgmi", "valorant"],
    language: "English",
    maxSpeakers: 10,
    participantCount: 73,
    livekitRoomName: "demo-rank-push-squad"
  },
  {
    title: "Pune fitness check-in",
    description: "Accountability, quick routines, and camera-on wins.",
    type: "VIDEO",
    host: "kabircam",
    coverImage: "https://images.unsplash.com/photo-1518611012118-696072aa579a",
    category: "Friends",
    tags: ["fitness", "routine", "pune"],
    language: "Hindi",
    maxSpeakers: 4,
    participantCount: 29,
    livekitRoomName: "demo-pune-fitness-checkin"
  },
  {
    title: "Sunday chill adda",
    description: "Low-pressure conversation for new people and old playlists.",
    type: "VOICE",
    host: "kiara.vibes",
    coverImage: "https://images.unsplash.com/photo-1500530855697-b586d89ba3ee",
    category: "Chill",
    tags: ["friends", "adda", "weekend"],
    language: "English",
    maxSpeakers: 8,
    participantCount: 54,
    livekitRoomName: "demo-sunday-chill-adda"
  }
] as const;

async function clearDemoData() {
  await Promise.all([
    ChatMessage.deleteMany({}),
    DirectMessage.deleteMany({}),
    Follow.deleteMany({}),
    Gift.deleteMany({}),
    GiftTransaction.deleteMany({}),
    Notification.deleteMany({}),
    Poll.deleteMany({}),
    Purchase.deleteMany({}),
    Report.deleteMany({}),
    Room.deleteMany({}),
    RoomActivity.deleteMany({}),
    RoomInvite.deleteMany({}),
    RoomParticipant.deleteMany({}),
    SpeakerRequest.deleteMany({}),
    User.deleteMany({}),
    WalletTransaction.deleteMany({})
  ]);
}

export async function seedDatabase({ clear = true } = {}) {
  await ensureAuthIndexes();
  if (clear) await clearDemoData();

  const users = await User.create(demoUsers.map((user) => ({
    ...user,
    isVerified: true,
    isBlocked: false,
    tokenVersion: 0
  })));
  const userByUsername = new Map(users.map((user) => [user.username, user]));

  const gifts = await Gift.insertMany(giftCatalogSeed.map((gift) => ({ ...gift, isActive: true })));
  const rose = gifts.find((gift) => gift.name === "Rose")!;
  const diya = gifts.find((gift) => gift.name === "Diya")!;
  const crown = gifts.find((gift) => gift.name === "Crown")!;

  const rooms = await Room.create(roomSeeds.map((room) => {
    const host = userByUsername.get(room.host)!;
    return {
      title: room.title,
      description: room.description,
      type: room.type,
      hostId: host._id,
      coverImage: room.coverImage,
      category: room.category,
      tags: room.tags,
      language: room.language,
      status: "LIVE",
      visibility: "PUBLIC",
      maxSpeakers: room.maxSpeakers,
      participantCount: room.participantCount,
      speakerIds: [host._id],
      moderatorIds: [host._id],
      livekitRoomName: room.livekitRoomName,
      allowAudienceMicRequests: true,
      startedAt: now
    };
  }));

  const participants = rooms.flatMap((room, roomIndex) => {
    const host = users.find((user) => user._id.toString() === room.hostId.toString())!;
    const audience = users
      .filter((user) => user._id.toString() !== host._id.toString())
      .slice(0, 4 + (roomIndex % 3));
    return [
      { roomId: room._id, userId: host._id, role: "HOST", micEnabled: true, cameraEnabled: room.type === "VIDEO" },
      ...audience.map((user, index) => ({
        roomId: room._id,
        userId: user._id,
        role: index === 0 ? "SPEAKER" : "AUDIENCE",
        micEnabled: index === 0,
        cameraEnabled: room.type === "VIDEO" && index < 2
      }))
    ];
  });
  await RoomParticipant.insertMany(participants);

  const followPairs = [
    ["meera.music", "aarav.live"],
    ["rohan.ranked", "aarav.live"],
    ["ananya.books", "zoya.onair"],
    ["ishaan.afterhours", "kiara.vibes"],
    ["aarav.live", "kiara.vibes"],
    ["kiara.vibes", "zoya.onair"],
    ["kabircam", "kiara.vibes"],
    ["zoya.onair", "aarav.live"]
  ];
  await Follow.insertMany(followPairs.map(([follower, following]) => ({
    followerId: userByUsername.get(follower)!._id,
    followingId: userByUsername.get(following)!._id
  })));

  await ChatMessage.insertMany(rooms.flatMap((room) => {
    const host = users.find((user) => user._id.toString() === room.hostId.toString())!;
    const meera = userByUsername.get("meera.music")!;
    const rohan = userByUsername.get("rohan.ranked")!;
    return [
      { roomId: room._id, senderId: host._id, message: "Welcome in. Keep it warm and respectful.", type: "TEXT" },
      { roomId: room._id, senderId: meera._id, message: "This room already passes the vibe check.", type: "TEXT" },
      { roomId: room._id, senderId: rohan._id, message: "Dropping in for ten minutes, then I am pulled into a match.", type: "TEXT" }
    ];
  }));

  await RoomActivity.insertMany(rooms.flatMap((room) => {
    const host = users.find((user) => user._id.toString() === room.hostId.toString())!;
    return [
      { roomId: room._id, userId: host._id, type: "MISSION", label: `${host.name} started the room`, metadata: { seed: true } },
      { roomId: room._id, userId: userByUsername.get("meera.music")!._id, type: "JOIN", label: "Meera joined", metadata: { seed: true } },
      { roomId: room._id, userId: userByUsername.get("rohan.ranked")!._id, type: "REACTION", label: "Rohan reacted with fire", metadata: { reaction: "fire" } }
    ];
  }));

  await GiftTransaction.insertMany([
    { roomId: rooms[0]._id, senderId: userByUsername.get("meera.music")!._id, receiverId: userByUsername.get("aarav.live")!._id, giftId: rose._id, coinAmount: rose.coinPrice },
    { roomId: rooms[1]._id, senderId: userByUsername.get("ishaan.afterhours")!._id, receiverId: userByUsername.get("kiara.vibes")!._id, giftId: diya._id, coinAmount: diya.coinPrice },
    { roomId: rooms[2]._id, senderId: userByUsername.get("ananya.books")!._id, receiverId: userByUsername.get("zoya.onair")!._id, giftId: crown._id, coinAmount: crown.coinPrice }
  ]);

  await Notification.insertMany([
    { userId: userByUsername.get("aarav.live")!._id, type: "GIFT", title: "New gift", body: "Meera sent you a Rose", data: { roomId: rooms[0]._id.toString() } },
    { userId: userByUsername.get("kiara.vibes")!._id, type: "FOLLOW", title: "New follower", body: "Ishaan started following you" },
    { userId: userByUsername.get("zoya.onair")!._id, type: "SYSTEM", title: "Room tip", body: "Pin a question to help shy listeners join in." }
  ]);

  await WalletTransaction.insertMany(users.map((user) => ({
    userId: user._id,
    type: "CREDIT",
    source: "ADMIN_ADJUSTMENT",
    amount: user.walletBalance,
    balanceBefore: 0,
    balanceAfter: user.walletBalance,
    metadata: { seed: true, reason: "Demo starting balance" },
    creditedAt: now
  })));

  await ensureOfficialRooms();
  console.log(`Seeded Yugm demo data: ${users.length} users, ${rooms.length} demo rooms, ${gifts.length} gifts`);
}

async function main() {
  await connectDatabase();
  await seedDatabase({ clear: !process.argv.includes("--no-clear") });
  await disconnectDatabase();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
