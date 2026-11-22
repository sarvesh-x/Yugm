import assert from "node:assert/strict";
import { test } from "node:test";
import { applyMapping, getMapping } from "./mappings.js";
import { TransformContext } from "./transform.js";
import type { SourceRecord, TargetRow } from "./types.js";

const A = "507f1f77bcf86cd799439011";
const B = "507f1f77bcf86cd799439012";
const C = "507f1f77bcf86cd799439013";
const ROOM = "507f1f77bcf86cd799439014";
const MSG = "507f1f77bcf86cd799439015";
const CLAN = "507f1f77bcf86cd799439016";
const STORY = "507f1f77bcf86cd799439017";

function map(collection: string, record: SourceRecord) {
  const context = new TransformContext("snap-social");
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

test("friendships preserve both parties, status and nullable timestamps", () => {
  const { result, context } = map("friendships", {
    _id: MSG, userId: A, friendId: B, status: "ACCEPTED",
    createdAt: "2026-01-02T03:04:05Z", updatedAt: "2026-01-03T03:04:05Z"
  });
  const row = table(result, "friendships")[0];
  assert.equal(result.rejected, false);
  assert.deepEqual([row.user_id, row.friend_id, row.status], [A, B, "ACCEPTED"]);
  assert.equal(row.created_at, "2026-01-02T03:04:05.000Z");
  assert.deepEqual(context.quarantine, []);
  assertColumns(result);

  const bad = map("friendships", { _id: MSG, userId: A, friendId: B, status: "FRIEND" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("blocks and follows keep canonical directional refs", () => {
  const block = map("blocks", { _id: MSG, blockerId: A, blockedUserId: B, createdAt: "2026-01-02T03:04:05Z" });
  assert.equal(block.result.rejected, false);
  assert.deepEqual([table(block.result, "blocks")[0].blocker_id, table(block.result, "blocks")[0].blocked_user_id], [A, B]);

  const follow = map("follows", { _id: MSG, followerId: A, followingId: B, createdAt: "2026-01-02T03:04:05Z" });
  assert.equal(follow.result.rejected, false);
  assert.deepEqual([table(follow.result, "follows")[0].follower_id, table(follow.result, "follows")[0].following_id], [A, B]);

  const bad = map("follows", { _id: MSG, followerId: "bad-id", followingId: B });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["INVALID_ID"]);
});

test("clans keep deterministic JSON member ids and normalized roles", () => {
  const { result, context } = map("clans", {
    _id: CLAN, ownerId: A, name: "Test Clan", slug: "test-clan",
    privacy: "PRIVATE", familyLabel: "Squad", memberCount: 3,
    memberIds: [B, C],
    memberRoles: [{ userId: A, role: "LEADER" }, { userId: B }, { userId: "bad-id", role: "MEMBER" }],
    createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "clans")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.owner_id, A);
  assert.equal(row.member_ids, JSON.stringify([B, C]));
  assert.equal(row.member_roles, JSON.stringify([{ role: "LEADER", userId: A }, { role: "MEMBER", userId: B }]));
  assert.equal(row.member_count, 3);
  // The invalid role entry is soft-quarantined; the parent row is still kept.
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["INVALID_ID"]);
  assertColumns(result);

  const bad = map("clans", { _id: CLAN, ownerId: A, name: "C", slug: "c", privacy: "OPEN" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("direct messages preserve reply provenance, hidden-for and reaction children", () => {
  const { result, context } = map("direct_messages", {
    _id: MSG, senderId: A, receiverId: B, roomId: ROOM,
    message: "hello", mediaUrl: "", mediaType: "", duration: 0,
    replyTo: { messageId: C, author: "nick", authorId: C, text: "quote", mediaUrl: "" },
    forwarded: true, hiddenFor: [C], isEdited: true, editedAt: "2026-01-03T00:00:00Z",
    reactions: [
      { userId: A, type: "heart", createdAt: "2026-01-02T03:04:05Z" },
      { userId: B, type: "broadcast", createdAt: "2026-01-02T03:04:05Z" }
    ],
    read: false, createdAt: "2026-01-02T03:04:05Z"
  });
  const root = table(result, "direct_messages")[0];
  const hidden = table(result, "message_hidden_for")[0];
  const reactions = table(result, "direct_message_reactions");
  assert.equal(result.rejected, false);
  assert.equal(root.room_id, ROOM);
  assert.equal(root.forwarded, 1);
  assert.equal(root.is_edited, 1);
  assert.equal(root.read, 0);
  assert.equal(root.reply_to, JSON.stringify({ author: "nick", authorId: C, mediaUrl: "", messageId: C, text: "quote" }));
  assert.equal(hidden.value, C);
  assert.equal(hidden.direct_messages_id, MSG);
  assert.equal(reactions.length, 1);
  assert.equal(reactions[0].user_id, A);
  assert.equal(reactions[0].type, "heart");
  assert.equal(reactions[0].direct_messages_id, MSG);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
  assertColumns(result);

  const bad = map("direct_messages", { _id: MSG, senderId: A, receiverId: B, message: "x", mediaType: "GIF" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("chat messages keep type enum and optional media provenance", () => {
  const { result } = map("chat_messages", {
    _id: MSG, roomId: ROOM, senderId: A, message: "hi", type: "TEXT",
    mediaUrl: "https://cdn.test/a.png", mediaType: "IMAGE", createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "chat_messages")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.type, "TEXT");
  assert.equal(row.media_type, "IMAGE");
  assert.equal(row.media_url, "https://cdn.test/a.png");

  const bad = map("chat_messages", { _id: MSG, roomId: ROOM, senderId: A, message: "hi", type: "VOICE" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["UNKNOWN_ENUM"]);
});

test("conversation mutes require an updatedAt timestamp", () => {
  const { result } = map("conversation_mutes", {
    _id: MSG, ownerId: A, partnerId: B, muted: true, updatedAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "conversation_mutes")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.muted, 1);
  assert.equal(row.updated_at, "2026-01-02T03:04:05.000Z");

  const bad = map("conversation_mutes", { _id: MSG, ownerId: A, partnerId: B });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["INVALID_TIMESTAMP"]);
});

test("stories keep integer counters, status and viewed-by child rows", () => {
  const { result, context } = map("stories", {
    _id: STORY, userId: A, mediaUrl: "https://cdn.test/s.jpg", mediaType: "IMAGE",
    caption: "cap", duration: 30, likeCount: 2, replyCount: 1,
    expiresAt: "2026-02-01T00:00:00Z", status: "ACTIVE",
    viewedBy: [B, "bad-id"], createdAt: "2026-01-02T03:04:05Z"
  });
  const root = table(result, "stories")[0];
  const views = table(result, "story_views");
  assert.equal(result.rejected, false);
  assert.equal(root.like_count, 2);
  assert.equal(root.reply_count, 1);
  assert.equal(root.duration, 30);
  assert.equal(views.length, 1);
  assert.equal(views[0].value, B);
  assert.equal(views[0].stories_id, STORY);
  assert.deepEqual(context.quarantine.map((entry) => entry.reason), ["INVALID_ID"]);
  assertColumns(result);

  const bad = map("stories", { _id: STORY, userId: A, mediaUrl: "u", mediaType: "IMAGE", expiresAt: "bad" });
  assert.equal(bad.result.rejected, true);
  assert.deepEqual(bad.context.quarantine.map((entry) => entry.reason), ["INVALID_TIMESTAMP"]);
});

test("story highlights keep deterministic story-id JSON and quarantine non-arrays softly", () => {
  const { result, context } = map("story_highlights", {
    _id: STORY, userId: A, title: "Favorites", coverMediaUrl: "https://cdn.test/c.jpg",
    storyIds: [B, C], createdAt: "2026-01-02T03:04:05Z"
  });
  const row = table(result, "story_highlights")[0];
  assert.equal(result.rejected, false);
  assert.equal(row.story_ids, JSON.stringify([B, C]));
  assert.deepEqual(context.quarantine, []);

  const odd = map("story_highlights", { _id: STORY, userId: A, title: "Odd", storyIds: { not: "an array" } });
  assert.equal(odd.result.rejected, false);
  assert.equal(table(odd.result, "story_highlights")[0].story_ids, "[]");
  assert.deepEqual(odd.context.quarantine.map((entry) => entry.reason), ["INVALID_REFERENCE"]);
});

test("social mappings are reachable through the registry", () => {
  for (const collection of [
    "friendships", "blocks", "follows", "clans", "direct_messages",
    "chat_messages", "conversation_mutes", "stories", "story_highlights"
  ]) {
    assert.equal(typeof getMapping(collection), "function", collection);
  }
});
