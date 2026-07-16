import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Notification } from "../models/Notification.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";

export const notificationsRouter = Router();

const deviceTokenSchema = z.object({
  token: z.string().min(20),
  platform: z.enum(["android", "ios", "web"])
});

notificationsRouter.post("/device-token", requireAuth, validateBody(deviceTokenSchema), asyncHandler(async (req: AuthRequest, res) => {
  const existing = await DeviceToken.findOne({ token: req.body.token }).lean();
  if (existing && existing.userId.toString() !== req.user!.id) {
    throw new HttpError(403, "Token belongs to another user", ErrorCode.FORBIDDEN);
  }

  const token = await DeviceToken.findOneAndUpdate(
    { token: req.body.token },
    {
      $set: {
        platform: req.body.platform,
        userId: req.user!.id,
        lastSeenAt: new Date()
      },
      $setOnInsert: { token: req.body.token }
    },
    { upsert: true, new: true }
  );

  sendOk(res, { token });
}));

notificationsRouter.get("/", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 100);
  const notifications = await Notification.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(limit).lean();
  const unreadCount = await Notification.countDocuments({ userId: req.user!.id, read: false });
  sendOk(res, { notifications, unreadCount });
}));

notificationsRouter.patch("/:id/read", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
  const n = await Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user!.id }, { read: true }, { new: true });
  if (!n) throw new HttpError(404, "Notification not found", ErrorCode.NOT_FOUND);
  sendOk(res, { notification: n });
}));

notificationsRouter.post("/read-all", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  await Notification.updateMany({ userId: req.user!.id, read: false }, { read: true });
  sendOk(res, { success: true });
}));

notificationsRouter.post("/track/:notificationId/click", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const notification = await Notification.findOne({ _id: req.params.notificationId, userId: req.user!.id });
  if (!notification) return sendOk(res, { tracked: false });
  notification.read = true;
  await notification.save();
  sendOk(res, { tracked: true });
}));
