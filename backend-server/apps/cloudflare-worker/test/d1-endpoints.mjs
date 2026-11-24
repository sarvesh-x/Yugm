import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const newId = () => randomBytes(12).toString("hex");

export async function verifyD1AppEndpoints(db, request, owner, visitor) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const now = new Date();
  const time = now.toISOString();
  const beforeJoin = new Date(now.getTime() - 60_000).toISOString();
  const requestAs = (account, path, status, options = {}) =>
    request(path, status, { accessToken: account.accessToken, ...options });

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
      .bind(newId(), visitorId, ownerId, time, time, visitorId, ownerId)
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

  const messages = (await requestAs(visitor, prefix + "/" + live + "/messages", 200)).data.messages;
  assert.deepEqual(messages.map(item => item.message), ["visible after join"]);
  const activity = (await requestAs(visitor, prefix + "/" + live + "/activity", 200)).data.activity;
  assert.equal(activity[0].metadata.fixture, true);
  await requestAs(visitor, prefix + "/" + privateVideo, 403);
  await requestAs(visitor, prefix + "/" + privateVideo + "/followers", 403);
  await db.prepare(`INSERT INTO room_invites (source_id, room_id, inviter_id, invitee_id, status, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'PENDING', ?, ?)`).bind(newId(), privateVideo, ownerId, visitorId, time, time).run();
  assert.equal((await requestAs(visitor, prefix + "/" + privateVideo, 200)).data.room.type, "VIDEO");
  assert.deepEqual((await requestAs(visitor, prefix + "/" + privateVideo + "/messages", 200)).data.messages, []);
  assert.deepEqual((await requestAs(visitor, prefix + "/" + privateVideo + "/activity", 200)).data.activity, []);

  const follow = "/" + live + "/follow";
  for (const roomId of [privateVideo, ended]) await requestAs(visitor, prefix + "/" + roomId + "/follow", 404, { body: {} });
  await Promise.all([1, 2].map(() => requestAs(visitor, prefix + follow, 200, { body: {} })));
  assert.deepEqual((await requestAs(visitor, prefix + "/followed", 200)).data.rooms.map(item => item._id), [live]);
  const followers = (await requestAs(owner, prefix + "/" + live + "/followers", 200)).data.users;
  assert.deepEqual(followers.map(item => item._id), [visitorId]);
  assert.equal((await requestAs(visitor, prefix + follow, 200, { method: "DELETE" })).data.following, false);
  assert.deepEqual((await requestAs(visitor, prefix + "/followed", 200)).data.rooms, []);
}
