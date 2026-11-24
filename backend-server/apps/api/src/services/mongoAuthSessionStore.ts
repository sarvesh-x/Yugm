import { AuthSession } from "../models/AuthSession.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { User } from "../models/User.js";
import type { AuthSessionStore } from "./authSessionStore.js";

export const mongoAuthSessionStore: AuthSessionStore = {
  async findAccount(userId) {
    const user = await User.findById(userId).select("role tokenVersion isBlocked");
    return user && { id: userId, role: user.role, tokenVersion: user.tokenVersion, isBlocked: user.isBlocked };
  },

  async findRefreshSession(refreshHash) {
    const row = await AuthSession.findOne({ refreshHash });
    if (!row) return null;
    return {
      id: row.id, userId: row.userId.toString(), familyId: row.familyId,
      tokenVersion: row.tokenVersion ?? undefined,
      expiresAt: row.expiresAt, revokedAt: row.revokedAt ?? null, replacedByHash: row.replacedByHash ?? null
    };
  },

  async issue(userId, familyId, next, now) {
    const user = await User.findByIdAndUpdate(userId, { $inc: { tokenVersion: 1 } }, { new: true }).select("tokenVersion");
    if (!user) return null;
    const { tokenVersion } = user;
    await AuthSession.updateMany({
      userId, revokedAt: null,
      $or: [{ tokenVersion: { $lt: tokenVersion } }, { tokenVersion: { $exists: false } }]
    }, { $set: { revokedAt: now } });
    const session = await AuthSession.create({ ...next, userId, familyId, tokenVersion });
    return { id: session.id, tokenVersion };
  },

  async rotate(old, tokenVersion, replacement, now) {
    const claimed = await AuthSession.findOneAndUpdate(
      { _id: old.id, revokedAt: null, replacedByHash: null, expiresAt: { $gt: now } },
      { $set: { revokedAt: now, replacedByHash: replacement.refreshHash, lastUsedAt: now } },
      { new: true }
    );
    if (!claimed) return null;
    const next = await AuthSession.create({ ...replacement, userId: old.userId, familyId: old.familyId, tokenVersion });
    return next.id;
  },

  async revokeById(sessionId, now) {
    await AuthSession.updateOne({ _id: sessionId, revokedAt: null }, { $set: { revokedAt: now } });
  },

  async revokeFamily(familyId, now) {
    await AuthSession.updateMany({ familyId, revokedAt: null }, { $set: { revokedAt: now } });
  },

  async revokeAll(userId, now) {
    await AuthSession.updateMany({ userId, revokedAt: null }, { $set: { revokedAt: now } });
  },

  async logout(userId, refreshHash, now, deviceToken) {
    if (deviceToken) await DeviceToken.deleteOne({ userId, token: deviceToken });
    if (refreshHash) {
      await AuthSession.updateOne({ refreshHash, userId, revokedAt: null }, { $set: { revokedAt: now } });
    }
    await User.updateOne({ _id: userId }, { $inc: { tokenVersion: 1 } });
    await mongoAuthSessionStore.revokeAll(userId, now);
  }
};
