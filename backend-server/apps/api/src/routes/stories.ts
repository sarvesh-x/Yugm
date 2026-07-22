import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { createLimiter } from "../middleware/rateLimit.js";
import { Story } from "../models/Story.js";
import { StoryComment } from "../models/StoryComment.js";
import { Follow } from "../models/Follow.js";
import { createNotification } from "../services/notifications.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";

export const storiesRouter = Router();

const createSchema = z.object({
  mediaUrl: z.string().min(1),
  mediaType: z.enum(["IMAGE", "VIDEO", "AUDIO"]),
  caption: z.string().max(200).optional(),
  backgroundColor: z.string().optional(),
  textColor: z.string().optional(),
  font: z.string().optional(),
  sticker: z.string().optional(),
  linkUrl: z.string().url().optional().or(z.literal("")),
  duration: z.number().int().min(1).max(300).optional(),
  transcript: z.string().max(1000).optional()
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

const commentSchema = z.object({
  text: z.string().min(1).max(500),
});

storiesRouter.post("/stories/:storyId/comments", requireAuth, validateBody(commentSchema), asyncHandler(async (req: AuthRequest, res) => {
  const story = await Story.findById(req.params.storyId);
  if (!story) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);

  const comment = await StoryComment.create({
    storyId: story._id,
    userId: req.user!._id,
    text: req.body.text,
  });

  story.replyCount += 1;
  await story.save();

  const populated = await comment.populate("userId", "name username avatar");

  if (story.userId.toString() !== req.user!._id.toString()) {
    await createNotification(story.userId.toString(), "COMMENT", "New comment", `${req.user!.name} commented on your story`, {
      storyId: story.id,
      commentId: comment.id,
      userId: req.user!.id,
    });
  }

  sendOk(res, { comment: populated });
}));

storiesRouter.get("/stories/:storyId/comments", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const comments = await StoryComment.find({ storyId: req.params.storyId, parentId: null })
    .sort({ createdAt: -1 })
    .skip(Number(req.query.skip) || 0)
    .limit(Math.min(Number(req.query.limit) || 20, 50))
    .populate("userId", "name username avatar")
    .lean();

  const commentIds = comments.map((c) => c._id);
  const replies = await StoryComment.find({ parentId: { $in: commentIds } })
    .sort({ createdAt: 1 })
    .populate("userId", "name username avatar")
    .lean();

  const replyMap: Record<string, any[]> = {};
  for (const reply of replies) {
    const key = reply.parentId!.toString();
    if (!replyMap[key]) replyMap[key] = [];
    replyMap[key].push(reply);
  }

  const commentsWithReplies = comments.map((c) => ({
    ...c,
    replies: replyMap[c._id.toString()] || [],
  }));

  sendOk(res, { comments: commentsWithReplies });
}));

storiesRouter.post("/stories/:storyId/comments/:commentId/reply", requireAuth, validateBody(commentSchema), asyncHandler(async (req: AuthRequest, res) => {
  const parent = await StoryComment.findOne({ _id: req.params.commentId, storyId: req.params.storyId });
  if (!parent) throw new HttpError(404, "Comment not found", ErrorCode.NOT_FOUND);

  const reply = await StoryComment.create({
    storyId: req.params.storyId,
    userId: req.user!._id,
    parentId: parent._id,
    text: req.body.text,
  });

  const story = await Story.findById(req.params.storyId);
  if (story) {
    story.replyCount += 1;
    await story.save();
  }

  const populated = await reply.populate("userId", "name username avatar");

  if (parent.userId.toString() !== req.user!._id.toString()) {
    await createNotification(parent.userId.toString(), "COMMENT", "New reply", `${req.user!.name} replied to your comment`, {
      storyId: req.params.storyId,
      commentId: parent.id,
      replyId: reply.id,
      userId: req.user!.id,
    });
  }

  sendOk(res, { reply: populated });
}));

storiesRouter.delete("/comments/:commentId", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const comment = await StoryComment.findOne({ _id: req.params.commentId, userId: req.user!._id });
  if (!comment) throw new HttpError(404, "Comment not found", ErrorCode.NOT_FOUND);

  await StoryComment.deleteMany({ _id: comment._id, parentId: comment._id });
  const deletedCount = 1 + (comment.parentId ? 0 : await StoryComment.countDocuments({ parentId: comment._id }));

  await Story.updateOne({ _id: comment.storyId }, { $inc: { replyCount: -deletedCount } });

  await comment.deleteOne();
  sendOk(res, { deleted: true });
}));
