import type { ClientSession } from "mongoose";
import { User } from "../models/User.js";

export { getProgressionTrack } from "./progressionPresentation.js";

export async function addWealthExp(userId: string, amount: number, session?: ClientSession) {
  if (!Number.isInteger(amount) || amount <= 0) return;
  await User.updateOne({ _id: userId }, { $inc: { wealthExp: amount } }, session ? { session } : undefined);
}

export async function addCharmExp(userId: string, amount: number, session?: ClientSession) {
  if (!Number.isInteger(amount) || amount <= 0) return;
  await User.updateOne({ _id: userId }, { $inc: { charmExp: amount } }, session ? { session } : undefined);
}
