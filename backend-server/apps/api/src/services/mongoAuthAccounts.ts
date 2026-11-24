import { User } from "../models/User.js";
import { asAuthUser, type AuthAccountStore, type IdentityPatch } from "./authAccounts.js";

const identityFields = "+email +phone -__v";

export const mongoAuthAccountStore: AuthAccountStore = {
  async findById(id) {
    const user = await User.findById(id).select(identityFields);
    return user && asAuthUser(user);
  },
  async findByUid(firebaseUid) {
    const user = await User.findOne({ firebaseUid }).select(identityFields);
    return user && asAuthUser(user);
  },
  async findByEmail(email) {
    const user = await User.findOne({ email }).select("+email -__v");
    return user && asAuthUser(user);
  },
  async findByPhones(phones) {
    const user = await User.findOne({ phone: { $in: phones } }).select(identityFields);
    return user && asAuthUser(user);
  },
  async usernameExists(username) {
    return Boolean(await User.exists({ username }));
  },
  async insert(input) {
    return asAuthUser(await User.create(input));
  },
  async updateIdentity(user, patch) {
    const guards: Record<string, unknown> = {
      _id: user.id, firebaseUid: user.firebaseUid ?? null, deletionRequestedAt: user.deletionRequestedAt ?? null
    };
    const $set: Record<string, unknown> = {};
    const $unset: Record<string, ""> = {};
    for (const key of Object.keys(patch) as (keyof IdentityPatch)[]) {
      guards[key] = user[key] ?? null;
      if (patch[key] === undefined) $unset[key] = "";
      else $set[key] = patch[key];
    }
    const updated = await User.findOneAndUpdate(guards, { $set, $unset }, { new: true }).select(identityFields);
    return updated && asAuthUser(updated);
  },
  isIdentityConflict(error) {
    return (error as { code?: number } | null)?.code === 11000;
  }
};
