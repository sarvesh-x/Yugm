import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Feed(db, request, owner, visitor) {
  const host = owner.user.id;
  const guest = visitor.user.id;
  const room = id();
  const activity = id();
  const story = id();
  const comment = id();
  const replyOne = id();
  const replyTwo = id();
  const gift = id();
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 86_400_000).toISOString();
  const older = new Date(Date.now() - 2 * 86_400_000).toISOString();

  await db.batch([
    db.prepare(`INSERT INTO friendships (source_id, user_id, friend_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'ACCEPTED', ?, ?)`).bind(id(), host, guest, now, now),
    db.prepare(`INSERT INTO follows (source_id, follower_id, following_id, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?)`).bind(id(), guest, host, now, now),
    db.prepare(`INSERT INTO rooms (source_id, title, type, host_id, category, tags, language, status, visibility,
      max_speakers, participant_count, is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only,
      started_at, created_at, updated_at)
      VALUES (?, 'Feed fixture room', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PUBLIC', 8, 3, 0, ?, 0, 0, 0, ?, ?, ?)`)
      .bind(room, host, `feed-${room}`, now, now, now),
    db.prepare(`INSERT INTO room_activities (source_id, room_id, user_id, type, label, metadata, created_at, updated_at)
      VALUES (?, ?, ?, 'GIFT', 'sent a gift', '{}', ?, ?)`).bind(activity, room, host, now, now),
    db.prepare(`INSERT INTO stories (source_id, user_id, media_url, media_type, caption, like_count, reply_count,
      expires_at, status, created_at, updated_at)
      VALUES (?, ?, 'https://fixture.test/story.jpg', 'IMAGE', 'Fixture story', 0, 3, ?, 'ACTIVE', ?, ?)`)
      .bind(story, host, future, now, now),
    db.prepare(`INSERT INTO story_comments (source_id, story_id, user_id, parent_id, text, created_at, updated_at)
      VALUES (?, ?, ?, NULL, 'top level', ?, ?), (?, ?, ?, ?, 'reply one', ?, ?), (?, ?, ?, ?, 'reply two', ?, ?)`)
      .bind(comment, story, guest, now, now,
        replyOne, story, host, comment, now, now,
        replyTwo, story, host, comment, now, now),
    db.prepare(`INSERT INTO gifts (source_id, name, icon, coin_price, pk_points, diamond_price, is_active, effect3d,
      interactive, animation_key, combo_multiplier, category, bond_points, bond_minimum_days, theme, rarity,
      limited_edition_active, limited_edition_total, limited_edition_remaining, tradable, upgradeable,
      achievement_gift, pet_gift, vehicle_gift)
      VALUES (?, 'Feed fixture gift', '✨', 10, 1, 1, 1, '', 0, '', 1, 'normal', 0, 0, '', 'common', 0, 0, 0, 1, 0, 0, 0, 0)`)
      .bind(gift),
    ...[
      [host, guest, 30, now],
      [host, guest, 20, now],
      [guest, host, 5, older]
    ].map(([sender, receiver, coins, createdAt]) => db.prepare(`INSERT INTO gift_transactions
      (source_id, sender_id, receiver_id, gift_id, coin_amount, diamond_amount, currency, type, combo_count,
       total_value, effect, metadata, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 0, 'COINS', 'send', 1, ?, '', '{}', ?, ?)`)
      .bind(id(), sender, receiver, gift, coins, coins, createdAt, now))
  ]);

  await request("/api/feed", 401);
  const feed = (await request("/api/feed", 200, { accessToken: visitor.accessToken })).data.feed;
  const live = feed.find(item => item.type === "FRIEND_LIVE" && item.room._id === room);
  assert.ok(live, "friend live room is missing from the feed");
  assert.equal(live.room.hostId._id, host);
  assert.equal(live.room.participantCount, 3);
  const storyEntry = feed.find(item => item.type === "FRIEND_STORY" && item.story._id === story);
  assert.ok(storyEntry, "friend story is missing from the feed");
  assert.equal(storyEntry.story.userId._id, host);
  assert.equal(storyEntry.story.caption, "Fixture story");
  assert.deepEqual(storyEntry.story.viewedBy, []);
  const activityEntry = feed.find(item => item.type === "ACTIVITY" && item.activity._id === activity);
  assert.ok(activityEntry, "friend activity is missing from the feed");
  assert.equal(activityEntry.activity.userId._id, host);
  assert.equal(activityEntry.activity.roomId._id, room);
  assert.equal(activityEntry.activity.roomId.title, "Feed fixture room");

  await request("/api/gift-leaderboard", 401);
  const board = (await request("/api/gift-leaderboard?period=all&limit=10", 200, { accessToken: owner.accessToken })).data;
  assert.equal(board.period, "all");
  const sender = board.topSenders.find(item => item._id === host);
  assert.ok(sender);
  assert.equal(sender.totalCoins, 50);
  assert.equal(sender.giftCount, 2);
  assert.equal(sender.user._id, host);
  const receiver = board.topReceivers.find(item => item._id === guest);
  assert.ok(receiver);
  assert.equal(receiver.totalCoins, 50);
  assert.equal(receiver.giftCount, 2);
  assert.equal(receiver.user._id, guest);
  const daily = (await request("/api/gift-leaderboard?period=daily&limit=10", 200, { accessToken: owner.accessToken })).data;
  assert.equal(daily.period, "daily");
  assert.equal(daily.topSenders.some(item => item._id === guest), false, "older gift leaked into the daily senders");
  assert.equal(daily.topReceivers.some(item => item._id === host), false, "older gift leaked into the daily receivers");
  const limited = (await request("/api/gift-leaderboard?period=all&limit=1", 200, { accessToken: owner.accessToken })).data;
  assert.equal(limited.topSenders.length, 1);
  assert.equal(limited.topReceivers.length, 1);

  await request(`/api/comments/${comment}`, 404, { accessToken: owner.accessToken, method: "DELETE" });
  assert.equal((await request(`/api/comments/${comment}`, 200, {
    accessToken: visitor.accessToken, method: "DELETE"
  })).data.deleted, true);
  assert.equal(await db.prepare("SELECT 1 FROM story_comments WHERE source_id = ?").bind(comment).first(), null);
  assert.equal(await db.prepare("SELECT COUNT(*) AS total FROM story_comments WHERE parent_id = ?")
    .bind(comment).first("total"), 0);
  assert.equal(await db.prepare("SELECT reply_count FROM stories WHERE source_id = ?").bind(story).first("reply_count"), 0);
  await request(`/api/comments/${comment}`, 404, { accessToken: visitor.accessToken, method: "DELETE" });

  const trade = { targetUserId: guest, offerItems: [id()], requestItems: [id()] };
  await request("/api/inventory/trade", 401, { body: trade });
  assert.equal((await request("/api/inventory/trade", 400, {
    accessToken: owner.accessToken, body: { ...trade, targetUserId: "not-an-id" }
  })).error.message, "Invalid targetUserId");
  assert.equal((await request("/api/inventory/trade", 400, {
    accessToken: owner.accessToken, body: { ...trade, offerItems: ["not-an-id"] }
  })).error.message, "Invalid inventory item ID");
  const closed = await request("/api/inventory/trade", 409, { accessToken: owner.accessToken, body: trade });
  assert.equal(closed.error.code, "CONFLICT");
  assert.match(closed.error.message, /items have not moved/);
}
