import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { asyncHandler, sendOk, HttpError, ErrorCode } from "../utils/http.js";
import { getBattlePass, purchaseBattlePass, claimBattlePassReward } from "../services/battlePass.js";
import { validateBody } from "../middleware/validate.js";
import { z } from "zod";

export const battlePassRouter = Router();
battlePassRouter.use(requireAuth);

battlePassRouter.get("/battle-pass", asyncHandler(async (req: AuthRequest, res) => {
  const bp = await getBattlePass(req.user!.id);
  sendOk(res, { battlePass: bp.battlePass, season: bp.season });
}));

battlePassRouter.post("/battle-pass/purchase", asyncHandler(async (req: AuthRequest, res) => {
  const result = await purchaseBattlePass(req.user!.id);
  sendOk(res, result);
}));

const claimRewardSchema = z.object({ level: z.number().int().min(1).max(100), track: z.enum(["free", "premium"]) });
battlePassRouter.post("/battle-pass/claim", validateBody(claimRewardSchema), asyncHandler(async (req: AuthRequest, res) => {
  const result = await claimBattlePassReward(req.user!.id, req.body.level, req.body.track);
  sendOk(res, result);
}));
