import type { D1Database } from "@cloudflare/workers-types";
import { coinPacks } from "@yugm/shared";
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit } from "./d1AdminAuth.js";
import type { D1PaymentProviders } from "./d1Payments.js";
import { creditPurchase, markPurchasePaid, presentPurchase, type PurchaseRow } from "./d1Wallet.js";

const refundStates = ["REFUND_PENDING", "REFUNDED", "REFUND_FAILED"];
const reasonSchema = z.object({ reason: z.string().min(3).max(500) });
type Receipt = Record<string, string | number | null>;

export function createD1AdminPaymentsRouter(db: D1Database, providers: D1PaymentProviders, secret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const canVerify = guard("payments.read");
  const canCredit = guard("payments.refund");
  async function purchaseByReference(reference: string) {
    const row = await db.prepare(`SELECT * FROM purchases WHERE source_id = ?2 OR provider_order_id = ?1 OR google_order_id = ?1
      ORDER BY source_id = ?2 DESC, created_at DESC, source_id LIMIT 1`)
      .bind(reference, isValidObjectId(reference) ? reference.toLowerCase() : null).first<PurchaseRow>();
    if (!row) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
    if (refundStates.includes(row.status)) throw new HttpError(409, "Purchase requires refund reconciliation", ErrorCode.CONFLICT);
    return row;
  }
  async function receipt(purchase: PurchaseRow) {
    const transactionId = purchase.credited_transaction_id ?? purchase.credited_diamond_transaction_id;
    if (!transactionId) return null;
    const ledger = purchase.credited_diamond_transaction_id ? "diamond_transactions" : "wallet_transactions";
    return db.prepare(`SELECT source_id AS _id, user_id AS userId, type, source, amount, balance_before AS balanceBefore,
      balance_after AS balanceAfter, created_at AS createdAt FROM ${ledger} WHERE source_id = ?`).bind(transactionId).first<Receipt>();
  }
  async function validateReceipt(row: PurchaseRow) {
    if (row.provider === "RAZORPAY") {
      if (!row.provider_payment_id) throw new HttpError(409, "No Razorpay payment ID is recorded for this purchase", ErrorCode.CONFLICT);
      const payment = await providers.fetchRazorpayPayment(row.provider_payment_id);
      if (payment.id !== row.provider_payment_id || payment.order_id !== row.provider_order_id ||
          payment.amount !== row.amount_inr * 100 || payment.currency !== "INR") {
        throw new HttpError(400, "Razorpay payment details do not match purchase", ErrorCode.VALIDATION);
      }
      const providerRecord = { id: payment.id, status: payment.status, order_id: payment.order_id,
        amount: payment.amount, currency: payment.currency };
      if (payment.status !== "captured" || Number(payment.amount_refunded ?? 0) > 0) {
        if (payment.status === "failed") await db.prepare(`UPDATE purchases SET status = 'FAILED', updated_at = ?
          WHERE source_id = ? AND status = 'PENDING'`).bind(new Date().toISOString(), row.source_id).run();
        throw new HttpError(402, "Razorpay purchase is not captured or has a refund", ErrorCode.VALIDATION);
      }
      return { providerRecord, fields: { providerPaymentId: payment.id, metadata: { adminPaymentVerification: providerRecord } } };
    }
    if (!row.product_id || !row.purchase_token) throw new HttpError(409, "Google Play product ID or purchase token is missing", ErrorCode.CONFLICT);
    const pack = coinPacks.find(item => item.id === row.pack_id);
    if (row.asset_currency !== "COINS" || pack?.googleProductId !== row.product_id || pack.coinAmount !== row.coin_amount) {
      throw new HttpError(409, "Google Play purchase does not match the stored pack", ErrorCode.CONFLICT);
    }
    const product = await providers.verifyGooglePlayProduct({ productId: row.product_id, purchaseToken: row.purchase_token });
    if (product.purchaseState !== 0) {
      await db.prepare("UPDATE purchases SET status = 'FAILED', updated_at = ? WHERE source_id = ? AND status = 'PENDING'")
        .bind(new Date().toISOString(), row.source_id).run();
      throw new HttpError(402, "Google Play purchase is not completed", ErrorCode.VALIDATION);
    }
    if (row.google_order_id && product.orderId && row.google_order_id !== product.orderId) {
      throw new HttpError(409, "Google Play order ID does not match purchase", ErrorCode.CONFLICT);
    }
    const providerRecord = { orderId: product.orderId, purchaseState: product.purchaseState,
      consumptionState: product.consumptionState, acknowledgementState: product.acknowledgementState };
    return { providerRecord, fields: { googleOrderId: product.orderId, metadata: { adminProductVerification: providerRecord } } };
  }
  router.post("/payments/recharges/:orderId/verify", canVerify, asyncHandler(async (req, res) => {
    const entry = await purchaseByReference(req.params.orderId);
    const verified = await validateReceipt(entry);
    const admin = adminFrom(res);
    const paid = await markPurchasePaid(db, entry.source_id, entry.user_id, verified.fields);
    const credited = await creditPurchase(db, paid.user_id, paid.source_id, { verifiedByAdmin: true, adminId: admin.id });
    await insertD1AdminAudit(db, admin, { action: "payment.verified", entityType: "purchase", entityId: entry.source_id,
      targetUserId: entry.user_id, metadata: { orderId: req.params.orderId, provider: entry.provider, providerRecord: verified.providerRecord }, req });
    adminOk(res, { purchase: presentPurchase(credited, false), transaction: await receipt(credited), providerRecord: verified.providerRecord });
  }));
  router.post("/payments/recharges/:orderId/credit", canCredit, validateBody(reasonSchema), asyncHandler(async (req, res) => {
    const entry = await purchaseByReference(req.params.orderId);
    const admin = adminFrom(res);
    if (entry.status === "CREDITED") {
      adminOk(res, { purchase: presentPurchase(entry, false), transaction: await receipt(entry) });
      return;
    }
    const paid = entry.status === "PAID" ? entry
      : await markPurchasePaid(db, entry.source_id, entry.user_id, (await validateReceipt(entry)).fields);
    const credited = await creditPurchase(db, entry.user_id, paid.source_id, { manualCredit: true, adminId: admin.id, reason: req.body.reason });
    await insertD1AdminAudit(db, admin, { action: "payment.credited", entityType: "purchase", entityId: entry.source_id,
      targetUserId: entry.user_id, metadata: { reason: req.body.reason }, req });
    adminOk(res, { purchase: presentPurchase(credited, false), transaction: await receipt(credited) });
  }));
  return router;
}
