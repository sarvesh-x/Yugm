import { pathToFileURL } from "url";
import { connectDatabase, disconnectDatabase } from "../config/db.js";
import { ensureAuthIndexes } from "../services/authIndexes.js";
import { ensureDefaultCosmetics } from "../services/cosmetics.js";
import { ensureOfficialRooms } from "../services/officialRooms.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Notification } from "../models/Notification.js";
import { Poll } from "../models/Poll.js";
import { Purchase } from "../models/Purchase.js";
import { Report } from "../models/Report.js";
import { Relationship } from "../models/Relationship.js";
import { Room } from "../models/Room.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SpeakerRequest } from "../models/SpeakerRequest.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";

/** Remove only the synthetic records created by the old demo seed. */
export async function removeSeededDemoData() {
  const demoUsers = await User.find({ email: /@yugm\.demo$/i }).select("_id").lean();
  const demoUserIds = demoUsers.map(({ _id }) => _id);
  const demoRooms = await Room.find({ livekitRoomName: /^demo-/ }).select("_id").lean();
  const demoRoomIds = demoRooms.map(({ _id }) => _id);
  if (demoUserIds.length === 0 && demoRoomIds.length === 0) return;

  const anyRef = (userFields: string[], roomFields: string[] = []) => {
    const clauses = [
      ...(demoUserIds.length ? userFields.map((field) => ({ [field]: { $in: demoUserIds } })) : []),
      ...(demoRoomIds.length ? roomFields.map((field) => ({ [field]: { $in: demoRoomIds } })) : [])
    ];
    return { $or: clauses.length > 0 ? clauses : [{ _id: { $exists: false } }] };
  };

  await Promise.all([
    ChatMessage.deleteMany(anyRef(["senderId"], ["roomId"])),
    DirectMessage.deleteMany(anyRef(["senderId", "receiverId"], ["roomId"])),
    Follow.deleteMany(anyRef(["followerId", "followingId"])),
    GiftTransaction.deleteMany(anyRef(["senderId", "receiverId"], ["roomId"])),
    Notification.deleteMany(anyRef(["userId"])),
    Poll.deleteMany(anyRef([], ["roomId"])),
    Purchase.deleteMany(anyRef(["userId"])),
    Report.deleteMany(anyRef(["reporterId", "targetUserId", "reviewedBy"], ["roomId"])),
    Relationship.deleteMany(anyRef(["users"])),
    RoomActivity.deleteMany(anyRef(["userId"], ["roomId"])),
    RoomInvite.deleteMany(anyRef(["inviterId", "inviteeId"], ["roomId"])),
    RoomParticipant.deleteMany(anyRef(["userId"], ["roomId"])),
    SpeakerRequest.deleteMany(anyRef(["userId"], ["roomId"])),
    WalletTransaction.deleteMany(anyRef(["userId"]))
  ]);

  if (demoRoomIds.length) await Room.deleteMany({ _id: { $in: demoRoomIds } });
  if (demoUserIds.length) await User.deleteMany({ _id: { $in: demoUserIds } });
  console.log(`Removed ${demoUsers.length} seeded demo users and ${demoRooms.length} demo rooms; official rooms and accounts were preserved.`);
}

export async function seedDatabase() {
  await ensureAuthIndexes();
  await removeSeededDemoData();
  await ensureDefaultCosmetics();
  await ensureOfficialRooms();
}

async function main() {
  await connectDatabase();
  try {
    await seedDatabase();
  } finally {
    await disconnectDatabase();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
