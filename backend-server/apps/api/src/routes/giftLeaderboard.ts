import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { asyncHandler, sendOk } from "../utils/http.js";

export const giftLeaderboardRouter = Router();

giftLeaderboardRouter.get("/gift-leaderboard", requireAuth, asyncHandler(async (req: AuthRequest, res) => {
  const period = req.query.period as string || "all";
  const limit = Math.min(Number(req.query.limit) || 20, 50);
  const skip = Number(req.query.skip) || 0;

  let dateFilter = {};
  if (period === "daily") {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    dateFilter = { createdAt: { $gte: start } };
  } else if (period === "weekly") {
    const start = new Date(); start.setDate(start.getDate() - start.getDay()); start.setHours(0, 0, 0, 0);
    dateFilter = { createdAt: { $gte: start } };
  } else if (period === "monthly") {
    const start = new Date(); start.setDate(1); start.setHours(0, 0, 0, 0);
    dateFilter = { createdAt: { $gte: start } };
  }

  const topSenders = await GiftTransaction.aggregate([
    { $match: dateFilter },
    { $group: { _id: "$senderId", totalCoins: { $sum: "$coinAmount" }, giftCount: { $sum: 1 } } },
    { $sort: { totalCoins: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $project: { totalCoins: 1, giftCount: 1, "user.name": 1, "user.username": 1, "user.avatar": 1, "user._id": 1 } },
  ]);

  const topReceivers = await GiftTransaction.aggregate([
    { $match: dateFilter },
    { $group: { _id: "$receiverId", totalCoins: { $sum: "$coinAmount" }, giftCount: { $sum: 1 } } },
    { $sort: { totalCoins: -1 } },
    { $skip: skip },
    { $limit: limit },
    { $lookup: { from: "users", localField: "_id", foreignField: "_id", as: "user" } },
    { $unwind: { path: "$user", preserveNullAndEmptyArrays: true } },
    { $project: { totalCoins: 1, giftCount: 1, "user.name": 1, "user.username": 1, "user.avatar": 1, "user._id": 1 } },
  ]);

  sendOk(res, { topSenders, topReceivers, period });
}));
