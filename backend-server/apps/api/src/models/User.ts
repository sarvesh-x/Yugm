import mongoose, { Schema } from "mongoose";
import type { UserRole } from "@yugm/shared";

export interface IUser extends mongoose.Document {
  name: string;
  username: string;
  email?: string;
  phone?: string;
  firebaseUid?: string;
  avatar?: string;
  gender?: string;
  age?: number;
  city?: string;
  state?: string;
  bio?: string;
  vibeLine?: string;
  interests: string[];
  hobbies: string[];
  languages: string[];
  profileMedia: Array<{
    url: string;
    type: "IMAGE" | "VIDEO";
    caption?: string;
    createdAt: Date;
  }>;
  closeFriendIds: mongoose.Types.ObjectId[];
  clanId?: mongoose.Types.ObjectId;
  role: UserRole;
  isVerified: boolean;
  emailVerified: boolean;
  isBlocked: boolean;
  followersCount: number;
  followingCount: number;
  walletBalance: number;
  xp: number;
  level: number;
  levelTitle?: string;
  lastDailyCheckInAt?: Date;
  streakCount: number;
  profileCompletedAt?: Date;
  deletionRequestedAt?: Date;
  ownedCosmeticIds: string[];
  claimedAchievementIds: string[];
  claimedAchievementTiers: Array<{ achievementId: string; tier: string; claimedAt: Date }>;
  showcasedBadgeIds: string[];
  activeCosmetics: {
    avatarAsset?: string;
    avatarFrame?: string;
    speakingWave?: string;
    profileTheme?: string;
    entranceEffect?: string;
    profileBadge?: string;
    nameStyle?: string;
    roomEntry?: string;
    moodStatus?: string;
    profileMusic?: string;
    voiceBadge?: string;
    roomTheme?: string;
    avatarDecoration?: string;
    reactionPack?: string;
    profileLayout?: string;
    profileBanner?: string;
    introCard?: string;
    collectibleTitle?: string;
    giftShelf?: string;
    chatBubble?: string;
    seasonalEvent?: string;
    videoCallOverlay?: string;
    roomBadge?: string;
    roomAmbience?: string;
  };
  vipTier?: string;
  vipStartedAt?: Date;
  vipExpiresAt?: Date;
  moderationStrikes: number;
  mutedUntil?: Date;
  suspendedUntil?: Date;
  moderationReason?: string;
  tokenVersion: number;
  notificationPreferences?: {
    roomInvites?: boolean;
    messages?: boolean;
    gifts?: boolean;
    follows?: boolean;
    hostGoingLive?: boolean;
    wallet?: boolean;
    safety?: boolean;
    marketing?: boolean;
  };
  interestedIn?: string;
  lookingFor?: string;
  datingAgeMin?: number;
  datingAgeMax?: number;
  datingVerifiedOnly?: boolean;
  referralCode: string;
  referredBy?: mongoose.Types.ObjectId;
  referralRewardsClaimed: number;
  termsAcceptedAt?: Date;
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    username: { type: String, required: true, unique: true, lowercase: true, trim: true },
    // Contact identifiers are used for identity matching only. Keep them out of
    // ordinary User queries so a new populate/serialization cannot expose them.
    email: { type: String, lowercase: true, trim: true, select: false },
    phone: { type: String, trim: true, select: false },
    firebaseUid: String,
    avatar: String,
    gender: String,
    age: Number,
    city: String,
    state: String,
    bio: String,
    vibeLine: String,
    interests: [{ type: String }],
    hobbies: [{ type: String }],
    languages: [{ type: String }],
    profileMedia: [{
      url: { type: String, required: true },
      type: { type: String, enum: ["IMAGE", "VIDEO"], default: "IMAGE" },
      caption: { type: String, trim: true },
      createdAt: { type: Date, default: Date.now }
    }],
    closeFriendIds: [{ type: Schema.Types.ObjectId, ref: "User" }],
    clanId: { type: Schema.Types.ObjectId, ref: "Clan" },
    role: { type: String, enum: ["USER", "HOST", "MODERATOR", "ADMIN"], default: "USER" },
    isVerified: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    isBlocked: { type: Boolean, default: false },
    followersCount: { type: Number, default: 0 },
    followingCount: { type: Number, default: 0 },
    walletBalance: { type: Number, default: 0 },
    xp: { type: Number, default: 0 },
    level: { type: Number, default: 1 },
    levelTitle: { type: String, default: "New Vibe" },
    lastDailyCheckInAt: Date,
    streakCount: { type: Number, default: 0 },
    profileCompletedAt: Date,
    deletionRequestedAt: Date,
    termsAcceptedAt: Date,
    ownedCosmeticIds: [{ type: String }],
    claimedAchievementIds: [{ type: String }],
    claimedAchievementTiers: [{
      achievementId: { type: String, required: true },
      tier: { type: String, enum: ["BRONZE", "SILVER", "GOLD", "PLATINUM"], required: true },
      claimedAt: { type: Date, default: Date.now }
    }],
    showcasedBadgeIds: [{ type: String }],
    activeCosmetics: {
      avatarAsset: String,
      avatarFrame: String,
      speakingWave: String,
      profileTheme: String,
      entranceEffect: String,
      profileBadge: String,
      nameStyle: String,
      roomEntry: String,
      moodStatus: String,
      profileMusic: String,
      voiceBadge: String,
      roomTheme: String,
      avatarDecoration: String,
      reactionPack: String,
      profileLayout: String,
      profileBanner: String,
      introCard: String,
      collectibleTitle: String,
      giftShelf: String,
      chatBubble: String,
      seasonalEvent: String,
      videoCallOverlay: String,
      roomBadge: String,
      roomAmbience: String
    },
    vipTier: String,
    vipStartedAt: Date,
    vipExpiresAt: Date,
    moderationStrikes: { type: Number, default: 0 },
    mutedUntil: Date,
    suspendedUntil: Date,
    moderationReason: String,
    tokenVersion: { type: Number, default: 0 },
    notificationPreferences: {
      roomInvites: { type: Boolean, default: true },
      messages: { type: Boolean, default: true },
      gifts: { type: Boolean, default: true },
      follows: { type: Boolean, default: true },
      hostGoingLive: { type: Boolean, default: true },
      wallet: { type: Boolean, default: true },
      safety: { type: Boolean, default: true },
      marketing: { type: Boolean, default: false }
    },
    interestedIn: String,
    lookingFor: String,
    datingAgeMin: Number,
    datingAgeMax: Number,
    datingVerifiedOnly: { type: Boolean, default: false },
    referralCode: { type: String, unique: true, sparse: true },
    referredBy: { type: Schema.Types.ObjectId, ref: "User" },
    referralRewardsClaimed: { type: Number, default: 0 },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 }, { unique: true, partialFilterExpression: { email: { $type: "string" } } });
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: "string" } } });
userSchema.index({ firebaseUid: 1 }, { unique: true, partialFilterExpression: { firebaseUid: { $type: "string" } } });
userSchema.index({ vipExpiresAt: -1 });
userSchema.index({ mutedUntil: 1 });
userSchema.index({ suspendedUntil: 1 });
userSchema.index({ level: -1, xp: -1 });
userSchema.index({ clanId: 1 });
userSchema.index({ deletionRequestedAt: 1 });

export const User = mongoose.model<IUser>("User", userSchema);
