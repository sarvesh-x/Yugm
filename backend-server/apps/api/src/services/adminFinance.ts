import { CreatorPayoutKyc } from "../models/CreatorPayoutKyc.js";
import { PayoutReview } from "../models/PayoutReview.js";
import { TrustVerification } from "../models/TrustVerification.js";

export async function listTrustVerificationQueue(status?: string, skip = 0, limit = 20) {
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    TrustVerification.find(filter).populate("userId", "name username avatar role isVerified").sort({ submittedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    TrustVerification.countDocuments(filter)
  ]);
  return { items, total };
}

export async function listCreatorKycQueue(status?: string, skip = 0, limit = 20) {
  const filter = status ? { kycStatus: status } : {};
  const [items, total] = await Promise.all([
    CreatorPayoutKyc.find(filter).populate("userId", "name username avatar role").sort({ submittedAt: -1, createdAt: -1 }).skip(skip).limit(limit).lean(),
    CreatorPayoutKyc.countDocuments(filter)
  ]);
  return { items, total };
}

export async function listPayoutReviewQueue(status?: string, skip = 0, limit = 20) {
  const filter = status ? { status } : {};
  const [items, total] = await Promise.all([
    PayoutReview.find(filter)
      .populate("userId", "name username avatar role")
      .populate("withdrawalRequestId")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean(),
    PayoutReview.countDocuments(filter)
  ]);
  return { items, total };
}
