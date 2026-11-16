import { Router } from "express";
import { z } from "zod";
import { reactionSchema, socketEvents } from "@yugm/shared";
import { requireAuth, requireNotMuted, type AuthRequest } from "../middleware/auth.js";
import { chatLimiter, reportLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { Clan } from "../models/Clan.js";
import { ClanInvite } from "../models/ClanInvite.js";
import { ClanMessage } from "../models/ClanMessage.js";
import { Report } from "../models/Report.js";
import { User } from "../models/User.js";
import { createNotification } from "../services/notifications.js";
import { emitClanMembers, emitUser, isUserOnline } from "../services/socket.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId, sanitizeText } from "../utils/http.js";

export const clansRouter = Router();
clansRouter.use(requireAuth);

const avatarSchema = z.string().refine(
  (v) => /^https?:\/\//i.test(v) || /^data:image\/(png|jpe?g|webp|gif);base64,/i.test(v),
  "Avatar must be an http(s) URL or a data image URL"
);

const clanSchema = z.object({
  name: z.string().min(3).max(48),
  description: z.string().max(220).optional(),
  avatar: avatarSchema.optional(),
  privacy: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
  familyLabel: z.string().min(2).max(32).default("Family")
});
const clanMessageSchema = z.object({ message: z.string().min(1).max(600) });
const clanInviteSchema = z.object({ userId: z.string().regex(/^[0-9a-fA-F]{24}$/) });
const ownershipSchema = z.object({ userId: z.string().regex(/^[0-9a-fA-F]{24}$/) });
const clanUpdateSchema = z.object({
  name: z.string().min(3).max(48).optional(),
  description: z.string().max(220).nullable().optional(),
  avatar: avatarSchema.nullable().optional(),
  privacy: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  familyLabel: z.string().min(2).max(32).optional()
}).refine((value) => Object.values(value).some((entry) => entry !== undefined), {
  message: "Provide at least one clan setting to update"
});
const clanMemberRoleSchema = z.object({ role: z.enum(["CO_LEADER", "OFFICER", "MEMBER"]) });
const clanMessageReportSchema = z.object({
  reason: z.string().min(2).max(80),
  description: z.string().max(500).optional()
});

function slugify(name: string) {
  return name.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 42) || "clan";
}

const CLAN_MEMBER_FIELDS = "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle";

const ROLE_RANK: Record<string, number> = {
  MEMBER: 1,
  OFFICER: 2,
  CO_LEADER: 3,
  LEADER: 4
};

function idOf(value: any): string {
  return value?._id?.toString?.() ?? value?.toString?.() ?? "";
}

function roleRank(role: string | null | undefined) {
  return ROLE_RANK[role || "MEMBER"] ?? 0;
}

function clanRoleFor(clan: any, userId: string): "LEADER" | "CO_LEADER" | "OFFICER" | "MEMBER" | null {
  const members = (clan.memberIds ?? []).map(idOf).filter(Boolean);
  if (!members.includes(userId)) return null;
  if (idOf(clan.ownerId) === userId) return "LEADER";
  const entry = (clan.memberRoles ?? []).find((item: any) => idOf(item.userId) === userId);
  const role = entry?.role as string | undefined;
  if (role === "CO_LEADER" || role === "OFFICER" || role === "MEMBER") return role;
  return "MEMBER";
}

function canManageClan(role: string | null) {
  return role === "LEADER" || role === "CO_LEADER";
}

function canInviteMembers(role: string | null) {
  return role === "LEADER" || role === "CO_LEADER" || role === "OFFICER";
}

function canModerateChat(role: string | null) {
  return role === "LEADER" || role === "CO_LEADER" || role === "OFFICER";
}

function canAssignRole(actorRole: string | null, targetRole: string | null, nextRole: string) {
  if (actorRole === "LEADER") return nextRole === "CO_LEADER" || nextRole === "OFFICER" || nextRole === "MEMBER";
  if (actorRole === "CO_LEADER") {
    if (nextRole === "CO_LEADER") return false;
    if (roleRank(targetRole) >= roleRank("CO_LEADER")) return false;
    return nextRole === "OFFICER" || nextRole === "MEMBER";
  }
  return false;
}

function canRemoveMember(actorRole: string | null, targetRole: string | null) {
  if (actorRole === "LEADER") return targetRole !== "LEADER";
  if (actorRole === "CO_LEADER") return targetRole === "MEMBER" || targetRole === "OFFICER";
  return false;
}

async function populateClanMembers(clan: any) {
  await clan.populate("memberIds", CLAN_MEMBER_FIELDS);
  return clan;
}

function roleOverrides(clan: any): Map<string, string> {
  const roles = new Map<string, string>();
  for (const entry of clan.memberRoles ?? []) {
    const memberId = idOf(entry.userId);
    if (memberId) roles.set(memberId, entry.role);
  }
  return roles;
}

function applyMemberRoles(clan: any, overrides: Record<string, string> = {}) {
  const ownerId = idOf(clan.ownerId);
  const memberIds = (clan.memberIds ?? []).map(idOf).filter(Boolean);
  const roles = roleOverrides(clan);
  for (const [memberId, role] of Object.entries(overrides)) roles.set(memberId, role);
  clan.memberRoles = memberIds.map((memberId: string) => ({
    userId: memberId,
    role: memberId === ownerId ? "LEADER" : (roles.get(memberId) ?? "MEMBER")
  }));
}

function memberRolesFor(clan: any, memberIds: string[]) {
  const ownerId = idOf(clan.ownerId);
  const roles = roleOverrides(clan);
  return memberIds.map((memberId) => ({
    userId: memberId,
    role: memberId === ownerId ? "LEADER" : (roles.get(memberId) ?? "MEMBER")
  }));
}

function publicClan(clan: any, userId: string, includeRoles = true) {
  const members = (clan.memberIds ?? []).map(idOf).filter(Boolean);
  const ownerId = idOf(clan.ownerId);
  const memberRoles = includeRoles ? memberRolesFor(clan, members) : [];
  const myRole = includeRoles ? (memberRoles.find((entry) => entry.userId === userId)?.role ?? (members.includes(userId) ? (ownerId === userId ? "LEADER" : "MEMBER") : null)) : null;
  return {
    id: idOf(clan._id) || clan.id,
    _id: idOf(clan._id) || clan.id,
    name: clan.name,
    slug: clan.slug,
    description: clan.description,
    avatar: clan.avatar,
    privacy: clan.privacy,
    familyLabel: clan.familyLabel,
    ownerId,
    memberCount: clan.memberCount ?? members.length,
    members: includeRoles ? clan.memberIds.map((member: any) => {
      const memberData = member && typeof member === "object" ? (member.toObject?.() ?? member) : { id: idOf(member) };
      return { ...memberData, isOnline: isUserOnline(idOf(member)) };
    }) : [],
    memberRoles,
    myRole,
    canManage: canManageClan(myRole),
    canModerate: canModerateChat(myRole),
    canInvite: canInviteMembers(myRole),
    isMember: members.includes(userId),
    isOwner: ownerId === userId,
    createdAt: clan.createdAt
  };
}

async function requireClanMemberDoc(clanId: string, userId: string) {
  if (!isValidObjectId(clanId)) throw new HttpError(400, "Invalid clan ID", ErrorCode.VALIDATION);
  const clan = await Clan.findById(clanId);
  if (!clan) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  const role = clanRoleFor(clan, userId);
  if (!role) throw new HttpError(403, "Join this clan to continue", ErrorCode.FORBIDDEN);
  return { clan, role };
}

async function requireClanLeader(clanId: string, userId: string) {
  const { clan, role } = await requireClanMemberDoc(clanId, userId);
  if (role !== "LEADER") throw new HttpError(403, "Only the clan leader can perform this action", ErrorCode.FORBIDDEN);
  return clan;
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

async function requireClanMember(clanId: string, userId: string) {
  if (!isValidObjectId(clanId)) throw new HttpError(400, "Invalid clan ID", ErrorCode.VALIDATION);
  const clan = await Clan.findById(clanId).select("memberIds name ownerId memberRoles").lean();
  if (!clan) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  const members = (clan.memberIds ?? []).map((memberId: any) => memberId.toString());
  if (!members.includes(userId)) throw new HttpError(403, "Join this clan to chat", ErrorCode.FORBIDDEN);
  const role = clanRoleFor(clan, userId);
  return { clan, members, role };
}

clansRouter.get("/", asyncHandler(async (req: AuthRequest, res) => {
  const q = String(req.query.q || "").trim();
  const regex = q ? new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 100);
  const clans = await Clan.find({
    $and: [
      { $or: [{ privacy: "PUBLIC" }, { memberIds: req.user!.id }] },
      ...(regex ? [{ $or: [{ name: regex }, { description: regex }, { slug: regex }] }] : [])
    ]
  })
    .sort({ memberCount: -1, createdAt: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { clans: clans.map((clan) => publicClan(clan, req.user!.id, false)) });
}));

clansRouter.get("/me", asyncHandler(async (req: AuthRequest, res) => {
  const clan = await Clan.findOne({ memberIds: req.user!.id })
    .populate("memberIds", "name username avatar city activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();
  sendOk(res, { clan: clan ? publicClan(clan, req.user!.id) : null });
}));

clansRouter.get("/invitations", asyncHandler(async (req: AuthRequest, res) => {
  const now = new Date();
  await ClanInvite.updateMany({ inviteeId: req.user!.id, status: "PENDING", expiresAt: { $lte: now } }, { $set: { status: "EXPIRED" } });
  const invitations = await ClanInvite.find({ inviteeId: req.user!.id, status: "PENDING", expiresAt: { $gt: now } })
    .populate("clanId", "name slug avatar familyLabel memberCount privacy")
    .populate("inviterId", "name username avatar")
    .sort({ createdAt: -1 }).limit(30).lean();
  sendOk(res, { invitations });
}));

clansRouter.get("/leaderboard", asyncHandler(async (req: AuthRequest, res) => {
  const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
  const clans = await Clan.aggregate([
    { $match: { privacy: "PUBLIC", memberCount: { $gt: 0 } } },
    { $lookup: { from: "users", let: { ids: "$memberIds" }, pipeline: [
      { $match: { $expr: { $in: ["$_id", "$$ids"] } } },
      { $project: { xp: 1 } }
    ], as: "members" } },
    { $addFields: { totalXp: { $sum: "$members.xp" } } },
    { $sort: { totalXp: -1, memberCount: -1, createdAt: 1 } },
    { $limit: limit },
    { $project: { name: 1, slug: 1, avatar: 1, familyLabel: 1, memberCount: 1, totalXp: 1 } }
  ]);
  sendOk(res, { clans: clans.map((clan, index) => ({ ...clan, id: clan._id.toString(), rank: index + 1 })) });
}));

clansRouter.get("/:id/invitations", asyncHandler(async (req: AuthRequest, res) => {
  const { clan, role } = await requireClanMemberDoc(req.params.id, req.user!.id);
  if (!canInviteMembers(role)) throw new HttpError(403, "You don't have permission to view clan invitations", ErrorCode.FORBIDDEN);
  const now = new Date();
  await ClanInvite.updateMany({ clanId: clan._id, status: "PENDING", expiresAt: { $lte: now } }, { $set: { status: "EXPIRED" } });
  const invitations = await ClanInvite.find({ clanId: clan._id, status: "PENDING", expiresAt: { $gt: now } })
    .populate("inviteeId", "name username avatar")
    .populate("inviterId", "name username avatar")
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();
  sendOk(res, { invitations });
}));

clansRouter.post("/:id/invitations", validateBody(clanInviteSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { clan, role } = await requireClanMemberDoc(req.params.id, req.user!.id);
  if (!canInviteMembers(role)) throw new HttpError(403, "You don't have permission to invite members", ErrorCode.FORBIDDEN);
  if (req.body.userId === req.user!.id) throw new HttpError(400, "You are already in this clan", ErrorCode.VALIDATION);
  const invitee = await User.findById(req.body.userId).select("name").lean();
  if (!invitee) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  const inviteeCurrentClan = await Clan.findOne({ memberIds: req.body.userId }).select("_id").lean();
  if (inviteeCurrentClan) {
    if (idOf(inviteeCurrentClan._id) === clan.id) throw new HttpError(409, "This user is already in your clan", ErrorCode.CONFLICT);
    throw new HttpError(409, "This user already belongs to a clan", ErrorCode.CONFLICT);
  }
  await ClanInvite.updateMany({ clanId: clan._id, inviteeId: req.body.userId, status: "PENDING", expiresAt: { $lte: new Date() } }, { $set: { status: "EXPIRED" } });
  let invitation = await ClanInvite.findOne({ clanId: clan._id, inviteeId: req.body.userId, status: "PENDING" });
  if (!invitation) invitation = await ClanInvite.create({ clanId: clan._id, inviterId: req.user!._id, inviteeId: req.body.userId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });
  await createNotification(req.body.userId, "ROOM_INVITE", "Clan invitation", `${req.user!.name} invited you to join ${clan.name}`, { clanId: clan.id, clanInviteId: invitation.id });
  sendOk(res, { invitation }, 201);
}));

clansRouter.delete("/:id/invitations/:inviteId", asyncHandler(async (req: AuthRequest, res) => {
  const { clan, role } = await requireClanMemberDoc(req.params.id, req.user!.id);
  if (!canInviteMembers(role)) throw new HttpError(403, "You don't have permission to manage clan invitations", ErrorCode.FORBIDDEN);
  if (!isValidObjectId(req.params.inviteId)) throw new HttpError(400, "Invalid invitation ID", ErrorCode.VALIDATION);
  const invite = await ClanInvite.findOne({ _id: req.params.inviteId, clanId: clan._id, status: "PENDING" });
  if (!invite) throw new HttpError(404, "Invitation not found", ErrorCode.NOT_FOUND);
  invite.status = "CANCELLED";
  await invite.save();
  sendOk(res, { invitation: invite });
}));

clansRouter.post("/invitations/:inviteId/:action(accept|decline)", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.inviteId)) throw new HttpError(400, "Invalid invitation ID", ErrorCode.VALIDATION);
  const invite = await ClanInvite.findOne({ _id: req.params.inviteId, inviteeId: req.user!.id, status: "PENDING", expiresAt: { $gt: new Date() } });
  if (!invite) throw new HttpError(404, "Invitation not found or expired", ErrorCode.NOT_FOUND);
  if (req.params.action === "decline") {
    invite.status = "DECLINED";
    await invite.save();
    return sendOk(res, { invitation: invite });
  }
  const clan = await Clan.findById(invite.clanId);
  if (!clan) throw new HttpError(404, "Clan no longer exists", ErrorCode.NOT_FOUND);
  const userId = req.user!.id;
  const alreadyMemberThisClan = clan.memberIds.some((memberId) => idOf(memberId) === userId);
  if (!alreadyMemberThisClan) {
    const otherClan = await Clan.exists({ memberIds: userId, _id: { $ne: clan._id } });
    if (otherClan) throw new HttpError(409, "Leave your current clan before accepting another invitation", ErrorCode.CONFLICT);
    clan.memberIds = [...clan.memberIds, req.user!._id];
    clan.memberCount = clan.memberIds.length;
    applyMemberRoles(clan);
    await clan.save();
  }
  await User.findByIdAndUpdate(userId, { $set: { clanId: clan._id } });
  invite.status = "ACCEPTED";
  await invite.save();
  await populateClanMembers(clan);
  const mapped = publicClan(clan, userId);
  if (!alreadyMemberThisClan) {
    emitClanMembers(clan.memberIds, socketEvents.clanMemberJoined, { clanId: clan.id, userId, clan: mapped }, userId);
  }
  sendOk(res, { invitation: invite, clan: mapped });
}));

clansRouter.post("/:id/transfer-ownership", validateBody(ownershipSchema), asyncHandler(async (req: AuthRequest, res) => {
  const clan = await requireClanLeader(req.params.id, req.user!.id);
  if (!clan.memberIds.some((memberId) => idOf(memberId) === req.body.userId)) throw new HttpError(400, "Ownership can only be transferred to a clan member", ErrorCode.VALIDATION);
  const previousOwnerId = idOf(clan.ownerId);
  clan.ownerId = req.body.userId;
  applyMemberRoles(clan, { [previousOwnerId]: "CO_LEADER" });
  await clan.save();
  await populateClanMembers(clan);
  const mapped = publicClan(clan, req.user!.id);
  emitClanMembers(clan.memberIds, socketEvents.clanOwnershipTransferred, { clanId: clan.id, fromUserId: previousOwnerId, toUserId: req.body.userId, clan: mapped });
  sendOk(res, { clan: mapped });
}));

clansRouter.patch("/:id", validateBody(clanUpdateSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { clan, role } = await requireClanMemberDoc(req.params.id, req.user!.id);
  if (!canManageClan(role)) throw new HttpError(403, "You don't have permission to update clan settings", ErrorCode.FORBIDDEN);
  if (req.body.name !== undefined) clan.name = sanitizeText(req.body.name);
  if (req.body.description !== undefined) {
    clan.description = req.body.description === null ? undefined : sanitizeText(req.body.description);
  }
  if (req.body.avatar !== undefined) clan.avatar = req.body.avatar ?? undefined;
  if (req.body.privacy !== undefined) clan.privacy = req.body.privacy;
  if (req.body.familyLabel !== undefined) clan.familyLabel = sanitizeText(req.body.familyLabel);
  await clan.save();
  await populateClanMembers(clan);
  const mapped = publicClan(clan, req.user!.id);
  emitClanMembers(clan.memberIds, socketEvents.clanUpdated, { clanId: clan.id, clan: mapped }, req.user!.id);
  sendOk(res, { clan: mapped });
}));

clansRouter.patch("/:id/members/:userId/role", validateBody(clanMemberRoleSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { clan, role: actorRole } = await requireClanMemberDoc(req.params.id, req.user!.id);
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid member ID", ErrorCode.VALIDATION);
  const targetId = req.params.userId;
  if (idOf(clan.ownerId) === targetId) throw new HttpError(400, "Transfer ownership to change the leader role", ErrorCode.VALIDATION);
  if (!clan.memberIds.some((memberId) => idOf(memberId) === targetId)) throw new HttpError(404, "This user is not a clan member", ErrorCode.NOT_FOUND);
  const targetRole = clanRoleFor(clan, targetId);
  if (!canAssignRole(actorRole, targetRole, req.body.role)) throw new HttpError(403, "You don't have permission to assign this role", ErrorCode.FORBIDDEN);
  applyMemberRoles(clan, { [targetId]: req.body.role });
  await clan.save();
  await populateClanMembers(clan);
  const mapped = publicClan(clan, req.user!.id);
  emitClanMembers(clan.memberIds, socketEvents.clanMemberRoleUpdated, { clanId: clan.id, userId: targetId, role: req.body.role, clan: mapped });
  sendOk(res, { clan: mapped });
}));

clansRouter.delete("/:id/members/:userId", asyncHandler(async (req: AuthRequest, res) => {
  const { clan, role: actorRole } = await requireClanMemberDoc(req.params.id, req.user!.id);
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid member ID", ErrorCode.VALIDATION);
  const targetId = req.params.userId;
  if (targetId === req.user!.id) throw new HttpError(400, "Use leave to exit your clan", ErrorCode.VALIDATION);
  if (idOf(clan.ownerId) === targetId) throw new HttpError(400, "The clan leader cannot be removed", ErrorCode.VALIDATION);
  if (!clan.memberIds.some((memberId) => idOf(memberId) === targetId)) throw new HttpError(404, "This user is not a clan member", ErrorCode.NOT_FOUND);
  const targetRole = clanRoleFor(clan, targetId);
  if (!canRemoveMember(actorRole, targetRole)) throw new HttpError(403, "You don't have permission to remove this member", ErrorCode.FORBIDDEN);
  clan.memberIds = clan.memberIds.filter((memberId) => idOf(memberId) !== targetId);
  clan.memberCount = clan.memberIds.length;
  applyMemberRoles(clan);
  await clan.save();
  await Promise.all([
    User.findByIdAndUpdate(targetId, { $unset: { clanId: "" } }),
    ClanInvite.updateMany({ clanId: clan._id, inviteeId: targetId, status: "PENDING" }, { $set: { status: "CANCELLED" } })
  ]);
  await populateClanMembers(clan);
  const mapped = publicClan(clan, req.user!.id);
  emitUser(targetId, socketEvents.clanMemberRemoved, { clanId: clan.id, userId: targetId, clan: null });
  emitClanMembers(clan.memberIds, socketEvents.clanMemberRemoved, { clanId: clan.id, userId: targetId, clan: mapped }, req.user!.id);
  sendOk(res, { clan: mapped });
}));

clansRouter.delete("/:id", asyncHandler(async (req: AuthRequest, res) => {
  const clan = await requireClanLeader(req.params.id, req.user!.id);
  const memberIds = clan.memberIds.map(idOf).filter(Boolean);
  const clanId = clan.id;
  await Promise.all([
    User.updateMany({ _id: { $in: memberIds } }, { $unset: { clanId: "" } }),
    ClanInvite.deleteMany({ clanId: clan._id }),
    ClanMessage.deleteMany({ clanId: clan._id })
  ]);
  await clan.deleteOne();
  emitClanMembers(memberIds, socketEvents.clanDeleted, { clanId }, req.user!.id);
  sendOk(res, { clan: null });
}));

clansRouter.get("/:id/messages", asyncHandler(async (req: AuthRequest, res) => {
  await requireClanMember(req.params.id, req.user!.id);
  const limit = Math.min(Number(req.query.limit) || 80, 120);
  const query: Record<string, unknown> = { clanId: req.params.id };
  if (req.query.before) {
    const beforeDate = new Date(String(req.query.before));
    if (!Number.isNaN(beforeDate.getTime())) query.createdAt = { $lt: beforeDate };
  }
  const messages = await ClanMessage.find(query)
    .populate("senderId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  sendOk(res, { messages: messages.reverse(), hasMore: messages.length === limit });
}));

clansRouter.post("/:id/messages", requireNotMuted, chatLimiter, validateBody(clanMessageSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { members } = await requireClanMember(req.params.id, req.user!.id);
  const created = await ClanMessage.create({
    clanId: req.params.id,
    senderId: req.user!.id,
    message: sanitizeText(req.body.message)
  });
  const message = await ClanMessage.findById(created._id)
    .populate("senderId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
    .lean();
  emitClanMembers(members, socketEvents.clanMessageNew, { clanId: req.params.id, message }, req.user!.id);
  await Promise.all(members
    .filter((memberId) => memberId !== req.user!.id)
    .slice(0, 50)
    .map((memberId) => createNotification(memberId, "MESSAGE", "New family message", `${req.user!.name}: ${message?.message ?? ""}`, { clanId: req.params.id, messageId: message?._id?.toString?.() })));
  sendOk(res, { message }, 201);
}));

clansRouter.post("/:id/messages/:messageId/reactions", chatLimiter, validateBody(reactionSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { members } = await requireClanMember(req.params.id, req.user!.id);
  if (!isValidObjectId(req.params.messageId)) throw new HttpError(400, "Invalid message ID", ErrorCode.VALIDATION);
  const message = await ClanMessage.findOne({ _id: req.params.messageId, clanId: req.params.id }).select("_id reactions").lean();
  if (!message) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);

  const requestedType = String(req.body.type || "");
  const existingReaction = (message.reactions || []).find((reaction: any) => reaction?.userId?.toString?.() === req.user!.id);
  const isRemoving = existingReaction?.type === requestedType;

  let updated;
  if (isRemoving) {
    updated = await ClanMessage.findByIdAndUpdate(
      req.params.messageId,
      { $pull: { reactions: { userId: req.user!.id } } },
      { new: true }
    )
      .populate("senderId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .lean();
  } else {
    await ClanMessage.updateOne({ _id: req.params.messageId }, { $pull: { reactions: { userId: req.user!.id } } });
    updated = await ClanMessage.findByIdAndUpdate(
      req.params.messageId,
      { $push: { reactions: { userId: req.user!.id, type: requestedType, createdAt: new Date() } } },
      { new: true }
    )
      .populate("senderId", "name username avatar activeCosmetics vipTier vipExpiresAt xp level levelTitle")
      .lean();
  }

  const s = updated?.senderId as { _id?: { toString(): string }; toString?(): string } | undefined;
  const senderId = s?._id?.toString?.() ?? s?.toString?.();
  if (!isRemoving && senderId && senderId !== req.user!.id) {
    await createNotification(senderId, "MESSAGE", "New family reaction", `${req.user!.name} reacted to your family message`, { clanId: req.params.id, messageId: req.params.messageId });
  }
  emitClanMembers(members, socketEvents.clanMessageUpdated, { clanId: req.params.id, message: updated });
  sendOk(res, { message: updated });
}));

clansRouter.delete("/:id/messages/:messageId", asyncHandler(async (req: AuthRequest, res) => {
  const { clan, members, role } = await requireClanMember(req.params.id, req.user!.id);
  if (!isValidObjectId(req.params.messageId)) throw new HttpError(400, "Invalid message ID", ErrorCode.VALIDATION);
  const message = await ClanMessage.findOne({ _id: req.params.messageId, clanId: req.params.id }).select("senderId").lean();
  if (!message) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
  const isOwn = idOf(message.senderId) === req.user!.id;
  if (!isOwn && !canModerateChat(role)) throw new HttpError(403, "You don't have permission to delete this message", ErrorCode.FORBIDDEN);
  await ClanMessage.deleteOne({ _id: req.params.messageId, clanId: req.params.id });
  emitClanMembers(members, socketEvents.clanMessageDeleted, { clanId: req.params.id, messageId: req.params.messageId });
  sendOk(res, { deleted: true });
}));

clansRouter.post("/:id/messages/clean", asyncHandler(async (req: AuthRequest, res) => {
  const { members, role } = await requireClanMember(req.params.id, req.user!.id);
  if (!canModerateChat(role)) throw new HttpError(403, "You don't have permission to clean the chat", ErrorCode.FORBIDDEN);
  const result = await ClanMessage.deleteMany({ clanId: req.params.id });
  emitClanMembers(members, socketEvents.clanChatCleaned, { clanId: req.params.id });
  sendOk(res, { deletedCount: result.deletedCount });
}));

clansRouter.post("/:id/messages/:messageId/report", reportLimiter, validateBody(clanMessageReportSchema), asyncHandler(async (req: AuthRequest, res) => {
  await requireClanMember(req.params.id, req.user!.id);
  if (!isValidObjectId(req.params.messageId)) throw new HttpError(400, "Invalid message ID", ErrorCode.VALIDATION);
  const message = await ClanMessage.findOne({ _id: req.params.messageId, clanId: req.params.id }).select("senderId message createdAt").lean();
  if (!message) throw new HttpError(404, "Message not found", ErrorCode.NOT_FOUND);
  const report = await Report.create({
    reporterId: req.user!.id,
    targetUserId: message.senderId,
    reason: req.body.reason,
    description: req.body.description,
    evidence: {
      clanId: req.params.id,
      clanMessageId: req.params.messageId,
      message: message.message,
      createdAt: message.createdAt
    },
    riskScore: 10
  });
  sendOk(res, { report }, 201);
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
    memberRoles: [{ userId: req.user!._id, role: "LEADER" }],
    memberCount: 1
  });
  await User.findByIdAndUpdate(req.user!.id, { $set: { clanId: clan._id } });
  await populateClanMembers(clan);
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
  const members = clan.memberIds.map((memberId: any) => idOf(memberId));
  const alreadyMember = members.includes(req.user!.id);
  if (!alreadyMember) {
    clan.memberIds = [...clan.memberIds, req.user!._id ?? req.user!.id];
    clan.memberCount = clan.memberIds.length;
    applyMemberRoles(clan);
    await clan.save();
  }
  await User.findByIdAndUpdate(req.user!.id, { $set: { clanId: clan._id } });
  await populateClanMembers(clan);
  const mapped = publicClan(clan, req.user!.id);
  if (!alreadyMember) {
    emitClanMembers(clan.memberIds, socketEvents.clanMemberJoined, { clanId: clan.id, userId: req.user!.id, clan: mapped }, req.user!.id);
  }
  sendOk(res, { clan: mapped });
}));

clansRouter.post("/:id/leave", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid clan ID", ErrorCode.VALIDATION);
  const clan = await Clan.findById(req.params.id);
  if (!clan) throw new HttpError(404, "Clan not found", ErrorCode.NOT_FOUND);
  const userId = req.user!.id;
  const isMember = clan.memberIds.some((memberId: any) => idOf(memberId) === userId);
  if (!isMember) throw new HttpError(400, "You are not a member of this clan", ErrorCode.VALIDATION);
  if (idOf(clan.ownerId) === userId && clan.memberIds.length > 1) {
    throw new HttpError(400, "Transfer ownership before leaving this clan", ErrorCode.VALIDATION);
  }
  clan.memberIds = clan.memberIds.filter((memberId: any) => idOf(memberId) !== userId);
  clan.memberCount = clan.memberIds.length;
  applyMemberRoles(clan);
  await clan.save();
  await User.findByIdAndUpdate(userId, { $unset: { clanId: "" } });
  if (clan.memberIds.length === 0) {
    const clanId = clan.id;
    await ClanInvite.deleteMany({ clanId: clan._id });
    await ClanMessage.deleteMany({ clanId: clan._id });
    await clan.deleteOne();
    emitUser(userId, socketEvents.clanMemberLeft, { clanId, userId, clan: null });
    return sendOk(res, { clan: null });
  }
  await populateClanMembers(clan);
  const mapped = publicClan(clan, req.user!.id);
  emitClanMembers(clan.memberIds, socketEvents.clanMemberLeft, { clanId: clan.id, userId, clan: mapped });
  emitUser(userId, socketEvents.clanMemberLeft, { clanId: clan.id, userId, clan: null });
  sendOk(res, { clan: null });
}));
