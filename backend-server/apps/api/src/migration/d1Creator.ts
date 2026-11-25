import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId } from "./d1Cosmetics.js";

export const CREATOR_COIN_TO_INR_RATE = 0.01;
const activeWithdrawalStatuses = ["PENDING_REVIEW", "APPROVED"] as const;

const withdrawalRequestSchema = z.object({
  amountCoins: z.number().int().min(100).max(5_000_000)
});

function isAdultDateOfBirth(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const adultCutoff = new Date();
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  return date <= adultCutoff;
}

const payoutKycSubmitSchema = z.object({
  legalFullName: z.string().min(2).max(120),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isAdultDateOfBirth, "Creator payout KYC requires an adult date of birth"),
  panNumber: z.string().regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, "Enter a valid PAN number"),
  upiId: z.string().min(3).max(120).optional(),
  bankAccount: z.string().min(6).max(32).optional(),
  bankIfsc: z.string().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, "Enter a valid IFSC code").optional(),
  bankHolderName: z.string().min(2).max(120).optional(),
  declarationsAccepted: z.literal(true)
}).refine((value) => value.upiId || (value.bankAccount && value.bankIfsc && value.bankHolderName), {
  message: "Provide UPI details or complete bank account details"
});

const payoutKycUpdateSchema = z.object({
  legalFullName: z.string().min(2).max(120).optional(),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(isAdultDateOfBirth, "Creator payout KYC requires an adult date of birth").optional(),
  panNumber: z.string().regex(/^[A-Za-z]{5}[0-9]{4}[A-Za-z]$/, "Enter a valid PAN number").optional(),
  upiId: z.string().min(3).max(120).optional(),
  bankAccount: z.string().min(6).max(32).optional(),
  bankIfsc: z.string().regex(/^[A-Za-z]{4}0[A-Za-z0-9]{6}$/, "Enter a valid IFSC code").optional(),
  bankHolderName: z.string().min(2).max(120).optional(),
  declarationsAccepted: z.boolean().optional()
}).refine((value) => Object.keys(value).length > 0, { message: "No changes provided" });

type KycRow = Record<string, string | number | null>;
type WithdrawalRow = Record<string, string | number | null>;

function isCreatorUser(role?: string | null) {
  return role === "HOST" || role === "MODERATOR" || role === "ADMIN";
}

function keyFromSecret(secret: string) {
  return createHash("sha256").update(secret).digest();
}

function encryptSensitiveField(secret: string, value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(normalized, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(".");
}

function last4(value?: string | null) {
  const compact = value?.replace(/\s+/g, "") ?? "";
  return compact.length >= 4 ? compact.slice(-4) : undefined;
}

function maskUpi(value?: string | null) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const [name, domain] = normalized.split("@");
  if (!name || !domain) return "***";
  const prefix = name.slice(0, Math.min(2, name.length));
  return `${prefix}${"*".repeat(Math.max(3, name.length - prefix.length))}@${domain}`;
}

function publicCreatorPayoutKyc(kyc: KycRow | null, userId: string, sensitiveAccessGranted = false) {
  return {
    id: (kyc?.source_id as string | undefined) ?? null,
    userId,
    legalFullName: kyc?.legal_full_name ?? null,
    dateOfBirth: kyc?.date_of_birth ?? null,
    panLast4: kyc?.pan_last4 ?? null,
    panVerified: Boolean(kyc?.pan_verified),
    upiIdMasked: kyc?.upi_id_masked ?? null,
    bankAccountLast4: kyc?.bank_account_last4 ?? null,
    bankIfsc: kyc?.bank_ifsc ?? null,
    bankHolderName: kyc?.bank_holder_name ?? null,
    kycStatus: kyc?.kyc_status ?? "NOT_SUBMITTED",
    payoutStatus: kyc?.payout_status ?? "DISABLED",
    submittedAt: kyc?.submitted_at ?? null,
    verifiedAt: kyc?.verified_at ?? null,
    rejectedAt: kyc?.rejected_at ?? null,
    rejectionReason: kyc?.rejection_reason ?? null,
    adminNotes: kyc?.admin_notes ?? null,
    sensitiveAccessGranted,
    sensitiveFieldsMasked: true
  };
}

function publicWithdrawal(row: WithdrawalRow) {
  return {
    id: row.source_id,
    userId: row.user_id,
    amountCoins: row.amount_coins ?? 0,
    amountInr: row.amount_inr ?? 0,
    status: row.status ?? "PENDING_REVIEW",
    lockedAt: row.locked_at ?? null,
    approvedAt: row.approved_at ?? null,
    rejectedAt: row.rejected_at ?? null,
    paidAt: row.paid_at ?? null,
    rejectionReason: row.rejection_reason ?? null,
    payoutReference: row.payout_reference ?? null,
    createdAt: row.created_at ?? null
  };
}

function publicPayoutReview(row: Row | null) {
  if (!row) return null;
  return {
    id: row.source_id,
    userId: row.user_id,
    withdrawalRequestId: row.withdrawal_request_id,
    trustVerificationId: row.trust_verification_id ?? null,
    creatorPayoutKycId: row.creator_payout_kyc_id ?? null,
    status: row.status ?? "PENDING",
    trustVerified: Boolean(row.trust_verified),
    kycVerified: Boolean(row.kyc_verified),
    walletSafe: Boolean(row.wallet_safe),
    reportsSafe: Boolean(row.reports_safe),
    fraudSafe: Boolean(row.fraud_safe),
    riskScore: row.risk_score ?? null,
    riskFlags: JSON.parse(String(row.risk_flags ?? "[]")),
    adminNotes: row.admin_notes ?? null,
    rejectionReason: row.rejection_reason ?? null,
    reviewedAt: row.reviewed_at ?? null,
    createdAt: row.created_at ?? null
  };
}

async function getKyc(db: D1Database, userId: string) {
  return db.prepare("SELECT * FROM creator_payout_kycs WHERE user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 1")
    .bind(userId).first<KycRow>();
}

async function ensureKyc(db: D1Database, userId: string) {
  const existing = await getKyc(db, userId);
  if (existing) return existing;
  const id = newId();
  const now = new Date().toISOString();
  await db.prepare(`INSERT INTO creator_payout_kycs
    (source_id, user_id, pan_verified, kyc_status, payout_status, metadata, created_at, updated_at)
    VALUES (?, ?, 0, 'NOT_SUBMITTED', 'DISABLED', '{}', ?, ?)`)
    .bind(id, userId, now, now).run();
  return getKyc(db, userId);
}

async function creatorEarningBalance(db: D1Database, userId: string) {
  const row = await db.prepare(`SELECT
    COALESCE((SELECT SUM(coin_amount) FROM gift_transactions WHERE receiver_id = ?1), 0) AS earned,
    COALESCE((SELECT SUM(amount_coins) FROM withdrawal_requests WHERE user_id = ?1 AND status IN ('PENDING_REVIEW','APPROVED','PAID')), 0) AS deducted,
    COALESCE((SELECT SUM(amount_coins) FROM withdrawal_requests WHERE user_id = ?1 AND status IN ('PENDING_REVIEW','APPROVED')), 0) AS locked,
    COALESCE((SELECT SUM(amount_coins) FROM withdrawal_requests WHERE user_id = ?1 AND status = 'PAID'), 0) AS withdrawn
  `).bind(userId).first<{ earned: number; deducted: number; locked: number; withdrawn: number }>();
  const earnedCoins = Number(row?.earned ?? 0);
  const deductedCoins = Number(row?.deducted ?? 0);
  const lockedCoins = Number(row?.locked ?? 0);
  const withdrawnCoins = Number(row?.withdrawn ?? 0);
  return {
    earnedCoins,
    lockedCoins,
    withdrawnCoins,
    availableCoins: Math.max(0, earnedCoins - deductedCoins)
  };
}

async function runFraudChecks(db: D1Database, userId: string, amountCoins: number) {
  const now = Date.now();
  const weekAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
  const [user, reports, gifts, pendingWithdrawals] = await Promise.all([
    db.prepare("SELECT is_blocked, suspended_until, moderation_strikes FROM users WHERE source_id = ?").bind(userId)
      .first<{ is_blocked: number; suspended_until: string | null; moderation_strikes: number | null }>(),
    db.prepare("SELECT COUNT(*) AS count FROM reports WHERE target_user_id = ? AND status = 'PENDING'").bind(userId).first<{ count: number }>(),
    db.prepare("SELECT COALESCE(SUM(coin_amount),0) AS total FROM gift_transactions WHERE receiver_id = ? AND created_at >= ?")
      .bind(userId, weekAgo).first<{ total: number }>(),
    db.prepare("SELECT COUNT(*) AS count FROM withdrawal_requests WHERE user_id = ? AND status = 'PENDING_REVIEW'")
      .bind(userId).first<{ count: number }>()
  ]);
  const flags: string[] = [];
  let riskScore = 0;
  if (!user || user.is_blocked) { flags.push("USER_BLOCKED"); riskScore += 100; }
  if (user?.suspended_until && Date.parse(user.suspended_until) > now) { flags.push("USER_SUSPENDED"); riskScore += 80; }
  if ((user?.moderation_strikes ?? 0) >= 3) { flags.push("MODERATION_STRIKES"); riskScore += 30; }
  const pendingReports = Number(reports?.count ?? 0);
  if (pendingReports > 0) { flags.push("PENDING_REPORTS"); riskScore += Math.min(40, pendingReports * 10); }
  const pendingW = Number(pendingWithdrawals?.count ?? 0);
  if (pendingW > 0) { flags.push("PENDING_WITHDRAWAL_EXISTS"); riskScore += 25; }
  const recentGiftTotal = Number(gifts?.total ?? 0);
  if (amountCoins > Math.max(1000, recentGiftTotal * 0.9)) { flags.push("HIGH_WITHDRAWAL_VS_RECENT_EARNINGS"); riskScore += 20; }
  return {
    walletSafe: !flags.includes("PENDING_WITHDRAWAL_EXISTS"),
    reportsSafe: pendingReports === 0,
    fraudSafe: riskScore < 60,
    riskScore,
    riskFlags: flags
  };
}

type Row = Record<string, string | number | null>;

export function createD1CreatorRouter(db: D1Database, options: { payoutKycEncryptionKey?: string } = {}) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: import("express").Request) => requireHttpSession(req.headers.authorization, access);
  const encryptionKey = options.payoutKycEncryptionKey;

  const requireCreator = async (userId: string) => {
    const user = await db.prepare("SELECT role FROM users WHERE source_id = ?").bind(userId).first<{ role: string | null }>();
    if (!user || !isCreatorUser(user.role)) {
      throw new HttpError(403, "Creator Payout Verification is available only for creators or hosts", ErrorCode.FORBIDDEN);
    }
    return user;
  };

  router.get("/payout-kyc", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    await requireCreator(user.id);
    const kyc = await ensureKyc(db, user.id);
    sendOk(res, { kyc: publicCreatorPayoutKyc(kyc, user.id) });
  }));

  router.get("/payout-kyc/status", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    await requireCreator(user.id);
    const kyc = await getKyc(db, user.id);
    sendOk(res, {
      kycStatus: kyc?.kyc_status ?? "NOT_SUBMITTED",
      payoutStatus: kyc?.payout_status ?? "DISABLED",
      panVerified: Boolean(kyc?.pan_verified),
      submittedAt: kyc?.submitted_at ?? null,
      verifiedAt: kyc?.verified_at ?? null,
      rejectionReason: kyc?.rejection_reason ?? null
    });
  }));

  router.patch("/payout-kyc", asyncHandler(async (req, res, next) => {
    res.locals.creatorSession = await authenticate(req);
    next();
  }), validateBody(payoutKycUpdateSchema), asyncHandler(async (req, res) => {
    const { user } = res.locals.creatorSession as Awaited<ReturnType<typeof authenticate>>;
    await requireCreator(user.id);
    if (!encryptionKey) throw new HttpError(503, "Payout KYC encryption is unavailable", ErrorCode.INTERNAL);
    const input = req.body as z.infer<typeof payoutKycUpdateSchema>;
    const existing = await ensureKyc(db, user.id);
    const now = new Date().toISOString();
    const metadata = (() => {
      try { return JSON.parse(String(existing?.metadata ?? "{}")); } catch { return {}; }
    })();
    const nextMetadata = {
      ...metadata,
      declarationsAccepted: input.declarationsAccepted ?? metadata.declarationsAccepted ?? true,
      updatedAt: now
    };
    const updated = {
      legal_full_name: input.legalFullName !== undefined ? input.legalFullName.trim() : (existing?.legal_full_name ?? null),
      date_of_birth: input.dateOfBirth !== undefined ? input.dateOfBirth : (existing?.date_of_birth ?? null),
      pan_number_encrypted: input.panNumber !== undefined ? encryptSensitiveField(encryptionKey, input.panNumber) : (existing?.pan_number_encrypted ?? null),
      pan_last4: input.panNumber !== undefined ? last4(input.panNumber) : (existing?.pan_last4 ?? null),
      pan_verified: input.panNumber !== undefined ? 0 : (existing?.pan_verified ?? 0),
      upi_id_encrypted: input.upiId !== undefined ? encryptSensitiveField(encryptionKey, input.upiId) : (existing?.upi_id_encrypted ?? null),
      upi_id_masked: input.upiId !== undefined ? maskUpi(input.upiId) : (existing?.upi_id_masked ?? null),
      bank_account_encrypted: input.bankAccount !== undefined ? encryptSensitiveField(encryptionKey, input.bankAccount) : (existing?.bank_account_encrypted ?? null),
      bank_account_last4: input.bankAccount !== undefined ? last4(input.bankAccount) : (existing?.bank_account_last4 ?? null),
      bank_ifsc: input.bankIfsc !== undefined ? input.bankIfsc.trim().toUpperCase() : (existing?.bank_ifsc ?? null),
      bank_holder_name: input.bankHolderName !== undefined ? input.bankHolderName.trim() : (existing?.bank_holder_name ?? null),
    };
    await db.prepare(`UPDATE creator_payout_kycs SET
      legal_full_name = ?, date_of_birth = ?, pan_number_encrypted = ?, pan_last4 = ?, pan_verified = ?,
      upi_id_encrypted = ?, upi_id_masked = ?, bank_account_encrypted = ?, bank_account_last4 = ?,
      bank_ifsc = ?, bank_holder_name = ?, kyc_status = 'PENDING', payout_status = 'MANUAL_REVIEW',
      submitted_at = ?, rejected_at = NULL, rejection_reason = NULL, metadata = ?, updated_at = ?
      WHERE source_id = ?`).bind(
      updated.legal_full_name, updated.date_of_birth, updated.pan_number_encrypted, updated.pan_last4, updated.pan_verified,
      updated.upi_id_encrypted, updated.upi_id_masked, updated.bank_account_encrypted, updated.bank_account_last4,
      updated.bank_ifsc, updated.bank_holder_name, now, JSON.stringify(nextMetadata), now, existing!.source_id
    ).run();
    const kyc = await getKyc(db, user.id);
    sendOk(res, { kyc: publicCreatorPayoutKyc(kyc, user.id) });
  }));

  router.post("/payout-kyc/submit", asyncHandler(async (req, res, next) => {
    res.locals.creatorSession = await authenticate(req);
    next();
  }), validateBody(payoutKycSubmitSchema), asyncHandler(async (req, res) => {
    const { user } = res.locals.creatorSession as Awaited<ReturnType<typeof authenticate>>;
    await requireCreator(user.id);
    if (!encryptionKey) throw new HttpError(503, "Payout KYC encryption is unavailable", ErrorCode.INTERNAL);
    const input = req.body as z.infer<typeof payoutKycSubmitSchema>;
    if (!input.declarationsAccepted) throw new HttpError(400, "Accept payout declarations before submitting", ErrorCode.VALIDATION);
    if (!input.legalFullName?.trim()) throw new HttpError(400, "Legal full name is required", ErrorCode.VALIDATION);
    if (!input.panNumber?.trim()) throw new HttpError(400, "PAN is required for Creator Payout Verification", ErrorCode.VALIDATION);
    if (!input.upiId?.trim() && !input.bankAccount?.trim()) throw new HttpError(400, "Submit UPI or bank account details", ErrorCode.VALIDATION);

    const existing = await ensureKyc(db, user.id);
    const now = new Date().toISOString();
    const metadata = (() => { try { return JSON.parse(String(existing?.metadata ?? "{}")); } catch { return {}; } })();
    await db.prepare(`UPDATE creator_payout_kycs SET
      legal_full_name = ?, date_of_birth = ?, pan_number_encrypted = ?, pan_last4 = ?,
      upi_id_encrypted = ?, upi_id_masked = ?, bank_account_encrypted = ?, bank_account_last4 = ?,
      bank_ifsc = ?, bank_holder_name = ?, kyc_status = 'PENDING', payout_status = 'MANUAL_REVIEW',
      submitted_at = ?, rejected_at = NULL, rejection_reason = NULL,
      metadata = ?, updated_at = ?
      WHERE source_id = ?`).bind(
      input.legalFullName.trim(),
      input.dateOfBirth ? input.dateOfBirth : (existing?.date_of_birth ?? null),
      encryptSensitiveField(encryptionKey, input.panNumber),
      last4(input.panNumber),
      input.upiId ? encryptSensitiveField(encryptionKey, input.upiId) : (existing?.upi_id_encrypted ?? null),
      input.upiId ? maskUpi(input.upiId) : (existing?.upi_id_masked ?? null),
      input.bankAccount ? encryptSensitiveField(encryptionKey, input.bankAccount) : (existing?.bank_account_encrypted ?? null),
      input.bankAccount ? last4(input.bankAccount) : (existing?.bank_account_last4 ?? null),
      input.bankIfsc?.trim().toUpperCase() ?? (existing?.bank_ifsc ?? null),
      input.bankHolderName?.trim() ?? (existing?.bank_holder_name ?? null),
      now, JSON.stringify({ ...metadata, declarationsAccepted: true, declarationsAcceptedAt: now }), now, existing!.source_id
    ).run();
    const kyc = await getKyc(db, user.id);
    sendOk(res, { kyc: publicCreatorPayoutKyc(kyc, user.id) });
  }));

  router.get("/withdrawals/eligibility", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const dbUser = await db.prepare("SELECT role, is_blocked, suspended_until FROM users WHERE source_id = ?").bind(user.id)
      .first<{ role: string | null; is_blocked: number; suspended_until: string | null }>();
    if (!dbUser || !isCreatorUser(dbUser.role)) {
      throw new HttpError(403, "Withdrawals are available only to creators or hosts", ErrorCode.FORBIDDEN);
    }
    const [trust, kyc, balance] = await Promise.all([
      db.prepare("SELECT status, creator_trust_enabled FROM trust_verifications WHERE user_id = ? LIMIT 1").bind(user.id)
        .first<{ status: string; creator_trust_enabled: number }>(),
      getKyc(db, user.id),
      creatorEarningBalance(db, user.id)
    ]);
    const blocked = Boolean(dbUser.is_blocked) || (dbUser.suspended_until ? Date.parse(dbUser.suspended_until) > Date.now() : false);
    const trustOk = trust?.status === "VERIFIED" && Boolean(trust.creator_trust_enabled);
    const kycOk = kyc?.kyc_status === "VERIFIED" && kyc?.payout_status === "ENABLED";
    const reasons: string[] = [];
    if (blocked) reasons.push("Account is restricted");
    if (!trustOk) reasons.push("Complete Yugm Trust Verification");
    if (!kycOk) reasons.push("Complete Creator Payout KYC");
    sendOk(res, {
      eligible: !blocked && trustOk && kycOk,
      reasons,
      balance,
      trustStatus: trust?.status ?? "NOT_STARTED",
      kycStatus: kyc?.kyc_status ?? "NOT_SUBMITTED",
      payoutStatus: kyc?.payout_status ?? "DISABLED"
    });
  }));

  router.get("/withdrawals", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    await requireCreator(user.id);
    const [withdrawals, balance] = await Promise.all([
      db.prepare("SELECT * FROM withdrawal_requests WHERE user_id = ? ORDER BY created_at DESC, source_id DESC LIMIT 50")
        .bind(user.id).all<WithdrawalRow>(),
      creatorEarningBalance(db, user.id)
    ]);
    sendOk(res, { withdrawals: withdrawals.results.map(publicWithdrawal), balance });
  }));

  router.post("/withdrawals", asyncHandler(async (req, res, next) => {
    res.locals.creatorSession = await authenticate(req);
    next();
  }), validateBody(withdrawalRequestSchema), asyncHandler(async (req, res) => {
    const { user } = res.locals.creatorSession as Awaited<ReturnType<typeof authenticate>>;
    const input = req.body as z.infer<typeof withdrawalRequestSchema>;
    const dbUser = await db.prepare("SELECT role, is_blocked, suspended_until FROM users WHERE source_id = ?").bind(user.id)
      .first<{ role: string | null; is_blocked: number; suspended_until: string | null }>();
    if (!dbUser) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    if (!isCreatorUser(dbUser.role)) {
      throw new HttpError(403, "Withdrawals are available only to creators or hosts", ErrorCode.FORBIDDEN);
    }
    if (dbUser.is_blocked || (dbUser.suspended_until && Date.parse(dbUser.suspended_until) > Date.now())) {
      throw new HttpError(403, "Your wallet is temporarily restricted.", ErrorCode.FORBIDDEN);
    }

    const trust = await db.prepare("SELECT source_id, status, creator_trust_enabled FROM trust_verifications WHERE user_id = ? LIMIT 1")
      .bind(user.id).first<{ source_id: string; status: string; creator_trust_enabled: number }>();
    if (!trust || trust.status !== "VERIFIED" || !trust.creator_trust_enabled) {
      throw new HttpError(403, "Complete Yugm Trust Verification before withdrawing.", ErrorCode.FORBIDDEN);
    }

    const kyc = await getKyc(db, user.id);
    if (!kyc || kyc.kyc_status === "NOT_SUBMITTED") {
      throw new HttpError(403, "Complete Creator Payout KYC before withdrawing.", ErrorCode.FORBIDDEN);
    }
    if (kyc.kyc_status === "PENDING" || kyc.kyc_status === "MANUAL_REVIEW") {
      throw new HttpError(409, "Your payout KYC is under review.", ErrorCode.CONFLICT);
    }
    if (kyc.kyc_status !== "VERIFIED" || kyc.payout_status !== "ENABLED") {
      throw new HttpError(403, kyc.payout_status === "FROZEN" ? "Your wallet is temporarily restricted." : "Complete Creator Payout KYC before withdrawing.", ErrorCode.FORBIDDEN);
    }

    const existingActive = await db.prepare(
      "SELECT 1 AS ok FROM withdrawal_requests WHERE user_id = ? AND (active_lock = 1 OR status IN ('PENDING_REVIEW','APPROVED')) LIMIT 1"
    ).bind(user.id).first();
    if (existingActive) {
      throw new HttpError(409, "Complete the active withdrawal before requesting another.", ErrorCode.CONFLICT);
    }

    const balance = await creatorEarningBalance(db, user.id);
    if (input.amountCoins > balance.availableCoins) throw new HttpError(402, "Insufficient creator earning balance", ErrorCode.INSUFFICIENT_FUNDS);

    const fraud = await runFraudChecks(db, user.id, input.amountCoins);
    const reviewStatus = fraud.fraudSafe && fraud.walletSafe && fraud.reportsSafe ? "PENDING" : "NEEDS_MANUAL_REVIEW";
    const withdrawalId = newId();
    const reviewId = newId();
    const now = new Date().toISOString();
    const amountInr = Math.round(input.amountCoins * CREATOR_COIN_TO_INR_RATE * 100) / 100;

    // Guard against concurrent active withdrawals; D1 schema lacks the Mongo partial unique index.
    const batch = await db.batch([
      db.prepare(`INSERT INTO withdrawal_requests
        (source_id, user_id, amount_coins, amount_inr, status, active_lock, locked_at, metadata, created_at, updated_at)
        SELECT ?, ?, ?, ?, 'PENDING_REVIEW', 1, ?, ?, ?, ?
        WHERE NOT EXISTS (
          SELECT 1 FROM withdrawal_requests WHERE user_id = ? AND (active_lock = 1 OR status IN ('PENDING_REVIEW','APPROVED'))
        )`).bind(withdrawalId, user.id, input.amountCoins, amountInr, now, JSON.stringify({ coinToInrRate: CREATOR_COIN_TO_INR_RATE }), now, now, user.id),
      db.prepare(`INSERT INTO payout_reviews
        (source_id, user_id, withdrawal_request_id, trust_verification_id, creator_payout_kyc_id, status,
         trust_verified, kyc_verified, wallet_safe, reports_safe, fraud_safe, risk_score, risk_flags, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, ?, 1, 1, ?, ?, ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM withdrawal_requests WHERE source_id = ? AND user_id = ? AND status = 'PENDING_REVIEW')`)
        .bind(reviewId, user.id, withdrawalId, trust.source_id, kyc.source_id, reviewStatus,
          fraud.walletSafe ? 1 : 0, fraud.reportsSafe ? 1 : 0, fraud.fraudSafe ? 1 : 0,
          fraud.riskScore, JSON.stringify(fraud.riskFlags), now, now, withdrawalId, user.id)
    ]);
    const insertedWithdrawal = Number(batch[0]?.meta?.changes ?? 0);
    const insertedReview = Number(batch[1]?.meta?.changes ?? 0);
    if (!insertedWithdrawal) {
      throw new HttpError(409, "Complete the active withdrawal before requesting another.", ErrorCode.CONFLICT);
    }
    if (!insertedReview) {
      // Roll back the reservation if review insert didn't happen.
      await db.prepare("UPDATE withdrawal_requests SET status = 'CANCELLED', active_lock = 0, rejection_reason = ?, updated_at = ? WHERE source_id = ? AND status = 'PENDING_REVIEW'")
        .bind("Withdrawal review creation failed", new Date().toISOString(), withdrawalId).run();
      throw new HttpError(500, "Failed to create payout review", ErrorCode.INTERNAL);
    }

    const [withdrawal, review, nextBalance] = await Promise.all([
      db.prepare("SELECT * FROM withdrawal_requests WHERE source_id = ?").bind(withdrawalId).first<WithdrawalRow>(),
      db.prepare("SELECT * FROM payout_reviews WHERE source_id = ?").bind(reviewId).first<Row>(),
      creatorEarningBalance(db, user.id)
    ]);
    sendOk(res, {
      withdrawal: withdrawal ? publicWithdrawal(withdrawal) : null,
      review: publicPayoutReview(review),
      balance: nextBalance,
      message: reviewStatus === "NEEDS_MANUAL_REVIEW" ? "Your withdrawal needs manual review." : "Withdrawal sent to finance review."
    }, 201);
  }));

  return router;
}
