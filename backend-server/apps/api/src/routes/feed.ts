import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { Friendship } from "../models/Friendship.js";
import { Follow } from "../models/Follow.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { Room } from "../models/Room.js";
import { Story } from "../models/Story.js";
import { asyncHandler, sendOk } from "../utils/http.js";

export const feedRouter = Router();

feedRouter.get("/feed", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const userId = req.user!._id;
  const friends = await Friendship.find({ $or: [{ userId }, { friendId: userId }], status: "ACCEPTED" }).lean();
  const friendIds = [...new Set(friends.map((f) => f.userId.toString() === userId.toString() ? f.friendId.toString() : f.userId.toString()))];

  const following = await Follow.find({ followerId: userId }).select("followingId").lean();
  const followingIds = following.map((f) => f.followingId.toString());
  const relevantIds = [...new Set([...friendIds, ...followingIds])];

  const activities = await RoomActivity.find({ userId: { $in: relevantIds } })
    .sort({ createdAt: -1 }).limit(30)
    .populate("userId", "name username avatar").populate("roomId", "title")
    .lean();

  const friendStories = await Story.find({ userId: { $in: friendIds }, status: "ACTIVE", expiresAt: { $gt: new Date() } })
    .sort({ createdAt: -1 }).limit(10)
    .populate("userId", "name username avatar")
    .lean();

  const friendRooms = await Room.find({ hostId: { $in: relevantIds }, status: "LIVE" })
    .sort({ participantCount: -1 }).limit(10)
    .populate("hostId", "name username avatar")
    .lean();

  const feed = [
    ...friendRooms.map((r: any) => ({ type: "FRIEND_LIVE", room: r, createdAt: r.startedAt || r.createdAt })),
    ...friendStories.map((s: any) => ({ type: "FRIEND_STORY", story: s, createdAt: s.createdAt })),
    ...activities.map((a: any) => ({ type: "ACTIVITY", activity: a, createdAt: a.createdAt })),
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 50);

  sendOk(res, { feed });
}));
