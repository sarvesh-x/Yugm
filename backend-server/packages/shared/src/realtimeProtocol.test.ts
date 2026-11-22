import test from "node:test";
import assert from "node:assert/strict";

import { socketEvents } from "./index.js";
import {
  NATIVE_PROTOCOL_VERSION,
  OFF_CATALOG_REALTIME_EVENTS,
  PK_REALTIME_EVENTS,
  acceptEnvelope,
  checkEventCoverage,
  createReplayState,
  isStale,
  nativeCommandAckSchema,
  nativeEnvelopeSchema,
  nativeResumeSchema,
  requiredRealtimeEventNames,
  shouldDeliver,
} from "./realtimeProtocol.js";

const baseEnvelope = {
  v: NATIVE_PROTOCOL_VERSION,
  id: "evt-1",
  seq: 0,
  event: "room:chat:message",
  scope: "room:r1",
  delivery: "durable" as const,
  at: 1_700_000_000_000,
  data: { text: "hello" },
};

test("envelope accepts a v1 event with defaults and rejects version, strictness and sequence errors", () => {
  const parsed = nativeEnvelopeSchema.parse(baseEnvelope);
  assert.equal(parsed.ackRequired, false);
  assert.equal(parsed.event, "room:chat:message");

  assert.equal(nativeEnvelopeSchema.safeParse({ ...baseEnvelope, v: 2 }).success, false);
  assert.equal(nativeEnvelopeSchema.safeParse({ ...baseEnvelope, seq: -1 }).success, false);
  assert.equal(nativeEnvelopeSchema.safeParse({ ...baseEnvelope, extra: true }).success, false);
  assert.equal(
    nativeEnvelopeSchema.safeParse({ ...baseEnvelope, delivery: "transaction" }).success,
    false,
  );
});

test("resume frame defaults seenIds and rejects other frame types", () => {
  const resume = nativeResumeSchema.parse({
    v: NATIVE_PROTOCOL_VERSION,
    type: "resume",
    scope: "room:r1",
    afterSeq: 12,
  });
  assert.deepEqual(resume.seenIds, []);

  assert.equal(
    nativeResumeSchema.safeParse({
      v: NATIVE_PROTOCOL_VERSION,
      type: "ack",
      scope: "room:r1",
      afterSeq: 0,
    }).success,
    false,
  );
});

test("command ack distinguishes an authoritative commit from a rejection", () => {
  assert.equal(
    nativeCommandAckSchema.safeParse({
      v: NATIVE_PROTOCOL_VERSION,
      type: "ack",
      commandId: "cmd-1",
      committed: true,
      eventId: "evt-1",
    }).success,
    true,
  );
  assert.equal(
    nativeCommandAckSchema.safeParse({
      v: NATIVE_PROTOCOL_VERSION,
      type: "ack",
      commandId: "cmd-1",
      committed: true,
    }).success,
    false,
  );
  assert.equal(
    nativeCommandAckSchema.safeParse({
      v: NATIVE_PROTOCOL_VERSION,
      type: "ack",
      commandId: "cmd-1",
      committed: false,
      error: "insufficient balance",
    }).success,
    true,
  );
  assert.equal(
    nativeCommandAckSchema.safeParse({
      v: NATIVE_PROTOCOL_VERSION,
      type: "ack",
      commandId: "cmd-1",
      committed: false,
    }).success,
    false,
  );
});

test("event contract covers the source-verified catalogs and every off-catalog literal", () => {
  const catalog = Object.values(socketEvents);
  assert.equal(catalog.length, 47, "shared event catalog changed; re-run the source inventory");
  assert.equal(PK_REALTIME_EVENTS.length, 16);
  assert.equal(OFF_CATALOG_REALTIME_EVENTS.length, 20, "17 emitted literals + 3 Android-only listeners");

  const required = requiredRealtimeEventNames(catalog);
  assert.equal(required.length, 83);
  assert.deepEqual(required, [...new Set(required)].sort());
  for (const name of [...PK_REALTIME_EVENTS, ...OFF_CATALOG_REALTIME_EVENTS]) {
    assert.ok(required.includes(name), `${name} must be in the parity contract`);
  }
});

test("coverage harness reports missing and extra adapter events", () => {
  const report = checkEventCoverage({
    adapterEvents: ["room:chat:message", "rogue:event"],
    catalogEvents: ["room:chat:message", "room:join"],
  });

  assert.equal(report.requiredCount, 2 + 16 + 20);
  assert.ok(report.missing.includes("room:join"));
  assert.ok(!report.missing.includes("room:chat:message"));
  assert.deepEqual(report.extra, ["rogue:event"]);
});

test("coverage harness can restrict the contract to the shared catalog", () => {
  const report = checkEventCoverage({
    adapterEvents: [],
    catalogEvents: Object.values(socketEvents),
    includeOffCatalog: false,
  });

  assert.equal(report.requiredCount, 47);
});

test("replay drops duplicate ids, stale sequences and cross-scope envelopes", () => {
  const state = createReplayState();

  assert.equal(shouldDeliver(state, { id: "a", seq: 1, scope: "room:r1" }, "room:r1"), true);
  assert.equal(shouldDeliver(state, { id: "a", seq: 2, scope: "room:r1" }, "room:r1"), false);
  assert.equal(shouldDeliver(state, { id: "b", seq: 1, scope: "room:r1" }, "room:r1"), false);
  assert.equal(shouldDeliver(state, { id: "c", seq: 2, scope: "room:r2" }, "room:r1"), false);
  assert.equal(shouldDeliver(state, { id: "c", seq: 2, scope: "room:r1" }, "room:r1"), true);
});

test("bounded replay evicts the oldest id but keeps the sequence cursor", () => {
  const state = createReplayState(2);

  assert.equal(acceptEnvelope(state, { id: "a", seq: 1, scope: "s" }), undefined);
  assert.equal(acceptEnvelope(state, { id: "b", seq: 2, scope: "s" }), undefined);
  assert.equal(acceptEnvelope(state, { id: "c", seq: 3, scope: "s" }), "a");

  assert.equal(state.seenIds.has("a"), false);
  assert.equal(state.lastSeqByScope.get("s"), 3);
  assert.equal(isStale(state, { id: "a", seq: 1, scope: "s" }, "s"), true, "old seq stays blocked");
});
