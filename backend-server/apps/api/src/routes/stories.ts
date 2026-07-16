import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { createLimiter } from "../middleware/rateLimit.js";
import { Story } from "../models/Story.js";
import { Follow } from "../models/Follow.js";
import { createNotification } from "../services/notifications.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";

export const storiesRouter = Router();

const createSchema = z.object({
  mediaUrl: z.string().min(1),
  mediaType: z.enum(["IMAGE", "VIDEO"]),
  caption: z.string().max(200).optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  font: z.string().optional(),
  sticker: z.string().optional(),
  linkUrl: z.string().url().optional().or(z.literal(""))
});

storiesRouter.post("/stories", requireAuth, createLimiter, validateBody(createSchema), asyncHandler(async (req: AuthRequest, res) => {
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const story = await Story.create({
    userId: req.user!._id,
    ...req.body,
    expiresAt
  });

  const followers = await Follow.find({ followingId: req.user!._id }).select("followerId").lean();
  for (const follower of followers) {
    await createNotification(follower.followerId.toString(), "MOMENT", "New story", `${req.user!.name} shared a moment`, { storyId: story.id, userId: req.user!.id });
  }

  sendOk(res, { story });
}));

storiesRouter.get("/stories/feed", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const following = await Follow.find({ followerId: req.user!._id }).select("followingId").lean();
  const userIds = [req.user!._id, ...following.map((f) => f.followingId)];
  const stories = await Story.find({ userId: { $in: userIds }, status: "ACTIVE", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .populate("userId", "name username avatar")
    .lean();

  const grouped: Record<string, { user: any; stories: any[] }> = {};
  for (const story of stories as any[]) {
    const uid = story.userId._id?.toString() ?? String(story.userId);
    if (!grouped[uid]) {
      grouped[uid] = { user: story.userId, stories: [] };
    }
    grouped[uid].stories.push(story);
  }

  sendOk(res, { stories: grouped, count: Object.keys(grouped).length });
}));

storiesRouter.get("/stories/user/:userId", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const skip = Number(req.query.skip) || 0;
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const stories = await Story.find({ userId: req.params.userId, status: "ACTIVE", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 })
    .skip(skip).limit(limit)
    .populate("userId", "name username avatar")
    .lean();
  sendOk(res, { stories });
}));

storiesRouter.post("/stories/:storyId/view", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const story = await Story.findById(req.params.storyId);
  if (!story) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);

  const uid = req.user!._id.toString();
  const alreadyViewed = story.viewedBy.some((v) => v.toString() === uid);
  if (!alreadyViewed) {
    story.viewedBy.push(req.user!._id);
    await story.save();
  }

  sendOk(res, { viewed: true, viewCount: story.viewedBy.length });
}));

storiesRouter.post("/stories/:storyId/like", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const story = await Story.findById(req.params.storyId);
  if (!story) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);
  story.likeCount += 1;
  await story.save();
  sendOk(res, { likeCount: story.likeCount });
}));

storiesRouter.post("/stories/:storyId/hide", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const story = await Story.findOne({ _id: req.params.storyId, userId: req.user!._id });
  if (!story) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);
  story.status = "HIDDEN";
  await story.save();
  sendOk(res, { hidden: true });
}));

storiesRouter.delete("/stories/:storyId", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const story = await Story.findOneAndDelete({ _id: req.params.storyId, userId: req.user!._id });
  if (!story) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);
  sendOk(res, { deleted: true });
}));

storiesRouter.get("/stories/:storyId/views", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const story = await Story.findById(req.params.storyId)
    .populate("viewedBy", "name username avatar")
    .lean();
  if (!story) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);
  sendOk(res, { viewers: story.viewedBy, count: story.viewedBy.length });
}));
