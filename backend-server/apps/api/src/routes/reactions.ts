import { Router } from "express";
import { asyncHandler, sendOk } from "../utils/http.js";
import { optionalAuth, type AuthRequest } from "../middleware/auth.js";
import { listActiveRoomReactions } from "../services/reactions.js";

export const reactionsRouter = Router();

reactionsRouter.get("/reactions", optionalAuth, asyncHandler(async (req: AuthRequest, res) => {
  const reactions = await listActiveRoomReactions(req.user ?? null);
  sendOk(res, { reactions });
}));
