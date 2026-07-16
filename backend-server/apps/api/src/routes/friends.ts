import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { Friendship } from "../models/Friendship.js";
import { Block } from "../models/Block.js";
import { User } from "../models/User.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { createNotification } from "../services/notifications.js";

export const friendsRouter = Router();
friendsRouter.use(requireAuth);

friendsRouter.post("/friends/request/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  if (req.params.userId === req.user!.id) throw new HttpError(400, "Cannot friend yourself", ErrorCode.VALIDATION);
  const target = await User.findById(req.params.userId).select("_id name").lean();
  if (!target) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

  const blocked = await Block.exists({
    $or: [
      { blockerId: req.user!.id, blockedUserId: req.params.userId },
      { blockerId: req.params.userId, blockedUserId: req.user!.id }
    ]
  });
  if (blocked) throw new HttpError(403, "Cannot send friend request to this user", ErrorCode.FORBIDDEN);

  const existing = await Friendship.findOne({
    $or: [
      { userId: req.user!.id, friendId: req.params.userId },
      { userId: req.params.userId, friendId: req.user!.id }
    ]
  }).lean();
  if (existing) {
    if (existing.status === "ACCEPTED") throw new HttpError(409, "Already friends", ErrorCode.CONFLICT);
    if (existing.status === "PENDING") throw new HttpError(409, "Friend request already pending", ErrorCode.CONFLICT);
    if (existing.status === "BLOCKED") throw new HttpError(403, "Cannot send friend request", ErrorCode.FORBIDDEN);
  }

  const friendship = await Friendship.create({ userId: req.user!.id, friendId: req.params.userId, status: "PENDING" });
  await createNotification(req.params.userId, "FRIEND_REQUEST", "Friend Request", `${req.user!.name} sent you a friend request`, { userId: req.user!.id, friendshipId: friendship._id.toString() });
  sendOk(res, { friendship }, 201);
}));

friendsRouter.post("/friends/accept/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const friendship = await Friendship.findOne({ userId: req.params.userId, friendId: req.user!.id, status: "PENDING" });
  if (!friendship) throw new HttpError(404, "Friend request not found", ErrorCode.NOT_FOUND);
  friendship.status = "ACCEPTED";
  await friendship.save();
  await createNotification(req.params.userId, "FRIEND_ACCEPT", "Friend Request Accepted", `${req.user!.name} accepted your friend request`, { userId: req.user!.id });
  sendOk(res, { friendship });
}));

friendsRouter.post("/friends/decline/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const result = await Friendship.findOneAndDelete({ userId: req.params.userId, friendId: req.user!.id, status: "PENDING" });
  if (!result) throw new HttpError(404, "Friend request not found", ErrorCode.NOT_FOUND);
  sendOk(res, { declined: true });
}));

friendsRouter.post("/friends/unfriend/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const result = await Friendship.deleteOne({
    $or: [
      { userId: req.user!.id, friendId: req.params.userId, status: "ACCEPTED" },
      { userId: req.params.userId, friendId: req.user!.id, status: "ACCEPTED" }
    ]
  });
  if (result.deletedCount === 0) throw new HttpError(404, "Friendship not found", ErrorCode.NOT_FOUND);
  sendOk(res, { unfriended: true });
}));

friendsRouter.get("/friends", asyncHandler(async (req: AuthRequest, res) => {
  const friendships = await Friendship.find({ $or: [{ userId: req.user!.id }, { friendId: req.user!.id }], status: "ACCEPTED" })
    .populate("friendId", "name username avatar bio level levelTitle isVerified")
    .populate("userId", "name username avatar bio level levelTitle isVerified")
    .lean();
  const friends = friendships.map((f) => {
    const isUserId = f.userId && typeof f.userId === "object" && "_id" in f.userId && (f.userId as any)._id.toString() === req.user!.id;
    return isUserId ? f.friendId : f.userId;
  }).filter(Boolean);
  sendOk(res, { friends });
}));

friendsRouter.get("/friends/requests", asyncHandler(async (req: AuthRequest, res) => {
  const requests = await Friendship.find({ friendId: req.user!.id, status: "PENDING" })
    .populate("userId", "name username avatar")
    .sort({ createdAt: -1 })
    .lean();
  sendOk(res, { requests });
}));

friendsRouter.get("/friends/sent", asyncHandler(async (req: AuthRequest, res) => {
  const sent = await Friendship.find({ userId: req.user!.id, status: "PENDING" })
    .populate("friendId", "name username avatar")
    .sort({ createdAt: -1 })
    .lean();
  sendOk(res, { sent });
}));

friendsRouter.get("/friends/status/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const friendship = await Friendship.findOne({
    $or: [
      { userId: req.user!.id, friendId: req.params.userId },
      { userId: req.params.userId, friendId: req.user!.id }
    ]
  }).lean();
  let status: "NONE" | "PENDING" | "ACCEPTED" | "SENT" | "BLOCKED" = "NONE";
  if (friendship) {
    if (friendship.status === "PENDING") {
      status = friendship.friendId.toString() === req.user!.id ? "PENDING" : "SENT";
    } else {
      status = friendship.status as "ACCEPTED" | "BLOCKED";
    }
  }
  sendOk(res, { status, friendship });
}));

friendsRouter.get("/friends/mutual/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const myFriends = await Friendship.find({ $or: [{ userId: req.user!.id }, { friendId: req.user!.id }], status: "ACCEPTED" }).lean();
  const myFriendIds = new Set(myFriends.map((f) => f.userId.toString() === req.user!.id ? f.friendId.toString() : f.userId.toString()));
  const theirFriends = await Friendship.find({ $or: [{ userId: req.params.userId }, { friendId: req.params.userId }], status: "ACCEPTED" }).lean();
  const theirFriendIds = new Set(theirFriends.map((f) => f.userId.toString() === req.params.userId ? f.friendId.toString() : f.userId.toString()));
  const mutualIds = [...myFriendIds].filter((id) => theirFriendIds.has(id));
  const mutualCount = mutualIds.length;
  const mutual = await User.find({ _id: { $in: mutualIds } }).select("name username avatar").limit(6).lean();
  sendOk(res, { mutualCount, mutual });
}));

friendsRouter.get("/friends/count/:userId", asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid user ID", ErrorCode.VALIDATION);
  const count = await Friendship.countDocuments({
    $or: [{ userId: req.params.userId }, { friendId: req.params.userId }],
    status: "ACCEPTED"
  });
  sendOk(res, { count });
}));
