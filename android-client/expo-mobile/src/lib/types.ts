export interface LevelStatus {
  xp: number;
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevel?: number;
  nextLevelXp?: number;
  progressXp: number;
  requiredXp: number;
  progress: number;
  canDailyCheckIn: boolean;
  dailyCheckInXp: number;
}

export interface RelationshipStatus {
  xp: number;
  level: number;
  title: string;
  currentLevelXp: number;
  nextLevel?: number;
  nextLevelXp?: number;
  progressXp: number;
  requiredXp: number;
  progress: number;
  perks?: string[];
  nextPerk?: string;
  streakDays?: number;
  lastInteractionAt?: string;
}

export interface User {
  _id: string;
  id?: string;
  name: string;
  username: string;
  avatar?: string;
  city?: string;
  state?: string;
  bio?: string;
  vibeLine?: string;
  interests?: string[];
  languages?: string[];
  followersCount?: number;
  followingCount?: number;
  walletBalance?: number;
  xp?: number;
  level?: number;
  levelTitle?: string;
  levelStatus?: LevelStatus;
  ownedCosmeticIds?: string[];
  activeCosmetics?: {
    avatarFrame?: string;
    profileTheme?: string;
    entranceEffect?: string;
  };
  isVip?: boolean;
  vipTier?: string;
  vipStartedAt?: string;
  vipExpiresAt?: string;
  isFollowing?: boolean;
  role?: "USER" | "HOST" | "MODERATOR" | "ADMIN";
  age?: number;
  gender?: string;
  interestedIn?: string;
  lookingFor?: string;
  datingAgeMin?: number;
  datingAgeMax?: number;
}

export interface Room {
  _id: string;
  title: string;
  description?: string;
  type: "VOICE" | "VIDEO";
  hostId: User;
  coverImage?: string;
  category: string;
  tags: string[];
  language: string;
  status: "LIVE" | "ENDED" | "SCHEDULED";
  participantCount: number;
  maxSpeakers: number;
  scheduledFor?: string;
}

export interface Gift {
  _id: string;
  name: string;
  icon: string;
  coinPrice: number;
}
