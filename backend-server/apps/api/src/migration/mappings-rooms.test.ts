import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const A = "507f1f77bcf86cd799439011";
const B = "507f1f77bcf86cd799439012";
const C = "507f1f77bcf86cd799439013";
const ROOM = "507f1f77bcf86cd799439014";
const POLL = "507f1f77bcf86cd799439015";
const STATE = "507f1f77bcf86cd799439016";

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-rooms");
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

test("rooms keep enums, integer state and canonicalized JSON role arrays", () => {
  const { result, context } = map("rooms", {
    _id: ROOM, title: "Live Room", type: "VOICE", hostId: A,
    category: "chat", tags: ["music", "talk"], language: "en",
    status: "LIVE", visibility: "PUBLIC", maxSpeakers: 8, participantCount: 2,
    speakerIds: [A], moderatorIds: [B], roomAdminIds: [], coHostIds: [C],
    isDuet: false, livekitRoomName: "room-1", allowAudienceMicRequests: true,
    micLocked: false, lockedSeatIndices: [1, 3], vipOnly: false,
    mode: "coffee_date", startedAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "rooms")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.type, "VOICE");
  assert.equal(row.status, "LIVE");
  assert.equal(row.host_id, A);
  assert.equal(row.tags, '["music","talk"]');
  assert.equal(row.speaker_ids, JSON.stringify([A]));
  assert.equal(row.co_host_ids, JSON.stringify([C]));
  assert.equal(row.locked_seat_indices, "[1,3]");
  assert.equal(row.allow_audience_mic_requests, 1);
  assert.equal(row.mic_locked, 0);
  assert.deepEqual(context.quarantine, []);
  assertColumns(result);

  const bad = map("rooms", { _id: ROOM, title: "x", type: "TEXT", hostId: A, category: "c", language: "en", livekitRoomName: "room-bad" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("room participants keep seat/role state and joinedAt", () => {
  const { result } = map("room_participants", {
    _id: A, roomId: ROOM, userId: B, role: "SPEAKER", micEnabled: true,
    moderatorMuted: false, seatIndex: 2, cameraEnabled: true,
    joinedAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "room_participants")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.role, "SPEAKER");
  assert.equal(row.seat_index, 2);
  assert.equal(row.mic_enabled, 1);
  assert.equal(row.joined_at, "2026-01-02T03:04:05.000Z");

  const bad = map("room_participants", { _id: A, roomId: ROOM, userId: B, role: "GUEST", joinedAt: "2026-01-01T00:00:00Z" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("room invites, follows and speaker requests preserve party refs and status", () => {
  const invite = map("room_invites", { _id: A, roomId: ROOM, inviterId: B, inviteeId: C, status: "ACCEPTED" });
  assert.equal(invite.result.rejected, false);
  assert.deepEqual([table(invite.result, "room_invites")[0].inviter_id, table(invite.result, "room_invites")[0].invitee_id], [B, C]);

  const follow = map("room_follows", { _id: A, roomId: ROOM, userId: B, createdAt: "2026-01-02T03:04:05Z" });
  assert.equal(follow.result.rejected, false);
  assert.equal(table(follow.result, "room_follows")[0].user_id, B);

  const request = map("speaker_requests", { _id: A, roomId: ROOM, userId: B, status: "PENDING" });
  assert.equal(request.result.rejected, false);
  assert.equal(table(request.result, "speaker_requests")[0].status, "PENDING");

  const bad = map("room_invites", { _id: A, roomId: ROOM, inviterId: B, inviteeId: C, status: "MAYBE" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("room mode states keep deterministic score JSON and participant children", () => {
  const { result, context } = map("room_mode_states", {
    _id: STATE, roomId: ROOM, mode: "truth_or_dare", round: 2, status: "ACTIVE",
    scores: { [A]: 5, [B]: 3 }, currentTurnUserId: A, currentQuestion: "Pick one",
    currentOptions: ["one", "two"], participants: [A, "bad-id"],
    roundStartTime: "2026-01-02T03:04:05Z", metadata: { z: 1, a: 2 }
  });
  const row = table(result, "room_mode_states")[0];
  const participants = table(result, "room_mode_participants");
  assert.equal(result.rejected, false);
  assert.equal(row.scores, JSON.stringify({ [A]: 5, [B]: 3 }));
  assert.equal(row.current_options, '["one","two"]');
  assert.equal(row.metadata, '{"a":2,"z":1}');
  assert.equal(participants.length, 1);
  assert.equal(participants[0].value, A);
  assert.equal(participants[0].room_mode_states_id, STATE);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["INVALID_ID"]);
  assertColumns(result);

  const bad = map("room_mode_states", { _id: STATE, roomId: ROOM, mode: "speed_date" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("room reactions keep string IDs, asset provenance and access enum", () => {
  const { result } = map("room_reactions", {
    _id: "heart-1", label: "Heart", emoji: "❤", assetUrl: "https://cdn.test/h.png",
    assetStorageKey: "reactions/heart.png", assetKind: "ANIMATED", mimeType: "image/png",
    access: "VIP_EXCLUSIVE", isActive: true, sortOrder: 3, createdBy: A,
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "room_reactions")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.source_id, "heart-1");
  assert.equal(row.asset_kind, "ANIMATED");
  assert.equal(row.access, "VIP_EXCLUSIVE");
  assert.equal(row.sort_order, 3);
  assert.equal(row.is_active, 1);

  const bad = map("room_reactions", { _id: "X", label: "x", access: "ALL", emoji: "" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("room activities and recordings preserve refs, counters and JSON metadata", () => {
  const activity = map("room_activities", {
    _id: A, roomId: ROOM, userId: B, type: "GIFT", label: "sent a gift",
    metadata: { giftId: C }, createdAt: "2026-01-02T03:04:05Z"
  });
  assert.equal(activity.result.rejected, false);
  assert.equal(table(activity.result, "room_activities")[0].metadata, '{"giftId":"507f1f77bcf86cd799439013"}');

  const recording = map("room_recordings", {
    _id: A, roomId: ROOM, hostId: B, title: "Replay",
    recordingUrl: "https://cdn.test/r.mp4", duration: 90, viewCount: 4, status: "PUBLISHED"
  });
  const row = table(recording.result, "room_recordings")[0];
  assert.equal(recording.result.rejected, false);
  assert.equal(row.duration, 90);
  assert.equal(row.view_count, 4);
  assert.equal(row.status, "PUBLISHED");

  const bad = map("room_recordings", { _id: A, roomId: ROOM, hostId: B, title: "x", recordingUrl: "u", status: "READY" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("polls keep option JSON with integer votes and voter children", () => {
  const { result, context } = map("polls", {
    _id: POLL, roomId: ROOM, createdBy: A, question: "Which one?",
    options: [{ text: "one", votes: 2 }, { text: "two", votes: 0 }],
    voters: [B, C], isActive: true, createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "polls")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.options, '[{"text":"one","votes":2},{"text":"two","votes":0}]');
  assert.deepEqual(table(result, "poll_votes").map((vote) => vote.value), [B, C]);
  assert.equal(table(result, "poll_votes")[0].polls_id, POLL);
  assert.equal(row.is_active, 1);
  assert.deepEqual(context.quarantine, []);
  assertColumns(result);

  const bad = map("polls", { _id: POLL, roomId: ROOM, createdBy: A, question: "q", options: [{ text: "", votes: 1 }] });
  assert.equal(bad.result.rejected, false);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED"]);
});

test("voice polls keep option JSON, voter and ballot children", () => {
  const { result, context } = map("voice_polls", {
    _id: POLL, userId: A, question: "Voice poll", audioUrl: "", duration: 12,
    options: [{ text: "one", votes: 1 }, { text: "two", audioUrl: "https://cdn.test/o.mp3", votes: 0 }],
    voters: [B], ballots: [{ userId: B, optionIndex: 0 }, { userId: "bad-id", optionIndex: 1 }],
    isActive: true, expiresAt: "2026-02-01T00:00:00Z"
  });
  const row = table(result, "voice_polls")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.audio_url, "");
  assert.equal(row.options, '[{"text":"one","votes":1},{"audioUrl":"https://cdn.test/o.mp3","text":"two","votes":0}]');
  assert.deepEqual(table(result, "voice_poll_votes").map((vote) => vote.value), [B]);
  const ballots = table(result, "voice_poll_ballots");
  assert.equal(ballots.length, 1);
  assert.equal(ballots[0].user_id, B);
  assert.equal(ballots[0].option_index, 0);
  assert.equal(ballots[0].voice_polls_id, POLL);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["INVALID_ID"]);
  assertColumns(result);

  const bad = map("voice_polls", { _id: POLL, userId: A, question: "q", options: "not-an-array" });
  assert.equal(bad.result.rejected, false);
  assert.equal(table(bad.result, "voice_polls")[0].options, "[]");
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["INVALID_REFERENCE"]);
});

test("room mappings are reachable through the registry", () => {
  for (const collection of [
    "rooms", "room_participants", "room_invites", "room_follows", "room_mode_states",
    "room_reactions", "room_activities", "room_recordings", "speaker_requests", "polls", "voice_polls"
  ]) {
    assert.equal(typeof getMapping(collection), "function", collection);
  }
});
