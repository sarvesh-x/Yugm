import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping, MAPPINGS, ROOT_TABLES } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const A = "507f1f77bcf86cd799439011";
const B = "507f1f77bcf86cd799439012";
const C = "507f1f77bcf86cd799439013";
const BOND = "507f1f77bcf86cd799439014";
const SNAPSHOT = "507f1f77bcf86cd799439016";

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-bonds");
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

test("bonds normalize reference/primitive children and canonicalize per-user preferences", () => {
  const { result, context } = map("bonds", {
    _id: BOND,
    pairKey: `${A}:${B}`,
    users: [A, B],
    slots: [0, 2],
    kind: "BESTIE",
    activatedAt: "2026-01-02T03:04:05Z",
    points: 120,
    version: 3,
    milestoneDays: [1, 7],
    preferences: {
      [A]: { visibility: "FRIENDS", showDuration: false, reminders: false },
      [B]: { leaderboard: true, announcements: true }
    },
    nextMilestoneAt: "2026-01-08T00:00:00Z",
    createdAt: "2026-01-02T03:04:05Z",
    updatedAt: "2026-01-03T00:00:00Z"
  });
  const row = table(result, "bonds")[0];
  assert.equal(result.rejected, false);
  assert.deepEqual(context.quarantine, []);
  assert.equal(row.pair_key, `${A}:${B}`);
  assert.equal(row.kind, "BESTIE");
  assert.equal(row.status, "ACTIVE");
  assert.equal(row.activated_at, "2026-01-02T03:04:05.000Z");
  assert.equal(row.points, 120);
  assert.equal(row.version, 3);
  assert.equal(row.milestone_days, "[1,7]");
  assert.equal(row.next_milestone_at, "2026-01-08T00:00:00.000Z");
  assert.deepEqual(table(result, "bond_users"), [
    { source_id: `${BOND}:users:0`, value: A, bonds_id: BOND, position: 0 },
    { source_id: `${BOND}:users:1`, value: B, bonds_id: BOND, position: 1 }
  ]);
  assert.deepEqual(table(result, "bond_slots"), [
    { source_id: `${BOND}:slots:0`, value: 0, bonds_id: BOND, position: 0 },
    { source_id: `${BOND}:slots:1`, value: 2, bonds_id: BOND, position: 1 }
  ]);
  const preferences = JSON.parse(String(row.preferences));
  assert.equal(preferences[A].visibility, "FRIENDS");
  assert.equal(preferences[A].showDuration, 0);
  assert.equal(preferences[A].reminders, 0);
  assert.equal(preferences[A].showRanking, 1);
  assert.equal(preferences[B].visibility, "PRIVATE");
  assert.equal(preferences[B].leaderboard, 1);
  assert.equal(preferences[B].announcements, 1);
  assertColumns(result);
});

test("bonds reject an invalid status and missing required arrays", () => {
  const { result, context } = map("bonds", {
    _id: BOND,
    pairKey: `${A}:${B}`,
    kind: "BESTIE",
    status: "PAUSED",
    activatedAt: "2026-01-02T03:04:05Z"
  });
  assert.equal(result.rejected, true);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(
    context.quarantine.map((entry) => entry.reason),
    ["UNKNOWN_ENUM", "MISSING_REQUIRED", "MISSING_REQUIRED"]
  );
});

test("bond points keep the idempotency key, actor and integer state", () => {
  const { result } = map("bond_points", {
    _id: BOND,
    bondId: BOND,
    actorId: A,
    key: "check-in:2026-01-02",
    kind: "DAILY_CHECK_IN",
    points: 10,
    support: 3,
    createdAt: "2026-01-02T03:04:05Z",
    updatedAt: "2026-01-03T00:00:00Z"
  });
  const row = table(result, "bond_points")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.bond_id, BOND);
  assert.equal(row.actor_id, A);
  assert.equal(row.key, "check-in:2026-01-02");
  assert.equal(row.kind, "DAILY_CHECK_IN");
  assert.equal(row.points, 10);
  assert.equal(row.support, 3);
  assert.equal(row.created_at, "2026-01-02T03:04:05.000Z");
  assert.equal(row.updated_at, "2026-01-03T00:00:00.000Z");
  assertColumns(result);

  const bad = map("bond_points", { _id: BOND, bondId: BOND, key: "x", kind: "x", points: 1.5 });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["NON_INTEGER"]);
});

test("bond ranking snapshots canonicalize entries and soft-quarantine malformed entries", () => {
  const { result, context } = map("bond_ranking_snapshots", {
    _id: SNAPSHOT,
    period: "2026-W01",
    category: "BESTIE",
    entries: [
      { bondId: BOND, score: 1200, rank: 1 },
      { bondId: "not-an-id", score: 99, rank: 2 },
      { bondId: C, score: "bad", rank: 3 }
    ],
    finalizedAt: "2026-01-05T00:00:00Z"
  });
  const row = table(result, "bond_ranking_snapshots")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.period, "2026-W01");
  assert.equal(row.category, "BESTIE");
  assert.equal(row.finalized_at, "2026-01-05T00:00:00.000Z");
  assert.deepEqual(JSON.parse(String(row.entries)), [
    { bondId: BOND, score: 1200, rank: 1 },
    { bondId: C, score: null, rank: 3 }
  ]);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["INVALID_ID", "NON_INTEGER"]);
  assertColumns(result);
});

test("bond ranking snapshots reject a non-array entries value", () => {
  const { result, context } = map("bond_ranking_snapshots", {
    _id: SNAPSHOT, period: "2026-W01", category: "BESTIE", entries: {}, finalizedAt: "2026-01-05T00:00:00Z"
  });
  assert.equal(result.rejected, true);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED"]);
});

test("bond requests keep the replay key, offer snapshot and defaults", () => {
  const { result } = map("bond_requests", {
    _id: BOND,
    pairKey: `${A}:${B}`,
    senderId: A,
    recipientId: B,
    kind: "BESTIE",
    expiresAt: "2026-01-03T00:00:00Z",
    key: "request:2026-01-02"
  });
  const row = table(result, "bond_requests")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.pair_key, `${A}:${B}`);
  assert.equal(row.sender_id, A);
  assert.equal(row.recipient_id, B);
  assert.equal(row.kind, "BESTIE");
  assert.equal(row.status, "PENDING");
  assert.equal(row.expires_at, "2026-01-03T00:00:00.000Z");
  assert.equal(row.key, "request:2026-01-02");
  assert.equal(row.price, 0);
  assert.equal(row.gift_points, 0);
  assert.equal(row.version, 1);
  assert.equal(row.bond_id, null);
  assert.equal(row.slot, null);
  assert.equal(row.gift_id, null);
  assert.equal(row.message, null);
  assertColumns(result);
});

test("bond requests preserve gift provenance and reject an invalid status", () => {
  const { result } = map("bond_requests", {
    _id: BOND,
    pairKey: `${A}:${B}`,
    senderId: A,
    recipientId: B,
    kind: "SOULMATE",
    bondId: C,
    slot: 1,
    giftId: C,
    giftName: "Rose",
    giftIcon: "🌹",
    price: 500,
    giftPoints: 75,
    message: "Hello",
    status: "ACCEPTED",
    expiresAt: "2026-01-03T00:00:00Z",
    resolvedAt: "2026-01-02T05:00:00Z",
    key: "request:2026-01-02",
    version: 2,
    createdAt: "2026-01-02T03:04:05Z",
    updatedAt: "2026-01-02T05:00:00Z"
  });
  const row = table(result, "bond_requests")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.bond_id, C);
  assert.equal(row.slot, 1);
  assert.equal(row.gift_id, C);
  assert.equal(row.gift_name, "Rose");
  assert.equal(row.gift_icon, "🌹");
  assert.equal(row.price, 500);
  assert.equal(row.gift_points, 75);
  assert.equal(row.status, "ACCEPTED");
  assert.equal(row.resolved_at, "2026-01-02T05:00:00.000Z");
  assert.equal(row.version, 2);
  assertColumns(result);

  const bad = map("bond_requests", {
    _id: BOND, pairKey: `${A}:${B}`, senderId: A, recipientId: B, kind: "BESTIE",
    status: "BOGUS", expiresAt: "2026-01-03T00:00:00Z", key: "request:2026-01-02"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("bond rewards keep grant and expiry provenance", () => {
  const { result } = map("bond_rewards", {
    _id: BOND,
    bondId: BOND,
    userId: A,
    key: "milestone:7",
    itemId: "bond_memory_badge",
    grantedAt: "2026-01-09T00:00:00Z",
    expiresAt: "2026-02-09T00:00:00Z"
  });
  const row = table(result, "bond_rewards")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.bond_id, BOND);
  assert.equal(row.user_id, A);
  assert.equal(row.key, "milestone:7");
  assert.equal(row.item_id, "bond_memory_badge");
  assert.equal(row.granted_at, "2026-01-09T00:00:00.000Z");
  assert.equal(row.expires_at, "2026-02-09T00:00:00.000Z");
  assert.equal(row.expired_at, null);
  assertColumns(result);

  const bad = map("bond_rewards", {
    _id: BOND, bondId: BOND, userId: A, key: "x", itemId: "", grantedAt: "2026-01-09T00:00:00Z"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED"]);
});

test("vibe graphs normalize interest/language children", () => {
  const { result } = map("vibe_graphs", {
    _id: BOND,
    userId: A,
    interests: ["music", "travel"],
    languages: ["en", "hi"],
    city: "Pune",
    vibeScore: 88,
    totalInteractions: 12,
    lastVibeUpdate: "2026-01-02T03:04:05Z",
    createdAt: "2026-01-02T03:04:05Z",
    updatedAt: "2026-01-03T00:00:00Z"
  });
  const row = table(result, "vibe_graphs")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.user_id, A);
  assert.equal(row.city, "Pune");
  assert.equal(row.vibe_score, 88);
  assert.equal(row.total_interactions, 12);
  assert.equal(row.last_vibe_update, "2026-01-02T03:04:05.000Z");
  assert.deepEqual(table(result, "vibe_graph_interests"), [
    { source_id: `${BOND}:interests:0`, value: "music", vibe_graphs_id: BOND, position: 0 },
    { source_id: `${BOND}:interests:1`, value: "travel", vibe_graphs_id: BOND, position: 1 }
  ]);
  assert.deepEqual(table(result, "vibe_graph_languages"), [
    { source_id: `${BOND}:languages:0`, value: "en", vibe_graphs_id: BOND, position: 0 },
    { source_id: `${BOND}:languages:1`, value: "hi", vibe_graphs_id: BOND, position: 1 }
  ]);
  assertColumns(result);
});

test("vibe graphs enforce the 0-100 score bound", () => {
  const { result, context } = map("vibe_graphs", {
    _id: BOND, userId: A, city: "", vibeScore: 101, totalInteractions: 0, lastVibeUpdate: "2026-01-02T03:04:05Z"
  });
  assert.equal(result.rejected, true);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["OUT_OF_RANGE"]);
});

test("bond preferences accept Mongoose Map values and soft-quarantine invalid nested values", () => {
  const preferences = new Map<string, unknown>([
    [A, new Map<string, unknown>([["visibility", "FRIENDS"], ["showBadge", false]])],
    [B, { visibility: "PRIVATE", reminders: "yes" }]
  ]);
  const { result, context } = map("bonds", {
    _id: BOND,
    pairKey: `${A}:${B}`,
    users: [A, B],
    slots: [0],
    kind: "SOULMATE",
    activatedAt: "2026-01-02T03:04:05Z",
    preferences
  });
  const row = table(result, "bonds")[0];
  const parsed = JSON.parse(String(row.preferences));
  assert.equal(result.rejected, false);
  assert.equal(parsed[A].visibility, "FRIENDS");
  assert.equal(parsed[A].showBadge, 0);
  assert.equal(parsed[A].leaderboard, 0);
  assert.equal(parsed[B].visibility, "PRIVATE");
  assert.equal(parsed[B].reminders, 1);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["INVALID_BOOLEAN"]);
  assertColumns(result);
});

test("registry exposes all six bond/vibe collections", () => {
  const collections = [
    ["bonds", "bonds"],
    ["bond_points", "bond_points"],
    ["bond_ranking_snapshots", "bond_ranking_snapshots"],
    ["bond_requests", "bond_requests"],
    ["bond_rewards", "bond_rewards"],
    ["vibe_graphs", "vibe_graphs"]
  ] as const;
  for (const [collection, table] of collections) {
    assert.equal(getMapping(collection), MAPPINGS[collection]);
    assert.equal(ROOT_TABLES[collection], table);
  }
});
