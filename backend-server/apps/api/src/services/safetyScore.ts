import { AdminModerationAction } from "../models/AdminModerationAction.js";
import { Report } from "../models/Report.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";

export function riskLevelFromTrustScore(score: number) {
  if (score >= 80) return "LOW";
  if (score >= 50) return "MEDIUM";
  if (score >= 20) return "HIGH";
  return "CRITICAL";
}

export async function refreshUserSafetyStatus(userId: string, reviewedBy?: string) {
  const [reportCount, confirmedActionCount] = await Promise.all([
    Report.countDocuments({ targetUserId: userId }),
    AdminModerationAction.countDocuments({
      targetUserId: userId,
      actionType: { $in: ["USER_SUSPENDED", "USER_BANNED", "MESSAGE_DELETED", "PROFILE_HIDDEN", "WALLET_FROZEN"] }
    })
  ]);
  const trustScore = Math.max(0, 100 - reportCount * 5 - confirmedActionCount * 15);
  const riskLevel = riskLevelFromTrustScore(trustScore);
  return UserSafetyStatus.findOneAndUpdate(
    { userId },
    {
      $set: {
        trustScore,
        riskLevel,
        reportCount,
        lastReviewedBy: reviewedBy,
        lastReviewedAt: reviewedBy ? new Date() : undefined
      }
    },
    { upsert: true, new: true }
  );
}

export async function flagSafetyState(userId: string, update: Record<string, unknown>, reviewedBy?: string) {
  const status = await refreshUserSafetyStatus(userId, reviewedBy);
  return UserSafetyStatus.findOneAndUpdate(
    { userId },
    {
      $set: {
        ...update,
        trustScore: status.trustScore,
        riskLevel: status.riskLevel,
        lastReviewedBy: reviewedBy,
        lastReviewedAt: reviewedBy ? new Date() : undefined
      }
    },
    { upsert: true, new: true }
  );
}
