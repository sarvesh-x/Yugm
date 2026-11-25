import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");

export async function verifyD1Subscriptions(db, request, creator, subscriber) {
  const creatorId = creator.user.id;
  const subscriberId = subscriber.user.id;
  const time = new Date().toISOString();
  const deviceId = id();
  const safetyId = id();

  await db.batch([
    db.prepare("DELETE FROM subscriptions WHERE subscriber_id IN (?, ?) OR creator_id IN (?, ?)")
      .bind(creatorId, subscriberId, creatorId, subscriberId),
    db.prepare("DELETE FROM wallet_transactions WHERE user_id IN (?, ?) AND source = 'SUBSCRIPTION'")
      .bind(creatorId, subscriberId),
    db.prepare("DELETE FROM notifications WHERE user_id IN (?, ?) AND title = 'New subscriber'")
      .bind(creatorId, subscriberId),
    db.prepare("DELETE FROM user_safety_statuses WHERE user_id IN (?, ?)").bind(creatorId, subscriberId),
    db.prepare("UPDATE users SET wallet_balance = 5000 WHERE source_id IN (?, ?)").bind(creatorId, subscriberId),
    db.prepare("UPDATE users SET avatar_parts_head = 3 WHERE source_id = ?").bind(creatorId),
    db.prepare("DELETE FROM device_tokens WHERE source_id = ?").bind(deviceId),
    db.prepare(`INSERT INTO device_tokens (source_id, user_id, token, platform, last_seen_at)
      VALUES (?, ?, 'fixture-subscription-device', 'android', ?)`).bind(deviceId, creatorId, time)
  ]);

  await request("/api/subscriptions", 401);
  await request("/api/subscriptions/subscribers", 401);
  await request(`/api/subscriptions/check/${creatorId}`, 401);
  await request(`/api/subscriptions/${creatorId}`, 401, { body: { plan: "MONTHLY" } });
  await request(`/api/subscriptions/${creatorId}`, 401, { method: "DELETE" });
  assert.equal((await request("/api/subscriptions/not-an-id", 422, {
    accessToken: subscriber.accessToken, body: { plan: "WEEKLY" }
  })).error.code, "VALIDATION");
  assert.equal((await request("/api/subscriptions/not-an-id", 400, {
    accessToken: subscriber.accessToken, body: { plan: "MONTHLY" }
  })).error.message, "Invalid creator ID");
  assert.equal((await request(`/api/subscriptions/${creatorId}`, 400, {
    accessToken: creator.accessToken, body: { plan: "MONTHLY" }
  })).error.message, "Cannot subscribe to yourself");
  assert.equal((await request(`/api/subscriptions/${id()}`, 404, {
    accessToken: subscriber.accessToken, body: { plan: "MONTHLY" }
  })).error.message, "Creator not found");

  await db.prepare("UPDATE users SET wallet_balance = 100 WHERE source_id = ?").bind(subscriberId).run();
  assert.equal((await request(`/api/subscriptions/${creatorId}`, 402, {
    accessToken: subscriber.accessToken, body: { plan: "MONTHLY" }
  })).error.code, "INSUFFICIENT_FUNDS");
  await db.batch([
    db.prepare("UPDATE users SET wallet_balance = 5000 WHERE source_id = ?").bind(subscriberId),
    db.prepare(`INSERT INTO user_safety_statuses (source_id, user_id, trust_score, risk_level,
      warning_count, report_count, suspension_count, is_shadow_banned, is_chat_restricted, is_room_restricted,
      is_wallet_frozen, created_at, updated_at) VALUES (?, ?, 100, 'LOW', 0, 0, 0, 0, 0, 0, 1, ?, ?)`)
      .bind(safetyId, subscriberId, time, time)
  ]);
  assert.equal((await request(`/api/subscriptions/${creatorId}`, 403, {
    accessToken: subscriber.accessToken, body: { plan: "MONTHLY" }
  })).error.message, "Wallet is frozen");
  await db.prepare("DELETE FROM user_safety_statuses WHERE source_id = ?").bind(safetyId).run();

  const subscriberName = await db.prepare("SELECT name FROM users WHERE source_id = ?")
    .bind(subscriberId).first("name");
  const monthly = await request(`/api/subscriptions/${creatorId}`, 201, {
    accessToken: subscriber.accessToken, body: { plan: "MONTHLY" }
  });
  const monthlyId = await db.prepare("SELECT source_id FROM subscriptions WHERE subscriber_id = ? AND creator_id = ?")
    .bind(subscriberId, creatorId).first("source_id");
  assert.equal(monthly.data.subscription._id, monthlyId);
  assert.equal(monthly.data.subscription.subscriberId, subscriberId);
  assert.equal(monthly.data.subscription.creatorId, creatorId);
  assert.equal(monthly.data.subscription.plan, "MONTHLY");
  assert.equal(monthly.data.subscription.coinAmount, 299);
  assert.equal(monthly.data.subscription.active, true);
  assert.equal(monthly.data.subscription.status, "ACTIVE");
  assert.equal(monthly.data.subscription.autoRenewing, false);
  const monthlyDays = (new Date(monthly.data.subscription.expiresAt).getTime() - Date.now()) / 86_400_000;
  assert.ok(monthlyDays > 29.9 && monthlyDays <= 30);
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(subscriberId).first("wallet_balance")), 4701);

  const monthlyDebit = await db.prepare(`SELECT amount, balance_before, balance_after, metadata
    FROM wallet_transactions WHERE user_id = ? AND source = 'SUBSCRIPTION'`).bind(subscriberId).first();
  assert.deepEqual([monthlyDebit.amount, monthlyDebit.balance_before, monthlyDebit.balance_after], [299, 5000, 4701]);
  assert.deepEqual(JSON.parse(monthlyDebit.metadata), { creatorId, plan: "MONTHLY" });

  const notification = await db.prepare(`SELECT user_id, type, title, body, data, read
    FROM notifications WHERE user_id = ? AND title = 'New subscriber'`).bind(creatorId).first();
  assert.equal(notification.user_id, creatorId);
  assert.equal(notification.type, "SUBSCRIPTION");
  assert.equal(notification.body, `${subscriberName} subscribed to you!`);
  assert.deepEqual(JSON.parse(notification.data), { subscriberId, plan: "MONTHLY" });
  assert.equal(notification.read, 0);
  assert.equal((await db.prepare(`SELECT COUNT(*) AS count FROM notification_push_jobs
    WHERE device_id = ?`).bind(deviceId).first("count")), 1);

  assert.equal((await request(`/api/subscriptions/${creatorId}`, 409, {
    accessToken: subscriber.accessToken, body: { plan: "MONTHLY" }
  })).error.message, "Already subscribed to this creator");
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(subscriberId).first("wallet_balance")), 4701);
  assert.equal((await db.prepare("SELECT COUNT(*) AS count FROM wallet_transactions WHERE user_id = ? AND source = 'SUBSCRIPTION'")
    .bind(subscriberId).first("count")), 1);

  const mine = await request("/api/subscriptions", 200, { accessToken: subscriber.accessToken });
  assert.equal(mine.data.subscriptions.length, 1);
  assert.equal(mine.data.subscriptions[0]._id, monthlyId);
  assert.equal(mine.data.subscriptions[0].creatorId._id, creatorId);
  assert.equal(mine.data.subscriptions[0].creatorId.name, creator.user.name);
  assert.equal(mine.data.subscriptions[0].creatorId.avatarParts.head, 3);

  const check = await request(`/api/subscriptions/check/${creatorId}`, 200, { accessToken: subscriber.accessToken });
  assert.equal(check.data.subscribed, true);
  assert.equal(check.data.subscription._id, monthlyId);
  assert.equal(check.data.subscription.creatorId, creatorId);
  assert.equal((await request("/api/subscriptions/check/not-an-id", 400, {
    accessToken: subscriber.accessToken
  })).error.message, "Invalid creator ID");
  assert.deepEqual((await request(`/api/subscriptions/check/${id()}`, 200, {
    accessToken: subscriber.accessToken
  })).data, { subscribed: false });

  const subscribers = await request("/api/subscriptions/subscribers", 200, { accessToken: creator.accessToken });
  assert.equal(subscribers.data.subscribers.length, 1);
  assert.equal(subscribers.data.subscribers[0]._id, monthlyId);
  assert.equal(subscribers.data.subscribers[0].subscriberId, subscriberId);
  assert.equal(subscribers.data.subscribers[0].subscriber._id, subscriberId);
  assert.equal(subscribers.data.subscribers[0].subscriber.name, subscriber.user.name);
  assert.deepEqual((await request("/api/subscriptions/subscribers", 200, {
    accessToken: subscriber.accessToken
  })).data.subscribers, []);

  assert.equal((await request("/api/subscriptions/not-an-id", 400, {
    accessToken: subscriber.accessToken, method: "DELETE"
  })).error.message, "Invalid creator ID");
  assert.equal((await request(`/api/subscriptions/${id()}`, 404, {
    accessToken: subscriber.accessToken, method: "DELETE"
  })).error.message, "Active subscription not found");
  assert.deepEqual((await request(`/api/subscriptions/${creatorId}`, 200, {
    accessToken: subscriber.accessToken, method: "DELETE"
  })).data, { cancelled: true });
  const cancelled = await db.prepare("SELECT active, status FROM subscriptions WHERE source_id = ?")
    .bind(monthlyId).first();
  assert.equal(cancelled.active, 0);
  assert.equal(cancelled.status, "ACTIVE");
  assert.deepEqual((await request(`/api/subscriptions/check/${creatorId}`, 200, {
    accessToken: subscriber.accessToken
  })).data, { subscribed: false });
  assert.equal((await request(`/api/subscriptions/${creatorId}`, 404, {
    accessToken: subscriber.accessToken, method: "DELETE"
  })).error.message, "Active subscription not found");

  await db.batch([
    db.prepare("DELETE FROM subscriptions WHERE subscriber_id IN (?, ?) OR creator_id IN (?, ?)")
      .bind(creatorId, subscriberId, creatorId, subscriberId),
    db.prepare("DELETE FROM wallet_transactions WHERE user_id IN (?, ?) AND source = 'SUBSCRIPTION'")
      .bind(creatorId, subscriberId),
    db.prepare("DELETE FROM notifications WHERE user_id IN (?, ?) AND title = 'New subscriber'")
      .bind(creatorId, subscriberId),
    db.prepare("UPDATE users SET wallet_balance = 5000 WHERE source_id IN (?, ?)").bind(creatorId, subscriberId),
    db.prepare("UPDATE users SET avatar_parts_head = NULL WHERE source_id = ?").bind(creatorId)
  ]);
  const yearly = await request(`/api/subscriptions/${subscriberId}`, 201, {
    accessToken: creator.accessToken, body: { plan: "YEARLY" }
  });
  assert.equal(yearly.data.subscription.plan, "YEARLY");
  assert.equal(yearly.data.subscription.coinAmount, 2999);
  const yearlyDays = (new Date(yearly.data.subscription.expiresAt).getTime() - Date.now()) / 86_400_000;
  assert.ok(yearlyDays > 364.9 && yearlyDays <= 365);
  assert.equal((await db.prepare("SELECT wallet_balance FROM users WHERE source_id = ?").bind(creatorId).first("wallet_balance")), 2001);
  assert.deepEqual((await request("/api/subscriptions", 200, { accessToken: subscriber.accessToken })).data.subscriptions, []);
  assert.equal((await request("/api/subscriptions", 200, { accessToken: creator.accessToken })).data.subscriptions.length, 1);
  assert.equal((await request("/api/subscriptions/subscribers", 200, { accessToken: subscriber.accessToken })).data.subscribers.length, 1);
}
