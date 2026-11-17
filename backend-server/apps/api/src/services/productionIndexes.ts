import { Block } from "../models/Block.js";
import { ChatMessage } from "../models/ChatMessage.js";
import { Clan } from "../models/Clan.js";
import { ClanMessage } from "../models/ClanMessage.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { CreatorPayoutKyc } from "../models/CreatorPayoutKyc.js";
import { FaceVerificationSubmission } from "../models/FaceVerificationSubmission.js";
import { Follow } from "../models/Follow.js";
import { FriendMatchRequest } from "../models/FriendMatchRequest.js";
import { GiftInventory } from "../models/GiftInventory.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { XpGrant } from "../models/XpGrant.js";
import { Match } from "../models/Match.js";
import { MiniGameChallenge } from "../models/MiniGameChallenge.js";
import { MiniGameScore } from "../models/MiniGameScore.js";
import { Notification } from "../models/Notification.js";
import { Purchase } from "../models/Purchase.js";
import { ProfileVisit } from "../models/ProfileVisit.js";
import { BattlePass } from "../models/BattlePass.js";
import { BattlePassXpGrant } from "../models/BattlePassXpGrant.js";
import { Season } from "../models/Season.js";
import { PayoutReview } from "../models/PayoutReview.js";
import { PkBattle } from "../models/PkBattle.js";
import { PkEvent } from "../models/PkEvent.js";
import { PkInvite } from "../models/PkInvite.js";
import { PkLeaderboardEntry } from "../models/PkLeaderboardEntry.js";
import { PkParticipant } from "../models/PkParticipant.js";
import { PkVote } from "../models/PkVote.js";
import { Relationship } from "../models/Relationship.js";
import { Report } from "../models/Report.js";
import { Room } from "../models/Room.js";
import { RoomFollow } from "../models/RoomFollow.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomInvite } from "../models/RoomInvite.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { SpeakerRequest } from "../models/SpeakerRequest.js";
import { TrustVerification } from "../models/TrustVerification.js";
import { User } from "../models/User.js";
import { VoiceVerificationSubmission } from "../models/VoiceVerificationSubmission.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";

const indexedModels = [
  User,
  Room,
  RoomFollow,
  RoomParticipant,
  ChatMessage,
  DirectMessage,
  Notification,
  DeviceToken,
  Follow,
  FriendMatchRequest,
  Block,
  Match,
  Relationship,
  Clan,
  ClanMessage,
  RoomActivity,
  RoomInvite,
  SpeakerRequest,
  GiftInventory,
  GiftTransaction,
  XpGrant,
  WalletTransaction,
  Purchase,
  ProfileVisit,
  BattlePass,
  BattlePassXpGrant,
  Season,
  Report,
  MiniGameScore,
  MiniGameChallenge,
  TrustVerification,
  FaceVerificationSubmission,
  VoiceVerificationSubmission,
  CreatorPayoutKyc,
  WithdrawalRequest,
  PayoutReview,
  PkBattle,
  PkEvent,
  PkInvite,
  PkLeaderboardEntry,
  PkParticipant,
  PkVote
];

export async function ensureProductionIndexes() {
  // Replace the old sparse compound index. Because `provider` is always set,
  // MongoDB indexed token-less Razorpay rows as null, blocking later orders.
  try {
    await Purchase.collection.dropIndex("provider_1_purchaseToken_1");
  } catch (error) {
    const code = (error as { code?: number })?.code;
    if (code !== 26 && code !== 27) throw error;
  }
  await Promise.all(indexedModels.map((model) => model.createIndexes()));
  console.log(`Mongo indexes ensured for ${indexedModels.length} collections`);
}
