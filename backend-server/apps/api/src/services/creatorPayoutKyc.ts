import { CreatorPayoutKyc } from "../models/CreatorPayoutKyc.js";
import { User } from "../models/User.js";
import { encryptSensitiveField, last4, maskUpi } from "./cryptoFields.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export function isCreatorUser(user: { role?: string }) {
  return user.role === "HOST" || user.role === "MODERATOR" || user.role === "ADMIN";
}

export async function assertCreatorAccess(user: { role?: string }) {
  if (!isCreatorUser(user)) {
    throw new HttpError(403, "Creator Payout Verification is available only for creators or hosts", ErrorCode.FORBIDDEN);
  }
}

export function publicCreatorPayoutKyc(kyc: any, sensitiveAccessGranted = false) {
  const payload: Record<string, unknown> = {
    id: kyc?._id?.toString?.() ?? kyc?.id,
    userId: kyc?.userId?.toString?.() ?? kyc?.userId,
    legalFullName: kyc?.legalFullName ?? null,
    dateOfBirth: kyc?.dateOfBirth ?? null,
    panLast4: kyc?.panLast4 ?? null,
    panVerified: Boolean(kyc?.panVerified),
    upiIdMasked: kyc?.upiIdMasked ?? null,
    bankAccountLast4: kyc?.bankAccountLast4 ?? null,
    bankIfsc: kyc?.bankIfsc ?? null,
    bankHolderName: kyc?.bankHolderName ?? null,
    kycStatus: kyc?.kycStatus ?? "NOT_SUBMITTED",
    payoutStatus: kyc?.payoutStatus ?? "DISABLED",
    submittedAt: kyc?.submittedAt ?? null,
    verifiedAt: kyc?.verifiedAt ?? null,
    rejectedAt: kyc?.rejectedAt ?? null,
    rejectionReason: kyc?.rejectionReason ?? null,
    adminNotes: kyc?.adminNotes ?? null,
    sensitiveAccessGranted,
    sensitiveFieldsMasked: true
  };
  return payload;
}

export async function getOrCreateCreatorPayoutKyc(userId: string) {
  return CreatorPayoutKyc.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, kycStatus: "NOT_SUBMITTED", payoutStatus: "DISABLED" } },
    { new: true, upsert: true }
  );
}

export async function submitCreatorPayoutKyc(userId: string, input: {
  legalFullName?: string;
  dateOfBirth?: string;
  panNumber?: string;
  upiId?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankHolderName?: string;
  declarationsAccepted?: boolean;
}) {
  const user = await User.findById(userId).select("role").lean();
  if (!user || !isCreatorUser(user)) throw new HttpError(403, "Creator Payout Verification is available only for creators or hosts", ErrorCode.FORBIDDEN);
  if (!input.declarationsAccepted) throw new HttpError(400, "Accept payout declarations before submitting", ErrorCode.VALIDATION);
  if (!input.legalFullName?.trim()) throw new HttpError(400, "Legal full name is required", ErrorCode.VALIDATION);
  if (!input.panNumber?.trim()) throw new HttpError(400, "PAN is required for Creator Payout Verification", ErrorCode.VALIDATION);
  if (!input.upiId?.trim() && !input.bankAccount?.trim()) throw new HttpError(400, "Submit UPI or bank account details", ErrorCode.VALIDATION);

  const kyc = await getOrCreateCreatorPayoutKyc(userId);
  kyc.legalFullName = input.legalFullName.trim();
  kyc.dateOfBirth = input.dateOfBirth ? new Date(input.dateOfBirth) : kyc.dateOfBirth;
  kyc.panNumberEncrypted = encryptSensitiveField(input.panNumber);
  kyc.panLast4 = last4(input.panNumber);
  if (input.upiId) {
    kyc.upiIdEncrypted = encryptSensitiveField(input.upiId);
    kyc.upiIdMasked = maskUpi(input.upiId);
  }
  if (input.bankAccount) {
    kyc.bankAccountEncrypted = encryptSensitiveField(input.bankAccount);
    kyc.bankAccountLast4 = last4(input.bankAccount);
  }
  kyc.bankIfsc = input.bankIfsc?.trim().toUpperCase();
  kyc.bankHolderName = input.bankHolderName?.trim();
  kyc.kycStatus = "PENDING";
  kyc.payoutStatus = "MANUAL_REVIEW";
  kyc.submittedAt = new Date();
  kyc.rejectedAt = undefined;
  kyc.rejectionReason = undefined;
  kyc.metadata = { ...(kyc.metadata ?? {}), declarationsAccepted: true, declarationsAcceptedAt: new Date().toISOString() };
  await kyc.save();
  return kyc;
}

export async function updateCreatorPayoutKyc(userId: string, input: {
  legalFullName?: string;
  dateOfBirth?: string;
  panNumber?: string;
  upiId?: string;
  bankAccount?: string;
  bankIfsc?: string;
  bankHolderName?: string;
  declarationsAccepted?: boolean;
}) {
  const user = await User.findById(userId).select("role").lean();
  if (!user || !isCreatorUser(user)) throw new HttpError(403, "Creator Payout Verification is available only for creators or hosts", ErrorCode.FORBIDDEN);
  const kyc = await getOrCreateCreatorPayoutKyc(userId);
  if (input.legalFullName !== undefined) kyc.legalFullName = input.legalFullName.trim();
  if (input.dateOfBirth !== undefined) kyc.dateOfBirth = new Date(input.dateOfBirth);
  if (input.panNumber !== undefined) {
    kyc.panNumberEncrypted = encryptSensitiveField(input.panNumber);
    kyc.panLast4 = last4(input.panNumber);
    kyc.panVerified = false;
  }
  if (input.upiId !== undefined) {
    kyc.upiIdEncrypted = encryptSensitiveField(input.upiId);
    kyc.upiIdMasked = maskUpi(input.upiId);
  }
  if (input.bankAccount !== undefined) {
    kyc.bankAccountEncrypted = encryptSensitiveField(input.bankAccount);
    kyc.bankAccountLast4 = last4(input.bankAccount);
  }
  if (input.bankIfsc !== undefined) kyc.bankIfsc = input.bankIfsc.trim().toUpperCase();
  if (input.bankHolderName !== undefined) kyc.bankHolderName = input.bankHolderName.trim();

  kyc.kycStatus = "PENDING";
  kyc.payoutStatus = "MANUAL_REVIEW";
  kyc.submittedAt = new Date();
  kyc.rejectedAt = undefined;
  kyc.rejectionReason = undefined;
  kyc.metadata = {
    ...(kyc.metadata ?? {}),
    declarationsAccepted: input.declarationsAccepted ?? kyc.metadata?.declarationsAccepted ?? true,
    updatedAt: new Date().toISOString()
  };
  await kyc.save();
  return kyc;
}

export async function approveCreatorPayoutKyc(userId: string, adminId: string, notes?: string) {
  const kyc = await getOrCreateCreatorPayoutKyc(userId);
  kyc.kycStatus = "VERIFIED";
  kyc.payoutStatus = "ENABLED";
  kyc.panVerified = true;
  kyc.verifiedAt = new Date();
  kyc.rejectedAt = undefined;
  kyc.reviewedByAdminId = adminId as any;
  kyc.rejectionReason = undefined;
  kyc.adminNotes = notes;
  await kyc.save();
  return kyc;
}

export async function rejectCreatorPayoutKyc(userId: string, adminId: string, reason: string, notes?: string) {
  const kyc = await getOrCreateCreatorPayoutKyc(userId);
  kyc.kycStatus = "REJECTED";
  kyc.payoutStatus = "DISABLED";
  kyc.rejectedAt = new Date();
  kyc.reviewedByAdminId = adminId as any;
  kyc.rejectionReason = reason;
  kyc.adminNotes = notes;
  await kyc.save();
  return kyc;
}

export async function requestCreatorPayoutKycRetry(userId: string, adminId: string, reason?: string, notes?: string) {
  const kyc = await getOrCreateCreatorPayoutKyc(userId);
  kyc.kycStatus = "NEEDS_RETRY";
  kyc.payoutStatus = "DISABLED";
  kyc.reviewedByAdminId = adminId as any;
  kyc.rejectionReason = reason;
  kyc.adminNotes = notes;
  await kyc.save();
  return kyc;
}

export async function setPayoutStatus(userId: string, adminId: string, payoutStatus: "FROZEN" | "ENABLED" | "MANUAL_REVIEW" | "DISABLED", notes?: string) {
  const kyc = await getOrCreateCreatorPayoutKyc(userId);
  kyc.payoutStatus = payoutStatus;
  kyc.reviewedByAdminId = adminId as any;
  kyc.adminNotes = notes;
  await kyc.save();
  return kyc;
}
