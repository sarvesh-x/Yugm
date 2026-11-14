import type { Request, Response } from "express";
import { env } from "../config/env.js";
import { Purchase } from "../models/Purchase.js";
import { isValidRazorpayWebhook } from "./paymentSignatures.js";
import { creditPurchase } from "./purchaseCredit.js";

type RazorpayPaymentEntity = {
  id: string;
  order_id: string;
  amount: number;
  currency: string;
  status: string;
  notes?: Record<string, string>;
};

type PaymentWebhookEvent = {
  event: string;
  payload?: {
    payment?: { entity?: RazorpayPaymentEntity };
  };
};

export async function handlePaymentWebhook(req: Request, res: Response) {
  const secret = env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(501).json({ ok: false, error: "Webhook secret not configured" });
  }

  const rawBody = req.body instanceof Buffer ? req.body.toString("utf-8") : JSON.stringify(req.body);
  const signature = req.headers["x-razorpay-signature"] as string;

  if (!signature || !isValidRazorpayWebhook(rawBody, signature, secret)) {
    return res.status(401).json({ ok: false, error: "Invalid signature" });
  }

  let event: PaymentWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid JSON body" });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment?.order_id) {
    return res.status(400).json({ ok: false, error: "Missing payment order id" });
  }

  const purchase = await Purchase.findOne({ provider: "RAZORPAY", providerOrderId: payment.order_id });
  if (!purchase) {
    console.warn(`[paymentWebhook] No purchase matched Razorpay order ${payment.order_id}`);
    return res.json({ ok: true, received: event.event, matched: false });
  }

  if (event.event === "payment.captured" || event.event === "order.paid") {
    if (payment.amount !== purchase.amountInr * 100 || String(payment.currency || "").toUpperCase() !== "INR") {
      console.warn(`[paymentWebhook] Amount mismatch for purchase ${purchase.id}: expected ${purchase.amountInr * 100} ${purchase.currency}, got ${payment.amount} ${payment.currency}`);
      return res.status(400).json({ ok: false, error: "Payment amount does not match purchase" });
    }

    if (purchase.status === "CREDITED") {
      return res.json({ ok: true, received: event.event, duplicate: true });
    }

    purchase.providerPaymentId = payment.id;
    purchase.status = "PAID";
    purchase.metadata = { ...purchase.metadata, payment, webhook: true };
    await purchase.save();

    const credited = await creditPurchase(purchase.id, purchase.userId.toString(), {
      paymentId: payment.id,
      webhook: true
    });
    return res.json({ ok: true, received: event.event, credited: true, purchaseId: credited.id });
  }

  if (event.event === "payment.failed") {
    const failed = await Purchase.findOneAndUpdate(
      { _id: purchase._id, status: { $nin: ["CREDITED", "REFUNDED"] } },
      { $set: { status: "FAILED", metadata: { ...purchase.metadata, payment, webhook: true } } },
      { new: true }
    );
    return res.json({ ok: true, received: event.event, failed: Boolean(failed) });
  }

  res.json({ ok: true, received: event.event, matched: true });
}
