import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { ModerationQueue } from "../models/ModerationQueue.js";
import { ModerationAction } from "../models/ModerationAction.js";
import { Report } from "../models/Report.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { User } from "../models/User.js";
import { classifyToxicity, toxicitySeverity, isModelReady, isModelLoading } from "../services/aiModeration.js";
import { moderateContent } from "../services/autoModeration.js";
import { createReportWithEvidence } from "../services/moderation.js";
import { asyncHandler, sendOk } from "../utils/http.js";

const router = Router();

const checkTextSchema = z.object({
  text: z.string().min(1).max(2000),
  context: z.enum(["chat", "profile", "room_title", "room_description", "clan", "message"]).optional().default("chat"),
});

router.post("/v1/moderation/check-text", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { text, context } = checkTextSchema.parse(req.body);

  const keywordResult = moderateContent(text);
  const aiResult = await classifyToxicity(text);

  const keywordSeverity = keywordResult.severity;
  const aiSeverity = toxicitySeverity(aiResult);
  const overallSeverity = keywordSeverity === "HIGH" || aiSeverity === "HIGH"
    ? "HIGH"
    : keywordSeverity === "MEDIUM" || aiSeverity === "MEDIUM"
      ? "MEDIUM"
      : "LOW";

  const isFlagged = !keywordResult.isClean || !aiResult.isClean;
  const isBlocked = overallSeverity === "HIGH" || (!keywordResult.isClean && keywordResult.action === "BLOCK");

  sendOk(res, {
    text,
    context,
    isClean: !isFlagged,
    isBlocked,
    severity: overallSeverity,
    keywordFlags: keywordResult.flaggedWords,
    aiFlags: aiResult.flaggedLabels,
    toxicityScores: {
      toxicity: aiResult.toxicityScore,
      severeToxicity: aiResult.severeToxicityScore,
      identityAttack: aiResult.identityAttackScore,
      insult: aiResult.insultScore,
      threat: aiResult.threatScore,
      sexuallyExplicit: aiResult.sexuallyExplicitScore,
    },
    topLabel: aiResult.topLabel,
    aiModelReady: isModelReady(),
    aiModelLoading: isModelLoading(),
  });
}));

const reportSchema = z.object({
  targetUserId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  roomId: z.string().regex(/^[0-9a-fA-F]{24}$/).optional(),
  messageId: z.string().optional(),
  category: z.enum(["harassment", "spam", "nudity", "hate_speech", "violence", "scam", "impersonation", "other"]),
  description: z.string().max(1000).optional(),
});

router.post("/v1/moderation/report", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { targetUserId, roomId, messageId, category, description } = reportSchema.parse(req.body);

  const report = await Report.create({
    reporterId: req.user!._id,
    targetUserId,
    roomId,
    reason: category,
    description: description || "",
    evidence: messageId ? { messageId } : {},
    status: "PENDING",
  });

  const queueItem = await ModerationQueue.create({
    reportId: report._id,
    targetType: targetUserId ? "USER" : roomId ? "ROOM" : "MESSAGE",
    targetId: targetUserId || roomId || messageId,
    targetUserId: targetUserId || undefined,
    priority: category === "violence" || category === "nudity" ? "HIGH" : "MEDIUM",
    reason: category,
    aiScore: 0,
  });

  sendOk(res, { reportId: report._id, queueId: queueItem._id, status: "PENDING" }, 201);
}));

const appealSchema = z.object({
  actionId: z.string().regex(/^[0-9a-fA-F]{24}$/),
  reason: z.string().min(10).max(2000),
});

router.post("/v1/moderation/appeal", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { actionId, reason } = appealSchema.parse(req.body);

  const action = await ModerationAction.findById(actionId);
  if (!action) {
    return res.status(404).json({ ok: false, error: { message: "Moderation action not found" } });
  }

  if (action.targetUserId.toString() !== req.user!._id.toString()) {
    return res.status(403).json({ ok: false, error: { message: "You can only appeal your own actions" } });
  }

  if (action.action === "UNBAN") {
    return res.status(400).json({ ok: false, error: { message: "Cannot appeal an already resolved action" } });
  }

  const queueItem = await ModerationQueue.create({
    targetType: "USER",
    targetId: req.user!._id,
    targetUserId: req.user!._id,
    priority: "HIGH",
    reason: `Appeal: ${reason.slice(0, 80)}`,
    notes: reason,
  });

  sendOk(res, { appealId: queueItem._id, status: "PENDING_REVIEW" });
}));

router.get("/v1/moderation/status", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!._id;

  const [safetyStatus, recentActions, activeQueue] = await Promise.all([
    UserSafetyStatus.findOne({ userId }),
    ModerationAction.find({ targetUserId: userId }).sort({ createdAt: -1 }).limit(10).lean(),
    ModerationQueue.countDocuments({ targetUserId: userId, status: "PENDING" }),
  ]);

  const user = await User.findById(userId).select("moderationStrikes moderationReason").lean();

  sendOk(res, {
    trustScore: safetyStatus?.trustScore ?? 100,
    riskLevel: safetyStatus?.riskLevel ?? "LOW",
    isShadowBanned: safetyStatus?.isShadowBanned ?? false,
    isChatRestricted: safetyStatus?.isChatRestricted ?? false,
    isRoomRestricted: safetyStatus?.isRoomRestricted ?? false,
    isWalletFrozen: safetyStatus?.isWalletFrozen ?? false,
    moderationStrikes: user?.moderationStrikes ?? 0,
    moderationReason: user?.moderationReason ?? null,
    warningCount: safetyStatus?.warningCount ?? 0,
    reportCount: safetyStatus?.reportCount ?? 0,
    suspensionCount: safetyStatus?.suspensionCount ?? 0,
    pendingAppeals: activeQueue,
    recentActions: recentActions.map(a => ({
      id: a._id,
      action: a.action,
      reason: a.reason,
      automated: a.automated,
      createdAt: a.createdAt,
      expiresAt: a.expiresAt,
    })),
  });
}));

router.post("/v1/moderation/check-voice", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const { transcript } = req.body;
  if (!transcript || typeof transcript !== "string") {
    return res.status(400).json({ ok: false, error: { message: "Transcript is required" } });
  }

  const aiResult = await classifyToxicity(transcript);
  const keywordResult = moderateContent(transcript);

  sendOk(res, {
    transcript,
    isClean: aiResult.isClean && keywordResult.isClean,
    severity: toxicitySeverity(aiResult),
    keywordFlags: keywordResult.flaggedWords,
    aiFlags: aiResult.flaggedLabels,
    toxicityScores: {
      toxicity: aiResult.toxicityScore,
      severeToxicity: aiResult.severeToxicityScore,
      identityAttack: aiResult.identityAttackScore,
      insult: aiResult.insultScore,
      threat: aiResult.threatScore,
    },
  });
}));

export default router;
