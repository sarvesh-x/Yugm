import type { D1Database } from "@cloudflare/workers-types";
import { xpDailyCaps } from "@yugm/shared";
import { Router } from "express";
import process from "node:process";
import { z } from "zod";
import { adminOk, pageParams, paginationMeta } from "../modules/admin/http.js";
import { validateBody } from "../middleware/validate.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { asyncHandler, ErrorCode, HttpError, isValidObjectId } from "../utils/http.js";
import { adminFrom, createD1AdminGuard, insertD1AdminAudit } from "./d1AdminAuth.js";
import { presentSafety, refreshSafetyStatus } from "./d1AdminUsers.js";
import { person, personJson } from "./d1People.js";
import { d1RoomProjection, presentD1Room } from "./d1Rooms.js";

type Row = Record<string, string | number | null>;
const dayMs = 86_400_000;
const thirtyDays = () => new Date(Date.now() - 30 * dayMs);
const startOfMonth = (now = new Date()) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const reportReviewSchema = z.object({ notes: z.string().max(1000).optional() });
const analysisQueries = {
  users: "SELECT COUNT(*) AS count FROM users WHERE created_at BETWEEN ? AND ?",
  rooms: "SELECT COUNT(*) AS count FROM rooms WHERE created_at BETWEEN ? AND ?",
  messages: "SELECT COUNT(*) AS count FROM chat_messages WHERE created_at BETWEEN ? AND ?",
  reports: "SELECT COUNT(*) AS count FROM reports WHERE created_at BETWEEN ? AND ?",
  matches: "SELECT COUNT(*) AS count FROM matches WHERE created_at BETWEEN ? AND ?",
  wallet: "SELECT type AS _id, SUM(amount) AS amount, COUNT(*) AS count FROM wallet_transactions WHERE created_at BETWEEN ? AND ? GROUP BY type",
  gifts: "SELECT NULL AS _id, SUM(coin_amount) AS amount, COUNT(*) AS count FROM gift_transactions WHERE created_at BETWEEN ? AND ? HAVING COUNT(*) > 0",
  revenue: "SELECT provider AS _id, SUM(amount_inr) AS gross, COUNT(*) AS count FROM purchases WHERE status = 'CREDITED' AND created_at BETWEEN ? AND ? GROUP BY provider"
} as const;
const scalarMetrics = new Set(["users", "rooms", "messages", "reports", "matches"]);
const profile = (value: unknown) => value ? person(String(value)) : null;

function dateOr(value: unknown, fallback: Date) {
  const parsed = typeof value === "string" ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed) : fallback;
}

export function createD1AdminAnalyticsRouter(db: D1Database, secret?: string) {
  const router = Router();
  const guard = createD1AdminGuard(db, secret);
  const canAnalyze = guard("analytics.read");
  const roomList = async (extra: string, limit: number) => (await db.prepare(
    `SELECT ${d1RoomProjection} FROM rooms AS r JOIN users AS host ON host.source_id = r.host_id
    WHERE r.status = 'LIVE' ${extra} ORDER BY r.participant_count DESC, r.source_id LIMIT ?`
  ).bind(limit).all<Row>()).results.map(row => presentD1Room(row));

  router.get("/dashboard/overview", canAnalyze, asyncHandler(async (_req, res) => {
    const now = new Date();
    const today = startOfUtcDay(now).toISOString();
    const month = startOfMonth(now).toISOString();
    const [users, rooms, moderation, wallet, revenue] = await db.batch([
      db.prepare(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE updated_at >= ?) AS activeToday,
        COUNT(*) FILTER (WHERE created_at >= ?) AS newToday, COUNT(*) FILTER (WHERE is_blocked = 1) AS banned,
        COUNT(*) FILTER (WHERE suspended_until > ?) AS suspended FROM users`).bind(today, today, now.toISOString()),
      db.prepare(`SELECT COUNT(*) FILTER (WHERE status = 'LIVE') AS liveNow,
        COUNT(*) FILTER (WHERE status = 'LIVE' AND type = 'VOICE') AS voiceLive,
        COUNT(*) FILTER (WHERE status = 'LIVE' AND type = 'VIDEO') AS videoLive,
        COUNT(*) FILTER (WHERE created_at >= ?) AS createdToday, COUNT(*) FILTER (WHERE ended_at >= ?) AS endedToday FROM rooms`).bind(today, today),
      db.prepare(`SELECT (SELECT COUNT(*) FROM reports WHERE status = 'PENDING') AS pendingReports,
        (SELECT COUNT(*) FROM moderation_queues WHERE status IN ('PENDING', 'IN_REVIEW', 'ESCALATED') AND priority = 'CRITICAL') AS criticalReports,
        (SELECT COUNT(*) FROM reports WHERE reviewed_at >= ?) AS resolvedToday,
        0 AS averageResolutionTimeMinutes`).bind(today),
      db.prepare(`SELECT COALESCE(SUM(amount) FILTER (WHERE type = 'CREDIT' AND source IN ('RAZORPAY_PURCHASE','GOOGLE_PLAY_PURCHASE','RECHARGE')), 0) AS coinsPurchasedToday,
        COALESCE(SUM(amount) FILTER (WHERE type = 'DEBIT'), 0) AS coinsSpentToday,
        (SELECT COALESCE(SUM(coin_amount), 0) FROM gift_transactions WHERE created_at >= ?) AS giftValueToday,
        0 AS withdrawalPendingAmount FROM wallet_transactions WHERE created_at >= ?`).bind(today, today),
      db.prepare(`SELECT COALESCE(SUM(amount_inr) FILTER (WHERE created_at >= ?), 0) AS grossToday,
        COALESCE(SUM(amount_inr), 0) AS grossMonth, 0 AS refundsToday FROM purchases
        WHERE status = 'CREDITED' AND created_at >= ?`).bind(today, month)
    ]);
    adminOk(res, { users: users.results[0], rooms: rooms.results[0], moderation: moderation.results[0],
      wallet: wallet.results[0], revenue: revenue.results[0] });
  }));

  router.get("/dashboard/live-rooms", guard("rooms.read"), asyncHandler(async (_req, res) => {
    adminOk(res, await roomList("", 50));
  }));

  router.get("/dashboard/system-health", canAnalyze, asyncHandler(async (_req, res) => {
    await db.prepare("SELECT 1").first();
    adminOk(res, { uptimeSeconds: Math.round(process.uptime()), node: process.version, storage: "d1", databaseReady: true });
  }));

  router.get("/dashboard/revenue", canAnalyze, asyncHandler(async (req, res) => {
    const rows = await db.prepare(`SELECT provider AS _id, SUM(amount_inr) AS gross, SUM(coin_amount) AS coins,
      COUNT(*) AS count FROM purchases WHERE status = 'CREDITED' AND created_at >= ? GROUP BY provider ORDER BY provider`)
      .bind(dateOr(req.query.from, startOfMonth()).toISOString()).all();
    adminOk(res, rows.results);
  }));

  router.get("/dashboard/moderation", canAnalyze, asyncHandler(async (_req, res) => {
    const [reports, queue] = await db.batch<{ status: string; priority?: string; count: number }>([
      db.prepare("SELECT status, COUNT(*) AS count FROM reports GROUP BY status ORDER BY status"),
      db.prepare("SELECT status, priority, COUNT(*) AS count FROM moderation_queues GROUP BY status, priority ORDER BY status, priority")
    ]);
    adminOk(res, { reports: reports.results.map(row => ({ _id: row.status, count: row.count })),
      queue: queue.results.map(row => ({ _id: { status: row.status, priority: row.priority }, count: row.count })) });
  }));

  router.get("/dashboard/user-growth", canAnalyze, asyncHandler(async (req, res) => {
    const rows = await db.prepare(`SELECT substr(created_at,1,10) AS _id, COUNT(*) AS count FROM users
      WHERE created_at >= ? GROUP BY 1 ORDER BY 1`).bind(dateOr(req.query.from, thirtyDays()).toISOString()).all();
    adminOk(res, rows.results);
  }));

  router.get("/dashboard/top-hosts", canAnalyze, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`WITH counts AS (
      SELECT host_id, COUNT(*) AS rooms, COUNT(*) FILTER (WHERE status = 'LIVE') AS liveRooms
      FROM rooms GROUP BY host_id ORDER BY rooms DESC, host_id LIMIT 20
    ) SELECT ${personJson("u", true)} AS host, counts.rooms, counts.liveRooms FROM counts
      JOIN users AS u ON u.source_id = counts.host_id ORDER BY counts.rooms DESC, counts.host_id`).all<Row>();
    adminOk(res, results.map(({ host, ...row }) => ({ ...row, _id: profile(host) })));
  }));

  router.get("/dashboard/top-gifts", canAnalyze, asyncHandler(async (_req, res) => {
    const { results } = await db.prepare(`SELECT g.source_id AS id, g.name, g.icon, g.coin_price,
      COUNT(*) AS count, SUM(t.coin_amount) AS value FROM gift_transactions AS t JOIN gifts AS g ON g.source_id = t.gift_id
      GROUP BY g.source_id ORDER BY value DESC, g.source_id LIMIT 20`).all<Row>();
    adminOk(res, results.map(row => ({ _id: { _id: row.id, name: row.name, icon: row.icon, coinPrice: row.coin_price },
      count: row.count, value: row.value })));
  }));

  router.get("/dashboard/experience", canAnalyze, asyncHandler(async (_req, res) => {
    const since = thirtyDays().toISOString();
    const [counts, gifts, leaders, creators] = await db.batch<Row>([
      db.prepare(`SELECT (SELECT COUNT(*) FROM rooms WHERE status = 'SCHEDULED') AS scheduledRooms,
        (SELECT COUNT(*) FROM rooms WHERE visibility = 'PRIVATE' AND created_at >= ?) AS privateRooms,
        (SELECT COUNT(*) FROM speaker_requests WHERE created_at >= ?) AS speakerRequests,
        (SELECT COUNT(*) FROM room_invites WHERE created_at >= ?) AS invites,
        (SELECT COUNT(*) FROM follows WHERE created_at >= ?) AS follows,
        (SELECT COUNT(*) FROM notifications WHERE read = 0) AS unreadNotifications,
        (SELECT COUNT(*) FROM moderation_queues WHERE status IN ('PENDING', 'IN_REVIEW', 'ESCALATED')) AS pendingModeration`)
        .bind(since, since, since, since),
      db.prepare("SELECT COALESCE(SUM(coin_amount), 0) AS coins, COUNT(*) AS count FROM gift_transactions WHERE created_at >= ?").bind(since),
      db.prepare(`SELECT ${personJson("u", true)} AS user FROM users AS u WHERE is_blocked = 0
        ORDER BY level DESC, xp DESC, source_id LIMIT 8`),
      db.prepare(`WITH ranked AS (SELECT receiver_id AS _id, SUM(coin_amount) AS coins, COUNT(*) AS gifts
        FROM gift_transactions WHERE created_at >= ? GROUP BY receiver_id ORDER BY coins DESC, receiver_id LIMIT 8)
        SELECT ranked.*, ${personJson("u")} AS creator FROM ranked JOIN users AS u ON u.source_id = ranked._id
        ORDER BY coins DESC, _id`).bind(since)
    ]);
    const adoption = counts.results[0];
    const summary = gifts.results[0];
    adminOk(res, {
      windowDays: 30, adoption, creatorEconomy: { giftCoins: summary.coins, giftCount: summary.count,
        estimatedInr: Number(summary.coins) / 100,
        topCreators: creators.results.map(({ creator, ...row }) => ({ ...row, creator: profile(creator) })) },
      gamification: { levelLeaders: leaders.results.map(row => profile(row.user)),
        missions: ["Daily check-in", "Room hosting", "Gift streaks", "Follow graph", "Speaker requests"] },
      recommendations: [
        Number(adoption.scheduledRooms) < 5 ? "Promote scheduled-room creation in creator onboarding." : "Scheduled rooms are gaining traction.",
        Number(adoption.pendingModeration) > 20 ? "Moderation queue needs attention before growth pushes." : "Safety queue is currently manageable.",
        Number(summary.coins) < 1000 ? "Run a small gift campaign to activate creator earnings." : "Creator gifting is active."
      ]
    });
  }));

  router.get("/progression/health", canAnalyze, asyncHandler(async (_req, res) => {
    const now = new Date();
    const time = now.toISOString();
    const since = new Date(now.getTime() - dayMs).toISOString();
    const [grants, daily, processing, seasons] = await db.batch<Row>([
      db.prepare(`SELECT event, status, COUNT(*) AS grants, SUM(COALESCE(json_extract(receipt,'$.xpAwarded'),0)) AS xpAwarded
        FROM xp_grants WHERE created_at >= ? GROUP BY event,status ORDER BY event,status`).bind(since),
      db.prepare(`SELECT event, SUM(amount) AS awardedXp, COUNT(*) AS users FROM xp_daily_caps WHERE day = ?
        GROUP BY event ORDER BY event`).bind(startOfUtcDay(now).toISOString()),
      db.prepare(`SELECT COUNT(*) AS total, COUNT(*) FILTER (WHERE updated_at <= ?) AS stale
        FROM xp_grants WHERE status = 'PROCESSING'`).bind(new Date(now.getTime() - 900_000).toISOString()),
      db.prepare(`SELECT s.source_id AS _id, s.key, s.name, s.start_date AS startDate, s.end_date AS endDate,
        s.max_level AS maxLevel, s.xp_per_level AS xpPerLevel, s.premium_price AS premiumPrice,
        (SELECT COUNT(*) FROM battle_passes WHERE season_id = s.source_id) AS passCount
        FROM seasons AS s WHERE s.active = 1 AND s.start_date <= ? AND s.end_date > ? ORDER BY s.start_date DESC LIMIT 1`)
        .bind(time, time)
    ]);
    const season = seasons.results[0];
    const { passCount, ...seasonDetails } = season ?? {};
    adminOk(res, { generatedAt: time, window: { since, staleAfterMinutes: 15 },
      xpGrants: { byEventAndStatus: grants.results.map(({ event, status, ...row }) => ({ _id: { event, status }, ...row })),
        processingCount: processing.results[0].total, staleProcessingCount: processing.results[0].stale },
      dailyCaps: daily.results.map(row => ({ ...row, activeCap: xpDailyCaps[String(row.event) as keyof typeof xpDailyCaps] ?? null })),
      battlePass: { activeSeason: season ? seasonDetails : null, activePassCount: passCount ?? 0 } });
  }));

  for (const [metric, sql] of Object.entries(analysisQueries)) {
    router.get(`/analytics/${metric}`, canAnalyze, asyncHandler(async (req, res) => {
      const from = dateOr(req.query.from, thirtyDays()).toISOString();
      const to = dateOr(req.query.to, new Date()).toISOString();
      const { results } = await db.prepare(sql).bind(from, to).all<Row>();
      adminOk(res, { metric, from, to, data: scalarMetrics.has(metric) ? results[0]?.count ?? 0 : results });
    }));
  }
  router.get("/analytics/retention", canAnalyze, asyncHandler(async (req, res) => {
    const from = dateOr(req.query.from, thirtyDays()).toISOString();
    const to = dateOr(req.query.to, new Date()).toISOString();
    const { results } = await db.prepare(`WITH cohorts AS (
      SELECT source_id, date(created_at) AS day FROM users WHERE created_at BETWEEN ?1 AND ?2
    ), offsets AS (SELECT 1 AS days UNION ALL SELECT 7 UNION ALL SELECT 30),
    eligible AS (
      SELECT c.source_id, c.day, offsets.days, date(c.day, '+' || offsets.days || ' day') AS return_day
      FROM cohorts c CROSS JOIN offsets WHERE date(c.day, '+' || offsets.days || ' day') <= date(?2)
    ) SELECT day AS _id, days, COUNT(*) AS eligibleUsers, SUM(EXISTS (
      SELECT 1 FROM auth_sessions s WHERE s.user_id = eligible.source_id
      AND (date(s.created_at) = eligible.return_day OR date(s.last_used_at) = eligible.return_day))) AS returningUsers
    FROM eligible GROUP BY day, days ORDER BY day, days`).bind(from, to).all<Row>();
    adminOk(res, { metric: "retention", from, to, data: results });
  }));

  for (const [route, permission, predicate] of [
    ["users", "analytics.read", "s.risk_level IN ('HIGH','CRITICAL')"],
    ["wallets", "wallet.read", "s.is_wallet_frozen = 1 OR s.risk_level = 'CRITICAL'"]
  ] as const) {
    router.get(`/fraud/suspicious-${route}`, guard(permission), asyncHandler(async (_req, res) => {
      const { results } = await db.prepare(`SELECT s.*, ${personJson("u")} AS user, u.wallet_balance AS balance
        FROM user_safety_statuses AS s JOIN users AS u ON u.source_id = s.user_id WHERE ${predicate}
        ORDER BY trust_score, s.source_id LIMIT 100`).all<Row>();
      adminOk(res, results.map(row => ({ ...presentSafety(row), userId: {
        ...profile(row.user), ...(route === "wallets" ? { walletBalance: row.balance } : {})
      } })));
    }));
  }
  router.get("/fraud/suspicious-rooms", guard("rooms.read"), asyncHandler(async (_req, res) => {
    adminOk(res, await roomList("AND r.participant_count >= 50", 100));
  }));
  router.post("/fraud/users/:userId/review", guard("reports.resolve"), validateBody(reportReviewSchema), asyncHandler(async (req, res) => {
    if (!isValidObjectId(req.params.userId)) throw new HttpError(400, "Invalid userId", ErrorCode.VALIDATION);
    const id = req.params.userId.toLowerCase();
    if (!await db.prepare("SELECT 1 FROM users WHERE source_id = ?").bind(id).first()) {
      throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
    }
    const admin = adminFrom(res);
    const safety = presentSafety(await refreshSafetyStatus(db, id, admin.id));
    await insertD1AdminAudit(db, admin, { action: "fraud.user_reviewed", entityType: "user_safety_status",
      entityId: safety?._id ? String(safety._id) : undefined, targetUserId: id, metadata: { notes: req.body.notes }, req });
    adminOk(res, { safety });
  }));

  router.get("/referrals/stats", canAnalyze, asyncHandler(async (_req, res) => {
    const [summary, top] = await db.batch<Row>([
      db.prepare(`SELECT COUNT(*) AS totalReferrals, COUNT(*) FILTER (WHERE status = 'REWARDED') AS rewardedReferrals,
        COALESCE(SUM(reward_coins) FILTER (WHERE status = 'REWARDED'), 0) AS totalCoins FROM referrals`),
      db.prepare(`WITH counts AS (SELECT referrer_id AS _id, COUNT(*) AS count, COALESCE(SUM(reward_coins),0) AS coins
        FROM referrals WHERE status = 'REWARDED' GROUP BY referrer_id ORDER BY count DESC, referrer_id LIMIT 20)
        SELECT counts.*, ${personJson("u")} AS user FROM counts JOIN users AS u ON u.source_id = counts._id ORDER BY count DESC, _id`)
    ]);
    adminOk(res, { ...summary.results[0], topReferrers: top.results.map(({ user, ...row }) => ({ ...row, user: profile(user) })) });
  }));
  router.get("/referrals", canAnalyze, asyncHandler(async (req, res) => {
    const { page, limit } = pageParams(req.query);
    const current = Math.min(Math.trunc(Number.MAX_SAFE_INTEGER / 100), Math.trunc(page));
    const size = Math.trunc(limit);
    const status = typeof req.query.status === "string" ? req.query.status : null;
    const code = typeof req.query.referralCode === "string" ? req.query.referralCode.toUpperCase() : null;
    const filter = "WHERE (?1 IS NULL OR r.status = ?1) AND (?2 IS NULL OR r.referral_code = ?2)";
    const [rows, total] = await db.batch<Row>([
      db.prepare(`SELECT r.*, ${personJson("u")} AS referrer,
        CASE WHEN peer.source_id IS NOT NULL THEN ${personJson("peer")} END AS referred FROM referrals AS r
        JOIN users AS u ON u.source_id = r.referrer_id LEFT JOIN users AS peer ON peer.source_id = r.referred_user_id
        ${filter} ORDER BY r.created_at DESC, r.source_id DESC LIMIT ?3 OFFSET ?4`)
        .bind(status, code, size, (current - 1) * size),
      db.prepare(`SELECT COUNT(*) AS count FROM referrals AS r ${filter}`).bind(status, code)
    ]);
    const referrals = rows.results.map(row => ({ _id: row.source_id, referrerId: profile(row.referrer), referredUserId: profile(row.referred),
      referralCode: row.referral_code, status: row.status, rewardCoins: row.reward_coins, rewardCosmeticId: row.reward_cosmetic_id,
      completedAt: row.completed_at, rewardedAt: row.rewarded_at, createdAt: row.created_at, updatedAt: row.updated_at }));
    adminOk(res, { referrals, meta: paginationMeta(current, size, Number(total.results[0].count)) });
  }));
  return router;
}
