import { ChatMessage } from "../models/ChatMessage.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { ModerationAction } from "../models/ModerationAction.js";
import { Report } from "../models/Report.js";
import { User } from "../models/User.js";
import { createNotification } from "./notifications.js";

type ReportPayload = {
  targetUserId?: string;
  roomId?: string;
  reason: string;
  description?: string;
};

async function buildEvidence(payload: ReportPayload, reporterId: string) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [roomMessages, directMessages, recentReporters] = await Promise.all([
    payload.roomId
      ? ChatMessage.find({ roomId: payload.roomId }).sort({ createdAt: -1 }).limit(20).lean()
      : Promise.resolve([]),
    payload.targetUserId
      ? DirectMessage.find({
          createdAt: { $gte: since },
          $or: [
            { senderId: reporterId, receiverId: payload.targetUserId },
            { senderId: payload.targetUserId, receiverId: reporterId }
          ]
        }).sort({ createdAt: -1 }).limit(20).lean()
      : Promise.resolve([]),
    payload.targetUserId
      ? Report.distinct("reporterId", { targetUserId: payload.targetUserId, createdAt: { $gte: since } })
      : Promise.resolve([])
  ]);

  return {
    roomMessages: roomMessages.reverse().map((message: any) => ({
      senderId: message.senderId?.toString?.(),
      message: message.message,
      createdAt: message.createdAt
    })),
    directMessages: directMessages.reverse().map((message: any) => ({
      senderId: message.senderId?.toString?.(),
      receiverId: message.receiverId?.toString?.(),
      message: message.message,
      createdAt: message.createdAt
    })),
    recentUniqueReporterCount: new Set([...recentReporters.map(String), reporterId]).size
  };
}

export async function createReportWithEvidence(payload: ReportPayload, reporterId: string) {
  const evidence = await buildEvidence(payload, reporterId);
  const riskScore = evidence.recentUniqueReporterCount * 25
    + Math.min(evidence.roomMessages.length + evidence.directMessages.length, 20);
  const report = await Report.create({
    ...payload,
    reporterId,
    evidence,
    riskScore,
    autoFlagged: riskScore >= 75
  });

  if (payload.targetUserId && evidence.recentUniqueReporterCount >= 3) {
    const target = await User.findById(payload.targetUserId).select("mutedUntil tokenVersion").lean();
    const alreadyMuted = target?.mutedUntil && new Date(target.mutedUntil).getTime() > Date.now();
    if (!alreadyMuted) {
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await Promise.all([
        User.findByIdAndUpdate(payload.targetUserId, {
          $set: {
            mutedUntil: expiresAt,
            moderationReason: "Auto-muted after multiple unique reports in 24 hours"
          },
          $inc: { moderationStrikes: 1 }
        }),
        ModerationAction.create({
          targetUserId: payload.targetUserId,
          reportId: report._id,
          action: "MUTE",
          reason: "Auto-muted after multiple unique reports in 24 hours",
          durationHours: 12,
          expiresAt,
          automated: true
        }),
        Report.findByIdAndUpdate(report._id, { status: "ACTION_TAKEN", autoActionTaken: "MUTE_12H" }),
        createNotification(payload.targetUserId, "SYSTEM", "Account muted", "You were muted for 12 hours after multiple reports. Keep chats respectful.", { reportId: report._id.toString() })
      ]);
    }
  }

  return Report.findById(report._id).lean();
}
