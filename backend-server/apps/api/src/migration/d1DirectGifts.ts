import type { D1Database } from "@cloudflare/workers-types";
import { relationshipXpEvents, sendGiftSchema } from "@yugm/shared";
import { Router } from "express";
import type { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { creatorShare, platformFee } from "../services/giftPricing.js";
import { dailyRelationshipGiftXpCap, relationshipPairKey } from "../services/relationshipPresentation.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { clearProfileMarkers, newId, walletFrozen } from "./d1Cosmetics.js";
import { giftEarnedXp, prepareGiftXp, type GiftXpActor } from "./d1GiftProgression.js";
import { presentD1InboxMessage, type InboxMessage } from "./d1Inbox.js";
import { personJson } from "./d1People.js";
import { prepareRelationship, type Relationship } from "./d1RelationshipAward.js";
import type { D1GuardedStatement } from "./d1XpGrant.js";

type Currency = "COINS" | "DIAMONDS";
type GiftRow = {
  source_id: string; name: string; icon: string; category: string;
  coin_price: number; diamond_price: number;
};
type Actor = GiftXpActor & {
  name: string; diamond_balance: number; wealth_exp: number; charm_exp: number;
  last_daily_check_in_at: string | null;
};
type Sender = Actor & {
  frozen: number; vip_tier: string | null; vip_level: number; vip_frozen: number; vip_expires_at: string | null;
};
type Receiver = Actor & { can_interact: number };
type TransferRow = {
  source_id: string; sender_id: string; receiver_id: string; gift_id: string;
  coin_amount: number; diamond_amount: number; currency: Currency; type: string;
  combo_count: number; total_value: number; effect: string; metadata: string; created_at: string;
};
type FreshActor = GiftXpActor & { last_daily_check_in_at: string | null };

const claimed = "EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)";
const interact = (sender: string, receiver: string) => `NOT EXISTS (
  SELECT 1 FROM blocks AS b WHERE
    (b.blocker_id = ${sender} AND b.blocked_user_id = ${receiver})
    OR (b.blocker_id = ${receiver} AND b.blocked_user_id = ${sender})
)`;
const pairAward = "SELECT COALESCE(SUM(amount), 0) FROM relationship_gift_xp_daily WHERE pair_key = ? AND day = ?";
const profileFields: Record<string, string> = { level_title: "levelTitle", wallet_balance: "walletBalance" };

function presentTransfer(row: TransferRow) {
  return {
    _id: row.source_id, senderId: row.sender_id, receiverId: row.receiver_id,
    giftId: row.gift_id, coinAmount: row.coin_amount, diamondAmount: row.diamond_amount,
    currency: row.currency, type: row.type, comboCount: row.combo_count,
    totalValue: row.total_value, effect: row.effect,
    metadata: JSON.parse(row.metadata) as Record<string, unknown>, createdAt: row.created_at
  };
}

async function readState(db: D1Database, claims: AccessClaims, senderId: string, receiverId: string,
  giftId: string, currency: Currency, diamondsEnabled: boolean, time: string, day: string, pair: string) {
  const [gifts, actors, peers, relationships, caps] = await db.batch([
    db.prepare(`SELECT source_id, name, icon, category, coin_price, diamond_price FROM gifts
      WHERE source_id = ? AND is_active = 1 AND category <> 'bonds'`).bind(giftId),
    db.prepare(`SELECT u.source_id, u.name, u.wallet_balance, u.diamond_balance, u.xp, u.level,
      u.charm_exp, u.wealth_exp, u.last_daily_check_in_at, u.vip_tier, u.vip_level, u.vip_frozen,
      u.vip_expires_at, (${giftEarnedXp("u.source_id")}) AS earned, ${walletFrozen} AS frozen
      FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL`)
      .bind("GIFT_SENT", day, ...bindD1LiveUser(claims, time)),
    db.prepare(`SELECT peer.source_id, peer.name, peer.wallet_balance, peer.diamond_balance, peer.xp,
      peer.level, peer.charm_exp, peer.wealth_exp, peer.last_daily_check_in_at,
      (${giftEarnedXp("peer.source_id")}) AS earned, ${interact("u.source_id", "peer.source_id")} AS can_interact
      FROM users AS peer JOIN users AS u ON u.source_id = ? WHERE peer.source_id = ?`)
      .bind("GIFT_RECEIVED", day, senderId, receiverId),
    db.prepare("SELECT * FROM relationships WHERE pair_key = ? ORDER BY source_id LIMIT 1").bind(pair),
    db.prepare(`SELECT (${pairAward}) AS earned`).bind(pair, day)
  ]);
  const gift = gifts.results[0] as GiftRow | undefined;
  const sender = actors.results[0] as Sender | undefined;
  const receiver = peers.results[0] as Receiver | undefined;
  if (!sender) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
  if (!gift || !receiver) throw new HttpError(404, "Gift or receiver not found", ErrorCode.NOT_FOUND);
  if (sender.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
  if ((gift.category ?? "").toLowerCase() === "vip" && (getVipStatus({
    vipTier: sender.vip_tier, vipLevel: sender.vip_level, vipFrozen: Boolean(sender.vip_frozen),
    vipExpiresAt: sender.vip_expires_at
  }).vipLevel ?? 0) < 1) throw new HttpError(403, "VIP gifts unlock at VIP 1", ErrorCode.FORBIDDEN);
  const diamonds = currency === "DIAMONDS";
  const amount = diamonds ? (gift.diamond_price || 0) : gift.coin_price;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    throw new HttpError(400, `This gift cannot be purchased with ${currency.toLowerCase()}`, ErrorCode.VALIDATION);
  }
  if (diamonds && !diamondsEnabled) {
    throw new HttpError(503, "Diamonds are not enabled", ErrorCode.VALIDATION);
  }
  if (!receiver.can_interact) throw new HttpError(403, "Cannot send gifts to this user", ErrorCode.FORBIDDEN);
  const senderBalance = diamonds ? sender.diamond_balance : sender.wallet_balance;
  const receiverBalance = diamonds ? receiver.diamond_balance : receiver.wallet_balance;
  const credit = creatorShare(amount);
  if (senderBalance < amount) {
    throw new HttpError(402, diamonds ? "Insufficient diamonds" : "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
  }
  if (receiverBalance > Number.MAX_SAFE_INTEGER - credit) {
    throw new HttpError(409, diamonds ? "Diamond balance limit reached" : "Coin balance limit reached", ErrorCode.CONFLICT);
  }
  return {
    gift, sender, receiver, diamonds, amount, credit, senderBalance, receiverBalance,
    relationship: relationships.results[0] as Relationship | undefined,
    pairEarned: (caps.results[0] as { earned: number }).earned
  };
}

type GiftState = Awaited<ReturnType<typeof readState>>;

async function commitGift(db: D1Database, claims: AccessClaims, state: GiftState, now: Date) {
  const operationId = newId();
  const time = now.toISOString();
  const write = (sql: string, ...values: Array<string | number | null>) => db.prepare(sql).bind(...values, operationId);
  const { gift, sender, receiver, diamonds, amount, credit, senderBalance, receiverBalance } = state;
  const debitId = newId();
  const creditId = newId();
  const coinAmount = diamonds ? 0 : amount;
  const diamondAmount = diamonds ? amount : 0;
  const claimSql = `INSERT INTO gift_transactions (source_id, sender_id, receiver_id, gift_id,
      coin_amount, diamond_amount, currency, type, combo_count, total_value, effect, metadata, created_at, updated_at)
    SELECT ?, u.source_id, peer.source_id, g.source_id, ?, ?, ?, 'send', 1, ?, '', '{}', ?, ?
    FROM users AS u JOIN users AS peer ON peer.source_id = ? JOIN gifts AS g ON g.source_id = ?
    WHERE g.is_active = 1 AND g.category <> 'bonds' AND g.coin_price = ? AND g.diamond_price = ?
      AND ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL AND NOT ${walletFrozen}
      AND ${interact("u.source_id", "peer.source_id")}
      AND u.wallet_balance = ? AND u.diamond_balance = ? AND peer.wallet_balance = ? AND peer.diamond_balance = ?
      AND NOT ${claimed}`;
  const claimValues = [operationId, coinAmount, diamondAmount, diamonds ? "DIAMONDS" : "COINS", amount, time, time,
    receiver.source_id, gift.source_id, gift.coin_price, gift.diamond_price,
    ...bindD1LiveUser(claims, time), sender.wallet_balance, sender.diamond_balance,
    receiver.wallet_balance, receiver.diamond_balance] as Array<string | number | null>;
  const claim = db.prepare(claimSql).bind(...claimValues, operationId);

  const debitMeta = JSON.stringify({ giftId: gift.source_id });
  const creditMeta = diamonds
    ? JSON.stringify({ giftId: gift.source_id, giftValue: amount, senderId: sender.source_id })
    : JSON.stringify({ giftId: gift.source_id, senderId: sender.source_id, platformFee: platformFee(amount) });
  const debitLedger = diamonds
    ? write(`INSERT INTO diamond_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, idempotency_key, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', 'GIFT_SENT', ?, u.diamond_balance, ?, ?, NULL, ?, ?
        FROM users AS u WHERE u.source_id = ? AND u.diamond_balance = ? AND ${claimed}`,
      debitId, amount, senderBalance - amount, debitMeta, time, time, sender.source_id, senderBalance)
    : write(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', 'GIFT_SENT_DM', ?, u.wallet_balance, ?, ?, NULL, ?, ?
        FROM users AS u WHERE u.source_id = ? AND u.wallet_balance = ? AND ${claimed}`,
      debitId, amount, senderBalance - amount, debitMeta, time, time, sender.source_id, senderBalance);
  const creditLedger = diamonds
    ? write(`INSERT INTO diamond_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, idempotency_key, created_at, updated_at)
        SELECT ?, peer.source_id, 'CREDIT', 'GIFT_RECEIVED', ?, peer.diamond_balance, ?, ?, NULL, ?, ?
        FROM users AS peer WHERE peer.source_id = ? AND peer.diamond_balance = ? AND ${claimed}`,
      creditId, credit, receiverBalance + credit, creditMeta, time, time, receiver.source_id, receiverBalance)
    : write(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, peer.source_id, 'CREDIT', 'GIFT_RECEIVED', ?, peer.wallet_balance, ?, ?, ?, ?, ?
        FROM users AS peer WHERE peer.source_id = ? AND peer.wallet_balance = ? AND ${claimed}`,
      creditId, credit, receiverBalance + credit, creditMeta, time, time, time, receiver.source_id, receiverBalance);

  const senderUpdate = diamonds
    ? write(`UPDATE users AS u SET diamond_balance = ?, wealth_exp = ?, updated_at = ?
        WHERE u.source_id = ? AND diamond_balance = ? AND wealth_exp = ? AND ${d1LiveUserFilter}
          AND NOT ${walletFrozen} AND ${claimed}`,
      senderBalance - amount, sender.wealth_exp + amount, time, sender.source_id, senderBalance,
      sender.wealth_exp, ...bindD1LiveUser(claims, time))
    : write(`UPDATE users AS u SET wallet_balance = ?, updated_at = ?
        WHERE u.source_id = ? AND wallet_balance = ? AND ${d1LiveUserFilter}
          AND NOT ${walletFrozen} AND ${claimed}`,
      senderBalance - amount, time, sender.source_id, senderBalance, ...bindD1LiveUser(claims, time));
  const receiverUpdate = diamonds
    ? write(`UPDATE users SET diamond_balance = ?, charm_exp = ?, updated_at = ?
        WHERE source_id = ? AND diamond_balance = ? AND charm_exp = ? AND ${claimed}`,
      receiverBalance + credit, receiver.charm_exp + amount, time, receiver.source_id,
      receiverBalance, receiver.charm_exp)
    : write(`UPDATE users SET wallet_balance = ?, charm_exp = ?, updated_at = ?
        WHERE source_id = ? AND wallet_balance = ? AND charm_exp = ? AND ${claimed}`,
      receiverBalance + credit, receiver.charm_exp + amount, time, receiver.source_id,
      receiverBalance, receiver.charm_exp);

  const statements = [
    claim, debitLedger, creditLedger, senderUpdate, receiverUpdate,
    clearProfileMarkers(db, sender.source_id,
      diamonds ? ["diamondBalance", "wealthExp"] : ["walletBalance"], claimed, operationId),
    clearProfileMarkers(db, receiver.source_id,
      diamonds ? ["diamondBalance", "charmExp"] : ["walletBalance", "charmExp"], claimed, operationId),
    db.prepare("SELECT * FROM gift_transactions WHERE source_id = ?").bind(operationId)
  ];
  const results = await db.batch(statements);
  if (!results[0].meta.changes) return null;
  const row = results.at(-1)?.results[0] as TransferRow | undefined;
  return row ? presentTransfer(row) : null;
}

async function runSideEffect<T>(task: () => Promise<T>) {
  try {
    return await task();
  } catch {
    return undefined;
  }
}

async function readFreshActor(db: D1Database, userId: string, event: "GIFT_SENT" | "GIFT_RECEIVED", day: string) {
  const actor = await db.prepare(`SELECT u.source_id, u.xp, u.level, u.wallet_balance,
    u.last_daily_check_in_at, (${giftEarnedXp("u.source_id")}) AS earned
    FROM users AS u WHERE u.source_id = ?`).bind(event, day, userId).first<FreshActor>();
  if (!actor) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
  return actor;
}

async function grantGiftXp(db: D1Database, state: GiftState, operationId: string, now: Date, day: string) {
  const [sender, receiver] = await Promise.all([
    readFreshActor(db, state.sender.source_id, "GIFT_SENT", day),
    readFreshActor(db, state.receiver.source_id, "GIFT_RECEIVED", day)
  ]);
  const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, operationId);
  const time = now.toISOString();
  const sent = prepareGiftXp(write, claimed, now, day, `gift:${operationId}:sent`, "GIFT_SENT",
    sender, sender.wallet_balance);
  const received = prepareGiftXp(write, claimed, now, day, `gift:${operationId}:received`, "GIFT_RECEIVED",
    receiver, receiver.wallet_balance);
  const statements = [...sent.statements, ...received.statements];
  for (const [actor, progress] of [[sender, sent], [receiver, received]] as const) {
    const columns = Object.entries(progress.columns);
    if (!columns.length) continue;
    statements.push(
      write(`UPDATE users SET ${columns.map(([column]) => `${column} = ?`).join(", ")}, updated_at = ?
        WHERE source_id = ? AND ${claimed}`,
      ...columns.map(([, value]) => value), time, actor.source_id),
      clearProfileMarkers(db, actor.source_id, columns.map(([column]) => profileFields[column] ?? column),
        claimed, operationId)
    );
  }
  statements.push(db.prepare(`SELECT COUNT(*) AS count FROM xp_grants
    WHERE user_id = ? AND action_key = ?`).bind(sender.source_id, `gift:${operationId}:sent`));
  const results = await db.batch(statements);
  if (!(results.at(-1)?.results[0] as { count: number }).count) throw new HttpError(409, "Gift XP changed");
  return { sent: sent.xpGrant, received: received.xpGrant };
}

async function grantRelationshipXp(db: D1Database, state: GiftState, operationId: string, now: Date,
  day: string, pair: string) {
  const { sender, receiver, relationship, pairEarned } = state;
  const version = relationship ? JSON.stringify([relationship.source_id, relationship.xp,
    relationship.level, relationship.streak_days, relationship.last_streak_at]) : null;
  const guard = `(SELECT json_array(source_id, xp, level, streak_days, last_streak_at)
      FROM relationships WHERE pair_key = ? ORDER BY source_id LIMIT 1) IS ?
    AND ${claimed}`;
  const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, pair, version, operationId);
  const amount = Math.min(relationshipXpEvents.GIFT_SENT, Math.max(0, dailyRelationshipGiftXpCap - pairEarned));
  const prepared = prepareRelationship(write, guard, relationship, amount,
    [sender.source_id, receiver.source_id], now, pair, day, "relationship_gift_xp_daily");
  if (!prepared.statements.length) return prepared.status;
  const results = await db.batch([
    ...prepared.statements,
    db.prepare("SELECT xp FROM relationships WHERE pair_key = ? ORDER BY source_id LIMIT 1").bind(pair)
  ]);
  const stored = (results.at(-1)?.results[0] as { xp: number } | undefined)?.xp;
  if (stored !== prepared.status?.xp) throw new HttpError(409, "Relationship changed");
  return prepared.status;
}

async function insertDirectGiftMessage(db: D1Database, state: GiftState, operationId: string, time: string) {
  const { sender, receiver, gift } = state;
  const messageId = newId();
  const hasMedia = /^https?:\/\//i.test(gift.icon) || gift.icon.startsWith("/");
  const mediaUrl = hasMedia ? gift.icon : "";
  const mediaType = hasMedia ? "IMAGE" : "";
  const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, operationId);
  const results = await db.batch([
    write(`INSERT INTO direct_messages (source_id, sender_id, receiver_id, room_id, message, media_url,
        media_type, duration, forwarded, is_edited, read, created_at, updated_at,
        reply_to_message_id, reply_to_author, reply_to_author_id, reply_to_text, reply_to_media_url)
      SELECT ?, u.source_id, peer.source_id, NULL, ?, ?, ?, 0, 0, 0, 0, ?, ?, '', '', NULL, '', ''
      FROM users AS u JOIN users AS peer ON peer.source_id = ?
      WHERE u.source_id = ? AND ${claimed}`,
    messageId, `🎁 Sent you a ${gift.name}!`, mediaUrl, mediaType, time, time,
    receiver.source_id, sender.source_id),
    db.prepare(`SELECT m.*, ${personJson("sender")} AS sender_json, ${personJson("receiver")} AS receiver_json,
      (SELECT json_group_array(json_object('userId', user_id, 'type', type, 'createdAt', created_at))
       FROM (SELECT user_id, type, created_at FROM direct_message_reactions
         WHERE direct_messages_id = m.source_id ORDER BY position)) AS reactions_json
      FROM direct_messages AS m
      JOIN users AS sender ON sender.source_id = m.sender_id
      JOIN users AS receiver ON receiver.source_id = m.receiver_id WHERE m.source_id = ?`).bind(messageId)
  ]);
  if (!results[0].meta.changes) throw new HttpError(409, "Gift message changed");
  const row = results[1].results[0] as InboxMessage | undefined;
  return row ? presentD1InboxMessage(row) : null;
}

async function insertGiftNotification(db: D1Database, state: GiftState, operationId: string, time: string) {
  const { sender, receiver, gift } = state;
  const notificationId = newId();
  const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, operationId);
  const result = await write(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
    SELECT ?, peer.source_id, 'GIFT', 'Gift Received', ?, ?, 0, ?, ?
    FROM users AS u JOIN users AS peer ON peer.source_id = ?
    WHERE u.source_id = ? AND ${claimed}`,
  notificationId, `${sender.name} sent you a ${gift.name}!`,
  JSON.stringify({ partnerId: sender.source_id }), time, time, receiver.source_id, sender.source_id).run();
  if (!result.meta.changes) throw new HttpError(409, "Gift notification changed");
}

export function createD1DirectGiftsRouter(db: D1Database, diamondsEnabled = false) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    const { user, claims } = await requireHttpSession(req.headers.authorization, access);
    res.locals.userId = user.id;
    res.locals.claims = claims;
    next();
  });
  const walletNotFrozen = asyncHandler(async (_req, res, next) => {
    const frozen = await db.prepare(`SELECT ${walletFrozen} AS frozen FROM users AS u
      WHERE u.source_id = ? LIMIT 1`).bind(res.locals.userId).first<{ frozen: number }>();
    if (frozen?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
    next();
  });

  router.post("/direct-send-gift", authenticate, walletNotFrozen, validateBody(sendGiftSchema),
    asyncHandler(async (req, res) => {
      const claims: AccessClaims = res.locals.claims;
      const senderId = claims.sub;
      const input = req.body as z.infer<typeof sendGiftSchema>;
      if (!isValidObjectId(input.giftId) || !isValidObjectId(input.receiverId)) {
        throw new HttpError(400, "Invalid IDs", ErrorCode.VALIDATION);
      }
      const giftId = input.giftId.toLowerCase();
      const receiverId = input.receiverId.toLowerCase();
      if (receiverId === senderId) throw new HttpError(400, "Cannot send gifts to yourself", ErrorCode.VALIDATION);
      const currency = input.currency ?? "COINS";
      const pair = relationshipPairKey(senderId, receiverId);
      for (let attempt = 0; attempt < 4; attempt++) {
        const now = new Date();
        const time = now.toISOString();
        const day = startOfUtcDay(now).toISOString();
        const state = await readState(db, claims, senderId, receiverId, giftId, currency, diamondsEnabled,
          time, day, pair);
        const giftTransaction = await commitGift(db, claims, state, now);
        if (!giftTransaction) continue;
        const operationId = giftTransaction._id;
        const xpGrant = await runSideEffect(() => grantGiftXp(db, state, operationId, now, day));
        const relationship = await runSideEffect(() => grantRelationshipXp(db, state, operationId, now, day, pair));
        const message = await runSideEffect(() => insertDirectGiftMessage(db, state, operationId, time));
        await runSideEffect(() => insertGiftNotification(db, state, operationId, time));
        sendOk(res, {
          giftTransaction, message, relationship,
          xpGrant: { sent: xpGrant?.sent, received: xpGrant?.received }
        }, 201);
        return;
      }
      throw new HttpError(409, "Gift or wallet changed. Please try again.", ErrorCode.CONFLICT);
    }));
  return router;
}
