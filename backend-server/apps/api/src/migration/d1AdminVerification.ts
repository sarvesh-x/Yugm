import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import type { D1Database, R2Bucket } from "@cloudflare/workers-types";
import { Router, type Request } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit, prepareD1AdminAudit, type D1Admin } from "./d1AdminAuth.js";
import { newId } from "./d1Cosmetics.js";
import { person, personJson } from "./d1People.js";
import { trustMediaMime, trustMediaPath, trustMediaReference } from "./d1TrustMedia.js";

type Row = Record<string, string | number | null>;
const note = z.object({ adminNotes: z.string().max(2000).optional() });
const rejection = note.extend({ rejectionReason: z.string().min(2).max(1000) });
const optionalReason = rejection.partial({ rejectionReason: true });
const allowed = (admin: D1Admin, permission: "creator_kyc.sensitive.read" | "trust_verification.media.read") =>
  admin.isSuperAdmin || admin.permissions.includes(permission);
const profile = (row: Row) => ({ ...person(String(row.profile)), role: row.user_role });
const trustFields = "status level face_status voice_status liveness_status verification_score risk_score submitted_at reviewed_at verified_at rejected_at rejection_reason consent_version consent_accepted_at";
const kycFields = "user_id legal_full_name date_of_birth pan_last4 upi_id_masked bank_account_last4 bank_ifsc bank_holder_name kyc_status payout_status submitted_at verified_at rejected_at rejection_reason admin_notes";
const columns = (list: string) => list.split(" ").join(", ");
const fields = (row: Row, list: string) => Object.fromEntries(list.split(" ")
  .map(key => [key.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase()), row[key] ?? null]));
const trust = (row: Row) => ({ id: row.source_id, ...fields(row, trustFields),
  verifiedBadgeEnabled: Boolean(row.verified_badge_enabled), creatorTrustEnabled: Boolean(row.creator_trust_enabled) });
const kyc = (row: Row, sensitive = false) => ({ id: row.source_id, ...fields(row, kycFields),
  panVerified: Boolean(row.pan_verified), sensitiveAccessGranted: sensitive, sensitiveFieldsMasked: true });
const validationId = (value: string, label = "id") => {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
  return value.toLowerCase();
};
const trustNotFound = () => new HttpError(404, "Trust verification not found", ErrorCode.NOT_FOUND);
const kycNotFound = () => new HttpError(404, "Creator payout KYC not found", ErrorCode.NOT_FOUND);
const adminMediaUrl = (value: string | number | null) => {
  if (typeof value !== "string" || !value.startsWith(trustMediaPath)) return null;
  const name = value.slice(trustMediaPath.length);
  return trustMediaReference.test(name) ? `/api/admin/trust-verifications/media/${encodeURIComponent(name)}` : null;
};

export function createD1AdminVerificationRouter(db: D1Database, secret?: string, privateMedia?: R2Bucket) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const people = `${personJson("u", true)} AS profile, u.role AS user_role`;
  const maskedKycColumns = `source_id, pan_verified, ${columns(kycFields)}`;
  const readKyc = (id: string) => db.prepare(`SELECT ${maskedKycColumns} FROM creator_payout_kycs
    WHERE user_id = ? ORDER BY updated_at DESC, source_id LIMIT 1`).bind(id).first<Row>();
  const queue = async (req: Request, table: "trust_verifications" | "creator_payout_kycs") => {
    const { page, limit, skip } = pageParams(req.query);
    const verification = table === "trust_verifications";
    const projection = verification ? "t.*" : maskedKycColumns.split(", ").map(column => `t.${column}`).join(", ");
    const condition = `WHERE (?1 IS NULL OR t.${verification ? "status" : "kyc_status"} = ?1)`;
    const status = typeof req.query.status === "string" && req.query.status ? req.query.status : null;
    const [items, count] = await db.batch<Row>([
      db.prepare(`SELECT ${projection}, ${people} FROM ${table} t JOIN users u ON u.source_id = t.user_id ${condition}
        ORDER BY t.submitted_at DESC, t.created_at DESC, t.source_id LIMIT ?2 OFFSET ?3`).bind(status, limit, skip),
      db.prepare(`SELECT COUNT(*) AS total FROM ${table} t ${condition}`).bind(status)
    ]);
    return { items: items.results, meta: paginationMeta(page, limit, Number(count.results[0]?.total ?? 0)) };
  };

  router.get("/trust-verifications", guard("trust_verification.read"), asyncHandler(async (req, res) => {
    const result = await queue(req, "trust_verifications");
    adminOk(res, { trustVerifications: result.items.map(row => ({ ...trust(row), user: profile(row) })) }, result.meta);
  }));
  router.get("/trust-verifications/:id", guard("trust_verification.read"), asyncHandler(async (req, res) => {
    const id = validationId(req.params.id);
    const admin = adminFrom(res);
    const mediaAccessGranted = allowed(admin, "trust_verification.media.read");
    const faceFields = "status face_match_score liveness_score quality_score failure_reason reviewed_at created_at";
    const voiceFields = "status voice_liveness_score voice_match_score audio_quality_score failure_reason reviewed_at created_at";
    const [data, counts, face, voice] = await db.batch<Row>([
      db.prepare(`SELECT t.*, ${people} FROM trust_verifications t JOIN users u ON u.source_id = t.user_id WHERE t.source_id = ?`).bind(id),
      db.prepare(`SELECT (SELECT COUNT(*) FROM face_verification_submissions WHERE verification_id = ?1) AS face,
        (SELECT COUNT(*) FROM voice_verification_submissions WHERE verification_id = ?1) AS voice`).bind(id),
      ...(mediaAccessGranted ? [
        db.prepare(`SELECT source_id, selfie_image_url, selfie_video_url, liveness_video_url, ${columns(faceFields)}
          FROM face_verification_submissions WHERE verification_id = ? ORDER BY created_at DESC, source_id LIMIT 20`).bind(id),
        db.prepare(`SELECT source_id, audio_url, ${columns(voiceFields)} FROM voice_verification_submissions
          WHERE verification_id = ? ORDER BY created_at DESC, source_id LIMIT 20`).bind(id)
      ] : [])
    ]);
    const row = data.results[0];
    if (!row) throw trustNotFound();
    await insertD1AdminAudit(db, admin, { action: mediaAccessGranted ? "trust_verification.view_media" : "trust_verification.view",
      entityType: "trust_verification", entityId: id, targetUserId: String(row.user_id), metadata: { mediaAccessGranted }, req });
    adminOk(res, { trustVerification: { ...trust(row), _id: id, userId: profile(row), adminNotes: row.admin_notes },
      mediaAccessGranted, submissionCounts: counts.results[0], faceSubmissions: (face?.results ?? []).map(item => ({
        _id: item.source_id, ...fields(item, faceFields), selfieImageUrl: adminMediaUrl(item.selfie_image_url),
        selfieVideoUrl: adminMediaUrl(item.selfie_video_url), livenessVideoUrl: adminMediaUrl(item.liveness_video_url)
      })), voiceSubmissions: (voice?.results ?? []).map(item => ({
        _id: item.source_id, ...fields(item, voiceFields), audioUrl: adminMediaUrl(item.audio_url)
      })) });
  }));
  router.get("/trust-verifications/media/:fileName", guard("trust_verification.media.read"), asyncHandler(async (req, res) => {
    const name = req.params.fileName;
    const match = trustMediaReference.exec(name);
    const type = match ? trustMediaMime[match[1].toLowerCase()] : undefined;
    if (!type) throw new HttpError(400, "Invalid verification media reference", ErrorCode.VALIDATION);
    const userId = name.slice(0, 24);
    const ref = trustMediaPath + name;
    const referenced = await db.prepare(`SELECT 1 FROM face_verification_submissions WHERE user_id = ?1 AND
      (selfie_image_url = ?2 OR selfie_video_url = ?2 OR liveness_video_url = ?2)
      UNION ALL SELECT 1 FROM voice_verification_submissions WHERE user_id = ?1 AND audio_url = ?2 LIMIT 1`)
      .bind(userId, ref).first();
    const media = referenced ? await privateMedia?.get(`trust-verification/${name}`) : null;
    if (!media) throw new HttpError(404, "Verification media not found", ErrorCode.NOT_FOUND);
    await insertD1AdminAudit(db, adminFrom(res), { action: "trust_verification.media.read", entityType: "trust_verification_media",
      entityId: name, targetUserId: userId, req });
    res.set({ "Content-Type": type, "Content-Length": String(media.size), "X-Content-Type-Options": "nosniff", "Cache-Control": "private, no-store" });
    await pipeline(Readable.from(media.body.values()), res);
  }));

  const mutateTrust = (action: string, changes: string, verified: boolean | null) => asyncHandler(async (req, res) => {
    const id = validationId(req.params.id);
    const item = await db.prepare("SELECT user_id FROM trust_verifications WHERE source_id = ?").bind(id)
      .first<string>("user_id");
    if (!item) throw trustNotFound();
    const admin = adminFrom(res);
    const now = new Date().toISOString();
    const auditId = newId();
    const [updated] = await db.batch<Row>([
      db.prepare(`UPDATE trust_verifications SET ${changes}, reviewed_at = ?1, updated_at = ?1, reviewed_by_admin_id = ?2,
        admin_notes = ?3, rejection_reason = ?4 WHERE source_id = ?5 RETURNING *`)
        .bind(now, admin.id, req.body.adminNotes ?? null, req.body.rejectionReason ?? null, id),
      prepareD1AdminAudit(db, admin, { auditId, action: `trust_verification.${action}`, entityType: "trust_verification",
        entityId: id, targetUserId: item, metadata: { reason: req.body.rejectionReason }, req }, true),
      ...(verified === null ? [] : [db.prepare(`UPDATE users SET is_verified = ?, updated_at = ?
        WHERE source_id = ? AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE source_id = ?)`).bind(Number(verified), now, item, auditId)])
    ]);
    if (!updated.results[0]) throw trustNotFound();
    adminOk(res, { trustVerification: trust(updated.results[0]) });
  });
  router.post("/trust-verifications/:id/approve", guard("trust_verification.approve"), validateBody(note),
    mutateTrust("approve", `status = 'VERIFIED', face_status = 'VERIFIED', voice_status = 'VERIFIED',
      liveness_status = CASE WHEN liveness_status = 'NOT_SUBMITTED' THEN liveness_status ELSE 'VERIFIED' END,
      verified_badge_enabled = 1, creator_trust_enabled = 1, verification_score = COALESCE(verification_score, 90),
      risk_score = COALESCE(risk_score, 10), verified_at = ?1, rejected_at = NULL`, true));
  router.post("/trust-verifications/:id/reject", guard("trust_verification.reject"), validateBody(rejection),
    mutateTrust("reject", "status = 'REJECTED', verified_badge_enabled = 0, creator_trust_enabled = 0, rejected_at = ?1", false));
  router.post("/trust-verifications/:id/request-retry", guard("trust_verification.review"), validateBody(optionalReason),
    mutateTrust("request_retry", "status = 'NEEDS_RETRY', face_status = 'NEEDS_RETRY', voice_status = 'NEEDS_RETRY'", null));
  router.post("/trust-verifications/:id/suspend", guard("trust_verification.review"), validateBody(optionalReason),
    mutateTrust("suspend", "status = 'SUSPENDED', verified_badge_enabled = 0, creator_trust_enabled = 0", false));

  router.get("/creator-kyc", guard("creator_kyc.read"), asyncHandler(async (req, res) => {
    const result = await queue(req, "creator_payout_kycs");
    await insertD1AdminAudit(db, adminFrom(res), { action: "creator_kyc.list", entityType: "creator_payout_kyc",
      metadata: { status: req.query.status }, req });
    adminOk(res, { creatorKyc: result.items.map(row => ({ ...kyc(row), user: profile(row) })) }, result.meta);
  }));
  router.get("/creator-kyc/:userId", guard("creator_kyc.read"), asyncHandler(async (req, res) => {
    const userId = validationId(req.params.userId, "userId");
    const row = await readKyc(userId);
    if (!row) throw kycNotFound();
    const admin = adminFrom(res);
    const sensitive = allowed(admin, "creator_kyc.sensitive.read");
    await insertD1AdminAudit(db, admin, { action: sensitive ? "creator_kyc.view_masked_finance" : "creator_kyc.view_masked",
      entityType: "creator_payout_kyc", entityId: String(row.source_id), targetUserId: userId, metadata: { sensitiveFieldsMasked: true }, req });
    adminOk(res, { creatorKyc: kyc(row, sensitive) });
  }));
  const mutateKyc = (action: string, changes: string, accountGuard = "") => asyncHandler(async (req, res) => {
    const userId = validationId(req.params.userId, "userId");
    const current = await readKyc(userId);
    if (!current) throw kycNotFound();
    const admin = adminFrom(res);
    const now = new Date().toISOString();
    const [updated] = await db.batch<Row>([
      db.prepare(`UPDATE creator_payout_kycs SET ${changes}, reviewed_by_admin_id = ?2, updated_at = ?1,
        admin_notes = ?3 WHERE source_id = ?5 AND user_id = ?6 ${accountGuard} RETURNING ${maskedKycColumns}`)
        .bind(now, admin.id, req.body.adminNotes ?? null, req.body.rejectionReason ?? null, current.source_id, userId),
      prepareD1AdminAudit(db, admin, { action: `creator_kyc.${action}`, entityType: "creator_payout_kyc",
        entityId: String(current.source_id), targetUserId: userId, metadata: { reason: req.body.rejectionReason }, req }, true)
    ]);
    if (!updated.results[0]) throw new HttpError(409, "Creator payout verification is incomplete or changed", ErrorCode.CONFLICT);
    adminOk(res, { creatorKyc: kyc(updated.results[0], action === "approve" && allowed(admin, "creator_kyc.sensitive.read")) });
  });
  router.post("/creator-kyc/:userId/approve", guard("creator_kyc.approve"), validateBody(note),
    mutateKyc("approve", `kyc_status = 'VERIFIED', payout_status = 'ENABLED', pan_verified = 1,
      verified_at = ?1, rejected_at = NULL, rejection_reason = NULL`, "AND submitted_at IS NOT NULL"));
  router.post("/creator-kyc/:userId/reject", guard("creator_kyc.reject"), validateBody(rejection),
    mutateKyc("reject", "kyc_status = 'REJECTED', payout_status = 'DISABLED', rejected_at = ?1, rejection_reason = ?4"));
  router.post("/creator-kyc/:userId/request-retry", guard("creator_kyc.review"), validateBody(optionalReason),
    mutateKyc("request_retry", "kyc_status = 'NEEDS_RETRY', payout_status = 'DISABLED', rejection_reason = ?4"));
  router.post("/creator-kyc/:userId/freeze-payout", guard("creator_kyc.review"), validateBody(note),
    mutateKyc("freeze_payout", "payout_status = 'FROZEN'"));
  router.post("/creator-kyc/:userId/enable-payout", guard("creator_kyc.approve"), validateBody(note),
    mutateKyc("enable_payout", "payout_status = 'ENABLED'", "AND kyc_status = 'VERIFIED'"));
  return router;
}
