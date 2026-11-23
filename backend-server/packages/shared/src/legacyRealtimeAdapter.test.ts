import assert from "node:assert/strict";
import test from "node:test";
import { NATIVE_PROTOCOL_VERSION, requiredRealtimeEventNames, type NativeEnvelope } from "./realtimeProtocol.js";
import {
  SUPPORT_WINDOW_DAYS,
  classifyLegacyEvent,
  compatibilityCoverage,
  isLegacySupportActive,
  legacyAckToNativeAck,
  legacyCutoffFromGaDate,
  legacyScopeFromRouting,
  toLegacyEmit,
} from "./legacyRealtimeAdapter.js";

const GA = 1_700_000_000_000;

test("legacy cutoff is GA plus 90 days and the window closes at the boundary", () => {
  const cutoff = legacyCutoffFromGaDate(GA);
  assert.equal(cutoff - GA, SUPPORT_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  assert.equal(isLegacySupportActive(GA, cutoff), true);
  assert.equal(isLegacySupportActive(cutoff - 1, cutoff), true);
  assert.equal(isLegacySupportActive(cutoff, cutoff), false);
  assert.equal(isLegacySupportActive(cutoff + 1, cutoff), false);
  assert.throws(() => legacyCutoffFromGaDate(Number.NaN));
  assert.throws(() => legacyCutoffFromGaDate(0));
});

test("legacy routing maps to scoped native scopes with resource precedence", () => {
  assert.equal(legacyScopeFromRouting({ event: "room:chat:message", roomId: "room-1" }), "room:room-1");
  assert.equal(legacyScopeFromRouting({ event: "clan:message:new", clanId: "clan-1" }), "clan:clan-1");
  assert.equal(legacyScopeFromRouting({ event: "direct:message:new", conversationId: "dm-1" }), "dm:dm-1");
  assert.equal(legacyScopeFromRouting({ event: "bonds:changed", userId: "user-1" }), "user:user-1");
  assert.equal(
    legacyScopeFromRouting({ event: "room:chat:message", roomId: "room-1", userId: "user-1" }),
    "room:room-1"
  );
  assert.throws(() => legacyScopeFromRouting({ event: "room:chat:message" }));
  assert.throws(() => legacyScopeFromRouting({ event: "room:chat:message", roomId: "../bad id" }));
});

test("event classification is conservative and unambiguous cases only", () => {
  assert.equal(classifyLegacyEvent("sync:invalidate"), "invalidation");
  assert.equal(classifyLegacyEvent("rtc:offer"), "rtc-signaling");
  assert.equal(classifyLegacyEvent("direct:typing:start"), "ephemeral");
  assert.equal(classifyLegacyEvent("room:gift:send"), "durable");
  assert.equal(classifyLegacyEvent("some:new:event"), "unknown");
});

test("native envelope converts to a legacy frame without protocol internals", () => {
  const envelope: NativeEnvelope = {
    v: NATIVE_PROTOCOL_VERSION,
    id: "evt-1",
    seq: 7,
    event: "room:chat:message",
    scope: "room:room-1",
    delivery: "durable",
    at: 1_700_000_000_000,
    ackRequired: false,
    data: { text: "hello" },
  };
  const frame = toLegacyEmit(envelope);
  assert.deepEqual(frame, { event: "room:chat:message", data: { text: "hello" } });
  assert.ok(!("id" in frame));
  assert.ok(!("seq" in frame));
  assert.throws(() => toLegacyEmit({ ...envelope, seq: -1 }));
});

test("legacy socket ack alone never claims authoritative commit", () => {
  const rejected = legacyAckToNativeAck("cmd-1", true);
  assert.equal(rejected.committed, false);
  assert.ok(rejected.error);

  const objectAck = legacyAckToNativeAck("cmd-2", { ok: true });
  assert.equal(objectAck.committed, false);

  const committed = legacyAckToNativeAck("cmd-3", true, "event-from-authoritative-write");
  assert.deepEqual(committed, {
    v: NATIVE_PROTOCOL_VERSION,
    type: "ack",
    commandId: "cmd-3",
    committed: true,
    eventId: "event-from-authoritative-write",
  });

  const falseAck = legacyAckToNativeAck("cmd-4", false, "event-from-authoritative-write");
  assert.equal(falseAck.committed, false);
});

test("coverage reports missing and extra adapter events against the full inventory", () => {
  const catalog = ["room:chat:message", "room:gift:send"];
  const report = compatibilityCoverage(["room:chat:message", "legacy:only"], catalog);
  const required = requiredRealtimeEventNames(catalog);
  assert.equal(report.requiredCount, required.length);
  assert.ok(report.missing.includes("room:gift:send"));
  assert.ok(!report.missing.includes("room:chat:message"));
  assert.deepEqual(report.extra, ["legacy:only"]);
});
