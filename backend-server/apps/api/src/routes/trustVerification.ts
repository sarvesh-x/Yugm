import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, sendOk } from "../utils/http.js";
import {
  acceptTrustConsent,
  getOrCreateTrustVerification,
  nextVoicePrompt,
  publicTrustVerification,
  retryTrustVerification,
  startTrustVerification,
  submitFaceVerification,
  submitTrustReview,
  submitVoiceVerification,
  TRUST_CONSENT_VERSION
} from "../services/trustVerification.js";

export const trustVerificationRouter = Router();
trustVerificationRouter.use(requireAuth);

const consentSchema = z.object({
  consentVersion: z.string().min(3).max(80).optional()
});

const faceSchema = z.object({
  selfieImageUrl: z.string().url().optional(),
  selfieVideoUrl: z.string().url().optional(),
  livenessVideoUrl: z.string().url().optional(),
  provider: z.string().max(80).optional(),
  providerReferenceId: z.string().max(160).optional(),
  providerResponse: z.unknown().optional()
});

const voiceSchema = z.object({
  audioUrl: z.string().url(),
  transcriptText: z.string().max(2000).optional(),
  promptText: z.string().min(8).max(500),
  provider: z.string().max(80).optional(),
  providerReferenceId: z.string().max(160).optional(),
  providerResponse: z.unknown().optional()
});

trustVerificationRouter.get("/me", asyncHandler(async (req: AuthRequest, res) => {
  const verification = await getOrCreateTrustVerification(req.user!.id);
  sendOk(res, {
    title: "Yugm Trust Verification",
    tagline: "Show people you're real.",
    verification: publicTrustVerification(verification)
  });
}));

trustVerificationRouter.post("/start", asyncHandler(async (req: AuthRequest, res) => {
  const verification = await startTrustVerification(req.user!.id);
  sendOk(res, { verification: publicTrustVerification(verification) }, 201);
}));

trustVerificationRouter.post("/consent", validateBody(consentSchema), asyncHandler(async (req: AuthRequest, res) => {
  const verification = await acceptTrustConsent(req.user!.id, req.body.consentVersion ?? TRUST_CONSENT_VERSION);
  sendOk(res, { verification: publicTrustVerification(verification) });
}));

trustVerificationRouter.get("/voice-prompt", (_req, res) => {
  sendOk(res, { promptText: nextVoicePrompt() });
});

trustVerificationRouter.post("/face", validateBody(faceSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { verification, submission } = await submitFaceVerification(req.user!.id, req.body);
  sendOk(res, { verification: publicTrustVerification(verification), submission }, 201);
}));

trustVerificationRouter.post("/voice", validateBody(voiceSchema), asyncHandler(async (req: AuthRequest, res) => {
  const { verification, submission } = await submitVoiceVerification(req.user!.id, req.body);
  sendOk(res, { verification: publicTrustVerification(verification), submission }, 201);
}));

trustVerificationRouter.post("/submit-review", asyncHandler(async (req: AuthRequest, res) => {
  const verification = await submitTrustReview(req.user!.id);
  sendOk(res, { verification: publicTrustVerification(verification) });
}));

trustVerificationRouter.post("/retry", asyncHandler(async (req: AuthRequest, res) => {
  const verification = await retryTrustVerification(req.user!.id);
  sendOk(res, { verification: publicTrustVerification(verification) });
}));

trustVerificationRouter.get("/status", asyncHandler(async (req: AuthRequest, res) => {
  const verification = await getOrCreateTrustVerification(req.user!.id);
  sendOk(res, { verification: publicTrustVerification(verification) });
}));
