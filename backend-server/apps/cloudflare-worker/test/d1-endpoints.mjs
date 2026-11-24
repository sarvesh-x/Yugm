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
  await db.prepare("INSERT INTO blocks (source_id, blocker_id, blocked_user_id, created_at) VALUES (?, ?, ?, ?)")
    .bind(newId(), ownerId, visitorId, time).run();
  assert.deepEqual((await requestAs(owner, path, 200)).data.messages, []);
  assert.equal((await requestAs(owner, path + "/unread-counts", 200)).data.total, 0);
  assert.deepEqual((await requestAs(owner, "/api/friends", 200)).data.friends, []);
  assert.deepEqual((await requestAs(visitor, "/api/users/" + ownerId + "/rooms", 200)).data.rooms, []);
  assert.equal((await requestAs(owner, "/api/friends/unfriend/" + visitorId, 200, { body: {} })).data.unfriended, true);
  await requestAs(visitor, "/api/friends/request/" + ownerId, 403, { body: {} });
  await db.prepare("DELETE FROM blocks WHERE blocker_id = ? AND blocked_user_id = ?").bind(ownerId, visitorId).run();
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
}
