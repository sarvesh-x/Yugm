import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";
import { TrustVerification } from "../models/TrustVerification.js";
import { assertCreatorAccess, getOrCreateCreatorPayoutKyc, publicCreatorPayoutKyc, submitCreatorPayoutKyc, updateCreatorPayoutKyc } from "../services/creatorPayoutKyc.js";
import { CREATOR_COIN_TO_INR_RATE, creatorEarningBalance, createWithdrawalRequest, publicWithdrawal } from "../services/withdrawal.js";
import { publicPayoutReview } from "../services/payoutReview.js";
import { asyncHandler, sendOk } from "../utils/http.js";

export const creatorRouter = Router();
creatorRouter.use(requireAuth);

function isAdultDateOfBirth(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
  const adultCutoff = new Date();
  adultCutoff.setUTCFullYear(adultCutoff.getUTCFullYear() - 18);
  return date <= adultCutoff;
}

const payoutKycFields = {
  legalFullName: z.string().min(2).max(160),
  dateOfBirth: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Date of birth must use YYYY-MM-DD").refine(isAdultDateOfBirth, "Creator payouts require a valid adult date of birth").optional(),
  panNumber: z.string().trim().regex(/^[A-Z]{5}[0-9]{4}[A-Z]$/i, "Enter a valid PAN"),
  upiId: z.string().trim().regex(/^[a-z0-9._-]{2,}@[a-z]{2,}$/i, "Enter a valid UPI ID").max(120).optional(),
  bankAccount: z.string().trim().regex(/^\d{6,40}$/, "Enter a valid bank account number").optional(),
  bankIfsc: z.string().trim().regex(/^[A-Z]{4}0[A-Z0-9]{6}$/i, "Enter a valid IFSC").optional(),
  bankHolderName: z.string().min(2).max(160).optional(),
  declarationsAccepted: z.boolean()
};

const payoutKycSchema = z.object(payoutKycFields).superRefine((value, context) => {
  if (!value.upiId && !value.bankAccount) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["upiId"], message: "Submit UPI or bank account details" });
  }
  if (value.bankAccount && (!value.bankIfsc || !value.bankHolderName)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["bankAccount"], message: "IFSC and account holder name are required with a bank account" });
  }
});

const withdrawalSchema = z.object({
  amountCoins: z.number().int().min(1)
});

creatorRouter.get("/payout-kyc", asyncHandler(async (req: AuthRequest, res) => {
  await assertCreatorAccess(req.user!);
  const kyc = await getOrCreateCreatorPayoutKyc(req.user!.id);
  sendOk(res, {
    title: "Creator Payout Verification",
    tagline: "Required only when you withdraw real money earned from gifts.",
    kyc: publicCreatorPayoutKyc(kyc)
  });
}));

creatorRouter.post("/payout-kyc/submit", validateBody(payoutKycSchema), asyncHandler(async (req: AuthRequest, res) => {
  const kyc = await submitCreatorPayoutKyc(req.user!.id, req.body);
  sendOk(res, { kyc: publicCreatorPayoutKyc(kyc) }, 201);
}));

creatorRouter.patch("/payout-kyc", validateBody(z.object(payoutKycFields).partial()), asyncHandler(async (req: AuthRequest, res) => {
  const kyc = await updateCreatorPayoutKyc(req.user!.id, req.body);
  sendOk(res, { kyc: publicCreatorPayoutKyc(kyc) });
}));

creatorRouter.get("/payout-kyc/status", asyncHandler(async (req: AuthRequest, res) => {
  await assertCreatorAccess(req.user!);
  const kyc = await getOrCreateCreatorPayoutKyc(req.user!.id);
  sendOk(res, { kyc: publicCreatorPayoutKyc(kyc) });
}));

creatorRouter.get("/withdrawals/eligibility", asyncHandler(async (req: AuthRequest, res) => {
  await assertCreatorAccess(req.user!);
  const [kyc, balance, trust] = await Promise.all([
    getOrCreateCreatorPayoutKyc(req.user!.id),
    creatorEarningBalance(req.user!.id),
    TrustVerification.findOne({ userId: req.user!.id }).select("status creatorTrustEnabled").lean()
  ]);
  sendOk(res, {
    balance,
    payoutKyc: publicCreatorPayoutKyc(kyc),
    coinToInrRate: CREATOR_COIN_TO_INR_RATE,
    requirements: {
      creatorAccount: true,
      trustVerified: trust?.status === "VERIFIED",
      creatorTrustEnabled: Boolean(trust?.creatorTrustEnabled),
      payoutKycVerified: kyc.kycStatus === "VERIFIED",
      payoutEnabled: kyc.payoutStatus === "ENABLED"
    },
    wording: {
      trust: "Yugm Trust Verification",
      payout: "Creator Payout Verification"
    }
  });
}));

creatorRouter.post("/withdrawals", validateBody(withdrawalSchema), asyncHandler(async (req: AuthRequest, res) => {
  const result = await createWithdrawalRequest(req.user!.id, req.body.amountCoins);
  sendOk(res, {
    message: result.message,
    withdrawal: publicWithdrawal(result.withdrawal),
    payoutReview: publicPayoutReview(result.review),
    balance: result.balance
  }, result.review.status === "NEEDS_MANUAL_REVIEW" ? 202 : 201);
}));

creatorRouter.get("/withdrawals", asyncHandler(async (req: AuthRequest, res) => {
  await assertCreatorAccess(req.user!);
  const withdrawals = await WithdrawalRequest.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50).lean();
  sendOk(res, { withdrawals: withdrawals.map(publicWithdrawal), balance: await creatorEarningBalance(req.user!.id) });
}));
