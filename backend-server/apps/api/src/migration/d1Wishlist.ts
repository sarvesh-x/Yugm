import type { D1Database } from "@cloudflare/workers-types";
import { Router, type Response } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { creatorShare, platformFee } from "../services/giftPricing.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { createD1AccessSessionReader } from "./d1AccessSession.js";
import { newId, walletFrozen } from "./d1Cosmetics.js";

type ItemRow = {
  source_id: string; user_id: string; gift_id: string; message: string | null; is_public: number;
  created_at: string | null; updated_at: string | null;
  gift_name: string; gift_icon: string; gift_coin_price: number;
};
type SendRow = { source_id: string; user_id: string; is_public: number; gift_id: string; gift_name: string;
  gift_coin_price: number; wallet_balance: number };

const addSchema = z.object({
  giftId: z.string().min(1),
  message: z.string().max(200).optional(),
  isPublic: z.boolean().default(true)
});

const itemProjection = `w.*, g.name AS gift_name, g.icon AS gift_icon, g.coin_price AS gift_coin_price`;
const itemJoin = "FROM wishlist_items AS w JOIN gifts AS g ON g.source_id = w.gift_id";
const maxBalance = Number.MAX_SAFE_INTEGER;

function presentItem(row: ItemRow) {
  return {
    _id: row.source_id, userId: row.user_id,
    giftId: { _id: row.gift_id, name: row.gift_name, icon: row.gift_icon, coinPrice: row.gift_coin_price },
    message: row.message ?? undefined, isPublic: Boolean(row.is_public),
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

export function createD1WishlistRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    res.locals.session = await requireHttpSession(req.headers.authorization, access);
    next();
  });
  const userOf = (res: Response) => res.locals.session.user as { id: string };
  const readItem = (id: string) => db.prepare(`SELECT ${itemProjection} ${itemJoin} WHERE w.source_id = ?`)
    .bind(id).first<ItemRow>();
  const listItems = (sql: string, userId: string) => db.prepare(sql).bind(userId).all<ItemRow>()
    .then(result => result.results.map(presentItem));

  router.post("/wishlist", authenticate, validateBody(addSchema), asyncHandler(async (req, res) => {
    const user = userOf(res);
    const input = req.body as z.infer<typeof addSchema>;
    const gift = await db.prepare("SELECT source_id FROM gifts WHERE source_id = ?")
      .bind(input.giftId.toLowerCase()).first<{ source_id: string }>();
    if (!gift) throw new HttpError(404, "Gift not found", ErrorCode.NOT_FOUND);
    const existing = await db.prepare("SELECT source_id FROM wishlist_items WHERE user_id = ? AND gift_id = ?")
      .bind(user.id, gift.source_id).first<{ source_id: string }>();
    if (existing) throw new HttpError(409, "Gift already in wishlist", ErrorCode.CONFLICT);
    const id = newId();
    const time = new Date().toISOString();
    await db.prepare(`INSERT INTO wishlist_items (source_id, user_id, gift_id, message, is_public, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, user.id, gift.source_id, input.message?.trim() ?? null, Number(input.isPublic), time, time).run();
    sendOk(res, { item: presentItem((await readItem(id)) as ItemRow) });
  }));

  // The legacy router registers this parameterized read before /wishlist/me, so /me
  // resolves here first. Keep the same order until that contract is changed.
  router.get("/wishlist/:userId", authenticate, asyncHandler(async (req, res) => {
    sendOk(res, {
      items: await listItems(`SELECT ${itemProjection} ${itemJoin}
        WHERE w.user_id = ? AND w.is_public = 1 ORDER BY w.created_at DESC, w.source_id DESC`, req.params.userId.toLowerCase())
    });
  }));

  router.get("/wishlist/me", authenticate, asyncHandler(async (req, res) => {
    const user = userOf(res);
    sendOk(res, {
      items: await listItems(`SELECT ${itemProjection} ${itemJoin}
        WHERE w.user_id = ? ORDER BY w.created_at DESC, w.source_id DESC`, user.id)
    });
  }));

  router.delete("/wishlist/:itemId", authenticate, asyncHandler(async (req, res) => {
    const user = userOf(res);
    const deleted = await db.prepare("DELETE FROM wishlist_items WHERE source_id = ? AND user_id = ?")
      .bind(req.params.itemId.toLowerCase(), user.id).run();
    if (!deleted.meta.changes) throw new HttpError(404, "Wishlist item not found", ErrorCode.NOT_FOUND);
    sendOk(res, { deleted: true });
  }));

  router.post("/wishlist/:itemId/send", authenticate, asyncHandler(async (req, res) => {
    const user = userOf(res);
    const item = await db.prepare(`SELECT w.source_id, w.user_id, w.is_public, w.gift_id, g.name AS gift_name,
        g.coin_price AS gift_coin_price, u.wallet_balance
      FROM wishlist_items AS w JOIN gifts AS g ON g.source_id = w.gift_id
      JOIN users AS u ON u.source_id = ?
      WHERE w.source_id = ?`).bind(user.id, req.params.itemId.toLowerCase()).first<SendRow>();
    if (!item) throw new HttpError(404, "Wishlist item not found", ErrorCode.NOT_FOUND);
    if (!item.is_public && item.user_id !== user.id) {
      throw new HttpError(403, "This wishlist item is private", ErrorCode.FORBIDDEN);
    }
    const amount = item.gift_coin_price;
    if (typeof amount !== "number") throw new HttpError(400, "Invalid gift data", ErrorCode.VALIDATION);
    const credit = creatorShare(amount);
    const claim = newId();
    const debit = newId();
    const creditRow = newId();
    const time = new Date().toISOString();
    const claimed = "EXISTS (SELECT 1 FROM gift_transactions WHERE source_id = ?)";
    const results = await db.batch([
      // Claim the transfer only while the item, price, balance and wallet state still match.
      db.prepare(`INSERT INTO gift_transactions (source_id, sender_id, receiver_id, gift_id, coin_amount,
          diamond_amount, currency, type, combo_count, total_value, effect, metadata, created_at)
        SELECT ?, u.source_id, w.user_id, w.gift_id, ?, 0, 'COINS', 'send', 1, 0, '', '{}', ?
        FROM wishlist_items AS w JOIN gifts AS g ON g.source_id = w.gift_id
        JOIN users AS u ON u.source_id = ? JOIN users AS receiver ON receiver.source_id = w.user_id
        WHERE w.source_id = ? AND (w.is_public = 1 OR w.user_id = ?)
          AND g.coin_price = ? AND g.coin_price > 0
          AND u.is_blocked = 0 AND NOT ${walletFrozen} AND u.wallet_balance >= ?
          AND receiver.wallet_balance <= ?`)
        .bind(claim, amount, time, user.id, item.source_id, user.id, amount, amount, maxBalance - credit),
      db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
          balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'DEBIT', 'GIFT_SENT', ?, u.wallet_balance, u.wallet_balance - ?, ?, NULL, ?, ?
        FROM users AS u WHERE u.source_id = ? AND ${claimed}`)
        .bind(debit, amount, amount, JSON.stringify({ giftId: item.gift_id, wishlistItemId: item.source_id }),
          time, time, user.id, claim),
      db.prepare(`UPDATE users SET wallet_balance = wallet_balance - ?, updated_at = ?
        WHERE source_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)`)
        .bind(amount, time, user.id, debit),
      db.prepare(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
          balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'CREDIT', 'GIFT_RECEIVED', ?, u.wallet_balance, u.wallet_balance + ?, ?, ?, ?, ?
        FROM users AS u WHERE u.source_id = ? AND ${claimed}`)
        .bind(creditRow, credit, credit,
          JSON.stringify({ giftId: item.gift_id, senderId: user.id, wishlistItemId: item.source_id, platformFee: platformFee(amount) }),
          time, time, time, item.user_id, claim),
      db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ?, charm_exp = charm_exp + ?, updated_at = ?
        WHERE source_id = ? AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)`)
        .bind(credit, amount, time, item.user_id, creditRow),
      db.prepare(`DELETE FROM wishlist_items WHERE source_id = ? AND ${claimed}`)
        .bind(item.source_id, claim)
    ]);
    if (!results[results.length - 1]!.meta.changes) {
      const current = await db.prepare("SELECT source_id FROM wishlist_items WHERE source_id = ?")
        .bind(item.source_id).first();
      const state = await db.prepare(`SELECT ${walletFrozen} AS frozen, wallet_balance AS balance
        FROM users AS u WHERE u.source_id = ?`).bind(user.id).first<{ frozen: number; balance: number }>();
      if (!current) throw new HttpError(404, "Wishlist item not found", ErrorCode.NOT_FOUND);
      if (state?.frozen) throw new HttpError(403, "Wallet is frozen", ErrorCode.FORBIDDEN);
      if ((state?.balance ?? 0) < amount) throw new HttpError(402, "Insufficient coins", ErrorCode.INSUFFICIENT_FUNDS);
      throw new HttpError(409, "Wishlist changed. Please try again.", ErrorCode.CONFLICT);
    }
    sendOk(res, { sent: true, giftName: item.gift_name });
  }));

  return router;
}
