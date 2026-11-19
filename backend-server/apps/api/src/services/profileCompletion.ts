export interface ProfileCompletionFields {
  profileCompletedAt?: Date | string | null;
  name?: string | null;
  username?: string | null;
  bio?: string | null;
  city?: string | null;
  interests?: string[] | null;
}

/** Server-owned profile completion contract shared by auth responses and profile updates. */
export function isProfileCompleted(user: ProfileCompletionFields | null | undefined): boolean {
  if (!user) return false;
  if (user.profileCompletedAt) return true;
  return Boolean(
    user.name?.trim() &&
    user.username?.trim() &&
    user.bio?.trim() &&
    user.city?.trim() &&
    Array.isArray(user.interests) &&
    user.interests.some((interest) => interest.trim().length > 0)
  );
}
