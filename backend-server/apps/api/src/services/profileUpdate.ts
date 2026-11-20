import { User } from "../models/User.js";
import { grantXp } from "./levels.js";
import { isProfileCompleted, normalizeProfileUpdate } from "./profileCompletion.js";
import { deleteStoredFile, managedAvatarKeyFromUrl } from "./storage.js";
import { ErrorCode, HttpError } from "../utils/http.js";

const PROFILE_FIELDS = [
  "name", "username", "gender", "age", "city", "state", "bio", "vibeLine",
  "interests", "hobbies", "languages", "avatar", "interestedIn", "lookingFor",
  "datingAgeMin", "datingAgeMax"
] as const;

/** Shared canonical mutation used by /users/me and the retained /auth/profile alias. */
export async function updateProfileForUser(userId: string, body: Record<string, unknown>) {
  const normalized = normalizeProfileUpdate(body);
  const update: Record<string, unknown> = {};
  for (const field of PROFILE_FIELDS) {
    if (field in normalized) update[field] = normalized[field];
  }
  const userBefore = await User.findById(userId).select("termsAcceptedAt profileCompletedAt avatar");
  if (!userBefore) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  if (body.acceptTerms === true && !userBefore.termsAcceptedAt) update.termsAcceptedAt = new Date();
  if (typeof update.username === "string") {
    const existing = await User.exists({ username: update.username, _id: { $ne: userId } });
    if (existing) throw new HttpError(409, "That username is already taken. Choose another one.", ErrorCode.CONFLICT);
  }

  let user;
  try {
    // Include the self-only `email` field so the client can keep showing the
    // signed-in address after profile setup/edit responses.
    user = await User.findByIdAndUpdate(userId, { $set: update }, { new: true }).select("-__v +email");
  } catch (error: any) {
    if (error?.code === 11000 && (error?.keyPattern?.username || error?.keyValue?.username)) {
      throw new HttpError(409, "That username is already taken. Choose another one.", ErrorCode.CONFLICT);
    }
    throw error;
  }
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  // A profile PATCH only manages avatar objects it created. Legacy data URLs
  // and external images remain untouched when the user replaces them.
  if (typeof update.avatar === "string" && update.avatar !== userBefore.avatar) {
    const previousKey = managedAvatarKeyFromUrl(userBefore.avatar);
    if (previousKey) {
      await deleteStoredFile("avatars", previousKey).catch((error) => {
        console.warn("[profile] failed to remove the replaced avatar object", error);
      });
    }
  }

  let xpGrant: Awaited<ReturnType<typeof grantXp>> = undefined;
  if (!user.profileCompletedAt && isProfileCompleted(user)) {
    user.profileCompletedAt = new Date();
    await user.save();
    xpGrant = await grantXp(user.id, "PROFILE_COMPLETE", { idempotencyKey: `profile-complete:${user.id}` });
    user = await User.findById(userId).select("-__v +email");
  }
  return { user, xpGrant };
}
