import type { IUser } from "../models/User.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { hasFirebaseIdentityConflict } from "./authSessionRules.js";

export type AuthUser = Pick<IUser,
  "name" | "username" | "email" | "phone" | "firebaseUid" | "avatar" | "avatarType" |
  "isVerified" | "emailVerified" | "role" | "tokenVersion" | "walletBalance" | "xp" | "lastDailyCheckInAt" |
  "activeCosmetics" | "ownedCosmeticIds" | "vipTier" | "vipLevel" | "vipExp" | "vipStartedAt" | "vipExpiresAt" |
  "vipFrozen" | "vipFreezeStartedAt" | "interests" | "languages" | "city" | "state" | "bio" | "vibeLine" |
  "gender" | "age" | "hobbies" | "interestedIn" | "lookingFor" | "datingAgeMin" | "datingAgeMax" |
  "profileCompletedAt" | "termsAcceptedAt" | "deletionRequestedAt" | "followersCount" | "followingCount"
> & { id: string; avatarParts?: Partial<NonNullable<IUser["avatarParts"]>> | null };

export type IdentityPatch = Partial<Pick<AuthUser,
  "name" | "username" | "email" | "phone" | "firebaseUid" | "avatar" | "isVerified" |
  "emailVerified" | "termsAcceptedAt" | "deletionRequestedAt"
>>;

export type NewAuthUser = Pick<AuthUser, "firebaseUid" | "name" | "username" | "email" | "phone" |
  "avatar" | "termsAcceptedAt" | "emailVerified" | "interests" | "languages" | "walletBalance" | "isVerified">;

export interface AuthAccountStore {
  findById(id: string): Promise<AuthUser | null>;
  findByUid(uid: string): Promise<AuthUser | null>;
  findByEmail(email: string): Promise<AuthUser | null>;
  findByPhones(phones: readonly string[]): Promise<AuthUser | null>;
  usernameExists(username: string): Promise<boolean>;
  insert(user: NewAuthUser): Promise<AuthUser>;
  updateIdentity(user: AuthUser, patch: IdentityPatch): Promise<AuthUser | null>;
  isIdentityConflict(error: unknown): boolean;
}

export function asAuthUser(user: IUser): AuthUser {
  return { ...user.toObject({ minimize: false }), id: String(user._id) };
}

async function generateUniqueUsername(store: AuthAccountStore) {
  for (let i = 0; i < 5; i++) {
    const suffix = Math.random().toString(36).slice(2, 7);
    const username = `vibe_${suffix}`;
    if (!await store.usernameExists(username)) return username;
  }
  return `vibe_${Date.now()}`;
}

function normalizePhone(value?: string) {
  const digits = value?.replace(/[^\d]/g, "");
  return digits ? `+${digits}` : undefined;
}

export async function findOrCreateFirebaseUser(store: AuthAccountStore, input: {
  firebaseUid: string;
  name?: string;
  email?: string;
  phone?: string;
  avatar?: string;
  acceptTerms: boolean;
  emailVerified?: boolean;
}) {
  const email = input.email?.trim().toLowerCase();
  const phone = normalizePhone(input.phone);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const byUid = await store.findByUid(input.firebaseUid);
      const byEmail = !byUid && email ? await store.findByEmail(email) : null;
      const byPhone = !byUid && !byEmail && phone ? await store.findByPhones([phone, phone.slice(1)]) : null;
      const existing = byUid ?? byEmail ?? byPhone;
      if (!existing) {
        const user = await store.insert({
          name: input.name || "Yugm User",
          username: await generateUniqueUsername(store),
          email: email || undefined,
          phone,
          firebaseUid: input.firebaseUid,
          avatar: input.avatar || undefined,
          interests: ["Music", "Chill"],
          languages: ["Hindi", "English"],
          walletBalance: 250,
          isVerified: false,
          termsAcceptedAt: input.acceptTerms ? new Date() : undefined,
          emailVerified: Boolean(input.emailVerified)
        });
        return { user, isNewUser: true };
      }

      if (!byUid && existing.deletionRequestedAt) {
        await store.updateIdentity(existing, {
          name: "Deleted User",
          username: existing.username?.startsWith("deleted_") ? existing.username : `deleted_${existing.id}`,
          emailVerified: false,
          isVerified: false,
          ...(existing.email && { email: undefined }),
          ...(existing.phone && { phone: undefined }),
          ...(existing.firebaseUid && { firebaseUid: undefined })
        });
        continue;
      }
      if (byEmail && !input.emailVerified) {
        throw new HttpError(409, "Verify this email address before linking it to an existing account.", ErrorCode.CONFLICT);
      }
      if (hasFirebaseIdentityConflict(existing.firebaseUid, input.firebaseUid)) {
        throw new HttpError(409, "This account is already linked to another sign-in method. Contact support to recover the account.", ErrorCode.CONFLICT);
      }
      const patch: IdentityPatch = {};
      if (!byUid) patch.firebaseUid = input.firebaseUid;
      if (byUid?.deletionRequestedAt) patch.deletionRequestedAt = undefined;
      if (input.acceptTerms && !existing.termsAcceptedAt) patch.termsAcceptedAt = new Date();
      if (input.emailVerified && !existing.emailVerified) patch.emailVerified = true;
      if (!existing.email && email) patch.email = email;
      if (!existing.phone && phone) patch.phone = phone;
      if ((!existing.name || (byUid && existing.name === "Yugm User")) && input.name) patch.name = input.name;
      if (!existing.avatar && input.avatar) patch.avatar = input.avatar;

      const user = Object.keys(patch).length ? await store.updateIdentity(existing, patch) : existing;
      if (user) return { user, isNewUser: false };
    } catch (error) {
      if (!store.isIdentityConflict(error)) throw error;
    }
  }

  const existing = await store.findByUid(input.firebaseUid);
  if (existing) return { user: existing, isNewUser: false };
  throw new HttpError(409, "Could not finish creating your account. Please retry.", ErrorCode.CONFLICT);
}
