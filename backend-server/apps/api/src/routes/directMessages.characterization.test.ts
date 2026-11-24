import assert from "node:assert/strict";
import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { socketEvents } from "@yugm/shared";
import jwt from "jsonwebtoken";
import { MongoMemoryReplSet } from "mongodb-memory-server";
import mongoose from "mongoose";

type Message = {
  _id: string;
  message: string;
  senderId: { _id: string };
  receiverId: { _id: string };
  read: boolean;
  createdAt: string;
};
type SendResult = {
  message: Message;
  relationship: { xp: number };
  xpGrant: { event: string; xpAwarded: number };
};

test("direct-message persistence, retry, history, privacy and read receipt contract", async (t) => {
  const database = await MongoMemoryReplSet.create({
    replSet: { count: 1, storageEngine: "wiredTiger", ip: "127.0.0.1" }
  });
  const uri = database.getUri("yugm-direct-message-characterization");
  const jwtSecret = "local-direct-message-test-secret";
  process.env.NODE_ENV = "test";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = "yugm-direct-message-characterization";
  process.env.JWT_SECRET = jwtSecret;
  process.env.REDIS_URL = "";
  process.env.STORAGE_DRIVER = "mongodb";

  try {
    const [{ createApp }, { User }, { AuthSession }, { DirectMessage }, { Notification }, { XpGrant }, { BattlePassXpGrant }, { Block }, socket] =
      await Promise.all([
        import("../app.js"),
        import("../models/User.js"),
        import("../models/AuthSession.js"),
        import("../models/DirectMessage.js"),
        import("../models/Notification.js"),
        import("../models/XpGrant.js"),
        import("../models/BattlePassXpGrant.js"),
        import("../models/Block.js"),
        import("../services/socket.js")
      ]);
    await mongoose.connect(uri);
    const [sender, recipient, other] = await User.create([
      { name: "Sender", username: "dm_fixture_sender" },
      { name: "Recipient", username: "dm_fixture_recipient" },
      { name: "Other", username: "dm_fixture_other" }
    ]);
    const tokens = await Promise.all([sender, recipient].map(async (user) => {
      const session = await AuthSession.create({
        userId: user.id, familyId: user.id, refreshHash: user.id, tokenVersion: user.tokenVersion,
        expiresAt: new Date(Date.now() + 60_000)
      });
      return jwt.sign({ sub: user.id, sid: session.id, typ: "access", tokenVersion: user.tokenVersion },
        jwtSecret, { expiresIn: "1m" });
    }));
    const incoming = await DirectMessage.create({
      senderId: recipient.id, receiverId: sender.id, message: "Earlier reply",
      createdAt: new Date("2026-01-01T00:00:00Z")
    });
    const hidden = await DirectMessage.create({
      senderId: sender.id, receiverId: recipient.id, message: "Hidden message", hiddenFor: [recipient.id]
    });
    const unrelated = await DirectMessage.create({
      senderId: other.id, receiverId: recipient.id, message: "Different conversation"
    });

    const server = createServer(createApp());
    await socket.initSocket(server);
    const events: Array<{ name: string; rooms: string[]; payload: unknown }> = [];
    const visibleAtPublish: Array<Promise<unknown>> = [];
    const adapter = socket.io.of("/").adapter;
    t.mock.method(adapter, "broadcast", (...[packet, options]: Parameters<typeof adapter.broadcast>) => {
      const [name, payload] = packet.data ?? [];
      if (typeof name !== "string" || (!name.startsWith("direct:") && name !== socketEvents.notificationNew)) return;
      events.push({ name, rooms: [...options.rooms], payload });
      if (name === socketEvents.directMessageNew) visibleAtPublish.push(DirectMessage.exists({ _id: payload.message._id }).exec());
    });
    server.listen(0, "127.0.0.1");
    try {
      await once(server, "listening");
      const { port } = server.address() as AddressInfo;
      const base = `http://127.0.0.1:${port}/api/users/messages`;
      async function request<T>(actor: number, path: string, expectedStatus: number, payload?: object, method = "POST") {
        const response = await fetch(base + path, {
          method: payload === undefined ? "GET" : method,
          headers: { Authorization: `Bearer ${tokens[actor]}`, "Content-Type": "application/json" },
          ...(payload !== undefined && { body: JSON.stringify(payload) })
        });
        assert.equal(response.status, expectedStatus);
        return await response.json() as T;
      }
      const sendPath = `/${recipient.id}`;
      const readPath = `/${sender.id}/read`;
      const peerPath = `/${sender.id}`;
      const messageData = { message: "  Hello <world>  " };
      const sentIds: string[] = [];
      const recipients = () => events.map(({ name, rooms }) => [name, ...rooms]);

      await t.test("send persists before fan-out, marks the sender's incoming message, and records XP", async () => {
        const { ok, data } = await request<{ ok: boolean; data: SendResult }>(0, sendPath, 201, messageData);
        assert.equal(ok, true);
        const { message, relationship, xpGrant } = data;
        sentIds.push(message._id);
        assert.equal(message.message, "Hello world");
        assert.equal(message.senderId._id, sender.id);
        assert.equal(message.receiverId._id, recipient.id);
        assert.equal(message.read, false);
        assert.equal(relationship.xp, 8);
        assert.equal(xpGrant.event, "CHAT_MESSAGE");
        assert.equal(xpGrant.xpAwarded, 5);
        assert.equal((await User.findById(sender.id).lean())?.xp, 5);
        assert.ok(await XpGrant.exists({ userId: sender.id, event: "CHAT_MESSAGE", actionKey: `message:${message._id}`, status: "COMPLETE" }));
        assert.ok(await BattlePassXpGrant.exists({ userId: sender.id, actionKey: `CHAT_MESSAGE:message:${message._id}`, xpGained: 5 }));
        assert.equal((await DirectMessage.findById(incoming.id).lean())?.read, true);
        assert.equal((await DirectMessage.findById(message._id).lean())?.read, false);
        assert.deepEqual(recipients(), [
          [socketEvents.directMessageRead, `user:${recipient.id}`],
          ["direct:conversation:read", `user:${sender.id}`],
          [socketEvents.directMessageNew, `user:${recipient.id}`],
          [socketEvents.directMessageNew, `user:${sender.id}`],
          [socketEvents.notificationNew, `user:${recipient.id}`]
        ]);
        assert.deepEqual(events[2].payload, { message, partnerId: sender.id });
        assert.deepEqual(events[3].payload, { message, partnerId: recipient.id });
        assert.equal(visibleAtPublish.length, 2);
        assert.ok((await Promise.all(visibleAtPublish)).every(Boolean));
        assert.ok(await Notification.exists({ userId: recipient.id, "data.messageId": message._id }));
      });

      await t.test("an identical POST creates a separate message and a separate XP grant", async () => {
        events.length = 0;
        const { data } = await request<{ data: SendResult }>(0, sendPath, 201, messageData);
        assert.notEqual(data.message._id, sentIds[0]);
        sentIds.push(data.message._id);
        assert.equal(data.xpGrant.xpAwarded, 5);
        assert.equal(data.relationship.xp, 16);
        assert.equal(await DirectMessage.countDocuments({ _id: { $in: sentIds }, message: "Hello world" }), 2);
        assert.equal(await XpGrant.countDocuments({ userId: sender.id, event: "CHAT_MESSAGE", status: "COMPLETE" }), 2);
        assert.equal(await BattlePassXpGrant.countDocuments({ userId: sender.id }), 2);
        assert.equal(await Notification.countDocuments({ userId: recipient.id, "data.messageId": { $in: sentIds } }), 2);
        assert.deepEqual(recipients().map(([name]) => name), [
          socketEvents.directMessageNew, socketEvents.directMessageNew, socketEvents.notificationNew
        ]);
      });

      await t.test("passive history and older pages preserve unread state and omit hidden messages", async () => {
        events.length = 0;
        const { data } = await request<{ data: { messages: Message[] } }>(1, peerPath + "?markRead=false", 200);
        assert.deepEqual(data.messages.map((message) => message._id), [incoming.id, ...sentIds]);
        const future = encodeURIComponent(new Date(Date.now() + 60_000).toISOString());
        const page = await request<{ data: { messages: Message[]; hasMore: boolean; nextBefore: string } }>(
          1, peerPath + `?before=${future}&limit=1`, 200
        );
        assert.deepEqual(page.data.messages.map((message) => message._id), sentIds.slice(-1));
        assert.equal(page.data.hasMore, true);
        assert.equal(page.data.nextBefore, page.data.messages[0].createdAt);
        assert.equal(await DirectMessage.countDocuments({ _id: { $in: sentIds }, read: false }), 2);
        assert.deepEqual(events, []);
      });

      await t.test("read updates only visible inbound messages, and a repeat only echoes to the reader", async () => {
        events.length = 0;
        const { data } = await request<{ data: { updated: number; readThrough: string } }>(1, readPath, 200, {});
        assert.equal(data.updated, 2);
        assert.equal(await DirectMessage.countDocuments({ _id: { $in: sentIds }, read: true }), 2);
        assert.equal((await DirectMessage.findById(hidden.id).lean())?.read, false);
        assert.equal((await DirectMessage.findById(unrelated.id).lean())?.read, false);
        assert.deepEqual(events, [
          { name: socketEvents.directMessageRead, rooms: [`user:${sender.id}`], payload: { partnerId: recipient.id, readThrough: data.readThrough } },
          { name: "direct:conversation:read", rooms: [`user:${recipient.id}`], payload: { partnerId: sender.id, readThrough: data.readThrough } }
        ]);
        events.length = 0;
        const repeat = await request<{ data: { updated: number; readThrough: string } }>(1, readPath, 200, {});
        assert.equal(repeat.data.updated, 0);
        assert.deepEqual(events, [
          { name: "direct:conversation:read", rooms: [`user:${recipient.id}`], payload: { partnerId: sender.id, readThrough: repeat.data.readThrough } }
        ]);
      });

      await t.test("conversation mute suppresses the inbox notification and default history still marks the message read", async () => {
        await request(1, peerPath + "/mute", 200, { muted: true }, "PUT");
        events.length = 0;
        const { data } = await request<{ data: SendResult }>(0, sendPath, 201, { message: "Muted conversation" });
        assert.deepEqual(recipients(), [
          [socketEvents.directMessageNew, `user:${recipient.id}`],
          [socketEvents.directMessageNew, `user:${sender.id}`]
        ]);
        assert.equal(await Notification.exists({ "data.messageId": data.message._id }), null);

        events.length = 0;
        const history = await request<{ data: { messages: Message[] } }>(1, peerPath, 200);
        assert.equal(history.data.messages.find((message) => message._id === data.message._id)?.read, false);
        assert.equal((await DirectMessage.findById(data.message._id).lean())?.read, true);
        assert.equal((await DirectMessage.findById(hidden.id).lean())?.read, false);
        assert.deepEqual(recipients(), [[socketEvents.directMessageRead, `user:${sender.id}`]]);
      });

      await t.test("blocking denies new messages without storage or publish effects", async () => {
        await Block.create({ blockerId: recipient.id, blockedUserId: sender.id });
        events.length = 0;
        const before = await DirectMessage.countDocuments();
        const denied = await request<{ ok: boolean; error: { code: string; message: string } }>(0, sendPath, 403, messageData);
        assert.equal(denied.ok, false);
        assert.equal(denied.error.code, "FORBIDDEN");
        assert.equal(denied.error.message, "Cannot message this user");
        assert.equal(await DirectMessage.countDocuments(), before);
        assert.deepEqual(events, []);
      });
      await Promise.all(visibleAtPublish);
    } finally {
      await socket.closeSocketInfrastructure();
      await socket.io.close();
    }
  } finally {
    await mongoose.disconnect();
    await database.stop();
  }
});
