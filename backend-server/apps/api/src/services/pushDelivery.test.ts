import assert from "node:assert/strict";
import test from "node:test";
import { classifyPushResponses, deliverPushJob, type PushJobData } from "./pushDelivery.js";

test("classifies multicast outcomes and keeps only transient devices for retry", () => {
  assert.deepEqual(
    classifyPushResponses(["sent", "busy", "gone", "invalid", "rate-limited"], [
      { success: true },
      { success: false, error: { code: "messaging/server-unavailable" } },
      { success: false, error: { code: "messaging/registration-token-not-registered" } },
      { success: false, error: { code: "messaging/invalid-payload" } },
      { success: false, error: { code: "messaging/device-message-rate-exceeded" } }
    ]),
    {
      retryDeviceIds: ["busy", "rate-limited"],
      unregisteredDeviceIds: ["gone"],
      permanentFailures: 1
    }
  );
});

test("rejects a mismatched provider response instead of attributing it to other devices", () => {
  assert.throws(() => classifyPushResponses(["device"], []), /response count/);
});

const payload: PushJobData = {
  userId: "user",
  title: "Notification",
  body: "Test notification",
  data: { notificationId: "notification" }
};

test("saves retry targets before failing the job and sends only those targets on retry", async () => {
  const job = { data: payload, async updateData(data: PushJobData) { this.data = data; } };
  await assert.rejects(
    deliverPushJob(job, async () => ({ retryDeviceIds: ["busy"], permanentFailures: 0 })),
    /retryable device failures/
  );
  await deliverPushJob(job, async (data) => {
    assert.deepEqual(data, { ...payload, retryDeviceIds: ["busy"] });
    return { retryDeviceIds: [], permanentFailures: 0 };
  });
});

test("reports provider rejection without exposing provider details to the queue", async () => {
  const job = { data: payload, async updateData() { assert.fail("No retry target changes expected"); } };
  await assert.rejects(deliverPushJob(job, async () => {
    throw new Error("Provider detail");
  }), { message: "Push delivery attempt failed" });
});

test("fails the attempt when saving retry targets fails", async () => {
  const job = { data: payload, async updateData() { throw new Error("Storage detail"); } };
  await assert.rejects(
    deliverPushJob(job, async () => ({ retryDeviceIds: ["busy"], permanentFailures: 0 })),
    { message: "Could not save push retry targets" }
  );
});
