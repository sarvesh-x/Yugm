import { z } from "zod";

export const TRUST_CONSENT_VERSION = "trust-verification-v1";

const voicePrompts = [
  "My name is on Yugm, and I am verifying that I am a real person.",
  "I am completing Yugm Trust Verification to show people I am real.",
  "This is my real voice for Yugm Trust Verification."
];

export const consentSchema = z.object({
  consentVersion: z.string().min(3).max(80).optional()
});

export const faceSchema = z.object({
  selfieImageUrl: z.string().url().optional(),
  selfieVideoUrl: z.string().url().optional(),
  livenessVideoUrl: z.string().url().optional(),
  provider: z.string().max(80).optional(),
  providerReferenceId: z.string().max(160).optional(),
  providerResponse: z.unknown().optional()
});

export const voiceSchema = z.object({
  audioUrl: z.string().url(),
  transcriptText: z.string().max(2000).optional(),
  promptText: z.string().min(8).max(500),
  provider: z.string().max(80).optional(),
  providerReferenceId: z.string().max(160).optional(),
  providerResponse: z.unknown().optional()
});

export type TrustConsentInput = z.infer<typeof consentSchema>;
export type TrustFaceInput = z.infer<typeof faceSchema>;
export type TrustVoiceInput = z.infer<typeof voiceSchema>;

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

export function nextVoicePrompt() {
  return voicePrompts[Math.floor(Math.random() * voicePrompts.length)];
}
