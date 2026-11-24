import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";

const id = () => randomBytes(12).toString("hex");
const dayMs = 86_400_000;

export async function verifyD1Progression(db, request, account) {
  const userId = account.user.id;
  const yesterday = new Date(Date.now() - dayMs).toISOString();
  await db.batch([
    db.prepare(`UPDATE users SET xp = 90, level = 1, wallet_balance = 100, streak_count = 2, last_daily_check_in_at = ?
      WHERE source_id = ?`).bind(yesterday, userId),
    db.prepare("DELETE FROM user_owned_cosmetics WHERE users_id = ? AND value = 'mood_chill'").bind(userId)
  ]);
  const route = "/api/users/me/check-in";
  const checkIn = status => request(route, status, { accessToken: account.accessToken, body: {} });
  await request(route, 401, { body: {} });
  const before = (await request("/api/users/me/level-overview", 200, account)).data;
  assert.equal(before.level.xp, 90);
  assert.equal(before.streak.canCheckIn, true);
  assert.equal(before.streak.nextMilestone, 3);

  await db.prepare(`CREATE TRIGGER reject_fixture_streak BEFORE INSERT ON wallet_transactions
    WHEN NEW.source = 'STREAK_BONUS' BEGIN SELECT RAISE(ABORT, 'fixture streak rollback'); END`).run();
  try {
    await checkIn(500);
    assert.equal(await db.prepare("SELECT last_daily_check_in_at FROM users WHERE source_id = ?").bind(userId)
      .first("last_daily_check_in_at"), yesterday);
  } finally {
    await db.prepare("DROP TRIGGER reject_fixture_streak").run();
  }
  const attempts = await Promise.all([checkIn(200), checkIn(200)]);
  const awarded = attempts.find(item => !item.data.alreadyClaimed).data;
  assert.equal(attempts.filter(item => item.data.alreadyClaimed).length, 1);
  assert.equal(awarded.streak, 3);
  assert.equal(awarded.streakBonus, 10);
  assert.equal(awarded.unlockedCosmetic, "mood_chill");
  assert.equal(awarded.xpGrant.xpAwarded, 25);
  assert.equal(awarded.balance, 135);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM xp_grants WHERE user_id = ? AND event = 'DAILY_CHECKIN'")
    .bind(userId).first("count"), 1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM battle_pass_xp_grants WHERE user_id = ? AND action_key LIKE 'DAILY_CHECKIN:%'")
    .bind(userId).first("count"), 1);
  assert.equal(await db.prepare("SELECT COUNT(*) AS count FROM user_owned_cosmetics WHERE users_id = ? AND value = 'mood_chill'")
    .bind(userId).first("count"), 1);
  const after = (await request("/api/users/me/level", 200, account)).data.level;
  assert.equal(after.level, 2);
  assert.equal(after.canDailyCheckIn, false);
  const board = (await request("/api/leaderboard/levels?pageSize=1", 200, account)).data;
  assert.equal(board.requesterId, userId);
  assert.equal(board.users[0].rank, 1);
  assert.deepEqual(board, (await request("/api/users/leaderboard/levels?pageSize=1", 200, account)).data);
}

export async function verifyD1Maintenance(worker, db, owner, visitor) {
  const now = new Date();
  const time = now.toISOString();
  const past = new Date(now.getTime() - 60 * 60_000).toISOString();
  const future = new Date(now.getTime() + dayMs).toISOString();
  const oldClanTime = new Date(now.getTime() - 31 * dayMs).toISOString();
  const staleRoomTime = new Date(now.getTime() - 49 * 60 * 60_000).toISOString();
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const [session, story, hidden, clan, oldMessage, recentMessage, reaction, invite,
    staleRoom, recentRoom, officialRoom, participant, roomMessage, speakerRequest] = Array.from({ length: 14 }, id);
  const [expiredUpload, processingUpload, freshUpload] = Array.from({ length: 3 }, randomUUID);
  const staging = await worker.getR2Bucket("STAGING");
  const rooms = [
    [staleRoom, `stale-${staleRoom}`, staleRoomTime],
    [recentRoom, `recent-${recentRoom}`, time],
    [officialRoom, "official-yugm-trending", staleRoomTime]
  ];
  const sessions = [
    [expiredUpload, "PENDING", past, past], [processingUpload, "PROCESSING", past, time],
    [freshUpload, "PENDING", future, time]
  ];
  await db.batch([
    db.prepare(`INSERT INTO auth_sessions (source_id, user_id, family_id, refresh_hash, expires_at, last_used_at, token_version_present)
      VALUES (?, ?, ?, ?, ?, ?, 0)`).bind(session, ownerId, id(), id(), past, past),
    db.prepare(`INSERT INTO stories (source_id, user_id, media_url, media_type, like_count, reply_count, expires_at, status)
      VALUES (?, ?, 'fixture', 'IMAGE', 0, 0, ?, 'ACTIVE'), (?, ?, 'fixture', 'IMAGE', 0, 0, ?, 'HIDDEN')`)
      .bind(story, ownerId, past, hidden, ownerId, past),
    db.prepare(`INSERT INTO clans (source_id, owner_id, name, slug, privacy, family_label, member_count)
      VALUES (?, ?, 'Retention Fixture', 'retention-fixture', 'PUBLIC', 'Family', 1)`).bind(clan, ownerId),
    db.prepare(`INSERT INTO clan_messages (source_id, clan_id, sender_id, message, created_at)
      VALUES (?, ?, ?, 'expired', ?), (?, ?, ?, 'recent', ?)`).bind(oldMessage, clan, ownerId, oldClanTime, recentMessage, clan, ownerId, time),
    db.prepare(`INSERT INTO clan_message_reactions (source_id, user_id, type, created_at, clan_messages_id, position)
      VALUES (?, ?, 'heart', ?, ?, 0)`).bind(reaction, visitorId, oldClanTime, oldMessage),
    db.prepare(`INSERT INTO clan_invites (source_id, clan_id, inviter_id, invitee_id, status, expires_at)
      VALUES (?, ?, ?, ?, 'PENDING', ?)`).bind(invite, clan, ownerId, visitorId, past),
    db.prepare("UPDATE users SET suspended_until = ?, moderation_reason = 'fixture', vip_tier = 'VIP2', vip_level = 2, vip_exp = 1000, vip_expires_at = ?, vip_frozen = 0 WHERE source_id = ?")
      .bind(past, past, visitorId),
    db.prepare(`INSERT INTO media_quota_reservations (source_id, bytes) VALUES (?, 30)
      ON CONFLICT (source_id) DO UPDATE SET bytes = 30`).bind(ownerId),
    ...sessions.map(([key, status, expiry, updated]) => db.prepare(`INSERT INTO media_upload_sessions
      (source_id, user_id, category, expected_content_type, expected_bytes, owner_type, owner_id, bucket, staging_key, status,
      expires_at, attempts, quota_reserved, created_at, updated_at, upload_token_hash)
      VALUES (?, ?, 'AVATAR', 'image/png', 10, 'USER', ?, 'staging', ?, ?, ?, 0, 1, ?, ?, 'fixture')`)
      .bind(key, ownerId, ownerId, key, status, expiry, updated, updated)),
    ...rooms.map(([roomId, livekitName, createdAt]) => db.prepare(`INSERT INTO rooms
      (source_id, title, type, host_id, category, tags, language, status, visibility, max_speakers, participant_count,
       is_duet, livekit_room_name, allow_audience_mic_requests, mic_locked, vip_only, created_at, updated_at)
      VALUES (?, 'Maintenance fixture', 'VOICE', ?, 'fixture', '[]', 'en', 'LIVE', 'PUBLIC', 8, 1, 0, ?, 0, 0, 0, ?, ?)`)
      .bind(roomId, ownerId, livekitName, createdAt, createdAt)),
    db.prepare(`INSERT INTO room_participants (source_id, room_id, user_id, role, mic_enabled, moderator_muted,
      seat_index, camera_enabled, joined_at) VALUES (?, ?, ?, 'HOST', 1, 0, 0, 1, ?)`)
      .bind(participant, staleRoom, ownerId, staleRoomTime),
    db.prepare(`INSERT INTO chat_messages (source_id, room_id, sender_id, message, type, created_at, updated_at)
      VALUES (?, ?, ?, 'stale room message', 'TEXT', ?, ?)`)
      .bind(roomMessage, staleRoom, ownerId, staleRoomTime, staleRoomTime),
    db.prepare(`INSERT INTO speaker_requests (source_id, room_id, user_id, status, created_at, updated_at)
      VALUES (?, ?, ?, 'PENDING', ?, ?)`).bind(speakerRequest, staleRoom, visitorId, staleRoomTime, staleRoomTime)
  ]);
  await Promise.all(sessions.map(([key]) => staging.put(key, "fixture")));
  const entrypoint = await worker.getWorker();
  const invoke = async () => {
    const maintenance = await entrypoint.scheduled({ cron: "*/15 * * * *", scheduledTime: now });
    assert.equal(maintenance.outcome, "ok");
  };
  await invoke();
  await invoke();
  assert.equal(await db.prepare("SELECT 1 FROM auth_sessions WHERE source_id = ?").bind(session).first(), null);
  assert.equal(await db.prepare("SELECT status FROM stories WHERE source_id = ?").bind(story).first("status"), "EXPIRED");
  assert.equal(await db.prepare("SELECT status FROM stories WHERE source_id = ?").bind(hidden).first("status"), "HIDDEN");
  assert.equal(await db.prepare("SELECT status FROM clan_invites WHERE source_id = ?").bind(invite).first("status"), "EXPIRED");
  assert.equal(await db.prepare("SELECT 1 FROM clan_message_reactions WHERE source_id = ?").bind(reaction).first(), null);
  assert.equal(await db.prepare("SELECT 1 FROM clan_messages WHERE source_id = ?").bind(oldMessage).first(), null);
  assert.ok(await db.prepare("SELECT 1 FROM clan_messages WHERE source_id = ?").bind(recentMessage).first());
  assert.deepEqual(await db.prepare("SELECT suspended_until, moderation_reason, vip_tier, vip_exp FROM users WHERE source_id = ?")
    .bind(visitorId).first(), { suspended_until: null, moderation_reason: null, vip_tier: "VIP1", vip_exp: 0 });
  assert.equal(await db.prepare("SELECT bytes FROM media_quota_reservations WHERE source_id = ?").bind(ownerId).first("bytes"), 20);
  assert.equal(await db.prepare("SELECT status FROM media_upload_sessions WHERE source_id = ?").bind(expiredUpload).first("status"), "EXPIRED");
  assert.ok(await staging.head(expiredUpload));
  await db.prepare("UPDATE media_upload_sessions SET updated_at = ? WHERE source_id = ?").bind(past, expiredUpload).run();
  await invoke();
  assert.equal(await staging.head(expiredUpload), null);
  assert.ok(await staging.head(processingUpload));
  assert.ok(await staging.head(freshUpload));
  assert.ok(await db.prepare("SELECT staging_cleaned_at FROM media_upload_sessions WHERE source_id = ?").bind(expiredUpload).first("staging_cleaned_at"));
  assert.equal(await db.prepare("SELECT bytes FROM media_quota_reservations WHERE source_id = ?").bind(ownerId).first("bytes"), 20);
  const endedRoom = await db.prepare("SELECT status, participant_count, ended_at FROM rooms WHERE source_id = ?")
    .bind(staleRoom).first();
  assert.equal(endedRoom.status, "ENDED");
  assert.equal(endedRoom.participant_count, 0);
  assert.ok(endedRoom.ended_at);
  assert.deepEqual(await db.prepare("SELECT left_at, mic_enabled, seat_index FROM room_participants WHERE source_id = ?")
    .bind(participant).first(), { left_at: endedRoom.ended_at, mic_enabled: 0, seat_index: null });
  assert.equal(await db.prepare("SELECT 1 FROM chat_messages WHERE source_id = ?").bind(roomMessage).first(), null);
  assert.equal(await db.prepare("SELECT status FROM speaker_requests WHERE source_id = ?").bind(speakerRequest).first("status"), "REJECTED");
  assert.equal(await db.prepare("SELECT status FROM rooms WHERE source_id = ?").bind(recentRoom).first("status"), "LIVE");
  assert.equal(await db.prepare("SELECT status FROM rooms WHERE source_id = ?").bind(officialRoom).first("status"), "LIVE");
}

export async function verifyD1PushDelivery(worker, db, owner, visitor, attempts) {
  const now = new Date();
  const time = now.toISOString();
  const notifications = [id(), id()];
  const devices = ["fixture-push-success", "fixture-push-retry", "fixture-push-unregistered", "fixture-push-opt-out"];
  await db.batch([
    db.prepare("DELETE FROM notification_push_jobs"),
    db.prepare("DELETE FROM device_tokens WHERE user_id IN (?, ?)").bind(owner.user.id, visitor.user.id),
    db.prepare("UPDATE users SET notification_preferences_messages = CASE WHEN source_id = ? THEN 1 ELSE 0 END WHERE source_id IN (?, ?)")
      .bind(owner.user.id, owner.user.id, visitor.user.id),
    ...devices.map((token, index) => db.prepare(`INSERT INTO device_tokens (source_id, user_id, token, platform, last_seen_at)
      VALUES (?, ?, ?, 'android', ?)`).bind(id(), index === 3 ? visitor.user.id : owner.user.id, token, time)),
    ...notifications.map((notification, index) => db.prepare(`INSERT INTO notifications
      (source_id, user_id, type, title, body, data, read, created_at, updated_at)
      VALUES (?, ?, 'MESSAGE', 'Fixture push', 'Inbox persists', '{"partnerId":"fixture"}', 0, ?, ?)`)
      .bind(notification, index === 0 ? owner.user.id : visitor.user.id, time, time))
  ]);
  const counts = async () => (await db.prepare(`SELECT status, COUNT(*) AS count FROM notification_push_jobs
    GROUP BY status ORDER BY status`).all()).results;
  assert.deepEqual(await counts(), [{ status: "PENDING", count: 4 }]);
  const entrypoint = await worker.getWorker();
  const invoke = () => entrypoint.scheduled({ cron: "* * * * *", scheduledTime: new Date() });
  const deliveries = await Promise.all([invoke(), invoke()]);
  assert.ok(deliveries.every(delivery => delivery.outcome === "ok"));
  assert.deepEqual(await counts(), [{ status: "PENDING", count: 1 }, { status: "SENT", count: 1 }, { status: "SKIPPED", count: 2 }]);
  assert.equal(await db.prepare("SELECT 1 FROM device_tokens WHERE token = ?").bind(devices[2]).first(), null);
  assert.ok(await db.prepare("SELECT 1 FROM notifications WHERE source_id = ?").bind(notifications[1]).first());
  assert.deepEqual(devices.map(device => attempts.get(device) ?? 0), [1, 1, 1, 0]);

  await db.prepare("UPDATE notification_push_jobs SET due_at = ? WHERE status = 'PENDING'").bind(time).run();
  assert.equal((await invoke()).outcome, "ok");
  assert.deepEqual(await counts(), [{ status: "SENT", count: 2 }, { status: "SKIPPED", count: 2 }]);
  assert.deepEqual(devices.map(device => attempts.get(device) ?? 0), [1, 2, 1, 0]);
}
