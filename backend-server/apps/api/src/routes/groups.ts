import { Router } from "express";
import { z } from "zod";
import { createGroupChatSchema, groupMessageSchema, socketEvents } from "@yugm/shared";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { chatLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { GroupChat } from "../models/GroupChat.js";
import { GroupMessage } from "../models/GroupMessage.js";
import { emitUser } from "../services/socket.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId, sanitizeText } from "../utils/http.js";

export const groupsRouter = Router();
groupsRouter.use(requireAuth);

async function requireGroupParticipant(groupId: string, userId: string) {
  if (!isValidObjectId(groupId)) throw new HttpError(400, "Invalid group ID", ErrorCode.VALIDATION);
  const group = await GroupChat.findById(groupId).lean();
  if (!group) throw new HttpError(404, "Group not found", ErrorCode.NOT_FOUND);
  const participants = (group.participantIds ?? []).map((p: any) => p.toString());
  if (!participants.includes(userId)) throw new HttpError(403, "You are not a participant of this group", ErrorCode.FORBIDDEN);
  return { group, participants };
}

function emitToParticipants(participantIds: string[], event: string, payload: unknown, skipUserId?: string) {
  participantIds.forEach((pid) => {
    if (pid !== skipUserId) emitUser(pid, event, payload);
  });
}

groupsRouter.post("/groups", validateBody(createGroupChatSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { name, participantIds } = req.body;
  const allIds = [...new Set([...participantIds, req.user!.id])];
  const group = await GroupChat.create({
    name: sanitizeText(name),
    createdBy: req.user!._id ?? req.user!.id,
    participantIds: allIds
  });
  const populated = await GroupChat.findById(group._id)
    .populate("createdBy", "name username avatar")
    .populate("participantIds", "name username avatar")
    .lean();
  emitToParticipants(allIds, socketEvents.groupCreated, { group: populated }, req.user!.id);
  sendOk(res, { group: populated }, 201);
}));

groupsRouter.get("/groups", asyncHandler(async (req: AuthRequest, res) => {
  const groups = await GroupChat.find({ participantIds: req.user!.id })
    .populate("createdBy", "name username avatar")
    .populate("participantIds", "name username avatar")
    .sort({ lastMessageAt: -1, createdAt: -1 })
    .lean();
  sendOk(res, { groups });
}));

groupsRouter.get("/groups/:id", asyncHandler(async (req: AuthRequest, res) => {
  await requireGroupParticipant(req.params.id, req.user!.id);
  const group = await GroupChat.findById(req.params.id)
    .populate("createdBy", "name username avatar")
    .populate("participantIds", "name username avatar")
    .lean();
  if (!group) throw new HttpError(404, "Group not found", ErrorCode.NOT_FOUND);
  const messageCount = await GroupMessage.countDocuments({ groupId: req.params.id });
  sendOk(res, { group, messageCount });
}));

groupsRouter.post("/groups/:id/message", chatLimiter, validateBody(groupMessageSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { participants } = await requireGroupParticipant(req.params.id, req.user!.id);
  const created = await GroupMessage.create({
    groupId: req.params.id,
    senderId: req.user!.id,
    message: sanitizeText(req.body.message),
    mediaUrl: req.body.mediaUrl ?? "",
    mediaType: req.body.mediaType ?? "",
    duration: req.body.duration ?? 0
  });
  await GroupChat.findByIdAndUpdate(req.params.id, {
    lastMessage: created.message,
    lastMessageAt: new Date()
  });
  const message = await GroupMessage.findById(created._id)
    .populate("senderId", "name username avatar")
    .lean();
  emitToParticipants(participants, socketEvents.groupMessageNew, { groupId: req.params.id, message }, req.user!.id);
  sendOk(res, { message }, 201);
}));

groupsRouter.get("/groups/:id/messages", asyncHandler(async (req: AuthRequest, res) => {
  await requireGroupParticipant(req.params.id, req.user!.id);
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.min(Math.max(1, Number(req.query.limit) || 30), 100);
  const messages = await GroupMessage.find({ groupId: req.params.id })
    .populate("senderId", "name username avatar")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();
  sendOk(res, { messages: messages.reverse() });
}));

groupsRouter.post("/groups/:id/add", asyncHandler(async (req: AuthRequest, res) => {
  const { group, participants } = await requireGroupParticipant(req.params.id, req.user!.id);
  const creatorId = (group.createdBy as any)?._id?.toString?.() ?? group.createdBy?.toString?.() ?? group.createdBy;
  if (creatorId !== req.user!.id) throw new HttpError(403, "Only the group creator can add participants", ErrorCode.FORBIDDEN);
  const parsed = z.object({ participantIds: z.array(z.string().regex(/^[0-9a-fA-F]{24}$/)).min(1).max(32) }).safeParse(req.body);
  if (!parsed.success) throw new HttpError(422, "Invalid participantIds", ErrorCode.VALIDATION);
  const newIds = parsed.data.participantIds.filter((id: string) => !participants.includes(id));
  if (newIds.length === 0) return sendOk(res, { group });
  await GroupChat.findByIdAndUpdate(req.params.id, { $addToSet: { participantIds: { $each: newIds } } });
  const updated = await GroupChat.findById(req.params.id)
    .populate("createdBy", "name username avatar")
    .populate("participantIds", "name username avatar")
    .lean();
  const allParticipants = [...new Set([...participants, ...newIds])];
  emitToParticipants(allParticipants, socketEvents.groupParticipantAdd, { groupId: req.params.id, group: updated, addedUserIds: newIds }, req.user!.id);
  sendOk(res, { group: updated });
}));

groupsRouter.post("/groups/:id/remove", asyncHandler(async (req: AuthRequest, res) => {
  const { group, participants } = await requireGroupParticipant(req.params.id, req.user!.id);
  const creatorId = (group.createdBy as any)?._id?.toString?.() ?? group.createdBy?.toString?.() ?? group.createdBy;
  if (creatorId !== req.user!.id) throw new HttpError(403, "Only the group creator can remove participants", ErrorCode.FORBIDDEN);
  const parsed = z.object({ userId: z.string().regex(/^[0-9a-fA-F]{24}$/) }).safeParse(req.body);
  if (!parsed.success) throw new HttpError(422, "Invalid userId", ErrorCode.VALIDATION);
  const { userId: targetId } = parsed.data;
  if (!participants.includes(targetId)) throw new HttpError(404, "User not in group", ErrorCode.NOT_FOUND);
  if (targetId === creatorId) throw new HttpError(400, "Creator cannot be removed", ErrorCode.VALIDATION);
  await GroupChat.findByIdAndUpdate(req.params.id, { $pull: { participantIds: targetId } });
  const updated = await GroupChat.findById(req.params.id)
    .populate("createdBy", "name username avatar")
    .populate("participantIds", "name username avatar")
    .lean();
  emitToParticipants(participants, socketEvents.groupParticipantRemove, { groupId: req.params.id, group: updated, removedUserId: targetId });
  sendOk(res, { group: updated });
}));

groupsRouter.post("/groups/:id/leave", asyncHandler(async (req: AuthRequest, res) => {
  const { group, participants } = await requireGroupParticipant(req.params.id, req.user!.id);
  const remaining = participants.filter((p: string) => p !== req.user!.id);
  if (remaining.length === 0) {
    await GroupChat.deleteOne({ _id: req.params.id });
    await GroupMessage.deleteMany({ groupId: req.params.id });
    return sendOk(res, { left: true });
  }
  const creatorId = (group.createdBy as any)?._id?.toString?.() ?? group.createdBy?.toString?.() ?? group.createdBy;
  let update: any = { $pull: { participantIds: req.user!.id } };
  if (creatorId === req.user!.id) {
    update.$set = { createdBy: remaining[0] };
  }
  await GroupChat.findByIdAndUpdate(req.params.id, update);
  const updated = await GroupChat.findById(req.params.id)
    .populate("createdBy", "name username avatar")
    .populate("participantIds", "name username avatar")
    .lean();
  emitToParticipants(remaining, socketEvents.groupParticipantRemove, { groupId: req.params.id, group: updated, removedUserId: req.user!.id });
  sendOk(res, { left: true });
}));
