import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping, MAPPINGS, ROOT_TABLES } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const USER = "507f1f77bcf86cd799439011";
const OTHER = "507f1f77bcf86cd799439012";
const CLAN = "507f1f77bcf86cd799439013";
const GROUP = "507f1f77bcf86cd799439014";
const STORY = "507f1f77bcf86cd799439015";
const COMMENT = "507f1f77bcf86cd799439016";
const ROOM = "507f1f77bcf86cd799439017";
const MESSAGE = "507f1f77bcf86cd799439018";
const stamped = { createdAt: "2026-01-02T03:04:05Z", updatedAt: "2026-01-03T00:00:00Z" };

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-messaging");
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

test("clan invites keep references, default status and UTC expiry", () => {
  const { result, context } = map("clan_invites", {
    _id: MESSAGE,
    clanId: CLAN,
    inviterId: USER,
    inviteeId: OTHER,
    expiresAt: "2026-01-03T00:00:00Z",
    ...stamped
  });
  const row = table(result, "clan_invites")[0];
  assert.equal(result.rejected, false);
  assert.deepEqual(context.quarantine, []);
  assert.equal(row.clan_id, CLAN);
  assert.equal(row.inviter_id, USER);
  assert.equal(row.invitee_id, OTHER);
  assert.equal(row.status, "PENDING");
  assert.equal(row.expires_at, "2026-01-03T00:00:00.000Z");
  assert.equal(row.created_at, "2026-01-02T03:04:05.000Z");
  assert.equal(row.updated_at, "2026-01-03T00:00:00.000Z");
  assertColumns(result);
});

test("clan invites reject an invalid status and a missing expiry", () => {
  const { result, context } = map("clan_invites", {
    _id: MESSAGE, clanId: CLAN, inviterId: USER, inviteeId: OTHER, status: "WAITING", expiresAt: "2026-01-03T00:00:00Z"
  });
  assert.equal(result.rejected, true);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);

  const missing = map("clan_invites", { _id: MESSAGE, clanId: CLAN, inviterId: USER, inviteeId: OTHER });
  assert.equal(missing.result.rejected, true);
  assert.deepEqual(missing.context.quarantine.map((entry) => entry.reason), ["INVALID_TIMESTAMP"]);
});

test("clan messages normalize reactions with enum, actor and UTC child state", () => {
  const { result, context } = map("clan_messages", {
    _id: MESSAGE,
    clanId: CLAN,
    senderId: USER,
    message: "Hello clan",
    reactions: [
      { userId: OTHER, type: "fire", createdAt: "2026-01-02T04:00:00Z" },
      { _id: "reaction-1", userId: USER, type: "clap", createdAt: "2026-01-02T05:00:00Z" }
    ],
    ...stamped
  });
  const row = table(result, "clan_messages")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.clan_id, CLAN);
  assert.equal(row.sender_id, USER);
  assert.equal(row.message, "Hello clan");
  assert.deepEqual(table(result, "clan_message_reactions"), [
    { source_id: `${MESSAGE}:reactions:0`, user_id: OTHER, type: "fire", created_at: "2026-01-02T04:00:00.000Z", clan_messages_id: MESSAGE, position: 0 },
    { source_id: "reaction-1", user_id: USER, type: "clap", created_at: "2026-01-02T05:00:00.000Z", clan_messages_id: MESSAGE, position: 1 }
  ]);
  assert.deepEqual(context.quarantine, []);
  assertColumns(result);
});

test("clan messages soft-quarantine bad reactions without dropping the parent", () => {
  const { result, context } = map("clan_messages", {
    _id: MESSAGE, clanId: CLAN, senderId: USER, message: "Hi",
    reactions: [
      { userId: OTHER, type: "BOGUS", createdAt: "2026-01-02T04:00:00Z" },
      { userId: "not-an-id", type: "fire", createdAt: "2026-01-02T04:00:00Z" }
    ]
  });
  assert.equal(result.rejected, false);
  assert.equal(table(result, "clan_messages").length, 1);
  assert.deepEqual(table(result, "clan_message_reactions"), []);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "INVALID_ID"]);
});

test("group chats normalize participant references into stable child rows", () => {
  const { result } = map("group_chats", {
    _id: GROUP,
    name: "Weekend plans",
    createdBy: USER,
    participantIds: [USER, OTHER],
    lastMessageAt: "2026-01-02T04:00:00Z",
    ...stamped
  });
  const row = table(result, "group_chats")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.name, "Weekend plans");
  assert.equal(row.created_by, USER);
  assert.equal(row.last_message, "");
  assert.equal(row.last_message_at, "2026-01-02T04:00:00.000Z");
  assert.deepEqual(table(result, "conversation_participants"), [
    { source_id: `${GROUP}:participantIds:0`, value: USER, group_chats_id: GROUP, position: 0 },
    { source_id: `${GROUP}:participantIds:1`, value: OTHER, group_chats_id: GROUP, position: 1 }
  ]);
  assertColumns(result);
});

test("group messages keep media defaults, enum and integer duration", () => {
  const { result } = map("group_messages", {
    _id: MESSAGE, groupId: GROUP, senderId: USER, message: "Photo", ...stamped
  });
  const row = table(result, "group_messages")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.group_id, GROUP);
  assert.equal(row.sender_id, USER);
  assert.equal(row.media_url, "");
  assert.equal(row.media_type, "");
  assert.equal(row.duration, 0);
  assert.equal(row.created_at, "2026-01-02T03:04:05.000Z");

  const full = map("group_messages", {
    _id: MESSAGE, groupId: GROUP, senderId: USER, message: "Clip",
    mediaUrl: "https://cdn.example/clip.mp4", mediaType: "VIDEO", duration: 42
  });
  const fullRow = table(full.result, "group_messages")[0];
  assert.equal(fullRow.media_type, "VIDEO");
  assert.equal(fullRow.duration, 42);
  assertColumns(result);
});

test("group messages reject an invalid media type and non-integer duration", () => {
  const { result, context } = map("group_messages", {
    _id: MESSAGE, groupId: GROUP, senderId: USER, message: "Clip", mediaType: "GIF", duration: 1.5
  });
  assert.equal(result.rejected, true);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM", "NON_INTEGER"]);
});

test("story comments preserve root null parents and reply references", () => {
  const root = map("story_comments", {
    _id: COMMENT, storyId: STORY, userId: USER, text: "Nice", ...stamped
  });
  const rootRow = table(root.result, "story_comments")[0];
  assert.equal(root.result.rejected, false);
  assert.equal(rootRow.story_id, STORY);
  assert.equal(rootRow.user_id, USER);
  assert.equal(rootRow.parent_id, null);
  assert.equal(rootRow.text, "Nice");

  const reply = map("story_comments", {
    _id: MESSAGE, storyId: STORY, userId: OTHER, parentId: COMMENT, text: "Thanks"
  });
  assert.equal(table(reply.result, "story_comments")[0].parent_id, COMMENT);
  assertColumns(root.result);
});

test("story comments require text and reject a malformed parent reference", () => {
  const empty = map("story_comments", { _id: COMMENT, storyId: STORY, userId: USER, text: "   " });
  assert.equal(empty.result.rejected, true);
  assert.deepEqual(empty.context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED"]);

  const badParent = map("story_comments", { _id: COMMENT, storyId: STORY, userId: USER, text: "Hi", parentId: "bad" });
  assert.equal(badParent.result.rejected, false);
  assert.deepEqual(badParent.context.quarantine.map((entry) => entry.reason), ["INVALID_ID"]);
});

test("watch parties keep playback defaults and 0/1 flags", () => {
  const { result } = map("watch_parties", {
    _id: ROOM, roomId: ROOM, hostId: USER, title: "Movie night", mediaUrl: "https://cdn.example/movie.mp4", ...stamped
  });
  const row = table(result, "watch_parties")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.room_id, ROOM);
  assert.equal(row.host_id, USER);
  assert.equal(row.title, "Movie night");
  assert.equal(row.position, 0);
  assert.equal(row.is_playing, 0);
  assert.equal(row.created_at, "2026-01-02T03:04:05.000Z");

  const playing = map("watch_parties", {
    _id: ROOM, roomId: ROOM, hostId: USER, title: "Live", mediaUrl: "https://cdn.example/live.mp4", position: 90, isPlaying: true
  });
  assert.equal(table(playing.result, "watch_parties")[0].is_playing, 1);
  assert.equal(table(playing.result, "watch_parties")[0].position, 90);
  assertColumns(result);
});

test("watch parties reject malformed playback state", () => {
  const { result, context } = map("watch_parties", {
    _id: ROOM, roomId: ROOM, hostId: USER, title: "", mediaUrl: "", position: 1.5, isPlaying: "yes"
  });
  assert.equal(result.rejected, true);
  assert.deepEqual(result.writes, []);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["MISSING_REQUIRED", "MISSING_REQUIRED", "NON_INTEGER", "INVALID_BOOLEAN"]);
});

test("registry exposes all six messaging/comment collections", () => {
  const collections = [
    ["clan_invites", "clan_invites"],
    ["clan_messages", "clan_messages"],
    ["group_chats", "group_chats"],
    ["group_messages", "group_messages"],
    ["story_comments", "story_comments"],
    ["watch_parties", "watch_parties"]
  ] as const;
  for (const [collection, table] of collections) {
    assert.equal(getMapping(collection), MAPPINGS[collection]);
    assert.equal(ROOT_TABLES[collection], table);
  }
});
