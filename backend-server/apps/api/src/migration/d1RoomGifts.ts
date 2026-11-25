import { randomBytes } from "node:crypto";
import type { D1Database } from "@cloudflare/workers-types";
import { relationshipXpEvents, sendGiftSchema } from "@yugm/shared";
import { Router } from "express";
import type { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import type { AccessClaims } from "../services/accessSession.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { creatorShare, platformFee } from "../services/giftPricing.js";
import { assertRoomGiftReplayMatches, roomGiftLedgerKeys, type RoomGiftIntent } from "../services/giftReplay.js";
import { dailyRelationshipGiftXpCap, relationshipPairKey } from "../services/relationshipPresentation.js";
import { getVipStatus } from "../services/vip.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { clearProfileMarkers, walletFrozen } from "./d1Cosmetics.js";
import { giftEarnedXp, prepareGiftXp, type GiftXpActor } from "./d1GiftProgression.js";
import { visiblePerson } from "./d1People.js";
import { prepareRelationship, type Relationship } from "./d1RelationshipAward.js";
import { enforceD1UserRateLimit, type D1UserRateLimit } from "./d1UserRateLimit.js";
import type { D1GuardedStatement } from "./d1XpGrant.js";

const id = () => randomBytes(12).toString("hex");
const claimed = "EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)";
const member = (user: string) => `EXISTS (SELECT 1 FROM room_participants
  WHERE room_id = r.source_id AND user_id = ${user} AND left_at IS NULL)`;
const keyMatch = "json_type(metadata, '$.idempotencyKey') = 'text' AND json_extract(metadata, '$.idempotencyKey') = ?";
const balanceFields = `source_id, name, xp, level, wallet_balance, diamond_balance, wealth_exp, charm_exp, last_daily_check_in_at`;
const pairAward = "SELECT COALESCE(SUM(amount), 0) FROM relationship_gift_xp_daily WHERE pair_key = ? AND day = ?";

type RequestGift = RoomGiftIntent & { inventoryId: string | null; requestKey: string | null };
type GiftRow = {
  source_id: string; name: string; category: string; coin_price: number; diamond_price: number;
  limited_edition_active: number; limited_edition_remaining: number;
};
type Actor = GiftXpActor & { name: string; diamond_balance: number; wealth_exp: number; charm_exp: number };
type Sender = Actor & { frozen: number; vip_tier: string | null; vip_level: number; vip_frozen: number; vip_expires_at: string | null };
type Receiver = Actor & { visible: number };
type TransferRow = {
  source_id: string; room_id: string; sender_id: string; receiver_id: string; gift_id: string;
  coin_amount: number; diamond_amount: number; currency: string; type: string; combo_count: number;
  total_value: number; effect: string; metadata: string; created_at: string;
};

function presentTransfer(row: TransferRow) {
  return {
    _id: row.source_id, roomId: row.room_id, senderId: row.sender_id, receiverId: row.receiver_id,
    giftId: row.gift_id, coinAmount: row.coin_amount, diamondAmount: row.diamond_amount,
    currency: row.currency, type: row.type, comboCount: row.combo_count, totalValue: row.total_value,
    effect: row.effect, metadata: JSON.parse(row.metadata) as Record<string, unknown>, createdAt: row.created_at
  };
}

async function findReplay(db: D1Database, spec: RequestGift) {
  if (!spec.requestKey) return null;
  const row = await db.prepare(`SELECT * FROM gift_transactions WHERE sender_id = ? AND ${keyMatch}`)
    .bind(spec.senderId, spec.requestKey).first<TransferRow>();
  if (!row) return null;
  const transfer = presentTransfer(row);
  assertRoomGiftReplayMatches(transfer, spec);
  let inventory: unknown = transfer.metadata.inventoryItemId ?? null;
  if (inventory === null && row.currency === "COINS" && row.coin_amount === 0) {
    const credit = await db.prepare(`SELECT json_extract(metadata, '$.inventoryItemId') AS item FROM wallet_transactions
      WHERE user_id = ? AND ${keyMatch}`).bind(row.receiver_id, roomGiftLedgerKeys(row.source_id).credit).first<{ item: string | null }>();
    inventory = credit?.item ?? undefined;
  }
  if (inventory !== spec.inventoryId) throw new HttpError(409, "Gift request key was already used for different input", ErrorCode.CONFLICT);
  return { giftTransaction: transfer };
}

async function readState(db: D1Database, claims: AccessClaims, spec: RequestGift, time: string, pair: string, day: string) {
  const [rooms, gifts, actors, receivers, inventory, relationships, caps] = await db.batch([
    db.prepare(`SELECT status, ${member("?2")} AS sender_active, ${member("?3")} AS receiver_active
      FROM rooms AS r WHERE r.source_id = ?1`).bind(spec.roomId, spec.senderId, spec.receiverId),
    db.prepare(`SELECT source_id, name, category, coin_price, diamond_price, limited_edition_active, limited_edition_remaining
      FROM gifts WHERE source_id = ? AND is_active = 1 AND category <> 'bonds' AND (expires_at IS NULL OR expires_at > ?)`)
      .bind(spec.giftId, time),
    db.prepare(`SELECT ${balanceFields}, vip_tier, vip_level, vip_frozen, vip_expires_at, ${walletFrozen} AS frozen,
      (${giftEarnedXp("u.source_id")}) AS earned FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL`)
      .bind("GIFT_SENT", day, ...bindD1LiveUser(claims, time)),
    db.prepare(`SELECT ${balanceFields}, ${visiblePerson("peer", "?2")} AS visible,
      (${giftEarnedXp("peer.source_id")}) AS earned FROM users AS peer WHERE peer.source_id = ?1`)
      .bind(spec.receiverId, spec.senderId, "GIFT_RECEIVED", day),
    db.prepare("SELECT quantity FROM gift_inventories WHERE source_id = ? AND user_id = ? AND gift_id = ?")
      .bind(spec.inventoryId, spec.senderId, spec.giftId),
    db.prepare("SELECT * FROM relationships WHERE pair_key = ? ORDER BY source_id LIMIT 1").bind(pair),
    db.prepare(`SELECT (${pairAward}) AS earned`).bind(pair, day)
  ]);
  const room = rooms.results[0] as { status: string; sender_active: number; receiver_active: number } | undefined;
  const gift = gifts.results[0] as GiftRow | undefined;
  const sender = actors.results[0] as Sender | undefined;
  const receiver = receivers.results[0] as Receiver | undefined;
  if (!sender) throw new HttpError(401, "Session revoked", ErrorCode.UNAUTHORIZED);
  if (sender.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
  if (!room || !gift) throw new HttpError(404, "Room or gift not found", ErrorCode.NOT_FOUND);
  if (room.status !== "LIVE") throw new HttpError(400, "Room is not live", ErrorCode.VALIDATION);
  if (!receiver) throw new HttpError(404, "Receiver not found", ErrorCode.NOT_FOUND);
  if (!room.sender_active) throw new HttpError(403, "You are not a participant in this room", ErrorCode.FORBIDDEN);
  if (!room.receiver_active) throw new HttpError(400, "Receiver is not in the room", ErrorCode.VALIDATION);
  if (!receiver.visible) throw new HttpError(403, "Cannot send gifts to this user", ErrorCode.FORBIDDEN);
  if (gift.category === "vip" && !getVipStatus({
    vipTier: sender.vip_tier, vipLevel: sender.vip_level, vipFrozen: Boolean(sender.vip_frozen), vipExpiresAt: sender.vip_expires_at
  }).isVip) throw new HttpError(403, "VIP gifts unlock at VIP 1", ErrorCode.FORBIDDEN);
  const amount = spec.currency === "DIAMONDS" ? gift.diamond_price : gift.coin_price;
  if (!Number.isSafeInteger(amount) || amount <= 0) {
    const message = spec.currency === "DIAMONDS" ? "This gift cannot be purchased with diamonds" : "This gift has an invalid price";
    throw new HttpError(400, message, ErrorCode.VALIDATION);
  }
  const owned = inventory.results[0] as { quantity: number } | undefined;
  if (spec.inventoryId && !owned?.quantity) throw new HttpError(409, "That gift is no longer in your backpack", ErrorCode.CONFLICT);
  if (!spec.inventoryId && gift.limited_edition_active && gift.limited_edition_remaining <= 0) {
    throw new HttpError(409, "This limited-edition gift is sold out", ErrorCode.CONFLICT);
  }
  const diamonds = spec.currency === "DIAMONDS";
  const senderBalance = diamonds ? sender.diamond_balance : sender.wallet_balance;
  const receiverBalance = diamonds ? receiver.diamond_balance : receiver.wallet_balance;
  const debit = spec.inventoryId ? 0 : amount;
  const credit = creatorShare(amount);
  if (debit > 0 && senderBalance < debit) {
    throw new HttpError(402, diamonds ? "Insufficient diamonds" : "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
  }
  if (![senderBalance, receiverBalance + credit, receiver.charm_exp + amount, sender.wealth_exp + (diamonds ? debit : 0)]
    .every(Number.isSafeInteger)) throw new HttpError(409, "Gift balances require reconciliation", ErrorCode.CONFLICT);
  return {
    gift, sender, receiver, diamonds, senderBalance, receiverBalance, amount, debit, credit, owned,
    relationship: relationships.results[0] as Relationship | undefined, pairEarned: (caps.results[0] as { earned: number }).earned
  };
}

type TransferState = Awaited<ReturnType<typeof readState>>;

function balanceGuard(alias: string) {
  return `json_array(${alias}.xp, ${alias}.level, ${alias}.wallet_balance, ${alias}.diamond_balance,
    ${alias}.charm_exp, ${alias}.wealth_exp, ${alias}.last_daily_check_in_at) IS ?`;
}
function actorVersion(actor: Actor) {
  return JSON.stringify([actor.xp, actor.level, actor.wallet_balance, actor.diamond_balance,
    actor.charm_exp, actor.wealth_exp, actor.last_daily_check_in_at]);
}

function transferClaim(db: D1Database, claims: AccessClaims, spec: RequestGift, state: TransferState,
  key: string, pair: string, day: string, time: string) {
  const { gift, sender, receiver, relationship } = state;
  return db.prepare(`INSERT INTO gift_transactions (source_id, room_id, sender_id, receiver_id, gift_id,
      coin_amount, diamond_amount, currency, type, combo_count, total_value, effect, metadata, created_at)
    SELECT ?, r.source_id, u.source_id, peer.source_id, g.source_id, ?, ?, ?, 'send', 1, ?, '', ?, ?
    FROM rooms AS r CROSS JOIN users AS u CROSS JOIN users AS peer CROSS JOIN gifts AS g
    WHERE r.source_id = ? AND r.status = 'LIVE' AND g.source_id = ? AND g.is_active = 1
      AND g.category = ? AND (g.expires_at IS NULL OR g.expires_at > ?)
      AND g.coin_price = ? AND g.diamond_price = ? AND g.limited_edition_active = ?
      AND ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL AND NOT ${walletFrozen}
      AND peer.source_id = ? AND ${visiblePerson("peer", "u.source_id")} AND ${member("u.source_id")} AND ${member("peer.source_id")}
      AND (g.category <> 'vip' OR (u.vip_tier IS ? AND u.vip_level = ? AND u.vip_frozen = 0
        AND u.vip_expires_at IS ? AND u.vip_expires_at > strftime('%Y-%m-%dT%H:%M:%fZ', 'now')))
      AND ((? IS NULL AND (g.limited_edition_active = 0 OR g.limited_edition_remaining > 0))
        OR EXISTS (SELECT 1 FROM gift_inventories WHERE source_id = ? AND user_id = u.source_id
          AND gift_id = g.source_id AND quantity = ?))
      AND ${balanceGuard("u")} AND ${balanceGuard("peer")}
      AND (${giftEarnedXp("u.source_id")}) = ? AND (${giftEarnedXp("peer.source_id")}) = ?
      AND (${pairAward}) = ?
      AND (SELECT json_array(source_id, xp, level, streak_days, last_streak_at) FROM relationships
        WHERE pair_key = ? ORDER BY source_id LIMIT 1) IS ?
      AND (? IS NULL OR NOT EXISTS (SELECT 1 FROM gift_transactions WHERE sender_id = u.source_id AND ${keyMatch}))`)
    .bind(key, state.diamonds ? 0 : state.debit, state.diamonds ? state.amount : 0, spec.currency, state.amount,
      JSON.stringify({ command: "ROOM_GIFT", ...(spec.requestKey ? { idempotencyKey: spec.requestKey } : {}),
        ...(spec.inventoryId ? { inventoryItemId: spec.inventoryId } : {}) }), time,
      spec.roomId, spec.giftId, gift.category, time, gift.coin_price, gift.diamond_price, gift.limited_edition_active,
      ...bindD1LiveUser(claims, time), spec.receiverId, sender.vip_tier, sender.vip_level, sender.vip_expires_at,
      spec.inventoryId, spec.inventoryId, state.owned?.quantity ?? null, actorVersion(sender), actorVersion(receiver),
      "GIFT_SENT", day, sender.earned, "GIFT_RECEIVED", day, receiver.earned, pair, day, state.pairEarned, pair,
      relationship ? JSON.stringify([relationship.source_id, relationship.xp, relationship.level,
        relationship.streak_days, relationship.last_streak_at]) : null, spec.requestKey, spec.requestKey);
}

function giftLedger(write: D1GuardedStatement, spec: RequestGift, state: TransferState, key: string, time: string) {
  const meta = { roomId: spec.roomId, giftId: spec.giftId, currency: spec.currency, giftTransactionId: key,
    ...(spec.inventoryId ? { source: "INVENTORY", inventoryItemId: spec.inventoryId } : {}) };
  const keys = roomGiftLedgerKeys(key);
  const ledger = (user: string, debit: boolean, amount: number, before: number, leg: string) => {
    const type = debit ? "DEBIT" : "CREDIT";
    const source = debit ? "GIFT_SENT" : "GIFT_RECEIVED";
    const after = debit ? before - amount : before + amount;
    const metadata = JSON.stringify({
      ...meta, idempotencyKey: leg, ...(!debit ? { senderId: spec.senderId,
        ...(state.diamonds ? { giftValue: state.amount } : { platformFee: platformFee(state.amount) }) } : {})
    });
    const args = [id(), user, type, source, amount, before, after, metadata] as const;
    return state.diamonds
      ? write(`INSERT INTO diamond_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, idempotency_key, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${claimed}`,
      ...args, leg, time, time)
      : write(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, credited_at, created_at, updated_at) SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ? WHERE ${claimed}`,
      ...args, debit ? null : time, time, time);
  };
  return [
    ...(state.debit > 0 ? [ledger(spec.senderId, true, state.debit, state.senderBalance, keys.debit)] : []),
    ledger(spec.receiverId, false, state.credit, state.receiverBalance, keys.credit)
  ];
}

async function commitGift(db: D1Database, claims: AccessClaims, spec: RequestGift, state: TransferState, now: Date, pair: string, day: string) {
  const key = id();
  const time = now.toISOString();
  const write: D1GuardedStatement = (sql, ...args) => db.prepare(sql).bind(...args, key);
  const senderCoins = state.sender.wallet_balance - (state.diamonds ? 0 : state.debit);
  const receiverCoins = state.receiver.wallet_balance + (state.diamonds ? 0 : state.credit);
  const sent = prepareGiftXp(write, claimed, now, day, `gift:${key}:sent`, "GIFT_SENT", state.sender, senderCoins);
  const received = prepareGiftXp(write, claimed, now, day, `gift:${key}:received`, "GIFT_RECEIVED", state.receiver, receiverCoins);
  const relationship = prepareRelationship(write, claimed, state.relationship,
    Math.min(relationshipXpEvents.GIFT_SENT, Math.max(0, dailyRelationshipGiftXpCap - state.pairEarned)),
    [spec.senderId, spec.receiverId], now, pair, day, "relationship_gift_xp_daily");
  const setUser = (userId: string, columns: Record<string, number | string>, markers: string[]) => [
    write(`UPDATE users SET ${Object.keys(columns).map(column => column + " = ?").join(", ")}, updated_at = ?
      WHERE source_id = ? AND ${claimed}`, ...Object.values(columns), time, userId),
    clearProfileMarkers(db, userId, markers, claimed, key)
  ];
  const statements = [transferClaim(db, claims, spec, state, key, pair, day, time), ...giftLedger(write, spec, state, key, time)];
  if (spec.inventoryId) {
    statements.push(
      write("DELETE FROM gift_inventories WHERE source_id = ? AND quantity = 1 AND " + claimed, spec.inventoryId),
      write("UPDATE gift_inventories SET quantity = quantity - 1, updated_at = ? WHERE source_id = ? AND quantity > 1 AND " + claimed,
        time, spec.inventoryId)
    );
  } else if (state.gift.limited_edition_active) {
    statements.push(write("UPDATE gifts SET limited_edition_remaining = limited_edition_remaining - 1, updated_at = ? WHERE source_id = ? AND " + claimed,
      time, spec.giftId));
  }
  const label = `sent ${state.gift.name} to ${state.receiver.name}`;
  statements.push(
    ...sent.statements, ...received.statements, ...relationship.statements,
    ...setUser(spec.senderId, {
      wallet_balance: senderCoins, ...(state.diamonds ? {
        diamond_balance: state.senderBalance - state.debit, wealth_exp: state.sender.wealth_exp + state.debit
      } : {}), ...sent.columns
    }, ["walletBalance", "xp", "level", "levelTitle", ...(state.diamonds ? ["diamondBalance", "wealthExp"] : [])]),
    ...setUser(spec.receiverId, {
      wallet_balance: receiverCoins, charm_exp: state.receiver.charm_exp + state.amount,
      ...(state.diamonds ? { diamond_balance: state.receiverBalance + state.credit } : {}), ...received.columns
    }, ["walletBalance", "charmExp", "xp", "level", "levelTitle", ...(state.diamonds ? ["diamondBalance"] : [])]),
    write(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
      SELECT ?, ?, 'GIFT', 'Gift Received', ?, ?, 0, ?, ? WHERE ${claimed}`, id(), spec.receiverId,
    `${state.sender.name} sent you a ${state.gift.name}!`, JSON.stringify({ roomId: spec.roomId, giftId: spec.giftId }), time, time),
    write(`INSERT INTO chat_messages (source_id, room_id, sender_id, message, type, created_at)
      SELECT ?, ?, ?, ?, 'GIFT', ? WHERE ${claimed}`, id(), spec.roomId, spec.senderId, label, time),
    write(`INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at, updated_at)
      SELECT ?, ?, ?, 'GIFT', ?, ?, ?, ? WHERE ${claimed}`, id(), spec.roomId, spec.senderId, `${state.sender.name} ${label}`,
    JSON.stringify({ giftId: spec.giftId, receiverId: spec.receiverId, receiverName: state.receiver.name, price: state.amount,
      currency: spec.currency }), time, time)
  );
  const results = await db.batch<TransferRow>([
    ...statements, db.prepare("SELECT * FROM gift_transactions WHERE source_id = ?").bind(key)
  ]);
  const transfer = results.at(-1)?.results[0];
  return transfer ? { giftTransaction: presentTransfer(transfer), xpGrant: { sent: sent.xpGrant, received: received.xpGrant } } : null;
}

export function createD1RoomGiftsRouter(db: D1Database, allowGifts?: D1UserRateLimit, diamondsEnabled = false) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    const { claims } = await requireHttpSession(req.headers.authorization, access);
    await enforceD1UserRateLimit(allowGifts, claims.sub, res, 10);
    res.locals.claims = claims;
    next();
  });
  router.post("/rooms/:id/send-gift", authenticate, validateBody(sendGiftSchema), asyncHandler(async (req, res) => {
    const claims: AccessClaims = res.locals.claims;
    if (!isValidObjectId(req.params.id)) throw new HttpError(400, "Invalid room ID", ErrorCode.VALIDATION);
    const input = req.body as z.infer<typeof sendGiftSchema>;
    const spec: RequestGift = {
      senderId: claims.sub, roomId: req.params.id.toLowerCase(), giftId: input.giftId.toLowerCase(),
      receiverId: input.receiverId.toLowerCase(), currency: input.currency ?? "COINS",
      inventoryId: input.inventoryItemId?.toLowerCase() ?? null, requestKey: input.idempotencyKey ?? null
    };
    if (spec.senderId === spec.receiverId) throw new HttpError(400, "Cannot send gifts to yourself", ErrorCode.VALIDATION);
    if (spec.inventoryId && spec.currency !== "COINS") {
      throw new HttpError(400, "Inventory gifts use the owned gift item", ErrorCode.VALIDATION);
    }
    const pair = relationshipPairKey(spec.senderId, spec.receiverId);
    for (let attempt = 0; attempt < 4; attempt++) {
      const replay = await findReplay(db, spec);
      if (replay) { sendOk(res, replay); return; }
      if (spec.currency === "DIAMONDS" && !diamondsEnabled) {
        throw new HttpError(503, "Diamonds are not enabled", ErrorCode.VALIDATION);
      }
      const now = new Date();
      const day = startOfUtcDay(now).toISOString();
      const state = await readState(db, claims, spec, now.toISOString(), pair, day).catch(async error => {
        const concurrent = await findReplay(db, spec);
        if (concurrent) return concurrent;
        throw error;
      });
      if ("giftTransaction" in state) { sendOk(res, state); return; }
      const result = await commitGift(db, claims, spec, state, now, pair, day);
      if (result) { sendOk(res, result, 201); return; }
    }
    const replay = await findReplay(db, spec);
    if (replay) { sendOk(res, replay); return; }
    throw new HttpError(409, "Gift or wallet changed. Please try again.", ErrorCode.CONFLICT);
  }));
  return router;
}
