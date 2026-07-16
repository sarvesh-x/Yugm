import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { StoryHighlight } from "../models/StoryHighlight.js";
import { Story } from "../models/Story.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";

export const highlightsRouter = Router();
highlightsRouter.use(requireAuth);

const createSchema = z.object({
  title: z.string().min(1).max(40),
  storyIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1),
});

const updateSchema = z.object({
  title: z.string().min(1).max(40).optional(),
  storyIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).optional(),
});

const addStoriesSchema = z.object({
  storyIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1),
});

highlightsRouter.post("/highlights", validateBody(createSchema), asyncHandler(async (req: AuthRequest, res) => {
  const firstStory = await Story.findById(req.body.storyIds[0]).lean();
  if (!firstStory) throw new HttpError(404, "Story not found", ErrorCode.NOT_FOUND);

  const highlight = await StoryHighlight.create({
    userId: req.user!._id,
    title: req.body.title,
    coverMediaUrl: firstStory.mediaUrl,
    storyIds: req.body.storyIds,
  });

  sendOk(res, { highlight }, 201);
}));

highlightsRouter.get("/highlights/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);

  const highlights = await StoryHighlight.find({ userId: req.params.userId })
    .populate("storyIds")
    .sort({ createdAt: -1 })
    .lean();

  sendOk(res, { highlights });
}));

highlightsRouter.put("/highlights/:id", validateBody(updateSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid highlight ID", ErrorCode.VALIDATION);

  const update: Record<string, unknown> = {};
  if (req.body.title !== undefined) update.title = req.body.title;
  if (req.body.storyIds !== undefined) update.storyIds = req.body.storyIds;

  const highlight = await StoryHighlight.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!._id },
    { $set: update },
    { new: true }
  ).populate("storyIds");

  if (!highlight) throw new HttpError(404, "Highlight not found", ErrorCode.NOT_FOUND);

  sendOk(res, { highlight });
}));

highlightsRouter.delete("/highlights/:id", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid highlight ID", ErrorCode.VALIDATION);

  const highlight = await StoryHighlight.findOneAndDelete({ _id: req.params.id, userId: req.user!._id });
  if (!highlight) throw new HttpError(404, "Highlight not found", ErrorCode.NOT_FOUND);

  sendOk(res, { deleted: true });
}));

highlightsRouter.post("/highlights/:id/stories", validateBody(addStoriesSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid highlight ID", ErrorCode.VALIDATION);

  const highlight = await StoryHighlight.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!._id },
    { $push: { storyIds: { $each: req.body.storyIds } } },
    { new: true }
  ).populate("storyIds");

  if (!highlight) throw new HttpError(404, "Highlight not found", ErrorCode.NOT_FOUND);

  sendOk(res, { highlight });
}));

highlightsRouter.delete("/highlights/:id/stories/:storyId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id) || !isValidObjectId(req.params.storyId)) {
    throw new HttpError(400, "Invalid ID", ErrorCode.VALIDATION);
  }

  const highlight = await StoryHighlight.findOneAndUpdate(
    { _id: req.params.id, userId: req.user!._id },
    { $pull: { storyIds: req.params.storyId } },
    { new: true }
  ).populate("storyIds");

  if (!highlight) throw new HttpError(404, "Highlight not found", ErrorCode.NOT_FOUND);

  sendOk(res, { highlight });
}));
