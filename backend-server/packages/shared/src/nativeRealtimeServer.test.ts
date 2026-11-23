import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { NATIVE_PROTOCOL_VERSION, type NativeCommandAck, type NativeEnvelope } from "./realtimeProtocol.js";
import { NativeRealtimeRoom } from "./nativeRealtimeServer.js";

function envelope(overrides: Partial<NativeEnvelope> = {}): NativeEnvelope {
  return {
    v: NATIVE_PROTOCOL_VERSION,
    id: randomUUID(),
    seq: 1,
    event: "room:chat:message",
    scope: "room:one",
    delivery: "durable",
    at: 1_700_000_000_000,
    ackRequired: false,
    data: { text: "hello" },
    ...overrides,
  };
}

function parseFrames(frames: readonly { text: string }[]): unknown[] {
  return frames.map((frame) => JSON.parse(frame.text) as unknown);
}

test("publish assigns per-scope sequences and delivers only to matching scopes", () => {
  const room = new NativeRealtimeRoom();
  room.connect("a", "room:one");
  room.connect("b", "room:two");

  const first = room.publish({ event: "room:chat:message", scope: "room:one", data: {}, delivery: "durable" });
  const second = room.publish({ event: "room:chat:message", scope: "room:one", data: {}, delivery: "durable" });

  assert.equal(first.envelope.seq, 1);
  assert.equal(second.envelope.seq, 2);
  assert.deepEqual(first.frames.map((frame) => frame.to), ["a"]);
  assert.deepEqual(second.frames.map((frame) => frame.to), ["a"]);
});

test("duplicate envelope ids are not delivered twice to a receiver", () => {
  const room = new NativeRealtimeRoom();
  room.connect("a", "room:one");
  const first = envelope({ seq: 1 });
  const replay = envelope({ id: first.id, seq: 2 });

  assert.equal(room.deliver(first).frames.length, 1);
  assert.equal(room.deliver(replay).frames.length, 0);
});

test("resume replays only events after the client cursor and honors seenIds", async () => {
  const room = new NativeRealtimeRoom();
  room.connect("a", "room:one");
  const first = room.publish({ event: "room:chat:message", scope: "room:one", data: { n: 1 }, delivery: "durable" });
  const second = room.publish({ event: "room:chat:message", scope: "room:one", data: { n: 2 }, delivery: "durable" });

  const replay = await room.handleFrame(
    "a",
    JSON.stringify({ v: NATIVE_PROTOCOL_VERSION, type: "resume", scope: "room:one", afterSeq: 1, seenIds: [] })
  );
  assert.equal(replay.length, 1);
  assert.equal((parseFrames(replay)[0] as { id: string }).id, second.envelope.id);

  const withSeen = await room.handleFrame(
    "a",
    JSON.stringify({ v: NATIVE_PROTOCOL_VERSION, type: "resume", scope: "room:one", afterSeq: 1, seenIds: [second.envelope.id] })
  );
  assert.equal(withSeen.length, 0);
  assert.ok(first.envelope.seq < second.envelope.seq);
});

test("invalid and mismatched frames produce value-free error frames", async () => {
  const room = new NativeRealtimeRoom();
  room.connect("a", "room:one");

  const malformed = parseFrames(await room.handleFrame("a", "not-json"))[0] as { type: string; code: string };
  const mismatch = parseFrames(await room.handleFrame(
    "a",
    JSON.stringify({ v: NATIVE_PROTOCOL_VERSION, type: "resume", scope: "room:two", afterSeq: 0, seenIds: [] })
  ))[0] as { type: string; code: string };

  assert.equal(malformed.type, "error");
  assert.equal(malformed.code, "INVALID_JSON");
  assert.equal(mismatch.type, "error");
  assert.equal(mismatch.code, "SCOPE_MISMATCH");
});

test("history is bounded for replay", async () => {
  const room = new NativeRealtimeRoom({ maxHistory: 2 });
  room.connect("a", "room:one");
  const first = room.publish({ event: "room:activity:new", scope: "room:one", data: {}, delivery: "ephemeral" });
  const second = room.publish({ event: "room:activity:new", scope: "room:one", data: {}, delivery: "ephemeral" });
  const third = room.publish({ event: "room:activity:new", scope: "room:one", data: {}, delivery: "ephemeral" });

  const frames = await room.handleFrame(
    "a",
    JSON.stringify({ v: NATIVE_PROTOCOL_VERSION, type: "resume", scope: "room:one", afterSeq: 0, seenIds: [] })
  );
  const ids = parseFrames(frames).map((frame) => (frame as { id: string }).id);

  assert.equal(ids.length, 2);
  assert.deepEqual(ids, [second.envelope.id, third.envelope.id]);
  assert.ok(!ids.includes(first.envelope.id));
});

test("commands return an authoritative ack and reject scope mismatches", async () => {
  const seen: string[] = [];
  const room = new NativeRealtimeRoom({
    commandHandler: (command, connectionId): NativeCommandAck => {
      seen.push(connectionId);
      return {
        v: NATIVE_PROTOCOL_VERSION,
        type: "ack",
        commandId: command.commandId,
        committed: true,
        eventId: `event-${command.commandId}`,
      };
    },
  });
  room.connect("a", "room:one");

  const ackFrame = await room.handleFrame(
    "a",
    JSON.stringify({ v: NATIVE_PROTOCOL_VERSION, type: "command", commandId: "join-1", event: "room:join", scope: "room:one", data: {} })
  );
  const ack = parseFrames(ackFrame)[0] as NativeCommandAck;
  assert.deepEqual(ack, {
    v: NATIVE_PROTOCOL_VERSION,
    type: "ack",
    commandId: "join-1",
    committed: true,
    eventId: "event-join-1",
  });
  assert.deepEqual(seen, ["a"]);

  const mismatch = parseFrames(await room.handleFrame(
    "a",
    JSON.stringify({ v: NATIVE_PROTOCOL_VERSION, type: "command", commandId: "join-2", event: "room:join", scope: "room:two", data: {} })
  ))[0] as { code: string };
  assert.equal(mismatch.code, "SCOPE_MISMATCH");
});

test("commands are rejected when no handler is configured or the handler ack is invalid", async () => {
  const room = new NativeRealtimeRoom();
  room.connect("a", "room:one");

  const rejected = parseFrames(await room.handleFrame(
    "a",
    JSON.stringify({ v: NATIVE_PROTOCOL_VERSION, type: "command", commandId: "join-1", event: "room:join", scope: "room:one" })
  ))[0] as NativeCommandAck;
  assert.equal(rejected.committed, false);
  assert.equal(rejected.error, "Command handling is not configured");

  const invalidRoom = new NativeRealtimeRoom({
    commandHandler: () => ({ v: NATIVE_PROTOCOL_VERSION, type: "ack", commandId: "join-1", committed: true } as NativeCommandAck),
  });
  invalidRoom.connect("a", "room:one");
  const invalid = parseFrames(await invalidRoom.handleFrame(
    "a",
    JSON.stringify({ v: NATIVE_PROTOCOL_VERSION, type: "command", commandId: "join-1", event: "room:join", scope: "room:one" })
  ))[0] as { code: string };
  assert.equal(invalid.code, "INVALID_ACK");
});
