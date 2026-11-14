import mongoose from "mongoose";
import { Purchase } from "../models/Purchase.js";
import { creditWallet } from "./wallet.js";
import { creditDiamonds } from "./diamonds.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export async function creditPurchase(purchaseId: string, userId: string, metadata: Record<string, unknown>) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase = await Purchase.findOneAndUpdate(
      { _id: purchaseId, userId, status: { $ne: "CREDITED" } },
      { $set: { status: "CREDITED", creditedAt: new Date() } },
      { new: true, session }
    );
    if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);

    purchase.metadata = { ...(purchase.metadata ?? {}), ...metadata };
    const ledgerMetadata = {
      purchaseId: purchase._id.toString(),
      packId: purchase.packId,
      provider: purchase.provider,
      ...metadata
    };

    if (purchase.assetCurrency === "DIAMONDS") {
      const amount = Math.max(0, purchase.diamondAmount || 0);
      if (amount > 0) {
        const tx = await creditDiamonds(userId, amount, `${purchase.provider}_PURCHASE`, ledgerMetadata, {
          session,
          idempotencyKey: `purchase:${purchase._id.toString()}`
        });
        const txDoc = Array.isArray(tx) ? tx[0] : tx;
        purchase.creditedDiamondTransactionId = (txDoc as any)?._id;
      }
    } else {
      const amount = Math.max(0, purchase.coinAmount || 0);
      if (amount > 0) {
        const tx = await creditWallet(userId, amount, `${purchase.provider}_PURCHASE`, ledgerMetadata, session);
        const txDoc = Array.isArray(tx) ? tx[0] : tx;
        purchase.creditedTransactionId = txDoc?._id ?? txDoc?.id;
      }
    }

    await purchase.save({ session });
    await session.commitTransaction();
    session.endSession();
    return purchase;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    const alreadyCredited = await Purchase.findOne({ _id: purchaseId, userId, status: "CREDITED" });
    if (alreadyCredited) return alreadyCredited;
    throw err;
  }
}
