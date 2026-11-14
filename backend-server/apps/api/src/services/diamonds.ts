import mongoose from "mongoose";
import { User } from "../models/User.js";
import { DiamondTransaction } from "../models/DiamondTransaction.js";
import { env } from "../config/env.js";
import { ErrorCode, HttpError } from "../utils/http.js";
import { assertWalletNotFrozen } from "./wallet.js";

export type DiamondMutationOptions = {
  session?: mongoose.ClientSession;
  idempotencyKey?: string;
  allowNegative?: boolean;
};

export function diamondsEnabled() {
  return env.MONETIZATION_DIAMONDS_ENABLED;
}

export function assertDiamondsEnabled() {
  if (!diamondsEnabled()) throw new HttpError(503, "Diamonds are not enabled", ErrorCode.VALIDATION);
}

async function findIdempotent(key: string | undefined, session?: mongoose.ClientSession) {
  if (!key) return null;
  const query = DiamondTransaction.findOne({ idempotencyKey: key });
  if (session) query.session(session);
  return query.lean();
}

function updateOptions(session?: mongoose.ClientSession) {
  const opts: Record<string, unknown> = { new: true };
  if (session) opts.session = session;
  return opts;
}

function createOptions(session?: mongoose.ClientSession) {
  const opts: Record<string, unknown> = {};
  if (session) opts.session = session;
  return opts;
}

async function record(
  userId: string,
  type: "CREDIT" | "DEBIT",
  source: string,
  amount: number,
  balanceAfter: number,
  metadata: Record<string, unknown>,
  options: DiamondMutationOptions
) {
  return DiamondTransaction.create([{
    userId,
    type,
    source,
    amount,
    balanceBefore: type === "CREDIT" ? balanceAfter - amount : balanceAfter + amount,
    balanceAfter,
    metadata,
    ...(options.idempotencyKey ? { idempotencyKey: options.idempotencyKey } : {})
  }], createOptions(options.session));
}

export async function creditDiamonds(
  userId: string,
  amount: number,
  source: string,
  metadata: Record<string, unknown> = {},
  options: DiamondMutationOptions = {}
) {
  if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, "Invalid diamond amount", ErrorCode.VALIDATION);

  const existing = await findIdempotent(options.idempotencyKey, options.session);
  if (existing) return [existing];

  const after = await User.findByIdAndUpdate(userId, { $inc: { diamondBalance: amount } }, updateOptions(options.session));
  if (!after) throw new HttpError(404, "User not found");

  return record(userId, "CREDIT", source, amount, after.diamondBalance, metadata, options);
}

export async function debitDiamonds(
  userId: string,
  amount: number,
  source: string,
  metadata: Record<string, unknown> = {},
  options: DiamondMutationOptions = {}
) {
  if (!Number.isInteger(amount) || amount <= 0) throw new HttpError(400, "Invalid diamond amount", ErrorCode.VALIDATION);

  const existing = await findIdempotent(options.idempotencyKey, options.session);
  if (existing) return [existing];

  if (source !== "ADMIN_ADJUSTMENT") await assertWalletNotFrozen(userId);

  const after = await User.findOneAndUpdate(
    options.allowNegative ? { _id: userId } : { _id: userId, diamondBalance: { $gte: amount } },
    { $inc: { diamondBalance: -amount } },
    updateOptions(options.session)
  );
  if (!after) throw new HttpError(402, "Insufficient diamonds", ErrorCode.INSUFFICIENT_FUNDS);

  return record(userId, "DEBIT", source, amount, after.diamondBalance, metadata, options);
}
