export const AUTH_PROFILE_FIELDS = [
  "email", "avatar", "avatarType", "walletBalance", "vipTier", "vipStartedAt", "city", "state", "bio",
  "vibeLine", "gender", "age", "interestedIn", "lookingFor", "datingAgeMin", "datingAgeMax", "followersCount", "followingCount"
] as const;

export const AUTH_PROFILE_ARRAYS = {
  ownedCosmeticIds: "user_owned_cosmetics",
  interests: "user_interests",
  languages: "user_languages",
  hobbies: "user_hobbies"
} as const;

export const AVATAR_PART_KEYS = ["background", "clothes", "head", "mouth", "eyes", "top"] as const;
export const ACTIVE_COSMETIC_KEYS = [
  "avatarAsset", "avatarFrame", "speakingWave", "profileTheme", "entranceEffect",
  "profileBadge", "nameStyle", "roomEntry", "moodStatus", "profileMusic",
  "voiceBadge", "roomTheme", "avatarDecoration", "reactionPack", "profileLayout",
  "profileBanner", "introCard", "collectibleTitle", "giftShelf", "chatBubble",
  "seasonalEvent", "videoCallOverlay", "roomBadge", "roomAmbience"
] as const;

export const PROFILE_NESTED_FIELDS = [["avatarParts", AVATAR_PART_KEYS], ["activeCosmetics", ACTIVE_COSMETIC_KEYS]] as const;
const fieldsWithD1Defaults = [...Object.keys(AUTH_PROFILE_ARRAYS), "role", "walletBalance", "avatarParts", "activeCosmetics", "profileMedia"];

export function missingProfileFields(record: Record<string, unknown>) {
  return fieldsWithD1Defaults.filter(key => record[key] === undefined);
}

export function authProfileNullFields(record: Record<string, unknown>) {
  const keys = [...new Set([...AUTH_PROFILE_FIELDS, ...fieldsWithD1Defaults, "clanId"])];
  const nulls = keys.filter((key) => record[key] === null);
  for (const [field, parts] of PROFILE_NESTED_FIELDS) {
    const values = record[field];
    if (values && typeof values === "object") {
      for (const key of parts) {
        if (Object.hasOwn(values, key) && (values as Record<string, unknown>)[key] === null) {
          nulls.push(`${field}.${key}`);
        }
      }
    }
  }
  if (Array.isArray(record.profileMedia)) {
    record.profileMedia.forEach((item, index) => {
      if (item && typeof item === "object" && item.caption === null) nulls.push(`profileMedia.${index}.caption`);
    });
  }
  return nulls;
}
