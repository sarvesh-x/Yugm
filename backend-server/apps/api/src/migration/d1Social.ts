import type { D1Database } from "@cloudflare/workers-types";
import { randomBytes } from "node:crypto";
import { xpDailyCaps, xpEvents } from "@yugm/shared";
import { Router, type Request } from "express";
import { requireHttpSession } from "../middleware/httpAccessSession.js";
import { startOfUtcDay } from "../services/dailyWalletReward.js";
import { asyncHandler, ErrorCode, HttpError, sendOk } from "../utils/http.js";
import { bindD1LiveUser, createD1AccessSessionReader, d1LiveUserFilter } from "./d1AccessSession.js";
import { d1UserId, person, personJson, visiblePerson } from "./d1People.js";
import { prepareD1XpGrant, type D1GuardedStatement } from "./d1XpGrant.js";
import { readD1HostRooms } from "./d1Rooms.js";

type PersonRow = { person_json: string };
type FriendshipRow = { source_id: string; user_id: string; friend_id: string; status: "ACCEPTED" | "PENDING" | "BLOCKED"; created_at: string | null; updated_at: string | null };
type ActorRow = { xp: number; stored_level: number; wallet_balance: number; last_daily_check_in_at: string | null };

const followEvent = "FOLLOW_USER";
const followXp = xpEvents[followEvent];
const followDailyCap = xpDailyCaps[followEvent]!;
const readDailyFollowXp = `SELECT COALESCE(SUM(amount), 0) AS amount FROM xp_daily_caps
  WHERE user_id = ? AND event = ? AND day = ?`;
const followClaim = "EXISTS (SELECT 1 FROM follows WHERE source_id = ?)";
const removedFollowClaim = "NOT EXISTS (SELECT 1 FROM follows WHERE source_id = ?)";
const newId = () => randomBytes(12).toString("hex");

function friendship(row: FriendshipRow) {
  return {
    _id: row.source_id, userId: row.user_id, friendId: row.friend_id, status: row.status,
    createdAt: row.created_at ?? undefined, updatedAt: row.updated_at ?? undefined
  };
}

export function createD1SocialRouter(db: D1Database) {
  const router = Router();
  const access = createD1AccessSessionReader(db, "http");
  const authenticate = (req: Request) => requireHttpSession(req.headers.authorization, access);
  const accessibleOwner = `EXISTS (SELECT 1 FROM users AS owner WHERE owner.source_id = ?1 AND ${visiblePerson("owner", "?2")})`;
  const currentActor = `EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL)`;
  const pair = "((f.user_id = ?1 AND f.friend_id = ?2) OR (f.friend_id = ?1 AND f.user_id = ?2))";
  const acceptedFriends = (ownerColumn: string, viewerColumn: string) => `SELECT ${personJson("peer")} AS person_json
    FROM friendships AS f JOIN users AS peer ON peer.source_id = CASE WHEN f.${ownerColumn} = ?1 THEN f.${viewerColumn} ELSE f.${ownerColumn} END
    WHERE f.status = 'ACCEPTED' AND (f.user_id = ?1 OR f.friend_id = ?1) AND ${visiblePerson("peer", "?2")}
    ORDER BY f.updated_at DESC, f.source_id DESC LIMIT 100`;

  router.get("/users/me/friends", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const { results } = await db.prepare(acceptedFriends("user_id", "friend_id")).bind(user.id, user.id).all<PersonRow>();
    sendOk(res, { users: results.map(row => person(row.person_json)) });
  }));

  router.get("/users/me/blocked", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const { results } = await db.prepare(`SELECT ${personJson("peer")} AS person_json FROM blocks AS b
      JOIN users AS peer ON peer.source_id = b.blocked_user_id WHERE b.blocker_id = ?
      ORDER BY b.created_at DESC, b.source_id`).bind(user.id).all<PersonRow>();
    sendOk(res, { users: results.map(row => person(row.person_json)) });
  }));

  router.get("/users/:id/friends", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const { results } = await db.prepare(acceptedFriends("user_id", "friend_id"))
      .bind(d1UserId(req.params.id), user.id).all<PersonRow>();
    sendOk(res, { users: results.map(row => person(row.person_json)) });
  }));

  for (const direction of ["followers", "following"] as const) {
    const followerList = direction === "followers";
    const ownerColumn = followerList ? "following_id" : "follower_id";
    const peerColumn = followerList ? "follower_id" : "following_id";
    router.get(`/users/:id/${direction}`, asyncHandler(async (req, res) => {
      const { user } = await authenticate(req);
      const limit = Math.trunc(Math.min(Math.max(Number(req.query.limit) || 50, 1), 100));
      const { results } = await db.prepare(`SELECT ${personJson("peer", true)} AS person_json
        FROM follows AS f JOIN users AS peer ON peer.source_id = f.${peerColumn}
        WHERE f.${ownerColumn} = ?1 AND ${accessibleOwner} AND ${visiblePerson("peer", "?2")}
        ORDER BY f.created_at DESC, f.source_id DESC LIMIT ?3`)
        .bind(d1UserId(req.params.id), user.id, limit).all<PersonRow>();
      const users = results.map(row => person(row.person_json));
      sendOk(res, { [direction]: users, users });
    }));
  }

  router.get("/users/:id/rooms", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const rooms = await readD1HostRooms(db, d1UserId(req.params.id), user.id, req.query.limit);
    sendOk(res, { rooms });
  }));

  router.get("/users/:id/pk-stats", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = d1UserId(req.params.id);
    const { results } = await db.prepare(`SELECT b.winner_user_id, b.winner_side,
      CASE WHEN b.left_host_id = ?1 THEN b.left_score ELSE b.right_score END AS score
      FROM pk_battles AS b WHERE b.status IN ('ENDED', 'FORCE_ENDED')
        AND (b.left_host_id = ?1 OR b.right_host_id = ?1) AND ${accessibleOwner}
      ORDER BY COALESCE(b.ended_at, b.created_at), b.source_id`)
      .bind(id, user.id).all<{ winner_user_id: string | null; winner_side: string | null; score: number }>();
    let wins = 0, draws = 0, currentStreak = 0, bestStreak = 0, totalScore = 0, bestBattle = 0;
    for (const battle of results) {
      if (battle.winner_user_id === id) {
        wins++;
        bestStreak = Math.max(bestStreak, ++currentStreak);
      } else if (battle.winner_side === "DRAW") {
        draws++;
      } else {
        currentStreak = 0;
      }
      totalScore += battle.score;
      bestBattle = Math.max(bestBattle, battle.score);
    }
    const played = results.length;
    sendOk(res, { stats: { played, wins, losses: played - wins - draws, draws, totalScore, bestBattle, bestStreak,
      winRate: played ? Math.round(wins / played * 100) : 0 } });
  }));

  router.get("/friends", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const { results } = await db.prepare(`SELECT ${personJson("peer", true)} AS person_json
      FROM friendships AS f JOIN users AS peer ON peer.source_id = CASE WHEN f.user_id = ?1 THEN f.friend_id ELSE f.user_id END
      WHERE f.status = 'ACCEPTED' AND (f.user_id = ?1 OR f.friend_id = ?1) AND ${visiblePerson("peer", "?1")}
      ORDER BY f.updated_at DESC, f.source_id DESC`).bind(user.id).all<PersonRow>();
    sendOk(res, { friends: results.map(row => person(row.person_json)) });
  }));

  for (const list of ["requests", "sent"] as const) {
    const incoming = list === "requests";
    const mine = incoming ? "friend_id" : "user_id";
    const theirs = incoming ? "user_id" : "friend_id";
    const field = incoming ? "userId" : "friendId";
    router.get(`/friends/${list}`, asyncHandler(async (req, res) => {
      const { user } = await authenticate(req);
      const { results } = await db.prepare(`SELECT f.*, ${personJson("peer")} AS person_json
        FROM friendships AS f JOIN users AS peer ON peer.source_id = f.${theirs}
        WHERE f.status = 'PENDING' AND f.${mine} = ?1 AND ${visiblePerson("peer", "?1")}
        ORDER BY f.created_at DESC, f.source_id DESC`).bind(user.id).all<FriendshipRow & PersonRow>();
      sendOk(res, { [list]: results.map(row => ({ ...friendship(row), [field]: person(row.person_json) })) });
    }));
  }

  router.get("/friends/status/:userId", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const id = d1UserId(req.params.userId);
    const row = await db.prepare(`SELECT f.* FROM friendships AS f
      WHERE ${pair}
        AND ${accessibleOwner} ORDER BY f.updated_at DESC, f.source_id DESC LIMIT 1`).bind(id, user.id).first<FriendshipRow>();
    const status = row?.status === "PENDING" && row.user_id === user.id ? "SENT" : row?.status ?? "NONE";
    sendOk(res, { status, friendship: row ? friendship(row) : null });
  }));

  router.get("/friends/count/:userId", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const count = await db.prepare(`SELECT COUNT(*) AS count FROM friendships AS f
      JOIN users AS peer ON peer.source_id = CASE WHEN f.user_id = ?1 THEN f.friend_id ELSE f.user_id END
      WHERE f.status = 'ACCEPTED' AND (f.user_id = ?1 OR f.friend_id = ?1)
        AND ${accessibleOwner} AND ${visiblePerson("peer", "?2")}`).bind(d1UserId(req.params.userId), user.id).first<number>("count");
    sendOk(res, { count });
  }));

  router.get("/friends/mutual/:userId", asyncHandler(async (req, res) => {
    const { user } = await authenticate(req);
    const { results } = await db.prepare(`WITH mutual_ids(id) AS (
      SELECT CASE WHEN user_id = ?1 THEN friend_id ELSE user_id END FROM friendships
      WHERE status = 'ACCEPTED' AND (user_id = ?1 OR friend_id = ?1)
      INTERSECT
      SELECT CASE WHEN user_id = ?2 THEN friend_id ELSE user_id END FROM friendships
      WHERE status = 'ACCEPTED' AND (user_id = ?2 OR friend_id = ?2)
    ) SELECT ${personJson("peer")} AS person_json, COUNT(*) OVER () AS total
      FROM users AS peer JOIN mutual_ids ON peer.source_id = mutual_ids.id
      WHERE ${accessibleOwner} AND ${visiblePerson("peer", "?2")}
      ORDER BY peer.source_id LIMIT 6`).bind(d1UserId(req.params.userId), user.id).all<PersonRow & { total: number }>();
    sendOk(res, { mutualCount: results[0]?.total ?? 0, mutual: results.map(row => person(row.person_json)) });
  }));

  router.post("/friends/request/:userId", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const id = d1UserId(req.params.userId);
    if (id === user.id) throw new HttpError(400, "Cannot friend yourself", ErrorCode.VALIDATION);
    const time = new Date().toISOString();
    const requestId = randomBytes(12).toString("hex");
    const [created] = await db.batch<FriendshipRow>([
      db.prepare(`INSERT INTO friendships (source_id, user_id, friend_id, status, created_at, updated_at)
        SELECT ?3, ?2, peer.source_id, 'PENDING', ?4, ?4 FROM users AS peer
        WHERE peer.source_id = ?1 AND ${visiblePerson("peer", "?2")} AND ${currentActor}
          AND NOT EXISTS (SELECT 1 FROM friendships AS f WHERE ${pair}) RETURNING *`)
        .bind(id, user.id, requestId, time, ...bindD1LiveUser(claims, time)),
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?, f.friend_id, 'FRIEND_REQUEST', 'Friend Request', u.name || ' sent you a friend request',
          json_object('userId', f.user_id, 'friendshipId', f.source_id), 0, ?, ?
        FROM friendships AS f JOIN users AS u ON u.source_id = f.user_id WHERE f.source_id = ?`)
        .bind(randomBytes(12).toString("hex"), time, time, requestId)
    ]);
    if (!created.results.length) {
      await authenticate(req);
      const target = await db.prepare(`SELECT ${visiblePerson("peer", "?2")} AS available FROM users AS peer
        WHERE peer.source_id = ?1`).bind(id, user.id).first<{ available: number }>();
      if (!target) throw new HttpError(404, "User not found", ErrorCode.NOT_FOUND);
      const existing = await db.prepare(`SELECT status FROM friendships AS f WHERE ${pair} LIMIT 1`).bind(id, user.id)
        .first<FriendshipRow["status"]>("status");
      if (!target.available || existing === "BLOCKED") {
        throw new HttpError(403, "Cannot send friend request to this user", ErrorCode.FORBIDDEN);
      }
      throw new HttpError(409, existing === "ACCEPTED" ? "Already friends" : "Friend request already pending", ErrorCode.CONFLICT);
    }
    sendOk(res, { friendship: friendship(created.results[0]) }, 201);
  }));

  router.post("/friends/accept/:userId", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const id = d1UserId(req.params.userId);
    const time = new Date().toISOString();
    const noticeId = randomBytes(12).toString("hex");
    // The notice records the exact pending row accepted by this transaction.
    const [, accepted] = await db.batch<FriendshipRow>([
      db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
        SELECT ?3, f.user_id, 'FRIEND_ACCEPT', 'Friend Request Accepted', actor.name || ' accepted your friend request',
          json_object('userId', f.friend_id, 'friendshipId', f.source_id), 0, ?4, ?4
        FROM friendships AS f JOIN users AS peer ON peer.source_id = f.user_id
        JOIN users AS actor ON actor.source_id = f.friend_id
        WHERE f.user_id = ?1 AND f.friend_id = ?2 AND f.status = 'PENDING'
          AND ${visiblePerson("peer", "?2")} AND ${currentActor}
        ORDER BY f.created_at DESC, f.source_id DESC LIMIT 1`)
        .bind(id, user.id, noticeId, time, ...bindD1LiveUser(claims, time)),
      db.prepare(`UPDATE friendships SET status = 'ACCEPTED', updated_at = ?
        WHERE source_id = (SELECT json_extract(data, '$.friendshipId') FROM notifications WHERE source_id = ?)
        RETURNING *`).bind(time, noticeId)
    ]);
    if (!accepted.results.length) {
      await authenticate(req);
      throw new HttpError(404, "Friend request not found", ErrorCode.NOT_FOUND);
    }
    sendOk(res, { friendship: friendship(accepted.results[0]) });
  }));

  for (const action of ["decline", "unfriend"] as const) {
    const decline = action === "decline";
    const condition = decline ? "f.user_id = ?1 AND f.friend_id = ?2 AND f.status = 'PENDING'" : `${pair} AND f.status = 'ACCEPTED'`;
    router.post(`/friends/${action}/:userId`, asyncHandler(async (req, res) => {
      const { claims, user } = await authenticate(req);
      const time = new Date().toISOString();
      const result = await db.prepare(`DELETE FROM friendships WHERE source_id IN (
        SELECT f.source_id FROM friendships AS f WHERE ${condition} AND ${currentActor}
      )`).bind(d1UserId(req.params.userId), user.id, ...bindD1LiveUser(claims, time)).run();
      if (!result.meta.changes) {
        await authenticate(req);
        throw new HttpError(404, decline ? "Friend request not found" : "Friendship not found", ErrorCode.NOT_FOUND);
      }
      sendOk(res, decline ? { declined: true } : { unfriended: true });
    }));
  }

  router.post("/users/:id/follow", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const id = d1UserId(req.params.id);
    if (id === user.id) throw new HttpError(400, "You cannot follow yourself", ErrorCode.VALIDATION);
    const actionKey = `follow:${user.id}:${id}`;
    const grant = await db.prepare(`SELECT status, receipt FROM xp_grants
      WHERE user_id = ? AND event = ? AND action_key = ?`).bind(user.id, followEvent, actionKey)
      .first<{ status: string; receipt: string | null }>();
    if (grant && (grant.status !== "COMPLETE" || !grant.receipt)) {
      throw new HttpError(409, "Follow reward requires reconciliation", ErrorCode.CONFLICT);
    }
    const replayed = grant ? { ...JSON.parse(grant.receipt!) as Record<string, unknown>, duplicate: true } : undefined;

    for (let attempt = 0; attempt < 4; attempt++) {
      const now = new Date();
      const time = now.toISOString();
      const day = startOfUtcDay(now).toISOString();
      const [actor, target, daily] = await db.batch([
        db.prepare(`SELECT u.xp, u.level AS stored_level, u.wallet_balance, u.last_daily_check_in_at
          FROM users AS u WHERE ${d1LiveUserFilter} AND u.deletion_requested_at IS NULL`)
          .bind(...bindD1LiveUser(claims, time)),
        db.prepare(`SELECT target.source_id FROM users AS target
          WHERE target.source_id = ?1 AND ${visiblePerson("target", "?2")}`).bind(id, user.id),
        db.prepare(readDailyFollowXp).bind(user.id, followEvent, day)
      ]);
      const actorRow = actor.results[0] as ActorRow | undefined;
      if (!actorRow) {
        await authenticate(req);
        throw new HttpError(403, "Cannot follow this user", ErrorCode.FORBIDDEN);
      }
      if (!target.results.length) {
        await authenticate(req);
        const exists = await db.prepare("SELECT 1 FROM users WHERE source_id = ?").bind(id).first();
        throw new HttpError(exists ? 403 : 404, exists ? "Cannot follow this user" : "User not found",
          exists ? ErrorCode.FORBIDDEN : ErrorCode.NOT_FOUND);
      }
      const earnedToday = (daily.results[0] as { amount: number }).amount;
      const xpAwarded = replayed ? 0 : Math.min(followXp, Math.max(0, followDailyCap - earnedToday));
      const followId = newId();
      const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, followId);
      const claim = db.prepare(`INSERT INTO follows (source_id, follower_id, following_id, created_at, updated_at)
        SELECT ?, ?, ?, ?, ?
        WHERE EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}
          AND u.deletion_requested_at IS NULL AND u.xp = ? AND u.level = ?
          AND u.wallet_balance = ? AND u.last_daily_check_in_at IS ?)
          AND EXISTS (SELECT 1 FROM users AS target WHERE target.source_id = ? AND ${visiblePerson("target", "?")})
          AND NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?)
          AND (${readDailyFollowXp}) = ?`)
        .bind(followId, user.id, id, time, time, ...bindD1LiveUser(claims, time),
          actorRow.xp, actorRow.stored_level, actorRow.wallet_balance, actorRow.last_daily_check_in_at,
          id, user.id, user.id, user.id, id, user.id, followEvent, day, earnedToday);
      const statements = [
        claim,
        write(`UPDATE users SET following_count = following_count + 1, updated_at = ?
          WHERE source_id = ? AND ${followClaim}`, time, user.id),
        write(`UPDATE users SET followers_count = followers_count + 1, updated_at = ?
          WHERE source_id = ? AND ${followClaim}`, time, id),
        write(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
          SELECT ?, ?, 'FOLLOW', 'New Follower',
            (SELECT name FROM users WHERE source_id = ?) || ' started following you',
            json_object('userId', ?), 0, ?, ? WHERE ${followClaim}`,
        newId(), id, user.id, user.id, time, time)
      ];
      let progress;
      if (!replayed) {
        progress = prepareD1XpGrant(write, followClaim, now, {
          userId: user.id, event: followEvent, actionKey, requestedXp: followXp, xpAwarded,
          previousXp: actorRow.xp, previousLevel: actorRow.stored_level,
          lastDailyCheckInAt: actorRow.last_daily_check_in_at ?? undefined, balanceBefore: actorRow.wallet_balance,
          cap: { capped: earnedToday + xpAwarded >= followDailyCap, cap: followDailyCap,
            earnedToday: earnedToday + xpAwarded, remainingToday: Math.max(0, followDailyCap - earnedToday - xpAwarded) }
        });
        statements.push(...progress.statements);
        if (xpAwarded > 0) {
          statements.push(
            write(`UPDATE xp_daily_caps SET amount = amount + ?, updated_at = ? WHERE source_id = (
              SELECT source_id FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ? ORDER BY source_id LIMIT 1
            ) AND ${followClaim}`, xpAwarded, time, user.id, followEvent, day),
            write(`INSERT INTO xp_daily_caps (source_id, user_id, event, day, amount, created_at, updated_at)
              SELECT ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
                SELECT 1 FROM xp_daily_caps WHERE user_id = ? AND event = ? AND day = ?
              ) AND ${followClaim}`, newId(), user.id, followEvent, day, xpAwarded, time, time, user.id, followEvent, day)
          );
        }
      }
      const [claimed] = await db.batch(statements);
      if (claimed.meta.changes) {
        const xpGrant = replayed ?? progress?.xpGrant;
        sendOk(res, { following: true, ...(xpGrant ? { xpGrant } : {}) });
        return;
      }
    }
    await authenticate(req);
    const existing = await db.prepare("SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?")
      .bind(user.id, id).first();
    if (existing) {
      sendOk(res, { following: true, ...(replayed ? { xpGrant: replayed } : {}) });
      return;
    }
    const target = await db.prepare("SELECT 1 FROM users WHERE source_id = ?").bind(id).first();
    throw new HttpError(target ? 403 : 404, target ? "Cannot follow this user" : "User not found",
      target ? ErrorCode.FORBIDDEN : ErrorCode.NOT_FOUND);
  }));

  router.delete("/users/:id/follow", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const id = d1UserId(req.params.id);
    const time = new Date().toISOString();
    const result = await db.prepare(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?
      AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}) RETURNING source_id`)
      .bind(user.id, id, ...bindD1LiveUser(claims, time)).all<{ source_id: string }>();
    const follow = result.results[0];
    if (follow) {
      const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, follow.source_id);
      await db.batch([
        write(`UPDATE users SET following_count = CASE WHEN following_count > 0 THEN following_count - 1 ELSE 0 END,
          updated_at = ? WHERE source_id = ? AND ${removedFollowClaim}`, time, user.id),
        write(`UPDATE users SET followers_count = CASE WHEN followers_count > 0 THEN followers_count - 1 ELSE 0 END,
          updated_at = ? WHERE source_id = ? AND ${removedFollowClaim}`, time, id),
        write(`INSERT INTO notifications (source_id, user_id, type, title, body, data, read, created_at, updated_at)
          SELECT ?, ?, 'FOLLOW', 'A follower left',
            (SELECT name FROM users WHERE source_id = ?) || ' unfollowed you',
            json_object('userId', ?, 'action', 'UNFOLLOW'), 0, ?, ? WHERE ${removedFollowClaim}`,
        newId(), id, user.id, user.id, time, time)
      ]);
    } else {
      await authenticate(req);
    }
    sendOk(res, { following: false });
  }));

  router.delete("/users/me/followers/:id", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const id = d1UserId(req.params.id);
    if (id === user.id) throw new HttpError(400, "Invalid follower", ErrorCode.VALIDATION);
    const time = new Date().toISOString();
    const result = await db.prepare(`DELETE FROM follows WHERE follower_id = ? AND following_id = ?
      AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}) RETURNING source_id`)
      .bind(id, user.id, ...bindD1LiveUser(claims, time)).all<{ source_id: string }>();
    const follow = result.results[0];
    if (follow) {
      const write: D1GuardedStatement = (sql, ...values) => db.prepare(sql).bind(...values, follow.source_id);
      await db.batch([
        write(`UPDATE users SET following_count = CASE WHEN following_count > 0 THEN following_count - 1 ELSE 0 END,
          updated_at = ? WHERE source_id = ? AND ${removedFollowClaim}`, time, id),
        write(`UPDATE users SET followers_count = CASE WHEN followers_count > 0 THEN followers_count - 1 ELSE 0 END,
          updated_at = ? WHERE source_id = ? AND ${removedFollowClaim}`, time, user.id)
      ]);
    } else {
      await authenticate(req);
    }
    sendOk(res, { removed: true });
  }));

  router.post("/users/:id/block", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const id = d1UserId(req.params.id);
    if (id === user.id) throw new HttpError(400, "You cannot block yourself", ErrorCode.VALIDATION);
    const time = new Date().toISOString();
    const result = await db.prepare(`INSERT INTO blocks (source_id, blocker_id, blocked_user_id, created_at, updated_at)
      SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (
        SELECT 1 FROM blocks WHERE blocker_id = ? AND blocked_user_id = ?
      ) AND EXISTS (
        SELECT 1 FROM users AS target WHERE target.source_id = ? AND target.deletion_requested_at IS NULL
      ) AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}) RETURNING source_id`)
      .bind(newId(), user.id, id, time, time, user.id, id, id, ...bindD1LiveUser(claims, time)).all();
    if (!result.results.length) await authenticate(req);
    sendOk(res, { blocked: true });
  }));

  router.delete("/users/:id/block", asyncHandler(async (req, res) => {
    const { claims, user } = await authenticate(req);
    const id = d1UserId(req.params.id);
    const time = new Date().toISOString();
    const result = await db.prepare(`DELETE FROM blocks WHERE blocker_id = ? AND blocked_user_id = ?
      AND EXISTS (SELECT 1 FROM users AS u WHERE ${d1LiveUserFilter}) RETURNING source_id`)
      .bind(user.id, id, ...bindD1LiveUser(claims, time)).all();
    if (!result.results.length) await authenticate(req);
    sendOk(res, { blocked: false });
  }));

  return router;
}
