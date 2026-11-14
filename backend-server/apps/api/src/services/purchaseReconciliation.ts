import { env } from "../config/env.js";
import { Purchase } from "../models/Purchase.js";
import { fetchRazorpayPayment } from "./payments.js";
import { creditPurchase } from "./purchaseCredit.js";

export async function reconcileStuckPurchases(limit = 50) {
  const cutoff = new Date(Date.now() - 5 * 60 * 1000);
  const purchases = await Purchase.find({
    provider: "RAZORPAY",
    status: "PAID",
    providerPaymentId: { $exists: true, $ne: null },
    createdAt: { $lte: cutoff }
  }).limit(limit);

  let credited = 0;
  let skipped = 0;
  let failed = 0;

  for (const purchase of purchases) {
    try {
      const payment = await fetchRazorpayPayment(purchase.providerPaymentId!);
      if (
        payment.status !== "captured" ||
        payment.order_id !== purchase.providerOrderId ||
        payment.amount !== purchase.amountInr * 100 ||
        String(payment.currency || "").toUpperCase() !== "INR"
      ) {
        skipped += 1;
        continue;
      }
      await creditPurchase(purchase.id, purchase.userId.toString(), {
        paymentId: payment.id,
        reconciled: true
      });
      credited += 1;
    } catch (error) {
      failed += 1;
      console.warn(
        `[reconciliation] Failed to reconcile purchase ${purchase.id}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  if (!env.RAZORPAY_KEY_ID) skipped = purchases.length;

  return { scanned: purchases.length, credited, skipped, failed };
}
