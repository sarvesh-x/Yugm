import { Router } from "express";
import { z } from "zod";
import { requireAuth, type AuthRequest } from "../middleware/auth.js";
import { validateBody } from "../middleware/validate.js";
import { WithdrawalRequest } from "../models/WithdrawalRequest.js";
import { assertCreatorAccess, getOrCreateCreatorPayoutKyc, publicCreatorPayoutKyc, submitCreatorPayoutKyc, updateCreatorPayoutKyc } from "../services/creatorPayoutKyc.js";
import { creatorEarningBalance, createWithdrawalRequest, publicWithdrawal } from "../services/withdrawal.js";
import { publicPayoutReview } from "../services/payoutReview.js";
import { asyncHandler, sendOk } from "../utils/http.js";

export const creatorRouter = Router();
creatorRouter.use(requireAuth);

const payoutKycSchema = z.object({
  legalFullName: z.string().min(2).max(160),
  dateOfBirth: z.string().optional(),
  panNumber: z.string().min(6).max(20),
  upiId: z.string().min(3).max(120).optional(),
  bankAccount: z.string().min(6).max(40).optional(),
  bankIfsc: z.string().min(4).max(20).optional(),
  bankHolderName: z.string().min(2).max(160).optional(),
  declarationsAccepted: z.boolean()
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

creatorRouter.patch("/payout-kyc", validateBody(payoutKycSchema.partial().extend({ declarationsAccepted: z.boolean().optional() })), asyncHandler(async (req: AuthRequest, res) => {
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
  const [kyc, balance] = await Promise.all([
    getOrCreateCreatorPayoutKyc(req.user!.id),
    creatorEarningBalance(req.user!.id)
  ]);
  sendOk(res, {
    balance,
    payoutKyc: publicCreatorPayoutKyc(kyc),
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
