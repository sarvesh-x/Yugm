import assert from "node:assert/strict";
import { createHash, createHmac, randomBytes } from "node:crypto";

const newId = () => randomBytes(12).toString("hex");
const livekitKey = "fixture-livekit-key";
const livekitSecret = "fixture-livekit-secret";

function readLiveKitToken(token) {
  const [header, payload, signature] = token.split(".");
  assert.equal(createHmac("sha256", livekitSecret).update(`${header}.${payload}`).digest("base64url"), signature);
  return {
    header: JSON.parse(Buffer.from(header, "base64url").toString("utf8")),
    payload: JSON.parse(Buffer.from(payload, "base64url").toString("utf8"))
  };
}

export async function verifyD1AppEndpoints(db, request, owner, visitor, gamer = owner, worker) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const gamerId = gamer.user.id;
  const now = new Date();
  const time = now.toISOString();
  const beforeJoin = new Date(now.getTime() - 60_000).toISOString();
  const requestAs = (account, path, status, options = {}) =>
    request(path, status, { accessToken: account.accessToken, ...options });

  const visits = `/api/users/${ownerId}/visitors`;
  await request(visits, 401);
  await requestAs(visitor, visits, 403);
  const priorVip = await db.prepare("SELECT vip_level, vip_tier, vip_expires_at, vip_frozen FROM users WHERE source_id = ?").bind(ownerId).first();
  await db.prepare("UPDATE users SET vip_level = 0, vip_tier = NULL, vip_expires_at = NULL, vip_frozen = 0 WHERE source_id = ?").bind(ownerId).run();
  await requestAs(owner, visits, 403);
  await db.prepare("UPDATE users SET vip_level = 1, vip_tier = 'VIP1', vip_expires_at = ?, vip_frozen = 0 WHERE source_id = ?")
    .bind(new Date(now.getTime() + 86_400_000).toISOString(), ownerId).run();
  try {
    await db.prepare(`INSERT INTO profile_visits (source_id, profile_id, visitor_id, last_visited_at)
      VALUES (?, ?, ?, ?) ON CONFLICT(profile_id, visitor_id) DO UPDATE SET last_visited_at = excluded.last_visited_at`)
      .bind(newId(), ownerId, visitorId, time).run();
    const listed = (await requestAs(owner, visits, 200)).data.users;
    assert.ok(listed.some(user => user._id === visitorId && user.visitedAt === time));
  } finally {
    await db.prepare("UPDATE users SET vip_level = ?, vip_tier = ?, vip_expires_at = ?, vip_frozen = ? WHERE source_id = ?")
      .bind(priorVip.vip_level, priorVip.vip_tier, priorVip.vip_expires_at, priorVip.vip_frozen, ownerId).run();
  }
  const stats = (await requestAs(owner, `/api/users/${visitorId}/stats`, 200)).data;
  assert.equal(stats.roomsHosted, await db.prepare("SELECT COUNT(*) AS count FROM rooms WHERE host_id = ?").bind(visitorId).first("count"));
  assert.equal(stats.roomsLive, await db.prepare("SELECT COUNT(*) AS count FROM rooms WHERE host_id = ? AND status = 'LIVE'").bind(visitorId).first("count"));
  const feedback = (await requestAs(owner, "/api/users/me/feedback", 201, {
    body: { category: "BUG", subject: "Fixture support question", message: "Fixture feedback message." }
  })).data.ticket;
  try {
    assert.equal(feedback.category, "Technical");
    assert.equal(feedback.messages[0].senderId, ownerId);
    assert.equal((await requestAs(owner, `/api/support/tickets/${feedback._id}`, 200)).data.ticket.lastMessageAt, feedback.lastMessageAt);
    await requestAs(visitor, `/api/support/tickets/${feedback._id}`, 404);
  } finally {
    await db.batch([
      db.prepare("DELETE FROM support_ticket_messages WHERE support_tickets_id = ?").bind(feedback._id),
      db.prepare("DELETE FROM support_tickets WHERE source_id = ?").bind(feedback._id)
    ]);
  }

  const deviceToken = "fixture-device-" + newId();
  const device = "/api/notifications/device-token";
  await request(device, 401, { body: { token: deviceToken, platform: "android" } });
  await requestAs(owner, device, 422, { body: { token: "bad", platform: "android" } });
  const registered = (await requestAs(owner, device, 200, { body: { token: deviceToken, platform: "android" } })).data.token;
  const repeated = (await requestAs(owner, device, 200, { body: { token: deviceToken, platform: "android" } })).data.token;
  assert.equal(registered._id, repeated._id);
  assert.equal(repeated.userId, ownerId);
  await requestAs(visitor, device, 403, { body: { token: deviceToken, platform: "android" } });
  await requestAs(visitor, device + "/remove", 200, { body: { token: deviceToken } });
  assert.equal(await db.prepare("SELECT user_id FROM device_tokens WHERE token = ?").bind(deviceToken).first("user_id"), ownerId);
  await requestAs(owner, device + "/remove", 200, { body: { token: deviceToken } });
  assert.equal(await db.prepare("SELECT 1 FROM device_tokens WHERE token = ?").bind(deviceToken).first(), null);

  const notice = newId();
  await db.prepare(`INSERT INTO notifications (source_id, user_id, type, title, body, read, created_at, updated_at)
    VALUES (?, ?, 'SYSTEM', 'Fixture', 'Inbox click', 0, ?, ?)`).bind(notice, ownerId, time, time).run();
  const click = "/api/notifications/track/" + notice + "/click";
  assert.equal((await requestAs(visitor, click, 200, { body: {} })).data.tracked, false);
  assert.equal((await requestAs(owner, click, 200, { body: {} })).data.tracked, true);
  assert.equal(await db.prepare("SELECT read FROM notifications WHERE source_id = ?").bind(notice).first("read"), 1);

  const wallet = "/api/wallet";
  const packs = await requestAs(owner, wallet + "/packs", 200);
  assert.ok(packs.data.packs.length > 0);
  const before = (await requestAs(owner, wallet, 200)).data;
  const vip = (await requestAs(owner, wallet + "/vip/plans", 200)).data;
  assert.ok(vip.plans.length > 0);
  assert.equal(vip.balance, before.balance);
  const reward = wallet + "/rewards/daily";
  const claims = await Promise.all(Array.from({ length: 4 }, () => requestAs(owner, reward, [200, 201], { body: {} })));
  assert.equal(claims.filter(result => result.data.claimed).length, 1);
  assert.equal(claims.filter(result => result.data.alreadyClaimed).length, 3);
  assert.ok(claims.every(result => result.data.balance === before.balance + 25 && result.data.rewardCoins === 25));
  assert.equal((await requestAs(owner, wallet, 200)).data.dailyReward.canClaim, false);
  const transactions = (await requestAs(owner, wallet + "/transactions", 200)).data.transactions;
  const dailyTransactions = transactions.filter(row => row.source === "DAILY_REWARD");
  assert.equal(dailyTransactions.length, 1);
  assert.equal(dailyTransactions[0].amount, 25);
  assert.equal(dailyTransactions[0].balanceBefore, before.balance);
  assert.equal(dailyTransactions[0].balanceAfter, before.balance + 25);
  const visitorTransactions = (await requestAs(visitor, wallet + "/transactions", 200)).data.transactions;
  assert.ok(visitorTransactions.every(row => row.userId === visitorId));

  const score = newId();
  await db.prepare(`INSERT INTO mini_game_scores (source_id, user_id, game_id, score, metadata, created_at)
    VALUES (?, ?, 'vibe_tap', 600, '{}', ?)`).bind(score, ownerId, time).run();
  await request("/api/games/catalog", 401);
  const games = (await requestAs(owner, "/api/games/catalog", 200)).data;
  assert.equal(games.games.find(game => game.id === "vibe_tap").best.score, 600);
  assert.equal(games.recent[0]._id, score);
  assert.deepEqual((await requestAs(visitor, "/api/games/catalog", 200)).data.recent, []);

  // Arcade writes: score/XP persistence, challenge lifecycle and score sharing.
  const gamesDay = new Date();
  gamesDay.setUTCHours(0, 0, 0, 0);
  const gamesDayKey = gamesDay.toISOString();
  const gamesStart = new Date().toISOString();
  const gamesScoreIds = [];
  const gamesChallengeIds = [];
  try {
    const earnedBefore = Number((await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS amount FROM xp_daily_caps
      WHERE user_id = ? AND event = 'MINI_GAME_PLAY' AND day = ?`).bind(gamerId, gamesDayKey).first())?.amount ?? 0);
    const gamerXpBefore = await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(gamerId).first("xp");
    const expectedXp = Math.max(0, Math.min(8, 80 - earnedBefore));

    await request("/api/games/scores", 401, { body: { gameId: "vibe_tap", score: 100 } });
    const saved = (await requestAs(gamer, "/api/games/scores", 201, {
      body: { gameId: "vibe_tap", score: 700, durationMs: 9000, rounds: 3, metadata: { streak: 4 } }
    })).data;
    const gamesScoreId = saved.score._id;
    gamesScoreIds.push(gamesScoreId);
    assert.equal(saved.score.score, 700);
    assert.equal(saved.score.durationMs, 9000);
    assert.deepEqual(saved.score.metadata, { streak: 4 });
    assert.equal(saved.score.__v, 0);
    assert.equal(saved.isPersonalBest, true);
    assert.equal(saved.personalBest._id, gamesScoreId);
    assert.equal(saved.reward.event, "MINI_GAME_PLAY");
    assert.equal(saved.reward.xpAwarded, expectedXp);
    assert.equal(await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(gamerId).first("xp"), gamerXpBefore + expectedXp);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM xp_grants
      WHERE user_id = ? AND event = 'MINI_GAME_PLAY' AND action_key = ?`).bind(gamerId, `game-score:${gamesScoreId}`).first("count"), 1);
    assert.equal(Number((await db.prepare(`SELECT COALESCE(SUM(amount), 0) AS amount FROM xp_daily_caps
      WHERE user_id = ? AND event = 'MINI_GAME_PLAY' AND day = ?`).bind(gamerId, gamesDayKey).first())?.amount ?? 0),
    earnedBefore + expectedXp);

    await request("/api/games/challenges", 401, { body: { gameId: "vibe_tap", score: 100, targetUserId: visitorId } });
    await requestAs(visitor, "/api/games/challenges/" + gamesScoreId + "/accept", 404, { body: {} });
    const challenged = (await requestAs(gamer, "/api/games/challenges", 201, {
      body: { gameId: "vibe_tap", score: 123, targetUserId: visitorId, message: "  fixture challenge  " }
    })).data.challenge;
    gamesChallengeIds.push(challenged._id);
    assert.equal(challenged.challengerId, gamerId);
    assert.equal(challenged.targetUserId, visitorId);
    assert.equal(challenged.message, "fixture challenge");
    assert.equal(challenged.expiresAt > new Date().toISOString(), true);
    assert.equal(challenged.createdAt, challenged.updatedAt);
    assert.equal(challenged.__v, 0);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
      WHERE user_id = ? AND title = 'Arcade challenge'`).bind(visitorId).first("count"), 1);

    const accepted = (await requestAs(visitor, "/api/games/challenges/" + challenged._id + "/accept", 200, { body: {} })).data;
    assert.deepEqual(accepted, { accepted: true, gameId: "vibe_tap", score: 123, challengerId: gamerId });
    assert.equal(await db.prepare("SELECT 1 FROM mini_game_challenges WHERE source_id = ?").bind(challenged._id).first(), null);
    assert.equal(await db.prepare("SELECT message FROM direct_messages WHERE sender_id = ? AND receiver_id = ?")
      .bind(visitorId, gamerId).first("message"), "Challenge accepted! I beat your score of 123 in Vibe Tap.");

    const declinedId = newId();
    const future = new Date(Date.now() + 86_400_000).toISOString();
    await db.prepare(`INSERT INTO mini_game_challenges
      (source_id, challenger_id, target_user_id, game_id, score, expires_at, created_at, updated_at)
      VALUES (?, ?, ?, 'reflex_ring', 77, ?, ?, ?)`)
      .bind(declinedId, gamerId, visitorId, future, gamesStart, gamesStart).run();
    gamesChallengeIds.push(declinedId);
    assert.deepEqual((await requestAs(visitor, "/api/games/challenges/" + declinedId + "/decline", 200, { body: {} })).data,
      { declined: true });
    assert.equal(await db.prepare("SELECT 1 FROM mini_game_challenges WHERE source_id = ?").bind(declinedId).first(), null);

    await request("/api/games/scores/" + gamesScoreId + "/share", 401, { body: { targetUserId: visitorId } });
    const shared = (await requestAs(gamer, "/api/games/scores/" + gamesScoreId + "/share", 200, {
      body: { targetUserId: visitorId }
    })).data.message;
    assert.equal(shared.message, "Arcade score: 700 in Vibe Tap. Can you beat it?");
    assert.equal(shared.senderId._id, gamerId);
    assert.equal(shared.receiverId._id, visitorId);
    assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
      WHERE user_id = ? AND title = 'Arcade score shared'`).bind(visitorId).first("count"), 1);
  } finally {
    await db.batch([
      ...gamesChallengeIds.map(challenge => db.prepare("DELETE FROM mini_game_challenges WHERE source_id = ?").bind(challenge)),
      ...gamesScoreIds.map(score => db.prepare("DELETE FROM mini_game_scores WHERE source_id = ?").bind(score)),
      db.prepare("DELETE FROM direct_messages WHERE message IN (?, ?)")
        .bind("Challenge accepted! I beat your score of 123 in Vibe Tap.", "Arcade score: 700 in Vibe Tap. Can you beat it?"),
      db.prepare("DELETE FROM notifications WHERE created_at >= ? AND title IN ('Arcade challenge', 'Arcade score shared', 'Level up!')")
        .bind(gamesStart),
      ...gamesScoreIds.map(score => db.prepare("DELETE FROM xp_grants WHERE action_key = ?").bind(`game-score:${score}`))
    ]);
  }

  const live = newId();
  const privateVideo = newId();
  const scheduled = newId();
  const ended = newId();
  const roomRows = [
    [live, "Yugm Voice", "VOICE", "LIVE", "PUBLIC", 2],
    [privateVideo, "Yugm Private Video", "VIDEO", "LIVE", "PRIVATE", 20],
    [scheduled, "Yugm Scheduled", "VIDEO", "SCHEDULED", "PUBLIC", 0],
    [ended, "Yugm Ended", "VOICE", "ENDED", "PUBLIC", 0]
  ];
  await db.batch([
    ...roomRows.map(([id, title, type, state, visibility, count]) => db.prepare(`INSERT INTO rooms
      (source_id, title, type, host_id, category, tags, language, status, visibility, max_speakers, participant_count,
       is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only, scheduled_for, created_at)
      VALUES (?, ?, ?, ?, 'music', '["Acoustic"]', 'English', ?, ?, 8, ?, 0, ?, 1, 0, 0, ?, ?)`)
      .bind(id, title, type, ownerId, state, visibility, count, id, state === "SCHEDULED" ? time : null, time)),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
      VALUES (?, ?, ?, 'HOST', 1, 0, 0, 0, ?), (?, ?, ?, 'SPEAKER', 0, 1, NULL, 0, ?)`)
      .bind(newId(), live, ownerId, beforeJoin, newId(), live, visitorId, time),
    db.prepare("INSERT INTO room_admins (source_id, value, rooms_id, position) VALUES (?, ?, ?, 0)").bind(newId(), ownerId, live),
    db.prepare(`INSERT INTO speaker_requests (source_id, room_id, user_id, status, created_at)
      VALUES (?, ?, ?, 'PENDING', ?)`).bind(newId(), live, visitorId, time),
    db.prepare(`INSERT INTO chat_messages (source_id, room_id, sender_id, message, type, created_at)
      VALUES (?, ?, ?, 'before joining', 'TEXT', ?), (?, ?, ?, 'visible after join', 'TEXT', ?)`)
      .bind(newId(), live, ownerId, beforeJoin, newId(), live, ownerId, time),
    db.prepare(`INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at)
      VALUES (?, ?, ?, 'JOIN', 'joined', '{"fixture":true}', ?)`).bind(newId(), live, visitorId, time),
    db.prepare(`INSERT INTO follows (source_id, follower_id, following_id, created_at, updated_at)
      SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?)`)
      .bind(newId(), visitorId, ownerId, time, time, visitorId, ownerId),
    db.prepare(`UPDATE users SET following_count = following_count + 1 WHERE source_id = ?
      AND EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?)`)
      .bind(visitorId, visitorId, ownerId),
    db.prepare(`UPDATE users SET followers_count = followers_count + 1 WHERE source_id = ?
      AND EXISTS (SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?)`)
      .bind(ownerId, visitorId, ownerId)
  ]);

  const prefix = "/api/rooms";
  for (const path of ["", "?type=VOICE&category=music", "/trending", "/search?q=acoUSTic"]) {
    const listing = (await request(prefix + path, 200)).data.rooms;
    assert.deepEqual(listing.map(item => item._id), [live]);
    assert.equal(listing[0].hostId._id, ownerId);
  }
  assert.deepEqual((await request(prefix + "?type=VIDEO", 200)).data.rooms, []);
  assert.deepEqual((await request(prefix + "/scheduled", 200)).data.rooms.map(item => item._id), [scheduled]);
  await request(prefix + "/search?q=a", 400);
  const ranking = (await request(prefix + "/leaderboard", 200)).data;
  assert.deepEqual(ranking.topRooms.map(item => item._id), [live]);
  assert.ok(ranking.topHosts.length > 0);
  assert.ok(ranking.topHosts.every(item => !Object.hasOwn(item, "walletBalance")));
  const recommended = (await requestAs(visitor, prefix + "/recommended", 200)).data.rooms;
  assert.ok(recommended.find(item => item._id === live).recommendationHints.includes("You follow the host"));
  await request(prefix + "/" + live, 401);
  const detail = (await requestAs(visitor, prefix + "/" + live, 200)).data;
  assert.equal(detail.room._id, live);
  assert.deepEqual(detail.participants.map(item => item.seatIndex), [0, 1]);
  assert.equal(detail.participants[0].isRoomAdmin, true);
  assert.equal(detail.participants[1].moderatorMuted, true);
  assert.equal(detail.speakerRequests[0].userId._id, visitorId);

  // Discover routes authenticate before parsing and preserve the legacy envelope.
  for (const path of ["/api/discover/presence-count", "/api/discover/trending",
    "/api/discover/recommended", "/api/discover/online-now", "/api/discover/hubs", "/api/discover/hub/English"]) {
    await request(path, 401);
  }
  assert.deepEqual((await requestAs(owner, "/api/discover/presence-count", 200)).data, { count: 0 });
  assert.deepEqual((await requestAs(owner, "/api/discover/online-now?page=abc&limit=abc", 200)).data,
    { users: [], page: 1, limit: 20 });
  const trending = (await requestAs(owner, "/api/discover/trending?limit=100", 200)).data;
  assert.deepEqual(trending.rooms.map(item => item._id), [privateVideo, live]);
  assert.equal(trending.rooms[0].host._id, ownerId);
  assert.equal(trending.rooms[0].hostId, ownerId);
  assert.deepEqual([trending.page, trending.limit], [1, 50]);
  const recommendedDiscover = (await requestAs(owner, "/api/discover/recommended", 200)).data;
  assert.deepEqual(recommendedDiscover.rooms.map(item => item.item._id).sort(), [privateVideo, live].sort());
  assert.ok(recommendedDiscover.users.some(item => item.item._id === visitorId));
  assert.ok(recommendedDiscover.users.every(item => item.reason === "Similar vibe"));
  assert.deepEqual(recommendedDiscover.events, []);
  const hubs = (await requestAs(owner, "/api/discover/hubs", 200)).data.hubs;
  assert.equal(hubs.length, 12);
  assert.equal(hubs.find(item => item.key === "english").count, 2);
  assert.equal(hubs.find(item => item.key === "music").count, 0);
  const hubItems = (await requestAs(owner, "/api/discover/hub/English?limit=100", 200)).data;
  assert.deepEqual(hubItems.items.map(item => item._id), [privateVideo, live]);
  assert.equal(hubItems.limit, 50);
  assert.deepEqual((await requestAs(owner, "/api/discover/hub/english", 200)).data.items.map(item => item._id), [privateVideo, live]);
  assert.deepEqual((await requestAs(visitor, "/api/discover/trending", 200)).data.rooms.map(item => item._id), [live]);
  assert.deepEqual((await requestAs(visitor, "/api/discover/recommended", 200)).data.rooms.map(item => item.item._id), [live]);
  assert.deepEqual((await requestAs(visitor, "/api/discover/hub/english", 200)).data.items.map(item => item._id), [live]);
  assert.equal((await requestAs(visitor, "/api/discover/hubs", 200)).data.hubs.find(item => item.key === "english").count, 1);

  const messages = (await requestAs(visitor, prefix + "/" + live + "/messages", 200)).data.messages;
  assert.deepEqual(messages.map(item => item.message), ["visible after join"]);
  const activity = (await requestAs(visitor, prefix + "/" + live + "/activity", 200)).data.activity;
  assert.equal(activity[0].metadata.fixture, true);
  await requestAs(visitor, prefix + "/" + privateVideo, 403);
  await requestAs(visitor, prefix + "/" + privateVideo + "/followers", 403);
  await db.prepare(`INSERT INTO room_invites (source_id, room_id, inviter_id, invitee_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`).bind(newId(), privateVideo, ownerId, visitorId, time, time).run();
  assert.equal((await requestAs(visitor, prefix + "/" + privateVideo, 200)).data.room.type, "VIDEO");
  assert.deepEqual((await requestAs(visitor, "/api/discover/trending", 200)).data.rooms.map(item => item._id), [privateVideo, live]);
  assert.deepEqual((await requestAs(visitor, prefix + "/" + privateVideo + "/messages", 200)).data.messages, []);
  assert.deepEqual((await requestAs(visitor, prefix + "/" + privateVideo + "/activity", 200)).data.activity, []);

  // Room lifecycle: create/join/controls/end are committed through D1 with guarded XP.
  const roomBody = {
    type: "VOICE", title: "Lifecycle Voice", description: "Fixture", tags: ["Acoustic"],
    language: "English", category: "music", maxSpeakers: 3, visibility: "PUBLIC",
    allowAudienceMicRequests: true, vipOnly: false
  };
  await request(prefix, 401, { body: roomBody });
  await requestAs(owner, prefix, 422, { body: { ...roomBody, title: "" } });
  const ownerXpBeforeRoom = await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(ownerId).first("xp");
  const createdRoom = (await requestAs(owner, prefix, 201, { body: roomBody })).data;
  const lifecycleId = createdRoom.room._id;
  assert.equal(createdRoom.xpGrant.event, "ROOM_CREATE");
  assert.equal(createdRoom.xpGrant.xpAwarded, 40);
  assert.equal(createdRoom.room.status, "LIVE");
  assert.equal(createdRoom.room.participantCount, 1);
  assert.equal(await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(ownerId).first("xp"), ownerXpBeforeRoom + 40);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS total FROM xp_grants
    WHERE user_id = ? AND event = 'ROOM_CREATE' AND action_key = ?`).bind(ownerId, `room-create:${lifecycleId}`).first("total"), 1);
  const visitorXpBeforeRoom = await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(visitorId).first("xp");
  const joins = await Promise.all([
    requestAs(visitor, prefix + "/" + lifecycleId + "/join", 200, { body: {} }),
    requestAs(visitor, prefix + "/" + lifecycleId + "/join", 200, { body: {} })
  ]);
  assert.ok(joins.every(result => result.data.role === "AUDIENCE"));
  assert.equal(joins.filter(result => result.data.xpGrant).length, 1);
  assert.equal(await db.prepare("SELECT participant_count FROM rooms WHERE source_id = ?").bind(lifecycleId).first("participant_count"), 2);
  assert.equal(await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(visitorId).first("xp"), visitorXpBeforeRoom + 10);
  assert.equal((await requestAs(visitor, prefix + "/" + lifecycleId + "/join", 200, { body: {} })).data.xpGrant, undefined);

  if (worker) {
    const upgrade = (account, roomId) => worker.dispatchFetch(`http://127.0.0.1/realtime${roomId ? `?roomId=${roomId}` : ""}`, {
      headers: { Upgrade: "websocket", ...(account ? { Authorization: `Bearer ${account.accessToken}` } : {}) }
    });
    const nextFrame = socket => new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Realtime frame timed out")), 3000);
      socket.addEventListener("message", event => {
        clearTimeout(timeout);
        resolve(JSON.parse(event.data));
      }, { once: true });
    });
    assert.equal((await upgrade()).status, 401);
    assert.equal((await upgrade(visitor, privateVideo)).status, 403);
    const roomUpgrade = await upgrade(owner, lifecycleId);
    assert.equal(roomUpgrade.status, 101);
    const roomSocket = roomUpgrade.webSocket;
    try {
      const ready = nextFrame(roomSocket);
      roomSocket.accept();
      assert.deepEqual(await ready, { v: 1, type: "ready", scope: `room:${lifecycleId}` });
      const incoming = nextFrame(roomSocket);
      const { data: { message } } = await requestAs(visitor, `${prefix}/${lifecycleId}/messages`, 201, {
        body: { message: "Realtime room fixture" }
      });
      const frame = await incoming;
      assert.equal(frame.event, "room:chat:message");
      assert.deepEqual(frame.data.message, message);
    } finally {
      roomSocket.close(1000);
    }
    const membership = await db.prepare(`SELECT source_id, joined_at FROM room_participants
      WHERE room_id = ? AND user_id = ? AND left_at IS NULL`).bind(lifecycleId, visitorId).first();
    await db.prepare("UPDATE room_participants SET joined_at = ? WHERE source_id = ?")
      .bind(new Date(Date.now() + 1000).toISOString(), membership.source_id).run();
    try {
      const rejoined = await upgrade(visitor, lifecycleId);
      assert.equal(rejoined.status, 101);
      const socket = rejoined.webSocket;
      try {
        const ready = nextFrame(socket);
        socket.accept();
        const { scope } = await ready;
        const resumed = nextFrame(socket);
        socket.send(JSON.stringify({ v: 1, type: "resume", scope, afterSeq: 0 }));
        assert.deepEqual(await resumed, { v: 1, type: "resumed", scope });
      } finally {
        socket.close(1000);
      }
    } finally {
      await db.prepare("UPDATE room_participants SET joined_at = ? WHERE source_id = ?")
        .bind(membership.joined_at, membership.source_id).run();
    }
    const userConnections = await Promise.all([upgrade(owner), upgrade(visitor)]);
    assert.deepEqual(userConnections.map(response => response.status), [101, 101]);
    const [senderSocket, receiverSocket] = userConnections.map(response => response.webSocket);
    try {
      const ready = [senderSocket, receiverSocket].map(socket => {
        const frame = nextFrame(socket);
        socket.accept();
        return frame;
      });
      assert.deepEqual((await Promise.all(ready)).map(frame => frame.scope), [`user:${ownerId}`, `user:${visitorId}`]);
      assert.equal((await requestAs(owner, "/api/discover/presence-count", 200)).data.count, 2);
      const online = (await requestAs(owner, "/api/discover/online-now", 200)).data.users;
      assert.deepEqual(online.map(item => item._id), [visitorId]);
      assert.deepEqual((await requestAs(owner, "/api/users/recommended-chat?limit=1.5", 200)).data.users.map(item => item._id), [visitorId]);
      const typing = nextFrame(receiverSocket);
      senderSocket.send(JSON.stringify({ v: 1, type: "typing", channel: "direct", target: visitorId, typing: true }));
      const frame = await typing;
      assert.equal(frame.event, "direct:typing:update");
      assert.deepEqual(frame.data, { userId: ownerId, typing: true });
    } finally {
      senderSocket.close(1000);
      receiverSocket.close(1000);
    }
  }

  const tokenPath = "/api/livekit/token";
  await request(tokenPath, 401, { body: { roomId: lifecycleId } });
  await requestAs(owner, tokenPath, 400, { body: { roomId: "bad" } });
  await requestAs(owner, tokenPath, 404, { body: { roomId: newId() } });
  await requestAs(owner, tokenPath, 403, { body: { roomId: privateVideo } });
  const audienceToken = (await requestAs(visitor, tokenPath, 200, { body: { roomId: lifecycleId } })).data;
  const audienceClaims = readLiveKitToken(audienceToken.token);
  assert.equal(audienceToken.url, "wss://livekit.fixture");
  assert.equal(audienceToken.identity, visitorId);
  assert.equal(audienceToken.roomName, createdRoom.room.livekitRoomName);
  assert.equal(audienceToken.role, "AUDIENCE");
  assert.equal(audienceToken.canPublishMicrophone, false);
  assert.equal(audienceClaims.header.alg, "HS256");
  assert.equal(audienceClaims.payload.iss, livekitKey);
  assert.equal(audienceClaims.payload.sub, visitorId);
  assert.equal(audienceClaims.payload.video.room, audienceToken.roomName);
  assert.equal(audienceClaims.payload.video.roomJoin, true);
  assert.equal(audienceClaims.payload.video.canPublish, true);
  assert.deepEqual(audienceClaims.payload.video.canPublishSources, ["screen_share_audio"]);
  assert.equal(audienceClaims.payload.video.canSubscribe, true);
  assert.equal(audienceClaims.payload.exp - audienceClaims.payload.nbf, 7200);
  const hostToken = (await requestAs(owner, tokenPath, 200, { body: { roomId: lifecycleId } })).data;
  const hostClaims = readLiveKitToken(hostToken.token);
  assert.equal(hostToken.role, "HOST");
  assert.equal(hostToken.canPublishMicrophone, true);
  assert.deepEqual(hostClaims.payload.video.canPublishSources, ["microphone", "screen_share_audio"]);

  await requestAs(owner, prefix + "/" + lifecycleId + "/request-speaker", 409, { body: {} });
  const requested = (await requestAs(visitor, prefix + "/" + lifecycleId + "/request-speaker", 201, { body: {} })).data;
  assert.equal(requested.request.status, "PENDING");
  await requestAs(visitor, prefix + "/" + lifecycleId + "/request-speaker", 409, { body: {} });
  await requestAs(visitor, prefix + "/" + lifecycleId + "/approve-speaker", 403, { body: { userId: visitorId } });
  await requestAs(owner, prefix + "/" + lifecycleId + "/approve-speaker", 200, { body: { userId: visitorId } });
  assert.equal(await db.prepare(`SELECT role FROM room_participants
    WHERE room_id = ? AND user_id = ? AND left_at IS NULL`).bind(lifecycleId, visitorId).first("role"), "SPEAKER");
  const speakerToken = (await requestAs(visitor, tokenPath, 200, { body: { roomId: lifecycleId } })).data;
  assert.equal(speakerToken.role, "SPEAKER");
  assert.equal(speakerToken.canPublishMicrophone, true);
  assert.deepEqual(readLiveKitToken(speakerToken.token).payload.video.canPublishSources, ["microphone", "screen_share_audio"]);
  await requestAs(owner, prefix + "/" + lifecycleId + "/mute-user", 200, { body: { userId: visitorId } });
  const mutedToken = (await requestAs(visitor, tokenPath, 200, { body: { roomId: lifecycleId } })).data;
  assert.equal(mutedToken.canPublishMicrophone, false);
  assert.deepEqual(readLiveKitToken(mutedToken.token).payload.video.canPublishSources, []);
  await requestAs(visitor, prefix + "/" + lifecycleId + "/mic-state", 423, { body: { enabled: true } });
  await requestAs(owner, prefix + "/" + lifecycleId + "/unmute-user", 200, { body: { userId: visitorId } });
  assert.equal((await requestAs(visitor, prefix + "/" + lifecycleId + "/mic-state", 200, { body: { enabled: true } })).data.micEnabled, true);
  await requestAs(visitor, prefix + "/" + lifecycleId + "/mic-lock", 403, { body: { locked: true } });
  await requestAs(owner, prefix + "/" + lifecycleId + "/mic-lock", 200, { body: { locked: true } });
  assert.equal(await db.prepare("SELECT mic_locked FROM rooms WHERE source_id = ?").bind(lifecycleId).first("mic_locked"), 1);
  await requestAs(owner, prefix + "/" + lifecycleId + "/seat-lock", 200, { body: { seatIndex: 2, locked: true } });
  await requestAs(visitor, prefix + "/" + lifecycleId + "/take-seat", 423, { body: { seatIndex: 2 } });
  await requestAs(owner, prefix + "/" + lifecycleId + "/seat-lock", 200, { body: { seatIndex: 2, locked: false } });
  assert.equal((await requestAs(visitor, prefix + "/" + lifecycleId + "/take-seat", 200, { body: { seatIndex: 2 } })).data.seatIndex, 2);
  await requestAs(visitor, prefix + "/" + lifecycleId + "/leave-seat", 200, { body: {} });
  assert.equal(await db.prepare(`SELECT seat_index FROM room_participants
    WHERE room_id = ? AND user_id = ? AND left_at IS NULL`).bind(lifecycleId, visitorId).first("seat_index"), null);
  await requestAs(owner, prefix + "/" + lifecycleId + "/invite-speaker", 200, { body: { userId: visitorId } });
  assert.equal(await db.prepare(`SELECT role FROM room_participants
    WHERE room_id = ? AND user_id = ? AND left_at IS NULL`).bind(lifecycleId, visitorId).first("role"), "SPEAKER");
  await requestAs(owner, prefix + "/" + lifecycleId + "/remove-speaker", 200, { body: { userId: visitorId } });
  assert.equal(await db.prepare(`SELECT role FROM room_participants
    WHERE room_id = ? AND user_id = ? AND left_at IS NULL`).bind(lifecycleId, visitorId).first("role"), "AUDIENCE");
  await requestAs(visitor, prefix + "/" + lifecycleId + "/request-speaker", 201, { body: {} });
  await requestAs(owner, prefix + "/" + lifecycleId + "/reject-speaker", 200, { body: { userId: visitorId } });
  assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM speaker_requests WHERE room_id = ? AND status = 'REJECTED'")
    .bind(lifecycleId).first("total"), 1);
  await requestAs(visitor, prefix + "/" + lifecycleId + "/admin", 403, { body: { userId: ownerId } });
  assert.equal((await requestAs(owner, prefix + "/" + lifecycleId + "/admin", 200, { body: { userId: visitorId } })).data.isRoomAdmin, true);
  await requestAs(owner, prefix + "/" + lifecycleId + "/admin", 200, { body: { userId: visitorId, isAdmin: false } });
  await requestAs(visitor, prefix + "/" + lifecycleId + "/co-host", 403, { body: { userId: visitorId } });
  assert.equal((await requestAs(owner, prefix + "/" + lifecycleId + "/co-host", 200, { body: { userId: visitorId } })).data.room.isDuet, true);
  const coHosts = (await requestAs(visitor, prefix + "/" + lifecycleId + "/co-hosts", 200)).data;
  assert.equal(coHosts.coHosts[0]._id, visitorId);
  assert.equal(coHosts.isDuet, true);
  assert.equal((await requestAs(owner, prefix + "/" + lifecycleId + "/remove-co-host", 200, { body: { userId: visitorId } })).data.room.isDuet, false);
  await requestAs(visitor, prefix + "/" + lifecycleId, 403, { method: "PATCH", body: { title: "Hacked" } });
  await requestAs(owner, prefix + "/" + lifecycleId, 200, { method: "PATCH", body: { title: "Renamed lifecycle room" } });
  assert.equal(await db.prepare("SELECT title FROM rooms WHERE source_id = ?").bind(lifecycleId).first("title"), "Renamed lifecycle room");
  await db.prepare(`INSERT INTO chat_messages (source_id, room_id, sender_id, message, type, created_at)
    VALUES (?, ?, ?, 'to clean', 'TEXT', ?)`).bind(newId(), lifecycleId, ownerId, time).run();
  assert.equal((await requestAs(owner, prefix + "/" + lifecycleId + "/chat/clean", 200, { body: {} })).data.cleared, true);
  assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM chat_messages WHERE room_id = ?").bind(lifecycleId).first("total"), 0);
  assert.equal((await requestAs(visitor, prefix + "/" + lifecycleId + "/leave", 200, { body: {} })).data.left, true);
  assert.equal(await db.prepare("SELECT participant_count FROM rooms WHERE source_id = ?").bind(lifecycleId).first("participant_count"), 1);
  const rejoined = (await requestAs(visitor, prefix + "/" + lifecycleId + "/join", 200, { body: {} })).data;
  assert.equal(rejoined.role, "AUDIENCE");
  assert.equal(rejoined.xpGrant.xpAwarded, 10);
  await requestAs(visitor, prefix + "/" + lifecycleId + "/end", 403, { body: {} });
  const endedRoom = (await requestAs(owner, prefix + "/" + lifecycleId + "/end", 200, { body: {} })).data;
  assert.equal(endedRoom.roomId, lifecycleId);
  assert.ok(endedRoom.summary.durationMinutes >= 0);
  assert.equal(await db.prepare("SELECT status FROM rooms WHERE source_id = ?").bind(lifecycleId).first("status"), "ENDED");
  await requestAs(visitor, prefix + "/" + lifecycleId + "/join", 400, { body: {} });
  await requestAs(owner, prefix + "/" + lifecycleId + "/end", 409, { body: {} });

  const follow = "/" + live + "/follow";
  for (const roomId of [privateVideo, ended]) await requestAs(visitor, prefix + "/" + roomId + "/follow", 404, { body: {} });
  await Promise.all([1, 2].map(() => requestAs(visitor, prefix + follow, 200, { body: {} })));
  assert.deepEqual((await requestAs(visitor, prefix + "/followed", 200)).data.rooms.map(item => item._id), [live]);
  const followers = (await requestAs(owner, prefix + "/" + live + "/followers", 200)).data.users;
  assert.deepEqual(followers.map(item => item._id), [visitorId]);
  assert.equal((await requestAs(visitor, prefix + follow, 200, { method: "DELETE" })).data.following, false);
  assert.deepEqual((await requestAs(visitor, prefix + "/followed", 200)).data.rooms, []);

  const hosted = (await requestAs(owner, "/api/users/" + ownerId + "/rooms", 200)).data.rooms;
  assert.deepEqual(new Set(hosted.map(item => item._id)), new Set([live, privateVideo]));
  const ownerFollowers = (await requestAs(owner, "/api/users/" + ownerId + "/followers", 200)).data;
  assert.deepEqual(ownerFollowers.followers, ownerFollowers.users);
  assert.deepEqual(ownerFollowers.users.map(item => item._id), [visitorId]);
  const following = (await requestAs(visitor, "/api/users/" + visitorId + "/following", 200)).data.following;
  assert.deepEqual(following.map(item => item._id), [ownerId]);
  const statsPath = "/api/users/" + ownerId + "/pk-stats";
  const pkResults = [
    ["ENDED", "LEFT", ownerId, 12, 3],
    ["ENDED", "DRAW", null, 8, 8],
    ["FORCE_ENDED", "LEFT", ownerId, 9, 5],
    ["ENDED", "RIGHT", visitorId, 2, 10],
    ["ACTIVE", null, null, 100, 0]
  ];
  await db.batch(pkResults.map(([status, side, winner, score, otherScore], i) => {
    const id = newId();
    const endedAt = new Date(now.getTime() - (5 - i) * 1000).toISOString();
    return db.prepare(`INSERT INTO pk_battles (source_id, battle_code, title, mode, format, scope, team_size, status,
      battle_type, duration_seconds, in_room_battle, state_version, event_sequence, termination_reason, started_by_user_id,
      left_room_id, right_room_id, left_host_id, right_host_id, left_score, right_score, winner_side, winner_user_id, ended_at, created_at)
      VALUES (?, ?, '', 'GIFT', 'ROOM', 'CROSS_ROOM', 1, ?, 'VOICE', 60, 0, 1, 0, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, id, status, ownerId, live, privateVideo, ownerId, visitorId, score, otherScore, side, winner, endedAt, endedAt);
  }));
  assert.deepEqual((await requestAs(owner, statsPath, 200)).data.stats, {
    played: 4, wins: 2, losses: 1, draws: 1, totalScore: 31, bestBattle: 12, bestStreak: 2, winRate: 50
  });
  await request("/api/friends", 401);

  const sendFriendRequest = () => requestAs(visitor, "/api/friends/request/" + ownerId, [201, 409], { body: {} });
  await requestAs(owner, "/api/friends/request/" + ownerId, 400, { body: {} });
  const requests = await Promise.all([sendFriendRequest(), sendFriendRequest()]);
  assert.equal(requests.filter(result => result.ok).length, 1);
  const friend = requests.find(result => result.ok).data.friendship._id;
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type = 'FRIEND_REQUEST' AND json_extract(data, '$.friendshipId') = ?")
    .bind(friend).first("count"), 1);
  assert.equal((await requestAs(owner, "/api/friends/requests", 200)).data.requests[0].userId._id, visitorId);
  assert.equal((await requestAs(visitor, "/api/friends/sent", 200)).data.sent[0].friendId._id, ownerId);
  assert.equal((await requestAs(visitor, "/api/friends/status/" + ownerId, 200)).data.status, "SENT");
  assert.equal((await requestAs(owner, "/api/friends/status/" + visitorId, 200)).data.status, "PENDING");
  await requestAs(visitor, "/api/friends/accept/" + ownerId, 404, { body: {} });
  const accept = () => requestAs(owner, "/api/friends/accept/" + visitorId, [200, 404], { body: {} });
  const accepts = await Promise.all([accept(), accept()]);
  assert.equal(accepts.filter(result => result.ok).length, 1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE type = 'FRIEND_ACCEPT' AND json_extract(data, '$.friendshipId') = ?")
    .bind(friend).first("count"), 1);
  assert.deepEqual((await requestAs(owner, "/api/friends", 200)).data.friends.map(item => item._id), [visitorId]);
  assert.equal((await requestAs(owner, "/api/friends/count/" + visitorId, 200)).data.count, 1);
  assert.equal((await requestAs(owner, "/api/friends/mutual/" + visitorId, 200)).data.mutualCount, 0);

  const visible = newId();
  const hidden = newId();
  const older = newId();
  const path = "/api/users/messages";
  await db.batch([
    ...[[visible, visitorId, ownerId, time], [hidden, visitorId, ownerId, time], [older, ownerId, visitorId, beforeJoin]]
      .map(([id, sender, receiver, created]) => db.prepare(`INSERT INTO direct_messages (source_id, sender_id, receiver_id,
        message, media_url, media_type, duration, forwarded, is_edited, read, created_at, reply_to_message_id,
        reply_to_author, reply_to_text, reply_to_media_url) VALUES (?, ?, ?, 'Fixture', '', '', 0, 0, 0, 0, ?, '', '', '', '')`)
        .bind(id, sender, receiver, created)),
    db.prepare("INSERT INTO message_hidden_for (source_id, value, direct_messages_id, position) VALUES (?, ?, ?, 0)")
      .bind(newId(), ownerId, hidden),
    db.prepare(`INSERT INTO direct_message_reactions (source_id, user_id, type, created_at, direct_messages_id, position)
      VALUES (?, ?, 'heart', ?, ?, 0)`).bind(newId(), ownerId, time, visible),
    db.prepare("INSERT INTO conversation_mutes (source_id, owner_id, partner_id, muted, updated_at) VALUES (?, ?, ?, 1, ?)")
      .bind(newId(), ownerId, visitorId, time)
  ]);
  await request(path, 401);
  const page = (await requestAs(owner, path + "?limit=1", 200)).data;
  assert.equal(page.hasMore, true);
  assert.equal(page.messages[0]._id, visible);
  assert.equal(page.messages[0].senderId._id, visitorId);
  assert.equal(page.messages[0].reactions[0].type, "heart");
  assert.equal(page.messages[0].read, false);
  const secondPage = (await requestAs(owner, path + "?before=" + encodeURIComponent(page.nextBefore), 200)).data;
  assert.deepEqual(secondPage.messages.map(item => item._id), [older]);
  assert.deepEqual((await requestAs(owner, path + "/unread-counts", 200)).data, { unreadCounts: { [visitorId]: 1 }, total: 1 });
  assert.deepEqual((await requestAs(visitor, path + "/unread-counts", 200)).data, { unreadCounts: { [ownerId]: 1 }, total: 1 });
  assert.deepEqual((await requestAs(owner, path + "/mutes", 200)).data.partnerIds, [visitorId]);
  assert.deepEqual((await requestAs(visitor, path + "/mutes", 200)).data.partnerIds, []);
  const matchesPath = "/api/dating/matches";
  await request(matchesPath, 401);
  assert.deepEqual((await requestAs(owner, matchesPath, 200)).data.matches, []);
  const preferencesPath = "/api/dating/preferences";
  const defaultPreferences = {
    interestedIn: "Everyone", lookingFor: "Friendship", datingAgeMin: 18, datingAgeMax: 35, verifiedOnly: false
  };
  assert.deepEqual((await requestAs(owner, preferencesPath, 200)).data.preferences, defaultPreferences);
  const preferences = { interestedIn: "Women", lookingFor: "Dating", datingAgeMin: 23, datingAgeMax: 42, verifiedOnly: true };
  await requestAs(owner, preferencesPath, 422, { method: "PUT", body: { ...preferences, datingAgeMax: 18 } });
  assert.deepEqual((await requestAs(owner, preferencesPath, 200, { method: "PUT", body: preferences })).data.preferences, preferences);
  assert.deepEqual((await requestAs(owner, preferencesPath, 200)).data.preferences, preferences);
  assert.deepEqual((await requestAs(visitor, preferencesPath, 200)).data.preferences, defaultPreferences);
  const matchId = newId();
  await db.batch([
    db.prepare("INSERT INTO matches (source_id, created_at, updated_at) VALUES (?, ?, ?)").bind(matchId, time, time),
    db.prepare("INSERT INTO match_users (source_id, value, matches_id, position) VALUES (?, ?, ?, 0), (?, ?, ?, 1)")
      .bind(newId(), ownerId, matchId, newId(), visitorId, matchId)
  ]);
  const matchResults = await Promise.all([requestAs(owner, matchesPath, 200), requestAs(visitor, matchesPath, 200)]);
  assert.equal(matchResults[0].data.matches[0].partner._id, visitorId);
  assert.equal(matchResults[1].data.matches[0].partner._id, ownerId);
  assert.equal(matchResults[0].data.matches[0].matchDate, time);
  assert.equal(matchResults[0].data.matches[0].relationship.xp, 50);
  assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM relationships").first("total"), 1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM relationship_users").first("total"), 2);
  const conversation = path + "/" + visitorId;
  const visitorConversation = path + "/" + ownerId;
  const history = (await requestAs(owner, conversation + "?markRead=false", 200)).data;
  assert.deepEqual(history.messages.map(message => message._id), [older, visible]);
  assert.equal(history.relationship.xp, 50);
  assert.equal(history.muted, true);
  assert.equal((await requestAs(visitor, visitorConversation + "?markRead=false", 200)).data.muted, false);
  const olderPage = (await requestAs(owner, conversation + "?before=" + visible, 200)).data;
  assert.deepEqual(olderPage.messages.map(message => message._id), [older]);
  assert.equal((await requestAs(owner, path + "/unread-counts", 200)).data.total, 1);
  const search = (await requestAs(owner, conversation + "/search?q=FIXTURE&limit=1", 200)).data;
  assert.deepEqual(search.messages.map(message => message._id), [visible]);
  assert.equal(search.hasMore, true);
  assert.equal(search.nextBefore, time);
  assert.deepEqual((await requestAs(owner, conversation + "/search?q=%25_", 200)).data.messages, []);
  await requestAs(owner, conversation + "/search?q=f", 400);
  await request(conversation, 401);
  await requestAs(owner, path + "/" + newId(), 404);
  assert.equal((await requestAs(owner, conversation, 200)).data.messages.find(message => message._id === visible).read, false);
  assert.equal((await requestAs(owner, path + "/unread-counts", 200)).data.total, 0);
  assert.equal(await db.prepare("SELECT read FROM direct_messages WHERE source_id = ?").bind(hidden).first("read"), 0);

  await db.prepare("UPDATE direct_messages SET read = 0 WHERE source_id = ?").bind(visible).run();
  const read = () => requestAs(owner, conversation + "/read", 200, { body: {} });
  const receipts = await Promise.all([read(), read()]);
  assert.deepEqual(receipts.map(receipt => receipt.data.updated).sort(), [0, 1]);
  assert.ok(receipts.every(receipt => !Number.isNaN(Date.parse(receipt.data.readThrough))));
  assert.equal((await requestAs(visitor, path + "/read-all", 200, { body: {} })).data.updated, 1);
  assert.equal((await requestAs(visitor, path + "/read-all", 200, { body: {} })).data.updated, 0);
  await requestAs(owner, conversation + "/mute", 400, { method: "PUT", body: { muted: "true" } });
  await requestAs(owner, conversation + "/mute", 200, { method: "PUT", body: { muted: false } });
  const muteVisitor = () => requestAs(visitor, visitorConversation + "/mute", 200, { method: "PUT", body: { muted: true } });
  const repeatedMutes = await Promise.all([muteVisitor(), muteVisitor()]);
  assert.ok(repeatedMutes.every(result => result.data.muted));
  assert.deepEqual((await requestAs(owner, path + "/mutes", 200)).data.partnerIds, []);
  assert.deepEqual((await requestAs(visitor, path + "/mutes", 200)).data.partnerIds, [ownerId]);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM conversation_mutes WHERE owner_id = ? AND partner_id = ?")
    .bind(visitorId, ownerId).first("count"), 1);

  const queryPlan = (await db.prepare(`EXPLAIN QUERY PLAN SELECT source_id FROM direct_messages
    WHERE receiver_id = ? AND read = 0 AND sender_id = ?`).bind(ownerId, visitorId).all()).results;
  assert.ok(queryPlan.some(row => row.detail.includes("idx_direct_messages_unread")));
  await db.prepare("INSERT INTO blocks (source_id, blocker_id, blocked_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(newId(), ownerId, visitorId, time).run();
  assert.deepEqual((await requestAs(owner, matchesPath, 200)).data.matches, []);
  assert.deepEqual((await requestAs(owner, path, 200)).data.messages, []);
  assert.equal((await requestAs(owner, path + "/unread-counts", 200)).data.total, 0);
  await requestAs(owner, conversation, 403);
  await requestAs(owner, conversation + "/search?q=fixture", 403);
  await requestAs(owner, conversation + "/read", 403, { body: {} });
  await requestAs(owner, conversation + "/mute", 403, { method: "PUT", body: { muted: true } });
  assert.deepEqual((await requestAs(owner, "/api/friends", 200)).data.friends, []);
  assert.deepEqual((await requestAs(visitor, "/api/users/" + ownerId + "/rooms", 200)).data.rooms, []);
  assert.equal((await requestAs(owner, "/api/friends/unfriend/" + visitorId, 200, { body: {} })).data.unfriended, true);
  await requestAs(visitor, "/api/friends/request/" + ownerId, 403, { body: {} });
  await db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_user_id = ?").bind(ownerId, visitorId).run();
  assert.equal((await requestAs(owner, conversation, 200, { method: "DELETE" })).data.deletedCount, 2);
  assert.equal((await requestAs(owner, conversation, 200, { method: "DELETE" })).data.deletedCount, 0);
  assert.deepEqual((await requestAs(owner, conversation, 200)).data.messages, []);
  assert.equal((await requestAs(visitor, visitorConversation + "?markRead=false", 200)).data.messages.length, 3);
  await requestAs(owner, "/api/friends/request/" + visitorId, 201, { body: {} });
  assert.equal((await requestAs(visitor, "/api/friends/decline/" + ownerId, 200, { body: {} })).data.declined, true);
  assert.equal((await requestAs(owner, "/api/friends/status/" + visitorId, 200)).data.status, "NONE");

  const friendshipId = newId();
  await db.prepare(`INSERT INTO friendships (source_id, user_id, friend_id, status, created_at, updated_at)
    VALUES (?, ?, ?, 'ACCEPTED', ?, ?)`).bind(friendshipId, ownerId, visitorId, time, time).run();
  const ownerFriends = (await requestAs(owner, "/api/users/me/friends", 200)).data.users;
  assert.deepEqual(ownerFriends.map(item => item._id), [visitorId]);
  assert.equal(Object.hasOwn(ownerFriends[0], "bio"), false);
  assert.equal(Object.hasOwn(ownerFriends[0], "isVerified"), false);
  assert.equal(Object.hasOwn(ownerFriends[0], "avatarParts"), true);
  assert.deepEqual((await requestAs(owner, "/api/users/" + visitorId + "/friends", 200)).data.users.map(item => item._id), [ownerId]);
  await request("/api/users/me/friends", 401);
  await db.prepare("DELETE FROM friendships WHERE source_id = ?").bind(friendshipId).run();

  const followCounts = async () => Object.fromEntries((await db.prepare(`SELECT source_id, following_count, followers_count
    FROM users WHERE source_id IN (?, ?)`).bind(ownerId, visitorId).all()).results.map(row => [row.source_id, row]));
  const countsBefore = await followCounts();
  const followPath = "/api/users/" + visitorId + "/follow";
  await request(followPath, 401, { body: {} });
  await requestAs(owner, "/api/users/" + ownerId + "/follow", 400, { body: {} });
  const followed = await requestAs(owner, followPath, 200, { body: {} });
  assert.equal(followed.data.following, true);
  assert.equal(followed.data.xpGrant.event, "FOLLOW_USER");
  assert.equal(followed.data.xpGrant.xpAwarded, 10);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
    WHERE type = 'FOLLOW' AND user_id = ? AND json_extract(data, '$.userId') = ?`).bind(visitorId, ownerId).first("count"), 1);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM xp_grants
    WHERE user_id = ? AND event = 'FOLLOW_USER' AND action_key = ?`).bind(ownerId, `follow:${ownerId}:${visitorId}`).first("count"), 1);
  const countsAfter = await followCounts();
  assert.equal(countsAfter[ownerId].following_count, countsBefore[ownerId].following_count + 1);
  assert.equal(countsAfter[visitorId].followers_count, countsBefore[visitorId].followers_count + 1);
  assert.equal((await requestAs(owner, followPath, 200, { body: {} })).data.following, true);
  assert.equal((await followCounts())[ownerId].following_count, countsAfter[ownerId].following_count);
  assert.equal((await requestAs(owner, followPath, 200, { body: {} })).data.xpGrant.duplicate, true);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM xp_grants WHERE user_id = ? AND event = 'FOLLOW_USER'")
    .bind(ownerId).first("count"), 1);
  assert.equal((await requestAs(owner, followPath, 200, { method: "DELETE" })).data.following, false);
  assert.equal((await followCounts())[ownerId].following_count, countsBefore[ownerId].following_count);
  assert.equal(await db.prepare(`SELECT COUNT(*) AS count FROM notifications
    WHERE type = 'FOLLOW' AND user_id = ? AND json_extract(data, '$.action') = 'UNFOLLOW'`).bind(visitorId).first("count"), 1);
  assert.equal((await requestAs(owner, followPath, 200, { body: {} })).data.xpGrant.duplicate, true);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM xp_grants WHERE user_id = ? AND event = 'FOLLOW_USER'")
    .bind(ownerId).first("count"), 1);

  const countsBeforeRemoval = await followCounts();
  assert.equal((await requestAs(owner, "/api/users/me/followers/" + visitorId, 200, { method: "DELETE" })).data.removed, true);
  const countsAfterRemoval = await followCounts();
  assert.equal(countsAfterRemoval[visitorId].following_count, countsBeforeRemoval[visitorId].following_count - 1);
  assert.equal(countsAfterRemoval[ownerId].followers_count, countsBeforeRemoval[ownerId].followers_count - 1);
  await requestAs(owner, "/api/users/me/followers/" + ownerId, 400, { method: "DELETE" });

  const blockPath = "/api/users/" + visitorId + "/block";
  await request(blockPath, 401, { body: {} });
  await requestAs(owner, "/api/users/" + ownerId + "/block", 400, { body: {} });
  assert.equal((await requestAs(owner, blockPath, 200, { body: {} })).data.blocked, true);
  assert.deepEqual((await requestAs(owner, "/api/users/me/blocked", 200)).data.users.map(item => item._id), [visitorId]);
  assert.deepEqual((await requestAs(visitor, "/api/users/me/blocked", 200)).data.users, []);
  assert.equal((await requestAs(owner, blockPath, 200, { body: {} })).data.blocked, true);
  assert.equal((await requestAs(owner, blockPath, 200, { method: "DELETE" })).data.blocked, false);
  assert.deepEqual((await requestAs(owner, "/api/users/me/blocked", 200)).data.users, []);

  const send = (account, target, status, body) => requestAs(account, path + "/" + target, status, { body });
  const countSent = () => db.prepare("SELECT COUNT(*) AS count FROM direct_messages WHERE sender_id = ? AND receiver_id = ?")
    .bind(ownerId, visitorId).first("count");
  const beforeSends = await countSent();
  const beforeXp = await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(ownerId).first("xp");
  await request(path + "/" + visitorId, 401, { body: { message: "hello" } });
  await send(owner, visitorId, 400, { message: "   " });
  await send(owner, ownerId, 400, { message: "hello" });
  const muteUntil = new Date(Date.now() + 60_000).toISOString();
  await db.prepare("UPDATE users SET muted_until = ? WHERE source_id = ?").bind(muteUntil, ownerId).run();
  await send(owner, visitorId, 403, { message: "hello" });
  await db.prepare("UPDATE users SET muted_until = NULL WHERE source_id = ?").bind(ownerId).run();
  const savedVip = await db.prepare("SELECT vip_tier, vip_level, vip_expires_at FROM users WHERE source_id = ?").bind(ownerId).first();
  await db.prepare("UPDATE users SET vip_tier = NULL, vip_level = 0, vip_expires_at = NULL WHERE source_id = ?").bind(ownerId).run();
  await requestAs(owner, followPath, 200, { method: "DELETE" });
  await db.prepare("UPDATE users SET vip_chat_privacy = 'FOLLOWERS' WHERE source_id = ?").bind(visitorId).run();
  await send(owner, visitorId, 403, { message: "hello" });
  assert.equal(await countSent(), beforeSends);
  assert.equal((await requestAs(owner, followPath, 200, { body: {} })).data.xpGrant.duplicate, true);
  await requestAs(visitor, visitorConversation + "/mute", 200, { method: "PUT", body: { muted: false } });
  const sent = await Promise.all([
    send(owner, visitorId, 201, { message: "same text" }),
    send(owner, visitorId, 201, { message: "same text" })
  ]);
  await db.prepare("UPDATE users SET vip_chat_privacy = 'EVERYONE' WHERE source_id = ?").bind(visitorId).run();
  const vipPrivacy = "/api/users/me/vip-privacy";
  await request(vipPrivacy, 401, { method: "PATCH", body: {} });
  await requestAs(visitor, vipPrivacy, 403);
  await db.prepare("UPDATE users SET vip_tier = 'VIP1', vip_level = 1, vip_expires_at = ? WHERE source_id = ?").bind(muteUntil, ownerId).run();
  const beforePrivacy = (await requestAs(owner, vipPrivacy, 200)).data;
  const settings = { mysteriousVisitors: true, chatPrivacy: "FOLLOWERS" };
  assert.deepEqual((await requestAs(owner, vipPrivacy, 200, { method: "PATCH", body: settings })).data, settings);
  assert.deepEqual((await requestAs(owner, vipPrivacy, 200)).data, settings);
  const updatedPrivacy = { mysteriousVisitors: true, chatPrivacy: beforePrivacy.chatPrivacy };
  assert.deepEqual((await requestAs(owner, vipPrivacy, 200, { method: "PATCH", body: { chatPrivacy: beforePrivacy.chatPrivacy } })).data, updatedPrivacy);
  await requestAs(owner, vipPrivacy, 200, { method: "PATCH", body: beforePrivacy });
  await db.prepare("UPDATE users SET vip_tier = ?, vip_level = ?, vip_expires_at = ? WHERE source_id = ?")
    .bind(savedVip.vip_tier, savedVip.vip_level, savedVip.vip_expires_at, ownerId).run();
  assert.notEqual(sent[0].data.message._id, sent[1].data.message._id);
  assert.equal(sent[0].data.message.receiverId._id, visitorId);
  assert.equal(sent[0].data.message.read, false);
  assert.equal(sent[0].data.xpGrant.xpAwarded, 5);
  assert.equal(await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(ownerId).first("xp"), beforeXp + 10);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM battle_pass_xp_grants WHERE user_id = ? AND action_key IN (?, ?)")
    .bind(ownerId, ...sent.map(result => `CHAT_MESSAGE:message:${result.data.message._id}`)).first("count"), 2);
  const messageNotice = id => db.prepare("SELECT user_id FROM notifications WHERE type = 'MESSAGE' AND json_extract(data, '$.messageId') = ?")
    .bind(id).first("user_id");
  assert.equal(await messageNotice(sent[0].data.message._id), visitorId);
  assert.equal(await messageNotice(sent[1].data.message._id), visitorId);
  const sendBlock = newId();
  await db.prepare("INSERT INTO blocks (source_id, blocker_id, blocked_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(sendBlock, ownerId, visitorId, time).run();
  await send(visitor, ownerId, 403, { message: "blocked reply" });
  await db.prepare("DELETE FROM blocks WHERE source_id = ?").bind(sendBlock).run();
  const reply = await send(visitor, ownerId, 201, { message: "reply", replyToId: sent[0].data.message._id });
  assert.equal(reply.data.message.replyTo.messageId, sent[0].data.message._id);
  assert.equal(reply.data.message.replyTo.authorId, ownerId);
  assert.equal(await db.prepare("SELECT read FROM direct_messages WHERE source_id = ?").bind(sent[1].data.message._id).first("read"), 1);
  await requestAs(visitor, visitorConversation + "/mute", 200, { method: "PUT", body: { muted: true } });
  const flagged = await send(owner, visitorId, 201, { message: "A warning about spam" });
  assert.equal(await messageNotice(flagged.data.message._id), null);
  assert.equal(await db.prepare("SELECT warning_count FROM user_safety_statuses WHERE user_id = ?").bind(ownerId).first("warning_count"), 1);
  await send(owner, visitorId, 404, { message: "hidden reply", replyToId: hidden });
  assert.equal(await countSent(), beforeSends + 3);

  await requestAs(visitor, visitorConversation + "/mute", 200, { method: "PUT", body: { muted: false } });
  await db.prepare(`CREATE TRIGGER fixture_reject_message_notice BEFORE INSERT ON notifications
    WHEN NEW.type = 'MESSAGE' BEGIN SELECT RAISE(ABORT, 'fixture message rollback'); END`).run();
  try {
    await send(owner, visitorId, 500, { message: "rollback test" });
    assert.equal(await countSent(), beforeSends + 3);
    assert.equal(await db.prepare("SELECT xp FROM users WHERE source_id = ?").bind(ownerId).first("xp"), beforeXp + 15);
  } finally {
    await db.prepare("DROP TRIGGER fixture_reject_message_notice").run();
  }
  const pair = [ownerId, visitorId].sort().join(":");
  await db.prepare("UPDATE relationship_message_xp_daily SET amount = 116 WHERE pair_key = ?").bind(pair).run();
  await db.prepare("UPDATE xp_daily_caps SET amount = 98 WHERE user_id = ? AND event = 'CHAT_MESSAGE'").bind(ownerId).run();
  const capped = await send(owner, visitorId, 201, { message: "partial award" });
  assert.equal(capped.data.xpGrant.xpAwarded, 2);
  assert.equal(capped.data.xpGrant.earnedToday, 100);
  const afterCap = await send(owner, visitorId, 201, { message: "cap reached" });
  assert.equal(afterCap.data.xpGrant.xpAwarded, 0);
  assert.equal(afterCap.data.relationship.xp, capped.data.relationship.xp);
  assert.equal(await db.prepare("SELECT amount FROM relationship_message_xp_daily WHERE pair_key = ?").bind(pair).first("amount"), 120);
  await send(owner, visitorId, 415, { mediaUrl: "https://example.test/attachment.png", mediaType: "IMAGE" });
  const moderated = await send(visitor, ownerId, 400, { message: "spam scam casino" });
  assert.equal(moderated.error.code, "CONTENT_BLOCKED");
  assert.equal(await db.prepare("SELECT is_chat_restricted FROM user_safety_statuses WHERE user_id = ?").bind(visitorId).first("is_chat_restricted"), 1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM moderation_actions WHERE target_user_id = ? AND automated = 1")
    .bind(visitorId).first("count"), 1);
  await send(visitor, ownerId, 403, { message: "restricted" });
  let rateLimited = false;
  for (let attempt = 0; attempt < 13; attempt++) {
    const result = await send(owner, visitorId, [400, 429], { message: "" });
    if (result.error.code === "RATE_LIMITED") {
      rateLimited = true;
      break;
    }
  }
  assert.equal(rateLimited, true);

  const roomId = newId();
  const recordingTime = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, description, type, host_id, category, tags, language, status, visibility, max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only, created_at, updated_at)
      VALUES (?, 'Recording Room', 'desc', 'VOICE', ?, 'chill', '[]', 'en', 'LIVE', 'PUBLIC', 8, 1, 0, ?, 1, 0, 0, ?, ?)`),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
      VALUES (?, ?, ?, 'HOST', 1, 0, 0, 0, ?)`)
  ].map((statement, index) => index === 0
    ? statement.bind(roomId, ownerId, roomId, recordingTime, recordingTime)
    : statement.bind(newId(), roomId, ownerId, recordingTime)));
  try {
    await request("/api/recordings", 401, { method: "POST", body: { roomId } });
    await requestAs(owner, "/api/recordings", 422, { method: "POST", body: { roomId: "bad" } });
    const created = (await requestAs(owner, "/api/recordings", 201, { method: "POST", body: { roomId, title: "My Rec" } })).data;
    assert.equal(created.roomId, roomId);
    assert.equal(created.hostId, ownerId);
    assert.equal(created.title, "My Rec");
    assert.equal(created.status, "PROCESSING");
    assert.equal(created.viewCount, 0);

    const list = (await requestAs(visitor, `/api/recordings/room/${roomId}`, 200)).data;
    assert.equal(list[0]._id, created._id);
    const fetched = (await requestAs(visitor, `/api/recordings/${created._id}`, 200)).data;
    assert.equal(fetched._id, created._id);

    const viewed = (await requestAs(visitor, `/api/recordings/${created._id}/view`, 200, { method: "POST" })).data;
    assert.equal(viewed.viewCount, 0);
    const viewedAgain = (await requestAs(visitor, `/api/recordings/${created._id}/view`, 200, { method: "POST" })).data;
    assert.equal(viewedAgain.viewCount, 1);

    await requestAs(visitor, `/api/recordings/${created._id}/stop`, 403, { method: "PATCH", body: { recordingUrl: "https://example.test/rec.mp4", duration: 10 } });
    const stopped = (await requestAs(owner, `/api/recordings/${created._id}/stop`, 200, { method: "PATCH", body: { recordingUrl: "https://example.test/rec.mp4", duration: 10 } })).data;
    assert.equal(stopped.status, "PUBLISHED");
    assert.equal(stopped.recordingUrl, "https://example.test/rec.mp4");
    assert.equal(stopped.duration, 10);

    const updated = (await requestAs(owner, `/api/recordings/${created._id}`, 200, { method: "PATCH", body: { title: "Renamed" } })).data;
    assert.equal(updated.title, "Renamed");
    await requestAs(visitor, `/api/recordings/${created._id}`, 403, { method: "DELETE" });
    const deletedRecording = (await requestAs(owner, `/api/recordings/${created._id}`, 200, { method: "DELETE" })).data;
    assert.equal(deletedRecording.message, "Recording deleted");
    await requestAs(owner, `/api/recordings/${created._id}`, 404);
  } finally {
    await db.batch([
      db.prepare("DELETE FROM room_recordings WHERE room_id = ?").bind(roomId),
      db.prepare("DELETE FROM room_participants WHERE room_id = ?").bind(roomId),
      db.prepare("DELETE FROM rooms WHERE source_id = ?").bind(roomId)
    ]);
  }

  await request("/api/users/search?q=ab", 401);
  await requestAs(owner, "/api/users/search?q=a", 400);
  const searchResults = (await requestAs(owner, "/api/users/search?q=zz&limit=10", 200)).data.users;
  assert.ok(Array.isArray(searchResults));
  assert.ok(searchResults.every(user => user._id !== ownerId));

  const suggestedHosts = (await requestAs(owner, "/api/users/hosts/suggested?limit=10", 200)).data.users;
  assert.ok(Array.isArray(suggestedHosts));
  const recommendedChat = (await requestAs(owner, "/api/users/recommended-chat", 200)).data.users;
  assert.deepEqual(recommendedChat, []);

  const pkHistoryBattles = (await requestAs(owner, `/api/users/${visitorId}/pk-history`, 200)).data.battles;
  assert.ok(Array.isArray(pkHistoryBattles));

  // PK read routes (D1). Writes and deadlines are checked separately; Socket.IO fan-out remains legacy-only.
  const pkLeftRoomId = newId();
  const pkRightRoomId = newId();
  const pkOpponentRoomId = newId();
  const pkActiveBattleId = newId();
  const pkEndedBattleId = newId();
  const pkInviteId = newId();
  const pkEventId = newId();
  const pkVoteId = newId();
  const pkLeaderboardId = newId();
  const pkPast = new Date(now.getTime() - 60_000).toISOString();
  const pkFuture = new Date(now.getTime() + 60_000).toISOString();
  try {
    await db.batch([
      ...[
        [pkLeftRoomId, "PK Left", ownerId],
        [pkRightRoomId, "PK Right", visitorId],
        [pkOpponentRoomId, "PK Opponent", visitorId]
      ].map(([id, title, host]) => db.prepare(`INSERT INTO rooms
        (source_id, title, description, type, host_id, category, tags, language, status, visibility,
         max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests,
         mic_locked, vip_only, created_at, updated_at)
        VALUES (?, ?, 'desc', 'VIDEO', ?, 'chill', '[]', 'en', 'LIVE', 'PUBLIC', 8, 1, 0, ?, 1, 0, 0, ?, ?)`)
        .bind(id, title, host, id, time, time)),
      db.prepare(`INSERT INTO room_participants
        (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
        VALUES (?, ?, ?, 'HOST', 1, 0, 0, 0, ?)`).bind(newId(), pkLeftRoomId, ownerId, time),
      db.prepare(`INSERT INTO room_participants
        (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
        VALUES (?, ?, ?, 'HOST', 1, 0, 0, 0, ?)`).bind(newId(), pkRightRoomId, visitorId, time),
      db.prepare(`INSERT INTO room_participants
        (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
        VALUES (?, ?, ?, 'HOST', 1, 0, 0, 0, ?)`).bind(newId(), pkOpponentRoomId, visitorId, time),
      db.prepare(`INSERT INTO pk_battles (source_id, battle_code, title, mode, format, scope, team_size, status,
        battle_type, duration_seconds, in_room_battle, state_version, event_sequence, termination_reason,
        started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id, left_score, right_score,
        winner_side, winner_user_id, ended_at, created_at)
        VALUES (?, ?, 'PK Fixture', 'VOTE', 'LIVESTREAM', 'CROSS_ROOM', 1, 'ACTIVE', 'VIDEO', 180, 0, 2, 1, '',
        ?, ?, ?, ?, ?, 5, 10, NULL, NULL, NULL, ?)`)
        .bind(pkActiveBattleId, pkActiveBattleId, ownerId, pkLeftRoomId, pkRightRoomId, ownerId, visitorId, time),
      db.prepare(`INSERT INTO pk_battles (source_id, battle_code, title, mode, format, scope, team_size, status,
        battle_type, duration_seconds, in_room_battle, state_version, event_sequence, termination_reason,
        started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id, left_score, right_score,
        winner_side, winner_user_id, ended_at, created_at)
        VALUES (?, ?, 'PK Fixture Ended', 'VOTE', 'LIVESTREAM', 'CROSS_ROOM', 1, 'ENDED', 'VIDEO', 180, 0, 3, 1, '',
        ?, ?, ?, ?, ?, 12, 4, 'LEFT', ?, ?, ?)`)
        .bind(pkEndedBattleId, pkEndedBattleId, ownerId, pkLeftRoomId, pkRightRoomId, ownerId, visitorId, ownerId, pkPast, pkPast),
      db.prepare(`INSERT INTO pk_participants (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at, left_at)
        VALUES (?, ?, ?, ?, 'LEFT', 'HOST', 1, 'A', ?, NULL)`).bind(newId(), pkActiveBattleId, ownerId, pkLeftRoomId, time),
      db.prepare(`INSERT INTO pk_participants (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at, left_at)
        VALUES (?, ?, ?, ?, 'RIGHT', 'HOST', 0, 'B', ?, NULL)`).bind(newId(), pkActiveBattleId, visitorId, pkRightRoomId, time),
      db.prepare(`INSERT INTO pk_participants (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at, left_at)
        VALUES (?, ?, ?, ?, 'LEFT', 'HOST', 0, 'A', ?, NULL)`).bind(newId(), pkEndedBattleId, ownerId, pkLeftRoomId, pkPast),
      db.prepare(`INSERT INTO pk_participants (source_id, battle_id, user_id, room_id, side, role, is_ready, team_name, joined_at, left_at)
        VALUES (?, ?, ?, ?, 'RIGHT', 'HOST', 0, 'B', ?, NULL)`).bind(newId(), pkEndedBattleId, visitorId, pkRightRoomId, pkPast),
      db.prepare(`INSERT INTO pk_invites (source_id, battle_id, inviter_user_id, invitee_user_id,
        inviter_room_id, invitee_room_id, status, expires_at, responded_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, NULL, ?, ?)`)
        .bind(pkInviteId, pkActiveBattleId, ownerId, visitorId, pkLeftRoomId, pkRightRoomId, pkFuture, time, time),
      db.prepare(`INSERT INTO pk_votes (source_id, battle_id, voter_id, side, room_id, created_at, updated_at)
        VALUES (?, ?, ?, 'RIGHT', ?, ?, ?)`).bind(pkVoteId, pkActiveBattleId, ownerId, pkRightRoomId, time, time),
      db.prepare(`INSERT INTO pk_events (source_id, battle_id, room_id, user_id, event_type, side, points,
        state_version, sequence, gift_transaction_id, metadata, created_at, updated_at)
        VALUES (?, ?, ?, ?, 'PK_CREATED', NULL, 0, 1, 1, NULL, ?, ?, ?)`)
        .bind(pkEventId, pkActiveBattleId, pkLeftRoomId, ownerId, '{"fixture":true}', time, time),
      db.prepare(`INSERT INTO pk_leaderboard_entries (source_id, battle_id, user_id, side, total_points, total_gifts_sent, created_at, updated_at)
        VALUES (?, ?, ?, 'RIGHT', 25, 2, ?, ?)`).bind(pkLeaderboardId, pkActiveBattleId, visitorId, time, time)
    ]);

    for (const path of [
      `/api/pk/active/${pkLeftRoomId}`,
      "/api/pk/available-opponents",
      `/api/pk/history/user/${visitorId}`,
      `/api/pk/history/room/${pkLeftRoomId}`,
      `/api/pk/${pkActiveBattleId}/events`,
      `/api/pk/${pkActiveBattleId}/leaderboard`,
      `/api/pk/${pkActiveBattleId}/media-sessions?roomId=${pkLeftRoomId}`,
      `/api/pk/${pkActiveBattleId}`
    ]) await request(path, 401);

    await requestAs(owner, "/api/pk/active/not-an-id", 400);
    const active = (await requestAs(owner, `/api/pk/active/${pkLeftRoomId}`, 200)).data;
    assert.equal(active.battle.battleId, pkActiveBattleId);
    assert.equal(active.battle.myVote, "RIGHT");
    assert.equal(active.battle.myReady, true);
    assert.equal(active.invite._id, pkInviteId);
    assert.equal(active.invite.status, "PENDING");
    const idle = (await requestAs(owner, `/api/pk/active/${pkOpponentRoomId}`, 200)).data;
    assert.deepEqual(idle, { battle: null, invite: null });

    const opponents = (await requestAs(owner, "/api/pk/available-opponents?limit=50", 200)).data.opponents;
    assert.ok(opponents.some(opponent => opponent.roomId === pkOpponentRoomId));
    assert.equal(opponents.some(opponent => opponent.roomId === pkRightRoomId), false);

    await requestAs(owner, "/api/pk/history/user/not-an-id", 400);
    const userHistory = (await requestAs(owner, `/api/pk/history/user/${visitorId}`, 200)).data.battles;
    assert.ok(userHistory.some(battle => battle.battleId === pkEndedBattleId));
    assert.equal(userHistory.some(battle => battle.battleId === pkActiveBattleId), false);
    await requestAs(owner, "/api/pk/history/room/not-an-id", 400);
    const roomHistory = (await requestAs(owner, `/api/pk/history/room/${pkLeftRoomId}`, 200)).data.battles;
    assert.ok(roomHistory.some(battle => battle.battleId === pkEndedBattleId));

    await requestAs(owner, "/api/pk/not-an-id/events", 400);
    const events = (await requestAs(owner, `/api/pk/${pkActiveBattleId}/events`, 200)).data.events;
    assert.equal(events.length, 1);
    assert.equal(events[0]._id, pkEventId);
    assert.equal(events[0].eventType, "PK_CREATED");
    assert.deepEqual(events[0].metadata, { fixture: true });

    await requestAs(owner, "/api/pk/not-an-id/leaderboard", 400);
    const entries = (await requestAs(owner, `/api/pk/${pkActiveBattleId}/leaderboard`, 200)).data.entries;
    assert.equal(entries.length, 1);
    assert.equal(entries[0]._id, pkLeaderboardId);
    assert.equal(entries[0].userId._id, visitorId);
    assert.equal(entries[0].totalPoints, 25);

    await requestAs(owner, "/api/pk/not-an-id", 400);
    const detail = (await requestAs(owner, `/api/pk/${pkActiveBattleId}`, 200)).data;
    assert.equal(detail.battle.battleId, pkActiveBattleId);
    assert.equal(detail.invite._id, pkInviteId);
    assert.equal(detail.battle.left.roomId, pkLeftRoomId);
    assert.equal(detail.battle.right.roomId, pkRightRoomId);

    const mediaPath = `/api/pk/${pkActiveBattleId}/media-sessions?roomId=${pkLeftRoomId}`;
    await requestAs(owner, "/api/pk/not-an-id/media-sessions?roomId=" + pkLeftRoomId, 400);
    await requestAs(owner, `/api/pk/${pkActiveBattleId}/media-sessions?roomId=bad`, 400);
    await requestAs(gamer, mediaPath, 403);
    await requestAs(owner, `/api/pk/${pkActiveBattleId}/media-sessions?roomId=${pkOpponentRoomId}`, 403);
    const session = (await requestAs(owner, mediaPath, 200)).data.opponent;
    assert.equal(session.roomId, pkRightRoomId);
    assert.equal(session.roomName, pkRightRoomId);
    assert.equal(session.title, "PK Right");
    assert.equal(session.role, "PK_OPPONENT_VIEWER");
    assert.equal(session.url, "wss://livekit.fixture");
    const claims = readLiveKitToken(session.token);
    assert.equal(claims.payload.sub, `${ownerId}:pk:${pkActiveBattleId}:opponent`);
    assert.equal(claims.payload.video.room, pkRightRoomId);
    assert.equal(claims.payload.video.canPublish, false);
    assert.deepEqual(claims.payload.video.canPublishSources, []);
  } finally {
    await db.batch([
      db.prepare("DELETE FROM pk_events WHERE battle_id IN (?, ?)").bind(pkActiveBattleId, pkEndedBattleId),
      db.prepare("DELETE FROM pk_leaderboard_entries WHERE battle_id IN (?, ?)").bind(pkActiveBattleId, pkEndedBattleId),
      db.prepare("DELETE FROM pk_votes WHERE battle_id = ?").bind(pkActiveBattleId),
      db.prepare("DELETE FROM pk_invites WHERE battle_id = ?").bind(pkActiveBattleId),
      db.prepare("DELETE FROM pk_participants WHERE battle_id IN (?, ?)").bind(pkActiveBattleId, pkEndedBattleId),
      db.prepare("DELETE FROM pk_battles WHERE source_id IN (?, ?)").bind(pkActiveBattleId, pkEndedBattleId),
      db.prepare("DELETE FROM room_participants WHERE room_id IN (?, ?, ?)").bind(pkLeftRoomId, pkRightRoomId, pkOpponentRoomId),
      db.prepare("DELETE FROM rooms WHERE source_id IN (?, ?, ?)").bind(pkLeftRoomId, pkRightRoomId, pkOpponentRoomId)
    ]);
  }

  // PK write routes. Socket.IO fan-out remains legacy-only; these fixtures verify
  // the authoritative HTTP commit and guarded batches.
  const pkWriteRoomId = newId();
  const pkOtherRoomId = newId();
  const pkEndedRoomId = newId();
  const pkRejectBattleId = newId();
  const pkExpiredBattleId = newId();
  const pkCancelBattleId = newId();
  const pkCloseBattleId = newId();
  const pkAcceptBattleId = newId();
  const pkStartBattleId = newId();
  const pkAcceptExpiredBattleId = newId();
  const pkNonLiveBattleId = newId();
  const pkRejectInviteId = newId();
  const pkExpiredInviteId = newId();
  const pkAcceptInviteId = newId();
  const pkStartInviteId = newId();
  const pkAcceptExpiredInviteId = newId();
  const pkNonLiveInviteId = newId();
  const pkExpired = new Date(now.getTime() - 60_000).toISOString();
  let startedBattleId = "";
  try {
    await db.batch([
      ...[
        [pkWriteRoomId, "PK Write", ownerId],
        [pkOtherRoomId, "PK Other", visitorId]
      ].map(([id, title, host]) => db.prepare(`INSERT INTO rooms
        (source_id, title, description, type, host_id, category, tags, language, status, visibility,
         max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests,
         mic_locked, vip_only, created_at, updated_at)
        VALUES (?, ?, 'desc', 'VOICE', ?, 'chill', '[]', 'en', 'LIVE', 'PUBLIC', 8, 1, 0, ?, 1, 0, 0, ?, ?)`)
        .bind(id, title, host, id, time, time)),
      db.prepare(`INSERT INTO rooms
        (source_id, title, description, type, host_id, category, tags, language, status, visibility,
         max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests,
         mic_locked, vip_only, created_at, updated_at)
        VALUES (?, 'PK Ended', 'desc', 'VOICE', ?, 'chill', '[]', 'en', 'ENDED', 'PUBLIC', 8, 1, 0, ?, 1, 0, 0, ?, ?)`)
        .bind(pkEndedRoomId, visitorId, pkEndedRoomId, time, time),
      db.prepare(`INSERT INTO room_participants
        (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
        VALUES (?, ?, ?, 'HOST', 1, 0, 0, 0, ?)`).bind(newId(), pkWriteRoomId, ownerId, time),
      db.prepare(`INSERT INTO room_participants
        (source_id, room_id, user_id, role, mic_enabled, moderator_muted, seat_index, camera_enabled, joined_at)
        VALUES (?, ?, ?, 'SPEAKER', 1, 0, 1, 0, ?)`).bind(newId(), pkWriteRoomId, visitorId, time),
      ...[
        [pkRejectBattleId, "INVITED", pkPast],
        [pkExpiredBattleId, "INVITED", pkPast],
        [pkCancelBattleId, "PREPARING", pkPast],
        [pkCloseBattleId, "COMPLETED", pkPast],
        [pkAcceptBattleId, "INVITED", null],
        [pkStartBattleId, "INVITED", null],
        [pkAcceptExpiredBattleId, "INVITED", null]
      ].map(([id, status, ended]) => db.prepare(`INSERT INTO pk_battles (source_id, battle_code, title, mode, format, scope, team_size, status,
        battle_type, duration_seconds, in_room_battle, state_version, event_sequence, termination_reason,
        started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id, left_score, right_score,
        ended_at, created_at, updated_at)
        VALUES (?, ?, 'PK Write Fixture', 'VOTE', 'PLAYER', 'CROSS_ROOM', 1, ?, 'VOICE', 180, 0, 1, 0, '',
        ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`)
        .bind(id, id, status, ownerId, pkWriteRoomId, pkOtherRoomId, ownerId, visitorId, ended, time, time)),
      db.prepare(`INSERT INTO pk_battles (source_id, battle_code, title, mode, format, scope, team_size, status,
        battle_type, duration_seconds, in_room_battle, state_version, event_sequence, termination_reason,
        started_by_user_id, left_room_id, right_room_id, left_host_id, right_host_id, left_score, right_score,
        ended_at, created_at, updated_at)
        VALUES (?, ?, 'PK Ended Room', 'VOTE', 'PLAYER', 'CROSS_ROOM', 1, 'INVITED', 'VOICE', 180, 0, 1, 0, '',
        ?, ?, ?, ?, ?, 0, 0, ?, ?, ?)`)
        .bind(pkNonLiveBattleId, pkNonLiveBattleId, ownerId, pkWriteRoomId, pkEndedRoomId, ownerId, visitorId, null, time, time),
      ...[
        [pkRejectInviteId, pkRejectBattleId, pkFuture, pkOtherRoomId],
        [pkExpiredInviteId, pkExpiredBattleId, pkExpired, pkOtherRoomId],
        [pkAcceptInviteId, pkAcceptBattleId, pkFuture, pkOtherRoomId],
        [pkStartInviteId, pkStartBattleId, pkFuture, pkOtherRoomId],
        [pkAcceptExpiredInviteId, pkAcceptExpiredBattleId, pkExpired, pkOtherRoomId],
        [pkNonLiveInviteId, pkNonLiveBattleId, pkFuture, pkEndedRoomId]
      ].map(([id, battleId, expires, inviteeRoomId]) => db.prepare(`INSERT INTO pk_invites (source_id, battle_id, inviter_user_id, invitee_user_id,
        inviter_room_id, invitee_room_id, status, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`)
        .bind(id, battleId, ownerId, visitorId, pkWriteRoomId, inviteeRoomId, expires, time, time))
    ]);

    for (const path of ["/api/pk/room-start", "/api/pk/reject", "/api/pk/accept", "/api/pk/start",
      "/api/pk/cancel", `/api/pk/${pkCloseBattleId}/ready`, `/api/pk/${pkCloseBattleId}/close`]) {
      await request(path, 401, { body: {} });
    }
    await requestAs(visitor, "/api/pk/accept", 422, { body: { inviteId: "bad" } });
    await requestAs(visitor, "/api/pk/start", 422, { body: {} });
    await requestAs(owner, "/api/pk/not-an-id/ready", 400, { body: {} });

    await requestAs(owner, "/api/pk/room-start", 400, {
      body: { roomId: pkWriteRoomId, leftPlayerId: ownerId, rightPlayerId: visitorId, mode: "VOTE", durationSeconds: 1800 }
    });
    const pkMutedUntil = new Date(now.getTime() + 60_000).toISOString();
    await db.prepare("UPDATE users SET muted_until = ? WHERE source_id = ?").bind(pkMutedUntil, ownerId).run();
    try {
      const muted = await requestAs(owner, "/api/pk/room-start", 403, {
        body: { roomId: pkWriteRoomId, leftPlayerId: ownerId, rightPlayerId: visitorId, mode: "VOTE", durationSeconds: 60 }
      });
      assert.equal(muted.error.message, `Account muted until ${pkMutedUntil}`);
    } finally {
      await db.prepare("UPDATE users SET muted_until = NULL WHERE source_id = ?").bind(ownerId).run();
    }
    const started = (await requestAs(owner, "/api/pk/room-start", 201, {
      body: { roomId: pkWriteRoomId, leftPlayerId: ownerId, rightPlayerId: visitorId, mode: "VOTE", durationSeconds: 60 }
    })).data;
    assert.equal(started.battle.status, "PREPARING");
    assert.equal(started.battle.mode, "VOTE");
    assert.equal(started.battle.left.score, 0);
    assert.equal(started.battle.right.score, 0);
    startedBattleId = started.battle.battleId;
    assert.equal((await db.prepare("SELECT active_pk_id FROM rooms WHERE source_id = ?").bind(pkWriteRoomId).first("active_pk_id")), startedBattleId);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_participants WHERE battle_id = ?").bind(startedBattleId).first("count"), 2);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_CREATED'").bind(startedBattleId).first("count"), 1);
    await requestAs(owner, "/api/pk/room-start", 409, {
      body: { roomId: pkWriteRoomId, leftPlayerId: ownerId, rightPlayerId: visitorId, mode: "VOTE", durationSeconds: 60 }
    });
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_battles WHERE left_room_id = ? AND battle_code LIKE 'PK-%'").bind(pkWriteRoomId).first("count"), 1);
    await requestAs(owner, `/api/pk/${startedBattleId}/close`, 409, { body: {} });

    await requestAs(owner, "/api/pk/reject", 403, { body: { inviteId: pkRejectInviteId } });
    assert.deepEqual((await requestAs(visitor, "/api/pk/reject", 200, { body: { inviteId: pkRejectInviteId } })).data, { rejected: true });
    assert.equal(await db.prepare("SELECT status FROM pk_invites WHERE source_id = ?").bind(pkRejectInviteId).first("status"), "REJECTED");
    assert.equal(await db.prepare("SELECT status FROM pk_battles WHERE source_id = ?").bind(pkRejectBattleId).first("status"), "DECLINED");
    assert.equal(await db.prepare("SELECT state_version FROM pk_battles WHERE source_id = ?").bind(pkRejectBattleId).first("state_version"), 2);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_INVITE_REJECTED'").bind(pkRejectBattleId).first("count"), 1);
    await requestAs(visitor, "/api/pk/reject", 409, { body: { inviteId: pkRejectInviteId } });
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_INVITE_REJECTED'").bind(pkRejectBattleId).first("count"), 1);
    assert.equal(await db.prepare("SELECT active_pk_id FROM rooms WHERE source_id IN (?, ?) AND active_pk_id IS NOT NULL")
      .bind(pkWriteRoomId, pkOtherRoomId).first("active_pk_id"), startedBattleId);

    await requestAs(visitor, "/api/pk/reject", 409, { body: { inviteId: pkExpiredInviteId } });
    assert.equal(await db.prepare("SELECT status FROM pk_invites WHERE source_id = ?").bind(pkExpiredInviteId).first("status"), "EXPIRED");
    assert.equal(await db.prepare("SELECT status FROM pk_battles WHERE source_id = ?").bind(pkExpiredBattleId).first("status"), "EXPIRED");
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_INVITE_EXPIRED'").bind(pkExpiredBattleId).first("count"), 1);

    // Accept and start share one guarded invite acceptance handler.
    const notInvitee = await requestAs(owner, "/api/pk/accept", 403, { body: { inviteId: pkAcceptInviteId } });
    assert.equal(notInvitee.error.message, "Only invitee can accept");
    const accepted = (await requestAs(visitor, "/api/pk/accept", 200, { body: { inviteId: pkAcceptInviteId } })).data;
    assert.equal(accepted.battle.status, "PREPARING");
    assert.equal(accepted.battle.stateVersion, 2);
    assert.equal(accepted.invite._id, pkAcceptInviteId);
    assert.equal(accepted.invite.status, "ACCEPTED");
    assert.ok(accepted.invite.respondedAt);
    assert.equal(await db.prepare("SELECT status FROM pk_battles WHERE source_id = ?").bind(pkAcceptBattleId).first("status"), "PREPARING");
    assert.equal(await db.prepare("SELECT state_version FROM pk_battles WHERE source_id = ?").bind(pkAcceptBattleId).first("state_version"), 2);
    const acceptedHosts = (await db.prepare("SELECT side, role, is_ready FROM pk_participants WHERE battle_id = ? ORDER BY side")
      .bind(pkAcceptBattleId).all()).results;
    assert.deepEqual(acceptedHosts.map(row => row.side), ["LEFT", "RIGHT"]);
    assert.ok(acceptedHosts.every(row => row.role === "HOST" && row.is_ready === 0));
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_INVITE_ACCEPTED'")
      .bind(pkAcceptBattleId).first("count"), 1);
    const acceptedReplay = await requestAs(visitor, "/api/pk/accept", 409, { body: { inviteId: pkAcceptInviteId } });
    assert.equal(acceptedReplay.error.message, "Invite is not pending");
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_INVITE_ACCEPTED'")
      .bind(pkAcceptBattleId).first("count"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_participants WHERE battle_id = ?").bind(pkAcceptBattleId).first("count"), 2);

    const startedViaStart = (await requestAs(visitor, "/api/pk/start", 200, { body: { inviteId: pkStartInviteId } })).data;
    assert.equal(startedViaStart.battle.status, "PREPARING");
    assert.equal(startedViaStart.invite._id, pkStartInviteId);
    assert.equal(await db.prepare("SELECT status FROM pk_invites WHERE source_id = ?").bind(pkStartInviteId).first("status"), "ACCEPTED");

    const expiredAccept = await requestAs(visitor, "/api/pk/accept", 409, { body: { inviteId: pkAcceptExpiredInviteId } });
    assert.equal(expiredAccept.error.message, "PK invite expired");
    assert.equal(await db.prepare("SELECT status FROM pk_invites WHERE source_id = ?").bind(pkAcceptExpiredInviteId).first("status"), "EXPIRED");
    assert.equal(await db.prepare("SELECT status FROM pk_battles WHERE source_id = ?").bind(pkAcceptExpiredBattleId).first("status"), "EXPIRED");
    assert.equal(await db.prepare("SELECT event_sequence FROM pk_battles WHERE source_id = ?").bind(pkAcceptExpiredBattleId).first("event_sequence"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_INVITE_EXPIRED'")
      .bind(pkAcceptExpiredBattleId).first("count"), 1);
    const nonLive = await requestAs(visitor, "/api/pk/accept", 400, { body: { inviteId: pkNonLiveInviteId } });
    assert.equal(nonLive.error.message, "Both rooms must be live");

    // Ready completes PREPARING -> READY -> COUNTDOWN; the DO alarm continues from there.
    const nonParticipant = await requestAs(gamer, `/api/pk/${startedBattleId}/ready`, 403, { body: {} });
    assert.equal(nonParticipant.error.message, "Only a PK participant can ready up");
    const closedReady = await requestAs(owner, `/api/pk/${pkRejectBattleId}/ready`, 409, { body: {} });
    assert.equal(closedReady.error.message, "PK preparation is closed");
    const firstReady = (await requestAs(owner, `/api/pk/${startedBattleId}/ready`, 200, { body: {} })).data;
    assert.equal(firstReady.ready, true);
    assert.equal(firstReady.battle.status, "PREPARING");
    assert.equal(firstReady.battle.myReady, true);
    assert.equal(await db.prepare("SELECT is_ready FROM pk_participants WHERE battle_id = ? AND user_id = ?")
      .bind(startedBattleId, ownerId).first("is_ready"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_READY'")
      .bind(startedBattleId).first("count"), 1);
    const allReady = (await requestAs(visitor, `/api/pk/${startedBattleId}/ready`, 200, { body: {} })).data;
    assert.equal(allReady.battle.status, "COUNTDOWN");
    assert.equal(allReady.battle.stateVersion, 3);
    assert.ok(allReady.battle.countdownEndsAt);
    assert.equal(allReady.battle.myReady, true);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_READY'")
      .bind(startedBattleId).first("count"), 3);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_COUNTDOWN'")
      .bind(startedBattleId).first("count"), 1);
    assert.equal((await requestAs(owner, `/api/pk/active/${pkWriteRoomId}`, 200)).data.battle.myReady, true);
    const readyReplay = await requestAs(visitor, `/api/pk/${startedBattleId}/ready`, 409, { body: {} });
    assert.equal(readyReplay.error.message, "PK preparation is closed");
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_COUNTDOWN'")
      .bind(startedBattleId).first("count"), 1);

    await requestAs(visitor, "/api/pk/cancel", 403, { body: { battleId: pkCancelBattleId } });
    assert.deepEqual((await requestAs(owner, "/api/pk/cancel", 200, { body: { battleId: pkCancelBattleId } })).data, { cancelled: true });
    assert.equal(await db.prepare("SELECT status FROM pk_battles WHERE source_id = ?").bind(pkCancelBattleId).first("status"), "CANCELLED");
    assert.equal(await db.prepare("SELECT state_version FROM pk_battles WHERE source_id = ?").bind(pkCancelBattleId).first("state_version"), 2);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_CANCELLED'").bind(pkCancelBattleId).first("count"), 1);
    await requestAs(owner, "/api/pk/cancel", 409, { body: { battleId: pkCancelBattleId } });
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_CANCELLED'").bind(pkCancelBattleId).first("count"), 1);

    await db.prepare("UPDATE rooms SET host_id = ? WHERE source_id = ?").bind(ownerId, pkOtherRoomId).run();
    try {
      await requestAs(visitor, `/api/pk/${pkCloseBattleId}/close`, 403, { body: {} });
    } finally {
      await db.prepare("UPDATE rooms SET host_id = ? WHERE source_id = ?").bind(visitorId, pkOtherRoomId).run();
    }
    const closed = (await requestAs(owner, `/api/pk/${pkCloseBattleId}/close`, 200, { body: {} })).data;
    assert.equal(closed.battle.status, "CLOSED");
    assert.equal(closed.battle.stateVersion, 2);
    assert.equal((await requestAs(owner, `/api/pk/${pkCloseBattleId}/close`, 200, { body: {} })).data.battle.status, "CLOSED");
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = 'PK_CLOSED'").bind(pkCloseBattleId).first("count"), 1);
    await requestAs(owner, "/api/pk/not-an-id/close", 400, { body: {} });
  } finally {
    await db.prepare("UPDATE rooms SET active_pk_id = NULL WHERE source_id IN (?, ?, ?)")
      .bind(pkWriteRoomId, pkOtherRoomId, pkEndedRoomId).run();
    await db.prepare("DELETE FROM pk_events WHERE battle_id IN (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(startedBattleId ?? "", pkRejectBattleId, pkExpiredBattleId, pkCancelBattleId, pkCloseBattleId,
        pkAcceptBattleId, pkStartBattleId, pkAcceptExpiredBattleId, pkNonLiveBattleId).run();
    await db.prepare("DELETE FROM pk_invites WHERE battle_id IN (?, ?, ?, ?, ?, ?, ?)")
      .bind(pkRejectBattleId, pkExpiredBattleId, pkCancelBattleId, pkAcceptBattleId, pkStartBattleId,
        pkAcceptExpiredBattleId, pkNonLiveBattleId).run();
    await db.prepare("DELETE FROM pk_participants WHERE battle_id IN (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(startedBattleId ?? "", pkRejectBattleId, pkExpiredBattleId, pkCancelBattleId, pkCloseBattleId,
        pkAcceptBattleId, pkStartBattleId, pkAcceptExpiredBattleId).run();
    await db.prepare("DELETE FROM pk_battles WHERE source_id IN (?, ?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(startedBattleId ?? "", pkRejectBattleId, pkExpiredBattleId, pkCancelBattleId, pkCloseBattleId,
        pkAcceptBattleId, pkStartBattleId, pkAcceptExpiredBattleId, pkNonLiveBattleId).run();
    await db.prepare("DELETE FROM room_participants WHERE room_id IN (?, ?)").bind(pkWriteRoomId, pkOtherRoomId).run();
    await db.prepare("DELETE FROM rooms WHERE source_id IN (?, ?, ?)").bind(pkWriteRoomId, pkOtherRoomId, pkEndedRoomId).run();
  }

  // D1 PK deadline recovery runs from a singleton Durable Object alarm. Socket.IO
  // fan-out stays legacy-only, but all state-machine commits are authoritative.
  assert.ok(worker, "The D1 PK alarm fixture requires the Worker instance");
  const pkAlarmNamespace = await worker.getDurableObjectNamespace("PK_DEADLINES");
  const pkAlarm = pkAlarmNamespace.get(pkAlarmNamespace.idFromName("yugm-d1-pk-deadlines"));
  const pkAlarmRun = async () => {
    const response = await pkAlarm.fetch("https://pk-alarm/run", { method: "POST" });
    assert.equal(response.status, 200);
  };
  const pkAlarmRoomId = newId();
  const pkAlarmOtherRoomId = newId();
  const pkAlarmReadyId = newId();
  const pkAlarmCountdownId = newId();
  const pkAlarmActiveId = newId();
  const pkAlarmCompletedId = newId();
  const pkAlarmInviteId = newId();
  const pkAlarmInvitationId = newId();
  const pkAlarmReadyAt = new Date(now.getTime() - 5000).toISOString();
  const pkAlarmCountdownAt = new Date(now.getTime() - 1000).toISOString();
  const pkAlarmStartedAt = new Date(now.getTime() - 70_000).toISOString();
  const pkAlarmEndedAt = new Date(now.getTime() - 61_000).toISOString();
  const pkAlarmExpiresAt = new Date(now.getTime() - 1000).toISOString();
  try {
    await db.batch([
      ...[
        [pkAlarmRoomId, "PK Alarm", ownerId],
        [pkAlarmOtherRoomId, "PK Alarm Other", visitorId]
      ].map(([id, title, host]) => db.prepare(`INSERT INTO rooms
        (source_id, title, description, type, host_id, category, tags, language, status, visibility,
         max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests,
         mic_locked, vip_only, created_at, updated_at)
        VALUES (?, ?, 'desc', 'VOICE', ?, 'chill', '[]', 'en', 'LIVE', 'PUBLIC', 8, 1, 0, ?, 1, 0, 0, ?, ?)`)
        .bind(id, title, host, id, time, time)),
      ...[
        [pkAlarmReadyId, "READY", pkAlarmReadyAt, null, null],
        [pkAlarmCountdownId, "COUNTDOWN", time, null, pkAlarmCountdownAt],
        [pkAlarmActiveId, "ACTIVE", time, pkAlarmStartedAt, null],
        [pkAlarmCompletedId, "COMPLETED", time, null, pkAlarmEndedAt],
        [pkAlarmInviteId, "INVITED", time, null, null]
      ].map(([id, status, updated, started, countdown]) => db.prepare(`INSERT INTO pk_battles
        (source_id, battle_code, title, mode, format, scope, team_size, status, battle_type, duration_seconds,
         in_room_battle, state_version, event_sequence, termination_reason, started_by_user_id, left_room_id,
         right_room_id, left_host_id, right_host_id, left_score, right_score, started_at, ended_at,
         countdown_ends_at, created_at, updated_at)
        VALUES (?, ?, 'PK Alarm Fixture', 'VOTE', 'PLAYER', 'CROSS_ROOM', 1, ?, 'VOICE', 60, 0, 1, 0, '',
          ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
        .bind(id, id, status, ownerId, pkAlarmRoomId, pkAlarmOtherRoomId, ownerId, visitorId,
          status === "ACTIVE" ? 9 : 0, status === "ACTIVE" ? 4 : 0, started, status === "COMPLETED" ? pkAlarmEndedAt : null,
          countdown, time, updated)),
      db.prepare(`INSERT INTO pk_invites (source_id, battle_id, inviter_user_id, invitee_user_id,
        inviter_room_id, invitee_room_id, status, expires_at, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, 'PENDING', ?, ?, ?)`)
        .bind(pkAlarmInvitationId, pkAlarmInviteId, ownerId, visitorId, pkAlarmRoomId, pkAlarmOtherRoomId,
          pkAlarmExpiresAt, time, time),
      db.prepare("UPDATE rooms SET active_pk_id = ? WHERE source_id = ?").bind(pkAlarmActiveId, pkAlarmRoomId)
    ]);

    await pkAlarmRun();
    const realtimeNamespace = await worker.getDurableObjectNamespace("NATIVE_REALTIME");
    const realtimeEvents = async (scope) => {
      const stub = realtimeNamespace.get(realtimeNamespace.idFromName(scope));
      const response = await stub.fetch(`https://native-realtime/history?scope=${encodeURIComponent(scope)}`);
      assert.equal(response.status, 200);
      return (await response.json()).envelopes.map((envelope) => envelope.event);
    };
    const leftRoomScope = `room:${pkAlarmRoomId}`;
    const rightRoomScope = `room:${pkAlarmOtherRoomId}`;
    assert.ok((await realtimeEvents(leftRoomScope)).includes("pk:started"));
    assert.ok((await realtimeEvents(rightRoomScope)).includes("pk:started"));
    assert.ok((await realtimeEvents(leftRoomScope)).includes("pk:ended"));
    assert.ok((await realtimeEvents(leftRoomScope)).includes("pk:invite:expired"));
    assert.ok((await realtimeEvents(`user:${visitorId}`)).includes("pk:invite:expired"));
    const battleState = async (id) => db.prepare("SELECT status, state_version AS stateVersion, event_sequence AS eventSequence, winner_side AS winnerSide, winner_user_id AS winnerUserId FROM pk_battles WHERE source_id = ?")
      .bind(id).first();
    const eventCount = async (id, type) => db.prepare("SELECT COUNT(*) AS count FROM pk_events WHERE battle_id = ? AND event_type = ?")
      .bind(id, type).first("count");

    assert.deepEqual(await battleState(pkAlarmReadyId), {
      status: "COUNTDOWN", stateVersion: 2, eventSequence: 1, winnerSide: null, winnerUserId: null
    });
    assert.equal(await eventCount(pkAlarmReadyId, "PK_COUNTDOWN"), 1);
    const countdownAt = await db.prepare("SELECT countdown_ends_at FROM pk_battles WHERE source_id = ?")
      .bind(pkAlarmReadyId).first("countdown_ends_at");
    assert.ok(Date.parse(countdownAt) > Date.now());

    assert.deepEqual(await battleState(pkAlarmCountdownId), {
      status: "ACTIVE", stateVersion: 2, eventSequence: 1, winnerSide: null, winnerUserId: null
    });
    assert.equal(await db.prepare("SELECT started_at FROM pk_battles WHERE source_id = ?")
      .bind(pkAlarmCountdownId).first("started_at"), pkAlarmCountdownAt);
    assert.equal(await eventCount(pkAlarmCountdownId, "PK_STARTED"), 1);

    assert.deepEqual(await battleState(pkAlarmActiveId), {
      status: "COMPLETED", stateVersion: 4, eventSequence: 3, winnerSide: "LEFT", winnerUserId: ownerId
    });
    for (const type of ["PK_FINAL_CRUNCH", "PK_FINALIZING", "PK_COMPLETED"]) {
      assert.equal(await eventCount(pkAlarmActiveId, type), 1, type);
    }
    assert.equal(await db.prepare("SELECT active_pk_id FROM rooms WHERE source_id = ?").bind(pkAlarmRoomId).first("active_pk_id"), null);

    assert.deepEqual(await battleState(pkAlarmCompletedId), {
      status: "CLOSED", stateVersion: 2, eventSequence: 1, winnerSide: null, winnerUserId: null
    });
    assert.equal(await eventCount(pkAlarmCompletedId, "PK_CLOSED"), 1);
    assert.ok(await db.prepare("SELECT closed_at FROM pk_battles WHERE source_id = ?").bind(pkAlarmCompletedId).first("closed_at"));

    assert.deepEqual(await battleState(pkAlarmInviteId), {
      status: "EXPIRED", stateVersion: 2, eventSequence: 1, winnerSide: null, winnerUserId: null
    });
    assert.equal(await db.prepare("SELECT status FROM pk_invites WHERE source_id = ?")
      .bind(pkAlarmInvitationId).first("status"), "EXPIRED");
    assert.equal(await eventCount(pkAlarmInviteId, "PK_INVITE_EXPIRED"), 1);

    await pkAlarmRun();
    assert.equal(await eventCount(pkAlarmReadyId, "PK_COUNTDOWN"), 1);
    assert.equal(await eventCount(pkAlarmCountdownId, "PK_STARTED"), 1);
    assert.equal(await eventCount(pkAlarmCompletedId, "PK_CLOSED"), 1);
    assert.equal(await eventCount(pkAlarmInviteId, "PK_INVITE_EXPIRED"), 1);
    const scheduled = await (await pkAlarm.fetch("https://pk-alarm/status")).json();
    assert.ok(scheduled.alarm !== null && scheduled.alarm <= Date.now() + 70_000);
  } finally {
    await db.prepare("UPDATE rooms SET active_pk_id = NULL WHERE source_id IN (?, ?)")
      .bind(pkAlarmRoomId, pkAlarmOtherRoomId).run();
    await db.prepare("DELETE FROM pk_events WHERE battle_id IN (?, ?, ?, ?, ?)")
      .bind(pkAlarmReadyId, pkAlarmCountdownId, pkAlarmActiveId, pkAlarmCompletedId, pkAlarmInviteId).run();
    await db.prepare("DELETE FROM pk_invites WHERE source_id = ?").bind(pkAlarmInvitationId).run();
    await db.prepare("DELETE FROM pk_battles WHERE source_id IN (?, ?, ?, ?, ?)")
      .bind(pkAlarmReadyId, pkAlarmCountdownId, pkAlarmActiveId, pkAlarmCompletedId, pkAlarmInviteId).run();
    await db.prepare("DELETE FROM rooms WHERE source_id IN (?, ?)").bind(pkAlarmRoomId, pkAlarmOtherRoomId).run();
    const cleared = await pkAlarm.fetch("https://pk-alarm/schedule", { method: "POST" });
    assert.equal(cleared.status, 200);
  }

  await request("/api/users/me/profile-media", 401, { method: "POST", body: { url: "https://example.test/a.jpg", type: "IMAGE" } });
  const addedMedia = (await requestAs(owner, "/api/users/me/profile-media", 201, {
    body: { url: "https://example.test/a.jpg", type: "IMAGE", caption: "cap" }
  })).data;
  assert.equal(addedMedia.media.url, "https://example.test/a.jpg");
  assert.equal(addedMedia.media.caption, "cap");
  assert.ok(addedMedia.media._id);
  const removedMedia = (await requestAs(owner, `/api/users/me/profile-media/${addedMedia.media._id}`, 200, { method: "DELETE" })).data;
  assert.ok(removedMedia.user);

  // Durable friend-match state (search itself still needs live presence).
  const matchRoomId = newId();
  const matchRequestId = newId();
  const matchExpiry = new Date(now.getTime() + 60_000).toISOString();
  await db.batch([
    db.prepare(`INSERT INTO rooms (source_id, title, description, type, host_id, category, tags, language, status,
        visibility, max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests,
        mic_locked, vip_only, created_at, updated_at)
      VALUES (?, 'Match Room', 'desc', 'VOICE', ?, 'chill', '[]', 'en', 'LIVE', 'PRIVATE', 2, 2, 0, ?, 1, 0, 0, ?, ?)`)
      .bind(matchRoomId, gamerId, matchRoomId, time, time),
    db.prepare(`INSERT INTO friend_match_requests (source_id, user_id, status, matched_user_id, room_id, expires_at, created_at, updated_at)
      VALUES (?, ?, 'MATCHED', ?, ?, ?, ?, ?)`)
      .bind(matchRequestId, gamerId, ownerId, matchRoomId, matchExpiry, time, time)
  ]);
  try {
    await request("/api/users/friend-match", 401);
    const matched = (await requestAs(gamer, "/api/users/friend-match", 200)).data;
    assert.equal(matched.status, "MATCHED");
    assert.equal(matched.room._id, matchRoomId);
    assert.equal(matched.room.hostId, gamerId);

    const cancelMatched = (await requestAs(gamer, "/api/users/friend-match/cancel", 200, { body: {} })).data;
    assert.equal(cancelMatched.cancelled, true);
    assert.equal(await db.prepare("SELECT status FROM friend_match_requests WHERE source_id = ?").bind(matchRequestId).first("status"), "MATCHED");

    await db.prepare("UPDATE friend_match_requests SET status = 'WAITING' WHERE source_id = ?").bind(matchRequestId).run();
    const cancelWaiting = (await requestAs(gamer, "/api/users/friend-match/cancel", 200, { body: {} })).data;
    assert.equal(cancelWaiting.cancelled, true);
    assert.equal(await db.prepare("SELECT status FROM friend_match_requests WHERE source_id = ?").bind(matchRequestId).first("status"), "CANCELLED");

    await db.prepare("UPDATE rooms SET status = 'ENDED' WHERE source_id = ?").bind(matchRoomId).run();
    await db.prepare("UPDATE friend_match_requests SET status = 'MATCHED', expires_at = ? WHERE source_id = ?")
      .bind(matchExpiry, matchRequestId).run();
    const idle = (await requestAs(gamer, "/api/users/friend-match", 200)).data;
    assert.equal(idle.status, "IDLE");
    assert.equal(await db.prepare("SELECT status FROM friend_match_requests WHERE source_id = ?").bind(matchRequestId).first("status"), "CANCELLED");

    // Search preserves auth-before-limiter order; without a presence adapter no
    // D1 candidate is considered online, so the legacy WAITING shape is kept.
    await request("/api/users/friend-match/search", 401, { method: "POST", body: {} });
    const searching = (await requestAs(gamer, "/api/users/friend-match/search", 200,
      { method: "POST", body: {} })).data;
    assert.equal(searching.status, "WAITING");
    assert.equal(await db.prepare(`SELECT status FROM friend_match_requests
      WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC, source_id DESC LIMIT 1`)
      .bind(gamerId, new Date().toISOString()).first("status"), "WAITING");

    // The read route keeps the legacy chat-limiter position after auth.
    let rateLimited = false;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try {
        await requestAs(gamer, "/api/users/friend-match", 200);
      } catch (error) {
        if (!String(error?.message ?? error).includes("returned 429")) throw error;
        rateLimited = true;
        break;
      }
    }
    assert.equal(rateLimited, true);
  } finally {
    await db.batch([
      db.prepare("DELETE FROM friend_match_requests WHERE source_id = ? OR user_id = ?").bind(matchRequestId, gamerId),
      db.prepare("DELETE FROM rooms WHERE source_id = ?").bind(matchRoomId)
    ]);
  }

  // Private call room, participants, DM and notification.
  const callPriorVip = await db.prepare("SELECT vip_level, vip_tier, vip_expires_at, vip_frozen FROM users WHERE source_id = ?")
    .bind(ownerId).first();
  await db.prepare("UPDATE users SET vip_level = 1, vip_tier = 'VIP1', vip_expires_at = ?, vip_frozen = 0 WHERE source_id = ?")
    .bind(new Date(now.getTime() + 86_400_000).toISOString(), ownerId).run();
  let callRoomId;
  try {
    const callPath = `/api/users/messages/${visitorId}/call`;
    await request(callPath, 401, { method: "POST", body: { type: "VOICE" } });
    await requestAs(owner, callPath, 422, { method: "POST", body: { type: "AUDIO" } });
    await requestAs(owner, "/api/users/messages/not-an-id/call", 400, { method: "POST", body: { type: "VOICE" } });
    await requestAs(owner, `/api/users/messages/${ownerId}/call`, 400, { method: "POST", body: { type: "VOICE" } });

    await db.prepare("UPDATE users SET vip_level = 0, vip_tier = NULL, vip_expires_at = NULL, vip_frozen = 0 WHERE source_id = ?")
      .bind(ownerId).run();
    await requestAs(owner, callPath, 403, { method: "POST", body: { type: "VOICE" } });
    await db.prepare("UPDATE users SET vip_level = 1, vip_tier = 'VIP1', vip_expires_at = ?, vip_frozen = 0 WHERE source_id = ?")
      .bind(new Date(now.getTime() + 86_400_000).toISOString(), ownerId).run();

    const call = (await requestAs(owner, callPath, 201, { method: "POST", body: { type: "VIDEO" } })).data;
    callRoomId = call.room._id;
    assert.equal(call.room.type, "VIDEO");
    assert.equal(call.room.hostId, ownerId);
    assert.equal(call.room.participantCount, 2);
    assert.deepEqual(call.room.speakerIds, [ownerId, visitorId]);
    assert.equal(call.message.roomId, callRoomId);
    assert.equal(call.message.message, "Private video call started");
    assert.equal(call.message.senderId._id, ownerId);
    assert.equal(call.message.receiverId._id, visitorId);

    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM room_participants WHERE room_id = ?").bind(callRoomId).first("count"), 2);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM room_speakers WHERE rooms_id = ?").bind(callRoomId).first("count"), 2);
    assert.equal(await db.prepare("SELECT message FROM direct_messages WHERE room_id = ?").bind(callRoomId).first("message"), "Private video call started");
    const callNotice = await db.prepare(`SELECT user_id, title, body FROM notifications
      WHERE json_extract(data, '$.roomId') = ?`).bind(callRoomId).first();
    assert.equal(callNotice.user_id, visitorId);
    assert.equal(callNotice.title, "Private video call");
    assert.equal(callNotice.body, `${await db.prepare("SELECT name FROM users WHERE source_id = ?").bind(ownerId).first("name")} started a private video call`);
  } finally {
    if (callRoomId) {
      await db.batch([
        db.prepare("DELETE FROM notifications WHERE json_extract(data, '$.roomId') = ?").bind(callRoomId),
        db.prepare("DELETE FROM direct_messages WHERE room_id = ?").bind(callRoomId),
        db.prepare("DELETE FROM room_speakers WHERE rooms_id = ?").bind(callRoomId),
        db.prepare("DELETE FROM room_participants WHERE room_id = ?").bind(callRoomId),
        db.prepare("DELETE FROM rooms WHERE source_id = ?").bind(callRoomId)
      ]);
    }
    await db.prepare("UPDATE users SET vip_level = ?, vip_tier = ?, vip_expires_at = ?, vip_frozen = ? WHERE source_id = ?")
      .bind(callPriorVip.vip_level, callPriorVip.vip_tier, callPriorVip.vip_expires_at, callPriorVip.vip_frozen, ownerId).run();
  }

  await request("/api/creator/payout-kyc", 401);
  await requestAs(visitor, "/api/creator/payout-kyc", 403);
  await db.prepare("UPDATE users SET role = 'HOST' WHERE source_id = ?").bind(ownerId).run();
  try {
    const kyc = (await requestAs(owner, "/api/creator/payout-kyc", 200)).data.kyc;
    assert.equal(kyc.userId, ownerId);
    const kycStatus = (await requestAs(owner, "/api/creator/payout-kyc/status", 200)).data;
    assert.equal(kycStatus.kycStatus, kyc.kycStatus);
    const eligibility = (await requestAs(owner, "/api/creator/withdrawals/eligibility", 200)).data;
    assert.equal(eligibility.kycStatus, kycStatus.kycStatus);
    const withdrawals = (await requestAs(owner, "/api/creator/withdrawals", 200)).data;
    assert.ok(Array.isArray(withdrawals.withdrawals));
    assert.ok(withdrawals.balance);
  } finally {
    await db.prepare("UPDATE users SET role = 'USER' WHERE source_id = ?").bind(ownerId).run();
  }

  // Gift mutations (D1)
  const giftId = newId();
  const upgradeTargetId = newId();
  const giftNow = new Date().toISOString();
  await db.batch([
    db.prepare(`INSERT INTO gifts (source_id,name,icon,coin_price,pk_points,diamond_price,is_active,effect3d,interactive,animation_key,expires_at,combo_multiplier,category,bond_purpose,bond_kind,bond_points,bond_minimum_days,bond_cosmetic_id,theme,rarity,limited_edition_active,limited_edition_total,limited_edition_remaining,collection_id,tradable,upgradeable,achievement_gift,pet_gift,vehicle_gift,created_at,updated_at)
      VALUES (?,?,?,?,0,0,1,'',0,'',NULL,1,'normal',NULL,NULL,0,0,NULL,'default','common',0,0,0,NULL,1,1,0,0,0,?,?)`)
      .bind(giftId, "Test Gift", "🎁", 100, giftNow, giftNow),
    db.prepare(`INSERT INTO gifts (source_id,name,icon,coin_price,pk_points,diamond_price,is_active,effect3d,interactive,animation_key,expires_at,combo_multiplier,category,bond_purpose,bond_kind,bond_points,bond_minimum_days,bond_cosmetic_id,theme,rarity,limited_edition_active,limited_edition_total,limited_edition_remaining,collection_id,tradable,upgradeable,achievement_gift,pet_gift,vehicle_gift,created_at,updated_at)
      VALUES (?,?,?,?,0,0,1,'',0,'',NULL,1,'normal',NULL,NULL,0,0,NULL,'default','rare',0,0,0,NULL,1,0,0,0,0,?,?)`)
      .bind(upgradeTargetId, "Upgraded Gift", "💎", 200, giftNow, giftNow),
    db.prepare("INSERT INTO gift_upgrade_paths (source_id,value,gifts_id,position) VALUES (?,?,?,0)")
      .bind(newId(), upgradeTargetId, giftId),
    db.prepare("UPDATE users SET wallet_balance = 5000 WHERE source_id = ?").bind(ownerId)
  ]);

  await request("/api/gifts/purchase", 401, { method: "POST", body: { giftId } });
  const purchase = await requestAs(owner, "/api/gifts/purchase", 201, { body: { giftId } });
  assert.equal(purchase.data.gift._id, giftId);

  const combo = await requestAs(owner, "/api/gifts/combo", 409, { body: { roomId: live, giftId, participants: [ownerId, visitorId] } });
  assert.equal(combo.error.code, "CONFLICT");

  const surprise = await requestAs(owner, "/api/gifts/surprise-box", 200, { body: { tier: "basic" } });
  assert.ok(surprise.data.revealedGift);

  const inv = (await requestAs(owner, "/api/inventory", 200)).data.items;
  const purchasedInv = inv.find(item => item.gift?._id === giftId || item.gift?.id === giftId);
  assert.ok(purchasedInv);
  const upgrade = await requestAs(owner, "/api/gifts/upgrade", 200, { body: { inventoryId: purchasedInv.id || purchasedInv._id } });
  assert.equal(upgrade.data.upgradedGift._id, upgradeTargetId);

  const roomWide = await requestAs(owner, "/api/gifts/room-wide", 200, { body: { roomId: live, giftId: upgradeTargetId, receiverIds: [visitorId] } });
  assert.equal(roomWide.data.receiverCount, 1);

  // Cleanup fixture pollution for later tests (bonds counts gift_transactions by sender).
  await db.batch([
    db.prepare("DELETE FROM gift_transactions WHERE sender_id = ? AND gift_id IN (?, ?)").bind(ownerId, giftId, upgradeTargetId),
    db.prepare("DELETE FROM gift_inventories WHERE user_id = ? AND gift_id IN (?, ?)").bind(ownerId, giftId, upgradeTargetId),
    db.prepare("DELETE FROM gift_inventories WHERE user_id = ? AND source = 'mystery'").bind(ownerId),
    db.prepare("DELETE FROM gift_upgrade_paths WHERE gifts_id = ?").bind(giftId),
    db.prepare("DELETE FROM gifts WHERE source_id IN (?, ?)").bind(giftId, upgradeTargetId),
  ]);

  const apiRoot = await requestAs(owner, "/api", 200);
  assert.equal(apiRoot.service, "yugm-api");
  assert.ok(Array.isArray(apiRoot.endpointGroups));

  // v1 moderation report/appeal/status (D1)
  await request("/api/v1/moderation/report", 401, { method: "POST", body: { roomId: live, category: "spam" } });
  const report = await requestAs(owner, "/api/v1/moderation/report", 201, {
    body: { roomId: live, category: "spam", description: "fixture report" }
  });
  assert.ok(report.data.reportId);
  assert.equal(report.data.status, "PENDING");
  assert.equal(await db.prepare("SELECT status FROM reports WHERE source_id = ?").bind(report.data.reportId).first("status"), "PENDING");
  assert.equal(await db.prepare("SELECT target_type FROM moderation_queues WHERE source_id = ?").bind(report.data.queueId).first("target_type"), "ROOM");

  const actionId = newId();
  const actionNow = new Date().toISOString();
  await db.prepare(`INSERT INTO moderation_actions (source_id, target_user_id, action, reason, automated, created_at, updated_at)
    VALUES (?, ?, 'WARN', 'fixture action', 1, ?, ?)`).bind(actionId, ownerId, actionNow, actionNow).run();
  const appeal = await requestAs(owner, "/api/v1/moderation/appeal", 200, {
    body: { actionId, reason: "Please reconsider this moderation action" }
  });
  assert.equal(appeal.data.status, "PENDING_REVIEW");
  assert.ok(appeal.data.appealId);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM moderation_queues WHERE source_id = ?").bind(appeal.data.appealId).first("count"), 1);
  await requestAs(owner, "/api/v1/moderation/appeal", 404, { body: { actionId: newId(), reason: "Please reconsider this moderation action" } });

  const moderationStatus = (await requestAs(owner, "/api/v1/moderation/status", 200)).data;
  assert.ok(Array.isArray(moderationStatus.recentActions));
  assert.equal(typeof moderationStatus.trustScore, "number");

  await db.batch([
    db.prepare("DELETE FROM moderation_queues WHERE report_id = ? OR source_id = ?").bind(report.data.reportId, appeal.data.appealId),
    db.prepare("DELETE FROM reports WHERE source_id = ?").bind(report.data.reportId),
    db.prepare("DELETE FROM moderation_actions WHERE source_id = ?").bind(actionId)
  ]);

  // AI wingman is stateless: auth still precedes validation, and the D1 router
  // shares the legacy generators rather than calling an external provider.
  const ai = "/api/ai/wingman";
  await request(ai + "/bio/generate", 401, { body: { style: "invalid" } });
  await requestAs(owner, ai + "/bio/generate", 422, { body: { style: "invalid" } });
  const bioGenerated = (await requestAs(owner, ai + "/bio/generate", 200, {
    body: { style: "warm", interests: ["music", "travel"] }
  })).data;
  assert.equal(bioGenerated.style, "warm");
  assert.equal(bioGenerated.tips.length, 3);
  assert.ok(bioGenerated.suggestion.includes("music and travel"));

  await request(ai + "/bio/rate", 401, { body: { bio: 1 } });
  await requestAs(owner, ai + "/bio/rate", 422, { body: { bio: 1 } });
  const bioRated = (await requestAs(owner, ai + "/bio/rate", 200, {
    body: { bio: "I love music and travel? 🔥" }
  })).data;
  assert.equal(bioRated.score, 100);
  assert.equal(bioRated.rating, "🔥 Amazing!");
  assert.equal(bioRated.feedback.length, 4);
  assert.deepEqual(bioRated.suggestions, []);

  await request(ai + "/opener", 401, { body: {} });
  await requestAs(owner, ai + "/opener", 422, { body: {} });
  const opener = (await requestAs(owner, ai + "/opener", 200, {
    body: { style: "direct", targetUserContext: { name: "Asha", interests: ["music"], vibeScore: 88 } }
  })).data;
  assert.equal(opener.style, "direct");
  assert.equal(opener.openers.length, 3);
  assert.ok(opener.openers[0].includes("music"));
  assert.equal(opener.tip, "Personalize the opener by referencing something specific from their profile.");

  await request(ai + "/reply", 401, { body: { conversation: [] } });
  await requestAs(owner, ai + "/reply", 422, { body: { conversation: [] } });
  const aiReply = (await requestAs(owner, ai + "/reply", 200, {
    body: { style: "funny", conversation: [{ role: "other", content: "I saw a very long message here that should be truncated for context" }] }
  })).data;
  assert.equal(aiReply.suggestions.length, 3);
  assert.ok(aiReply.context.startsWith("Responding to: \"I saw a very long message"));
  assert.equal(aiReply.deliveryTip, "Reply within 2-3 hours for best conversation flow.");

  await request(ai + "/coach", 401, { body: { chatHistory: [] } });
  await requestAs(owner, ai + "/coach", 422, { body: { chatHistory: [] } });
  const coach = (await requestAs(owner, ai + "/coach", 200, {
    body: { chatHistory: [
      { role: "user", content: "Hi" },
      { role: "other", content: "Hello there, this is a much longer reply" }
    ] }
  })).data;
  assert.equal(coach.analysis.totalMessages, 2);
  assert.equal(coach.analysis.yourMessageCount, 1);
  assert.equal(coach.analysis.theirMessageCount, 1);
  assert.equal(coach.tips[0], "You're giving short replies — try adding more thought to your responses.");
  assert.equal(coach.redFlags, undefined);

  await request(ai + "/photo/rate", 401, { body: { photoUrl: "bad" } });
  await requestAs(owner, ai + "/photo/rate", 422, { body: { photoUrl: "bad" } });
  const photo = (await requestAs(owner, ai + "/photo/rate", 200, {
    body: { photoUrl: "https://example.test/photo.jpg" }
  })).data;
  assert.ok(photo.score >= 60 && photo.score <= 99);
  assert.equal(photo.feedback.length, 3);
  assert.equal(photo.suggestions.length, 3);

  const ghostConversation = Array.from({ length: 5 }, () => ({ role: "user", content: "Still here" }));
  ghostConversation.push({ role: "other", content: "I was here earlier" });
  await request(ai + "/ghost/detect", 401, { body: { conversation: ghostConversation.slice(0, 1) } });
  await requestAs(owner, ai + "/ghost/detect", 422, { body: { conversation: ghostConversation.slice(0, 1) } });
  const ghost = (await requestAs(owner, ai + "/ghost/detect", 200, { body: { conversation: ghostConversation } })).data;
  assert.equal(ghost.ghosting, true);
  assert.equal(ghost.confidence, 0.85);
  assert.equal(ghost.advice.length, 3);

  await request(ai + "/date/plan", 401, { body: { preferences: { vibe: "invalid" } } });
  await requestAs(owner, ai + "/date/plan", 422, { body: { preferences: { vibe: "invalid" } } });
  const datePlan = (await requestAs(owner, ai + "/date/plan", 200, {
    body: { preferences: { vibe: "foodie", budget: "low" } }
  })).data;
  assert.equal(datePlan.plan[0].name, "Virtual Chai Date");
  assert.deepEqual(datePlan.preferences, { vibe: "foodie", budget: "low" });

  await request(ai + "/gift/recommend", 401, { body: { budget: "invalid", recipientContext: {} } });
  await requestAs(owner, ai + "/gift/recommend", 422, { body: { budget: "invalid", recipientContext: {} } });
  const gifts = (await requestAs(owner, ai + "/gift/recommend", 200, {
    body: { budget: "low", recipientContext: { relationship: "friend" } }
  })).data;
  assert.equal(gifts.recommendations.length, 4);
  assert.ok(gifts.recommendations.every(gift => gift.reason.includes("friend")));

  await request(ai + "/analytics", 401);
  const analytics = (await requestAs(owner, ai + "/analytics", 200)).data;
  assert.ok(analytics.totalHelped >= 5000);
  assert.ok(analytics.conversationsAnalyzed >= 25000);
  assert.deepEqual(analytics.topFeatures, ["Opener Generator", "Bio Coach", "Reply Assistant", "Ghost Detector"]);

  // Trust verification state lives in D1; the private media route remains
  // legacy-only because it needs legacy R2 authorization and provider semantics.
  const trust = "/api/trust-verification";
  const prompts = [
    "My name is on Yugm, and I am verifying that I am a real person.",
    "I am completing Yugm Trust Verification to show people I am real.",
    "This is my real voice for Yugm Trust Verification."
  ];
  await request(trust + "/me", 401);
  await request(trust + "/status", 401);
  await request(trust + "/voice-prompt", 401);
  await request(trust + "/consent", 401, { body: { consentVersion: "x" } });
  await request(trust + "/face", 401, { body: { selfieImageUrl: 1 } });
  await request(trust + "/voice", 401, { body: { audioUrl: "bad", promptText: "short" } });
  await request(trust + "/submit-review", 401, { body: {} });
  await request(trust + "/retry", 401, { body: {} });
  await requestAs(owner, trust + "/consent", 422, { body: { consentVersion: "x" } });
  await requestAs(owner, trust + "/face", 422, { body: { selfieImageUrl: 1 } });
  await requestAs(owner, trust + "/voice", 422, { body: { audioUrl: "bad", promptText: "short" } });
  // An empty face body passes the schema but fails the legacy business rule.
  await requestAs(owner, trust + "/face", 400, { body: {} });

  try {
    const initial = (await requestAs(owner, trust + "/me", 200)).data;
    assert.equal(initial.title, "Yugm Trust Verification");
    assert.equal(initial.tagline, "Show people you're real.");
    assert.equal(initial.verification.status, "NOT_STARTED");
    assert.equal(initial.verification.level, "BASIC");
    assert.equal(initial.verification.faceStatus, "NOT_SUBMITTED");
    assert.equal(initial.verification.voiceStatus, "NOT_SUBMITTED");
    assert.equal(initial.verification.verifiedBadgeEnabled, false);
    assert.equal(initial.verification.creatorTrustEnabled, false);

    const started = (await requestAs(owner, trust + "/start", 201, { body: {} })).data;
    assert.equal(started.verification.id, initial.verification.id);
    assert.equal(started.verification.status, "INCOMPLETE");

    const consented = (await requestAs(owner, trust + "/consent", 200, { body: {} })).data;
    assert.equal(consented.verification.status, "INCOMPLETE");
    assert.equal(consented.verification.consentVersion, "trust-verification-v1");
    assert.ok(consented.verification.consentAcceptedAt);

    const prompted = (await requestAs(owner, trust + "/voice-prompt", 200)).data;
    assert.ok(prompts.includes(prompted.promptText));

    const face = (await requestAs(owner, trust + "/face", 201, {
      body: {
        selfieImageUrl: "https://example.test/selfie.jpg",
        provider: "fixture-provider",
        providerReferenceId: "fixture-ref",
        providerResponse: { score: 91, internal: true }
      }
    })).data;
    assert.equal(face.verification.faceStatus, "SUBMITTED");
    assert.equal(face.verification.livenessStatus, "NOT_SUBMITTED");
    assert.equal(face.submission.userId, ownerId);
    assert.equal(face.submission.verificationId, face.verification.id);
    assert.equal(face.submission.selfieImageUrl, "https://example.test/selfie.jpg");
    assert.equal(face.submission.livenessVideoUrl, undefined);
    assert.deepEqual(face.submission.providerResponse, { score: 91, internal: true });
    assert.equal(face.submission.status, "SUBMITTED");
    assert.equal(face.submission.__v, 0);

    const voice = (await requestAs(owner, trust + "/voice", 201, {
      body: {
        audioUrl: "https://example.test/voice.m4a",
        transcriptText: "Fixture transcript",
        promptText: prompted.promptText,
        providerResponse: ["ok"]
      }
    })).data;
    assert.equal(voice.verification.voiceStatus, "SUBMITTED");
    assert.equal(voice.submission.promptText, prompted.promptText);
    assert.equal(voice.submission.transcriptText, "Fixture transcript");
    assert.deepEqual(voice.submission.providerResponse, ["ok"]);
    assert.equal(voice.submission.__v, 0);

    const reviewed = (await requestAs(owner, trust + "/submit-review", 200, { body: {} })).data;
    assert.equal(reviewed.verification.status, "PENDING_REVIEW");
    assert.ok(reviewed.verification.submittedAt);
    assert.equal((await requestAs(owner, trust + "/status", 200)).data.verification.status, "PENDING_REVIEW");

    const retried = (await requestAs(owner, trust + "/retry", 200, { body: {} })).data;
    assert.equal(retried.verification.status, "INCOMPLETE");
    assert.equal(retried.verification.faceStatus, "NOT_SUBMITTED");
    assert.equal(retried.verification.voiceStatus, "NOT_SUBMITTED");
    assert.equal(retried.verification.livenessStatus, "NOT_SUBMITTED");
    assert.equal(retried.verification.rejectionReason, null);
    assert.equal(retried.verification.consentVersion, "trust-verification-v1");

    const trustRow = await db.prepare("SELECT * FROM trust_verifications WHERE user_id = ?").bind(ownerId).first();
    assert.equal(trustRow.source_id, initial.verification.id);
    assert.equal(trustRow.status, "INCOMPLETE");
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM face_verification_submissions WHERE verification_id = ?")
      .bind(trustRow.source_id).first("count"), 1);
    assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM voice_verification_submissions WHERE verification_id = ?")
      .bind(trustRow.source_id).first("count"), 1);

    // Guard ordering mirrors the legacy service: consent, face, then voice.
    await requestAs(visitor, trust + "/submit-review", 400, { body: {} });
    await requestAs(visitor, trust + "/consent", 200, { body: { consentVersion: "fixture-consent-v2" } });
    await requestAs(visitor, trust + "/submit-review", 400, { body: {} });
    const visitorFace = (await requestAs(visitor, trust + "/face", 201, {
      body: { livenessVideoUrl: "https://example.test/liveness.mp4" }
    })).data;
    assert.equal(visitorFace.verification.livenessStatus, "SUBMITTED");
    await requestAs(visitor, trust + "/submit-review", 400, { body: {} });
  } finally {
    await db.batch([
      db.prepare("DELETE FROM face_verification_submissions WHERE user_id = ?").bind(ownerId),
      db.prepare("DELETE FROM voice_verification_submissions WHERE user_id = ?").bind(ownerId),
      db.prepare("DELETE FROM trust_verifications WHERE user_id = ?").bind(ownerId),
      db.prepare("DELETE FROM face_verification_submissions WHERE user_id = ?").bind(visitorId),
      db.prepare("DELETE FROM voice_verification_submissions WHERE user_id = ?").bind(visitorId),
      db.prepare("DELETE FROM trust_verifications WHERE user_id = ?").bind(visitorId)
    ]);
  }

  // Direct cover upload has no room context or authoritative user write. It
  // stores original bytes in public-media and registers a public media object
  // so the existing media delivery route can serve the returned URL.
  const coverPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Wl61ZsAAAAASUVORK5CYII=", "base64");
  const coverForm = (fileName = "cover.png", contentType = "image/png", bytes = coverPng) => {
    const form = new FormData();
    form.set("cover", new Blob([bytes], { type: contentType }), fileName);
    return form;
  };
  const uploadForm = async (uploadPath, form, accessToken) => {
    const multipartRequest = new Request(`http://127.0.0.1${uploadPath}`, {
      method: "POST",
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      body: form
    });
    const response = await worker.dispatchFetch(multipartRequest.url, {
      method: "POST",
      headers: [...multipartRequest.headers],
      body: new Uint8Array(await multipartRequest.arrayBuffer())
    });
    return { status: response.status, payload: JSON.parse(await response.text()) };
  };
  const coverUpload = (form, accessToken) => uploadForm("/api/upload/cover", form, accessToken);

  assert.equal((await coverUpload(coverForm())).status, 401);
  const emptyForm = new FormData();
  emptyForm.set("other", "value");
  const missingCover = await coverUpload(emptyForm, owner.accessToken);
  assert.equal(missingCover.status, 400);
  assert.equal(missingCover.payload.error.message, "No file uploaded");
  const badExtension = await coverUpload(coverForm("cover.txt"), owner.accessToken);
  assert.equal(badExtension.status, 400);
  assert.equal(badExtension.payload.error.message, "Only images (jpg, jpeg, png, gif, webp) allowed");
  const badMime = await coverUpload(coverForm("cover.png", "text/plain"), owner.accessToken);
  assert.equal(badMime.status, 400);
  assert.equal(badMime.payload.error.message, "Only image uploads are allowed");
  const badSignature = await coverUpload(coverForm("cover.png", "image/png", Buffer.from("not-an-image")), owner.accessToken);
  assert.equal(badSignature.status, 400);
  assert.equal(badSignature.payload.error.message, "Invalid image file");
  const oversized = await coverUpload(coverForm("cover.png", "image/png", Buffer.alloc(5 * 1024 * 1024 + 1)), owner.accessToken);
  assert.equal(oversized.status, 413);
  assert.equal(oversized.payload.error.message, "Uploaded file is too large");

  const publicBucket = await worker.getR2Bucket("PUBLIC_MEDIA");
  const createdCovers = [];
  let coverMediaId;
  let coverKey;
  try {
    const uploaded = await coverUpload(coverForm("Room Cover.PNG"), owner.accessToken);
    assert.equal(uploaded.status, 200, JSON.stringify(uploaded.payload));
    const cover = uploaded.payload.data;
    assert.deepEqual(Object.keys(cover).sort(), ["storage", "url"]);
    assert.equal(cover.storage, "s3");
    assert.match(cover.url, /^http:\/\/127\.0\.0\.1\/api\/media\/public\/[a-f0-9-]{36}\/cover\.png$/);
    coverMediaId = new URL(cover.url).pathname.split("/")[4];

    const mediaRow = await db.prepare(`SELECT version, owner_type, owner_id, media_type, category, bucket, storage_key,
      content_type, file_size, checksum, visibility, processing_status, moderation_status
      FROM media_objects WHERE source_id = ?`).bind(coverMediaId).first();
    assert.ok(mediaRow);
    assert.equal(mediaRow.version, 1);
    assert.equal(mediaRow.owner_type, "USER");
    assert.equal(mediaRow.owner_id, ownerId);
    assert.equal(mediaRow.media_type, "IMAGE");
    assert.equal(mediaRow.category, "COVER");
    assert.equal(mediaRow.bucket, "public-media");
    assert.equal(mediaRow.content_type, "image/png");
    assert.equal(mediaRow.file_size, coverPng.byteLength);
    assert.equal(mediaRow.checksum, createHash("sha256").update(coverPng).digest("hex"));
    assert.equal(mediaRow.visibility, "PUBLIC");
    assert.equal(mediaRow.processing_status, "READY");
    assert.equal(mediaRow.moderation_status, "APPROVED");
    coverKey = mediaRow.storage_key;
    createdCovers.push({ id: coverMediaId, key: coverKey });
    assert.ok(coverKey.startsWith(`users/${ownerId}/covers/`));
    assert.ok(coverKey.endsWith("/cover.png"));

    const variantRow = await db.prepare(`SELECT name, bucket, key, url, content_type, bytes
      FROM media_variants WHERE source_id = ?`).bind(`${coverMediaId}:cover`).first();
    assert.equal(variantRow.name, "cover");
    assert.equal(variantRow.bucket, "public-media");
    assert.equal(variantRow.key, coverKey);
    assert.equal(variantRow.url, cover.url);
    assert.equal(variantRow.content_type, "image/png");
    assert.equal(variantRow.bytes, coverPng.byteLength);

    assert.ok(await publicBucket.head(coverKey));
    assert.deepEqual(Buffer.from(await (await publicBucket.get(coverKey)).arrayBuffer()), coverPng);
    const served = await worker.dispatchFetch(cover.url);
    assert.equal(served.status, 200);
    assert.equal(served.headers.get("content-type"), "image/png");
    assert.equal(served.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.deepEqual(Buffer.from(await served.arrayBuffer()), coverPng);

    const repeatedUpload = await coverUpload(coverForm("second-cover.png"), owner.accessToken);
    assert.equal(repeatedUpload.status, 200, JSON.stringify(repeatedUpload.payload));
    const repeatedId = new URL(repeatedUpload.payload.data.url).pathname.split("/")[4];
    assert.notEqual(repeatedId, coverMediaId);
    const repeatedRow = await db.prepare("SELECT version, storage_key FROM media_objects WHERE source_id = ?")
      .bind(repeatedId).first();
    assert.ok(repeatedRow);
    assert.equal(repeatedRow.version, 2);
    createdCovers.push({ id: repeatedId, key: repeatedRow.storage_key });
  } finally {
    for (const cover of createdCovers) {
      await db.batch([
        db.prepare("DELETE FROM media_variants WHERE media_objects_id = ?").bind(cover.id),
        db.prepare("DELETE FROM media_objects WHERE source_id = ?").bind(cover.id)
      ]);
      await publicBucket.delete(cover.key);
    }
    await db.prepare("DELETE FROM media_counters WHERE source_id = ?").bind(`USER:${ownerId}:COVER`).run();
  }

  // Profile-media and story uploads share the legacy image/video validator and
  // return { url, type, storage }. Neither route writes a user or story row.
  const mediaMp4 = Buffer.from("ftypfixture", "utf8");
  const mediaForm = (fileName = "media.png", contentType = "image/png", bytes = coverPng) => {
    const form = new FormData();
    form.set("media", new Blob([bytes], { type: contentType }), fileName);
    return form;
  };
  const profileUpload = (form, accessToken) => uploadForm("/api/upload/profile-media", form, accessToken);
  const storyUpload = (form, accessToken) => uploadForm("/api/upload/story", form, accessToken);

  assert.equal((await profileUpload(mediaForm(), undefined)).status, 401);
  assert.equal((await storyUpload(mediaForm(), undefined)).status, 401);
  const emptyMediaForm = new FormData();
  emptyMediaForm.set("other", "value");
  const missingMedia = await profileUpload(emptyMediaForm, owner.accessToken);
  assert.equal(missingMedia.status, 400);
  assert.equal(missingMedia.payload.error.message, "No file uploaded");
  const mediaBadExtension = await profileUpload(mediaForm("media.txt"), owner.accessToken);
  assert.equal(mediaBadExtension.status, 400);
  assert.equal(mediaBadExtension.payload.error.message, "Only image/video uploads are allowed");
  const mediaBadMime = await profileUpload(mediaForm("media.png", "text/plain"), owner.accessToken);
  assert.equal(mediaBadMime.status, 400);
  assert.equal(mediaBadMime.payload.error.message, "Only image/video uploads are allowed");
  const mediaBadImage = await profileUpload(mediaForm("media.png", "image/png", Buffer.from("not-an-image")), owner.accessToken);
  assert.equal(mediaBadImage.status, 400);
  assert.equal(mediaBadImage.payload.error.message, "Invalid media file");
  const mediaBadVideo = await profileUpload(mediaForm("media.mp4", "video/mp4", Buffer.from("not-a-video")), owner.accessToken);
  assert.equal(mediaBadVideo.status, 400);
  assert.equal(mediaBadVideo.payload.error.message, "Invalid media file");
  const mediaOversized = await storyUpload(mediaForm("media.png", "image/png", Buffer.alloc(10 * 1024 * 1024 + 1)), owner.accessToken);
  assert.equal(mediaOversized.status, 413);
  assert.equal(mediaOversized.payload.error.message, "Uploaded file is too large");

  const createdMedia = [];
  try {
    const imageUpload = await profileUpload(mediaForm("Profile.PNG"), owner.accessToken);
    assert.equal(imageUpload.status, 200, JSON.stringify(imageUpload.payload));
    const image = imageUpload.payload.data;
    assert.deepEqual(Object.keys(image).sort(), ["storage", "type", "url"]);
    assert.equal(image.storage, "s3");
    assert.equal(image.type, "IMAGE");
    assert.match(image.url, /^http:\/\/127\.0\.0\.1\/api\/media\/public\/[a-f0-9-]{36}\/profile\.png$/);
    const imageId = new URL(image.url).pathname.split("/")[4];
    const imageRow = await db.prepare(`SELECT version, owner_type, owner_id, media_type, category, bucket, storage_key,
      content_type, file_size, checksum, visibility, processing_status, moderation_status
      FROM media_objects WHERE source_id = ?`).bind(imageId).first();
    assert.ok(imageRow);
    assert.equal(imageRow.version, 1);
    assert.equal(imageRow.owner_type, "USER");
    assert.equal(imageRow.owner_id, ownerId);
    assert.equal(imageRow.media_type, "IMAGE");
    assert.equal(imageRow.category, "GALLERY");
    assert.equal(imageRow.bucket, "public-media");
    assert.equal(imageRow.content_type, "image/png");
    assert.equal(imageRow.file_size, coverPng.byteLength);
    assert.equal(imageRow.checksum, createHash("sha256").update(coverPng).digest("hex"));
    assert.equal(imageRow.visibility, "PUBLIC");
    assert.equal(imageRow.processing_status, "READY");
    assert.equal(imageRow.moderation_status, "APPROVED");
    assert.ok(imageRow.storage_key.startsWith(`users/${ownerId}/gallery/`));
    assert.ok(imageRow.storage_key.endsWith("/profile.png"));
    createdMedia.push({ id: imageId, key: imageRow.storage_key });

    const imageVariant = await db.prepare(`SELECT name, bucket, key, url, content_type, bytes
      FROM media_variants WHERE source_id = ?`).bind(`${imageId}:profile`).first();
    assert.equal(imageVariant.name, "profile");
    assert.equal(imageVariant.bucket, "public-media");
    assert.equal(imageVariant.key, imageRow.storage_key);
    assert.equal(imageVariant.url, image.url);
    assert.equal(imageVariant.content_type, "image/png");
    assert.equal(imageVariant.bytes, coverPng.byteLength);

    assert.ok(await publicBucket.head(imageRow.storage_key));
    assert.deepEqual(Buffer.from(await (await publicBucket.get(imageRow.storage_key)).arrayBuffer()), coverPng);
    const servedImage = await worker.dispatchFetch(image.url);
    assert.equal(servedImage.status, 200);
    assert.equal(servedImage.headers.get("content-type"), "image/png");
    assert.equal(servedImage.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.deepEqual(Buffer.from(await servedImage.arrayBuffer()), coverPng);

    const videoUpload = await storyUpload(mediaForm("story.mp4", "video/mp4", mediaMp4), owner.accessToken);
    assert.equal(videoUpload.status, 200, JSON.stringify(videoUpload.payload));
    const video = videoUpload.payload.data;
    assert.equal(video.storage, "s3");
    assert.equal(video.type, "VIDEO");
    assert.match(video.url, /^http:\/\/127\.0\.0\.1\/api\/media\/public\/[a-f0-9-]{36}\/story\.mp4$/);
    const videoId = new URL(video.url).pathname.split("/")[4];
    const videoRow = await db.prepare(`SELECT version, media_type, category, bucket, storage_key, content_type, file_size
      FROM media_objects WHERE source_id = ?`).bind(videoId).first();
    assert.ok(videoRow);
    assert.equal(videoRow.version, 2);
    assert.equal(videoRow.media_type, "VIDEO");
    assert.equal(videoRow.category, "GALLERY");
    assert.equal(videoRow.bucket, "public-media");
    assert.equal(videoRow.content_type, "video/mp4");
    assert.equal(videoRow.file_size, mediaMp4.byteLength);
    assert.ok(videoRow.storage_key.endsWith("/story.mp4"));
    createdMedia.push({ id: videoId, key: videoRow.storage_key });

    const videoVariant = await db.prepare(`SELECT name, key, url, content_type, bytes
      FROM media_variants WHERE source_id = ?`).bind(`${videoId}:story`).first();
    assert.equal(videoVariant.name, "story");
    assert.equal(videoVariant.key, videoRow.storage_key);
    assert.equal(videoVariant.url, video.url);
    assert.equal(videoVariant.content_type, "video/mp4");
    assert.equal(videoVariant.bytes, mediaMp4.byteLength);

    assert.ok(await publicBucket.head(videoRow.storage_key));
    const servedVideo = await worker.dispatchFetch(video.url);
    assert.equal(servedVideo.status, 200);
    assert.equal(servedVideo.headers.get("content-type"), "video/mp4");
    assert.deepEqual(Buffer.from(await servedVideo.arrayBuffer()), mediaMp4);
  } finally {
    for (const media of createdMedia) {
      await db.batch([
        db.prepare("DELETE FROM media_variants WHERE media_objects_id = ?").bind(media.id),
        db.prepare("DELETE FROM media_objects WHERE source_id = ?").bind(media.id)
      ]);
      await publicBucket.delete(media.key);
    }
    await db.prepare("DELETE FROM media_counters WHERE source_id = ?").bind(`USER:${ownerId}:GALLERY`).run();
  }

  // Voice-note and recording uploads carry audio/video bytes without a legacy
  // signature check and return { url, type, storage }.
  const voiceBytes = Buffer.from("ID3fixture", "utf8");
  const recordingBytes = Buffer.from("ftypfixture", "utf8");
  const audioForm = (fileName = "voice.mp3", contentType = "audio/mpeg", bytes = voiceBytes) => {
    const form = new FormData();
    form.set("media", new Blob([bytes], { type: contentType }), fileName);
    return form;
  };
  const voiceUpload = (form, accessToken) => uploadForm("/api/upload/voice-note", form, accessToken);
  const recordingUpload = (form, accessToken) => uploadForm("/api/upload/recording", form, accessToken);

  assert.equal((await voiceUpload(audioForm(), undefined)).status, 401);
  assert.equal((await recordingUpload(audioForm(), undefined)).status, 401);
  const emptyAudioForm = new FormData();
  emptyAudioForm.set("other", "value");
  const missingVoice = await voiceUpload(emptyAudioForm, owner.accessToken);
  assert.equal(missingVoice.status, 400);
  assert.equal(missingVoice.payload.error.message, "No file uploaded");
  const missingRecording = await recordingUpload(emptyAudioForm, owner.accessToken);
  assert.equal(missingRecording.status, 400);
  assert.equal(missingRecording.payload.error.message, "No file uploaded");
  const voiceBadExtension = await voiceUpload(audioForm("voice.txt"), owner.accessToken);
  assert.equal(voiceBadExtension.status, 400);
  assert.equal(voiceBadExtension.payload.error.message, "Only audio files are allowed");
  const voiceBadMime = await voiceUpload(audioForm("voice.mp3", "text/plain"), owner.accessToken);
  assert.equal(voiceBadMime.status, 400);
  assert.equal(voiceBadMime.payload.error.message, "Only audio uploads are allowed");
  const recordingBadExtension = await recordingUpload(audioForm("recording.txt"), owner.accessToken);
  assert.equal(recordingBadExtension.status, 400);
  assert.equal(recordingBadExtension.payload.error.message, "Only audio/video recording files are allowed");
  const recordingBadMime = await recordingUpload(audioForm("recording.mp3", "text/plain"), owner.accessToken);
  assert.equal(recordingBadMime.status, 400);
  assert.equal(recordingBadMime.payload.error.message, "Only audio/video uploads are allowed");
  const audioOversized = await voiceUpload(audioForm("voice.mp3", "audio/mpeg", Buffer.alloc(10 * 1024 * 1024 + 1)), owner.accessToken);
  assert.equal(audioOversized.status, 413);
  assert.equal(audioOversized.payload.error.message, "Uploaded file is too large");

  const createdAudio = [];
  try {
    const voiceResult = await voiceUpload(audioForm("Voice Note.MP3"), owner.accessToken);
    assert.equal(voiceResult.status, 200, JSON.stringify(voiceResult.payload));
    const voice = voiceResult.payload.data;
    assert.deepEqual(Object.keys(voice).sort(), ["storage", "type", "url"]);
    assert.equal(voice.storage, "s3");
    assert.equal(voice.type, "AUDIO");
    assert.match(voice.url, /^http:\/\/127\.0\.0\.1\/api\/media\/public\/[a-f0-9-]{36}\/voice_note\.mp3$/);
    const voiceId = new URL(voice.url).pathname.split("/")[4];
    const voiceRow = await db.prepare(`SELECT version, owner_type, owner_id, media_type, category, bucket, storage_key,
      content_type, file_size, checksum, visibility, processing_status, moderation_status
      FROM media_objects WHERE source_id = ?`).bind(voiceId).first();
    assert.ok(voiceRow);
    assert.equal(voiceRow.version, 1);
    assert.equal(voiceRow.owner_type, "USER");
    assert.equal(voiceRow.owner_id, ownerId);
    assert.equal(voiceRow.media_type, "AUDIO");
    assert.equal(voiceRow.category, "VOICE_MESSAGE");
    assert.equal(voiceRow.bucket, "public-media");
    assert.equal(voiceRow.content_type, "audio/mpeg");
    assert.equal(voiceRow.file_size, voiceBytes.byteLength);
    assert.equal(voiceRow.checksum, createHash("sha256").update(voiceBytes).digest("hex"));
    assert.equal(voiceRow.visibility, "PUBLIC");
    assert.equal(voiceRow.processing_status, "READY");
    assert.equal(voiceRow.moderation_status, "APPROVED");
    assert.ok(voiceRow.storage_key.startsWith(`users/${ownerId}/voice-messages/`));
    assert.ok(voiceRow.storage_key.endsWith("/voice_note.mp3"));
    createdAudio.push({ id: voiceId, key: voiceRow.storage_key });

    const voiceVariant = await db.prepare(`SELECT name, bucket, key, url, content_type, bytes
      FROM media_variants WHERE source_id = ?`).bind(`${voiceId}:voice_note`).first();
    assert.equal(voiceVariant.name, "voice_note");
    assert.equal(voiceVariant.bucket, "public-media");
    assert.equal(voiceVariant.key, voiceRow.storage_key);
    assert.equal(voiceVariant.url, voice.url);
    assert.equal(voiceVariant.content_type, "audio/mpeg");
    assert.equal(voiceVariant.bytes, voiceBytes.byteLength);

    assert.ok(await publicBucket.head(voiceRow.storage_key));
    assert.deepEqual(Buffer.from(await (await publicBucket.get(voiceRow.storage_key)).arrayBuffer()), voiceBytes);
    const servedVoice = await worker.dispatchFetch(voice.url);
    assert.equal(servedVoice.status, 200);
    assert.equal(servedVoice.headers.get("content-type"), "audio/mpeg");
    assert.equal(servedVoice.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.deepEqual(Buffer.from(await servedVoice.arrayBuffer()), voiceBytes);

    const recordingResult = await recordingUpload(audioForm("call.MP4", "video/mp4", recordingBytes), owner.accessToken);
    assert.equal(recordingResult.status, 200, JSON.stringify(recordingResult.payload));
    const recording = recordingResult.payload.data;
    assert.deepEqual(Object.keys(recording).sort(), ["storage", "type", "url"]);
    assert.equal(recording.storage, "s3");
    assert.equal(recording.type, "VIDEO");
    assert.match(recording.url, /^http:\/\/127\.0\.0\.1\/api\/media\/public\/[a-f0-9-]{36}\/recording\.mp4$/);
    const recordingId = new URL(recording.url).pathname.split("/")[4];
    const recordingRow = await db.prepare(`SELECT version, owner_type, owner_id, media_type, category, bucket, storage_key,
      content_type, file_size, checksum, visibility, processing_status, moderation_status
      FROM media_objects WHERE source_id = ?`).bind(recordingId).first();
    assert.ok(recordingRow);
    assert.equal(recordingRow.version, 1);
    assert.equal(recordingRow.owner_id, ownerId);
    assert.equal(recordingRow.media_type, "VIDEO");
    assert.equal(recordingRow.category, "ATTACHMENT");
    assert.equal(recordingRow.bucket, "public-media");
    assert.equal(recordingRow.content_type, "video/mp4");
    assert.equal(recordingRow.file_size, recordingBytes.byteLength);
    assert.equal(recordingRow.checksum, createHash("sha256").update(recordingBytes).digest("hex"));
    assert.ok(recordingRow.storage_key.startsWith(`users/${ownerId}/attachments/`));
    assert.ok(recordingRow.storage_key.endsWith("/recording.mp4"));
    createdAudio.push({ id: recordingId, key: recordingRow.storage_key });

    const recordingVariant = await db.prepare(`SELECT name, bucket, key, url, content_type, bytes
      FROM media_variants WHERE source_id = ?`).bind(`${recordingId}:recording`).first();
    assert.equal(recordingVariant.name, "recording");
    assert.equal(recordingVariant.key, recordingRow.storage_key);
    assert.equal(recordingVariant.url, recording.url);
    assert.equal(recordingVariant.content_type, "video/mp4");
    assert.equal(recordingVariant.bytes, recordingBytes.byteLength);

    assert.ok(await publicBucket.head(recordingRow.storage_key));
    const servedRecording = await worker.dispatchFetch(recording.url);
    assert.equal(servedRecording.status, 200);
    assert.equal(servedRecording.headers.get("content-type"), "video/mp4");
    assert.deepEqual(Buffer.from(await servedRecording.arrayBuffer()), recordingBytes);
  } finally {
    for (const media of createdAudio) {
      await db.batch([
        db.prepare("DELETE FROM media_variants WHERE media_objects_id = ?").bind(media.id),
        db.prepare("DELETE FROM media_objects WHERE source_id = ?").bind(media.id)
      ]);
      await publicBucket.delete(media.key);
    }
    await db.prepare("DELETE FROM media_counters WHERE source_id = ?").bind(`USER:${ownerId}:VOICE_MESSAGE`).run();
    await db.prepare("DELETE FROM media_counters WHERE source_id = ?").bind(`USER:${ownerId}:ATTACHMENT`).run();
  }

  // Direct avatar upload commits the media registry and the authoritative
  // profile change together, superseding the previous avatar object.
  const originalAvatar = await db.prepare(`SELECT avatar, avatar_media_id, avatar_type, active_cosmetics_avatar_asset,
    avatar_parts_background, avatar_parts_clothes, avatar_parts_head, avatar_parts_mouth, avatar_parts_eyes,
    avatar_parts_top, updated_at FROM users WHERE source_id = ?`).bind(ownerId).first();
  const originalMarkers = await db.prepare("SELECT null_fields, missing_fields FROM user_auth_profile WHERE source_id = ?")
    .bind(ownerId).first();
  const originalCounter = await db.prepare("SELECT seq FROM media_counters WHERE source_id = ?")
    .bind(`USER:${ownerId}:AVATAR`).first();
  // Isolate this fixture from any earlier managed-avatar object so its cleanup
  // only has to restore the owner row, not another test's R2 bytes.
  await db.prepare("UPDATE users SET avatar_media_id = NULL WHERE source_id = ?").bind(ownerId).run();

  const avatarForm = (fileName = "avatar.png", contentType = "image/png", bytes = coverPng) => {
    const form = new FormData();
    form.set("avatar", new Blob([bytes], { type: contentType }), fileName);
    return form;
  };
  const avatarUpload = (form, accessToken) => uploadForm("/api/upload/avatar", form, accessToken);

  assert.equal((await avatarUpload(avatarForm())).status, 401);
  const emptyAvatarForm = new FormData();
  emptyAvatarForm.set("other", "value");
  const missingAvatar = await avatarUpload(emptyAvatarForm, owner.accessToken);
  assert.equal(missingAvatar.status, 400);
  assert.equal(missingAvatar.payload.error.message, "No file uploaded");
  const avatarBadExtension = await avatarUpload(avatarForm("avatar.txt"), owner.accessToken);
  assert.equal(avatarBadExtension.status, 400);
  assert.equal(avatarBadExtension.payload.error.message, "Only images (jpg, jpeg, png, gif, webp) allowed");
  const avatarBadMime = await avatarUpload(avatarForm("avatar.png", "text/plain"), owner.accessToken);
  assert.equal(avatarBadMime.status, 400);
  assert.equal(avatarBadMime.payload.error.message, "Only image uploads are allowed");
  const avatarBadSignature = await avatarUpload(avatarForm("avatar.png", "image/png", Buffer.from("not-an-image")), owner.accessToken);
  assert.equal(avatarBadSignature.status, 400);
  assert.equal(avatarBadSignature.payload.error.message, "Invalid image file");
  const avatarOversized = await avatarUpload(
    avatarForm("avatar.png", "image/png", Buffer.concat([coverPng, Buffer.alloc(220 * 1024 + 1)])), owner.accessToken);
  assert.equal(avatarOversized.status, 400);
  assert.equal(avatarOversized.payload.error.message, "Avatar image is too large. Please choose or crop a smaller image.");
  const avatarMultipartOversized = await avatarUpload(
    avatarForm("avatar.png", "image/png", Buffer.alloc(5 * 1024 * 1024 + 1)), owner.accessToken);
  assert.equal(avatarMultipartOversized.status, 413);
  assert.equal(avatarMultipartOversized.payload.error.message, "Uploaded file is too large");

  const createdAvatars = [];
  try {
    const firstResult = await avatarUpload(avatarForm("Avatar.PNG"), owner.accessToken);
    assert.equal(firstResult.status, 200, JSON.stringify(firstResult.payload));
    const firstAvatar = firstResult.payload.data;
    assert.deepEqual(Object.keys(firstAvatar).sort(), ["storage", "url"]);
    assert.equal(firstAvatar.storage, "s3");
    assert.match(firstAvatar.url, /^http:\/\/127\.0\.0\.1\/api\/media\/public\/[a-f0-9-]{36}\/avatar\.png$/);
    const firstId = new URL(firstAvatar.url).pathname.split("/")[4];
    const firstRow = await db.prepare(`SELECT version, media_type, category, bucket, storage_key, content_type, file_size,
      checksum, visibility, processing_status, moderation_status FROM media_objects WHERE source_id = ?`).bind(firstId).first();
    assert.ok(firstRow);
    assert.equal(firstRow.media_type, "IMAGE");
    assert.equal(firstRow.category, "AVATAR");
    assert.equal(firstRow.bucket, "public-media");
    assert.equal(firstRow.content_type, "image/png");
    assert.equal(firstRow.file_size, coverPng.byteLength);
    assert.equal(firstRow.checksum, createHash("sha256").update(coverPng).digest("hex"));
    assert.equal(firstRow.visibility, "PUBLIC");
    assert.equal(firstRow.processing_status, "READY");
    assert.equal(firstRow.moderation_status, "APPROVED");
    assert.ok(firstRow.storage_key.startsWith(`users/${ownerId}/avatars/`));
    assert.ok(firstRow.storage_key.endsWith("/avatar.png"));
    createdAvatars.push({ id: firstId, key: firstRow.storage_key });

    const firstVariant = await db.prepare(`SELECT name, bucket, key, url, content_type, bytes
      FROM media_variants WHERE source_id = ?`).bind(`${firstId}:avatar`).first();
    assert.equal(firstVariant.name, "avatar");
    assert.equal(firstVariant.bucket, "public-media");
    assert.equal(firstVariant.key, firstRow.storage_key);
    assert.equal(firstVariant.url, firstAvatar.url);
    assert.equal(firstVariant.content_type, "image/png");
    assert.equal(firstVariant.bytes, coverPng.byteLength);

    const firstProfile = await db.prepare(`SELECT avatar, avatar_media_id, avatar_type, active_cosmetics_avatar_asset,
      avatar_parts_background, avatar_parts_head FROM users WHERE source_id = ?`).bind(ownerId).first();
    assert.equal(firstProfile.avatar, firstAvatar.url);
    assert.equal(firstProfile.avatar_media_id, firstId);
    assert.equal(firstProfile.avatar_type, "UPLOADED");
    assert.equal(firstProfile.active_cosmetics_avatar_asset, "");
    assert.equal(firstProfile.avatar_parts_background, null);
    assert.equal(firstProfile.avatar_parts_head, null);
    const firstMarkers = await db.prepare("SELECT null_fields, missing_fields FROM user_auth_profile WHERE source_id = ?")
      .bind(ownerId).first();
    assert.ok(!JSON.parse(firstMarkers.null_fields ?? "[]").includes("avatar"));
    assert.ok(!JSON.parse(firstMarkers.null_fields ?? "[]").includes("avatarParts"));

    assert.ok(await publicBucket.head(firstRow.storage_key));
    const servedAvatar = await worker.dispatchFetch(firstAvatar.url);
    assert.equal(servedAvatar.status, 200);
    assert.equal(servedAvatar.headers.get("content-type"), "image/png");
    assert.equal(servedAvatar.headers.get("cache-control"), "public, max-age=31536000, immutable");
    assert.deepEqual(Buffer.from(await servedAvatar.arrayBuffer()), coverPng);

    const secondResult = await avatarUpload(avatarForm("second.png"), owner.accessToken);
    assert.equal(secondResult.status, 200, JSON.stringify(secondResult.payload));
    const secondAvatar = secondResult.payload.data;
    const secondId = new URL(secondAvatar.url).pathname.split("/")[4];
    assert.notEqual(secondId, firstId);
    const secondRow = await db.prepare("SELECT version, storage_key FROM media_objects WHERE source_id = ?")
      .bind(secondId).first();
    assert.equal(secondRow.version, firstRow.version + 1);
    createdAvatars.push({ id: secondId, key: secondRow.storage_key });

    const superseded = await db.prepare("SELECT superseded_by_id FROM media_objects WHERE source_id = ?").bind(firstId).first();
    assert.equal(superseded.superseded_by_id, secondId);
    assert.equal(await publicBucket.head(firstRow.storage_key), null);
    const secondProfile = await db.prepare("SELECT avatar, avatar_media_id FROM users WHERE source_id = ?").bind(ownerId).first();
    assert.equal(secondProfile.avatar, secondAvatar.url);
    assert.equal(secondProfile.avatar_media_id, secondId);
    assert.ok(await publicBucket.head(secondRow.storage_key));
  } finally {
    for (const media of createdAvatars) {
      await db.batch([
        db.prepare("DELETE FROM media_variants WHERE media_objects_id = ?").bind(media.id),
        db.prepare("DELETE FROM media_objects WHERE source_id = ?").bind(media.id)
      ]);
      await publicBucket.delete(media.key);
    }
    await db.prepare(`UPDATE users SET avatar = ?, avatar_media_id = ?, avatar_type = ?, active_cosmetics_avatar_asset = ?,
      avatar_parts_background = ?, avatar_parts_clothes = ?, avatar_parts_head = ?, avatar_parts_mouth = ?,
      avatar_parts_eyes = ?, avatar_parts_top = ?, updated_at = ? WHERE source_id = ?`)
      .bind(originalAvatar.avatar ?? null, originalAvatar.avatar_media_id ?? null, originalAvatar.avatar_type ?? null,
        originalAvatar.active_cosmetics_avatar_asset ?? null, originalAvatar.avatar_parts_background ?? null,
        originalAvatar.avatar_parts_clothes ?? null, originalAvatar.avatar_parts_head ?? null,
        originalAvatar.avatar_parts_mouth ?? null, originalAvatar.avatar_parts_eyes ?? null,
        originalAvatar.avatar_parts_top ?? null, originalAvatar.updated_at ?? null, ownerId).run();
    if (originalMarkers) {
      await db.prepare("UPDATE user_auth_profile SET null_fields = ?, missing_fields = ? WHERE source_id = ?")
        .bind(originalMarkers.null_fields ?? "[]", originalMarkers.missing_fields ?? "[]", ownerId).run();
    }
    if (originalCounter) {
      await db.prepare("UPDATE media_counters SET seq = ? WHERE source_id = ?")
        .bind(originalCounter.seq, `USER:${ownerId}:AVATAR`).run();
    } else {
      await db.prepare("DELETE FROM media_counters WHERE source_id = ?").bind(`USER:${ownerId}:AVATAR`).run();
    }
  }

  // Trust verification upload and private delivery keep the legacy owner-prefix
  // authorization, purpose filtering and signatures while storing bytes in the
  // private-media bucket with a matching registry row.
  const privateBucket = await worker.getR2Bucket("PRIVATE_MEDIA");
  const trustUpload = (form, accessToken) => uploadForm("/api/upload/trust-verification", form, accessToken);
  const trustForm = (purpose, fileName, contentType, bytes) => {
    const form = new FormData();
    form.set("purpose", purpose);
    form.set("media", new Blob([bytes], { type: contentType }), fileName);
    return form;
  };
  const fetchTrustMedia = (path, accessToken) => worker.dispatchFetch(
    new URL(path, "http://127.0.0.1").toString(),
    { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} }
  );

  assert.equal((await trustUpload(trustForm("FACE", "selfie.png", "image/png", coverPng))).status, 401);
  const emptyTrustForm = new FormData();
  emptyTrustForm.set("purpose", "FACE");
  const missingTrust = await trustUpload(emptyTrustForm, owner.accessToken);
  assert.equal(missingTrust.status, 400);
  assert.equal(missingTrust.payload.error.message, "No file uploaded");
  const badTrustPurpose = await trustUpload(trustForm("OTHER", "selfie.png", "image/png", coverPng), owner.accessToken);
  assert.equal(badTrustPurpose.status, 400);
  assert.equal(badTrustPurpose.payload.error.message, "Invalid trust verification upload purpose");
  const badFaceExtension = await trustUpload(trustForm("FACE", "selfie.txt", "image/png", coverPng), owner.accessToken);
  assert.equal(badFaceExtension.status, 400);
  assert.equal(badFaceExtension.payload.error.message, "Only image/video uploads are allowed for face and liveness verification");
  const badFaceMime = await trustUpload(trustForm("FACE", "selfie.png", "text/plain", coverPng), owner.accessToken);
  assert.equal(badFaceMime.status, 400);
  assert.equal(badFaceMime.payload.error.message, "Only image/video uploads are allowed for face and liveness verification");
  const badFaceSignature = await trustUpload(trustForm("FACE", "selfie.png", "image/png", Buffer.from("not-an-image")), owner.accessToken);
  assert.equal(badFaceSignature.status, 400);
  assert.equal(badFaceSignature.payload.error.message, "Invalid verification media file");
  const badVoiceExtension = await trustUpload(trustForm("VOICE", "voice.png", "audio/mpeg", Buffer.from("ID3fixture")), owner.accessToken);
  assert.equal(badVoiceExtension.status, 400);
  assert.equal(badVoiceExtension.payload.error.message, "Only audio uploads are allowed for voice verification");
  const badVoiceMime = await trustUpload(trustForm("VOICE", "voice.mp3", "text/plain", Buffer.from("ID3fixture")), owner.accessToken);
  assert.equal(badVoiceMime.status, 400);
  assert.equal(badVoiceMime.payload.error.message, "Only audio uploads are allowed for voice verification");
  const badVoiceSignature = await trustUpload(trustForm("VOICE", "voice.mp3", "audio/mpeg", Buffer.from("not-audio")), owner.accessToken);
  assert.equal(badVoiceSignature.status, 400);
  assert.equal(badVoiceSignature.payload.error.message, "Invalid verification media file");
  const trustOversized = await trustUpload(
    trustForm("FACE", "selfie.png", "image/png", Buffer.alloc(10 * 1024 * 1024 + 1)), owner.accessToken);
  assert.equal(trustOversized.status, 413);
  assert.equal(trustOversized.payload.error.message, "Uploaded file is too large");

  const invalidReference = await fetchTrustMedia("/api/trust-verification/media/not-a-reference.png", owner.accessToken);
  assert.equal(invalidReference.status, 400);
  // The owner route keeps storage.ts's unbounded timestamp rule, not the
  // admin route's 1-20 digit reference pattern. A well-formed longer reference
  // reaches storage and returns 404 when absent.
  const longTimestampReference = await fetchTrustMedia(
    `/api/trust-verification/media/${ownerId}_123456789012345678901_abcdef.png`, owner.accessToken);
  assert.equal(longTimestampReference.status, 404);
  const originalTrustCounters = {
    ATTACHMENT: await db.prepare("SELECT seq FROM media_counters WHERE source_id = ?")
      .bind(`USER:${ownerId}:ATTACHMENT`).first(),
    VOICE_MESSAGE: await db.prepare("SELECT seq FROM media_counters WHERE source_id = ?")
      .bind(`USER:${ownerId}:VOICE_MESSAGE`).first()
  };
  const createdTrustMedia = [];
  try {
    const faceResult = await trustUpload(trustForm("FACE", "Selfie.PNG", "image/png", coverPng), owner.accessToken);
    assert.equal(faceResult.status, 200, JSON.stringify(faceResult.payload));
    const face = faceResult.payload.data;
    assert.deepEqual(Object.keys(face).sort(), ["purpose", "storage", "url"]);
    assert.equal(face.purpose, "FACE");
    assert.equal(face.storage, "private-s3");
    assert.match(face.url, new RegExp(`^/api/trust-verification/media/${ownerId}_\\d{13}_[a-f0-9]{6}\\.png$`));
    const faceName = face.url.slice("/api/trust-verification/media/".length);
    const faceKey = `trust-verification/${faceName}`;
    assert.ok(await privateBucket.head(faceKey));
    assert.deepEqual(Buffer.from(await (await privateBucket.get(faceKey)).arrayBuffer()), coverPng);
    const faceRow = await db.prepare(`SELECT source_id, version, owner_type, owner_id, media_type, category, bucket,
      storage_key, content_type, file_size, checksum, visibility, processing_status, moderation_status
      FROM media_objects WHERE storage_key = ?`).bind(faceKey).first();
    assert.ok(faceRow);
    assert.equal(faceRow.version, Number(originalTrustCounters.ATTACHMENT?.seq ?? 0) + 1);
    assert.equal(faceRow.owner_type, "USER");
    assert.equal(faceRow.owner_id, ownerId);
    assert.equal(faceRow.media_type, "IMAGE");
    assert.equal(faceRow.category, "ATTACHMENT");
    assert.equal(faceRow.bucket, "private-media");
    assert.equal(faceRow.content_type, "image/png");
    assert.equal(faceRow.file_size, coverPng.byteLength);
    assert.equal(faceRow.checksum, createHash("sha256").update(coverPng).digest("hex"));
    assert.equal(faceRow.visibility, "PRIVATE");
    assert.equal(faceRow.processing_status, "READY");
    assert.equal(faceRow.moderation_status, "APPROVED");
    createdTrustMedia.push({ id: faceRow.source_id, key: faceKey, variant: "face" });
    const faceVariant = await db.prepare(`SELECT name, bucket, key, url, content_type, bytes
      FROM media_variants WHERE source_id = ?`).bind(`${faceRow.source_id}:face`).first();
    assert.equal(faceVariant.name, "face");
    assert.equal(faceVariant.bucket, "private-media");
    assert.equal(faceVariant.key, faceKey);
    assert.equal(faceVariant.url, face.url);
    assert.equal(faceVariant.content_type, "image/png");
    assert.equal(faceVariant.bytes, coverPng.byteLength);

    const faceDelivery = await fetchTrustMedia(face.url, owner.accessToken);
    assert.equal(faceDelivery.status, 200);
    assert.equal(faceDelivery.headers.get("content-type"), "image/png");
    assert.equal(faceDelivery.headers.get("cache-control"), "private, no-store");
    assert.deepEqual(Buffer.from(await faceDelivery.arrayBuffer()), coverPng);
    assert.equal((await fetchTrustMedia(face.url)).status, 401);
    assert.equal((await fetchTrustMedia(face.url, visitor.accessToken)).status, 403);
    const absentName = `${ownerId}_${Date.now()}_abcdef.png`;
    assert.equal((await fetchTrustMedia(`/api/trust-verification/media/${absentName}`, owner.accessToken)).status, 404);

    const trustVideoBytes = Buffer.from("webmfixture", "utf8");
    const livenessResult = await trustUpload(
      trustForm("LIVENESS", "liveness.WEBM", "video/webm", trustVideoBytes), owner.accessToken);
    assert.equal(livenessResult.status, 200, JSON.stringify(livenessResult.payload));
    const liveness = livenessResult.payload.data;
    assert.equal(liveness.purpose, "LIVENESS");
    assert.match(liveness.url, new RegExp(`^/api/trust-verification/media/${ownerId}_\\d{13}_[a-f0-9]{6}\\.webm$`));
    const livenessKey = `trust-verification/${liveness.url.slice("/api/trust-verification/media/".length)}`;
    assert.deepEqual(Buffer.from(await (await privateBucket.get(livenessKey)).arrayBuffer()), trustVideoBytes);
    const livenessRow = await db.prepare(`SELECT source_id, version, media_type, category, bucket, content_type
      FROM media_objects WHERE storage_key = ?`).bind(livenessKey).first();
    assert.equal(livenessRow.version, Number(originalTrustCounters.ATTACHMENT?.seq ?? 0) + 2);
    assert.equal(livenessRow.media_type, "VIDEO");
    assert.equal(livenessRow.category, "ATTACHMENT");
    assert.equal(livenessRow.bucket, "private-media");
    assert.equal(livenessRow.content_type, "video/webm");
    createdTrustMedia.push({ id: livenessRow.source_id, key: livenessKey, variant: "liveness" });

    const trustVoiceBytes = Buffer.from("ID3fixture", "utf8");
    const voiceResult = await trustUpload(trustForm("VOICE", "voice.MP3", "audio/mpeg", trustVoiceBytes), owner.accessToken);
    assert.equal(voiceResult.status, 200, JSON.stringify(voiceResult.payload));
    const voice = voiceResult.payload.data;
    assert.equal(voice.purpose, "VOICE");
    assert.equal(voice.storage, "private-s3");
    assert.match(voice.url, new RegExp(`^/api/trust-verification/media/${ownerId}_\\d{13}_[a-f0-9]{6}\\.mp3$`));
    const voiceKey = `trust-verification/${voice.url.slice("/api/trust-verification/media/".length)}`;
    assert.deepEqual(Buffer.from(await (await privateBucket.get(voiceKey)).arrayBuffer()), trustVoiceBytes);
    const voiceRow = await db.prepare(`SELECT source_id, version, media_type, category, bucket, content_type
      FROM media_objects WHERE storage_key = ?`).bind(voiceKey).first();
    assert.equal(voiceRow.version, Number(originalTrustCounters.VOICE_MESSAGE?.seq ?? 0) + 1);
    assert.equal(voiceRow.media_type, "AUDIO");
    assert.equal(voiceRow.category, "VOICE_MESSAGE");
    assert.equal(voiceRow.bucket, "private-media");
    assert.equal(voiceRow.content_type, "audio/mpeg");
    createdTrustMedia.push({ id: voiceRow.source_id, key: voiceKey, variant: "voice" });
    const voiceDelivery = await fetchTrustMedia(voice.url, owner.accessToken);
    assert.equal(voiceDelivery.status, 200);
    assert.equal(voiceDelivery.headers.get("content-type"), "audio/mpeg");
    assert.deepEqual(Buffer.from(await voiceDelivery.arrayBuffer()), trustVoiceBytes);
  } finally {
    for (const media of createdTrustMedia) {
      await db.batch([
        db.prepare("DELETE FROM media_variants WHERE source_id = ?").bind(`${media.id}:${media.variant}`),
        db.prepare("DELETE FROM media_objects WHERE source_id = ?").bind(media.id)
      ]);
      await privateBucket.delete(media.key);
    }
    for (const [category, original] of Object.entries(originalTrustCounters)) {
      const counterId = `USER:${ownerId}:${category}`;
      if (original) {
        await db.prepare("UPDATE media_counters SET seq = ? WHERE source_id = ?").bind(original.seq, counterId).run();
      } else {
        await db.prepare("DELETE FROM media_counters WHERE source_id = ?").bind(counterId).run();
      }
    }
  }
}
