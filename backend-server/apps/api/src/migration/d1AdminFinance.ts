import type { D1Database } from "@cloudflare/workers-types";
import { walletSourceLabels } from "@yugm/shared";
import { Router, type Request } from "express";
import { z } from "zod";
import { validateBody } from "../middleware/validate.js";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit, prepareD1AdminAudit, requireD1Admin, requireD1Permission } from "./d1AdminAuth.js";
import { hashAdminToken } from "./d1AdminCredentials.js";
import { createModerationAction, flagSafetyState, presentSafety } from "./d1AdminUsers.js";
import { newId, walletFrozen } from "./d1Cosmetics.js";
import { d1GiftProjection, presentGift, type GiftRow } from "./d1GiftCatalog.js";
import { person, personJson } from "./d1People.js";

type Row = Record<string, string | number | null>;
const walletFields = "user_id type source amount balance_before balance_after product_id platform verification_status credited_at";
const purchaseFields = "user_id provider status pack_id asset_currency coin_amount diamond_amount amount_inr currency provider_order_id provider_payment_id product_id google_order_id credited_transaction_id credited_diamond_transaction_id refund_transaction_id refund_provider_id refunded_at credited_at";
const withdrawalFields = "user_id amount_coins amount_inr status locked_at approved_at rejected_at paid_at reviewed_by_admin_id rejection_reason payout_reference";
const reviewFields = "user_id withdrawal_request_id trust_verification_id creator_payout_kyc_id status risk_score admin_notes rejection_reason reviewed_by_admin_id reviewed_at";
const safetyFlags = ["trust_verified", "kyc_verified", "wallet_safe", "reports_safe", "fraud_safe"] as const;
const nameFields = "u.name AS user_name, u.username AS user_username, u.wallet_balance AS user_balance";
const reasonSchema = z.object({ reason: z.string().min(3).max(500) });
const adjustmentSchema = reasonSchema.extend({ type: z.enum(["CREDIT", "DEBIT"]),
  amount: z.number().int().min(1).max(100000), metadata: z.record(z.unknown()).optional() });

function id(value: string, label: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, `Invalid ${label}`, ErrorCode.VALIDATION);
  return value.toLowerCase();
}

function camel(column: string) {
  return column.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

function present(row: Row, fields: string) {
  return { _id: row.source_id, ...Object.fromEntries(
    `${fields} created_at updated_at`.split(" ").filter(field => row[field] != null).map(field => [camel(field), row[field]])
  ) };
}

function name(row: Row, balance = false) {
  return { _id: row.user_id, name: row.user_name, username: row.user_username,
    ...(balance ? { walletBalance: row.user_balance } : {}) };
}

export function withdrawal(row: Row, userId: unknown = row.user_id) {
  return { ...present(row, withdrawalFields), userId, activeLock: Boolean(row.active_lock) };
}

export function payoutReview(row: Row) {
  return { ...present(row, reviewFields), id: row.source_id,
    ...Object.fromEntries(safetyFlags.map(field => [camel(field), Boolean(row[field])])),
    riskFlags: JSON.parse(String(row.risk_flags ?? "[]")) as unknown,
    payout: { providerPayoutId: row.provider_payout_id, providerStatus: row.provider_status,
      processedAt: row.processed_at, failureReason: row.failure_reason } };
}

function wallet(row: Row, userId: unknown = row.user_id) {
  return { ...present(row, walletFields), userId, metadata: JSON.parse(String(row.metadata ?? "{}")) as unknown };
}

export function createD1AdminFinanceRouter(db: D1Database, secret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const canReadWallet = guard("wallet.read");
  const canReadPayments = guard("payments.read");
  const canReadWithdrawals = guard("withdrawals.read");
  const canReadReviews = guard("payout_review.read");
  const canAdjustWallet = guard("wallet.adjust");
  const rows = (query: string, ...args: (string | number | null)[]) =>
    db.prepare(query).bind(...args).all<Row>().then(result => result.results);
  const profile = (row: Row) => ({ ...person(String(row.profile)), role: row.user_role });
  const readWallet = (userId: string, limit: number) => rows(
    "SELECT * FROM wallet_transactions WHERE user_id = ? ORDER BY created_at DESC, source_id LIMIT ?", userId, limit
  );
  const requireTwoFactor = asyncHandler(async (_req, res, next) => {
    const admin = adminFrom(res);
    const enabled = await db.prepare("SELECT 1 FROM admin_users WHERE source_id = ? AND two_factor_enabled = 1 AND status = 'ACTIVE'")
      .bind(admin.id).first();
    if (!enabled || !admin.sessionId) throw new HttpError(403, "Two-factor authentication is required", ErrorCode.FORBIDDEN);
    next();
  });
  const pageRows = async (req: Request, projection: string, from: string, args: (string | null)[]) => {
    const { page, limit, skip } = pageParams(req.query);
    const [items, count] = await db.batch<Row>([
      db.prepare(`SELECT ${projection} ${from} ORDER BY t.created_at DESC, t.source_id LIMIT ? OFFSET ?`).bind(...args, limit, skip),
      db.prepare(`SELECT COUNT(*) AS total ${from}`).bind(...args)
    ]);
    return { items: items.results, meta: paginationMeta(page, limit, Number(count.results[0]?.total ?? 0)) };
  };

  router.get("/wallet/users/:userId", canReadWallet, asyncHandler(async (req, res) => {
    const userId = id(req.params.userId, "userId");
    const [user, safety, transactions] = await Promise.all([
      db.prepare(`SELECT u.source_id AS user_id, ${nameFields} FROM users u WHERE u.source_id = ?`).bind(userId).first<Row>(),
      db.prepare("SELECT * FROM user_safety_statuses WHERE user_id = ?").bind(userId).first<Row>(),
      readWallet(userId, 50)
    ]);
    adminOk(res, { user: user ? name(user, true) : null, safety: safety ? presentSafety(safety) : null,
      transactions: transactions.map(row => wallet(row)) });
  }));
  router.get("/wallet/users/:userId/transactions", canReadWallet, asyncHandler(async (req, res) => {
    adminOk(res, (await readWallet(id(req.params.userId, "userId"), 200)).map(row => wallet(row)));
  }));
  router.get("/wallet/transactions", canReadWallet, asyncHandler(async (req, res) => {
    const userId = req.query.userId ? id(String(req.query.userId), "userId") : null;
    const { items, meta } = await pageRows(req, `t.*, ${nameFields}`,
      `FROM wallet_transactions t JOIN users u ON u.source_id = t.user_id
        WHERE (?1 IS NULL OR t.user_id = ?1) AND (?2 IS NULL OR t.type = ?2)`,
      [userId, req.query.type ? String(req.query.type) : null]);
    adminOk(res, items.map(row => wallet(row, name(row))), meta);
  }));
  router.get("/wallet/suspicious", canReadWallet, asyncHandler(async (_req, res) => {
    const items = await rows(`SELECT t.*, ${nameFields} FROM user_safety_statuses t JOIN users u ON u.source_id = t.user_id
      WHERE t.is_wallet_frozen = 1 OR t.risk_level IN ('HIGH', 'CRITICAL') ORDER BY t.trust_score, t.source_id LIMIT 100`);
    adminOk(res, items.map(row => ({ ...presentSafety(row), userId: name(row, true) })));
  }));
  const adjustWallet = asyncHandler(async (req, res) => {
      const userId = id(req.params.userId ?? req.body.userId, "userId");
      const admin = adminFrom(res);
      const input = req.body as z.infer<typeof adjustmentSchema>;
      const requestKey = req.get("idempotency-key");
      if (requestKey && !/^[a-zA-Z0-9_.:-]{1,128}$/.test(requestKey)) {
        throw new HttpError(400, "Invalid Idempotency-Key", ErrorCode.VALIDATION);
      }
      let approverId: string | undefined;
      if (input.amount >= 10000) {
        const approval = req.get("x-approval-admin-token");
        if (!approval) throw new HttpError(400, "Adjustments of 10,000 or more coins require a second admin token", ErrorCode.VALIDATION);
        const approver = await requireD1Admin(db, /^Bearer /i.test(approval) ? `Bearer ${approval.slice(7)}` : `Bearer ${approval}`, secret);
        if (approver.id === admin.id || !approver.sessionId) {
          throw new HttpError(403, "Approval requires a different admin with an active session", ErrorCode.FORBIDDEN);
        }
        requireD1Permission(approver, "wallet.adjust");
        approverId = approver.id;
      }
      const delta = input.type === "CREDIT" ? input.amount : -input.amount;
      const transactionId = newId();
      const time = new Date().toISOString();
      const key = requestKey ? `admin-adjustment:${admin.id}:${requestKey}` : null;
      const fingerprint = hashAdminToken(JSON.stringify(input));
      const metadata = { ...input.metadata, reason: input.reason, adminId: admin.id, approverId,
        idempotencyKey: key, adjustmentFingerprint: fingerprint };
      const [inserted, , , receipt] = await db.batch<Row>([
        db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before, balance_after,
          metadata, created_at, updated_at) SELECT ?1, u.source_id, ?2, 'ADMIN_ADJUSTMENT', ?3,
          u.wallet_balance, u.wallet_balance + ?4, ?5, ?6, ?6 FROM users u WHERE u.source_id = ?7
          AND NOT ${walletFrozen} AND u.wallet_balance + ?4 BETWEEN 0 AND 9007199254740991
          ON CONFLICT DO NOTHING`).bind(transactionId, input.type, input.amount, delta, JSON.stringify(metadata), time, userId),
        db.prepare(`UPDATE users SET wallet_balance = (SELECT balance_after FROM wallet_transactions WHERE source_id = ?1),
          updated_at = ?2 WHERE source_id = ?3 AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?1)`)
          .bind(transactionId, time, userId),
        prepareD1AdminAudit(db, admin, { action: "wallet.adjusted", entityType: "wallet_transaction", entityId: transactionId,
          targetUserId: userId, metadata: { type: input.type, amount: input.amount, reason: input.reason, approverId,
            dualApproval: Boolean(approverId) }, req }, true),
        db.prepare(`SELECT * FROM wallet_transactions WHERE source_id = ?1 OR (user_id = ?2
          AND source = 'ADMIN_ADJUSTMENT' AND json_extract(metadata, '$.idempotencyKey') = ?3) LIMIT 1`)
          .bind(transactionId, userId, key)
      ]);
      const transaction = receipt.results[0];
      if (transaction) {
        if (!inserted.meta.changes && (wallet(transaction).metadata as { adjustmentFingerprint?: string }).adjustmentFingerprint !== fingerprint) {
          throw new HttpError(409, "Idempotency key already used for a different adjustment", ErrorCode.CONFLICT);
        }
        const status = inserted.meta.changes ? 201 : 200;
        if (res.locals.legacyAdminRoute) {
          const account = await db.prepare(`SELECT u.source_id AS user_id, ${nameFields} FROM users u WHERE u.source_id = ?`)
            .bind(userId).first<Row>();
          sendOk(res, { transaction: { ...wallet(transaction), label: walletSourceLabels.ADMIN_ADJUSTMENT },
            user: account ? name(account, true) : null }, status);
        } else adminOk(res, { transaction: wallet(transaction) }, {}, status);
        return;
      }
      const user = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users u WHERE u.source_id = ?`).bind(userId).first<Row>();
      if (!user) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      if (user.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      throw new HttpError(409, "Adjustment would put the wallet balance outside the supported range", ErrorCode.CONFLICT);
  });
  router.post("/wallet/users/:userId/adjust", canAdjustWallet, requireTwoFactor, validateBody(adjustmentSchema), adjustWallet);
  router.post("/wallet/adjust", (_req, res, next) => { res.locals.legacyAdminRoute = true; next(); },
    canAdjustWallet, requireTwoFactor, validateBody(z.object({
      userId: z.string().refine(isValidObjectId), amount: z.number().int().min(1).max(100000),
      direction: z.enum(["CREDIT", "DEBIT"]).default("CREDIT"), reason: z.string().min(2).max(160)
    }).transform(({ direction, ...input }) => ({ ...input, type: direction }))), adjustWallet);
  router.post("/wallet/users/:userId/freeze", canAdjustWallet, requireTwoFactor, validateBody(reasonSchema),
    asyncHandler(async (req, res) => {
      const userId = id(req.params.userId, "userId");
      const admin = adminFrom(res);
      if (!await db.prepare("SELECT 1 FROM users WHERE source_id = ?").bind(userId).first()) {
        throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      }
      const safety = await flagSafetyState(db, userId, { isWalletFrozen: true }, admin.id);
      await createModerationAction(db, admin.id, { actionType: "WALLET_FROZEN", targetType: "USER",
        targetId: userId, targetUserId: userId, reason: req.body.reason });
      await insertD1AdminAudit(db, admin, { action: "wallet.frozen", entityType: "user_safety_status",
        targetUserId: userId, metadata: { reason: req.body.reason }, req });
      adminOk(res, { safety: presentSafety(safety) });
    }));
  router.post("/wallet/users/:userId/unfreeze", canAdjustWallet, asyncHandler(async (req, res) => {
    const userId = id(req.params.userId, "userId");
    const admin = adminFrom(res);
    if (!await db.prepare("SELECT 1 FROM users WHERE source_id = ?").bind(userId).first()) {
      throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    }
    const safety = await flagSafetyState(db, userId, { isWalletFrozen: false }, admin.id);
    await insertD1AdminAudit(db, admin, { action: "wallet.unfrozen", entityType: "user_safety_status", targetUserId: userId, req });
    adminOk(res, { safety: presentSafety(safety) });
  }));

  router.get("/payments/recharges", canReadPayments, asyncHandler(async (req, res) => {
    const userId = req.query.userId ? id(String(req.query.userId), "userId") : null;
    const { items, meta } = await pageRows(req, `t.*, ${nameFields}`,
      `FROM purchases t JOIN users u ON u.source_id = t.user_id WHERE (?1 IS NULL OR t.user_id = ?1)
      AND (?2 IS NULL OR t.provider = ?2) AND (?3 IS NULL OR t.status = ?3)`,
      [userId, req.query.platform ? String(req.query.platform) : null, req.query.status ? String(req.query.status) : null]);
    adminOk(res, items.map(row => ({ ...present(row, purchaseFields), userId: name(row) })), meta);
  }));
  router.get("/payments/recharges/:orderId", canReadPayments, asyncHandler(async (req, res) => {
    const reference = req.params.orderId;
    const row = await db.prepare(`SELECT t.*, ${nameFields} FROM purchases t JOIN users u ON u.source_id = t.user_id
      WHERE t.provider_order_id = ?1 OR t.google_order_id = ?1 OR t.source_id = ?2
      ORDER BY t.source_id = ?2 DESC, t.created_at DESC, t.source_id LIMIT 1`)
      .bind(reference, isValidObjectId(reference) ? reference.toLowerCase() : null).first<Row>();
    adminOk(res, row ? { ...present(row, purchaseFields), userId: name(row, true) } : null);
  }));
  router.get("/payments/revenue-summary", canReadPayments, asyncHandler(async (_req, res) => {
    adminOk(res, await rows(`SELECT provider AS _id, SUM(amount_inr) AS gross, SUM(coin_amount) AS coins,
      COUNT(*) AS count FROM purchases WHERE status = 'CREDITED' GROUP BY provider`));
  }));
  router.get("/payments/failed", canReadPayments, asyncHandler(async (_req, res) => {
    adminOk(res, (await rows("SELECT * FROM purchases WHERE status = 'FAILED' ORDER BY created_at DESC, source_id LIMIT 100"))
      .map(row => present(row, purchaseFields)));
  }));
  router.get("/payments/refunds", canReadPayments, asyncHandler(async (_req, res) => {
    const items = await rows(`SELECT * FROM admin_audit_logs WHERE instr(action, 'payment.refund') > 0
      ORDER BY created_at DESC, source_id LIMIT 100`);
    adminOk(res, items.map(row => ({ ...present(row, "admin_id action entity_type entity_id target_user_id"),
      metadata: JSON.parse(String(row.metadata ?? "{}")) as unknown })));
  }));

  router.get("/earnings", canReadWithdrawals, asyncHandler(async (_req, res) => {
    adminOk(res, await rows(`SELECT receiver_id AS _id, SUM(coin_amount) AS giftIncome, COUNT(*) AS count
      FROM gift_transactions GROUP BY receiver_id ORDER BY giftIncome DESC, receiver_id LIMIT 100`));
  }));
  router.get("/earnings/users/:userId", canReadWithdrawals, asyncHandler(async (req, res) => {
    const userId = id(req.params.userId, "userId");
    const [transactionResult, gifts] = await db.batch<Row | GiftRow>([
      db.prepare(`SELECT t.*, ${personJson("u")} AS profile, u.role AS user_role
        FROM gift_transactions t JOIN users u ON u.source_id = t.sender_id
        WHERE t.receiver_id = ? ORDER BY t.created_at DESC, t.source_id LIMIT 100`).bind(userId),
      db.prepare(`SELECT ${d1GiftProjection} FROM gifts g
        WHERE g.source_id IN (SELECT gift_id FROM gift_transactions WHERE receiver_id = ?
          ORDER BY created_at DESC, source_id LIMIT 100)`).bind(userId)
    ]);
    const byId = new Map((gifts.results as GiftRow[]).map(gift => [gift.source_id, presentGift(gift)]));
    adminOk(res, (transactionResult.results as Row[]).map(row => ({
      ...present(row, "room_id receiver_id coin_amount diamond_amount currency type combo_count total_value effect"),
      senderId: profile(row), giftId: byId.get(String(row.gift_id)) ?? null,
      metadata: JSON.parse(String(row.metadata ?? "{}")) as unknown
    })));
  }));
  router.get("/withdrawals", canReadWithdrawals, asyncHandler(async (req, res) => {
    const { items, meta } = await pageRows(req, `t.*, ${personJson("u")} AS profile, u.role AS user_role`,
      "FROM withdrawal_requests t JOIN users u ON u.source_id = t.user_id WHERE (?1 IS NULL OR t.status = ?1)",
      [req.query.status ? String(req.query.status) : null]);
    adminOk(res, { withdrawals: items.map(row => withdrawal(row, profile(row))) }, meta);
  }));
  router.get("/withdrawals/:withdrawalId", canReadWithdrawals, asyncHandler(async (req, res) => {
    const withdrawalId = id(req.params.withdrawalId, "withdrawal ID");
    const [requests, reviews] = await db.batch<Row>([
      db.prepare(`SELECT t.*, ${personJson("u")} AS profile, u.role AS user_role FROM withdrawal_requests t
        JOIN users u ON u.source_id = t.user_id WHERE t.source_id = ?`).bind(withdrawalId),
      db.prepare("SELECT * FROM payout_reviews WHERE withdrawal_request_id = ? ORDER BY created_at DESC, source_id LIMIT 1").bind(withdrawalId)
    ]);
    const row = requests.results[0];
    if (!row) throw new HttpError(404, "Withdrawal not found", ErrorCode.NOT_FOUND);
    adminOk(res, { withdrawal: withdrawal(row, profile(row)), payoutReview: reviews.results[0] ? payoutReview(reviews.results[0]) : null });
  }));
  const payoutJoin = `FROM payout_reviews t JOIN users u ON u.source_id = t.user_id
    JOIN withdrawal_requests w ON w.source_id = t.withdrawal_request_id`;
  const payoutProjection = `t.*, ${personJson("u")} AS profile, u.role AS user_role,
    json_object(${["source_id", ...withdrawalFields.split(" "), "active_lock", "created_at", "updated_at"]
      .map(column => `'${column}', w.${column}`).join(", ")}) AS withdrawal`;
  router.get("/payout-reviews", canReadReviews, asyncHandler(async (req, res) => {
    const { items, meta } = await pageRows(req, payoutProjection, `${payoutJoin} WHERE (?1 IS NULL OR t.status = ?1)`,
      [req.query.status ? String(req.query.status) : null]);
    adminOk(res, { payoutReviews: items.map(row => ({ ...payoutReview(row), user: profile(row),
      withdrawal: withdrawal(JSON.parse(String(row.withdrawal)) as Row) })) }, meta);
  }));
  router.get("/payout-reviews/:id", canReadReviews, asyncHandler(async (req, res) => {
    const row = await db.prepare(`SELECT ${payoutProjection} ${payoutJoin} WHERE t.source_id = ?`)
      .bind(id(req.params.id, "id")).first<Row>();
    if (!row) throw new HttpError(404, "Payout review not found", ErrorCode.NOT_FOUND);
    const review = payoutReview(row);
    adminOk(res, { payoutReview: review, raw: { ...review, userId: profile(row),
      withdrawalRequestId: withdrawal(JSON.parse(String(row.withdrawal)) as Row) } });
  }));

  return router;
}
