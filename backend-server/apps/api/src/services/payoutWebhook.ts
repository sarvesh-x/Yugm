import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { PayoutReview } from "../models/PayoutReview.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";
import { AdminAuditLog } from "../models/AdminAuditLog.js";
import { isValidRazorpayWebhook } from "./paymentSignatures.js";

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

export async function handlePayoutWebhook(req: Request, res: Response) {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(501).json({ ok: false, error: "Webhook secret not configured" });
  }

  const rawBody = req.body instanceof Buffer ? req.body.toString("utf-8") : JSON.stringify(req.body);
  const signature = req.headers["x-razorpay-signature"] as string;

  if (!signature || !isValidRazorpayWebhook(rawBody, signature, secret)) {
    return res.status(401).json({ ok: false, error: "Invalid signature" });
  }

  let event: PayoutWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid JSON body" });
  }

  const payoutId = event.payload?.payout?.id;
  if (!payoutId) {
    return res.status(400).json({ ok: false, error: "Missing payout id" });
  }

  if (event.event === "payout.processed") {
    const update = {
      "payout.providerStatus": "PROCESSED",
      "payout.processedAt": event.payload.payout.processed_at ? new Date(event.payload.payout.processed_at * 1000) : new Date(),
      "payout.failureReason": undefined,
      status: "PAID"
    };

    // Atomic idempotency: only transition rows that are not already processed.
    const review = await PayoutReview.findOneAndUpdate(
      { "payout.providerPayoutId": payoutId, "payout.providerStatus": { $ne: "PROCESSED" } },
      { $set: update },
      { new: true }
    ).lean();

    if (!review) {
      const exists = await PayoutReview.exists({ "payout.providerPayoutId": payoutId });
      if (exists) return res.json({ ok: true, received: event.event, duplicate: true });
      console.warn(`[payoutWebhook] No PayoutReview matched provider payout ${payoutId}`);
      return res.json({ ok: true, received: event.event, matched: false });
    }

    if (review.withdrawalRequestId) {
      await WithdrawalRequest.findByIdAndUpdate(review.withdrawalRequestId, {
        status: "PAID",
        paidAt: review.payout?.processedAt ?? new Date()
      });
    }

    await AdminAuditLog.create({
      adminId: undefined,
      action: "PAYOUT_WEBHOOK_PROCESSED",
      entityType: "PayoutReview",
      entityId: review._id,
      metadata: { payoutId, providerStatus: "PROCESSED" }
    });
  }

  if (event.event === "payout.reversed" || event.event === "payout.rejected" || event.event === "payout.failed") {
    const reason = event.event === "payout.reversed" ? "REVERSED" : event.event === "payout.rejected" ? "REJECTED" : "FAILED";

    const review = await PayoutReview.findOneAndUpdate(
      { "payout.providerPayoutId": payoutId, "payout.providerStatus": { $ne: reason } },
      {
        $set: {
          "payout.providerStatus": reason,
          "payout.failureReason": event.payload.payout.failure_reason
        }
      },
      { new: true }
    ).lean();

    if (!review) {
      const exists = await PayoutReview.exists({ "payout.providerPayoutId": payoutId });
      if (exists) return res.json({ ok: true, received: event.event, duplicate: true });
      console.warn(`[payoutWebhook] No PayoutReview matched provider payout ${payoutId}`);
      return res.json({ ok: true, received: event.event, matched: false });
    }

    if (review.withdrawalRequestId) {
      await WithdrawalRequest.findByIdAndUpdate(review.withdrawalRequestId, { status: "FAILED" });
    }

    await AdminAuditLog.create({
      adminId: undefined,
      action: `PAYOUT_WEBHOOK_${reason}`,
      entityType: "PayoutReview",
      entityId: review._id,
      metadata: { payoutId, reason: event.payload.payout.failure_reason }
    });
  }

  res.json({ ok: true, received: event.event });
}
