import mongoose from "mongoose";
import { User } from "../models/User.js";
import { UserSafetyStatus } from "../models/UserSafetyStatus.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { HttpError } from "../utils/http.js";

export const PLATFORM_FEE_PERCENTAGE = 10;
export const CREATOR_SHARE_PERCENTAGE = 100 - PLATFORM_FEE_PERCENTAGE;

export function platformFee(amount: number) {
  return Math.floor(amount * PLATFORM_FEE_PERCENTAGE / 100);
}

export function creatorShare(amount: number) {
  return amount - platformFee(amount);
}

export async function assertWalletNotFrozen(userId: string) {
  const status = await UserSafetyStatus.findOne({ userId }).lean();
  if (status?.isWalletFrozen) throw new HttpError(403, "Wallet is frozen");
}

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
  if (source !== "ADMIN_ADJUSTMENT") await assertWalletNotFrozen(userId);
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
