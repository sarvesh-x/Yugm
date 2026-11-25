import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { Router } from "express";
import { z } from "zod";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { validateBody } from "../middleware/validate.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { clearProfileMarkers, newId } from "./d1Cosmetics.js";
import { person, personJson } from "./d1People.js";
import type { D1GuardedStatement } from "./d1XpGrant.js";

const REFERRAL_REWARD_COINS = 100;
const maxBalance = Number.MAX_SAFE_INTEGER;
const claimSchema = z.object({ code: z.string().min(4).max(20) });
const claimExists = "EXISTS (SELECT 1 FROM user_auth_profile WHERE source_id = ? AND edit_token = ?)";
const referralColumns = `source_id, referrer_id, referred_user_id, referral_code, status, reward_coins,
  completed_at, rewarded_at, ip_address, created_at, updated_at`;

type UserRow = { source_id: string; name: string; referral_code: string | null; referred_by: string | null; wallet_balance: number };
type PreviousReferralRow = { source_id: string; referrer_id: string; status: string; reward_coins: number | null };
type ReferralRow = {
  source_id: string; referrer_id: string; referred_user_id: string | null; referral_code: string;
  status: string; reward_coins: number | null; created_at: string | null; referred_user_json: string | null;
};

function generateReferralCode(name: string) {
  const prefix = name.replace(/[^a-zA-Z0-9]/g, "").slice(0, 4).toUpperCase();
  return `${prefix}${randomBytes(3).toString("hex").toUpperCase()}`;
}

async function readActor(db: D1Database, userId: string) {
  const row = await db.prepare("SELECT source_id, name, referral_code FROM users WHERE source_id = ?")
    .bind(userId).first<UserRow>();
  if (!row) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  return row;
}

async function ensureReferralCode(db: D1Database, userId: string, name: string) {
  const actor = await readActor(db, userId);
  if (actor.referral_code) return actor.referral_code;
  const time = new Date().toISOString();
  for (let attempt = 0; attempt < 4; attempt++) {
    const code = generateReferralCode(name);
    try {
      const saved = await db.prepare(`UPDATE users SET referral_code = ?, updated_at = ?
        WHERE source_id = ? AND (referral_code IS NULL OR referral_code = '')
          AND NOT EXISTS (SELECT 1 FROM users WHERE referral_code = ?)`)
        .bind(code, time, userId, code).run();
      if (saved.meta.changes) return code;
    } catch {
      // Another user may have claimed this generated code between read and write.
    }
    const current = await db.prepare("SELECT referral_code FROM users WHERE source_id = ?")
      .bind(userId).first<{ referral_code: string | null }>();
    if (current?.referral_code) return current.referral_code;
  }
  throw new HttpError(409, "A referral code could not be generated. Please retry.", ErrorCode.CONFLICT);
}

async function readClaimState(db: D1Database, userId: string, code: string) {
  const normalizedCode = code.trim().toUpperCase();
  const [referrerResult, claimantResult, previousResult] = await db.batch([
    db.prepare("SELECT source_id, name, wallet_balance FROM users WHERE referral_code = ?").bind(normalizedCode),
    db.prepare("SELECT source_id, name, referred_by, wallet_balance FROM users WHERE source_id = ?").bind(userId),
    db.prepare(`SELECT source_id, referrer_id, status, reward_coins FROM referrals
      WHERE referred_user_id = ? AND status IN ('COMPLETED', 'REWARDED')
      ORDER BY created_at DESC, source_id DESC LIMIT 1`).bind(userId)
  ]);
  const referrer = referrerResult.results[0] as Pick<UserRow, "source_id" | "name" | "wallet_balance"> | undefined;
  const claimant = claimantResult.results[0] as Pick<UserRow, "source_id" | "name" | "referred_by" | "wallet_balance"> | undefined;
  const previous = previousResult.results[0] as PreviousReferralRow | undefined;
  if (!referrer) throw new HttpError(404, "Invalid referral code", ErrorCode.NOT_FOUND);
  if (referrer.source_id === userId) throw new HttpError(400, "Cannot refer yourself", ErrorCode.VALIDATION);
  if (!claimant) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
  if (previous?.status === "REWARDED" && previous.referrer_id === referrer.source_id) {
    return {
      referrer, claimant, previous, normalizedCode,
      alreadyClaimed: true as const,
      reward: previous.reward_coins ?? REFERRAL_REWARD_COINS
    };
  }
  if (previous || claimant.referred_by) {
    throw new HttpError(409, "A referral claim is already recorded for this account", ErrorCode.CONFLICT);
  }
  if (!Number.isSafeInteger(referrer.wallet_balance) || !Number.isSafeInteger(claimant.wallet_balance) ||
      referrer.wallet_balance > maxBalance - REFERRAL_REWARD_COINS || claimant.wallet_balance > maxBalance - REFERRAL_REWARD_COINS) {
    throw new HttpError(409, "Coin balance limit reached", ErrorCode.CONFLICT);
  }
  return { referrer, claimant, previous, normalizedCode, alreadyClaimed: false as const, reward: REFERRAL_REWARD_COINS };
}

function presentReferral(row: ReferralRow) {
  const populated = row.referred_user_json ? person(row.referred_user_json) : null;
  return {
    _id: row.source_id,
    referrerId: row.referrer_id,
    referredUserId: populated ? { ...populated, avatarParts: populated.avatarParts ?? {} } : null,
    referralCode: row.referral_code,
    status: row.status,
    rewardCoins: row.reward_coins,
    createdAt: row.created_at
  };
}

export function createD1ReferralsRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = asyncHandler(async (req, res, next) => {
    const { user, claims } = await requireHttpSession(req.headers.authorization, access);
    res.locals.userId = user.id;
    res.locals.claims = claims;
    next();
  });
  const userIdOf = (res: { locals: Record<string, unknown> }) => res.locals.userId as string;

  router.post("/referrals/code", authenticate, asyncHandler(async (req, res) => {
    const userId = userIdOf(res);
    const actor = await readActor(db, userId);
    const referralCode = await ensureReferralCode(db, userId, actor.name);
    sendOk(res, { referralCode });
  }));

  router.get("/referrals/code", authenticate, asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const actor = await readActor(db, userId);
    const referralCode = await ensureReferralCode(db, userId, actor.name);
    sendOk(res, { referralCode });
  }));

  router.post("/referrals/claim", authenticate, validateBody(claimSchema), asyncHandler(async (req, res) => {
    const userId = userIdOf(res);
    const claims = res.locals.claims as Parameters<typeof bindD1LiveUser>[0];
    const initial = await readClaimState(db, userId, (req.body as z.infer<typeof claimSchema>).code);
    if (initial.alreadyClaimed) {
      sendOk(res, { reward: initial.reward, message: "Referral code applied" });
      return;
    }
    const now = new Date();
    const time = now.toISOString();
    const token = newId();
    const referralId = newId();
    const claimantLedgerId = newId();
    const referrerLedgerId = newId();
    const { referrer, claimant, normalizedCode } = initial;
    const ipAddress = req.ip ?? null;
    const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, userId, token);

    const results = await db.batch([
      db.prepare(`INSERT INTO user_auth_profile (source_id, null_fields, missing_fields, edit_token)
        SELECT u.source_id, '[]', '[]', ? FROM users AS u
        WHERE ${d1LiveUserFilter} AND u.referred_by IS NULL
          AND u.wallet_balance = ? AND u.wallet_balance <= ?
        ON CONFLICT (source_id) DO UPDATE SET edit_token = excluded.edit_token`)
        .bind(token, ...bindD1LiveUser(claims, time), claimant.wallet_balance, maxBalance - REFERRAL_REWARD_COINS),
      write(`UPDATE users SET referred_by = ?, updated_at = ? WHERE source_id = ? AND ${claimExists}`,
        referrer.source_id, time, userId),
      write(`INSERT INTO referrals (${referralColumns})
        SELECT ?, ?, ?, ?, 'REWARDED', ?, ?, ?, ?, ?, ?
        WHERE NOT EXISTS (SELECT 1 FROM referrals WHERE referred_user_id = ? AND status IN ('COMPLETED', 'REWARDED'))
          AND ${claimExists}`,
      referralId, referrer.source_id, userId, normalizedCode, REFERRAL_REWARD_COINS, time, time, ipAddress, time, time, userId),
      write(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'CREDIT', 'REFERRAL_BONUS', ?, u.wallet_balance, u.wallet_balance + ?, ?, ?, ?, ?
          FROM users AS u WHERE u.source_id = ? AND u.wallet_balance = ? AND u.wallet_balance <= ?
          AND NOT EXISTS (SELECT 1 FROM wallet_transactions AS w WHERE w.user_id = u.source_id
            AND json_extract(w.metadata, '$.idempotencyKey') = ?) AND ${claimExists}`,
      claimantLedgerId, REFERRAL_REWARD_COINS, REFERRAL_REWARD_COINS,
      JSON.stringify({ referralId, type: "referral", idempotencyKey: `referral:${referralId}:claimant` }),
      time, time, time, userId, claimant.wallet_balance, maxBalance - REFERRAL_REWARD_COINS,
      `referral:${referralId}:claimant`),
      write(`INSERT INTO wallet_transactions (source_id, user_id, type, source, amount, balance_before,
        balance_after, metadata, credited_at, created_at, updated_at)
        SELECT ?, u.source_id, 'CREDIT', 'REFERRAL_BONUS', ?, u.wallet_balance, u.wallet_balance + ?, ?, ?, ?, ?
          FROM users AS u WHERE u.source_id = ? AND u.wallet_balance = ? AND u.wallet_balance <= ?
          AND NOT EXISTS (SELECT 1 FROM wallet_transactions AS w WHERE w.user_id = u.source_id
            AND json_extract(w.metadata, '$.idempotencyKey') = ?) AND ${claimExists}`,
      referrerLedgerId, REFERRAL_REWARD_COINS, REFERRAL_REWARD_COINS,
      JSON.stringify({ referralId, type: "referral", idempotencyKey: `referral:${referralId}:referrer` }),
      time, time, time, referrer.source_id, referrer.wallet_balance, maxBalance - REFERRAL_REWARD_COINS,
      `referral:${referralId}:referrer`),
      db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = ?
        WHERE source_id = ? AND wallet_balance = ?
          AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)`)
        .bind(REFERRAL_REWARD_COINS, time, userId, claimant.wallet_balance, claimantLedgerId),
      db.prepare(`UPDATE users SET wallet_balance = wallet_balance + ?, updated_at = ?
        WHERE source_id = ? AND wallet_balance = ?
          AND EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)`)
        .bind(REFERRAL_REWARD_COINS, time, referrer.source_id, referrer.wallet_balance, referrerLedgerId),
      clearProfileMarkers(db, userId, ["walletBalance"], "EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)", claimantLedgerId),
      clearProfileMarkers(db, referrer.source_id, ["walletBalance"], "EXISTS (SELECT 1 FROM wallet_transactions WHERE source_id = ?)", referrerLedgerId)
    ]);
    const [claimed, referred, recorded, claimantCredit, referrerCredit] = results;
    if (!claimed?.meta.changes || !referred?.meta.changes || !recorded?.meta.changes ||
        !claimantCredit?.meta.changes || !referrerCredit?.meta.changes) {
      const recovered = await readClaimState(db, userId, normalizedCode);
      if (recovered.alreadyClaimed) {
        sendOk(res, { reward: recovered.reward, message: "Referral code applied" });
        return;
      }
      throw new HttpError(409, "A referral claim is already recorded for this account", ErrorCode.CONFLICT);
    }

    // The legacy route fires this after commit and logs failures without failing the claim.
    try {
      await db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        VALUES (?, ?, 'SYSTEM', ?, ?, ?, 0, ?, ?)`)
        .bind(newId(), referrer.source_id, "Referral reward",
          `${claimant.name} joined using your code — you earned ${REFERRAL_REWARD_COINS} coins!`,
          JSON.stringify({ rewardCoins: REFERRAL_REWARD_COINS }), time, time).run();
    } catch (error) {
      console.warn("Referral notification failed after commit:", error instanceof Error ? error.message : String(error));
    }
    sendOk(res, { reward: REFERRAL_REWARD_COINS, message: "Referral code applied" });
  }));

  router.get("/referrals/stats", authenticate, asyncHandler(async (_req, res) => {
    const userId = userIdOf(res);
    const [counts, rewards, rows] = await db.batch([
      db.prepare(`SELECT COUNT(*) AS total,
        COALESCE(SUM(CASE WHEN status IN ('COMPLETED', 'REWARDED') THEN 1 ELSE 0 END), 0) AS completed,
        COALESCE(SUM(CASE WHEN status = 'REWARDED' THEN 1 ELSE 0 END), 0) AS rewarded
        FROM referrals WHERE referrer_id = ?`).bind(userId),
      db.prepare(`SELECT COALESCE(SUM(reward_coins), 0) AS totalCoins FROM referrals
        WHERE referrer_id = ? AND status = 'REWARDED'`).bind(userId),
      db.prepare(`SELECT r.source_id, r.referrer_id, r.referred_user_id, r.referral_code, r.status,
        r.reward_coins, r.created_at,
        CASE WHEN u.source_id IS NULL THEN NULL ELSE ${personJson("u")} END AS referred_user_json
        FROM referrals AS r LEFT JOIN users AS u ON u.source_id = r.referred_user_id
        WHERE r.referrer_id = ? ORDER BY r.created_at DESC, r.source_id DESC LIMIT 50`).bind(userId)
    ]);
    const count = counts.results[0] as { total: number; completed: number; rewarded: number };
    const totalCoins = (rewards.results[0] as { totalCoins: number | null }).totalCoins ?? 0;
    sendOk(res, {
      stats: { total: count.total, completed: count.completed, rewarded: count.rewarded, totalCoins },
      referrals: (rows.results as ReferralRow[]).map(presentReferral)
    });
  }));

  return router;
}
