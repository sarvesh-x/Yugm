import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping, MAPPINGS, ROOT_TABLES } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const USER = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439012";
const ADMIN = "507f1f77bcf86cd799439013";
const GIFT = "507f1f77bcf86cd799439014";
const COLLECTION = "507f1f77bcf86cd799439015";
const BATTLE = "507f1f77bcf86cd799439016";
const ROOM = "507f1f77bcf86cd799439017";
const TRANSACTION = "507f1f77bcf86cd799439018";
const KYC = "507f1f77bcf86cd799439019";
const WITHDRAWAL = "507f1f77bcf86cd79943901a";
const TRUST = "507f1f77bcf86cd79943901b";
const MATCH = "507f1f77bcf86cd79943901c";
const EVENT = "507f1f77bcf86cd79943901d";
const VOTE = "507f1f77bcf86cd79943901e";
const stamped = { createdAt: "2026-01-02T03:04:05Z", updatedAt: "2026-01-03T00:00:00Z" };

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-final");
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

test("creator payout KYC keeps encrypted fields, defaults, integer flag and canonical metadata", () => {
  const { result, context } = map("creator_payout_kycs", {
    _id: KYC,
    userId: USER,
    legalFullName: "Aarav Sharma",
    dateOfBirth: "2000-01-02",
    panNumberEncrypted: "enc-pan",
    panLast4: "1234",
    panVerified: true,
    upiIdEncrypted: "enc-upi",
    upiIdMasked: "aarav@bank",
    bankAccountEncrypted: "enc-account",
    bankAccountLast4: "0001",
    bankIfsc: "ABCD0000001",
    bankHolderName: "Aarav Sharma",
    submittedAt: "2026-01-02T03:00:00Z",
    verifiedAt: "2026-01-03T03:00:00Z",
    reviewedByAdminId: ADMIN,
    metadata: { z: 1, a: 2 },
    ...stamped
  });
  const row = table(result, "creator_payout_kycs")[0];
  assert.equal(result.rejected, false);
  assert.deepEqual(context.quarantine, []);
  assert.equal(row.user_id, USER);
  assert.equal(row.pan_verified, 1);
  assert.equal(row.kyc_status, "NOT_SUBMITTED");
  assert.equal(row.payout_status, "DISABLED");
  assert.equal(row.date_of_birth, "2000-01-02T00:00:00.000Z");
  assert.equal(row.metadata, '{"a":2,"z":1}');
  assert.equal(row.created_at, "2026-01-02T03:04:05.000Z");
  assertColumns(result);

  const bad = map("creator_payout_kycs", {
    _id: KYC, userId: USER, kycStatus: "NOPE"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("friend match requests preserve required status and UTC expiry", () => {
  const { result } = map("friend_match_requests", {
    _id: MATCH,
    userId: USER,
    status: "MATCHED",
    matchedUserId: OTHER,
    roomId: ROOM,
    expiresAt: "2026-01-03T00:00:00Z",
    ...stamped
  });
  const row = table(result, "friend_match_requests")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.user_id, USER);
  assert.equal(row.status, "MATCHED");
  assert.equal(row.matched_user_id, OTHER);
  assert.equal(row.room_id, ROOM);
  assert.equal(row.expires_at, "2026-01-03T00:00:00.000Z");
  assertColumns(result);

  const bad = map("friend_match_requests", { _id: MATCH, userId: USER, status: "WAITING" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["INVALID_TIMESTAMP"]);
});

test("gifts keep defaults, nested limited edition, integer prices and canonical upgrade path", () => {
  const { result } = map("gifts", {
    _id: GIFT,
    name: "Rose",
    icon: "rose",
    coinPrice: 10,
    pkPoints: 2,
    diamondPrice: 1,
    category: "premium",
    bondPurpose: "ANNIVERSARY",
    bondKind: "years",
    bondPoints: 25,
    bondMinimumDays: 365,
    theme: "romance",
    rarity: "epic",
    limitedEdition: { active: true, total: 100, remaining: 42 },
    collectionId: COLLECTION,
    upgradePath: [GIFT],
    ...stamped
  });
  const row = table(result, "gifts")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.name, "Rose");
  assert.equal(row.coin_price, 10);
  assert.equal(row.pk_points, 2);
  assert.equal(row.effect3d, "");
  assert.equal(row.animation_key, "");
  assert.equal(row.category, "premium");
  assert.equal(row.rarity, "epic");
  assert.equal(row.limited_edition_active, 1);
  assert.equal(row.limited_edition_total, 100);
  assert.equal(row.limited_edition_remaining, 42);
  assert.equal(row.collection_id, COLLECTION);
  assert.equal(row.upgrade_path, JSON.stringify([GIFT]));
  assertColumns(result);

  // Source defaults these to null; the draft DDL's NOT NULL is a flagged schema issue.
  const defaults = map("gifts", {
    _id: GIFT, name: "Default", icon: "default", coinPrice: 1
  });
  assert.equal(defaults.result.rejected, false);
  assert.equal(table(defaults.result, "gifts")[0].expires_at, null);
  assert.equal(table(defaults.result, "gifts")[0].collection_id, null);

  const bad = map("gifts", { _id: GIFT, name: "Bad", icon: "bad", coinPrice: 0 });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["OUT_OF_RANGE"]);
});

test("matches normalize user references into stable child rows", () => {
  const { result } = map("matches", { _id: MATCH, users: [USER, OTHER], ...stamped });
  assert.equal(result.rejected, false);
  assert.deepEqual(table(result, "matches"), [
    { source_id: MATCH, created_at: "2026-01-02T03:04:05.000Z", updated_at: "2026-01-03T00:00:00.000Z" }
  ]);
  assert.deepEqual(table(result, "match_users"), [
    { source_id: `${MATCH}:users:0`, value: USER, matches_id: MATCH, position: 0 },
    { source_id: `${MATCH}:users:1`, value: OTHER, matches_id: MATCH, position: 1 }
  ]);
  assertColumns(result);

  const bad = map("matches", { _id: MATCH, users: USER });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED"]);
});

test("notifications keep type enum, canonical data JSON and integer read flag", () => {
  const { result } = map("notifications", {
    _id: EVENT,
    userId: USER,
    type: "GIFT",
    title: "Gift received",
    body: "A Rose",
    data: { z: 1, a: 2 },
    ...stamped
  });
  const row = table(result, "notifications")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.user_id, USER);
  assert.equal(row.type, "GIFT");
  assert.equal(row.read, 0);
  assert.equal(row.data, '{"a":2,"z":1}');
  assertColumns(result);

  const bad = map("notifications", {
    _id: EVENT, userId: USER, type: "UNKNOWN", title: "T", body: "B"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("notification campaigns preserve segments, counters, enums and canonical filters", () => {
  const { result } = map("notification_campaigns", {
    _id: EVENT,
    title: "City launch",
    body: "Coming soon",
    segment: "city",
    segmentValue: "Pune",
    filters: { z: 1, a: 2 },
    scheduledFor: "2026-01-04T00:00:00Z",
    createdBy: ADMIN,
    ...stamped
  });
  const row = table(result, "notification_campaigns")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.segment, "city");
  assert.equal(row.segment_value, "Pune");
  assert.equal(row.filters, '{"a":2,"z":1}');
  assert.equal(row.status, "DRAFT");
  assert.equal(row.sent_count, 0);
  assert.equal(row.delivered_count, 0);
  assert.equal(row.open_count, 0);
  assert.equal(row.click_count, 0);
  assert.equal(row.created_by, ADMIN);
  assertColumns(result);

  const bad = map("notification_campaigns", {
    _id: EVENT, title: "T", body: "B", segment: "everyone", createdBy: ADMIN
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("payout reviews keep explicit safety flags, risk score and canonical JSON columns", () => {
  const { result } = map("payout_reviews", {
    _id: EVENT,
    userId: USER,
    withdrawalRequestId: WITHDRAWAL,
    trustVerificationId: TRUST,
    creatorPayoutKycId: KYC,
    riskScore: 7,
    riskFlags: ["KYC_MISMATCH"],
    payout: { providerStatus: "SUCCESS", providerPayoutId: "pay-1" },
    reviewedByAdminId: ADMIN,
    ...stamped
  });
  const row = table(result, "payout_reviews")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.withdrawal_request_id, WITHDRAWAL);
  assert.equal(row.trust_verification_id, TRUST);
  assert.equal(row.creator_payout_kyc_id, KYC);
  assert.equal(row.status, "PENDING");
  assert.equal(row.trust_verified, 0);
  assert.equal(row.kyc_verified, 0);
  assert.equal(row.wallet_safe, 0);
  assert.equal(row.reports_safe, 0);
  assert.equal(row.fraud_safe, 0);
  assert.equal(row.risk_score, 7);
  assert.equal(row.risk_flags, '["KYC_MISMATCH"]');
  assert.equal(row.provider_payout_id, "pay-1");
  assert.equal(row.provider_status, "SUCCESS");
  assertColumns(result);

  const bad = map("payout_reviews", {
    _id: EVENT, userId: USER, withdrawalRequestId: WITHDRAWAL, status: "UNKNOWN"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("PK battles keep defaults, bounded integers, enums and UTC state timestamps", () => {
  const { result } = map("pk_battles", {
    _id: BATTLE,
    battleCode: "PK-1",
    mode: "GIFT",
    battleType: "VOICE",
    durationSeconds: 120,
    startedByUserId: USER,
    leftRoomId: ROOM,
    rightRoomId: ROOM,
    leftHostId: USER,
    rightHostId: OTHER,
    selectedGiftId: GIFT,
    countdownEndsAt: "2026-01-02T04:00:00Z",
    finalizedAt: "2026-01-02T05:00:00Z",
    winnerSide: "LEFT",
    winnerUserId: USER,
    startedAt: "2026-01-02T03:30:00Z",
    endedAt: "2026-01-02T03:32:00Z",
    ...stamped
  });
  const row = table(result, "pk_battles")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.battle_code, "PK-1");
  assert.equal(row.title, "");
  assert.equal(row.format, "ROOM");
  assert.equal(row.scope, "CROSS_ROOM");
  assert.equal(row.team_size, 1);
  assert.equal(row.status, "INVITED");
  assert.equal(row.duration_seconds, 120);
  assert.equal(row.selected_gift_id, GIFT);
  assert.equal(row.in_room_battle, 0);
  assert.equal(row.state_version, 1);
  assert.equal(row.event_sequence, 0);
  assert.equal(row.termination_reason, "");
  assert.equal(row.winner_side, "LEFT");
  assert.equal(row.countdown_ends_at, "2026-01-02T04:00:00.000Z");
  assertColumns(result);

  const bad = map("pk_battles", {
    _id: BATTLE, battleCode: "PK-2", mode: "GIFT", battleType: "VOICE",
    durationSeconds: 120, teamSize: 6, startedByUserId: USER,
    leftRoomId: ROOM, rightRoomId: ROOM, leftHostId: USER, rightHostId: OTHER
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["OUT_OF_RANGE"]);
});

test("PK events keep enums, counters and canonical metadata", () => {
  const { result } = map("pk_events", {
    _id: EVENT,
    battleId: BATTLE,
    roomId: ROOM,
    userId: USER,
    eventType: "GIFT_SENT",
    side: "LEFT",
    points: 25,
    stateVersion: 3,
    sequence: 2,
    giftTransactionId: TRANSACTION,
    metadata: { z: 1, a: 2 },
    ...stamped
  });
  const row = table(result, "pk_events")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.battle_id, BATTLE);
  assert.equal(row.event_type, "GIFT_SENT");
  assert.equal(row.side, "LEFT");
  assert.equal(row.points, 25);
  assert.equal(row.state_version, 3);
  assert.equal(row.sequence, 2);
  assert.equal(row.gift_transaction_id, TRANSACTION);
  assert.equal(row.metadata, '{"a":2,"z":1}');
  assertColumns(result);

  const bad = map("pk_events", { _id: EVENT, battleId: BATTLE, eventType: "UNKNOWN" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("PK invites keep all room/user references and default status", () => {
  const { result } = map("pk_invites", {
    _id: EVENT,
    battleId: BATTLE,
    inviterUserId: USER,
    inviteeUserId: OTHER,
    inviterRoomId: ROOM,
    inviteeRoomId: ROOM,
    expiresAt: "2026-01-03T00:00:00Z",
    respondedAt: "2026-01-02T04:00:00Z",
    ...stamped
  });
  const row = table(result, "pk_invites")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.inviter_user_id, USER);
  assert.equal(row.invitee_user_id, OTHER);
  assert.equal(row.inviter_room_id, ROOM);
  assert.equal(row.invitee_room_id, ROOM);
  assert.equal(row.status, "PENDING");
  assert.equal(row.expires_at, "2026-01-03T00:00:00.000Z");
  assert.equal(row.responded_at, "2026-01-02T04:00:00.000Z");
  assertColumns(result);

  const bad = map("pk_invites", {
    _id: EVENT, battleId: BATTLE, inviterUserId: USER, inviteeUserId: OTHER,
    inviterRoomId: ROOM, inviteeRoomId: ROOM, status: "WAITING", expiresAt: "2026-01-03T00:00:00Z"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("PK leaderboard entries keep side enum and integer totals", () => {
  const { result } = map("pk_leaderboard_entries", {
    _id: EVENT,
    battleId: BATTLE,
    userId: USER,
    side: "RIGHT",
    totalPoints: 125,
    totalGiftsSent: 4,
    ...stamped
  });
  const row = table(result, "pk_leaderboard_entries")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.side, "RIGHT");
  assert.equal(row.total_points, 125);
  assert.equal(row.total_gifts_sent, 4);
  assertColumns(result);

  const bad = map("pk_leaderboard_entries", {
    _id: EVENT, battleId: BATTLE, userId: USER, side: "DRAW"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("PK participants preserve joinedAt without inventing timestamps", () => {
  const { result } = map("pk_participants", {
    _id: EVENT,
    battleId: BATTLE,
    userId: USER,
    roomId: ROOM,
    side: "LEFT",
    role: "HOST",
    teamName: "A",
    joinedAt: "2026-01-02T03:00:00Z",
    leftAt: "2026-01-02T05:00:00Z"
  });
  const row = table(result, "pk_participants")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.is_ready, 0);
  assert.equal(row.team_name, "A");
  assert.equal(row.joined_at, "2026-01-02T03:00:00.000Z");
  assert.equal(row.left_at, "2026-01-02T05:00:00.000Z");
  assert.equal("created_at" in row, false);
  assert.equal("updated_at" in row, false);
  assertColumns(result);

  const bad = map("pk_participants", {
    _id: EVENT, battleId: BATTLE, userId: USER, roomId: ROOM, side: "LEFT", role: "HOST"
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["INVALID_TIMESTAMP"]);
});

test("PK votes keep unique voter side and room references", () => {
  const { result } = map("pk_votes", {
    _id: VOTE, battleId: BATTLE, voterId: USER, side: "LEFT", roomId: ROOM, ...stamped
  });
  const row = table(result, "pk_votes")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.battle_id, BATTLE);
  assert.equal(row.voter_id, USER);
  assert.equal(row.side, "LEFT");
  assert.equal(row.room_id, ROOM);
  assertColumns(result);

  const bad = map("pk_votes", {
    _id: VOTE, battleId: BATTLE, voterId: USER, side: "DRAW", roomId: ROOM
  });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("reviewed registry and root tables cover the same 97 collections", () => {
  assert.equal(Object.keys(MAPPINGS).length, 97);
  assert.equal(Object.keys(ROOT_TABLES).length, 97);
  for (const [collection, table] of Object.entries(ROOT_TABLES)) {
    assert.equal(typeof getMapping(collection), "function", collection);
    assert.equal(typeof table, "string", collection);
  }
});
