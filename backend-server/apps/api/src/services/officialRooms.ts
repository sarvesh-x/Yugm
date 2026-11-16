import { Room } from "../models/Room.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { User } from "../models/User.js";
import { invalidateCache } from "./redis.js";

export const ALWAYS_ON_OFFICIAL_VOICE_ROOM = "official-yugm-trending";

export function isAlwaysOnOfficialVoiceRoom(room: { type?: string; livekitRoomName?: string } | null | undefined) {
  return room?.type === "VOICE" && room.livekitRoomName === ALWAYS_ON_OFFICIAL_VOICE_ROOM;
}

const officialHost = {
  name: "Yugm Official",
  username: "yugm.official",
  email: "official@yugm.local",
  avatar: "/assets/yugm-official-avatar.png",
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
    livekitRoomName: ALWAYS_ON_OFFICIAL_VOICE_ROOM,
    title: "Yugm Official",
    description: "Yugm's always-open official voice room. Drop in, meet the community, and join the conversation.",
    type: "VOICE",
    coverImage: "https://images.unsplash.com/photo-1517457373958-b7bdd4587205",
    category: "Trending",
    tags: ["official", "trending", "welcome"],
    language: "Hindi",
    maxSpeakers: 8
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
    maxSpeakers: 10
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
    maxSpeakers: 8
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
    maxSpeakers: 4
  }
] as const;

export async function ensureOfficialRooms() {
  const host = await User.findOneAndUpdate(
    { username: officialHost.username },
    {
      $set: { ...officialHost, isBlocked: false },
      $unset: { deletionRequestedAt: "" }
    },
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
          status: "ENDED",
          visibility: "PUBLIC",
          allowAudienceMicRequests: true,
          endedAt: new Date()
        },
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
    const actualParticipantCount = await RoomParticipant.countDocuments({ roomId: officialRoom._id, leftAt: null });
    await Room.updateOne({ _id: officialRoom._id }, { $set: { participantCount: actualParticipantCount } });
  }

  await invalidateCache("rooms:*");
  console.log(`Official public rooms seeded as inactive: ${officialRooms.length}`);
}
