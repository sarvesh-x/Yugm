import { Block } from "../models/Block.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { Clan } from "../models/Clan.js";
import { ClanMessage } from "../models/ClanMessage.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { Follow } from "../models/Follow.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Match } from "../models/Match.js";
import { MiniGameChallenge } from "../models/MiniGameChallenge.js";
import { MiniGameScore } from "../models/MiniGameScore.js";
import { Notification } from "../models/Notification.js";
import { Purchase } from "../models/Purchase.js";
import { Relationship } from "../models/Relationship.js";
import { Report } from "../models/Report.js";
import { Room } from "../models/Room.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SpeakerRequest } from "../models/SpeakerRequest.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";

const indexedModels = [
  User,
  Room,
  RoomParticipant,
  ChatMessage,
  DirectMessage,
  Notification,
  DeviceToken,
  Follow,
  Block,
  Match,
  Relationship,
  Clan,
  ClanMessage,
  RoomActivity,
  RoomInvite,
  SpeakerRequest,
  GiftTransaction,
  WalletTransaction,
  Purchase,
  Report,
  MiniGameScore,
  MiniGameChallenge
];

export async function ensureProductionIndexes() {
  await Promise.all(indexedModels.map((model) => model.createIndexes()));
  console.log(`Mongo indexes ensured for ${indexedModels.length} collections`);
}

