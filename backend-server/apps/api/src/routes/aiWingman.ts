import { Router } from "express";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import {
  analyticsResponse,
  bioGenerateResponse,
  bioGenerateSchema,
  bioRateResponse,
  bioRateSchema,
  coachResponse,
  coachSchema,
  datePlanResponse,
  datePlanSchema,
  ghostDetectResponse,
  ghostDetectSchema,
  giftRecommendResponse,
  giftRecommendSchema,
  openerResponse,
  openerSchema,
  photoRateResponse,
  photoRateSchema,
  replyResponse,
  replySchema,
  type BioGenerateInput,
  type BioRateInput,
  type CoachInput,
  type DatePlanInput,
  type GhostDetectInput,
  type GiftRecommendInput,
  type OpenerInput,
  type ReplyInput
} from "../services/aiWingman.js";
import { asyncHandler, sendOk } from "../utils/http.js";

export const aiWingmanRouter = Router();

aiWingmanRouter.post(
  "/wingman/bio/generate",
  requireAuth,
  validateBody(bioGenerateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, bioGenerateResponse(req.body as BioGenerateInput));
  })
);

aiWingmanRouter.post(
  "/wingman/bio/rate",
  requireAuth,
  validateBody(bioRateSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, bioRateResponse(req.body as BioRateInput));
  })
);

aiWingmanRouter.post(
  "/wingman/opener",
  requireAuth,
  validateBody(openerSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, openerResponse(req.body as OpenerInput));
  })
);

aiWingmanRouter.post(
  "/wingman/reply",
  requireAuth,
  validateBody(replySchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, replyResponse(req.body as ReplyInput));
  })
);

aiWingmanRouter.post(
  "/wingman/coach",
  requireAuth,
  validateBody(coachSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, coachResponse(req.body as CoachInput));
  })
);

aiWingmanRouter.post(
  "/wingman/photo/rate",
  requireAuth,
  validateBody(photoRateSchema),
  asyncHandler(async (_req: AuthRequest, res) => {
    sendOk(res, photoRateResponse());
  })
);

aiWingmanRouter.post(
  "/wingman/ghost/detect",
  requireAuth,
  validateBody(ghostDetectSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, ghostDetectResponse(req.body as GhostDetectInput));
  })
);

aiWingmanRouter.post(
  "/wingman/date/plan",
  requireAuth,
  validateBody(datePlanSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, datePlanResponse(req.body as DatePlanInput));
  })
);

aiWingmanRouter.post(
  "/wingman/gift/recommend",
  requireAuth,
  validateBody(giftRecommendSchema),
  asyncHandler(async (req: AuthRequest, res) => {
    sendOk(res, giftRecommendResponse(req.body as GiftRecommendInput));
  })
);

aiWingmanRouter.get(
  "/wingman/analytics",
  requireAuth,
  asyncHandler(async (_req: AuthRequest, res) => {
    sendOk(res, analyticsResponse());
  })
);
