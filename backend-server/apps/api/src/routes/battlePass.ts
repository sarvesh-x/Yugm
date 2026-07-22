import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { Season } from "../models/Season.js";
import { getBattlePass, purchaseBattlePass, levelUpBattlePass } from "../services/battlePass.js";

export const battlePassRouter = Router();
battlePassRouter.use(requireAuth);

battlePassRouter.get("/battle-pass", asyncHandler(async (req: AuthRequest, res) => {
  let season = await Season.findOne({ active: true }).lean();
  if (!season) {
    const { defaultSeason } = await import("../models/Season.js");
    const created = await Season.create(defaultSeason);
    season = JSON.parse(JSON.stringify(created));
  }
  const bp = await getBattlePass(req.user!.id);
  sendOk(res, { battlePass: bp?.battlePass ?? null, season });
}));

battlePassRouter.post("/battle-pass/purchase", asyncHandler(async (req: AuthRequest, res) => {
  const result = await purchaseBattlePass(req.user!.id);
  sendOk(res, result);
}));

battlePassRouter.post("/battle-pass/level-up", asyncHandler(async (req: AuthRequest, res) => {
  const xp = typeof req.body.xp === "number" ? req.body.xp : 100;
  const result = await levelUpBattlePass(req.user!.id, xp);
  sendOk(res, result);
}));
