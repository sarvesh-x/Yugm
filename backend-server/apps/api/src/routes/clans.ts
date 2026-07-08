import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Clan } from "../models/Clan.js";
import { User } from "../models/User.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId, sanitizeText } from "../utils/http.js";

export const clansRouter = Router();
clansRouter.use(requireAuth);

const clanSchema = z.object({
  name: z.string().min(3).max(48),
  description: z.string().max(220).optional(),
  avatar: z.string().url().optional(),
  privacy: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  familyLabel: z.string().min(2).max(32).default("Family")
});

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 42) || "clan";
}

function publicClan(clan: any, userId: string) {
  const members = (clan.memberIds ?? []).map((memberId: any) => memberId?._id?.toString?.() ?? memberId?.toString?.() ?? memberId);
  return {
    id: clan._id?.toString?.() ?? clan.id,
    _id: clan._id?.toString?.() ?? clan.id,
    name: clan.name,
    slug: clan.slug,
    description: clan.description,
    avatar: clan.avatar,
    privacy: clan.privacy,
    familyLabel: clan.familyLabel,
    ownerId: clan.ownerId?._id?.toString?.() ?? clan.ownerId?.toString?.() ?? clan.ownerId,
    memberCount: clan.memberCount ?? members.length,
    members: clan.memberIds,
    isMember: members.includes(userId),
    isOwner: (clan.ownerId?._id?.toString?.() ?? clan.ownerId?.toString?.() ?? clan.ownerId) === userId,
    createdAt: clan.createdAt
  };
}

async function uniqueSlug(name: string) {
  const base = slugify(name);
  let slug = base;
  for (let index = 0; index < 5; index++) {
    const exists = await Clan.exists({ slug });
    if (!exists) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now().toString(36)}`;
}

clansRouter.get("/", asyncHandler(async (req: AuthRequest, res) => {
  const q = String(req.query.q || "").trim();
  const regex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : undefined;
  const clans = await Clan.find({
    $and: [
      { $or: [{ privacy: "PUBLIC" }, { memberIds: req.user!.id }] },
      ...(regex ? [{ $or: [{ name: regex }, { description: regex }, { slug: regex }] }] : [])
    ]
  })
    .sort({ memberCount: -1, createdAt: -1 })
    .limit(50)
    .lean();
  sendOk(res, { clans: clans.map((clan) => publicClan(clan, req.user!.id)) });
}));

clansRouter.get("/me", asyncHandler(async (req: AuthRequest, res) => {
  const clan = await Clan.findOne({ memberIds: req.user!.id })
    .populate("memberIds", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();
  sendOk(res, { clan: clan ? publicClan(clan, req.user!.id) : null });
}));

clansRouter.post("/", validateBody(clanSchema), asyncHandler(async (req: AuthRequest, res) => {
  const existing = await Clan.exists({ memberIds: req.user!.id });
  if (existing) throw new HttpError(400, "Leave your current clan before creating another", ErrorCode.VALIDATION);

  const clan = await Clan.create({
    ownerId: req.user!.id,
    name: sanitizeText(req.body.name),
    slug: await uniqueSlug(req.body.name),
    description: req.body.description ? sanitizeText(req.body.description) : undefined,
    avatar: req.body.avatar,
    privacy: req.body.privacy,
    familyLabel: sanitizeText(req.body.familyLabel),
    memberIds: [req.user!.id],
    memberCount: 1
  });
  await User.findByIdAndUpdate(req.user!.id, { $set: { clanId: clan._id } });
  sendOk(res, { clan: publicClan(clan, req.user!.id) }, 201);
}));

clansRouter.get("/:id", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid clan ID", ErrorCode.VALIDATION);
  const clan = await Clan.findById(req.params.id)
    .populate("memberIds", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();
  if (!clan) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  const mapped = publicClan(clan, req.user!.id);
  if (mapped.privacy === "PRIVATE" && !mapped.isMember) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  sendOk(res, { clan: mapped });
}));

clansRouter.post("/:id/join", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid clan ID", ErrorCode.VALIDATION);
  const current = await Clan.exists({ memberIds: req.user!.id });
  if (current) throw new HttpError(400, "Leave your current clan before joining another", ErrorCode.VALIDATION);
  const clan = await Clan.findById(req.params.id);
  if (!clan) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  if (clan.privacy === "PRIVATE") throw new HttpError(403, "This clan is invite-only", ErrorCode.FORBIDDEN);
  const members = clan.memberIds.map((memberId: any) => memberId.toString());
  if (!members.includes(req.user!.id)) clan.memberIds = [...clan.memberIds, req.user!._id ?? req.user!.id] as any;
  clan.memberCount = clan.memberIds.length;
  await clan.save();
  await User.findByIdAndUpdate(req.user!.id, { $set: { clanId: clan._id } });
  sendOk(res, { clan: publicClan(clan, req.user!.id) });
}));

clansRouter.post("/:id/leave", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid clan ID", ErrorCode.VALIDATION);
  const clan = await Clan.findById(req.params.id);
  if (!clan) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  if (clan.ownerId.toString() === req.user!.id && clan.memberIds.length > 1) {
    throw new HttpError(400, "Transfer ownership before leaving this clan", ErrorCode.VALIDATION);
  }
  clan.memberIds = clan.memberIds.filter((memberId: any) => memberId.toString() !== req.user!.id) as any;
  clan.memberCount = clan.memberIds.length;
  await clan.save();
  await User.findByIdAndUpdate(req.user!.id, { $unset: { clanId: "" } });
  if (clan.memberIds.length === 0) {
    await clan.deleteOne();
    return sendOk(res, { clan: null });
  }
  sendOk(res, { clan: publicClan(clan, req.user!.id) });
}));
