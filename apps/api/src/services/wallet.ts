import mongoose from "mongoose";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { HttpError } from "../utils/http.js";

export async function creditWallet(userId: string, amount: number, source: string, metadata = {}, session?: mongoose.ClientSession) {
  const opts: Record<string, unknown> = { new: true };
  if (session) opts.session = session;
  const after = await User.findByIdAndUpdate(userId, { $inc: { walletBalance: amount } }, opts);
  if (!after) throw new HttpError(404, "User not found");

  const txOpts: Record<string, unknown> = {};
  if (session) txOpts.session = session;
  return WalletTransaction.create([{
    userId,
    type: "CREDIT",
    source,
    amount,
    balanceBefore: after.walletBalance - amount,
    balanceAfter: after.walletBalance,
    metadata,
    creditedAt: new Date()
  }], txOpts);
}

export async function debitWallet(userId: string, amount: number, source: string, metadata = {}, session?: mongoose.ClientSession) {
  const opts: Record<string, unknown> = { new: true };
  if (session) opts.session = session;
  const after = await User.findOneAndUpdate(
    { _id: userId, walletBalance: { $gte: amount } },
    { $inc: { walletBalance: -amount } },
    opts
  );
  if (!after) throw new HttpError(402, "Insufficient coins");

  const txOpts: Record<string, unknown> = {};
  if (session) txOpts.session = session;
  return WalletTransaction.create([{
    userId,
    type: "DEBIT",
    source,
    amount,
    balanceBefore: after.walletBalance + amount,
    balanceAfter: after.walletBalance,
    metadata
  }], txOpts);
}
