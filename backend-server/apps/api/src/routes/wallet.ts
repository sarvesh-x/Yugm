import { Router } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { coinPacks, cosmeticBundles, createPurchaseOrderSchema, equipProfileCosmeticSchema, purchaseCosmeticBundleSchema, purchaseProfileCosmeticSchema, purchaseVipSchema, sendGiftSchema, socketEvents, transferCosmeticSchema, verifyGooglePlayPurchaseSchema, verifyRazorpayPurchaseSchema, vipPlans, walletSourceLabels } from "@yugm/shared";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { requireWalletNotFrozen } from "../middleware/requireSafety.js";
import { validateBody } from "../middleware/validate.js";
import { Gift } from "../models/Gift.js";
import { GiftTransaction } from "../models/GiftTransaction.js";
import { Purchase } from "../models/Purchase.js";
import { Room } from "../models/Room.js";
import { RoomActivity } from "../models/RoomActivity.js";
import { RoomParticipant } from "../models/RoomParticipant.js";
import { User } from "../models/User.js";
import { WalletTransaction } from "../models/WalletTransaction.js";
import { creditWallet, debitWallet, creatorShare, platformFee } from "../services/wallet.js";
import { emitRoom, emitUser } from "../services/socket.js";
import { createNotification } from "../services/notifications.js";
import { consumeGooglePlayProduct, createRazorpayOrder, fetchRazorpayPayment, verifyGooglePlayProduct, verifyRazorpaySignature } from "../services/payments.js";
import { asyncHandler, sendOk, HttpError, ErrorCode, isValidObjectId } from "../utils/http.js";
import { env } from "../config/env.js";
import { getCachedJson, setCachedJson } from "../services/redis.js";
import { addVipDays, findVipPlan, getVipStatus } from "../services/vip.js";
import { activeCosmeticKey, ensureDefaultCosmetics, findProfileCosmetic, listPublicCosmetics, toPublicCosmetic } from "../services/cosmetics.js";
import { getLevelStatus, grantXp } from "../services/levels.js";
import { grantRelationshipXp } from "../services/relationships.js";
import { assertUsersCanInteract } from "../services/safety.js";

export const walletRouter = Router();
walletRouter.use(requireAuth);

const adminWalletAdjustSchema = z.object({
  userId: z.string().regex(/^[0-9a-fA-F]{24}$/, "Invalid userId format"),
  amount: z.number().int().min(1).max(100000),
  direction: z.enum(["CREDIT", "DEBIT"]).default("CREDIT"),
  reason: z.string().min(2).max(160)
});

function findCoinPack(packId: string) {
  const pack = coinPacks.find((item) => item.id === packId);
  if (!pack) throw new HttpError(400, "Invalid coin pack", ErrorCode.VALIDATION);
  return pack;
}

async function runWalletSideEffect<T>(label: string, task: () => Promise<T>) {
  try {
    return await task();
  } catch (error) {
    console.warn(`Wallet side effect failed (${label}, non-fatal):`, error instanceof Error ? error.message : String(error));
    return undefined;
  }
}

async function creditPurchase(purchaseId: string, userId: string, metadata: Record<string, unknown>) {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const purchase = await Purchase.findOneAndUpdate(
      { _id: purchaseId, userId, status: { $ne: "CREDITED" } },
      { $set: { status: "CREDITED", creditedAt: new Date() }, $setOnInsert: {} },
      { new: true, session }
    );
    if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
    purchase.metadata = { ...purchase.metadata, ...metadata };
    const tx = await creditWallet(userId, purchase.coinAmount, `${purchase.provider}_PURCHASE`, {
      purchaseId: purchase._id.toString(),
      packId: purchase.packId,
      provider: purchase.provider,
      ...metadata
    }, session);
    purchase.creditedTransactionId = tx[0]._id;
    await purchase.save({ session });
    await session.commitTransaction();
    session.endSession();
    return purchase;
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    const alreadyCredited = await Purchase.findOne({ _id: purchaseId, userId, status: "CREDITED" });
    if (alreadyCredited) return alreadyCredited;
    throw err;
  }
}

async function consumeGooglePurchaseIfNeeded(purchase: any, productId: string, purchaseToken: string) {
  if (purchase.metadata?.googleConsumedAt) return purchase;
  await consumeGooglePlayProduct({ productId, purchaseToken });
  purchase.metadata = { ...purchase.metadata, googleConsumedAt: new Date().toISOString() };
  await purchase.save();
  return purchase;
}

walletRouter.get("/gifts", asyncHandler(async (_req, res) => {
  const cached = await getCachedJson<{ gifts: unknown[] }>("gifts:list");
  if (cached) return sendOk(res, cached);
  const gifts = await Gift.find({ isActive: true }).sort({ coinPrice: 1 }).lean();
  const payload = { gifts };
  await setCachedJson("gifts:list", payload, 300);
  sendOk(res, payload);
}));

walletRouter.get("/wallet", (req: AuthRequest, res) => sendOk(res, {
  balance: req.user!.walletBalance,
  vip: getVipStatus(req.user),
  level: getLevelStatus(req.user),
  cosmetics: {
    ownedCosmeticIds: req.user!.ownedCosmeticIds ?? [],
    activeCosmetics: req.user!.activeCosmetics ?? {}
  }
}));

walletRouter.get("/wallet/transactions", asyncHandler(async (req: AuthRequest, res) => {
  const limit = Math.min(Number(req.query.limit) || 100, 200);
  const transactions = await WalletTransaction.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(limit).lean();
  sendOk(res, {
    transactions: transactions.map((transaction) => ({
      ...transaction,
      label: walletSourceLabels[transaction.source as keyof typeof walletSourceLabels] ?? transaction.source
    }))
  });
}));

walletRouter.post("/admin/wallet/adjust", requireRole("ADMIN"), validateBody(adminWalletAdjustSchema), asyncHandler(async (req: AuthRequest, res) => {
  const metadata = { reason: req.body.reason, adminId: req.user!.id };
  const [tx] = req.body.direction === "CREDIT"
    ? await creditWallet(req.body.userId, req.body.amount, "ADMIN_ADJUSTMENT", metadata)
    : await debitWallet(req.body.userId, req.body.amount, "ADMIN_ADJUSTMENT", metadata);
  const user = await User.findById(req.body.userId).select("walletBalance name username").lean();
  sendOk(res, {
    transaction: {
      ...tx.toObject(),
      label: walletSourceLabels.ADMIN_ADJUSTMENT
    },
    user
  }, 201);
}));

walletRouter.get("/wallet/packs", (_req: AuthRequest, res) => sendOk(res, { packs: coinPacks }));

walletRouter.get("/wallet/cosmetics", asyncHandler(async (req: AuthRequest, res) => {
  await ensureDefaultCosmetics();
  sendOk(res, {
    cosmetics: await listPublicCosmetics(),
    ownedCosmeticIds: req.user!.ownedCosmeticIds ?? [],
    activeCosmetics: req.user!.activeCosmetics ?? {}
  });
}));

walletRouter.post("/wallet/cosmetics/purchase", requireWalletNotFrozen, validateBody(purchaseProfileCosmeticSchema), asyncHandler(async (req: AuthRequest, res) => {
  await ensureDefaultCosmetics();
  const cosmetic = await findProfileCosmetic(req.body.cosmeticId);
  if (!cosmetic || !cosmetic.isActive) throw new HttpError(400, "Invalid profile cosmetic", ErrorCode.VALIDATION);
  if ((req.user!.ownedCosmeticIds ?? []).includes(req.body.cosmeticId)) {
    return sendOk(res, { cosmetic: toPublicCosmetic(cosmetic), ownedCosmeticIds: req.user!.ownedCosmeticIds, activeCosmetics: req.user!.activeCosmetics, balance: req.user!.walletBalance, cosmetics: await listPublicCosmetics() });
  }

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(req.user!.id, cosmetic.coinPrice, "PROFILE_COSMETIC_PURCHASE", { cosmeticId: req.body.cosmeticId, type: cosmetic.type }, session);
    const key = activeCosmeticKey(cosmetic.type);
    const update: Record<string, unknown> = { $addToSet: { ownedCosmeticIds: req.body.cosmeticId } };
    if (key) update.$set = { [`activeCosmetics.${key}`]: req.body.cosmeticId };
    await User.findByIdAndUpdate(req.user!.id, update, { session });
    await session.commitTransaction();
    session.endSession();
    const level = await runWalletSideEffect("cosmetic purchase XP", () => grantXp(req.user!.id, "COSMETIC_PURCHASE", { cosmeticId: req.body.cosmeticId }));
    const user = await User.findById(req.user!.id).select("walletBalance ownedCosmeticIds activeCosmetics xp level levelTitle lastDailyCheckInAt").lean();
    sendOk(res, { cosmetic: toPublicCosmetic(cosmetic), balance: user?.walletBalance ?? 0, ownedCosmeticIds: user?.ownedCosmeticIds ?? [], activeCosmetics: user?.activeCosmetics ?? {}, level: level?.level ?? getLevelStatus(user), cosmetics: await listPublicCosmetics() }, 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}));

walletRouter.post("/wallet/cosmetics/equip", validateBody(equipProfileCosmeticSchema), asyncHandler(async (req: AuthRequest, res) => {
  const key = activeCosmeticKey(req.body.type);
  if (!key) throw new HttpError(400, "Invalid cosmetic type", ErrorCode.VALIDATION);
  const cosmeticId = req.body.cosmeticId && typeof req.body.cosmeticId === "string" && req.body.cosmeticId.trim() !== "" ? req.body.cosmeticId.trim() : null;
  if (cosmeticId) {
    await ensureDefaultCosmetics();
    const cosmetic = await findProfileCosmetic(cosmeticId);
    if (!cosmetic || cosmetic.type !== req.body.type) throw new HttpError(400, "Cosmetic type mismatch", ErrorCode.VALIDATION);
    if (!(req.user!.ownedCosmeticIds ?? []).includes(cosmeticId)) throw new HttpError(403, "Cosmetic is not owned", ErrorCode.FORBIDDEN);
  }
  const update = cosmeticId
    ? { $set: { [`activeCosmetics.${key}`]: cosmeticId } }
    : { $unset: { [`activeCosmetics.${key}`]: "" } };
  const user = await User.findByIdAndUpdate(req.user!.id, update, { new: true }).select("ownedCosmeticIds activeCosmetics walletBalance").lean();
  sendOk(res, { ownedCosmeticIds: user?.ownedCosmeticIds ?? [], activeCosmetics: user?.activeCosmetics ?? {}, balance: user?.walletBalance ?? 0, cosmetics: await listPublicCosmetics() });
}));

walletRouter.post("/wallet/cosmetics/bundle-purchase", requireWalletNotFrozen, validateBody(purchaseCosmeticBundleSchema), asyncHandler(async (req: AuthRequest, res) => {
  await ensureDefaultCosmetics();
  const bundle = cosmeticBundles.find((b) => b.id === req.body.bundleId);
  if (!bundle) throw new HttpError(404, "Bundle not found", ErrorCode.NOT_FOUND);
  const availableIds = new Set((await listPublicCosmetics()).map((cosmetic) => cosmetic.id));
  const missing = bundle.cosmeticIds.filter((id) => !availableIds.has(id));
  if (missing.length > 0) throw new HttpError(409, "This bundle is temporarily unavailable", ErrorCode.CONFLICT);
  const alreadyOwned = bundle.cosmeticIds.filter((id) => (req.user!.ownedCosmeticIds ?? []).includes(id));
  if (alreadyOwned.length === bundle.cosmeticIds.length) throw new HttpError(409, "You already own all cosmetics in this bundle", ErrorCode.CONFLICT);
  if ((req.user!.walletBalance ?? 0) < bundle.coinPrice) throw new HttpError(403, "Insufficient balance", ErrorCode.INSUFFICIENT_FUNDS);
  const newIds = bundle.cosmeticIds.filter((id) => !(req.user!.ownedCosmeticIds ?? []).includes(id));
  await debitWallet(req.user!.id, bundle.coinPrice, "COSMETIC_BUNDLE_PURCHASE", { bundleId: bundle.id });
  const user = await User.findByIdAndUpdate(req.user!.id, { $push: { ownedCosmeticIds: { $each: newIds } } }, { new: true }).select("ownedCosmeticIds activeCosmetics walletBalance").lean();
  await grantXp(req.user!.id, "COSMETIC_PURCHASE", { bundleId: bundle.id });
  sendOk(res, { ownedCosmeticIds: user?.ownedCosmeticIds ?? [], activeCosmetics: user?.activeCosmetics ?? {}, balance: user?.walletBalance ?? 0, newCosmetics: newIds, cosmetics: await listPublicCosmetics() });
}));

walletRouter.post("/wallet/cosmetics/transfer", requireWalletNotFrozen, validateBody(transferCosmeticSchema), asyncHandler(async (req: AuthRequest, res) => {
  await ensureDefaultCosmetics();
  const cosmetic = await findProfileCosmetic(req.body.cosmeticId);
  if (!cosmetic) throw new HttpError(404, "Cosmetic not found", ErrorCode.NOT_FOUND);
  if (!(req.user!.ownedCosmeticIds ?? []).includes(req.body.cosmeticId)) throw new HttpError(403, "You don't own this cosmetic", ErrorCode.FORBIDDEN);
  const [receiver] = await Promise.all([
    User.findById(req.body.receiverId).select("_id").lean(),
    User.findByIdAndUpdate(req.user!.id, { $pull: { ownedCosmeticIds: req.body.cosmeticId }, $unset: { [`activeCosmetics.${activeCosmeticKey(cosmetic.type)}`]: "" } }).lean()
  ]);
  if (!receiver) throw new HttpError(404, "Receiver not found", ErrorCode.NOT_FOUND);
  await User.findByIdAndUpdate(req.body.receiverId, { $push: { ownedCosmeticIds: req.body.cosmeticId } });
  await createNotification(req.body.receiverId, "GIFT", "Cosmetic Gift", `${req.user!.name} gifted you ${cosmetic.name}!`, { cosmeticId: req.body.cosmeticId });
  sendOk(res, { transferred: true, cosmeticId: req.body.cosmeticId });
}));

walletRouter.get("/wallet/vip/plans", (req: AuthRequest, res) => {
  sendOk(res, { plans: vipPlans, vip: getVipStatus(req.user), balance: req.user?.walletBalance ?? 0 });
});

walletRouter.post("/wallet/vip/activate", requireWalletNotFrozen, validateBody(purchaseVipSchema), asyncHandler(async (req: AuthRequest, res) => {
  const plan = findVipPlan(req.body.planId);
  if (!plan) throw new HttpError(400, "Invalid VIP plan", ErrorCode.VALIDATION);

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const user = await User.findById(req.user!.id).session(session);
    if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);

    await debitWallet(user.id, plan.coinPrice, "VIP_PURCHASE", { planId: plan.id, durationDays: plan.durationDays }, session);
    const expiresAt = addVipDays(user, plan.durationDays);
    user.vipTier = "VIP";
    user.vipStartedAt = user.vipStartedAt ?? new Date();
    user.vipExpiresAt = expiresAt;
    await user.save({ session });

    await session.commitTransaction();
    session.endSession();

    const level = await runWalletSideEffect("VIP purchase XP", () => grantXp(user.id, "VIP_PURCHASE", { planId: plan.id }));
    const fresh = await User.findById(user.id).select("walletBalance vipTier vipStartedAt vipExpiresAt xp level levelTitle lastDailyCheckInAt").lean();
    sendOk(res, { balance: fresh?.walletBalance ?? 0, vip: getVipStatus(fresh), level: level?.level ?? getLevelStatus(fresh), plan });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}));

walletRouter.get("/wallet/purchases", asyncHandler(async (req: AuthRequest, res) => {
  const purchases = await Purchase.find({ userId: req.user!.id }).sort({ createdAt: -1 }).limit(50).lean();
  sendOk(res, { purchases });
}));

walletRouter.post("/wallet/purchases/razorpay/order", requireWalletNotFrozen, validateBody(createPurchaseOrderSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (req.body.provider !== "RAZORPAY") throw new HttpError(400, "Invalid provider", ErrorCode.VALIDATION);
  const pack = findCoinPack(req.body.packId);
  const purchase = await Purchase.create({
    userId: req.user!.id,
    provider: "RAZORPAY",
    status: "PENDING",
    packId: pack.id,
    coinAmount: pack.coinAmount,
    amountInr: pack.priceInr,
    currency: "INR"
  });
  const order = await createRazorpayOrder({
    amountInPaise: pack.priceInr * 100,
    receipt: purchase.id,
    notes: { userId: req.user!.id, packId: pack.id }
  });
  purchase.providerOrderId = order.id;
  purchase.metadata = { order };
  await purchase.save();
  sendOk(res, {
    purchase,
    order,
    checkout: {
      key: env.RAZORPAY_KEY_ID,
      amount: order.amount,
      currency: order.currency,
      orderId: order.id,
      name: "Yugm",
      description: `${pack.coinAmount} coins`
    }
  }, 201);
}));

walletRouter.post("/wallet/purchases/razorpay/verify", requireWalletNotFrozen, validateBody(verifyRazorpayPurchaseSchema), asyncHandler(async (req: AuthRequest, res) => {
  const purchase = await Purchase.findOne({ _id: req.body.purchaseId, userId: req.user!.id, provider: "RAZORPAY" });
  if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
  if (purchase.status === "CREDITED") return sendOk(res, { purchase });
  if (purchase.providerOrderId !== req.body.razorpay_order_id) throw new HttpError(400, "Order mismatch", ErrorCode.VALIDATION);
  const validSignature = verifyRazorpaySignature({
    orderId: req.body.razorpay_order_id,
    paymentId: req.body.razorpay_payment_id,
    signature: req.body.razorpay_signature
  });
  if (!validSignature) throw new HttpError(400, "Invalid Razorpay signature", ErrorCode.VALIDATION);
  const payment = await fetchRazorpayPayment(req.body.razorpay_payment_id);
  if (payment.order_id !== purchase.providerOrderId || payment.amount !== purchase.amountInr * 100 || payment.currency !== "INR") {
    throw new HttpError(400, "Razorpay payment details do not match purchase", ErrorCode.VALIDATION);
  }
  if (payment.status !== "captured") {
    purchase.status = "PAID";
    purchase.providerPaymentId = req.body.razorpay_payment_id;
    purchase.providerSignature = req.body.razorpay_signature;
    purchase.metadata = { ...purchase.metadata, payment };
    await purchase.save();
    throw new HttpError(402, "Payment is not captured yet", ErrorCode.VALIDATION);
  }
  purchase.providerPaymentId = req.body.razorpay_payment_id;
  purchase.providerSignature = req.body.razorpay_signature;
  purchase.status = "PAID";
  purchase.metadata = { ...purchase.metadata, payment };
  await purchase.save();
  const credited = await creditPurchase(purchase.id, req.user!.id, { paymentId: payment.id });
  const user = await User.findById(req.user!.id).select("walletBalance").lean();
  sendOk(res, { purchase: credited, balance: user?.walletBalance ?? 0 });
}));

walletRouter.post("/wallet/purchases/google-play/verify", requireWalletNotFrozen, validateBody(verifyGooglePlayPurchaseSchema), asyncHandler(async (req: AuthRequest, res) => {
  const pack = findCoinPack(req.body.packId);
  if (pack.googleProductId !== req.body.productId) throw new HttpError(400, "Product does not match coin pack", ErrorCode.VALIDATION);
  const existing = await Purchase.findOne({ provider: "GOOGLE_PLAY", purchaseToken: req.body.purchaseToken });
  if (existing && existing.userId.toString() !== req.user!.id) throw new HttpError(409, "Purchase token already used", ErrorCode.CONFLICT);
  if (existing?.status === "CREDITED") {
    const consumed = await consumeGooglePurchaseIfNeeded(existing, req.body.productId, req.body.purchaseToken);
    return sendOk(res, { purchase: consumed });
  }
  const product = await verifyGooglePlayProduct({ productId: req.body.productId, purchaseToken: req.body.purchaseToken });
  if (product.purchaseState !== 0) throw new HttpError(402, "Google Play purchase is not completed", ErrorCode.VALIDATION);
  const purchase = existing ?? await Purchase.create({
    userId: req.user!.id,
    provider: "GOOGLE_PLAY",
    status: "PAID",
    packId: pack.id,
    coinAmount: pack.coinAmount,
    amountInr: pack.priceInr,
    currency: "INR",
    productId: req.body.productId,
    purchaseToken: req.body.purchaseToken,
    googleOrderId: req.body.orderId ?? product.orderId,
    metadata: { product }
  });
  purchase.status = "PAID";
  purchase.productId = req.body.productId;
  purchase.purchaseToken = req.body.purchaseToken;
  purchase.googleOrderId = req.body.orderId ?? product.orderId;
  purchase.metadata = { ...purchase.metadata, product };
  await purchase.save();
  const credited = await creditPurchase(purchase.id, req.user!.id, { productId: req.body.productId, googleOrderId: purchase.googleOrderId });
  await consumeGooglePurchaseIfNeeded(credited, req.body.productId, req.body.purchaseToken);
  const user = await User.findById(req.user!.id).select("walletBalance").lean();
  sendOk(res, { purchase: credited, balance: user?.walletBalance ?? 0 });
}));

walletRouter.post("/wallet/dev-recharge", requireWalletNotFrozen, asyncHandler(async (req: AuthRequest, res) => {
  if (env.NODE_ENV !== "development") throw new HttpError(404, "Not found");
  const raw = Number(req.body.amount);
  const amount = Number.isFinite(raw) && raw > 0 ? Math.min(raw, 5000) : 500;
  await creditWallet(req.user!.id, amount, "RECHARGE", { dev: true });
  const user = await User.findById(req.user!.id).select("walletBalance").lean();
  sendOk(res, { balance: user?.walletBalance ?? 0 });
}));

walletRouter.post("/rooms/:id/send-gift", requireWalletNotFrozen, validateBody(sendGiftSchema), asyncHandler(async (req: AuthRequest, res) => {
  if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
  if (!isValidObjectId(req.body.receiverId)) throw new HttpError(400, "Invalid receiver ID", ErrorCode.VALIDATION);

  const room = await Room.findById(req.params.id).lean();
  const gift = await Gift.findOne({ _id: req.body.giftId, isActive: true }).lean();
  if (!room || !gift) throw new HttpError(404, "Room or gift not found", ErrorCode.NOT_FOUND);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  if (req.body.receiverId === req.user!.id) throw new HttpError(400, "Cannot send gifts to yourself", ErrorCode.VALIDATION);

  const receiver = await User.findById(req.body.receiverId).lean();
  if (!receiver) throw new HttpError(404, "Receiver not found", ErrorCode.NOT_FOUND);
  const [senderParticipant, receiverParticipant] = await Promise.all([
    RoomParticipant.exists({ roomId: room._id, userId: req.user!.id, leftAt: null }),
    RoomParticipant.exists({ roomId: room._id, userId: req.body.receiverId, leftAt: null })
  ]);
  if (!senderParticipant) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
  if (!receiverParticipant) throw new HttpError(400, "Receiver is not in the room", ErrorCode.VALIDATION);
  await assertUsersCanInteract(req.user!.id, req.body.receiverId, "Cannot send gifts to this user");

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(req.user!.id, gift.coinPrice, "GIFT_SENT", { roomId: room._id.toString(), giftId: gift._id.toString() }, session);
    const receiverCredit = creatorShare(gift.coinPrice);
    await creditWallet(req.body.receiverId, receiverCredit, "GIFT_RECEIVED", { roomId: room._id.toString(), giftId: gift._id.toString(), senderId: req.user!.id, platformFee: platformFee(gift.coinPrice) }, session);
    const giftTransaction = await GiftTransaction.create([{
      roomId: room._id,
      senderId: req.user!.id,
      receiverId: req.body.receiverId,
      giftId: gift._id,
      coinAmount: gift.coinPrice
    }], { session });
    await session.commitTransaction();
    session.endSession();
    await runWalletSideEffect("sender gift XP", () => grantXp(req.user!.id, "GIFT_SENT", { roomId: room._id.toString(), giftId: gift._id.toString() }));
    await runWalletSideEffect("receiver gift XP", () => grantXp(req.body.receiverId, "GIFT_RECEIVED", { roomId: room._id.toString(), giftId: gift._id.toString() }));
    await runWalletSideEffect("gift relationship XP", () => grantRelationshipXp(req.user!.id, req.body.receiverId, "GIFT_SENT", { roomId: room._id.toString(), giftId: gift._id.toString() }));
    await runWalletSideEffect("gift notification", () => createNotification(req.body.receiverId, "GIFT", "Gift Received", `${req.user!.name} sent you a ${gift.name}!`, { roomId: room._id.toString(), giftId: gift._id.toString() }));
    // NOTE: emitRoom is called after the socket room join for consistent ordering
    emitRoom(room._id.toString(), socketEvents.roomGiftSend, {
      ...giftTransaction[0].toObject(),
      gift: { name: gift.name, icon: gift.icon },
      animation: gift.name.toLowerCase()
    });
    const activity = await runWalletSideEffect("gift activity", () => RoomActivity.create({
      roomId: room._id,
      userId: req.user!.id,
      type: "GIFT",
      label: `${req.user!.name} sent ${gift.name}`,
      metadata: { giftId: gift._id.toString(), receiverId: req.body.receiverId, coinPrice: gift.coinPrice }
    }));
    if (activity) emitRoom(room._id.toString(), socketEvents.roomActivityNew, { activity });
    sendOk(res, { giftTransaction: giftTransaction[0] }, 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}));

walletRouter.post("/direct-send-gift", requireWalletNotFrozen, asyncHandler(async (req: AuthRequest, res) => {
  const { giftId, receiverId } = req.body;
  if (!isValidObjectId(giftId) || !isValidObjectId(receiverId)) {
    throw new HttpError(400, "Invalid IDs", ErrorCode.VALIDATION);
  }
  if (receiverId === req.user!.id) throw new HttpError(400, "Cannot send gifts to yourself", ErrorCode.VALIDATION);
  const gift = await Gift.findOne({ _id: giftId, isActive: true }).lean();
  const receiver = await User.findById(receiverId).lean();
  if (!gift || !receiver) throw new HttpError(404, "Gift or receiver not found", ErrorCode.NOT_FOUND);
  await assertUsersCanInteract(req.user!.id, receiverId, "Cannot send gifts to this user");

  const { DirectMessage } = await import("../models/DirectMessage.js");

  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    await debitWallet(req.user!.id, gift.coinPrice, "GIFT_SENT_DM", { giftId: gift._id.toString() }, session);
    const receiverCredit = creatorShare(gift.coinPrice);
    await creditWallet(receiverId, receiverCredit, "GIFT_RECEIVED", { giftId: gift._id.toString(), senderId: req.user!.id, platformFee: platformFee(gift.coinPrice) }, session);
    const giftTransaction = await GiftTransaction.create([{
      senderId: req.user!.id,
      receiverId,
      giftId: gift._id,
      coinAmount: gift.coinPrice
    }], { session });
    await session.commitTransaction();
    session.endSession();
    await runWalletSideEffect("direct sender gift XP", () => grantXp(req.user!.id, "GIFT_SENT", { giftId: gift._id.toString(), direct: true }));
    await runWalletSideEffect("direct receiver gift XP", () => grantXp(receiverId, "GIFT_RECEIVED", { giftId: gift._id.toString(), direct: true }));
    const relationship = await runWalletSideEffect("direct gift relationship XP", () => grantRelationshipXp(req.user!.id, receiverId, "GIFT_SENT", { giftId: gift._id.toString(), direct: true }));

    // Create a direct message indicating the gift was sent
    const message = await runWalletSideEffect("direct gift message", () => DirectMessage.create({
      senderId: req.user!.id,
      receiverId,
      message: `🎁 Sent you a ${gift.name}!`
    }));

    if (message) {
      emitUser(receiverId, socketEvents.directMessageNew, { message, partnerId: req.user!.id });
      emitUser(req.user!.id, socketEvents.directMessageNew, { message, partnerId: receiverId });
    }
    await runWalletSideEffect("direct gift notification", () => createNotification(receiverId, "GIFT", "Gift Received", `${req.user!.name} sent you a ${gift.name}!`, { partnerId: req.user!.id }));
    sendOk(res, { giftTransaction: giftTransaction[0], message, relationship: relationship?.relationship }, 201);
  } catch (err) {
    await session.abortTransaction();
    session.endSession();
    throw err;
  }
}));
