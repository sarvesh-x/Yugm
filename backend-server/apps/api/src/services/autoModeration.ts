import { Report } from "../models/Report.js";
import { ModerationAction } from "../models/ModerationAction.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";

const BLOCKED_KEYWORDS = [
  "spam", "scam", "buy followers", "free coins", "hack", "cheat",
  "nude", "sex", "porn", "xxx", "escort", "casino", "betting",
  "drugs", "weapon", "violence", "hate speech", "racist",
];

const BLOCKED_PATTERNS = [
  /https?:\/\/t\.me\//i,
  /https?:\/\/bit\.ly\//i,
  /@\w+\.(com|org|net|xyz)\b/i,
  /\b\d{10,}\b/g,
];

export interface ModerationResult {
  isClean: boolean;
  flaggedWords: string[];
  severity: "LOW" | "MEDIUM" | "HIGH";
  action?: "BLOCK" | "FLAG";
}

export function moderateContent(text: string): ModerationResult {
  const lower = text.toLowerCase();
  const flaggedWords: string[] = [];

  for (const keyword of BLOCKED_KEYWORDS) {
    if (lower.includes(keyword)) flaggedWords.push(keyword);
  }

  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) {
      flaggedWords.push(`matched pattern: ${pattern.source.slice(0, 20)}`);
    }
  }

  if (flaggedWords.length === 0) return { isClean: true, flaggedWords: [], severity: "LOW" };

  const severity = flaggedWords.length >= 3 ? "HIGH" : flaggedWords.length >= 2 ? "MEDIUM" : "LOW";

  return {
    isClean: false,
    flaggedWords,
    severity,
    action: severity === "HIGH" ? "BLOCK" : "FLAG",
  };
}

export async function applyAutoModeration(userId: string, content: string, context: { type: string; refId?: string }) {
  const result = moderateContent(content);
  if (result.isClean) return result;

  const status = await UserSafetyStatus.findOne({ userId }) || new UserSafetyStatus({ userId });
  status.warningCount = (status.warningCount || 0) + 1;
  status.reportCount = (status.reportCount || 0) + 1;

  if (result.severity === "HIGH" || status.warningCount >= 3) {
    status.isChatRestricted = true;
    status.riskLevel = "HIGH";
    result.action = "BLOCK";

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

  await status.save();
  return result;
}
