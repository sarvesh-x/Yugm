import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { createServer } from "node:http";
import test from "node:test";
import { socketEvents } from "@yugm/shared";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

test("notification persistence, realtime fan-out, and FCM delivery contract", async (t) => {
  const database = await MongoMemoryServer.create();
  const uri = database.getUri("yugm-notifications-characterization");
  t.after(() => database.stop().then(() => undefined));
  process.env.NODE_ENV = "test";
  process.env.YUGM_RUNTIME = "cloudflare";
  process.env.MONGODB_URI = uri;
  process.env.MONGODB_DB_NAME = "yugm-notifications-characterization";
  process.env.REDIS_URL = "";
  process.env.FCM_PROJECT_ID = "yugm-notification-fixture";
  process.env.FCM_CLIENT_EMAIL = "test@example.test";
  process.env.FCM_PRIVATE_KEY = generateKeyPairSync("rsa", { modulusLength: 2048 })
    .privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  const [{ User }, { Notification }, { DeviceToken }, notifications, firebase, socket, admin, jobs] = await Promise.all([
    import("../models/User.js"),
    import("../models/Notification.js"),
    import("../models/DeviceToken.js"),
    import("./notifications.js"),
    import("./firebase.js"),
    import("./socket.js"),
    import("firebase-admin"),
    import("./jobs.js")
  ]);
  await mongoose.connect(uri);
  t.after(() => mongoose.disconnect());
  await firebase.initFirebase();
  const messaging = admin.default.messaging();
  t.after(() => admin.default.app().delete());
  await socket.initSocket(createServer());
  t.after(socket.closeSocketInfrastructure);

  const user = await User.create({ name: "Notification Fixture", username: "notice_fixture" });
  const registered = await DeviceToken.create({ userId: user._id, token: "fixture-device-token", platform: "android" });
  const adapter = socket.io.of("/").adapter;
  const effects: string[] = [];
  const persistedAtPush: Array<{ userId: string | undefined; read: boolean | undefined }> = [];
  const broadcast = t.mock.method(adapter, "broadcast", (..._args: Parameters<typeof adapter.broadcast>) => {
    effects.push("socket");
  });
  const send = t.mock.method(messaging, "sendEachForMulticast", async (...[message]: Parameters<typeof messaging.sendEachForMulticast>) => {
    effects.push("push");
    const stored = await Notification.findById(message.data?.notificationId).lean();
    persistedAtPush.push({ userId: stored?.userId.toString(), read: stored?.read });
    return { responses: [{ success: true, messageId: "fixture-send" }], successCount: 1, failureCount: 0 };
  });

  function reset() {
    effects.length = 0;
    persistedAtPush.length = 0;
    broadcast.mock.resetCalls();
    send.mock.resetCalls();
  }

  await t.test("stores the notification and publishes the existing socket and push payloads", async () => {
    const data = { messageId: "fixture-message", unread: 2, important: true, absent: null };
    const row = await notifications.createNotification(user.id, "MESSAGE", "New message", "Hello", data);
    assert.deepEqual((await Notification.findById(row.id).lean())?.data, data);
    assert.deepEqual(effects, ["socket", "push"]);
    assert.deepEqual(persistedAtPush, [{ userId: user.id, read: false }]);
    const [packet, options] = broadcast.mock.calls[0].arguments;
    assert.deepEqual([...options.rooms], [`user:${user.id}`]);
    assert.equal(packet.data[0], socketEvents.notificationNew);
    assert.equal(packet.data[1].notification._id, row.id);
    assert.deepEqual(send.mock.calls[0].arguments[0], {
      tokens: [registered.token],
      notification: { title: "New message", body: "Hello" },
      data: { messageId: "fixture-message", unread: "2", important: "true", notificationId: row.id }
    });
  });

  await t.test("disabled message and default-off marketing preferences retain inbox records only", async () => {
    reset();
    await User.updateOne({ _id: user._id }, { $set: { "notificationPreferences.messages": false } });
    const message = await notifications.createNotification(user.id, "MESSAGE", "Muted message", "Hello");
    const campaign = await notifications.createNotification(user.id, "SYSTEM", "Campaign", "Hello", { campaignId: "fixture-campaign" });
    assert.equal(await Notification.countDocuments({ _id: { $in: [message.id, campaign.id] }, read: false }), 2);
    assert.deepEqual(effects, []);
    await User.updateOne({ _id: user._id }, { $set: { "notificationPreferences.messages": true } });
  });

  await t.test("disabled Bonds pushes and users without registered devices still get socket delivery", async () => {
    reset();
    await User.updateOne({ _id: user._id }, { $set: { bondNotifications: false } });
    const row = await Notification.create({ userId: user._id, type: "SYSTEM", title: "Bond", body: "Hello", data: { type: "BONDS" } });
    assert.equal((await notifications.dispatchNotification(row)).id, row.id);
    assert.equal(await Notification.countDocuments({ _id: row._id }), 1);
    await DeviceToken.deleteOne({ _id: registered._id });
    await notifications.createNotification(user.id, "MESSAGE", "No device", "Hello");
    assert.deepEqual(effects, ["socket", "socket"]);
  });

  await t.test("a push failure neither rolls back the notification nor fails its caller", async () => {
    reset();
    await DeviceToken.create({ userId: user._id, token: "replacement-fixture-device", platform: "android" });
    send.mock.mockImplementationOnce(async () => {
      effects.push("push");
      throw new Error("fixture provider failure");
    });
    const row = await notifications.createNotification(user.id, "MESSAGE", "Provider unavailable", "Hello");
    assert.equal(await Notification.countDocuments({ _id: row._id, read: false }), 1);
    assert.deepEqual(effects, ["socket", "push"]);
  });

  await t.test("persistence failure prevents both transports", async () => {
    reset();
    await assert.rejects(notifications.createNotification(user.id, "MESSAGE", "", "Invalid title"), /title/);
    assert.deepEqual(effects, []);
  });

  await t.test("the alternate push dispatcher receives the original committed notification identity", async () => {
    reset();
    const queued: Parameters<typeof jobs.enqueuePushNotification>[0][] = [];
    await jobs.startJobWorkers({
      startLocalCron: false,
      async pushDispatcher(payload) {
        queued.push(payload);
        const stored = await Notification.findById(payload.data.notificationId).lean();
        persistedAtPush.push({ userId: stored?.userId.toString(), read: stored?.read });
      }
    });
    try {
      const row = await notifications.createNotification(user.id, "MESSAGE", "Queued", "Hello", { count: 2 });
      assert.deepEqual(effects, ["socket"]);
      assert.deepEqual(persistedAtPush, [{ userId: user.id, read: false }]);
      assert.deepEqual(queued, [{
        userId: user.id, title: "Queued", body: "Hello", data: { count: "2", notificationId: row.id }
      }]);
    } finally {
      await jobs.closeJobWorkers();
    }
  });
});
