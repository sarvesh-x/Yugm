import type { D1Database } from "@cloudflare/workers-types";
import type { Request, Response } from "express";
import { isValidRazorpayWebhook } from "../services/paymentSignatures.js";
import { newId } from "./d1Cosmetics.js";

type PayoutWebhookEvent = {
  event: "payout.created" | "payout.processing" | "payout.processed" | "payout.reversed" | "payout.rejected" | "payout.failed";
  payload: {
    payout: {
      id: string;
      status: string;
      amount: number;
      currency: string;
      notes?: Record<string, string>;
      created_at: number;
      processed_at?: number;
      failure_reason?: string;
    };
  };
};

export function createD1PayoutWebhookHandler(db: D1Database, secret?: string) {
  return async function handleD1PayoutWebhook(req: Request, res: Response) {
    if (!secret) {
      res.status(501).json({ ok: false, error: "Webhook secret not configured" });
      return;
    }

    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString("utf-8") : JSON.stringify(req.body);
    const signature = req.headers["x-razorpay-signature"];
    if (typeof signature !== "string" || !isValidRazorpayWebhook(rawBody, signature, secret)) {
      res.status(401).json({ ok: false, error: "Invalid signature" });
      return;
    }

    let event: PayoutWebhookEvent;
    try {
      event = JSON.parse(rawBody);
    } catch {
      res.status(400).json({ ok: false, error: "Invalid JSON body" });
      return;
    }

    const payoutId = event.payload?.payout?.id;
    if (!payoutId) {
      res.status(400).json({ ok: false, error: "Missing payout id" });
      return;
    }

    const now = new Date().toISOString();
    const auditId = newId();

    if (event.event === "payout.processed") {
      const processedAt = event.payload.payout.processed_at
        ? new Date(event.payload.payout.processed_at * 1000).toISOString()
        : now;
      const batch = await db.batch([
        db.prepare(`UPDATE payout_reviews SET status = 'PAID', provider_status = 'PROCESSED',
            processed_at = ?, updated_at = ?
          WHERE provider_payout_id = ? AND (provider_status IS NULL OR provider_status <> 'PROCESSED')`)
          .bind(processedAt, now, payoutId),
        db.prepare(`UPDATE withdrawal_requests SET status = 'PAID', paid_at = ?, active_lock = 0,
            payout_reference = ?, updated_at = ?
          WHERE source_id = (SELECT withdrawal_request_id FROM payout_reviews WHERE provider_payout_id = ?)
            AND EXISTS (SELECT 1 FROM payout_reviews WHERE provider_payout_id = ? AND updated_at = ?)`)
          .bind(processedAt, payoutId, now, payoutId, payoutId, now),
        db.prepare(`INSERT INTO admin_audit_logs (source_id, admin_id, action, entity_type, entity_id, target_user_id, metadata, ip_address, user_agent, created_at, updated_at)
          SELECT ?, NULL, 'PAYOUT_WEBHOOK_PROCESSED', 'PayoutReview', source_id, user_id,
            json_object('payoutId', ?, 'providerStatus', 'PROCESSED'), ?, ?, ?, ?
          FROM payout_reviews WHERE provider_payout_id = ? AND updated_at = ?`)
          .bind(auditId, payoutId, req.ip ?? null, req.get("user-agent") ?? null, now, now, payoutId, now)
      ]);
      if (Number(batch[0]?.meta?.changes ?? 0) < 1) {
        const exists = await db.prepare("SELECT 1 AS ok FROM payout_reviews WHERE provider_payout_id = ? LIMIT 1").bind(payoutId).first();
        if (exists) {
          res.json({ ok: true, received: event.event, duplicate: true });
          return;
        }
        console.warn(`[payoutWebhook] No PayoutReview matched provider payout ${payoutId}`);
        res.json({ ok: true, received: event.event, matched: false });
        return;
      }
      res.json({ ok: true, received: event.event });
      return;
    }

    if (event.event === "payout.reversed" || event.event === "payout.rejected" || event.event === "payout.failed") {
      const reason = event.event === "payout.reversed" ? "REVERSED" : event.event === "payout.rejected" ? "REJECTED" : "FAILED";
      const failureReason = event.payload.payout.failure_reason || reason;
      const batch = await db.batch([
        db.prepare(`UPDATE payout_reviews SET provider_status = ?, failure_reason = COALESCE(?, failure_reason), updated_at = ?
          WHERE provider_payout_id = ? AND (provider_status IS NULL OR provider_status <> ?)`)
          .bind(reason, event.payload.payout.failure_reason ?? null, now, payoutId, reason),
        db.prepare(`UPDATE withdrawal_requests SET status = 'REJECTED', active_lock = 0, rejected_at = ?,
            rejection_reason = ?, metadata = json_set(COALESCE(metadata, '{}'),
              '$.payoutProviderStatus', ?, '$.payoutFailureReason', ?, '$.payoutProviderId', ?), updated_at = ?
          WHERE source_id = (SELECT withdrawal_request_id FROM payout_reviews WHERE provider_payout_id = ?)
            AND EXISTS (SELECT 1 FROM payout_reviews WHERE provider_payout_id = ? AND updated_at = ?)`)
          .bind(now, `Payout ${reason.toLowerCase()}: ${failureReason}`, reason, failureReason, payoutId, now, payoutId, payoutId, now),
        db.prepare(`INSERT INTO admin_audit_logs (source_id, admin_id, action, entity_type, entity_id, target_user_id, metadata, ip_address, user_agent, created_at, updated_at)
          SELECT ?, NULL, ?, 'PayoutReview', source_id, user_id, json_object('payoutId', ?, 'reason', ?), ?, ?, ?, ?
          FROM payout_reviews WHERE provider_payout_id = ? AND updated_at = ?`)
          .bind(auditId, `PAYOUT_WEBHOOK_${reason}`, payoutId, event.payload.payout.failure_reason ?? null,
            req.ip ?? null, req.get("user-agent") ?? null, now, now, payoutId, now)
      ]);
      if (Number(batch[0]?.meta?.changes ?? 0) < 1) {
        const exists = await db.prepare("SELECT 1 AS ok FROM payout_reviews WHERE provider_payout_id = ? LIMIT 1").bind(payoutId).first();
        if (exists) {
          res.json({ ok: true, received: event.event, duplicate: true });
          return;
        }
        console.warn(`[payoutWebhook] No PayoutReview matched provider payout ${payoutId}`);
        res.json({ ok: true, received: event.event, matched: false });
        return;
      }
    }

    res.json({ ok: true, received: event.event });
  };
}