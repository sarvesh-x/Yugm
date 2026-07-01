import { Router } from "express";
import { z } from "zod";
import { reportSchema } from "@yugm/shared";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { reportLimiter } from "../middleware/rateLimit.js";
import { validateBody } from "../middleware/validate.js";
import { Report } from "../models/Report.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";

const updateReportStatusSchema = z.object({
  status: z.enum(["PENDING", "REVIEWED", "ACTION_TAKEN", "DISMISSED"]),
});

export const reportsRouter = Router();

reportsRouter.post("/reports", requireAuth, reportLimiter, validateBody(reportSchema), asyncHandler(async (req: AuthRequest, res) => {
  const report = await Report.create({ ...req.body, reporterId: req.user!.id });
  sendOk(res, { report }, 201);
}));

reportsRouter.get("/admin/reports", requireAuth, requireRole("ADMIN", "MODERATOR"), asyncHandler(async (_req, res) => {
  const limit = Math.min(Number(_req.query.limit) || 100, 200);
  const reports = await Report.find().populate("reporterId targetUserId roomId").sort({ createdAt: -1 }).limit(limit).lean();
  sendOk(res, { reports });
}));

reportsRouter.patch("/admin/reports/:id", requireAuth, requireRole("ADMIN", "MODERATOR"), asyncHandler(async (req, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid report ID", ErrorCode.VALIDATION);
  const parsed = updateReportStatusSchema.parse(req.body);
  const report = await Report.findByIdAndUpdate(req.params.id, { status: parsed.status }, { new: true });
  if (!report) throw new HttpError(404, "Report not found", ErrorCode.NOT_FOUND);
  sendOk(res, { report });
}));
