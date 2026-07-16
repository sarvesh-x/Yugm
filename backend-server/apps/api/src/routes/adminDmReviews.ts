import { Router } from "express";
import { requireAdminAuth, requirePermission, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { DirectMessage } from "../models/DirectMessage.js";
import { ModerationQueue } from "../models/ModerationQueue.js";
import { ModerationAction } from "../models/ModerationAction.js";
import { AdminModerationAction } from "../models/AdminModerationAction.js";
import { Report } from "../models/Report.js";
import { recordAuditLog } from "../services/auditLog.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";

export const adminDmReviewsRouter = Router();

const noteSchema = z.object({
  adminNotes: z.string().max(2000).optional()
});

adminDmReviewsRouter.get("/dm-reviews", requireAdminAuth, requirePermission("messages.read_private"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const status = String(req.query.status || "") || undefined;
  const filter: Record<string, unknown> = { targetType: { $in: ["MESSAGE", "CHAT"] } };
  if (status) filter.status = status;
  const [items, total] = await Promise.all([
    ModerationQueue.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip).limit(limit)
      .populate("reportId")
      .populate({ path: "targetUserId", select: "name username avatar" })
      .populate({ path: "resolvedBy", select: "displayName" })
      .lean(),
    ModerationQueue.countDocuments(filter)
  ]);
  const enriched = await Promise.all(items.map(async (item: any) => {
    if (item.targetType === "MESSAGE" && item.targetId) {
      const msg = await DirectMessage.findById(item.targetId).lean();
      return { ...item, message: msg };
    }
    if (item.targetType === "CHAT") {
      const msgs = await DirectMessage.find({
        $or: [
          { senderId: item.targetUserId },
          { receiverId: item.targetUserId }
        ]
      }).sort({ createdAt: -1 }).limit(50).lean();
      return { ...item, recentMessages: msgs };
    }
    return item;
  }));
  adminOk(res, { dmReviews: enriched }, paginationMeta(page, limit, total));
}));

adminDmReviewsRouter.get("/dm-reviews/:queueId", requireAdminAuth, requirePermission("messages.read_private"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { queueId } = req.params;
  const queue = await ModerationQueue.findById(queueId)
    .populate("reportId")
    .populate({ path: "targetUserId", select: "name username avatar role" })
    .lean();
  if (!queue) throw new HttpError(404, "DM review not found", ErrorCode.NOT_FOUND);

  let messages: any[] = [];
  let partnerId = "";
  if (queue.targetType === "MESSAGE" && queue.targetId) {
    const msg = await DirectMessage.findById(queue.targetId)
      .populate("senderId", "name username avatar")
      .populate("receiverId", "name username avatar")
      .lean();
    if (msg) {
      messages = [msg];
      partnerId = String(msg.senderId === queue.targetUserId ? msg.receiverId : msg.senderId);
    }
  } else if (queue.targetType === "CHAT" && queue.targetUserId) {
    const all = await DirectMessage.find({
      $or: [
        { senderId: queue.targetUserId },
        { receiverId: queue.targetUserId }
      ]
    })
      .sort({ createdAt: -1 })
      .limit(100)
      .populate("senderId", "name username avatar")
      .populate("receiverId", "name username avatar")
      .lean();
    messages = all;
  }
  await recordAuditLog({ adminId: req.admin!.id, action: "dm_reviews.view", entityType: "moderation_queue", entityId: queueId, targetUserId: queue.targetUserId?.toString(), req });
  adminOk(res, { dmReview: queue, messages, partnerId });
}));

adminDmReviewsRouter.post("/dm-reviews/:queueId/dismiss", requireAdminAuth, requirePermission("reports.resolve"), validateBody(noteSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { queueId } = req.params;
  const queue = await ModerationQueue.findById(queueId);
  if (!queue) throw new HttpError(404, "DM review not found", ErrorCode.NOT_FOUND);
  queue.status = "DISMISSED";
  queue.resolvedAt = new Date();
  queue.resolvedBy = req.admin!._id;
  if (req.body.adminNotes) queue.notes = req.body.adminNotes;
  await queue.save();
  if (queue.reportId) {
    await Report.findByIdAndUpdate(queue.reportId, { status: "DISMISSED", reviewedBy: req.admin!._id, reviewedAt: new Date(), moderatorNote: req.body.adminNotes });
  }
  await recordAuditLog({ adminId: req.admin!.id, action: "dm_reviews.dismiss", entityType: "moderation_queue", entityId: queueId, targetUserId: queue.targetUserId?.toString(), req });
  adminOk(res, { dmReview: queue });
}));

adminDmReviewsRouter.post("/dm-reviews/:queueId/restrict", requireAdminAuth, requirePermission("messages.delete"), validateBody(noteSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { queueId } = req.params;
  const queue = await ModerationQueue.findById(queueId);
  if (!queue) throw new HttpError(404, "DM review not found", ErrorCode.NOT_FOUND);
  queue.status = "ACTION_TAKEN";
  queue.resolvedAt = new Date();
  queue.resolvedBy = req.admin!._id;
  if (req.body.adminNotes) queue.notes = req.body.adminNotes;
  await queue.save();
  if (queue.reportId) {
    await Report.findByIdAndUpdate(queue.reportId, { status: "ACTION_TAKEN", reviewedBy: req.admin!._id, reviewedAt: new Date(), moderatorNote: req.body.adminNotes });
  }
  await recordAuditLog({ adminId: req.admin!.id, action: "dm_reviews.restrict", entityType: "moderation_queue", entityId: queueId, targetUserId: queue.targetUserId?.toString(), req });
  if (queue.targetUserId) {
    const recent = await DirectMessage.findOne({
      $or: [
        { senderId: queue.targetUserId },
        { receiverId: queue.targetUserId }
      ]
    }).sort({ createdAt: -1 }).lean();
    if (recent) {
      const partner = String(recent.senderId === queue.targetUserId ? recent.receiverId : recent.senderId);
      await DirectMessage.deleteMany({
        $or: [
          { senderId: queue.targetUserId, receiverId: partner },
          { senderId: partner, receiverId: queue.targetUserId }
        ]
      });
    }
  }
  adminOk(res, { dmReview: queue, restricted: true });
}));

adminDmReviewsRouter.post("/dm-reviews/:queueId/delete-message/:messageId", requireAdminAuth, requirePermission("messages.delete"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { queueId, messageId } = req.params;
  const msg = await DirectMessage.findById(messageId);
  if (!msg) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
  const senderId = msg.senderId.toString();
  await DirectMessage.findByIdAndDelete(messageId);
  await new AdminModerationAction({
    adminId: req.admin!._id,
    queueId,
    targetType: "MESSAGE",
    targetId: messageId,
    targetUserId: senderId,
    actionType: "MESSAGE_DELETED",
    reason: req.body.adminNotes || "Removed during DM review"
  }).save();
  await recordAuditLog({ adminId: req.admin!.id, action: "dm_reviews.delete_message", entityType: "direct_message", entityId: messageId, targetUserId: senderId, req });
  adminOk(res, { deleted: true, messageId });
}));

adminDmReviewsRouter.post("/dm-reviews/:queueId/warn-user", requireAdminAuth, requirePermission("users.suspend"), validateBody(z.object({ adminNotes: z.string().max(2000).optional(), reason: z.string().min(2).max(500) })), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { queueId } = req.params;
  const queue = await ModerationQueue.findById(queueId);
  if (!queue) throw new HttpError(404, "DM review not found", ErrorCode.NOT_FOUND);
  if (!queue.targetUserId) throw new HttpError(400, "No target user for this review", ErrorCode.VALIDATION);
  await new ModerationAction({
    targetUserId: queue.targetUserId,
    moderatorId: req.admin!._id,
    reportId: queue.reportId,
    action: "WARN",
    reason: req.body.reason,
    automated: false
  }).save();
  await new AdminModerationAction({
    adminId: req.admin!._id,
    queueId,
    targetType: "USER",
    targetUserId: queue.targetUserId,
    actionType: "WARNING_SENT",
    reason: req.body.reason,
    metadata: { adminNotes: req.body.adminNotes }
  }).save();
  await recordAuditLog({ adminId: req.admin!.id, action: "dm_reviews.warn_user", entityType: "moderation_queue", entityId: queueId, targetUserId: queue.targetUserId.toString(), metadata: { reason: req.body.reason }, req });
  adminOk(res, { warned: true, userId: queue.targetUserId.toString() });
}));
