import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { createLimiter } from "../middleware/rateLimit.js";
import { Event } from "../models/Event.js";
import { createNotification } from "../services/notifications.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";

export const eventsRouter = Router();

const createSchema = z.object({
  title: z.string().min(3).max(120),
  description: z.string().max(2000).optional(),
  coverImage: z.string().optional(),
  category: z.string().min(1),
  type: z.enum(["ROOM", "TOURNAMENT", "SPECIAL", "WORKSHOP", "PARTY"]),
  eventDate: z.coerce.date(),
  eventEndDate: z.coerce.date().optional(),
  timezone: z.string().optional(),
  roomId: z.string().optional(),
  maxParticipants: z.number().int().positive().optional(),
  tags: z.array(z.string()).optional(),
  festival: z.enum(["none", "diwali", "holi", "new_year", "valentines", "independence_day"]).default("none").optional(),
  featured: z.boolean().default(false).optional()
});

eventsRouter.post("/events", requireAuth, createLimiter, validateBody(createSchema), asyncHandler(async (req: AuthRequest, res) => {
  const event = await Event.create({ ...req.body, hostId: req.user!._id });
  sendOk(res, { event });
}));

eventsRouter.get("/events", asyncHandler(async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const skip = (page - 1) * limit;
  const status = String(req.query.status || "") || undefined;
  const type = String(req.query.type || "") || undefined;
  const category = String(req.query.category || "") || undefined;
  const festival = String(req.query.festival || "") || undefined;
  const featured = req.query.featured === "true";
  const upcoming = req.query.upcoming === "true";

  const filter: Record<string, unknown> = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (festival) filter.festival = festival;
  if (featured) filter.featured = true;
  if (upcoming) {
    filter.eventDate = { $gte: new Date() };
    filter.status = { $in: ["UPCOMING", "LIVE"] };
  }

  const [events, total] = await Promise.all([
    Event.find(filter)
      .sort({ featured: -1, eventDate: 1 })
      .skip(skip).limit(limit)
      .populate("hostId", "name username avatar")
      .lean(),
    Event.countDocuments(filter)
  ]);

  sendOk(res, { events, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
}));

eventsRouter.get("/events/:eventId", asyncHandler(async (req, res) => {
  const event = await Event.findById(req.params.eventId)
    .populate("hostId", "name username avatar")
    .populate("participantIds", "name username avatar")
    .lean();
  if (!event) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
  sendOk(res, { event });
}));

eventsRouter.post("/events/:eventId/join", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
  if (event.status !== "UPCOMING") throw new HttpError(400, "Event is not open for joining", ErrorCode.VALIDATION);
  if (event.maxParticipants && event.participantIds.length >= event.maxParticipants) {
    throw new HttpError(400, "Event is full", ErrorCode.VALIDATION);
  }

  const uid = req.user!._id;
  if (event.participantIds.some((p) => p.toString() === uid.toString())) {
    return sendOk(res, { event, alreadyJoined: true });
  }

  event.participantIds.push(uid);
  await event.save();

  await createNotification(event.hostId.toString(), "SYSTEM", "New event participant", `${req.user!.name} joined your event "${event.title}"`, { eventId: event.id });

  sendOk(res, { event, alreadyJoined: false });
}));

eventsRouter.post("/events/:eventId/cancel", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const event = await Event.findOne({ _id: req.params.eventId, hostId: req.user!._id });
  if (!event) throw new HttpError(404, "Event not found or not your event", ErrorCode.NOT_FOUND);
  event.status = "CANCELLED";
  await event.save();
  sendOk(res, { event });
}));

eventsRouter.post("/events/:eventId/leave", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const event = await Event.findById(req.params.eventId);
  if (!event) throw new HttpError(404, "Event not found", ErrorCode.NOT_FOUND);
  const uid = req.user!._id;
  event.participantIds = event.participantIds.filter((p) => p.toString() !== uid.toString());
  await event.save();
  sendOk(res, { event });
}));

eventsRouter.get("/events/user/me", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const [hosting, joined] = await Promise.all([
    Event.find({ hostId: req.user!._id }).sort({ eventDate: -1 }).limit(50).lean(),
    Event.find({ participantIds: req.user!._id, hostId: { $ne: req.user!._id } }).sort({ eventDate: -1 }).limit(50).lean()
  ]);
  sendOk(res, { hosting, joined });
}));
