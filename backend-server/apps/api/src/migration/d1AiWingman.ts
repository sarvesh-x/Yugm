import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
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
import { createD1AccessSessionReader } from "./d1AccessSession.js";

export function createD1AiWingmanRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    await requireHttpSession(req.headers.authorization, access);
    next();
  });

  router.post(
    "/wingman/bio/generate",
    authenticate,
    validateBody(bioGenerateSchema),
    asyncHandler(async (req, res) => {
      sendOk(res, bioGenerateResponse(req.body as BioGenerateInput));
    })
  );

  router.post(
    "/wingman/bio/rate",
    authenticate,
    validateBody(bioRateSchema),
    asyncHandler(async (req, res) => {
      sendOk(res, bioRateResponse(req.body as BioRateInput));
    })
  );

  router.post(
    "/wingman/opener",
    authenticate,
    validateBody(openerSchema),
    asyncHandler(async (req, res) => {
      sendOk(res, openerResponse(req.body as OpenerInput));
    })
  );

  router.post(
    "/wingman/reply",
    authenticate,
    validateBody(replySchema),
    asyncHandler(async (req, res) => {
      sendOk(res, replyResponse(req.body as ReplyInput));
    })
  );

  router.post(
    "/wingman/coach",
    authenticate,
    validateBody(coachSchema),
    asyncHandler(async (req, res) => {
      sendOk(res, coachResponse(req.body as CoachInput));
    })
  );

  router.post(
    "/wingman/photo/rate",
    authenticate,
    validateBody(photoRateSchema),
    asyncHandler(async (_req, res) => {
      sendOk(res, photoRateResponse());
    })
  );

  router.post(
    "/wingman/ghost/detect",
    authenticate,
    validateBody(ghostDetectSchema),
    asyncHandler(async (req, res) => {
      sendOk(res, ghostDetectResponse(req.body as GhostDetectInput));
    })
  );

  router.post(
    "/wingman/date/plan",
    authenticate,
    validateBody(datePlanSchema),
    asyncHandler(async (req, res) => {
      sendOk(res, datePlanResponse(req.body as DatePlanInput));
    })
  );

  router.post(
    "/wingman/gift/recommend",
    authenticate,
    validateBody(giftRecommendSchema),
    asyncHandler(async (req, res) => {
      sendOk(res, giftRecommendResponse(req.body as GiftRecommendInput));
    })
  );

  router.get(
    "/wingman/analytics",
    authenticate,
    asyncHandler(async (_req, res) => {
      sendOk(res, analyticsResponse());
    })
  );

  return router;
}
