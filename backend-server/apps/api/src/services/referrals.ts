import mongoose from "mongoose";
import { Referral } from "../models/Referral.js";
import { User } from "../models/User.js";
import { creditWallet } from "./wallet.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export const REFERRAL_REWARD_COINS = 100;

export async function claimReferral(input: { userId: string; code: string; ipAddress?: string }) {
  const normalizedCode = input.code.trim().toUpperCase();
  const session = await mongoose.startSession();
  try {
    return await session.withTransaction(async () => {
      const referrer = await User.findOne({ referralCode: normalizedCode }).session(session).lean();
      if (!referrer) throw new HttpError(404, "Invalid referral code", ErrorCode.NOT_FOUND);
      if (referrer._id.toString() === input.userId) {
        throw new HttpError(400, "Cannot refer yourself", ErrorCode.VALIDATION);
      }

      const claimant = await User.findById(input.userId).session(session).lean();
      if (!claimant) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      const previous = await Referral.findOne({
        referredUserId: input.userId,
        status: { $in: ["COMPLETED", "REWARDED"] }
      }).session(session).lean();

      if (previous?.status === "REWARDED" && previous.referrerId.toString() === referrer._id.toString()) {
        return {
          reward: previous.rewardCoins ?? REFERRAL_REWARD_COINS,
          referrerId: referrer._id.toString(),
          claimantName: claimant.name,
          alreadyClaimed: true
        };
      }
      // A legacy COMPLETED claim can have partial rewards. Do not credit it a
      // second time or invent a repair; reconciliation must review its journal.
      if (previous || claimant.referredBy) {
        throw new HttpError(409, "A referral claim is already recorded for this account", ErrorCode.CONFLICT);
      }

      // This shared user write serializes claims of different codes for the
      // same account, even before a historical-data index migration is applied.
      const claimed = await User.findOneAndUpdate(
        { _id: input.userId, $or: [{ referredBy: { $exists: false } }, { referredBy: null }] },
        { $set: { referredBy: referrer._id } },
        { new: true, session }
      );
      if (!claimed) throw new HttpError(409, "A referral claim is already recorded for this account", ErrorCode.CONFLICT);

      const now = new Date();
      const [referral] = await Referral.create([{
        referrerId: referrer._id,
        referredUserId: claimant._id,
        referralCode: normalizedCode,
        status: "REWARDED",
        rewardCoins: REFERRAL_REWARD_COINS,
        completedAt: now,
        rewardedAt: now,
        ipAddress: input.ipAddress
      }], { session });

      // Operations within one transaction must be sequential, not Promise.all.
      await creditWallet(input.userId, REFERRAL_REWARD_COINS, "REFERRAL_BONUS", {
        referralId: referral.id,
        type: "referral",
        idempotencyKey: `referral:${referral.id}:claimant`
      }, session);
      await creditWallet(referrer._id.toString(), REFERRAL_REWARD_COINS, "REFERRAL_BONUS", {
        referralId: referral.id,
        type: "referral",
        idempotencyKey: `referral:${referral.id}:referrer`
      }, session);

      return {
        reward: REFERRAL_REWARD_COINS,
        referrerId: referrer._id.toString(),
        claimantName: claimant.name,
        alreadyClaimed: false
      };
    });
  } catch (error) {
    if ((error as { code?: number })?.code === 11000) {
      // Existing installations can retain the old unique referralCode index.
      // Keep it fail-closed until an explicit data preflight/migration is done.
      throw new HttpError(409, "This referral claim could not be completed. Please contact support.", ErrorCode.CONFLICT);
    }
    throw error;
  } finally {
    await session.endSession();
  }
}
