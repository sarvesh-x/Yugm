import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk } from "../modules/admin/http.js";
import { changeVipExp, vipExpForPurchase } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, prepareD1AdminAudit, type D1Admin } from "./d1AdminAuth.js";
import { newId, readWardrobe, walletRow } from "./d1Cosmetics.js";
import type { D1PaymentProviders } from "./d1Payments.js";
import { presentPurchase, type PurchaseRow } from "./d1Wallet.js";

type Refund = { source_id: string; purchase_id: string; status: "PENDING" | "FAILED" | "REFUNDED";
  asset_currency: "COINS" | "DIAMONDS"; amount: number; ledger_id: string | null; provider_refund_id: string | null;
  provider_attempted: number };
const conflict = (message: string) => new HttpError(409, message, ErrorCode.CONFLICT);

export function createD1AdminRefundsRouter(db: D1Database, payments: D1PaymentProviders, secret?: string) {
  const router = Router();
  const canRefund = createD1AdminGuard(db, secret)("payments.refund");
  const readPurchase = (id: string) => db.prepare("SELECT * FROM purchases WHERE source_id = ?").bind(id).first<PurchaseRow>();
  const readRefund = (id: string) => db.prepare(`SELECT * FROM admin_purchase_refunds WHERE purchase_id = ? AND status <> 'FAILED'
    ORDER BY created_at DESC LIMIT 1`).bind(id).first<Refund>();
  const ledger = (asset: string) => asset === "DIAMONDS"
    ? { table: "diamond_transactions", balance: "diamond_balance", debitSource: "REFUND" }
    : { table: "wallet_transactions", balance: "wallet_balance", debitSource: "PAYMENT_REFUND" };

  async function reserve(purchase: PurchaseRow, admin: D1Admin, reason: string, req: Parameters<typeof prepareD1AdminAudit>[2]["req"]) {
    const storage = ledger(purchase.asset_currency);
    const credited = purchase.status === "CREDITED" || Boolean(purchase.credited_transaction_id || purchase.credited_diamond_transaction_id);
    const amount = credited ? (purchase.asset_currency === "DIAMONDS" ? purchase.diamond_amount : purchase.coin_amount) : 0;
    if (!Number.isSafeInteger(amount) || amount < 0 || (credited && amount === 0)) throw conflict("Purchase balance requires reconciliation");
    const id = newId();
    const ledgerId = amount > 0 ? newId() : null;
    const now = new Date().toISOString();
    const claimed = "EXISTS (SELECT 1 FROM admin_purchase_refunds WHERE source_id = ?)";
    await db.batch([
      db.prepare(`INSERT INTO admin_purchase_refunds (source_id, purchase_id, admin_id, reason, status, asset_currency,
        amount, ledger_id, created_at, updated_at)
        SELECT ?, p.source_id, ?, ?, 'PENDING', p.asset_currency, ?, ?, ?, ? FROM purchases p JOIN users u ON u.source_id = p.user_id
        WHERE p.source_id = ? AND p.status = ? AND p.status IN ('PAID', 'CREDITED', 'REFUND_FAILED')
        AND (p.status <> 'REFUND_FAILED' OR EXISTS (SELECT 1 FROM admin_purchase_refunds r WHERE r.purchase_id = p.source_id AND r.status = 'FAILED'))
        AND u.${storage.balance} >= ? ON CONFLICT DO NOTHING`)
        .bind(id, admin.id, reason, amount, ledgerId, now, now, purchase.source_id, purchase.status, amount),
      prepareD1AdminAudit(db, admin, { action: "payment.refund_reserved", entityType: "purchase", entityId: purchase.source_id,
        targetUserId: purchase.user_id, metadata: { reason, refundId: id, amount, assetCurrency: purchase.asset_currency }, req }, true),
      ...(ledgerId ? [
        db.prepare(`INSERT INTO ${storage.table} (source_id, user_id, type, source, amount, balance_before, balance_after,
          metadata, created_at, updated_at) SELECT ?, u.source_id, 'DEBIT', ?, ?, u.${storage.balance}, u.${storage.balance} - ?,
          ?, ?, ? FROM users u WHERE u.source_id = ? AND ${claimed}`).bind(ledgerId, storage.debitSource, amount, amount,
            JSON.stringify({ purchaseId: purchase.source_id, refundId: id, adminId: admin.id, reason }), now, now, purchase.user_id, id),
        db.prepare(`UPDATE users SET ${storage.balance} = ${storage.balance} - ?, updated_at = ?
          WHERE source_id = ? AND ${claimed}`).bind(amount, now, purchase.user_id, id)
      ] : []),
      db.prepare(`UPDATE purchases SET status = 'REFUND_PENDING', refund_transaction_id = ?, refund_provider_id = NULL,
        updated_at = ? WHERE source_id = ? AND ${claimed}`).bind(purchase.asset_currency === "COINS" ? ledgerId : null,
          now, purchase.source_id, id)
    ]);
    const existing = await readRefund(purchase.source_id);
    if (!existing) throw conflict("Refund requires sufficient balance and a paid purchase");
    return existing;
  }

  async function finish(refund: Refund, purchase: PurchaseRow, providerId: string, failed: boolean, admin: D1Admin,
    req: Parameters<typeof prepareD1AdminAudit>[2]["req"]) {
    const storage = ledger(refund.asset_currency);
    const now = new Date();
    const time = now.toISOString();
    const result = failed ? "FAILED" : "REFUNDED";
    const requireAudit = "EXISTS (SELECT 1 FROM admin_audit_logs WHERE source_id = ?)";
    for (let attempt = 0; attempt < 4; attempt++) {
      const stored = walletRow(await db.prepare(readWardrobe).bind(purchase.user_id).first());
      const vip = { vipTier: stored.vip_tier ?? undefined, vipLevel: stored.vip_level, vipExp: stored.vip_exp,
        vipStartedAt: stored.vip_started_at ? new Date(stored.vip_started_at) : undefined,
        vipExpiresAt: stored.vip_expires_at ? new Date(stored.vip_expires_at) : undefined,
        vipFrozen: Boolean(stored.vip_frozen), vipFreezeStartedAt: stored.vip_freeze_started_at ? new Date(stored.vip_freeze_started_at) : undefined };
      const meta = JSON.parse(purchase.metadata || "{}") as { vipExpReversed?: boolean };
      const reverseVip = !failed && Boolean(refund.ledger_id) && !meta.vipExpReversed;
      if (reverseVip) changeVipExp(vip, -vipExpForPurchase(purchase.amount_inr), now);
      const auditId = newId();
      const resultBatch = await db.batch([
        db.prepare(`UPDATE admin_purchase_refunds SET status = ?, provider_refund_id = ?, updated_at = ?
          WHERE source_id = ? AND status = 'PENDING'
          AND EXISTS (SELECT 1 FROM purchases WHERE source_id = ? AND status = 'REFUND_PENDING')
          AND EXISTS (SELECT 1 FROM users u WHERE u.source_id = ? AND u.vip_tier IS ? AND u.vip_level = ? AND u.vip_exp = ?
            AND u.vip_started_at IS ? AND u.vip_expires_at IS ? AND u.vip_frozen = ? AND u.vip_freeze_started_at IS ?
            AND u.${storage.balance} <= ?)`)
          .bind(result, providerId, time, refund.source_id, purchase.source_id, purchase.user_id, stored.vip_tier, stored.vip_level,
            stored.vip_exp, stored.vip_started_at, stored.vip_expires_at, stored.vip_frozen, stored.vip_freeze_started_at,
            failed ? Number.MAX_SAFE_INTEGER - refund.amount : Number.MAX_SAFE_INTEGER),
        prepareD1AdminAudit(db, admin, { auditId, action: failed ? "payment.refund_failed" : "payment.refunded",
          entityType: "purchase", entityId: purchase.source_id, targetUserId: purchase.user_id,
          metadata: { refundId: refund.source_id, providerRefundId: providerId }, req }, true),
        db.prepare(`UPDATE purchases SET status = ?, refund_provider_id = ?, refunded_at = ?, updated_at = ?,
          metadata = CASE WHEN ? THEN json_set(metadata, '$.vipExpReversed', json('true')) ELSE metadata END
          WHERE source_id = ? AND ${requireAudit}`).bind(failed ? "REFUND_FAILED" : "REFUNDED", providerId,
            failed ? null : time, time, Number(reverseVip), purchase.source_id, auditId),
        ...(failed && refund.ledger_id ? [
          db.prepare(`INSERT INTO ${storage.table} (source_id, user_id, type, source, amount, balance_before, balance_after,
            metadata, created_at, updated_at) SELECT ?, u.source_id, 'CREDIT', 'ADMIN_ADJUSTMENT', ?,
            u.${storage.balance}, u.${storage.balance} + ?, ?, ?, ? FROM users u WHERE u.source_id = ? AND ${requireAudit}`)
            .bind(newId(), refund.amount, refund.amount, JSON.stringify({ refundId: refund.source_id, refundRollback: true }),
              time, time, purchase.user_id, auditId),
          db.prepare(`UPDATE users SET ${storage.balance} = ${storage.balance} + ?, updated_at = ? WHERE source_id = ? AND ${requireAudit}`)
            .bind(refund.amount, time, purchase.user_id, auditId)
        ] : []),
        ...(reverseVip ? [db.prepare(`UPDATE users SET vip_tier = ?, vip_level = ?, vip_exp = ?, vip_started_at = ?, vip_expires_at = ?,
          vip_frozen = ?, vip_freeze_started_at = ?, updated_at = ? WHERE source_id = ? AND ${requireAudit}`)
          .bind(vip.vipTier ?? null, vip.vipLevel, vip.vipExp, vip.vipStartedAt?.toISOString() ?? null,
            vip.vipExpiresAt?.toISOString() ?? null, Number(vip.vipFrozen), vip.vipFreezeStartedAt?.toISOString() ?? null,
            time, purchase.user_id, auditId)] : [])
      ]);
      const current = await readPurchase(purchase.source_id);
      if (resultBatch[0].meta.changes || current?.status === (failed ? "REFUND_FAILED" : "REFUNDED")) {
        if (!current) throw conflict("Refund settlement could not be read");
        return current;
      }
      if (current?.status !== "REFUND_PENDING") break;
    }
    throw conflict("Refund was processed by the provider and needs local reconciliation");
  }

  router.post("/payments/recharges/:orderId/refund", canRefund, validateBody(z.object({ reason: z.string().min(3).max(500) })),
    asyncHandler(async (req, res) => {
      const reference = req.params.orderId;
      const purchase = await db.prepare(`SELECT * FROM purchases WHERE source_id = ?2 OR provider_order_id = ?1 OR google_order_id = ?1
        ORDER BY source_id = ?2 DESC, created_at DESC, source_id LIMIT 1`)
        .bind(reference, isValidObjectId(reference) ? reference.toLowerCase() : null).first<PurchaseRow>();
      if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
      if (purchase.status === "REFUNDED") {
        adminOk(res, { purchase: presentPurchase(purchase, false), alreadyRefunded: true });
        return;
      }
      if (!["PAID", "CREDITED", "REFUND_PENDING", "REFUND_FAILED"].includes(purchase.status)) {
        throw conflict("Only paid purchases can be refunded");
      }
      const admin = adminFrom(res);
      let refund = await readRefund(purchase.source_id);
      if (purchase.status === "REFUND_PENDING" && !refund) throw conflict("An earlier refund needs manual reconciliation");
      const paymentId = purchase.provider_payment_id;
      const googleOrderId = purchase.google_order_id;
      const fiatAmount = purchase.amount_inr * 100;
      if (!Number.isSafeInteger(fiatAmount) || fiatAmount <= 0) throw conflict("Purchase refund amount is invalid");
      let googleState: string | undefined;
      if (purchase.provider === "RAZORPAY" && !refund) {
        if (!paymentId) throw conflict("No Razorpay payment ID is recorded");
        const payment = await payments.fetchRazorpayPayment(paymentId);
        if (payment.id !== paymentId || payment.order_id !== purchase.provider_order_id || payment.status !== "captured" ||
            payment.amount !== fiatAmount || payment.currency !== "INR" || Number(payment.amount_refunded ?? 0) > 0) {
          throw conflict("Razorpay payment or previous refund requires reconciliation");
        }
      }
      const readGoogleState = async () => {
        if (!googleOrderId || !purchase.purchase_token) throw conflict("No verified Google Play order is recorded");
        const order = await payments.googlePlayOrder(googleOrderId);
        if (order.orderId !== googleOrderId || order.purchaseToken !== purchase.purchase_token) {
          throw conflict("Google Play order does not match the recorded purchase");
        }
        return order.state;
      };
      if (purchase.provider === "GOOGLE_PLAY") {
        googleState = await readGoogleState();
        if (!["PROCESSED", "PENDING_REFUND", "REFUNDED"].includes(googleState)) {
          throw conflict("Google Play order status requires reconciliation");
        }
      }
      refund ??= await reserve(purchase, admin, req.body.reason, req);
      if (refund.status === "REFUNDED") {
        adminOk(res, { purchase: presentPurchase((await readPurchase(purchase.source_id))!, false), alreadyRefunded: true });
        return;
      }
      let providerId: string;
      let providerState: string;
      if (purchase.provider === "RAZORPAY") {
        if (!paymentId) throw conflict("No Razorpay payment ID is recorded");
        const recorded = await payments.razorpayRefund({ paymentId, amount: fiatAmount,
          key: `refund_${refund.source_id}`, refundId: refund.provider_refund_id ?? undefined });
        if (!recorded.id || recorded.payment_id !== paymentId || recorded.amount !== fiatAmount || recorded.currency !== "INR") {
          throw conflict("Razorpay refund receipt does not match the recorded purchase");
        }
        providerId = recorded.id;
        providerState = recorded.status;
      } else {
        providerId = googleOrderId!;
        if (googleState === "PROCESSED") {
          const submitted = await db.prepare(`UPDATE admin_purchase_refunds SET provider_attempted = 1, updated_at = ?
            WHERE source_id = ? AND status = 'PENDING' AND provider_attempted = 0`)
            .bind(new Date().toISOString(), refund.source_id).run();
          if (submitted.meta.changes) {
            await payments.refundGooglePlayOrder(providerId);
            googleState = await readGoogleState();
          }
        }
        providerState = googleState === "REFUNDED" ? "processed" : "pending";
      }
      if (providerState === "failed") {
        await finish(refund, purchase, providerId, true, admin, req);
        throw new HttpError(502, "Provider rejected refund and the wallet reservation was restored");
      }
      if (providerState === "processed") {
        const settled = await finish(refund, purchase, providerId, false, admin, req);
        adminOk(res, { purchase: presentPurchase(settled, false), providerRefund: { id: providerId, status: providerState } });
        return;
      }
      await db.batch([
        db.prepare(`UPDATE admin_purchase_refunds SET provider_refund_id = ?, updated_at = ? WHERE source_id = ? AND status = 'PENDING'`)
          .bind(providerId, new Date().toISOString(), refund.source_id),
        db.prepare(`UPDATE purchases SET refund_provider_id = ? WHERE source_id = ? AND status = 'REFUND_PENDING'`)
          .bind(providerId, purchase.source_id)
      ]);
      const pending = await readPurchase(purchase.source_id);
      if (!pending) throw conflict("Refund state could not be read");
      adminOk(res, { purchase: presentPurchase(pending, false), providerRefund: { id: providerId, status: providerState } }, {},
        pending.status === "REFUNDED" ? 200 : 202);
    }));
  return router;
}
