import type { D1Database } from "@cloudflare/workers-types";
import { coinPacks, createPurchaseOrderSchema, purchaseVipSchema, verifyGooglePlayPurchaseSchema,
  verifyRazorpayPurchaseSchema, xpDailyCaps, xpEvents } from "@yugm/shared";
import { Router } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { addVipDays, changeVipExp, findVipPlan, vipExpForPurchase } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { clearProfileMarkers, newId, readWardrobe, walletFrozen, walletRow, walletVip } from "./d1Cosmetics.js";
import type { D1PaymentProviders } from "./d1Payments.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";

type PurchaseRow = {
  source_id: string;
  user_id: string;
  provider: "RAZORPAY" | "GOOGLE_PLAY";
  status: "PENDING" | "PAID" | "FAILED" | "CREDITED" | "REFUND_PENDING" | "REFUNDED" | "REFUND_FAILED";
  pack_id: string;
  asset_currency: "COINS" | "DIAMONDS";
  coin_amount: number;
  diamond_amount: number;
  amount_inr: number;
  currency: "INR";
  provider_order_id: string | null;
  provider_payment_id: string | null;
  provider_signature: string | null;
  product_id: string | null;
  purchase_token: string | null;
  google_order_id: string | null;
  credited_transaction_id: string | null;
  credited_diamond_transaction_id: string | null;
  refund_transaction_id: string | null;
  refund_provider_id: string | null;
  refunded_at: string | null;
  metadata: string;
  credited_at: string | null;
  created_at: string;
  updated_at: string;
};

type PaidFields = {
  providerPaymentId?: string;
  providerSignature?: string;
  productId?: string;
  purchaseToken?: string;
  googleOrderId?: string;
  metadata?: Record<string, unknown>;
};

const purchaseColumns = `source_id, user_id, provider, status, pack_id, asset_currency, coin_amount,
  diamond_amount, amount_inr, currency, provider_order_id, provider_payment_id, provider_signature,
  product_id, purchase_token, google_order_id, credited_transaction_id, credited_diamond_transaction_id,
  refund_transaction_id, refund_provider_id, refunded_at, metadata, credited_at, created_at, updated_at`;

const vipPurchaseEvent = "VIP_PURCHASE";
const vipDailyCap = xpDailyCaps[vipPurchaseEvent]!;
const vipRequestedXp = xpEvents[vipPurchaseEvent];
const readDailyXp = `SELECT COALESCE(SUM(amount), 0) AS amount FROM xp_daily_caps
  WHERE user_id = ? AND event = ? AND day = ?`;

function findCoinPack(packId: string) {
  const pack = coinPacks.find(item => item.id === packId);
  if (!pack) throw new HttpError(400, "Invalid coin pack", ErrorCode.VALIDATION);
  return pack;
}

function parseMetadata(row: PurchaseRow) {
  return JSON.parse(row.metadata || "{}") as Record<string, unknown>;
}

function presentPurchase(row: PurchaseRow) {
  const metadata = parseMetadata(row);
  const mapped: Record<string, unknown> = {
    _id: row.source_id,
    userId: row.user_id,
    provider: row.provider,
    status: row.status,
    packId: row.pack_id,
    assetCurrency: row.asset_currency,
    coinAmount: row.coin_amount,
    diamondAmount: row.diamond_amount,
    amountInr: row.amount_inr,
    currency: row.currency,
    metadata,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
  const optional = {
    providerOrderId: row.provider_order_id,
    providerPaymentId: row.provider_payment_id,
    providerSignature: row.provider_signature,
    productId: row.product_id,
    purchaseToken: row.purchase_token,
    googleOrderId: row.google_order_id,
    creditedTransactionId: row.credited_transaction_id,
    creditedDiamondTransactionId: row.credited_diamond_transaction_id,
    refundTransactionId: row.refund_transaction_id,
    refundProviderId: row.refund_provider_id,
    refundedAt: row.refunded_at,
    creditedAt: row.credited_at
  };
  for (const [key, value] of Object.entries(optional)) {
    if (value !== null && value !== undefined) mapped[key] = value;
  }
  return mapped;
}

async function readPurchase(db: D1Database, sourceId: string, userId?: string, provider?: PurchaseRow["provider"]) {
  const clauses = ["source_id = ?"];
  const values: Array<string> = [sourceId];
  if (userId) {
    clauses.push("user_id = ?");
    values.push(userId);
  }
  if (provider) {
    clauses.push("provider = ?");
    values.push(provider);
  }
  return db.prepare(`SELECT ${purchaseColumns} FROM purchases WHERE ${clauses.join(" AND ")} LIMIT 1`)
    .bind(...values).first<PurchaseRow>();
}

async function readBalance(db: D1Database, userId: string) {
  return (await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(userId)
    .first<{ wallet_balance: number }>())?.wallet_balance ?? 0;
}

async function assertWalletNotFrozen(db: D1Database, userId: string) {
  const state = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u WHERE source_id = ? LIMIT 1`)
    .bind(userId).first<{ frozen: number }>();
  if (state?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
}

async function markPurchasePaid(db: D1Database, purchaseId: string, userId: string, fields: PaidFields) {
  const current = await readPurchase(db, purchaseId, userId);
  if (!current) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
  if (current.status === "CREDITED") return current;
  if (!["PENDING", "PAID", "FAILED"].includes(current.status)) {
    throw new HttpError(409, "Purchase requires refund reconciliation and cannot be credited", ErrorCode.CONFLICT);
  }
  const time = new Date().toISOString();
  const metadata = { ...parseMetadata(current), ...(fields.metadata ?? {}) };
  const updated = await db.prepare(`UPDATE purchases SET status = 'PAID', provider_payment_id = ?,
    provider_signature = ?, product_id = ?, purchase_token = ?, google_order_id = ?, metadata = ?, updated_at = ?
    WHERE source_id = ? AND user_id = ? AND status IN ('PENDING', 'PAID', 'FAILED')`)
    .bind(fields.providerPaymentId ?? current.provider_payment_id,
      fields.providerSignature ?? current.provider_signature,
      fields.productId ?? current.product_id,
      fields.purchaseToken ?? current.purchase_token,
      fields.googleOrderId ?? current.google_order_id,
      JSON.stringify(metadata), time, purchaseId, userId).run();
  if (!updated.meta.changes) {
    const retry = await readPurchase(db, purchaseId, userId);
    if (!retry) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
    if (retry.status === "CREDITED") return retry;
    throw new HttpError(409, "Purchase requires refund reconciliation and cannot be credited", ErrorCode.CONFLICT);
  }
  return readPurchase(db, purchaseId, userId) as Promise<PurchaseRow>;
}

async function creditPurchase(db: D1Database, userId: string, purchaseId: string, extra: Record<string, unknown>) {
  for (let attempt = 0; attempt < 4; attempt++) {
    const purchase = await readPurchase(db, purchaseId, userId);
    if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
    if (purchase.status === "CREDITED") return purchase;
    if (purchase.status !== "PAID") {
      throw new HttpError(409, "Only verified paid purchases can be credited", ErrorCode.CONFLICT);
    }
    const [account] = await db.batch([db.prepare(readWardrobe).bind(userId)]);
    const row = walletRow(account.results[0]);
    const now = new Date();
    const time = now.toISOString();
    const diamonds = purchase.asset_currency === "DIAMONDS";
    const amount = diamonds ? purchase.diamond_amount : purchase.coin_amount;
    if (!Number.isSafeInteger(amount) || amount <= 0 || !Number.isSafeInteger(row.balance) || !Number.isSafeInteger(row.diamond_balance)) {
      throw new HttpError(409, "Purchase amount requires reconciliation", ErrorCode.CONFLICT);
    }
    const balance = diamonds ? row.diamond_balance : row.balance;
    if (balance > Number.MAX_SAFE_INTEGER - amount) {
      throw new HttpError(409, "Balance limit reached", ErrorCode.CONFLICT);
    }

    const vip = {
      vipTier: row.vip_tier ?? undefined,
      vipLevel: row.vip_level,
      vipExp: row.vip_exp,
      vipStartedAt: row.vip_started_at ? new Date(row.vip_started_at) : undefined,
      vipExpiresAt: row.vip_expires_at ? new Date(row.vip_expires_at) : undefined,
      vipFrozen: Boolean(row.vip_frozen),
      vipFreezeStartedAt: row.vip_freeze_started_at ? new Date(row.vip_freeze_started_at) : undefined
    };
    changeVipExp(vip, vipExpForPurchase(purchase.amount_inr), now);
    const creditId = newId();
    const idempotencyKey = `purchase:${purchaseId}`;
    // The ledger row is the claim. The purchase foreign key points at it only after the
    // insert succeeds in the same batch, so no transaction can observe a dangling ID.
    const claim = diamonds
      ? "EXISTS (SELECT 1 FROM diamond_transactions WHERE idempotency_key = ?)"
      : "EXISTS (SELECT 1 FROM wallet_transactions AS w WHERE w.user_id = ? AND json_extract(w.metadata, '$.idempotencyKey') = ?)";
    const claimValues = diamonds ? [idempotencyKey] : [userId, idempotencyKey];
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, ...claimValues);
    const metadata = { ...parseMetadata(purchase), ...extra };
    const ledgerMetadata = {
      purchaseId, packId: purchase.pack_id, provider: purchase.provider,
      idempotencyKey, ...extra
    };
    const creditColumn = diamonds ? "credited_diamond_transaction_id" : "credited_transaction_id";
    const claimPurchase = db.prepare(`UPDATE purchases SET status = 'CREDITED', credited_at = ?,
      ${creditColumn} = ?, metadata = ?, updated_at = ?
      WHERE source_id = ? AND user_id = ? AND status = 'PAID' AND ${claim}`)
      .bind(time, creditId, JSON.stringify(metadata), time, purchaseId, userId, ...claimValues);
    const ledger = diamonds
      ? db.prepare(`INSERT INTO diamond_transactions (source_id, user_id, type, source, amount, balance_before,
          balance_after, metadata, idempotency_key, created_at, updated_at)
          SELECT ?, u.source_id, 'CREDIT', ?, ?, u.diamond_balance, u.diamond_balance + ?, ?, ?, ?, ?
          FROM users AS u WHERE u.source_id = ? AND u.diamond_balance = ?
            AND NOT EXISTS (SELECT 1 FROM diamond_transactions WHERE idempotency_key = ?)`)
        .bind(creditId, `${purchase.provider}_PURCHASE`, amount, amount, JSON.stringify(ledgerMetadata),
          idempotencyKey, time, time, userId, balance, idempotencyKey)
      : db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
          balance_after, metadata, credited_at, created_at, updated_at)
          SELECT ?, u.source_id, 'CREDIT', ?, ?, u.wallet_balance, u.wallet_balance + ?, ?, ?, ?, ?
          FROM users AS u WHERE u.source_id = ? AND u.wallet_balance = ?
            AND NOT EXISTS (SELECT 1 FROM wallet_transactions AS w WHERE w.user_id = u.source_id
              AND json_extract(w.metadata, '$.idempotencyKey') = ?)`)
        .bind(creditId, `${purchase.provider}_PURCHASE`, amount, amount, JSON.stringify(ledgerMetadata),
          time, time, time, userId, balance, idempotencyKey);
    const columns: Record<string, string | number | null> = {
      ...(diamonds ? { diamond_balance: balance + amount } : { wallet_balance: balance + amount }),
      vip_tier: vip.vipTier ?? null,
      vip_level: vip.vipLevel,
      vip_exp: vip.vipExp,
      vip_started_at: vip.vipStartedAt?.toISOString() ?? null,
      vip_expires_at: vip.vipExpiresAt?.toISOString() ?? null,
      vip_frozen: Number(vip.vipFrozen),
      vip_freeze_started_at: vip.vipFreezeStartedAt?.toISOString() ?? null,
      updated_at: time
    };
    const assignments = Object.keys(columns).map(column => `${column} = ?`).join(", ");
    const userUpdate = write(`UPDATE users SET ${assignments}
      WHERE source_id = ? AND ${diamonds ? "diamond_balance" : "wallet_balance"} = ?
        AND vip_tier IS ? AND vip_level = ? AND vip_exp = ? AND vip_started_at IS ?
        AND vip_expires_at IS ? AND vip_frozen = ? AND vip_freeze_started_at IS ? AND ${claim}`,
      ...Object.values(columns), userId, balance, row.vip_tier, row.vip_level, row.vip_exp,
      row.vip_started_at, row.vip_expires_at, row.vip_frozen, row.vip_freeze_started_at);
    const statements = [ledger, claimPurchase, userUpdate];
    if (!diamonds) statements.push(clearProfileMarkers(db, userId, ["walletBalance"], claim, ...claimValues));
    const [claimed] = await db.batch(statements);
    if (!claimed.meta.changes) continue;
    return readPurchase(db, purchaseId, userId) as Promise<PurchaseRow>;
  }
  throw new HttpError(409, "Purchase or account changed. Please retry.", ErrorCode.CONFLICT);
}

async function consumeGooglePurchase(db: D1Database, purchase: PurchaseRow, providers: D1PaymentProviders,
  productId: string, purchaseToken: string) {
  const metadata = parseMetadata(purchase);
  if (metadata.googleConsumedAt) return purchase;
  await providers.consumeGooglePlayProduct({ productId, purchaseToken });
  metadata.googleConsumedAt = new Date().toISOString();
  const updated = await db.prepare("UPDATE purchases SET metadata = ?, updated_at = ? WHERE source_id = ? AND metadata = ?")
    .bind(JSON.stringify(metadata), metadata.googleConsumedAt, purchase.source_id, purchase.metadata).run();
  const current = await readPurchase(db, purchase.source_id, purchase.user_id);
  if (!updated.meta.changes || !current) {
    throw new HttpError(409, "Purchase changed during consumption. Retry verification.", ErrorCode.CONFLICT);
  }
  return current;
}

export interface D1WalletOptions {
  payments: D1PaymentProviders;
  /** Local debug only; mirrors the legacy development-only recharge route. */
  devRecharge?: boolean;
}

export function createD1WalletRouter(db: D1Database, options: D1WalletOptions) {
  const { payments } = options;
  const router = Router();
  const readAccess = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    const { user, claims } = await requireHttpSession(req.headers.authorization, readAccess);
    res.locals.userId = user.id;
    res.locals.claims = claims;
    next();
  });
  const walletNotFrozen = asyncHandler(async (_req, res, next) => {
    await assertWalletNotFrozen(db, res.locals.userId);
    next();
  });

  router.get("/wallet/purchases", authenticate, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`SELECT ${purchaseColumns} FROM purchases WHERE user_id = ?
      ORDER BY created_at DESC, source_id DESC LIMIT 50`).bind(res.locals.userId).all<PurchaseRow>();
    sendOk(res, { purchases: results.map(presentPurchase) });
  }));

  router.post("/wallet/vip/activate", authenticate, walletNotFrozen, validateBody(purchaseVipSchema),
    asyncHandler(async (req, res) => {
    const userId: string = res.locals.userId;
    const claims = res.locals.claims;
    const plan = findVipPlan(req.body.planId);
    if (!plan) throw new HttpError(400, "Invalid VIP plan", ErrorCode.VALIDATION);

    for (let attempt = 0; attempt < 4; attempt++) {
      const now = new Date();
      const time = now.toISOString();
      const day = startOfUtcDay(now).toISOString();
      const dayKey = [userId, vipPurchaseEvent, day];
      const [account, dailyXp] = await db.batch([
        db.prepare(readWardrobe).bind(userId),
        db.prepare(readDailyXp).bind(...dayKey)
      ]);
      const row = walletRow(account.results[0]);
      const previousDailyXp = (dailyXp.results[0] as { amount: number }).amount;
      if (!Number.isSafeInteger(row.balance)) throw new HttpError(409, "Coin balance requires reconciliation", ErrorCode.CONFLICT);
      if (row.balance < plan.coinPrice) throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
      const remaining = row.balance - plan.coinPrice;
      const expiresAt = addVipDays({
        vipExpiresAt: row.vip_expires_at ? new Date(row.vip_expires_at) : undefined
      }, plan.durationDays, now);
      const vipLevel = Math.max(row.vip_level ?? 0, 1);
      const xpAwarded = Math.min(vipRequestedXp, Math.max(0, vipDailyCap - previousDailyXp));
      const earnedToday = previousDailyXp + xpAwarded;
      const debitId = newId();
      const debitClaim = "EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)";
      const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, debitId);
      const progress = prepareD1XpGrant(write, debitClaim, now, {
        userId, event: vipPurchaseEvent, actionKey: `wallet-txn:${debitId}`,
        requestedXp: vipRequestedXp, xpAwarded, previousXp: row.xp, previousLevel: row.stored_level,
        lastDailyCheckInAt: row.last_daily_check_in_at ?? undefined, balanceBefore: remaining,
        cap: { capped: earnedToday >= vipDailyCap, cap: vipDailyCap, earnedToday,
          remainingToday: Math.max(0, vipDailyCap - earnedToday) }
      });
      const vipColumns = {
        wallet_balance: remaining,
        vip_level: vipLevel,
        vip_tier: `VIP${vipLevel}`,
        vip_started_at: row.vip_started_at ?? time,
        vip_expires_at: expiresAt.toISOString(),
        ...progress.columns,
        updated_at: time
      };
      const claim = db.prepare(`INSERT INTO wallet_transactions
        (source_id, user_id, type, source, amount, balance_before, balance_after, metadata, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', ?, ?, u.wallet_balance, ?, ?, ?, ? FROM users AS u
        WHERE ${d1LiveUserFilter} AND NOT ${walletFrozen}
          AND u.wallet_balance = ? AND u.xp = ? AND u.level = ? AND u.last_daily_check_in_at IS ?
          AND u.vip_tier IS ? AND u.vip_level = ? AND u.vip_exp = ? AND u.vip_started_at IS ?
          AND u.vip_expires_at IS ? AND u.vip_frozen = ? AND u.vip_freeze_started_at IS ?
          AND (${readDailyXp}) = ?`)
        .bind(debitId, "VIP_PURCHASE", plan.coinPrice, remaining,
          JSON.stringify({ planId: plan.id, durationDays: plan.durationDays }), time, time,
          ...bindD1LiveUser(claims, time), row.balance, row.xp, row.stored_level, row.last_daily_check_in_at,
          row.vip_tier, row.vip_level, row.vip_exp, row.vip_started_at, row.vip_expires_at,
          row.vip_frozen, row.vip_freeze_started_at, ...dayKey, previousDailyXp);
      const statements = [
        claim,
        write(`UPDATE users SET ${Object.keys(vipColumns).map(column => `${column} = ?`).join(", ")}
          WHERE source_id = ? AND ${debitClaim}`, ...Object.values(vipColumns), userId),
        clearProfileMarkers(db, userId, ["walletBalance"], debitClaim, debitId),
        ...progress.statements
      ];
      if (xpAwarded > 0) {
        statements.push(
          write(`UPDATE xp_daily_caps SET amount = amount + ?, updated_at = ? WHERE source_id = (
            SELECT source_id FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ? ORDER BY source_id LIMIT 1
          ) AND ${debitClaim}`, xpAwarded, time, ...dayKey),
          write(`INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount, created_at, updated_at)
            SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ?)
            AND ${debitClaim}`, newId(), ...dayKey, xpAwarded, time, time, ...dayKey)
        );
      }
      const [debit] = await db.batch(statements);
      if (!debit.meta.changes) continue;
      const fresh = walletRow(await db.prepare(readWardrobe).bind(userId).first());
      sendOk(res, {
        balance: fresh.balance, vip: walletVip(fresh, now),
        level: progress.xpGrant.level, xpGrant: progress.xpGrant, plan
      });
      return;
    }
    throw new HttpError(409, "Wallet or account changed. Please try again.", ErrorCode.CONFLICT);
  }));

  router.post("/wallet/purchases/razorpay/order", authenticate, walletNotFrozen,
    validateBody(createPurchaseOrderSchema), asyncHandler(async (req, res) => {
      if (req.body.provider !== "RAZORPAY") throw new HttpError(400, "Invalid provider", ErrorCode.VALIDATION);
      payments.assertRazorpayConfigured();
      const userId: string = res.locals.userId;
      const pack = findCoinPack(req.body.packId);
      const purchaseId = newId();
      const time = new Date().toISOString();
      await db.prepare(`INSERT INTO purchases (source_id, user_id, provider, status, pack_id, asset_currency,
        coin_amount, diamond_amount, amount_inr, currency, metadata, created_at, updated_at)
        VALUES (?, ?, 'RAZORPAY', 'PENDING', ?, 'COINS', ?, 0, ?, 'INR', '{}', ?, ?)`)
        .bind(purchaseId, userId, pack.id, pack.coinAmount, pack.priceInr, time, time).run();
      const order = await payments.createRazorpayOrder({
        amountInPaise: pack.priceInr * 100,
        receipt: purchaseId,
        notes: { userId, packId: pack.id }
      });
      await db.prepare("UPDATE purchases SET provider_order_id = ?, metadata = ?, updated_at = ? WHERE source_id = ?")
        .bind(order.id, JSON.stringify({ order }), time, purchaseId).run();
      const purchase = await readPurchase(db, purchaseId, userId);
      sendOk(res, {
        purchase: presentPurchase(purchase as PurchaseRow),
        order,
        checkout: {
          key: payments.razorpayKeyId(), amount: order.amount,
          currency: String(order.currency || "INR").toUpperCase(), orderId: order.id,
          name: "Yugm", description: `${pack.coinAmount} coins`
        }
      }, 201);
    }));

  router.post("/wallet/purchases/razorpay/verify", authenticate, walletNotFrozen,
    validateBody(verifyRazorpayPurchaseSchema), asyncHandler(async (req, res) => {
      const userId: string = res.locals.userId;
      const purchase = await readPurchase(db, req.body.purchaseId, userId, "RAZORPAY");
      if (!purchase) throw new HttpError(404, "Purchase not found", ErrorCode.NOT_FOUND);
      if (purchase.status === "CREDITED") {
        sendOk(res, { purchase: presentPurchase(purchase), balance: await readBalance(db, userId) });
        return;
      }
      if (purchase.provider_order_id !== req.body.razorpay_order_id) {
        throw new HttpError(400, "Order mismatch", ErrorCode.VALIDATION);
      }
      if (!await payments.verifyRazorpaySignature({
        orderId: req.body.razorpay_order_id,
        paymentId: req.body.razorpay_payment_id,
        signature: req.body.razorpay_signature
      })) throw new HttpError(400, "Invalid Razorpay signature", ErrorCode.VALIDATION);
      const payment = await payments.fetchRazorpayPayment(req.body.razorpay_payment_id);
      if (payment.order_id !== purchase.provider_order_id || payment.amount !== purchase.amount_inr * 100 ||
          String(payment.currency || "").toUpperCase() !== "INR") {
        throw new HttpError(400, "Razorpay payment details do not match purchase", ErrorCode.VALIDATION);
      }
      if (payment.status !== "captured") throw new HttpError(402, "Payment is not captured yet", ErrorCode.VALIDATION);
      const paid = await markPurchasePaid(db, purchase.source_id, userId, {
        providerPaymentId: req.body.razorpay_payment_id,
        providerSignature: req.body.razorpay_signature,
        metadata: { ...parseMetadata(purchase), payment }
      });
      const credited = await creditPurchase(db, userId, paid.source_id, { paymentId: payment.id });
      sendOk(res, { purchase: presentPurchase(credited), balance: await readBalance(db, userId) });
    }));

  router.post("/wallet/purchases/google-play/verify", authenticate, walletNotFrozen,
    validateBody(verifyGooglePlayPurchaseSchema), asyncHandler(async (req, res) => {
      const userId: string = res.locals.userId;
      const pack = findCoinPack(req.body.packId);
      if (pack.googleProductId !== req.body.productId) {
        throw new HttpError(400, "Product does not match coin pack", ErrorCode.VALIDATION);
      }
      const existing = await db.prepare(`SELECT ${purchaseColumns} FROM purchases
        WHERE provider = 'GOOGLE_PLAY' AND purchase_token = ? LIMIT 1`).bind(req.body.purchaseToken).first<PurchaseRow>();
      if (existing && existing.user_id !== userId) throw new HttpError(409, "Purchase token already used", ErrorCode.CONFLICT);
      const product = await payments.verifyGooglePlayProduct({
        productId: req.body.productId, purchaseToken: req.body.purchaseToken
      });
      if (product.purchaseState !== 0) {
        throw new HttpError(402, "Google Play purchase is not completed", ErrorCode.VALIDATION);
      }

      let purchase = existing;
      if (!purchase) {
        const purchaseId = newId();
        const time = new Date().toISOString();
        const inserted = await db.prepare(`INSERT INTO purchases (source_id, user_id, provider, status, pack_id,
          asset_currency, coin_amount, diamond_amount, amount_inr, currency, product_id, purchase_token,
          google_order_id, metadata, created_at, updated_at)
          SELECT ?, ?, 'GOOGLE_PLAY', 'PAID', ?, 'COINS', ?, 0, ?, 'INR', ?, ?, ?, ?, ?, ?
          WHERE NOT EXISTS (SELECT 1 FROM purchases WHERE provider = 'GOOGLE_PLAY' AND purchase_token = ?)`)
          .bind(purchaseId, userId, pack.id, pack.coinAmount, pack.priceInr, req.body.productId,
            req.body.purchaseToken, req.body.orderId ?? product.orderId ?? null,
            JSON.stringify({ product }), time, time, req.body.purchaseToken).run();
        purchase = await db.prepare(`SELECT ${purchaseColumns} FROM purchases
          WHERE provider = 'GOOGLE_PLAY' AND purchase_token = ? LIMIT 1`).bind(req.body.purchaseToken).first<PurchaseRow>();
        if (!inserted.meta.changes && !purchase) {
          throw new HttpError(503, "Purchase receipt could not be saved. Retry verification.", ErrorCode.VALIDATION);
        }
      }
      if (!purchase) throw new HttpError(503, "Purchase receipt could not be saved. Retry verification.", ErrorCode.VALIDATION);
      if (purchase.user_id !== userId) throw new HttpError(409, "Purchase token already used", ErrorCode.CONFLICT);
      if (purchase.pack_id !== pack.id || purchase.product_id && purchase.product_id !== req.body.productId) {
        throw new HttpError(400, "Purchase token does not match requested product", ErrorCode.VALIDATION);
      }
      if (["REFUND_PENDING", "REFUNDED"].includes(purchase.status)) {
        throw new HttpError(409, "This purchase has already been refunded", ErrorCode.CONFLICT);
      }
      if (purchase.status !== "CREDITED") {
        purchase = await markPurchasePaid(db, purchase.source_id, userId, {
          productId: req.body.productId,
          purchaseToken: req.body.purchaseToken,
          googleOrderId: req.body.orderId ?? product.orderId ?? purchase.google_order_id ?? undefined,
          metadata: { ...parseMetadata(purchase), product }
        });
      }
      const credited = purchase.status === "CREDITED"
        ? purchase
        : await creditPurchase(db, userId, purchase.source_id, {
          productId: req.body.productId, googleOrderId: purchase.google_order_id ?? undefined
        });
      const consumed = await consumeGooglePurchase(db, credited, payments, req.body.productId, req.body.purchaseToken);
      sendOk(res, { purchase: presentPurchase(consumed), balance: await readBalance(db, userId) });
    }));

  router.post("/wallet/dev-recharge", authenticate, walletNotFrozen, asyncHandler(async (req, res) => {
    if (!options.devRecharge) throw new HttpError(404, "Not found");
    const userId: string = res.locals.userId;
    const raw = Number(req.body.amount);
    const amount = Number.isFinite(raw) && raw > 0 ? Math.min(Math.floor(raw), 25000) : 500;
    const account = walletRow(await db.prepare(readWardrobe).bind(userId).first());
    if (!Number.isSafeInteger(account.balance) || account.balance > Number.MAX_SAFE_INTEGER - amount) {
      throw new HttpError(409, "Coin balance limit reached", ErrorCode.CONFLICT);
    }
    const time = new Date().toISOString();
    const operationId = newId();
    const claim = "EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)";
    const [credit] = await db.batch([
      db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'CREDIT', 'RECHARGE', ?, u.wallet_balance, u.wallet_balance + ?, ?, ?, ?, ?
        FROM users AS u WHERE ${d1LiveUserFilter} AND NOT ${walletFrozen}
          AND u.wallet_balance = ? AND u.wallet_balance <= ?`)
        .bind(operationId, amount, amount, JSON.stringify({ dev: true }), time, time, time,
          ...bindD1LiveUser(res.locals.claims, time), account.balance, Number.MAX_SAFE_INTEGER - amount),
      db.prepare("UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = ? WHERE source_id = ? AND " + claim)
        .bind(amount, time, userId, operationId),
      clearProfileMarkers(db, userId, ["walletBalance"], claim, operationId)
    ]);
    if (!credit.meta.changes) throw new HttpError(409, "Wallet changed. Please try again.", ErrorCode.CONFLICT);
    sendOk(res, { balance: await readBalance(db, userId) });
  }));

  return router;
}
