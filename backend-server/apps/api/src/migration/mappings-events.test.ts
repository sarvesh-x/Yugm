import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const USER = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439012";
const ADMIN = "507f1f77bcf86cd799439013";
const ROOM = "507f1f77bcf86cd799439015";
const EVENT = "507f1f77bcf86cd799439017";
const RELATIONSHIP = "507f1f77bcf86cd799439018";

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-events");
  const result = applyMapping(collection, record, context);
  context.assertAccountedFor();
  return { context, result };
}

function table(result: { writes: Array<{ table: string; rows: TargetRow[] }> }, name: string): TargetRow[] {
  return result.writes.find((write) => write.table === name)?.rows ?? [];
}

function assertColumns(result: { writes: Array<{ table: string; rows: TargetRow[] }> }) {
  for (const write of result.writes) {
    for (const row of write.rows) {
      for (const key of Object.keys(row)) {
        assert.match(key, /^[A-Za-z_][A-Za-z0-9_]*$/, `${write.table}.${key}`);
      }
    }
  }
}

test("app config preserves Mixed values and admin provenance", () => {
  const { result, context } = map("app_config", {
    _id: EVENT, key: "bonds.limit", value: { z: 3, a: 1 },
    description: "Active bond cap", updatedBy: ADMIN,
    createdAt: "2026-01-02T03:04:05Z", updatedAt: "2026-01-03T00:00:00Z"
  });
  const row = table(result, "app_config")[0];
  assert.equal(result.rejected, false);
  assert.deepEqual(context.quarantine, []);
  assert.equal(row.key, "bonds.limit");
  assert.equal(row.value, '{"a":1,"z":3}');
  assert.equal(row.updated_by, ADMIN);
  assert.equal(row.updated_at, "2026-01-03T00:00:00.000Z");
  assertColumns(result);

  const missing = map("app_config", { _id: EVENT, key: "bonds.limit" });
  assert.equal(missing.result.rejected, true);
  assert.deepEqual(missing.context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED"]);

  for (const collection of [
    "app_config", "countdown_events", "events", "xp_daily_caps", "xp_grants",
    "user_moods", "wave_nudges", "profile_visits", "likes", "referrals", "relationships"
  ]) {
    assert.equal(typeof getMapping(collection), "function", collection);
  }
});

test("countdown events keep defaults and the lowercase type allowlist", () => {
  const { result } = map("countdown_events", {
    _id: EVENT, title: "New Year", description: "Midnight", targetDate: "2026-12-31T18:30:00Z",
    type: "festival", coverImage: "https://cdn.test/cover.png", color: "#00FF00",
    isActive: false, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "countdown_events")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.type, "festival");
  assert.equal(row.color, "#00FF00");
  assert.equal(row.is_active, 0);
  assert.equal(row.target_date, "2026-12-31T18:30:00.000Z");
  assertColumns(result);

  const defaults = map("countdown_events", {
    _id: EVENT, title: "Launch", targetDate: "2026-12-31T18:30:00Z"
  });
  const defaultRow = table(defaults.result, "countdown_events")[0];
  assert.equal(defaultRow.description, "");
  assert.equal(defaultRow.type, "event");
  assert.equal(defaultRow.color, "#E91E63");
  assert.equal(defaultRow.is_active, 1);

  const bad = map("countdown_events", { _id: EVENT, title: "Bad", targetDate: "2026-12-31T18:30:00Z", type: "holiday" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("events preserve enums, tags JSON and participant child rows", () => {
  const { result } = map("events", {
    _id: EVENT, title: "Voice party", hostId: USER, category: "Music", type: "ROOM",
    eventDate: "2026-02-01T10:00:00Z", eventEndDate: "2026-02-01T12:00:00Z",
    timezone: "Asia/Kolkata", roomId: ROOM, maxParticipants: 20,
    participantIds: [USER, OTHER], tags: ["live", "music"], status: "LIVE",
    festival: "holi", featured: true, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "events")[0];
  const participants = table(result, "event_participants");
  assert.equal(result.rejected, false);
  assert.equal(row.host_id, USER);
  assert.equal(row.type, "ROOM");
  assert.equal(row.status, "LIVE");
  assert.equal(row.festival, "holi");
  assert.equal(row.featured, 1);
  assert.equal(row.max_participants, 20);
  assert.equal(row.tags, '["live","music"]');
  assert.equal(participants.length, 2);
  assert.equal(participants[0].value, USER);
  assert.equal(participants[0].events_id, EVENT);
  assert.equal(participants[0].position, 0);
  assert.equal(participants[1].position, 1);
  assertColumns(result);
});

test("event enum failures reject the parent and bad participants soft-quarantine", () => {
  const bad = map("events", {
    _id: EVENT, title: "Concert", hostId: USER, category: "Music",
    type: "CONCERT", eventDate: "2026-02-01T10:00:00Z"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);

  const soft = map("events", {
    _id: EVENT, title: "Party", hostId: USER, category: "Music", type: "PARTY",
    eventDate: "2026-02-01T10:00:00Z", participantIds: [USER, "not-an-id", OTHER]
  });
  assert.equal(soft.result.rejected, false);
  assert.equal(table(soft.result, "event_participants").length, 2);
  assert.deepEqual(soft.context.quarantine.map((entry) => entry.reason), ["INVALID_ID"]);
});

test("XP daily caps keep the per-user event day and integer amount", () => {
  const { result } = map("xp_daily_caps", {
    _id: EVENT, userId: USER, event: "ROOM_HOST", day: "2026-01-02T00:00:00Z",
    amount: 250, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "xp_daily_caps")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.user_id, USER);
  assert.equal(row.event, "ROOM_HOST");
  assert.equal(row.day, "2026-01-02T00:00:00.000Z");
  assert.equal(row.amount, 250);
  assertColumns(result);

  const bad = map("xp_daily_caps", { _id: EVENT, userId: USER, event: "ROOM_HOST", day: "wrong", amount: 1 });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["INVALID_TIMESTAMP"]);
});

test("XP grants keep action keys, status and provider receipt JSON", () => {
  const { result } = map("xp_grants", {
    _id: EVENT, userId: USER, event: "STREAK", actionKey: "day-7",
    status: "COMPLETE", requestedXp: 100, receipt: { z: 1, a: 2 },
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "xp_grants")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.action_key, "day-7");
  assert.equal(row.status, "COMPLETE");
  assert.equal(row.requested_xp, 100);
  assert.equal(row.receipt, '{"a":2,"z":1}');
  assertColumns(result);

  const defaults = map("xp_grants", { _id: EVENT, userId: USER, event: "STREAK", actionKey: "day-1", requestedXp: 10 });
  assert.equal(table(defaults.result, "xp_grants")[0].status, "PROCESSING");
  assert.equal(table(defaults.result, "xp_grants")[0].receipt, null);
});

test("user moods keep empty-string defaults, activity room and expiration", () => {
  const { result } = map("user_moods", {
    _id: EVENT, userId: USER, mood: "calm", emoji: "😌", activity: "listening",
    activityRoomId: ROOM, isActive: false, expiresAt: "2026-01-03T00:00:00Z"
  });
  const row = table(result, "user_moods")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.mood, "calm");
  assert.equal(row.emoji, "😌");
  assert.equal(row.activity_room_id, ROOM);
  assert.equal(row.is_active, 0);
  assert.equal(row.expires_at, "2026-01-03T00:00:00.000Z");
  assertColumns(result);

  const defaults = map("user_moods", { _id: EVENT, userId: USER });
  const defaultRow = table(defaults.result, "user_moods")[0];
  assert.equal(defaultRow.mood, "");
  assert.equal(defaultRow.emoji, "");
  assert.equal(defaultRow.activity, "");
  assert.equal(defaultRow.is_active, 1);
  assert.equal(defaultRow.expires_at, null);
});

test("wave nudges keep sender, receiver, type and read state", () => {
  const { result } = map("wave_nudges", {
    _id: EVENT, senderId: USER, receiverId: OTHER, type: "vibe_ping",
    read: true, roomId: ROOM, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "wave_nudges")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.sender_id, USER);
  assert.equal(row.receiver_id, OTHER);
  assert.equal(row.type, "vibe_ping");
  assert.equal(row.read, 1);
  assert.equal(row.room_id, ROOM);
  assertColumns(result);

  const defaults = map("wave_nudges", { _id: EVENT, senderId: USER, receiverId: OTHER, type: "wave" });
  assert.equal(table(defaults.result, "wave_nudges")[0].read, 0);
});

test("profile visits derive lastVisitedAt from createdAt when absent", () => {
  const { result } = map("profile_visits", {
    _id: EVENT, profileId: USER, visitorId: OTHER, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "profile_visits")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.profile_id, USER);
  assert.equal(row.visitor_id, OTHER);
  assert.equal(row.last_visited_at, "2026-01-02T03:04:05.000Z");
  assertColumns(result);

  const explicit = map("profile_visits", {
    _id: EVENT, profileId: USER, visitorId: OTHER,
    lastVisitedAt: "2026-01-04T00:00:00Z", createdAt: "2026-01-02T03:04:05Z"
  });
  assert.equal(table(explicit.result, "profile_visits")[0].last_visited_at, "2026-01-04T00:00:00.000Z");
});

test("likes keep the LIKE default and reject unknown types", () => {
  const { result } = map("likes", {
    _id: EVENT, likerId: USER, likedId: OTHER, type: "SUPER_LIKE",
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "likes")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.liker_id, USER);
  assert.equal(row.liked_id, OTHER);
  assert.equal(row.type, "SUPER_LIKE");
  assertColumns(result);

  const defaults = map("likes", { _id: EVENT, likerId: USER, likedId: OTHER });
  assert.equal(table(defaults.result, "likes")[0].type, "LIKE");

  const bad = map("likes", { _id: EVENT, likerId: USER, likedId: OTHER, type: "LOVE" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("referrals keep code, status, reward and referred-user provenance", () => {
  const { result } = map("referrals", {
    _id: EVENT, referrerId: USER, referredUserId: OTHER, referralCode: "YUGM-7K2",
    status: "REWARDED", rewardCoins: 500, rewardCosmeticId: "badge-1",
    completedAt: "2026-01-02T00:00:00Z", rewardedAt: "2026-01-03T00:00:00Z",
    ipAddress: "203.0.113.20", createdAt: "2026-01-01T00:00:00Z"
  });
  const row = table(result, "referrals")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.referrer_id, USER);
  assert.equal(row.referred_user_id, OTHER);
  assert.equal(row.referral_code, "YUGM-7K2");
  assert.equal(row.status, "REWARDED");
  assert.equal(row.reward_coins, 500);
  assert.equal(row.rewarded_at, "2026-01-03T00:00:00.000Z");
  assertColumns(result);

  const bad = map("referrals", { _id: EVENT, referrerId: USER, referralCode: "X", status: "PAID" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("relationships emit deterministic user child rows and keep progression state", () => {
  const { result } = map("relationships", {
    _id: RELATIONSHIP, users: [USER, OTHER], pairKey: `${USER}:${OTHER}`,
    xp: 640, level: 4, levelTitle: "Kindred", streakDays: 12,
    lastStreakAt: "2026-01-03T00:00:00Z", lastInteractionAt: "2026-01-04T00:00:00Z",
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "relationships")[0];
  const users = table(result, "relationship_users");
  assert.equal(result.rejected, false);
  assert.equal(row.pair_key, `${USER}:${OTHER}`);
  assert.equal(row.xp, 640);
  assert.equal(row.level, 4);
  assert.equal(row.level_title, "Kindred");
  assert.equal(row.streak_days, 12);
  assert.equal(users.length, 2);
  assert.equal(users[0].value, USER);
  assert.equal(users[0].relationships_id, RELATIONSHIP);
  assert.equal(users[0].position, 0);
  assert.equal(users[1].value, OTHER);
  assert.equal(users[1].position, 1);
  assertColumns(result);

  const defaults = map("relationships", { _id: RELATIONSHIP, pairKey: "pair-1", users: [USER] });
  const defaultRow = table(defaults.result, "relationships")[0];
  assert.equal(defaultRow.xp, 0);
  assert.equal(defaultRow.level, 1);
  assert.equal(defaultRow.level_title, "First Spark");
  assert.equal(defaultRow.streak_days, 0);
});
