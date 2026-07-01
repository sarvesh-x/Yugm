export interface User {
  _id: string;
  id?: string;
  name: string;
  username: string;
  avatar?: string;
  city?: string;
  bio?: string;
  interests?: string[];
  languages?: string[];
  followersCount?: number;
  followingCount?: number;
  walletBalance?: number;
  isFollowing?: boolean;
  role?: "USER" | "HOST" | "MODERATOR" | "ADMIN";
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
