import { Router } from "express";
import { z } from "zod";
import { moderationActionSchema, reportSchema } from "@yugm/shared";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { reportLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { Report } from "../models/Report.js";
import { ModerationAction } from "../models/ModerationAction.js";
import { User } from "../models/User.js";
import { createReportWithEvidence } from "../services/moderation.js";
import { createNotification } from "../services/notifications.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";

const updateReportStatusSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "ACTION_TAKEN", "DISMISSED"]),
  moderatorNote: z.string().max(500).optional()
});

export const reportsRouter = Router();

reportsRouter.post("/reports", requireAuth, reportLimiter, validateBody(reportSchema), asyncHandler(async (req: AuthRequest, res) => {
  const report = await createReportWithEvidence(req.body, req.user!.id);
  sendOk(res, { report }, 201);
}));

reportsRouter.get("/admin/reports", requireAuth, requireRole("ADMIN", "MODERATOR"), asyncHandler(async (_req, res) => {
  const limit = Math.min(Number(_req.query.limit) || 100, 200);
  const reports = await Report.find().populate("reporterId targetUserId roomId").sort({ createdAt: -1 }).limit(limit).lean();
  sendOk(res, { reports });
}));

reportsRouter.patch("/admin/reports/:id", requireAuth, requireRole("ADMIN", "MODERATOR"), asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid report ID", ErrorCode.VALIDATION);
  const parsed = updateReportStatusSchema.parse(req.body);
  const report = await Report.findByIdAndUpdate(req.params.id, { status: parsed.status, moderatorNote: parsed.moderatorNote, reviewedBy: (req as AuthRequest).user!.id, reviewedAt: new Date() }, { new: true });
  if (!report) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
  sendOk(res, { report });
}));

reportsRouter.get("/admin/moderation/actions", requireAuth, requireRole("ADMIN", "MODERATOR"), asyncHandler(async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const actions = await ModerationAction.find()
    .populate("targetUserId", "name username avatar role isBlocked mutedUntil suspendedUntil moderationStrikes")
    .populate("moderatorId", "name username role")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { actions });
}));

reportsRouter.get("/admin/users/:id/moderation", requireAuth, requireRole("ADMIN", "MODERATOR"), asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const user = await User.findById(req.params.id).select("name username role isBlocked mutedUntil suspendedUntil moderationStrikes moderationReason").lean();
  if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const actions = await ModerationAction.find({ targetUserId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean();
  const reports = await Report.find({ targetUserId: req.params.id }).sort({ createdAt: -1 }).limit(50).lean();
  sendOk(res, { user, actions, reports });
}));

reportsRouter.post("/admin/moderation/actions", requireAuth, requireRole("ADMIN", "MODERATOR"), validateBody(moderationActionSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (req.body.targetUserId === req.user!.id) throw new HttpError(400, "You cannot moderate yourself", ErrorCode.VALIDATION);

  const target = await User.findById(req.body.targetUserId);
  if (!target) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  if (target.role === "ADMIN" && req.user!.role !== "ADMIN") throw new HttpError(403, "Only admins can moderate admins", ErrorCode.FORBIDDEN);

  const now = new Date();
  const expiresAt = req.body.durationHours ? new Date(now.getTime() + req.body.durationHours * 60 * 60 * 1000) : undefined;
  let update: Record<string, unknown> = { moderationReason: req.body.reason };
  if (req.body.action === "WARN") update.$inc = { moderationStrikes: 1 };
  if (req.body.action === "MUTE") Object.assign(update, { mutedUntil: expiresAt, $inc: { moderationStrikes: 1 } });
  if (req.body.action === "SUSPEND") Object.assign(update, { suspendedUntil: expiresAt, $inc: { moderationStrikes: 1 } });
  if (req.body.action === "BAN") Object.assign(update, { isBlocked: true, tokenVersion: target.tokenVersion + 1, $inc: { moderationStrikes: 1 } });
  if (req.body.action === "UNBAN") update = { $set: { isBlocked: false }, $unset: { suspendedUntil: "", mutedUntil: "", moderationReason: "" } };

  const [action] = await Promise.all([
    ModerationAction.create({
      targetUserId: target.id,
      moderatorId: req.user!.id,
      reportId: req.body.reportId,
      action: req.body.action,
      reason: req.body.reason,
      durationHours: req.body.durationHours,
      expiresAt
    }),
    User.findByIdAndUpdate(target.id, update),
    req.body.reportId ? Report.findByIdAndUpdate(req.body.reportId, { status: "ACTION_TAKEN", reviewedBy: req.user!.id, reviewedAt: now }) : Promise.resolve()
  ]);

  await createNotification(target.id, "SYSTEM", "Moderation action", `${req.body.action}: ${req.body.reason}`, { actionId: action._id.toString() });
  const user = await User.findById(target.id).select("name username role isBlocked mutedUntil suspendedUntil moderationStrikes moderationReason").lean();
  sendOk(res, { action, user }, 201);
}));
