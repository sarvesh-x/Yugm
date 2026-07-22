import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { Mission, missionSeeds } from "../models/Mission.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { getActiveMissions, updateMissionProgress, claimMission } from "../services/missions.js";

export const missionsRouter = Router();
missionsRouter.use(requireAuth);

const progressSchema = z.object({
  action: z.string().min(1),
  delta: z.number().int().min(1).default(1)
});

const claimSchema = z.object({
  missionId: z.string().min(1)
});

missionsRouter.get("/missions", asyncHandler(async (req: AuthRequest, res) => {
  const type = req.query.type as string | undefined;
  let missions = await Mission.find({ active: true }).lean();
  if (missions.length === 0) {
    await Mission.insertMany(missionSeeds);
    missions = await Mission.find({ active: true }).lean();
  }
  if (type) missions = missions.filter((m) => m.type === type);
  sendOk(res, { missions });
}));

missionsRouter.get("/missions/active", asyncHandler(async (req: AuthRequest, res) => {
  const active = await getActiveMissions(req.user!.id);
  sendOk(res, active);
}));

missionsRouter.post("/missions/progress", validateBody(progressSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { action, delta } = req.body;
  const results = await updateMissionProgress(req.user!.id, action, delta);
  sendOk(res, { results });
}));

missionsRouter.post("/missions/claim", validateBody(claimSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { missionId } = req.body;
  if (!isValidObjectId(missionId)) throw new HttpError(400, "Invalid mission ID", ErrorCode.VALIDATION);
  const result = await claimMission(req.user!.id, missionId);
  sendOk(res, result);
}));
