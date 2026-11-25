import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit, prepareD1AdminAudit } from "./d1AdminAuth.js";
import { payoutReview, withdrawal } from "./d1AdminFinance.js";
import { newId } from "./d1Cosmetics.js";
import type { D1PaymentProviders } from "./d1Payments.js";

type Row = Record<string, string | number | null>;
type Decision = "APPROVED" | "REJECTED" | "NEEDS_MANUAL_REVIEW";
const note = z.object({ adminNotes: z.string().max(2000).optional() });
const reviewRejection = note.extend({ rejectionReason: z.string().min(2).max(1000) });
const withdrawalReason = z.object({ reason: z.string().min(3).max(500) });
const paidSchema = note.extend({ payoutReference: z.string().trim().min(3).max(160).optional() });
const id = (value: string, label: string) => {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
  return value.toLowerCase();
};

// Recheck eligibility while making the decision. A concurrent account hold, KYC change or suspension
// must take effect even if the finance dashboard still shows the old approval flags.
const eligible = `AND EXISTS (SELECT 1 FROM users u WHERE u.source_id = p.user_id AND u.is_blocked = 0
  AND u.deletion_requested_at IS NULL AND (u.suspended_until IS NULL OR u.suspended_until <= ?2))
  AND EXISTS (SELECT 1 FROM trust_verifications t WHERE t.source_id = p.trust_verification_id
    AND t.user_id = p.user_id AND t.status = 'VERIFIED' AND t.creator_trust_enabled = 1)
  AND EXISTS (SELECT 1 FROM creator_payout_kycs k WHERE k.source_id = p.creator_payout_kyc_id
    AND k.user_id = p.user_id AND k.kyc_status = 'VERIFIED' AND k.payout_status = 'ENABLED')
  AND NOT EXISTS (SELECT 1 FROM user_safety_statuses s WHERE s.user_id = p.user_id AND s.is_wallet_frozen = 1)`;

export function createD1AdminPayoutDecisionsRouter(db: D1Database, payments: D1PaymentProviders, secret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const readWithdrawal = (key: string) => db.prepare("SELECT * FROM withdrawal_requests WHERE source_id = ?").bind(key).first<Row>();
  const readReview = (key: string) => db.prepare("SELECT * FROM payout_reviews WHERE source_id = ?").bind(key).first<Row>();
  const decide = (decision: Decision, fromWithdrawal: boolean, action: string) => asyncHandler(async (req, res) => {
    const admin = adminFrom(res);
    const suppliedId = id(fromWithdrawal ? req.params.withdrawalId : req.params.id, fromWithdrawal ? "withdrawal ID" : "id");
    const review = fromWithdrawal ? await db.prepare("SELECT * FROM payout_reviews WHERE withdrawal_request_id = ? ORDER BY created_at DESC, source_id LIMIT 1")
      .bind(suppliedId).first<Row>() : await readReview(suppliedId);
    if (!review) {
      if (fromWithdrawal && await readWithdrawal(suppliedId)) throw new HttpError(409, "Withdrawal requires a payout review", ErrorCode.CONFLICT);
      throw new HttpError(404, fromWithdrawal ? "Withdrawal not found" : "Payout review not found", ErrorCode.NOT_FOUND);
    }
    const reviewId = String(review.source_id);
    const withdrawalId = String(review.withdrawal_request_id);
    const expectedWithdrawal = decision === "NEEDS_MANUAL_REVIEW" ? "PENDING_REVIEW" : decision;
    const reason = req.body.rejectionReason ?? req.body.reason ?? null;
    const now = new Date().toISOString();
    const auditId = newId();
    const results = await db.batch<Row>([
      db.prepare(`UPDATE payout_reviews AS p SET status = ?1, reviewed_at = ?2, updated_at = ?2, reviewed_by_admin_id = ?3,
        admin_notes = ?4, rejection_reason = ?5
        WHERE source_id = ?6 AND (status = 'PENDING' OR (?1 <> 'NEEDS_MANUAL_REVIEW' AND status = 'NEEDS_MANUAL_REVIEW'))
        AND EXISTS (SELECT 1 FROM withdrawal_requests w WHERE w.source_id = p.withdrawal_request_id
          AND w.user_id = p.user_id AND w.status = 'PENDING_REVIEW') ${decision === "APPROVED" ? eligible : ""}
        RETURNING *`).bind(decision, now, admin.id, req.body.adminNotes ?? null, reason, reviewId),
      prepareD1AdminAudit(db, admin, { auditId, action, entityType: fromWithdrawal ? "withdrawal" : "payout_review",
        entityId: suppliedId, targetUserId: String(review.user_id), metadata: { reason }, req }, true),
      ...(decision === "NEEDS_MANUAL_REVIEW" ? [] : [db.prepare(`UPDATE withdrawal_requests SET status = ?1,
        active_lock = CASE WHEN ?1 = 'REJECTED' THEN 0 ELSE active_lock END, reviewed_by_admin_id = ?2, updated_at = ?3,
        approved_at = CASE WHEN ?1 = 'APPROVED' THEN ?3 ELSE approved_at END,
        rejected_at = CASE WHEN ?1 = 'REJECTED' THEN ?3 ELSE NULL END, rejection_reason = ?4
        WHERE source_id = ?5 AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE source_id = ?6)`)
        .bind(decision, admin.id, now, reason, withdrawalId, auditId)]),
      db.prepare("SELECT * FROM payout_reviews WHERE source_id = ?").bind(reviewId),
      db.prepare("SELECT * FROM withdrawal_requests WHERE source_id = ?").bind(withdrawalId)
    ]);
    const currentReview = results.at(-2)?.results[0];
    const currentWithdrawal = results.at(-1)?.results[0];
    if (!currentReview || currentReview.status !== decision || !currentWithdrawal || currentWithdrawal.status !== expectedWithdrawal) {
      throw new HttpError(409, "Payout review is ineligible or has already moved to another state", ErrorCode.CONFLICT);
    }
    adminOk(res, fromWithdrawal ? { withdrawal: withdrawal(currentWithdrawal) } : { payoutReview: payoutReview(currentReview) });
  });
  router.post("/payout-reviews/:id/approve", guard("payout_review.approve", "withdrawals.approve"), validateBody(note),
    decide("APPROVED", false, "payout_review.approve"));
  router.post("/payout-reviews/:id/reject", guard("payout_review.reject", "withdrawals.reject"), validateBody(reviewRejection),
    decide("REJECTED", false, "payout_review.reject"));
  router.post("/payout-reviews/:id/manual-review", guard("payout_review.read"), validateBody(note),
    decide("NEEDS_MANUAL_REVIEW", false, "payout_review.manual_review"));
  router.post("/withdrawals/:withdrawalId/approve", guard("withdrawals.approve"), validateBody(note),
    decide("APPROVED", true, "withdrawal.approved"));
  router.post("/withdrawals/:withdrawalId/reject", guard("withdrawals.reject"), validateBody(withdrawalReason),
    decide("REJECTED", true, "withdrawal.rejected"));
  router.post("/withdrawals/:withdrawalId/request-info", guard("withdrawals.read"), validateBody(withdrawalReason),
    asyncHandler(async (req, res) => {
      const key = id(req.params.withdrawalId, "withdrawal ID");
      const row = await readWithdrawal(key);
      if (!row) throw new HttpError(404, "Withdrawal not found", ErrorCode.NOT_FOUND);
      await insertD1AdminAudit(db, adminFrom(res), { action: "withdrawal.info_requested", entityType: "withdrawal", entityId: key,
        targetUserId: String(row.user_id), metadata: { withdrawalId: key, reason: req.body.reason }, req });
      adminOk(res, { requested: true });
    }));
  const recordPayout = (byWithdrawal: boolean) => asyncHandler(async (req, res) => {
    const key = id(byWithdrawal ? req.params.withdrawalId : req.params.id, byWithdrawal ? "withdrawal ID" : "id");
    const review = byWithdrawal ? await db.prepare("SELECT * FROM payout_reviews WHERE withdrawal_request_id = ? ORDER BY created_at DESC LIMIT 1")
      .bind(key).first<Row>() : await readReview(key);
    if (!review) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
    const reviewId = String(review.source_id);
    const withdrawalId = String(review.withdrawal_request_id);
    const request = await readWithdrawal(withdrawalId);
    if (!request || request.user_id !== review.user_id) throw new HttpError(409, "Withdrawal requires reconciliation", ErrorCode.CONFLICT);
    const response = (payout: Row, stored: Row) => ({ withdrawal: withdrawal(stored),
      ...(!byWithdrawal ? { payoutReview: payoutReview(payout) } : {}) });
    const reference = (req.body.payoutReference ?? review.provider_payout_id ?? null) as string | null;
    if (request.status === "PAID" && review.status === "PAID") {
      if (reference && reference !== request.payout_reference) throw new HttpError(409, "Withdrawal is already paid", ErrorCode.CONFLICT);
      adminOk(res, response(review, request));
      return;
    }
    if (request.status !== "APPROVED" || review.status !== "APPROVED") {
      throw new HttpError(409, "Approve the payout before marking it paid", ErrorCode.CONFLICT);
    }
    const amount = Math.round(Number(request.amount_inr) * 100);
    if (!Number.isSafeInteger(amount) || amount < 0) throw new HttpError(409, "Payout amount is invalid", ErrorCode.CONFLICT);
    if (amount > 0) {
      if (!reference || !/^pout_[a-z0-9]{4,64}$/i.test(reference)) {
        throw new HttpError(422, "Provide a processed Razorpay payout ID", ErrorCode.VALIDATION);
      }
      const payment = await payments.fetchRazorpayPayout(reference);
      if (payment.id !== reference || payment.status !== "processed" || payment.currency !== "INR" || payment.amount !== amount ||
          !(payment.reference_id === withdrawalId || payment.reference_id === `wd_${withdrawalId}` || review.provider_payout_id === reference)) {
        throw new HttpError(409, "Payout is not processed or does not match this withdrawal", ErrorCode.CONFLICT);
      }
    }
    const admin = adminFrom(res);
    const now = new Date().toISOString();
    const auditId = newId();
    const [, , , updatedReview, updatedWithdrawal] = await db.batch<Row>([
      db.prepare(`UPDATE payout_reviews AS p SET status = 'PAID', provider_payout_id = ?1, provider_status = 'PROCESSED',
        processed_at = ?2, reviewed_at = ?2, updated_at = ?2, reviewed_by_admin_id = ?3, admin_notes = COALESCE(?4, admin_notes)
        WHERE p.source_id = ?5 AND p.status = 'APPROVED' AND (p.provider_payout_id IS NULL OR p.provider_payout_id = ?1)
        AND EXISTS (SELECT 1 FROM withdrawal_requests w WHERE w.source_id = p.withdrawal_request_id AND
          w.user_id = p.user_id AND w.status = 'APPROVED' AND w.amount_inr IS ?6)
        AND (?1 IS NULL OR NOT EXISTS (SELECT 1 FROM payout_reviews other WHERE other.source_id <> p.source_id AND other.provider_payout_id = ?1))`)
        .bind(reference, now, admin.id, req.body.adminNotes ?? null, reviewId, request.amount_inr),
      prepareD1AdminAudit(db, admin, { auditId, action: byWithdrawal ? "withdrawal.marked_paid" : "payout_review.mark_paid",
        entityType: byWithdrawal ? "withdrawal" : "payout_review", entityId: key, targetUserId: String(review.user_id),
        metadata: { payoutReference: reference }, req }, true),
      db.prepare(`UPDATE withdrawal_requests SET status = 'PAID', active_lock = 0, paid_at = ?1, updated_at = ?1,
        reviewed_by_admin_id = ?2, payout_reference = ?3, metadata = json_set(metadata, '$.paidNotes', ?4)
        WHERE source_id = ?5 AND EXISTS (SELECT 1 FROM admin_audit_logs WHERE source_id = ?6)`)
        .bind(now, admin.id, reference, req.body.adminNotes ?? null, withdrawalId, auditId),
      db.prepare("SELECT * FROM payout_reviews WHERE source_id = ?").bind(reviewId),
      db.prepare("SELECT * FROM withdrawal_requests WHERE source_id = ?").bind(withdrawalId)
    ]);
    const storedReview = updatedReview.results[0];
    const storedWithdrawal = updatedWithdrawal.results[0];
    if (storedReview?.status !== "PAID" || storedWithdrawal?.status !== "PAID" || storedWithdrawal.payout_reference !== reference) {
      throw new HttpError(409, "Payout changed during reconciliation or the reference is already assigned", ErrorCode.CONFLICT);
    }
    adminOk(res, response(storedReview, storedWithdrawal));
  });
  router.post("/payout-reviews/:id/mark-paid", guard("payout_review.approve", "withdrawals.approve"), validateBody(paidSchema),
    recordPayout(false));
  router.post("/withdrawals/:withdrawalId/mark-paid", guard("withdrawals.approve"), validateBody(paidSchema), recordPayout(true));
  return router;
}
