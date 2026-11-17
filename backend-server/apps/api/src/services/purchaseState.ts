import { Purchase } from "../models/Purchase.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export const payablePurchaseStates = ["PENDING", "PAID", "FAILED"];

/** Only a verified provider result may call this. Never overwrite refund state. */
export async function markPurchasePaid(purchaseId: string, userId: string, fields: Record<string, unknown> = {}) {
  const purchase = await Purchase.findOneAndUpdate(
    { _id: purchaseId, userId, status: { $in: payablePurchaseStates } },
    { $set: { ...fields, status: "PAID" } }, { new: true }
  );
  if (purchase) return purchase;
  const current = await Purchase.findOne({ _id: purchaseId, userId });
  if (!current) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
  if (current.status === "CREDITED") return current;
  throw new HttpError(409, "Purchase requires refund reconciliation and cannot be credited", ErrorCode.CONFLICT);
}
