import mongoose from "mongoose";
import { walletSources } from "@yugm/shared";
import { User } from "../models/User.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export { creatorShare, platformFee, PLATFORM_FEE_PERCENTAGE, CREATOR_SHARE_PERCENTAGE } from "./giftPricing.js";
export type WalletSource = (typeof walletSources)[number];
type WalletEntry = mongoose.HydratedDocument<mongoose.InferSchemaType<typeof WalletTransaction.schema>>;
type WalletMetadata = Record<string, unknown>;
const allowedSources = new Set<string>(walletSources);

export async function assertWalletNotFrozen(userId: string, session?: mongoose.ClientSession) {
  const query = UserSafetyStatus.findOne({ userId });
  if (session) query.session(session);
  const status = await query.lean();
  if (status?.isWalletFrozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
}

function validateMutation(amount: number, source: string, metadata: WalletMetadata) {
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new HttpError(400, "Coin amount must be a positive safe integer", ErrorCode.VALIDATION);
  }
  if (!allowedSources.has(source)) {
    throw new HttpError(400, "Unsupported wallet transaction source", ErrorCode.VALIDATION);
  }
  if (metadata.idempotencyKey !== undefined &&
      (typeof metadata.idempotencyKey !== "string" || !metadata.idempotencyKey.trim())) {
    throw new HttpError(400, "Invalid wallet operation key", ErrorCode.VALIDATION);
  }
}

function checkReplay(entry: WalletEntry, type: "CREDIT" | "DEBIT", amount: number, source: string) {
  if (entry.type !== type || entry.amount !== amount || entry.source !== source) {
    throw new HttpError(409, "Wallet operation key was already used for a different mutation", ErrorCode.CONFLICT);
  }
  return [entry];
}

async function mutateWallet(
  type: "CREDIT" | "DEBIT", userId: string, amount: number, source: string,
  metadata: WalletMetadata, session?: mongoose.ClientSession
): Promise<WalletEntry[]> {
  // Ledger schema validation alone is too late: validate before touching balances.
  validateMutation(amount, source, metadata);
  if (session && !session.inTransaction()) {
    throw new HttpError(500, "Wallet mutations require an active transaction", ErrorCode.INTERNAL);
  }
  const key = metadata.idempotencyKey as string | undefined;
  const run = async (activeSession: mongoose.ClientSession): Promise<WalletEntry[]> => {
    if (key) {
      const existing = await WalletTransaction.findOne({ userId, "metadata.idempotencyKey": key }).session(activeSession);
      if (existing) return checkReplay(existing, type, amount, source);
    }
    if (type === "DEBIT" && source !== "ADMIN_ADJUSTMENT") await assertWalletNotFrozen(userId, activeSession);
    const filter = type === "DEBIT"
      ? { _id: userId, walletBalance: { $gte: amount } }
      : { _id: userId, walletBalance: { $lte: Number.MAX_SAFE_INTEGER - amount } };
    const increments: Record<string, number> = { walletBalance: type === "CREDIT" ? amount : -amount };
    if (type === "CREDIT" && (source === "GIFT_RECEIVED" || source === "GIFT_RECEIVED_DM")) {
      increments.charmExp = amount + Math.max(0, Math.floor(Number(metadata.platformFee) || 0));
    }
    const after = await User.findOneAndUpdate(
      filter, { $inc: increments },
      { new: true, session: activeSession }
    );
    if (!after) {
      const exists = await User.exists({ _id: userId }).session(activeSession);
      if (!exists) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      if (type === "DEBIT") throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
      throw new HttpError(409, "Coin balance limit reached", ErrorCode.CONFLICT);
    }
    if (!Number.isSafeInteger(after.walletBalance)) {
      throw new HttpError(409, "Coin balance requires reconciliation", ErrorCode.CONFLICT);
    }
    return WalletTransaction.create([{
      userId, type, source, amount,
      balanceBefore: type === "CREDIT" ? after.walletBalance - amount : after.walletBalance + amount,
      balanceAfter: after.walletBalance, metadata,
      ...(type === "CREDIT" ? { creditedAt: new Date() } : {})
    }], { session: activeSession, ordered: true });
  };
  // Supplied sessions remain owned by the workflow; standalone calls own one
  // balance+journal transaction with driver-managed transient conflict retries.
  if (session) return run(session);
  try {
    return await mongoose.connection.transaction(run);
  } catch (error) {
    // On a unique-key race the losing transaction is aborted before replay lookup.
    if (key && (error as { code?: number }).code === 11000) {
      const existing = await WalletTransaction.findOne({ userId, "metadata.idempotencyKey": key });
      if (existing) return checkReplay(existing, type, amount, source);
    }
    throw error;
  }
}

export function creditWallet(userId: string, amount: number, source: string, metadata: WalletMetadata = {}, session?: mongoose.ClientSession) {
  return mutateWallet("CREDIT", userId, amount, source, metadata, session);
}

export function debitWallet(userId: string, amount: number, source: string, metadata: WalletMetadata = {}, session?: mongoose.ClientSession) {
  return mutateWallet("DEBIT", userId, amount, source, metadata, session);
}
