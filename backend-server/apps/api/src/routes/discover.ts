import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import { Room } from "../models/Room.js";
import { User } from "../models/User.js";

export const discoverRouter = Router();
discoverRouter.use(requireAuth);

// GET /api/discover/trending — top rooms by live participant count
discoverRouter.get("/discover/trending", asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));

  const rooms = await Room.find({ status: "LIVE" })
    .sort({ participants: -1, createdAt: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("host", "name avatar username activeCosmetics level")
    .lean();

  sendOk(res, { rooms, page, limit });
}));

// GET /api/discover/recommended — AI-style mix: interest + language matched rooms + users
discoverRouter.get("/discover/recommended", asyncHandler(async (req: AuthRequest, res) => {
  const currentUser = await User.findById(req.user!.id)
    .select("interests languages city")
    .lean();

  const interests = currentUser?.interests ?? [];
  const languages = currentUser?.languages ?? [];

  const [rooms, users] = await Promise.all([
    Room.find({
      status: "LIVE",
      $or: [
        ...(interests.length ? [{ tags: { $in: interests } }] : []),
        ...(languages.length ? [{ language: { $in: languages } }] : []),
        {}, // fallback: any room
      ]
    })
      .sort({ participants: -1 })
      .limit(10)
      .populate("host", "name avatar username activeCosmetics level")
      .lean(),
    User.find({
      _id: { $ne: req.user!.id },
      $or: [
        ...(interests.length ? [{ interests: { $in: interests } }] : []),
        ...(languages.length ? [{ languages: { $in: languages } }] : []),
      ]
    })
      .select("_id name avatar username level levelTitle city isOnline")
      .limit(10)
      .lean(),
  ]);

  sendOk(res, {
    rooms: rooms.map(r => ({ item: r, reason: "Matches your interests" })),
    users: users.map(u => ({ item: u, reason: "Similar vibe" })),
    events: [],
  });
}));

// GET /api/discover/online-now — paginated list of currently online users
discoverRouter.get("/discover/online-now", asyncHandler(async (req: AuthRequest, res) => {
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));

  const users = await User.find({
    _id: { $ne: req.user!.id },
    lastSeen: { $gte: new Date(Date.now() - 10 * 60 * 1000) }, // online in last 10 min
  })
    .select("_id name avatar username level levelTitle city activeCosmetics")
    .sort({ lastSeen: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .lean();

  sendOk(res, { users, page, limit });
}));

// GET /api/discover/hubs — summary of available interest/mood/language hubs
discoverRouter.get("/discover/hubs", asyncHandler(async (req: AuthRequest, res) => {
  const hubs = [
    { type: "interest", name: "Music 🎵", key: "music", count: 0 },
    { type: "interest", name: "Gaming 🎮", key: "gaming", count: 0 },
    { type: "interest", name: "Study 📚", key: "study", count: 0 },
    { type: "interest", name: "Fitness 💪", key: "fitness", count: 0 },
    { type: "interest", name: "Movies 🎬", key: "movies", count: 0 },
    { type: "mood", name: "Chill ☕", key: "chill", count: 0 },
    { type: "mood", name: "Hype 🔥", key: "hype", count: 0 },
    { type: "mood", name: "Late Night 🌙", key: "late_night", count: 0 },
    { type: "language", name: "Hindi 🇮🇳", key: "hindi", count: 0 },
    { type: "language", name: "English 🇬🇧", key: "english", count: 0 },
    { type: "language", name: "Tamil", key: "tamil", count: 0 },
    { type: "language", name: "Telugu", key: "telugu", count: 0 },
  ];

  // Count live rooms per tag
  const liveRooms = await Room.find({ status: "LIVE" }).select("tags language").lean();
  for (const hub of hubs) {
    if (hub.type === "language") {
      hub.count = liveRooms.filter(r => r.language?.toLowerCase() === hub.key).length;
    } else {
      hub.count = liveRooms.filter(r => (r as any).tags?.includes(hub.key)).length;
    }
  }

  sendOk(res, { hubs });
}));

// GET /api/discover/hub/:key — rooms for a specific hub
discoverRouter.get("/discover/hub/:key", asyncHandler(async (req: AuthRequest, res) => {
  const { key } = req.params;
  const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10)));

  const rooms = await Room.find({
    status: "LIVE",
    $or: [{ tags: key }, { language: key }],
  })
    .sort({ participants: -1 })
    .skip((page - 1) * limit)
    .limit(limit)
    .populate("host", "name avatar username activeCosmetics level")
    .lean();

  sendOk(res, { items: rooms, page, limit });
}));
