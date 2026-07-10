import { Router } from "express";
import { z } from "zod";
import { requireAdminAuth, requireAnyPermission, requirePermission, type AdminAuthRequest } from "../middleware/adminAuth.js";
import { validateBody } from "../middleware/validate.js";
import { CreatorPayoutKyc } from "../models/CreatorPayoutKyc.js";
import { FaceVerificationSubmission } from "../models/FaceVerificationSubmission.js";
import { PayoutReview } from "../models/PayoutReview.js";
import { TrustVerification } from "../models/TrustVerification.js";
import { VoiceVerificationSubmission } from "../models/VoiceVerificationSubmission.js";
import { listCreatorKycQueue, listPayoutReviewQueue, listTrustVerificationQueue } from "../services/adminFinance.js";
import { approveCreatorPayoutKyc, publicCreatorPayoutKyc, rejectCreatorPayoutKyc, requestCreatorPayoutKycRetry, setPayoutStatus } from "../services/creatorPayoutKyc.js";
import { approvePayoutReview, markPayoutReviewManual, markWithdrawalPaid, publicPayoutReview, rejectPayoutReview } from "../services/payoutReview.js";
import { recordAuditLog } from "../services/auditLog.js";
import { approveTrustVerification, publicTrustVerification, rejectTrustVerification, requestTrustRetry, suspendTrustVerification } from "../services/trustVerification.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";

export const adminVerificationRouter = Router();

const noteSchema = z.object({
  adminNotes: z.string().max(2000).optional()
});

const rejectSchema = noteSchema.extend({
  rejectionReason: z.string().min(2).max(1000)
});

const markPaidSchema = noteSchema.extend({
  payoutReference: z.string().max(160).optional()
});

function assertObjectId(id: string, label = "id") {
  if (!isValidObjectId(id)) throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
}

function canReadSensitive(req: AdminAuthRequest) {
  return Boolean(req.admin?.isSuperAdmin || req.adminPermissions?.includes("creator_kyc.sensitive.read"));
}

adminVerificationRouter.get("/trust-verifications", requireAdminAuth, requirePermission("trust_verification.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const { items, total } = await listTrustVerificationQueue(String(req.query.status || "") || undefined, skip, limit);
  adminOk(res, { trustVerifications: items.map(publicTrustVerification) }, paginationMeta(page, limit, total));
}));

adminVerificationRouter.get("/trust-verifications/:id", requireAdminAuth, requirePermission("trust_verification.read"), asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const verification = await TrustVerification.findById(req.params.id).populate("userId", "name username avatar role isVerified").lean();
  if (!verification) throw new HttpError(404, "Trust verification not found", ErrorCode.NOT_FOUND);
  const [faceSubmissions, voiceSubmissions] = await Promise.all([
    FaceVerificationSubmission.find({ verificationId: req.params.id }).sort({ createdAt: -1 }).limit(20).lean(),
    VoiceVerificationSubmission.find({ verificationId: req.params.id }).sort({ createdAt: -1 }).limit(20).lean()
  ]);
  adminOk(res, { trustVerification: verification, faceSubmissions, voiceSubmissions });
}));

adminVerificationRouter.post("/trust-verifications/:id/approve", requireAdminAuth, requirePermission("trust_verification.approve"), validateBody(noteSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.id);
  const verification = await approveTrustVerification(req.params.id, req.admin!.id, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "trust_verification.approve", entityType: "trust_verification", entityId: verification.id, targetUserId: verification.userId.toString(), req });
  adminOk(res, { trustVerification: publicTrustVerification(verification) });
}));

adminVerificationRouter.post("/trust-verifications/:id/reject", requireAdminAuth, requirePermission("trust_verification.reject"), validateBody(rejectSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.id);
  const verification = await rejectTrustVerification(req.params.id, req.admin!.id, req.body.rejectionReason, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "trust_verification.reject", entityType: "trust_verification", entityId: verification.id, targetUserId: verification.userId.toString(), metadata: { reason: req.body.rejectionReason }, req });
  adminOk(res, { trustVerification: publicTrustVerification(verification) });
}));

adminVerificationRouter.post("/trust-verifications/:id/request-retry", requireAdminAuth, requirePermission("trust_verification.review"), validateBody(rejectSchema.partial({ rejectionReason: true })), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.id);
  const verification = await requestTrustRetry(req.params.id, req.admin!.id, req.body.rejectionReason, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "trust_verification.request_retry", entityType: "trust_verification", entityId: verification.id, targetUserId: verification.userId.toString(), req });
  adminOk(res, { trustVerification: publicTrustVerification(verification) });
}));

adminVerificationRouter.post("/trust-verifications/:id/suspend", requireAdminAuth, requirePermission("trust_verification.review"), validateBody(rejectSchema.partial({ rejectionReason: true })), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.id);
  const verification = await suspendTrustVerification(req.params.id, req.admin!.id, req.body.rejectionReason, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "trust_verification.suspend", entityType: "trust_verification", entityId: verification.id, targetUserId: verification.userId.toString(), req });
  adminOk(res, { trustVerification: publicTrustVerification(verification) });
}));

adminVerificationRouter.get("/creator-kyc", requireAdminAuth, requirePermission("creator_kyc.read"), asyncHandler(async (req: AdminAuthRequest, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const { items, total } = await listCreatorKycQueue(String(req.query.status || "") || undefined, skip, limit);
  await recordAuditLog({ adminId: req.admin!.id, action: "creator_kyc.list", entityType: "creator_payout_kyc", metadata: { status: req.query.status }, req });
  adminOk(res, { creatorKyc: items.map((item) => publicCreatorPayoutKyc(item, false)) }, paginationMeta(page, limit, total));
}));

adminVerificationRouter.get("/creator-kyc/:userId", requireAdminAuth, requirePermission("creator_kyc.read"), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.userId, "userId");
  const kyc = await CreatorPayoutKyc.findOne({ userId: req.params.userId }).populate("userId", "name username avatar role").lean();
  if (!kyc) throw new HttpError(404, "Creator payout KYC not found", ErrorCode.NOT_FOUND);
  const includeSensitive = canReadSensitive(req);
  await recordAuditLog({ adminId: req.admin!.id, action: includeSensitive ? "creator_kyc.view_sensitive" : "creator_kyc.view", entityType: "creator_payout_kyc", entityId: kyc._id.toString(), targetUserId: req.params.userId, req });
  adminOk(res, { creatorKyc: publicCreatorPayoutKyc(kyc, includeSensitive) });
}));

adminVerificationRouter.post("/creator-kyc/:userId/approve", requireAdminAuth, requirePermission("creator_kyc.approve"), validateBody(noteSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.userId, "userId");
  const kyc = await approveCreatorPayoutKyc(req.params.userId, req.admin!.id, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "creator_kyc.approve", entityType: "creator_payout_kyc", entityId: kyc.id, targetUserId: req.params.userId, req });
  adminOk(res, { creatorKyc: publicCreatorPayoutKyc(kyc, canReadSensitive(req)) });
}));

adminVerificationRouter.post("/creator-kyc/:userId/reject", requireAdminAuth, requirePermission("creator_kyc.reject"), validateBody(rejectSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.userId, "userId");
  const kyc = await rejectCreatorPayoutKyc(req.params.userId, req.admin!.id, req.body.rejectionReason, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "creator_kyc.reject", entityType: "creator_payout_kyc", entityId: kyc.id, targetUserId: req.params.userId, metadata: { reason: req.body.rejectionReason }, req });
  adminOk(res, { creatorKyc: publicCreatorPayoutKyc(kyc, false) });
}));

adminVerificationRouter.post("/creator-kyc/:userId/request-retry", requireAdminAuth, requirePermission("creator_kyc.review"), validateBody(rejectSchema.partial({ rejectionReason: true })), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.userId, "userId");
  const kyc = await requestCreatorPayoutKycRetry(req.params.userId, req.admin!.id, req.body.rejectionReason, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "creator_kyc.request_retry", entityType: "creator_payout_kyc", entityId: kyc.id, targetUserId: req.params.userId, req });
  adminOk(res, { creatorKyc: publicCreatorPayoutKyc(kyc, false) });
}));

adminVerificationRouter.post("/creator-kyc/:userId/freeze-payout", requireAdminAuth, requirePermission("creator_kyc.review"), validateBody(noteSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.userId, "userId");
  const kyc = await setPayoutStatus(req.params.userId, req.admin!.id, "FROZEN", req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "creator_kyc.freeze_payout", entityType: "creator_payout_kyc", entityId: kyc.id, targetUserId: req.params.userId, req });
  adminOk(res, { creatorKyc: publicCreatorPayoutKyc(kyc, false) });
}));

adminVerificationRouter.post("/creator-kyc/:userId/enable-payout", requireAdminAuth, requirePermission("creator_kyc.approve"), validateBody(noteSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.userId, "userId");
  const kyc = await setPayoutStatus(req.params.userId, req.admin!.id, "ENABLED", req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "creator_kyc.enable_payout", entityType: "creator_payout_kyc", entityId: kyc.id, targetUserId: req.params.userId, req });
  adminOk(res, { creatorKyc: publicCreatorPayoutKyc(kyc, false) });
}));

adminVerificationRouter.get("/payout-reviews", requireAdminAuth, requirePermission("payout_review.read"), asyncHandler(async (req, res) => {
  const { page, limit, skip } = pageParams(req.query);
  const { items, total } = await listPayoutReviewQueue(String(req.query.status || "") || undefined, skip, limit);
  adminOk(res, { payoutReviews: items.map(publicPayoutReview) }, paginationMeta(page, limit, total));
}));

adminVerificationRouter.get("/payout-reviews/:id", requireAdminAuth, requirePermission("payout_review.read"), asyncHandler(async (req, res) => {
  assertObjectId(req.params.id);
  const review = await PayoutReview.findById(req.params.id).populate("userId", "name username avatar role").populate("withdrawalRequestId").lean();
  if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
  adminOk(res, { payoutReview: publicPayoutReview(review), raw: review });
}));

adminVerificationRouter.post("/payout-reviews/:id/approve", requireAdminAuth, requireAnyPermission(["payout_review.approve", "withdrawals.approve"]), validateBody(noteSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.id);
  const review = await approvePayoutReview(req.params.id, req.admin!.id, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "payout_review.approve", entityType: "payout_review", entityId: review.id, targetUserId: review.userId.toString(), req });
  adminOk(res, { payoutReview: publicPayoutReview(review) });
}));

adminVerificationRouter.post("/payout-reviews/:id/reject", requireAdminAuth, requireAnyPermission(["payout_review.reject", "withdrawals.reject"]), validateBody(rejectSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.id);
  const review = await rejectPayoutReview(req.params.id, req.admin!.id, req.body.rejectionReason, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "payout_review.reject", entityType: "payout_review", entityId: review.id, targetUserId: review.userId.toString(), metadata: { reason: req.body.rejectionReason }, req });
  adminOk(res, { payoutReview: publicPayoutReview(review) });
}));

adminVerificationRouter.post("/payout-reviews/:id/manual-review", requireAdminAuth, requirePermission("payout_review.read"), validateBody(noteSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.id);
  const review = await markPayoutReviewManual(req.params.id, req.admin!.id, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "payout_review.manual_review", entityType: "payout_review", entityId: review.id, targetUserId: review.userId.toString(), req });
  adminOk(res, { payoutReview: publicPayoutReview(review) });
}));

adminVerificationRouter.post("/payout-reviews/:id/mark-paid", requireAdminAuth, requireAnyPermission(["payout_review.approve", "withdrawals.approve"]), validateBody(markPaidSchema), asyncHandler(async (req: AdminAuthRequest, res) => {
  assertObjectId(req.params.id);
  const result = await markWithdrawalPaid(req.params.id, req.admin!.id, req.body.payoutReference, req.body.adminNotes);
  await recordAuditLog({ adminId: req.admin!.id, action: "payout_review.mark_paid", entityType: "payout_review", entityId: result.review.id, targetUserId: result.review.userId.toString(), metadata: { payoutReference: req.body.payoutReference }, req });
  adminOk(res, { payoutReview: publicPayoutReview(result.review), withdrawal: result.withdrawal });
}));
