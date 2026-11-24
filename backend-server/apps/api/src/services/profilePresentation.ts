import { getLevelStatus } from "./levels.js";
import { isProfileCompleted } from "./profileCompletion.js";
import { getVipStatus } from "./vip.js";

export function serializePublicProfile(user: any, isOnline: boolean) {
  const levelStatus = getLevelStatus(user);
  return {
    id: user.id,
    _id: user._id?.toString?.() ?? user.id,
    name: user.name,
    username: user.username,
    avatar: user.avatar,
    avatarType: user.avatarType,
    avatarParts: user.avatarParts,
    role: user.role,
    walletBalance: user.walletBalance,
    xp: levelStatus.xp,
    level: levelStatus.level,
    levelTitle: levelStatus.title,
    levelStatus,
    activeCosmetics: user.activeCosmetics,
    ownedCosmeticIds: user.ownedCosmeticIds,
    ...getVipStatus(user),
    interests: user.interests,
    hobbies: user.hobbies,
    languages: user.languages,
    profileMedia: user.profileMedia,
    bondsCount: user.bondsCount ?? 0,
    clanId: user.clanId?.toString?.() ?? user.clanId,
    isOnline,
    city: user.city,
    state: user.state,
    bio: user.bio,
    profileCompleted: isProfileCompleted(user),
    streakCount: user.streakCount ?? 0,
    vibeLine: user.vibeLine,
    gender: user.gender,
    age: user.age,
    followersCount: user.followersCount,
    followingCount: user.followingCount,
    friendsCount: user.friendsCount ?? 0,
    interestedIn: user.interestedIn,
    lookingFor: user.lookingFor,
    datingAgeMin: user.datingAgeMin,
    datingAgeMax: user.datingAgeMax,
    isFollowing: user.isFollowing,
    isBonded: user.isBonded, isVerified: Boolean(user.isVerified), verificationLevel: user.verificationLevel ?? (user.isVerified ? "BASIC" : "NONE"), showcasedBadgeIds: user.showcasedBadgeIds ?? []
  };
}
