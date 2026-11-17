import { Router } from "express";
import { asyncHandler, sendOk } from "../utils/http.js";
import { listActiveRoomReactions } from "../services/reactions.js";

export const reactionsRouter = Router();

reactionsRouter.get("/reactions", asyncHandler(async (_req, res) => {
  const reactions = await listActiveRoomReactions();
  sendOk(res, { reactions });
}));
