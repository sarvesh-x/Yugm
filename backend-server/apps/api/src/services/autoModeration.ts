import { Report } from "../models/Report.js";
import { ModerationAction } from "../models/ModerationAction.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { User } from "../models/User.js";
import { moderateContent, type ModerationResult } from "./contentModeration.js";

export { moderateContent, type ModerationResult } from "./contentModeration.js";

export async function applyAutoModeration(
  userId: string,
  content: string,
  _context: { type: string; refId?: string },
): Promise<ModerationResult> {
  const result = moderateContent(content);
  if (result.isClean) return { ...result, action: undefined };

  const status = await UserSafetyStatus.findOne({ userId }) || new UserSafetyStatus({ userId });
  status.warningCount = (status.warningCount || 0) + 1;
  status.reportCount = (status.reportCount || 0) + 1;

  if (result.severity === "HIGH" || status.warningCount >= 3) {
    status.isChatRestricted = true;
    status.riskLevel = "HIGH";

    await ModerationAction.create({
      targetUserId: userId,
      action: "MUTE",
      reason: `Auto-moderation: ${result.flaggedWords.join(", ")}`,
      durationHours: status.warningCount >= 5 ? 48 : 24,
      automated: true,
    });
  }

  if (status.warningCount >= 5) {
    status.isRoomRestricted = true;
    status.riskLevel = "CRITICAL";
  }

  if (status.warningCount >= 8 && !status.isShadowBanned) {
    status.isShadowBanned = true;
    status.trustScore = Math.max(0, (status.trustScore || 100) - 30);
    await User.findByIdAndUpdate(userId, {
      $inc: { moderationStrikes: 1 },
      moderationReason: "Shadow banned: repeated moderation violations",
    });
  }

  if (status.trustScore !== undefined) {
    status.riskLevel =
      status.trustScore >= 80 ? "LOW" :
      status.trustScore >= 50 ? "MEDIUM" :
      status.trustScore >= 20 ? "HIGH" :
      "CRITICAL";
  }

  await status.save();

  return result;
}
