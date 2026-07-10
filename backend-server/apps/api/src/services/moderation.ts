import { ChatMessage } from "../models/ChatMessage.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { ModerationAction } from "../models/ModerationAction.js";
import { Report } from "../models/Report.js";
import { Room } from "../models/Room.js";
import { User } from "../models/User.js";
import { createNotification } from "./notifications.js";
import { ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";

type ReportPayload = {
  targetUserId?: string;
  roomId?: string;
  reason: string;
  description?: string;
};

async function validateReportTargets(payload: ReportPayload, reporterId: string) {
  if (payload.targetUserId) {
    if (!isValidObjectId(payload.targetUserId)) {
      throw new HttpError(400, "Invalid target user ID", ErrorCode.VALIDATION);
    }
    if (payload.targetUserId === reporterId) {
      throw new HttpError(400, "You cannot report yourself", ErrorCode.VALIDATION);
    }
  }
  if (payload.roomId && !isValidObjectId(payload.roomId)) {
    throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  }

  const [targetUser, room] = await Promise.all([
    payload.targetUserId ? User.findById(payload.targetUserId).select("_id").lean() : Promise.resolve(null),
    payload.roomId ? Room.findById(payload.roomId).select("_id").lean() : Promise.resolve(null)
  ]);
  if (payload.targetUserId && !targetUser) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  if (payload.roomId && !room) throw new HttpError(404, "Room not found", ErrorCode.NOT_FOUND);
}

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
  await validateReportTargets(payload, reporterId);
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
