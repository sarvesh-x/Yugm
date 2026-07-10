import { FaceVerificationSubmission } from "../models/FaceVerificationSubmission.js";
import { TrustVerification } from "../models/TrustVerification.js";
import { User } from "../models/User.js";
import { VoiceVerificationSubmission } from "../models/VoiceVerificationSubmission.js";
import { ErrorCode, HttpError } from "../utils/http.js";

export const TRUST_CONSENT_VERSION = "trust-verification-v1";

const voicePrompts = [
  "My name is on Yugm, and I am verifying that I am a real person.",
  "I am completing Yugm Trust Verification to show people I am real.",
  "This is my real voice for Yugm Trust Verification."
];

export function publicTrustVerification(verification: any) {
  return {
    id: verification?._id?.toString?.() ?? verification?.id,
    status: verification?.status ?? "NOT_STARTED",
    level: verification?.level ?? "BASIC",
    faceStatus: verification?.faceStatus ?? "NOT_SUBMITTED",
    voiceStatus: verification?.voiceStatus ?? "NOT_SUBMITTED",
    livenessStatus: verification?.livenessStatus ?? "NOT_SUBMITTED",
    verificationScore: verification?.verificationScore ?? null,
    riskScore: verification?.riskScore ?? null,
    verifiedBadgeEnabled: Boolean(verification?.verifiedBadgeEnabled),
    creatorTrustEnabled: Boolean(verification?.creatorTrustEnabled),
    submittedAt: verification?.submittedAt ?? null,
    reviewedAt: verification?.reviewedAt ?? null,
    verifiedAt: verification?.verifiedAt ?? null,
    rejectedAt: verification?.rejectedAt ?? null,
    rejectionReason: verification?.rejectionReason ?? null,
    consentVersion: verification?.consentVersion ?? null,
    consentAcceptedAt: verification?.consentAcceptedAt ?? null
  };
}

export async function getOrCreateTrustVerification(userId: string) {
  return TrustVerification.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId, status: "NOT_STARTED", level: "BASIC" } },
    { new: true, upsert: true }
  );
}

export async function startTrustVerification(userId: string) {
  return TrustVerification.findOneAndUpdate(
    { userId },
    { $setOnInsert: { userId }, $set: { status: "INCOMPLETE" } },
    { new: true, upsert: true }
  );
}

export async function acceptTrustConsent(userId: string, consentVersion = TRUST_CONSENT_VERSION) {
  const verification = await getOrCreateTrustVerification(userId);
  verification.status = verification.status === "NOT_STARTED" ? "INCOMPLETE" : verification.status;
  verification.consentVersion = consentVersion;
  verification.consentAcceptedAt = new Date();
  await verification.save();
  return verification;
}

export function nextVoicePrompt() {
  return voicePrompts[Math.floor(Math.random() * voicePrompts.length)];
}

export async function submitFaceVerification(userId: string, input: {
  selfieImageUrl?: string;
  selfieVideoUrl?: string;
  livenessVideoUrl?: string;
  provider?: string;
  providerReferenceId?: string;
  providerResponse?: unknown;
}) {
  if (!input.selfieImageUrl && !input.selfieVideoUrl && !input.livenessVideoUrl) {
    throw new HttpError(400, "Submit a selfie image, selfie video, or liveness video", ErrorCode.VALIDATION);
  }
  const verification = await getOrCreateTrustVerification(userId);
  const submission = await FaceVerificationSubmission.create({
    userId,
    verificationId: verification.id,
    ...input
  });
  verification.status = verification.status === "NOT_STARTED" ? "INCOMPLETE" : verification.status;
  verification.faceStatus = "SUBMITTED";
  verification.livenessStatus = input.livenessVideoUrl ? "SUBMITTED" : verification.livenessStatus;
  await verification.save();
  return { verification, submission };
}

export async function submitVoiceVerification(userId: string, input: {
  audioUrl?: string;
  transcriptText?: string;
  promptText: string;
  provider?: string;
  providerReferenceId?: string;
  providerResponse?: unknown;
}) {
  if (!input.audioUrl) throw new HttpError(400, "Submit a voice audio URL", ErrorCode.VALIDATION);
  const verification = await getOrCreateTrustVerification(userId);
  const submission = await VoiceVerificationSubmission.create({
    userId,
    verificationId: verification.id,
    ...input
  });
  verification.status = verification.status === "NOT_STARTED" ? "INCOMPLETE" : verification.status;
  verification.voiceStatus = "SUBMITTED";
  await verification.save();
  return { verification, submission };
}

export async function submitTrustReview(userId: string) {
  const verification = await getOrCreateTrustVerification(userId);
  if (!verification.consentAcceptedAt) throw new HttpError(400, "Accept consent before submitting Yugm Trust Verification", ErrorCode.VALIDATION);
  if (verification.faceStatus === "NOT_SUBMITTED") throw new HttpError(400, "Submit face verification before review", ErrorCode.VALIDATION);
  if (verification.voiceStatus === "NOT_SUBMITTED") throw new HttpError(400, "Submit voice verification before review", ErrorCode.VALIDATION);
  verification.status = "PENDING_REVIEW";
  verification.submittedAt = new Date();
  await verification.save();
  return verification;
}

export async function retryTrustVerification(userId: string) {
  const verification = await getOrCreateTrustVerification(userId);
  verification.status = "INCOMPLETE";
  verification.faceStatus = "NOT_SUBMITTED";
  verification.voiceStatus = "NOT_SUBMITTED";
  verification.livenessStatus = "NOT_SUBMITTED";
  verification.rejectionReason = undefined;
  await verification.save();
  return verification;
}

export async function approveTrustVerification(id: string, adminId: string, notes?: string) {
  const verification = await TrustVerification.findById(id);
  if (!verification) throw new HttpError(404, "Trust verification not found", ErrorCode.NOT_FOUND);
  const now = new Date();
  verification.status = "VERIFIED";
  verification.faceStatus = "VERIFIED";
  verification.voiceStatus = "VERIFIED";
  verification.livenessStatus = verification.livenessStatus === "NOT_SUBMITTED" ? "NOT_SUBMITTED" : "VERIFIED";
  verification.verifiedBadgeEnabled = true;
  verification.creatorTrustEnabled = true;
  verification.verificationScore = verification.verificationScore ?? 90;
  verification.riskScore = verification.riskScore ?? 10;
  verification.reviewedAt = now;
  verification.verifiedAt = now;
  verification.rejectedAt = undefined;
  verification.reviewedByAdminId = adminId as any;
  verification.adminNotes = notes;
  verification.rejectionReason = undefined;
  await verification.save();
  await User.findByIdAndUpdate(verification.userId, { isVerified: true });
  return verification;
}

export async function rejectTrustVerification(id: string, adminId: string, reason: string, notes?: string) {
  const verification = await TrustVerification.findById(id);
  if (!verification) throw new HttpError(404, "Trust verification not found", ErrorCode.NOT_FOUND);
  const now = new Date();
  verification.status = "REJECTED";
  verification.verifiedBadgeEnabled = false;
  verification.creatorTrustEnabled = false;
  verification.reviewedAt = now;
  verification.rejectedAt = now;
  verification.reviewedByAdminId = adminId as any;
  verification.rejectionReason = reason;
  verification.adminNotes = notes;
  await verification.save();
  await User.findByIdAndUpdate(verification.userId, { isVerified: false });
  return verification;
}

export async function requestTrustRetry(id: string, adminId: string, reason?: string, notes?: string) {
  const verification = await TrustVerification.findById(id);
  if (!verification) throw new HttpError(404, "Trust verification not found", ErrorCode.NOT_FOUND);
  verification.status = "NEEDS_RETRY";
  verification.faceStatus = "NEEDS_RETRY";
  verification.voiceStatus = "NEEDS_RETRY";
  verification.reviewedAt = new Date();
  verification.reviewedByAdminId = adminId as any;
  verification.rejectionReason = reason;
  verification.adminNotes = notes;
  await verification.save();
  return verification;
}

export async function suspendTrustVerification(id: string, adminId: string, reason?: string, notes?: string) {
  const verification = await TrustVerification.findById(id);
  if (!verification) throw new HttpError(404, "Trust verification not found", ErrorCode.NOT_FOUND);
  verification.status = "SUSPENDED";
  verification.verifiedBadgeEnabled = false;
  verification.creatorTrustEnabled = false;
  verification.reviewedAt = new Date();
  verification.reviewedByAdminId = adminId as any;
  verification.rejectionReason = reason;
  verification.adminNotes = notes;
  await verification.save();
  await User.findByIdAndUpdate(verification.userId, { isVerified: false });
  return verification;
}
