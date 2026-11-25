import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";

const id = () => randomBytes(12).toString("hex");
const placeholders = (count) => new Array(count).fill("?").join(", ");

export async function verifyD1Groups(db, request, owner, visitor, outsider) {
  const ownerId = owner.user.id;
  const visitorId = visitor.user.id;
  const outsiderId = outsider.user.id;
  const users = [ownerId, visitorId, outsiderId];

  async function cleanGroups() {
    const { results } = await db.prepare(`SELECT source_id FROM group_chats WHERE created_by IN (${placeholders(users.length)})
      OR source_id IN (SELECT group_chats_id FROM conversation_participants WHERE value IN (${placeholders(users.length)}))`)
      .bind(...users, ...users).all();
    const groups = results.map((row) => row.source_id);
    const statements = [];
    if (groups.length) {
      const marks = placeholders(groups.length);
      statements.push(
        db.prepare(`DELETE FROM group_messages WHERE group_id IN (${marks})`).bind(...groups),
        db.prepare(`DELETE FROM conversation_participants WHERE group_chats_id IN (${marks})`).bind(...groups),
        db.prepare(`DELETE FROM group_chats WHERE source_id IN (${marks})`).bind(...groups)
      );
    }
    if (statements.length) await db.batch(statements);
  }

  await cleanGroups();
  const originalVisitor = await db.prepare("SELECT avatar, avatar_type, avatar_parts_head FROM users WHERE source_id = ?")
    .bind(visitorId).first();
  try {
    await db.prepare("UPDATE users SET avatar = ?, avatar_type = ?, avatar_parts_head = ? WHERE source_id = ?")
      .bind("https://groups.fixture/visitor.png", "UPLOADED", 7, visitorId).run();

    const dummy = id();
    for (const path of ["/api/groups", `/api/groups/${dummy}/message`, `/api/groups/${dummy}/add`,
      `/api/groups/${dummy}/remove`, `/api/groups/${dummy}/leave`]) {
      await request(path, 401, { body: {} });
    }
    for (const path of ["/api/groups", `/api/groups/${dummy}`, `/api/groups/${dummy}/messages`]) {
      await request(path, 401);
    }

    assert.equal((await request("/api/groups", 422, {
      accessToken: owner.accessToken, body: { name: "x", participantIds: [visitorId] }
    })).error.code, "VALIDATION");
    assert.equal((await request("/api/groups/not-an-id", 400, { accessToken: owner.accessToken }))
      .error.message, "Invalid group ID");
    assert.equal((await request(`/api/groups/${id()}`, 404, { accessToken: owner.accessToken }))
      .error.message, "Group not found");

    const created = await request("/api/groups", 201, {
      accessToken: owner.accessToken,
      body: { name: "  Group chat  ", participantIds: [visitorId, visitorId] }
    });
    const group = created.data.group;
    const groupId = group._id;
    assert.equal(group.name, "Group chat");
    assert.equal(group.lastMessage, "");
    assert.equal(group.lastMessageAt, undefined);
    assert.equal(group.__v, 0);
    assert.ok(group.createdAt);
    assert.ok(group.updatedAt);
    assert.deepEqual(group.createdBy, { _id: ownerId, name: owner.user.name, username: owner.user.username });
    assert.deepEqual(group.participantIds.map((person) => person._id), [visitorId, ownerId]);
    assert.equal(group.participantIds[0].avatar, "https://groups.fixture/visitor.png");
    assert.equal(group.participantIds[0].avatarType, "UPLOADED");
    assert.deepEqual(group.participantIds[0].avatarParts, { head: 7 });
    assert.equal(group.participantIds[1].avatarParts, undefined);

    const ownerGroups = (await request("/api/groups", 200, { accessToken: owner.accessToken })).data.groups;
    assert.ok(ownerGroups.some((entry) => entry._id === groupId));
    const outsiderGroups = (await request("/api/groups", 200, { accessToken: outsider.accessToken })).data.groups;
    assert.ok(!outsiderGroups.some((entry) => entry._id === groupId));
    assert.equal((await request(`/api/groups/${groupId}`, 403, { accessToken: outsider.accessToken }))
      .error.message, "You are not a participant of this group");

    const detail = await request(`/api/groups/${groupId}`, 200, { accessToken: owner.accessToken });
    assert.equal(detail.data.messageCount, 0);

    assert.equal((await request(`/api/groups/${groupId}/message`, 422, {
      accessToken: owner.accessToken, body: { message: "" }
    })).error.code, "VALIDATION");
    const sent = await request(`/api/groups/${groupId}/message`, 201, {
      accessToken: owner.accessToken,
      body: { message: "  hello there  ", mediaUrl: "", mediaType: "IMAGE", duration: 3 }
    });
    assert.equal(sent.data.message.message, "hello there");
    assert.equal(sent.data.message.groupId, groupId);
    assert.deepEqual(sent.data.message.senderId, { _id: ownerId, name: owner.user.name, username: owner.user.username });
    assert.equal(sent.data.message.mediaType, "IMAGE");
    assert.equal(sent.data.message.duration, 3);
    assert.equal(sent.data.message.__v, 0);

    const afterMessage = await request(`/api/groups/${groupId}`, 200, { accessToken: owner.accessToken });
    assert.equal(afterMessage.data.messageCount, 1);
    assert.equal(afterMessage.data.group.lastMessage, "hello there");
    assert.ok(afterMessage.data.group.lastMessageAt);
    const messages = (await request(`/api/groups/${groupId}/messages?skip=0&limit=10`, 200,
      { accessToken: owner.accessToken })).data.messages;
    assert.equal(messages.length, 1);
    assert.equal(messages[0].message, "hello there");
    assert.equal((await request(`/api/groups/${groupId}/messages?skip=1&limit=1`, 200,
      { accessToken: owner.accessToken })).data.messages.length, 0);

    assert.equal((await request(`/api/groups/${groupId}/add`, 403, {
      accessToken: visitor.accessToken, body: { participantIds: [outsiderId] }
    })).error.message, "Only the group creator can add participants");
    assert.equal((await request(`/api/groups/${groupId}/add`, 422, {
      accessToken: owner.accessToken, body: { participantIds: ["bad"] }
    })).error.message, "Invalid participantIds");
    const unchanged = await request(`/api/groups/${groupId}/add`, 200, {
      accessToken: owner.accessToken, body: { participantIds: [visitorId] }
    });
    assert.equal(unchanged.data.group.participantIds.length, 2);
    const added = await request(`/api/groups/${groupId}/add`, 200, {
      accessToken: owner.accessToken, body: { participantIds: [outsiderId] }
    });
    assert.deepEqual(added.data.group.participantIds.map((person) => person._id), [visitorId, ownerId, outsiderId]);

    assert.equal((await request(`/api/groups/${groupId}/remove`, 403, {
      accessToken: visitor.accessToken, body: { userId: outsiderId }
    })).error.message, "Only the group creator can remove participants");
    assert.equal((await request(`/api/groups/${groupId}/remove`, 422, {
      accessToken: owner.accessToken, body: { userId: "bad" }
    })).error.message, "Invalid userId");
    assert.equal((await request(`/api/groups/${groupId}/remove`, 404, {
      accessToken: owner.accessToken, body: { userId: id() }
    })).error.message, "User not in group");
    assert.equal((await request(`/api/groups/${groupId}/remove`, 400, {
      accessToken: owner.accessToken, body: { userId: ownerId }
    })).error.message, "Creator cannot be removed");
    const removed = await request(`/api/groups/${groupId}/remove`, 200, {
      accessToken: owner.accessToken, body: { userId: outsiderId }
    });
    assert.deepEqual(removed.data.group.participantIds.map((person) => person._id), [visitorId, ownerId]);

    assert.equal((await request(`/api/groups/${groupId}/leave`, 200, {
      accessToken: visitor.accessToken, body: {}
    })).data.left, true);
    assert.ok(!(await request("/api/groups", 200, { accessToken: visitor.accessToken })).data.groups
      .some((entry) => entry._id === groupId));
    assert.equal((await request(`/api/groups/${groupId}/leave`, 200, {
      accessToken: owner.accessToken, body: {}
    })).data.left, true);
    await request(`/api/groups/${groupId}`, 404, { accessToken: owner.accessToken });
    const deleted = await db.prepare("SELECT source_id FROM group_messages WHERE group_id = ?").bind(groupId).all();
    assert.deepEqual(deleted.results, []);

    const transfer = await request("/api/groups", 201, {
      accessToken: owner.accessToken, body: { name: "Transfer group", participantIds: [visitorId, outsiderId] }
    });
    const transferId = transfer.data.group._id;
    await request(`/api/groups/${transferId}/remove`, 200, {
      accessToken: owner.accessToken, body: { userId: outsiderId }
    });
    const reapplied = await request(`/api/groups/${transferId}/add`, 200, {
      accessToken: owner.accessToken, body: { participantIds: [outsiderId] }
    });
    assert.deepEqual(reapplied.data.group.participantIds.map((person) => person._id),
      [visitorId, ownerId, outsiderId]);
    assert.equal((await request(`/api/groups/${transferId}/leave`, 200, {
      accessToken: owner.accessToken, body: {}
    })).data.left, true);
    const transferred = await request(`/api/groups/${transferId}`, 200, { accessToken: visitor.accessToken });
    assert.equal(transferred.data.group.createdBy._id, visitorId);
    await request(`/api/groups/${transferId}/leave`, 200, { accessToken: visitor.accessToken, body: {} });
    await request(`/api/groups/${transferId}/leave`, 200, { accessToken: outsider.accessToken, body: {} });
    const transferredRows = await db.prepare("SELECT source_id FROM group_chats WHERE source_id = ?")
      .bind(transferId).all();
    assert.deepEqual(transferredRows.results, []);
  } finally {
    if (originalVisitor) {
      await db.prepare("UPDATE users SET avatar = ?, avatar_type = ?, avatar_parts_head = ? WHERE source_id = ?")
        .bind(originalVisitor.avatar, originalVisitor.avatar_type, originalVisitor.avatar_parts_head, visitorId).run();
    }
    await cleanGroups();
  }
}
