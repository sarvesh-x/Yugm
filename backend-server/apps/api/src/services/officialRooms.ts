import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { User } from "../models/User.js";
import { invalidateCache } from "./redis.js";

const officialHost = {
  name: "Yugm Official",
  username: "yugm.official",
  email: "official@yugm.local",
  firebaseUid: "official-yugm-system",
  city: "India",
  bio: "Always-on official rooms from Yugm.",
  interests: ["Trending", "Music", "Gaming", "Friends", "Chill"],
  languages: ["Hindi", "English"],
  role: "HOST",
  isVerified: true,
  walletBalance: 0
} as const;

const officialRooms = [
  {
    livekitRoomName: "official-yugm-trending",
    title: "Yugm Official: Trending Now",
    description: "Always open for new people, live topics, and quick vibe checks.",
    type: "VOICE",
    coverImage: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205",
    category: "Trending",
    tags: ["official", "trending", "welcome"],
    language: "Hindi",
    maxSpeakers: 8,
    participantCount: 24
  },
  {
    livekitRoomName: "official-yugm-music",
    title: "Yugm Official: Music Lounge",
    description: "Lo-fi, indie, Bollywood, hip-hop, and late-night song swaps.",
    type: "VOICE",
    coverImage: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819",
    category: "Music",
    tags: ["official", "music", "lofi"],
    language: "Hindi",
    maxSpeakers: 10,
    participantCount: 18
  },
  {
    livekitRoomName: "official-yugm-gaming",
    title: "Yugm Official: Gaming Lobby",
    description: "Squads, rank pushes, stream talk, and match-making banter.",
    type: "VOICE",
    coverImage: "https://images.unsplash.com/photo-1542751371-adc38448a05e",
    category: "Gaming",
    tags: ["official", "gaming", "squad"],
    language: "English",
    maxSpeakers: 8,
    participantCount: 16
  },
  {
    livekitRoomName: "official-yugm-video",
    title: "Yugm Official: Video Hangout",
    description: "A public creator table for friendly faces and casual conversation.",
    type: "VIDEO",
    coverImage: "https://images.unsplash.com/photo-1517245386807-bb43f82c33c4",
    category: "Friends",
    tags: ["official", "video", "friends"],
    language: "English",
    maxSpeakers: 4,
    participantCount: 12
  }
] as const;

export async function ensureOfficialRooms() {
  const host = await User.findOneAndUpdate(
    { username: officialHost.username },
    { $set: officialHost },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  for (const room of officialRooms) {
    const officialRoom = await Room.findOneAndUpdate(
      { livekitRoomName: room.livekitRoomName },
      {
        $set: {
          ...room,
          hostId: host._id,
          speakerIds: [host._id],
          moderatorIds: [host._id],
          status: "LIVE",
          visibility: "PUBLIC",
          allowAudienceMicRequests: true
        },
        $unset: { endedAt: "" },
        $setOnInsert: {
          startedAt: new Date()
        }
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    );

    await RoomParticipant.findOneAndUpdate(
      { roomId: officialRoom._id, userId: host._id },
      {
        $set: {
          role: "HOST",
          leftAt: null,
          micEnabled: true,
          cameraEnabled: room.type === "VIDEO"
        },
        $setOnInsert: {
          joinedAt: new Date()
        }
      },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  await invalidateCache("rooms:*");
  console.log(`Official public rooms active: ${officialRooms.length}`);
}
