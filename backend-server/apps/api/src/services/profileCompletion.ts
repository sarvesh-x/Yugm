export interface ProfileCompletionFields {
  profileCompletedAt?: Date | string | null;
  name?: string | null;
  username?: string | null;
  age?: number | null;
  gender?: string | null;
  bio?: string | null;
  city?: string | null;
  languages?: string[] | null;
  interests?: string[] | null;
  lookingFor?: string | null;
  termsAcceptedAt?: Date | string | null;
}

export const PROFILE_GENDERS = ["Male", "Female", "Non-Binary"] as const;
export const PROFILE_LOOKING_FOR = ["Friendship", "Dating", "Relationship", "Networking"] as const;

const requiredText = (value: string | null | undefined) => Boolean(value?.trim());
const hasText = (items: string[] | null | undefined) => Array.isArray(items) && items.some(requiredText);

/** Server-owned profile completion contract shared by auth responses and profile updates. */
export function isProfileCompleted(user: ProfileCompletionFields | null | undefined): boolean {
  if (!user) return false;
  if (user.profileCompletedAt) return true;
  return Boolean(
    user.name?.trim() &&
    user.username?.trim() &&
    Number.isInteger(user.age) && user.age! >= 18 && user.age! <= 80 &&
    PROFILE_GENDERS.includes(user.gender as typeof PROFILE_GENDERS[number]) &&
    user.bio?.trim() &&
    user.city?.trim() &&
    hasText(user.languages) &&
    hasText(user.interests) &&
    PROFILE_LOOKING_FOR.includes(user.lookingFor as typeof PROFILE_LOOKING_FOR[number]) &&
    Boolean(user.termsAcceptedAt)
  );
}

const OPTIONAL_TEXT_FIELDS = ["bio", "city", "state", "vibeLine", "avatar", "interestedIn"] as const;
const ARRAY_FIELDS = ["interests", "hobbies", "languages"] as const;

/** Normalize user setup writes without turning blank optional values into persisted data. */
export function normalizeProfileUpdate(input: Record<string, unknown>): Record<string, unknown> {
  const normalized: Record<string, unknown> = { ...input };
  if (typeof normalized.name === "string") normalized.name = normalized.name.trim();
  if (typeof normalized.username === "string") normalized.username = normalized.username.trim().toLowerCase();
  if (typeof normalized.gender === "string") normalized.gender = normalized.gender.trim();
  if (typeof normalized.lookingFor === "string") normalized.lookingFor = normalized.lookingFor.trim();
  for (const field of OPTIONAL_TEXT_FIELDS) {
    if (typeof normalized[field] === "string") {
      const value = (normalized[field] as string).trim();
      if (value) normalized[field] = value;
      else delete normalized[field];
    }
  }
  for (const field of ARRAY_FIELDS) {
    if (Array.isArray(normalized[field])) {
      const seen = new Set<string>();
      normalized[field] = (normalized[field] as unknown[])
        .filter((value): value is string => typeof value === "string")
        .map(value => value.trim())
        .filter(value => {
          const key = value.toLocaleLowerCase();
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });
    }
  }
  return normalized;
}
