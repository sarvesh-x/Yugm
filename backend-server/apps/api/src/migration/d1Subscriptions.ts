import type { D1Database } from "@cloudflare/workers-types";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { AVATAR_PART_KEYS } from "./authProfileFields.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { clearProfileMarkers, newId, walletFrozen } from "./d1Cosmetics.js";
import type { D1GuardedStatement } from "./d1XpGrant.js";

const PRICES = { MONTHLY: 299, YEARLY: 2999 } as const;
const subscribeSchema = z.object({ plan: z.enum(["MONTHLY", "YEARLY"]) });
const claimExists = "EXISTS (SELECT 1 FROM user_auth_profile WHERE source_id = ? AND edit_token = ?)";
const subscriptionColumns = `s.source_id, s.subscriber_id, s.creator_id, s.plan, s.coin_amount, s.active,
  s.expires_at, s.provider, s.provider_purchase_token, s.provider_order_id, s.auto_renewing, s.status,
  s.last_verified_at, s.last_credited_expiry, s.creator_coin_amount, s.platform_fee_coins, s.renewal_count,
  s.created_at, s.updated_at`;

type SubscriptionRow = {
  source_id: string;
  subscriber_id: string;
  creator_id: string;
  plan: string;
  coin_amount: number;
  active: number;
  expires_at: string;
  provider: string | null;
  provider_purchase_token: string | null;
  provider_order_id: string | null;
  auto_renewing: number;
  status: string;
  last_verified_at: string | null;
  last_credited_expiry: string | null;
  creator_coin_amount: number;
  platform_fee_coins: number;
  renewal_count: number;
  created_at: string | null;
  updated_at: string | null;
  creator_json?: string | null;
  subscriber_json?: string | null;
};

function creatorIdParam(value: string) {
  if (!isValidObjectId(value)) throw new HttpError(400, "Invalid creator ID", ErrorCode.VALIDATION);
  return value.toLowerCase();
}

function personJson(alias: string) {
  return `json_object('_id', ${alias}.source_id, 'name', ${alias}.name, 'username', ${alias}.username,
    'avatar', ${alias}.avatar, 'avatarType', ${alias}.avatar_type,
    'avatarParts', json_object(${AVATAR_PART_KEYS.map(key => `'${key}', ${alias}.avatar_parts_${key}`).join(", ")}))`;
}

function parsePerson(value: string | null | undefined) {
  if (!value) return null;
  const person = JSON.parse(value) as Record<string, unknown>;
  const { avatarParts, ...fields } = person;
  const parts = Object.fromEntries(Object.entries(avatarParts as Record<string, unknown>)
    .filter(([, item]) => item != null));
  return {
    ...Object.fromEntries(Object.entries(fields).filter(([, item]) => item != null)),
    ...(Object.keys(parts).length ? { avatarParts: parts } : {})
  };
}

function presentSubscription(row: SubscriptionRow) {
  const subscription: Record<string, unknown> = {
    _id: row.source_id,
    subscriberId: row.subscriber_id,
    creatorId: row.creator_json ? parsePerson(row.creator_json) : row.creator_id,
    plan: row.plan,
    coinAmount: row.coin_amount,
    active: Boolean(row.active),
    expiresAt: row.expires_at,
    autoRenewing: Boolean(row.auto_renewing),
    status: row.status,
    creatorCoinAmount: row.creator_coin_amount,
    platformFeeCoins: row.platform_fee_coins,
    renewalCount: row.renewal_count,
    createdAt: row.created_at ?? undefined,
    updatedAt: row.updated_at ?? undefined
  };
  if (row.provider) subscription.provider = row.provider;
  if (row.provider_purchase_token) subscription.providerPurchaseToken = row.provider_purchase_token;
  if (row.provider_order_id) subscription.providerOrderId = row.provider_order_id;
  if (row.last_verified_at) subscription.lastVerifiedAt = row.last_verified_at;
  if (row.last_credited_expiry) subscription.lastCreditedExpiry = row.last_credited_expiry;
  return subscription;
}

export function createD1SubscriptionsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    const { user } = await requireHttpSession(req.headers.authorization, access);
    res.locals.userId = user.id;
    next();
  });
  const userIdOf = (res: { locals: Record<string, unknown> }) => res.locals.userId as string;
  const readSubscription = (id: string, populate?: "creator" | "subscriber") => db.prepare(`SELECT ${subscriptionColumns}
    ${populate === "creator"
      ? `, CASE WHEN c.source_id IS NULL THEN NULL ELSE ${personJson("c")} END AS creator_json
          FROM subscriptions AS s LEFT JOIN users AS c ON c.source_id = s.creator_id`
      : populate === "subscriber"
        ? `, CASE WHEN p.source_id IS NULL THEN NULL ELSE ${personJson("p")} END AS subscriber_json
            FROM subscriptions AS s LEFT JOIN users AS p ON p.source_id = s.subscriber_id`
      : "FROM subscriptions AS s"}
    WHERE s.source_id = ?`).bind(id).first<SubscriptionRow>();

  router.post("/subscriptions/:creatorId", authenticate, validateBody(subscribeSchema), asyncHandler(async (req, res) => {
    const userId = userIdOf(res);
    const creatorId = creatorIdParam(req.params.creatorId);
    if (creatorId === userId) throw new HttpError(400, "Cannot subscribe to yourself", ErrorCode.VALIDATION);
    const creator = await db.prepare("SELECT source_id FROM users WHERE source_id = ?")
      .bind(creatorId).first<{ source_id: string }>();
    if (!creator) throw new HttpError(404, "Creator not found", ErrorCode.NOT_FOUND);
    const existing = await db.prepare(`SELECT source_id FROM subscriptions
      WHERE subscriber_id = ? AND creator_id = ? AND active = 1`).bind(userId, creatorId).first<{ source_id: string }>();
    if (existing) throw new HttpError(409, "Already subscribed to this creator", ErrorCode.CONFLICT);

    const plan = (req.body as z.infer<typeof subscribeSchema>).plan;
    const price = PRICES[plan];
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (plan === "MONTHLY" ? 30 : 365) * 24 * 60 * 60 * 1000).toISOString();
    const actor = await db.prepare(`SELECT u.name, u.wallet_balance AS balance, ${walletFrozen} AS frozen
      FROM users AS u WHERE u.source_id = ?`).bind(userId).first<{ name: string; balance: number; frozen: number }>();
    if (!actor) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    if (actor.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
    if (!Number.isSafeInteger(actor.balance)) {
      throw new HttpError(409, "Coin balance requires reconciliation", ErrorCode.CONFLICT);
    }
    if (actor.balance < price) throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);

    const time = now.toISOString();
    const subscriptionId = newId();
    const ledgerId = newId();
    const notificationId = newId();
    const token = newId();
    const remaining = actor.balance - price;
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, userId, token);
    const markerStatement = clearProfileMarkers(db, userId, ["walletBalance"], claimExists, userId, token);
    const [claim, debit, balanceUpdate, subscription, , notification] = await db.batch([
      db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, missing_fields, edit_token)
        SELECT u.source_id, '[]', '[]', ? FROM users AS u WHERE u.source_id = ?
          AND u.wallet_balance = ? AND u.wallet_balance >= ? AND NOT ${walletFrozen}
          AND NOT EXISTS (SELECT 1 FROM subscriptions AS s WHERE s.subscriber_id = u.source_id
            AND s.creator_id = ? AND s.active = 1)
        ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token`)
        .bind(token, userId, actor.balance, price, creatorId),
      write(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', 'SUBSCRIPTION', ?, ?, ?, ?, ?, ? FROM users AS u
        WHERE u.source_id = ? AND u.wallet_balance = ? AND NOT ${walletFrozen} AND ${claimExists}`,
        ledgerId, price, actor.balance, remaining, JSON.stringify({ creatorId, plan }), time, time,
        userId, actor.balance),
      db.prepare(`UPDATE users SET wallet_balance = ?, updated_at = ? WHERE source_id = ? AND wallet_balance = ?
        AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)`)
        .bind(remaining, time, userId, actor.balance, ledgerId),
      write(`INSERT INTO subscriptions (source_id, subscriber_id, creator_id, plan, coin_amount, active,
        expires_at, auto_renewing, status, creator_coin_amount, platform_fee_coins, renewal_count,
        created_at, updated_at)
        SELECT ?, ?, ?, ?, ?, 1, ?, 0, 'ACTIVE', 0, 0, 0, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM subscriptions AS s WHERE s.subscriber_id = ?
          AND s.creator_id = ? AND s.active = 1)
          AND ${claimExists}`,
        subscriptionId, userId, creatorId, plan, price, expiresAt, time, time, userId, creatorId),
      markerStatement,
      write(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, ?, 'SUBSCRIPTION', ?, ?, ?, 0, ?, ? WHERE ${claimExists}`,
        notificationId, creatorId, "New subscriber", `${actor.name} subscribed to you!`,
        JSON.stringify({ subscriberId: userId, plan }), time, time)
    ]);
    if (!debit?.meta.changes || !balanceUpdate?.meta.changes || !subscription?.meta.changes || !notification?.meta.changes) {
      const state = await db.prepare(`SELECT EXISTS (SELECT 1 FROM subscriptions
          WHERE subscriber_id = ? AND creator_id = ? AND active = 1) AS subscribed,
        u.wallet_balance AS balance, ${walletFrozen} AS frozen FROM users AS u WHERE u.source_id = ?`)
        .bind(userId, creatorId, userId).first<{ subscribed: number; balance: number; frozen: number }>();
      if (state?.subscribed) throw new HttpError(409, "Already subscribed to this creator", ErrorCode.CONFLICT);
      if (state?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      if ((state?.balance ?? 0) < price) throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
      throw new HttpError(409, "Subscription changed. Please retry.", ErrorCode.CONFLICT);
    }
    sendOk(res, { subscription: presentSubscription((await readSubscription(subscriptionId)) as SubscriptionRow) }, 201);
  }));

  router.delete("/subscriptions/:creatorId", authenticate, asyncHandler(async (req, res) => {
    const creatorId = creatorIdParam(req.params.creatorId);
    const existing = await db.prepare(`SELECT source_id FROM subscriptions
      WHERE subscriber_id = ? AND creator_id = ? AND active = 1`).bind(userIdOf(res), creatorId)
      .first<{ source_id: string }>();
    if (!existing) throw new HttpError(404, "Active subscription not found", ErrorCode.NOT_FOUND);
    await db.prepare("UPDATE subscriptions SET active = 0, updated_at = ? WHERE source_id = ? AND active = 1")
      .bind(new Date().toISOString(), existing.source_id).run();
    sendOk(res, { cancelled: true });
  }));

  router.get("/subscriptions", authenticate, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`SELECT ${subscriptionColumns},
      CASE WHEN c.source_id IS NULL THEN NULL ELSE ${personJson("c")} END AS creator_json
      FROM subscriptions AS s LEFT JOIN users AS c ON c.source_id = s.creator_id
      WHERE s.subscriber_id = ? ORDER BY s.created_at DESC, s.source_id DESC`)
      .bind(userIdOf(res)).all<SubscriptionRow>();
    sendOk(res, { subscriptions: results.map(presentSubscription) });
  }));

  router.get("/subscriptions/subscribers", authenticate, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`SELECT ${subscriptionColumns},
      CASE WHEN p.source_id IS NULL THEN NULL ELSE ${personJson("p")} END AS subscriber_json
      FROM subscriptions AS s LEFT JOIN users AS p ON p.source_id = s.subscriber_id
      WHERE s.creator_id = ? ORDER BY s.created_at DESC, s.source_id DESC`)
      .bind(userIdOf(res)).all<SubscriptionRow>();
    sendOk(res, {
      subscribers: results.map(row => ({ ...presentSubscription(row), subscriber: parsePerson(row.subscriber_json) }))
    });
  }));

  router.get("/subscriptions/check/:creatorId", authenticate, asyncHandler(async (req, res) => {
    const creatorId = creatorIdParam(req.params.creatorId);
    const subscription = await db.prepare(`SELECT ${subscriptionColumns} FROM subscriptions AS s
      WHERE s.subscriber_id = ? AND s.creator_id = ? AND s.active = 1`)
      .bind(userIdOf(res), creatorId).first<SubscriptionRow>();
    sendOk(res, {
      subscribed: Boolean(subscription),
      ...(subscription ? { subscription: presentSubscription(subscription) } : {})
    });
  }));

  return router;
}
