import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Response } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import {
  consentSchema,
  faceSchema,
  nextVoicePrompt,
  publicTrustVerification,
  TRUST_CONSENT_VERSION,
  voiceSchema,
  type TrustConsentInput,
  type TrustFaceInput,
  type TrustVoiceInput
} from "../services/trustVerificationShared.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";

type Row = Record<string, string | number | null>;
type SubmissionTable = "face_verification_submissions" | "voice_verification_submissions";

const optional = (field: string, value: string | number | null) => value == null ? {} : { [field]: value };
const providerJson = (value: unknown) => value === undefined ? null : JSON.stringify(value);

const presentVerification = (row: Row) => publicTrustVerification({
  id: row.source_id,
  status: row.status,
  level: row.level,
  faceStatus: row.face_status,
  voiceStatus: row.voice_status,
  livenessStatus: row.liveness_status,
  verificationScore: row.verification_score,
  riskScore: row.risk_score,
  verifiedBadgeEnabled: row.verified_badge_enabled,
  creatorTrustEnabled: row.creator_trust_enabled,
  submittedAt: row.submitted_at,
  reviewedAt: row.reviewed_at,
  verifiedAt: row.verified_at,
  rejectedAt: row.rejected_at,
  rejectionReason: row.rejection_reason,
  consentVersion: row.consent_version,
  consentAcceptedAt: row.consent_accepted_at
});

// D1 stores the Mongoose optional fields as SQL NULL. Legacy JSON omits unset
// paths but keeps explicit nulls and the Mongoose version key.
const presentFaceSubmission = (row: Row) => ({
  _id: row.source_id,
  userId: row.user_id,
  verificationId: row.verification_id,
  ...optional("selfieImageUrl", row.selfie_image_url),
  ...optional("selfieVideoUrl", row.selfie_video_url),
  ...optional("livenessVideoUrl", row.liveness_video_url),
  ...optional("faceMatchScore", row.face_match_score),
  ...optional("livenessScore", row.liveness_score),
  ...optional("qualityScore", row.quality_score),
  ...optional("provider", row.provider),
  ...optional("providerReferenceId", row.provider_reference_id),
  ...(row.provider_response == null ? {} : { providerResponse: JSON.parse(String(row.provider_response)) }),
  status: row.status,
  ...optional("failureReason", row.failure_reason),
  ...optional("reviewedAt", row.reviewed_at),
  ...optional("reviewedByAdminId", row.reviewed_by_admin_id),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  __v: 0
});

const presentVoiceSubmission = (row: Row) => ({
  _id: row.source_id,
  userId: row.user_id,
  verificationId: row.verification_id,
  ...optional("audioUrl", row.audio_url),
  ...optional("transcriptText", row.transcript_text),
  promptText: row.prompt_text,
  ...optional("voiceLivenessScore", row.voice_liveness_score),
  ...optional("voiceMatchScore", row.voice_match_score),
  ...optional("audioQualityScore", row.audio_quality_score),
  ...optional("provider", row.provider),
  ...optional("providerReferenceId", row.provider_reference_id),
  ...(row.provider_response == null ? {} : { providerResponse: JSON.parse(String(row.provider_response)) }),
  status: row.status,
  ...optional("failureReason", row.failure_reason),
  ...optional("reviewedAt", row.reviewed_at),
  ...optional("reviewedByAdminId", row.reviewed_by_admin_id),
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  __v: 0
});

export function createD1TrustVerificationRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.trustSession = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const viewerId = (res: Response) => (res.locals.trustSession as { user: { id: string } }).user.id;

  const readVerification = (userId: string) => db.prepare(`SELECT * FROM trust_verifications
    WHERE user_id = ? ORDER BY created_at ASC, source_id ASC LIMIT 1`).bind(userId).first<Row>();
  const readVerificationById = (id: string) => db.prepare("SELECT * FROM trust_verifications WHERE source_id = ?")
    .bind(id).first<Row>();
  const readSubmission = (table: SubmissionTable, id: string) =>
    db.prepare(`SELECT * FROM ${table} WHERE source_id = ?`).bind(id).first<Row>();

  async function ensureVerification(userId: string) {
    const existing = await readVerification(userId);
    if (existing) return existing;
    const id = newId();
    const time = new Date().toISOString();
    await db.prepare(`INSERT INTO trust_verifications
      (source_id, user_id, status, level, face_status, voice_status, liveness_status,
       verified_badge_enabled, creator_trust_enabled, created_at, updated_at)
      SELECT ?, ?, 'NOT_STARTED', 'BASIC', 'NOT_SUBMITTED', 'NOT_SUBMITTED', 'NOT_SUBMITTED', 0, 0, ?, ?
      WHERE NOT EXISTS (SELECT 1 FROM trust_verifications WHERE user_id = ?)`)
      .bind(id, userId, time, time, userId).run();
    const created = await readVerification(userId);
    if (!created) throw new HttpError(500, "Trust verification unavailable", ErrorCode.INTERNAL);
    return created;
  }

  router.get("/me", authenticate, asyncHandler(async (_req, res) => {
    const verification = await ensureVerification(viewerId(res));
    sendOk(res, {
      title: "Yugm Trust Verification",
      tagline: "Show people you're real.",
      verification: presentVerification(verification)
    });
  }));

  router.post("/start", authenticate, asyncHandler(async (_req, res) => {
    const current = await ensureVerification(viewerId(res));
    const time = new Date().toISOString();
    const updated = await db.prepare(`UPDATE trust_verifications SET status = 'INCOMPLETE', updated_at = ?
      WHERE source_id = ? RETURNING *`).bind(time, current.source_id).first<Row>();
    if (!updated) throw new HttpError(500, "Trust verification unavailable", ErrorCode.INTERNAL);
    sendOk(res, { verification: presentVerification(updated) }, 201);
  }));

  router.post("/consent", authenticate, validateBody(consentSchema), asyncHandler(async (req, res) => {
    const current = await ensureVerification(viewerId(res));
    const input = req.body as TrustConsentInput;
    const time = new Date().toISOString();
    const updated = await db.prepare(`UPDATE trust_verifications SET
        status = CASE WHEN status = 'NOT_STARTED' THEN 'INCOMPLETE' ELSE status END,
        consent_version = ?, consent_accepted_at = ?, updated_at = ?
      WHERE source_id = ? RETURNING *`)
      .bind(input.consentVersion ?? TRUST_CONSENT_VERSION, time, time, current.source_id).first<Row>();
    if (!updated) throw new HttpError(500, "Trust verification unavailable", ErrorCode.INTERNAL);
    sendOk(res, { verification: presentVerification(updated) });
  }));

  router.get("/voice-prompt", authenticate, asyncHandler(async (_req, res) => {
    sendOk(res, { promptText: nextVoicePrompt() });
  }));

  router.post("/face", authenticate, validateBody(faceSchema), asyncHandler(async (req, res) => {
    const input = req.body as TrustFaceInput;
    if (!input.selfieImageUrl && !input.selfieVideoUrl && !input.livenessVideoUrl) {
      throw new HttpError(400, "Submit a selfie image, selfie video, or liveness video", ErrorCode.VALIDATION);
    }
    const userId = viewerId(res);
    const current = await ensureVerification(userId);
    const time = new Date().toISOString();
    const submissionId = newId();
    const [updated] = await db.batch<Row>([
      db.prepare(`UPDATE trust_verifications SET
          status = CASE WHEN status = 'NOT_STARTED' THEN 'INCOMPLETE' ELSE status END,
          face_status = 'SUBMITTED',
          liveness_status = CASE WHEN ?1 IS NOT NULL THEN 'SUBMITTED' ELSE liveness_status END,
          updated_at = ?2
        WHERE source_id = ?3 RETURNING *`)
        .bind(input.livenessVideoUrl ?? null, time, current.source_id),
      db.prepare(`INSERT INTO face_verification_submissions
        (source_id, user_id, verification_id, selfie_image_url, selfie_video_url, liveness_video_url,
         provider, provider_reference_id, provider_response, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)`)
        .bind(submissionId, userId, current.source_id, input.selfieImageUrl ?? null,
          input.selfieVideoUrl ?? null, input.livenessVideoUrl ?? null, input.provider ?? null,
          input.providerReferenceId ?? null, providerJson(input.providerResponse), time, time)
    ]);
    if (!updated.results[0]) throw new HttpError(500, "Trust verification unavailable", ErrorCode.INTERNAL);
    const submission = await readSubmission("face_verification_submissions", submissionId);
    if (!submission) throw new HttpError(500, "Face verification unavailable", ErrorCode.INTERNAL);
    sendOk(res, {
      verification: presentVerification(updated.results[0]),
      submission: presentFaceSubmission(submission)
    }, 201);
  }));

  router.post("/voice", authenticate, validateBody(voiceSchema), asyncHandler(async (req, res) => {
    const input = req.body as TrustVoiceInput;
    if (!input.audioUrl) throw new HttpError(400, "Submit a voice audio URL", ErrorCode.VALIDATION);
    const userId = viewerId(res);
    const current = await ensureVerification(userId);
    const time = new Date().toISOString();
    const submissionId = newId();
    const [updated] = await db.batch<Row>([
      db.prepare(`UPDATE trust_verifications SET
          status = CASE WHEN status = 'NOT_STARTED' THEN 'INCOMPLETE' ELSE status END,
          voice_status = 'SUBMITTED', updated_at = ?1
        WHERE source_id = ?2 RETURNING *`)
        .bind(time, current.source_id),
      db.prepare(`INSERT INTO voice_verification_submissions
        (source_id, user_id, verification_id, audio_url, transcript_text, prompt_text,
         provider, provider_reference_id, provider_response, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'SUBMITTED', ?, ?)`)
        .bind(submissionId, userId, current.source_id, input.audioUrl, input.transcriptText ?? null,
          input.promptText, input.provider ?? null, input.providerReferenceId ?? null,
          providerJson(input.providerResponse), time, time)
    ]);
    if (!updated.results[0]) throw new HttpError(500, "Trust verification unavailable", ErrorCode.INTERNAL);
    const submission = await readSubmission("voice_verification_submissions", submissionId);
    if (!submission) throw new HttpError(500, "Voice verification unavailable", ErrorCode.INTERNAL);
    sendOk(res, {
      verification: presentVerification(updated.results[0]),
      submission: presentVoiceSubmission(submission)
    }, 201);
  }));

  router.post("/submit-review", authenticate, asyncHandler(async (_req, res) => {
    const current = await ensureVerification(viewerId(res));
    if (!current.consent_accepted_at) {
      throw new HttpError(400, "Accept consent before submitting Yugm Trust Verification", ErrorCode.VALIDATION);
    }
    if (current.face_status === "NOT_SUBMITTED") {
      throw new HttpError(400, "Submit face verification before review", ErrorCode.VALIDATION);
    }
    if (current.voice_status === "NOT_SUBMITTED") {
      throw new HttpError(400, "Submit voice verification before review", ErrorCode.VALIDATION);
    }
    const time = new Date().toISOString();
    const updated = await db.prepare(`UPDATE trust_verifications
      SET status = 'PENDING_REVIEW', submitted_at = ?, updated_at = ?
      WHERE source_id = ? RETURNING *`).bind(time, time, current.source_id).first<Row>();
    if (!updated) throw new HttpError(500, "Trust verification unavailable", ErrorCode.INTERNAL);
    sendOk(res, { verification: presentVerification(updated) });
  }));

  router.post("/retry", authenticate, asyncHandler(async (_req, res) => {
    const current = await ensureVerification(viewerId(res));
    const time = new Date().toISOString();
    const updated = await db.prepare(`UPDATE trust_verifications SET
        status = 'INCOMPLETE', face_status = 'NOT_SUBMITTED', voice_status = 'NOT_SUBMITTED',
        liveness_status = 'NOT_SUBMITTED', rejection_reason = NULL, updated_at = ?
      WHERE source_id = ? RETURNING *`).bind(time, current.source_id).first<Row>();
    if (!updated) throw new HttpError(500, "Trust verification unavailable", ErrorCode.INTERNAL);
    sendOk(res, { verification: presentVerification(updated) });
  }));

  router.get("/status", authenticate, asyncHandler(async (_req, res) => {
    const verification = await ensureVerification(viewerId(res));
    sendOk(res, { verification: presentVerification(verification) });
  }));

  return router;
}
