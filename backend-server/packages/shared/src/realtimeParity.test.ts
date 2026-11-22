import test from "node:test";
import assert from "node:assert/strict";

import { NATIVE_PROTOCOL_VERSION, createReplayState, shouldDeliver, type NativeEnvelope, type ReplayState } from "./realtimeProtocol.js";
import {
  PARITY_REQUIREMENTS,
  PARITY_SCENARIOS,
  runParityMatrix,
  type ParityObservation,
  type ParityTransport,
} from "./realtimeParity.js";

type Peer = { scope: string; deliveries: ParityObservation[]; replay: ReplayState };

/** In-memory test double. It is not a production adapter. */
class MemoryParityTransport implements ParityTransport {
  private readonly peers = new Map<string, Peer>();

  constructor(private readonly options: { alwaysDeliver?: boolean } = {}) {}

  async connect(peerId: string, scope: string) {
    const existing = this.peers.get(peerId);
    this.peers.set(peerId, existing ? { ...existing, scope } : { scope, deliveries: [], replay: createReplayState() });
  }

  async disconnect(peerId: string) {
    this.peers.delete(peerId);
  }

  async restart() {
    for (const peer of this.peers.values()) peer.deliveries = [];
  }

  async command(_peerId: string, commandId: string) {
    return {
      v: NATIVE_PROTOCOL_VERSION,
      type: "ack" as const,
      commandId,
      committed: true,
      eventId: `evt-${commandId}`,
    };
  }

  async publish(envelope: NativeEnvelope) {
    for (const [peerId, peer] of this.peers) {
      if (peer.scope !== envelope.scope) continue;
      if (this.options.alwaysDeliver || shouldDeliver(peer.replay, envelope, peer.scope)) {
        peer.deliveries.push({ peerId, envelope });
      }
    }
  }

  drain(peerId: string) {
    const peer = this.peers.get(peerId);
    if (!peer) return [];
    const deliveries = peer.deliveries;
    peer.deliveries = [];
    return deliveries;
  }
}

test("matrix passes against a conforming in-memory transport and skips sign-off scenarios", async () => {
  const result = await runParityMatrix(new MemoryParityTransport());

  assert.equal(result.passed, true);
  assert.equal(result.scenarios.filter((entry) => entry.status === "pass").length, 5);
  assert.deepEqual(
    result.scenarios.filter((entry) => entry.status === "skipped").map((entry) => entry.id),
    ["sync-invalidate-bonds-topic"]
  );
});

test("sign-off scenarios run only when explicitly enabled", async () => {
  const result = await runParityMatrix(new MemoryParityTransport(), { includeSignOff: true });

  assert.equal(result.passed, true);
  assert.equal(result.scenarios.filter((entry) => entry.status === "pass").length, 6);
  assert.ok(result.scenarios.every((entry) => entry.status !== "skipped"));
});

test("matrix detects a duplicate-delivery regression without aborting other scenarios", async () => {
  const result = await runParityMatrix(new MemoryParityTransport({ alwaysDeliver: true }));

  assert.equal(result.passed, false);
  assert.equal(result.scenarios.length, PARITY_SCENARIOS.length);
  const duplicate = result.scenarios.find((entry) => entry.id === "duplicate-event-id-suppressed");
  assert.equal(duplicate?.status, "fail");
  assert.match(duplicate?.error ?? "", /delivered once/);
});

test("catalog scenarios and documented requirements have unique, sourced identifiers", () => {
  const scenarioIds = PARITY_SCENARIOS.map((scenario) => scenario.id);
  const requirementIds = PARITY_REQUIREMENTS.map((requirement) => requirement.id);

  assert.equal(new Set(scenarioIds).size, scenarioIds.length);
  assert.equal(new Set(requirementIds).size, requirementIds.length);
  for (const scenario of PARITY_SCENARIOS) assert.ok(scenario.source.length > 0, `${scenario.id} needs a source`);
  for (const requirement of PARITY_REQUIREMENTS) {
    assert.ok(requirement.source.length > 0 && requirement.statement.length > 0, `${requirement.id} is incomplete`);
  }
  assert.ok(requirementIds.includes("commit-before-ack"));
  assert.ok(requirementIds.includes("support-window-and-cutoff"));
});
