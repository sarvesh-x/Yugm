import assert from "node:assert/strict";
import { test } from "node:test";
import { importMappedCollection } from "./import.js";
import { applyMapping, getMapping, MAPPINGS } from "./mappings.js";
import { checksum } from "./snapshot.js";
import { TransformContext } from "./transform.js";
import type {
  Checkpoint,
  CheckpointStore,
  CollectionSnapshot,
  SnapshotManifest,
  SnapshotSource,
  SourceRecord,
  TargetRow,
  TargetWriter
} from "./types.js";

const USER_ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f1f77bcf86cd799439012";
const MEDIA_ID = "11111111-2222-4333-8444-555555555555";

function validUser(overrides: Record<string, unknown> = {}): SourceRecord {
  return {
    _id: USER_ID,
    name: "Aarav",
    username: "aarav",
    role: "USER",
    walletBalance: 250,
    diamondBalance: 10,
    walletXp: 0,
    xp: 5,
    followersCount: 3,
    createdAt: "2026-01-02T03:04:05Z",
    updatedAt: new Date("2026-01-03T00:00:00.000Z"),
    isVerified: true,
    interests: ["music", "travel"],
    hobbies: ["chess"],
    badgeGrants: [
      { badgeId: "badge-1", tier: "GOLD", earnedAt: "2026-01-01T00:00:00Z" }
    ],
    claimedAchievementTiers: [
      { achievementId: "ach-1", tier: "SILVER", claimedAt: "2026-01-02T00:00:00Z" }
    ],
    profileMedia: [
      { url: "https://cdn.example/a.png", type: "IMAGE", createdAt: "2026-01-02T00:00:00Z" }
    ],
    ...overrides
  };
}

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-1");
  const result = applyMapping(collection, record, context);
  context.assertAccountedFor();
  return { context, result };
}

function byTable(result: ReturnType<typeof map>["result"]) {
  return new Map(result.writes.map((write) => [write.table, write.rows]));
}

function assertValidColumns(result: ReturnType<typeof map>["result"]) {
  for (const write of result.writes) {
    for (const row of write.rows) {
      for (const key of Object.keys(row)) {
        assert.match(key, /^[A-Za-z_][A-Za-z0-9_]*$/, `${write.table}.${key}`);
      }
    }
  }
}

test("mapping registry contains only reviewed collections", () => {
  assert.deepEqual(Object.keys(MAPPINGS).sort(), [
    "achievements",
    "admin_audit_logs",
    "admin_moderation_actions",
    "admin_sessions",
    "admin_users",
    "app_config",
    "assets",
    "auth_sessions",
    "battle_pass_xp_grants",
    "battle_passes",
    "blocks",
    "bond_points",
    "bond_ranking_snapshots",
    "bond_requests",
    "bond_rewards",
    "bonds",
    "chat_messages",
    "clan_invites",
    "clan_messages",
    "clans",
    "conversation_mutes",
    "cosmetics",
    "countdown_events",
    "creator_payout_kycs",
    "daily_questions",
    "device_tokens",
    "diamond_transactions",
    "direct_messages",
    "events",
    "face_verification_submissions",
    "follows",
    "friend_match_requests",
    "friendships",
    "gift_collections",
    "gift_inventories",
    "gift_transactions",
    "gifts",
    "group_chats",
    "group_messages",
    "immersive_themes",
    "likes",
    "matches",
    "media_objects",
    "media_quota_reservations",
    "media_upload_sessions",
    "mini_game_challenges",
    "mini_game_scores",
    "missions",
    "moderation_actions",
    "moderation_queues",
    "notification_campaigns",
    "notifications",
    "payout_reviews",
    "pk_battles",
    "pk_events",
    "pk_invites",
    "pk_leaderboard_entries",
    "pk_participants",
    "pk_votes",
    "polls",
    "profile_visits",
    "purchases",
    "referrals",
    "relationships",
    "reports",
    "room_activities",
    "room_follows",
    "room_invites",
    "room_mode_states",
    "room_participants",
    "room_reactions",
    "room_recordings",
    "rooms",
    "seasons",
    "speaker_requests",
    "stories",
    "story_comments",
    "story_highlights",
    "subscriptions",
    "support_messages",
    "support_tickets",
    "trust_verifications",
    "user_daily_answers",
    "user_missions",
    "user_moods",
    "user_safety_statuses",
    "users",
    "vibe_graphs",
    "voice_polls",
    "voice_verification_submissions",
    "wallet_transactions",
    "watch_parties",
    "wave_nudges",
    "wishlist_items",
    "withdrawal_requests",
    "xp_daily_caps",
    "xp_grants"
  ]);
  assert.equal(getMapping("unknown_collection"), undefined);
  assert.throws(() => applyMapping("unknown_collection", {}, new TransformContext("snap")), /No reviewed transform mapping/);
});

test("users mapping writes integer money/flags, UTC dates and normalized child tables", () => {
  const { context, result } = map("users", validUser());
  assert.equal(result.rejected, false);
  assert.deepEqual(context.quarantine, []);
  assertValidColumns(result);
  const tables = byTable(result);
  const user = tables.get("users")![0];
  assert.equal(user.source_id, USER_ID);
  assert.equal(user.wallet_balance, 250);
  assert.equal(user.diamond_balance, 10);
  assert.equal(user.is_verified, 1);
  assert.equal(user.created_at, "2026-01-02T03:04:05.000Z");
  assert.equal(user.updated_at, "2026-01-03T00:00:00.000Z");
  assert.deepEqual(tables.get("user_interests"), [
    { source_id: `${USER_ID}:interests:0`, value: "music", users_id: USER_ID, position: 0 },
    { source_id: `${USER_ID}:interests:1`, value: "travel", users_id: USER_ID, position: 1 }
  ]);
  assert.equal(tables.get("user_badge_grants")![0].badge_id, "badge-1");
  assert.equal(tables.get("user_badge_grants")![0].earned_at, "2026-01-01T00:00:00.000Z");
  assert.equal(tables.get("user_claimed_achievement_tiers")![0].tier, "SILVER");
  assert.equal(tables.get("user_profile_media")![0].type, "IMAGE");
  assert.deepEqual(context.report().collections.users, { source: 1, transformed: 1, quarantined: 0 });
});

test("users mapping rejects critical field failures without emitting a row", () => {
  const { context, result } = map("users", validUser({ name: "", walletBalance: 1.5, role: "OWNER" }));
  assert.equal(result.rejected, true);
  assert.equal(result.writes.length, 0);
  assert.deepEqual(
    context.quarantine.map((entry) => entry.reason),
    ["MISSING_REQUIRED", "UNKNOWN_ENUM", "NON_INTEGER_MONEY"]
  );
  assert.deepEqual(context.report().collections.users, { source: 1, transformed: 0, quarantined: 1 });
});

test("a bad child element is quarantined softly and does not reject the parent row", () => {
  const { context, result } = map("users", validUser({ interests: ["music", ""] }));
  const tables = byTable(result);
  assert.equal(result.rejected, false);
  assert.equal(tables.get("user_interests")!.length, 1);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED"]);
  assert.deepEqual(context.report().collections.users, { source: 1, transformed: 1, quarantined: 0 });
});

test("auth sessions preserve refresh-rotation state as canonical IDs and UTC dates", () => {
  const { context, result } = map("auth_sessions", {
    _id: USER_ID,
    userId: OTHER_ID,
    familyId: "family-1",
    refreshHash: "hash-1",
    tokenVersion: 3,
    expiresAt: "2026-02-01T00:00:00Z",
    revokedAt: null,
    lastUsedAt: 1767323045000,
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = byTable(result).get("auth_sessions")![0];
  assert.equal(result.rejected, false);
  assert.equal(row.user_id, OTHER_ID);
  assert.equal(row.token_version, 3);
  assert.equal(row.token_version_present, 1);
  assert.equal(row.expires_at, "2026-02-01T00:00:00.000Z");
  assert.equal(row.last_used_at, "2026-01-02T03:04:05.000Z");
  assert.equal(row.revoked_at, null);
  assertValidColumns(result);
  assert.deepEqual(context.quarantine, []);
});

test("auth session mapping keeps an absent generation distinct from null and zero", () => {
  const base = {
    _id: USER_ID, userId: OTHER_ID, familyId: "family-1", refreshHash: "hash-1",
    expiresAt: "2026-02-01T00:00:00Z", lastUsedAt: "2026-01-02T03:04:05Z"
  };
  for (const [record, version, present] of [
    [base, null, 0], [{ ...base, tokenVersion: null }, null, 1], [{ ...base, tokenVersion: 0 }, 0, 1]
  ] as const) {
    const { context, result } = map("auth_sessions", record);
    assert.equal(result.rejected, false);
    assert.deepEqual(context.quarantine, []);
    const row = byTable(result).get("auth_sessions")![0];
    assert.equal(row.token_version, version);
    assert.equal(row.token_version_present, present);
  }
});

test("wallet transactions quarantine invalid money and serialize metadata deterministically", () => {
  const base = {
    _id: USER_ID,
    userId: OTHER_ID,
    type: "CREDIT",
    source: "RECHARGE",
    amount: 500,
    balanceBefore: 0,
    balanceAfter: 500,
    metadata: { z: 1, a: { idempotencyKey: "key-1" } }
  };
  const { context, result } = map("wallet_transactions", base);
  const row = byTable(result).get("wallet_transactions")![0];
  assert.equal(result.rejected, false);
  assert.equal(row.amount, 500);
  assert.equal(row.balance_after, 500);
  assert.equal(row.metadata, '{"a":{"idempotencyKey":"key-1"},"z":1}');

  const bad = map("wallet_transactions", { ...base, amount: -5, source: "MINT" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(
    bad.context.quarantine.map((entry) => entry.reason),
    ["UNKNOWN_ENUM", "NEGATIVE_MONEY"]
  );
  assert.deepEqual(bad.context.report().collections.wallet_transactions, { source: 1, transformed: 0, quarantined: 1 });
});

test("admin users map permissions into a child table and keep audit-relevant state", () => {
  const { result } = map("admin_users", {
    _id: USER_ID,
    email: "admin@example.test",
    displayName: "Admin",
    role: "FINANCE_MANAGER",
    status: "ACTIVE",
    permissions: ["users.read", "payouts.write"],
    isSuperAdmin: false,
    twoFactorEnabled: true,
    lastLoginAt: "2026-01-02T03:04:05Z"
  });
  const tables = byTable(result);
  assert.equal(result.rejected, false);
  assert.equal(tables.get("admin_users")![0].role, "FINANCE_MANAGER");
  assert.equal(tables.get("admin_users")![0].two_factor_enabled, 1);
  assert.deepEqual(tables.get("admin_role_permissions")!.map((row) => row.value), ["users.read", "payouts.write"]);
  assertValidColumns(result);
});

test("media objects preserve string IDs, canonical R2 references and variants", () => {
  const { result, context } = map("media_objects", {
    _id: MEDIA_ID,
    ownerType: "USER",
    ownerId: USER_ID,
    mediaType: "IMAGE",
    category: "AVATAR",
    bucket: "public-media",
    storageKey: "users/avatar.webp",
    contentType: "image/webp",
    fileSize: 4096,
    checksum: "abc123",
    visibility: "PUBLIC",
    processingStatus: "READY",
    moderationStatus: "APPROVED",
    version: 1,
    createdBy: USER_ID,
    variants: [
      { name: "avatar_256", bucket: "public-media", key: "users/avatar_256.webp", contentType: "image/webp", bytes: 1024, width: 256, height: 256 }
    ]
  });
  const tables = byTable(result);
  assert.equal(result.rejected, false);
  assert.equal(tables.get("media_objects")![0].source_id, MEDIA_ID);
  assert.equal(tables.get("media_objects")![0].storage_key, "users/avatar.webp");
  assert.equal(tables.get("media_objects")![0].file_size, 4096);
  const variant = tables.get("media_variants")![0];
  assert.equal(variant.source_id, `${MEDIA_ID}:variants:0`);
  assert.equal(variant.media_objects_id, MEDIA_ID);
  assert.equal(variant.bytes, 1024);
  assert.deepEqual(context.quarantine, []);
});

test("media sessions and quota reservations preserve string IDs and non-negative byte counts", () => {
  const session = map("media_upload_sessions", {
    _id: "session-1",
    userId: USER_ID,
    category: "AVATAR",
    expectedContentType: "image/webp",
    expectedBytes: 2048,
    ownerType: "USER",
    ownerId: USER_ID,
    bucket: "staging",
    stagingKey: "staging/session-1",
    status: "PENDING",
    expiresAt: "2026-02-01T00:00:00Z",
    attempts: 0,
    quotaReserved: true
  });
  assert.equal(session.result.rejected, false);
  assert.equal(byTable(session.result).get("media_upload_sessions")![0].source_id, "session-1");
  assert.equal(byTable(session.result).get("media_upload_sessions")![0].quota_reserved, 1);

  const quota = map("media_quota_reservations", { _id: USER_ID, bytes: 4096, updatedAt: "2026-01-02T00:00:00Z" });
  assert.equal(byTable(quota.result).get("media_quota_reservations")![0].bytes, 4096);
  const badQuota = map("media_quota_reservations", { _id: USER_ID, bytes: -1 });
  assert.equal(badQuota.result.rejected, true);
  assert.deepEqual(badQuota.context.quarantine.map((entry) => entry.reason), ["OUT_OF_RANGE"]);
});

class MemoryTarget implements TargetWriter {
  readonly writes = new Map<string, TargetRow[]>();
  async write(table: string, rows: readonly TargetRow[]) {
    this.writes.set(table, [...(this.writes.get(table) || []), ...rows]);
  }
}

class MemoryCheckpoints implements CheckpointStore {
  readonly map = new Map<string, Checkpoint>();
  async load(key: string) { return this.map.get(key); }
  async save(key: string, checkpoint: Checkpoint) { this.map.set(key, checkpoint); }
}

class BatchSource implements SnapshotSource {
  constructor(private readonly batches: SourceRecord[][]) {}
  async *readCollectionBatches() {
    for (const batch of this.batches) yield batch;
  }
}

const SNAPSHOT: SnapshotManifest = {
  snapshotId: "snap-1",
  sourceDatabase: "Yugm",
  watermark: "2026-11-22T00:00:00.000Z",
  toolVersion: "test",
  createdAt: "2026-11-22T00:00:00.000Z",
  collections: [{
    name: "users",
    count: 2,
    batches: [
      { index: 0, count: 1, bytes: 10, checksum: "batch-0" },
      { index: 1, count: 1, bytes: 10, checksum: "batch-1" }
    ]
  } satisfies CollectionSnapshot]
};

test("mapped importer writes root and child tables, is replay-safe and honors dry run", async () => {
  const batches: SourceRecord[][] = [
    [validUser()],
    [validUser({ _id: OTHER_ID, username: "second", interests: [] })]
  ];
  const target = new MemoryTarget();
  const checkpoints = new MemoryCheckpoints();
  const base = {
    snapshot: SNAPSHOT,
    collection: "users",
    source: new BatchSource(batches),
    target,
    checkpoints,
    dryRun: false
  };

  // Use real checksums so the importer's manifest verification passes.
  const patched: SnapshotManifest = {
    ...SNAPSHOT,
    collections: [{ ...SNAPSHOT.collections[0], batches: batches.map((batch, index) => ({ index, count: batch.length, bytes: 10, checksum: checksum(batch) })) }]
  };

  const dryRun = await importMappedCollection({ ...base, snapshot: patched, dryRun: true });
  assert.equal(dryRun.processed, 2);
  assert.equal(target.writes.size, 0);
  assert.equal(checkpoints.map.size, 0);

  const first = await importMappedCollection({ ...base, snapshot: patched });
  assert.equal(first.processed, 2);
  assert.equal(first.checkpointStatus, "complete");
  assert.equal(target.writes.get("users")!.length, 2);
  assert.equal(target.writes.get("user_interests")!.length, 2);

  const replay = await importMappedCollection({ ...base, snapshot: patched });
  assert.equal(replay.batchesSkipped, 2);
  assert.equal(target.writes.get("users")!.length, 2);
});
