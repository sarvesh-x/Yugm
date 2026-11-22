/**
 * Executable parity matrix for the DCR-3 staged hybrid protocol (ADR-0002).
 *
 * Scenarios are derived from docs/migration/realtime-event-inventory.md and are
 * transport-agnostic. No adapter, Durable Object or client is wired here: a real
 * adapter test supplies a ParityTransport and the matrix checks the required
 * semantics. Requirements that still need owner sign-off are listed but skipped
 * unless explicitly enabled.
 */
import {
  NATIVE_PROTOCOL_VERSION,
  type NativeCommandAck,
  type NativeEnvelope,
} from "./realtimeProtocol.js";

export type ParityCategory = "connection" | "dedupe" | "authorization" | "invalidation";

export interface ParityObservation {
  peerId: string;
  envelope: NativeEnvelope;
}

/**
 * Minimal observable surface an adapter must provide to run the matrix.
 * `publish` is the server-side emit after the authoritative write, and `command`
 * is a client request whose ack must describe the committed result.
 */
export interface ParityTransport {
  connect(peerId: string, scope: string): Promise<void>;
  disconnect(peerId: string): Promise<void>;
  restart(): Promise<void>;
  command(peerId: string, commandId: string, event: string, scope: string, data?: unknown): Promise<NativeCommandAck>;
  publish(envelope: NativeEnvelope): Promise<void>;
  /** Returns and clears deliveries observed by a peer. */
  drain(peerId: string): ParityObservation[];
}

export interface ParityScenario {
  id: string;
  category: ParityCategory;
  source: string;
  requiresSignOff?: boolean;
  run(transport: ParityTransport): Promise<void>;
}

export interface ParityRequirement {
  id: string;
  source: string;
  statement: string;
}

/** Requirements from the inventory that are not yet executable without adapter support. */
export const PARITY_REQUIREMENTS: readonly ParityRequirement[] = [
  {
    id: "commit-before-ack",
    source: "realtime-event-inventory.md §8",
    statement: "Durable messages and financial events are written to the authoritative store before ack or fan-out; a socket delivery is never proof of commit.",
  },
  {
    id: "wallet-debit-before-emit",
    source: "realtime-event-inventory.md §6 room:gift:send, pk:gift:received",
    statement: "Wallet debit and gift transaction commit before room:gift:send or pk:gift:received is published; failed debits publish nothing.",
  },
  {
    id: "pk-state-version-ordering",
    source: "realtime-event-inventory.md §7 stateVersion",
    statement: "PK state, score, lead and timer events carry persisted stateVersion ordering; clients ignore stale versions instead of relying on arrival order.",
  },
  {
    id: "pk-idempotency",
    source: "realtime-event-inventory.md §6 pk:score:update",
    statement: "Monetary PK events replay safely using the existing idempotency keys; duplicate delivery does not re-debit a wallet.",
  },
  {
    id: "fan-out-parity",
    source: "realtime-event-inventory.md §7 duplicate/out-of-order risks",
    statement: "Clan and participant fan-out delivers exactly once per recipient; clan:member:left's duplicate emit and four-route direct:message:new emits do not duplicate side effects.",
  },
  {
    id: "typing-authorization",
    source: "realtime-event-inventory.md §7 authorization gaps",
    statement: "direct:typing:start/stop verify conversation membership, not just ObjectId format; the native path must not inherit the legacy spoofing gap.",
  },
  {
    id: "pk-force-authorization",
    source: "realtime-event-inventory.md §7 authorization gaps",
    statement: "pk:force_ended requires an explicit trusted admin check rather than trusting an input.force flag.",
  },
  {
    id: "dead-voice-listeners",
    source: "realtime-event-inventory.md §5",
    statement: "The three Android-only voice:room:presence listeners are either given a defined producer or removed by the client migration.",
  },
  {
    id: "no-android-consumer-events",
    source: "realtime-event-inventory.md §6",
    statement: "Events with no Android consumer (group, watch-party, recording, admin room) are validated by a Server/admin or contract test rather than assumed covered.",
  },
  {
    id: "support-window-and-cutoff",
    source: "ADR-0002",
    statement: "The old-client support window and adapter cutoff date are recorded before the compatibility path is removed.",
  },
];

function expect(condition: boolean, message: string): void {
  if (!condition) throw new Error(message);
}

function envelope(
  event: string,
  scope: string,
  id: string,
  seq: number,
  delivery: NativeEnvelope["delivery"] = "durable",
  data: unknown = {}
): NativeEnvelope {
  return {
    v: NATIVE_PROTOCOL_VERSION,
    id,
    seq,
    event,
    scope,
    delivery,
    at: 1_700_000_000_000,
    ackRequired: false,
    data,
  };
}

export const PARITY_SCENARIOS: readonly ParityScenario[] = [
  {
    id: "reconnect-resume-from-cursor",
    category: "connection",
    source: "realtime-plan.md §Required semantics; inventory §8",
    run: async (transport) => {
      const scope = "room:parity-reconnect";
      await transport.connect("reconnect-a", scope);
      await transport.publish(envelope("room:chat:message", scope, "resume-1", 1));
      await transport.publish(envelope("room:chat:message", scope, "resume-2", 2));
      expect(transport.drain("reconnect-a").length === 2, "peer should receive both events before restart");

      await transport.restart();
      await transport.connect("reconnect-a", scope);
      await transport.publish(envelope("room:chat:message", scope, "resume-3", 3));
      const delivered = transport.drain("reconnect-a");
      expect(
        delivered.length === 1 && delivered[0].envelope.seq === 3,
        "after reconnect the peer should receive only events after its cursor"
      );
    },
  },
  {
    id: "duplicate-event-id-suppressed",
    category: "dedupe",
    source: "ADR-0002 event IDs and deduplication",
    run: async (transport) => {
      const scope = "room:parity-dedupe";
      await transport.connect("dedupe-a", scope);
      await transport.publish(envelope("room:gift:send", scope, "gift-1", 1));
      await transport.publish(envelope("room:gift:send", scope, "gift-1", 2));
      expect(transport.drain("dedupe-a").length === 1, "a replayed event id must be delivered once");
    },
  },
  {
    id: "stale-sequence-dropped",
    category: "dedupe",
    source: "realtime-plan.md §Required semantics",
    run: async (transport) => {
      const scope = "room:parity-stale";
      await transport.connect("stale-a", scope);
      await transport.publish(envelope("room:activity:new", scope, "seq-5", 5));
      await transport.publish(envelope("room:activity:new", scope, "seq-4", 4));
      const delivered = transport.drain("stale-a");
      expect(delivered.length === 1 && delivered[0].envelope.seq === 5, "out-of-order stale seq must be dropped");
    },
  },
  {
    id: "scope-isolation",
    category: "authorization",
    source: "inventory §3 rooms user:<id> and room:<id>",
    run: async (transport) => {
      await transport.connect("scope-a", "room:parity-scope-one");
      await transport.connect("scope-b", "room:parity-scope-two");
      await transport.publish(envelope("room:chat:message", "room:parity-scope-one", "scoped-1", 1));
      expect(transport.drain("scope-a").length === 1, "subscribed peer should receive the event");
      expect(transport.drain("scope-b").length === 0, "peer in another scope must not receive it");
    },
  },
  {
    id: "room-join-ack-is-authoritative",
    category: "connection",
    source: "inventory §6 room:join ack; parity tests required",
    run: async (transport) => {
      await transport.connect("join-a", "room:parity-join");
      const ack = await transport.command("join-a", "join-1", "room:join", "room:parity-join", { roomId: "room:parity-join" });
      expect(ack.v === NATIVE_PROTOCOL_VERSION && ack.type === "ack", "ack frame must be the native v1 shape");
      expect(ack.committed && ack.eventId !== undefined, "a committed join ack must carry an eventId");
    },
  },
  {
    id: "sync-invalidate-bonds-topic",
    category: "invalidation",
    source: "inventory §5 BONDS mismatch; owner decision pending",
    requiresSignOff: true,
    run: async (transport) => {
      const scope = "user:parity-invalidate";
      await transport.connect("invalidate-a", scope);
      await transport.publish(
        envelope("sync:invalidate", scope, "invalidate-1", 1, "invalidation", { topics: ["WALLET", "BONDS"] })
      );
      const delivered = transport.drain("invalidate-a");
      const data = delivered[0]?.envelope.data as { topics?: string[] } | undefined;
      expect(delivered.length === 1 && data?.topics?.includes("BONDS") === true, "BONDS must survive fan-out if retained");
    },
  },
];

export interface ParityScenarioResult {
  id: string;
  category: ParityCategory;
  status: "pass" | "fail" | "skipped";
  error?: string;
}

export interface ParityMatrixResult {
  passed: boolean;
  scenarios: ParityScenarioResult[];
  requirements: readonly ParityRequirement[];
}

export async function runParityMatrix(
  transport: ParityTransport,
  options: { includeSignOff?: boolean } = {}
): Promise<ParityMatrixResult> {
  const scenarios: ParityScenarioResult[] = [];

  for (const scenario of PARITY_SCENARIOS) {
    if (scenario.requiresSignOff && !options.includeSignOff) {
      scenarios.push({ id: scenario.id, category: scenario.category, status: "skipped" });
      continue;
    }
    try {
      await scenario.run(transport);
      scenarios.push({ id: scenario.id, category: scenario.category, status: "pass" });
    } catch (error) {
      scenarios.push({
        id: scenario.id,
        category: scenario.category,
        status: "fail",
        error: error instanceof Error ? error.message : "unknown failure",
      });
    }
  }

  return {
    passed: scenarios.every((entry) => entry.status !== "fail"),
    scenarios,
    requirements: PARITY_REQUIREMENTS,
  };
}
