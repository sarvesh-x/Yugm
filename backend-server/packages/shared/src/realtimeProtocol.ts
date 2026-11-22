/**
 * Versioned native realtime protocol contract (DCR-3 Option C, ADR-0002).
 *
 * This module defines wire primitives and a coverage harness only. It is NOT wired
 * into the running Socket.IO bridge or any Durable Object. Event classification and
 * the old-client cutoff remain pending the DCR-3 inputs in the decision request.
 *
 * Design rules from the source-verified inventory:
 *  - durable events are written to the authoritative store before ack/delivery;
 *  - ephemeral presence/typing and invalidations are never proof of commit;
 *  - every event carries an id (dedupe) and a per-scope sequence (resume cursor).
 */

import { z } from "zod";

export const NATIVE_PROTOCOL_VERSION = 1 as const;

export const deliveryClassSchema = z.enum([
  "durable",
  "ephemeral",
  "invalidation",
  "rtc-signaling",
  "unknown",
]);
export type DeliveryClass = z.infer<typeof deliveryClassSchema>;

/** Application event envelope. Transport connect/disconnect frames are not events. */
export const nativeEnvelopeSchema = z.object({
  v: z.literal(NATIVE_PROTOCOL_VERSION),
  id: z.string().min(1),
  seq: z.number().int().nonnegative(),
  event: z.string().min(1),
  scope: z.string().min(1),
  delivery: deliveryClassSchema,
  at: z.number().int().nonnegative(),
  ackRequired: z.boolean().default(false),
  data: z.unknown(),
}).strict();
export type NativeEnvelope = z.infer<typeof nativeEnvelopeSchema>;

/** Client request after reconnect. `seenIds` bounds ambiguity when seq gaps exist. */
export const nativeResumeSchema = z.object({
  v: z.literal(NATIVE_PROTOCOL_VERSION),
  type: z.literal("resume"),
  scope: z.string().min(1),
  afterSeq: z.number().int().nonnegative(),
  seenIds: z.array(z.string().min(1)).max(1000).default([]),
}).strict();
export type NativeResume = z.infer<typeof nativeResumeSchema>;

/** Result of an authoritative command, distinct from socket delivery success. */
export const nativeCommandAckSchema = z.object({
  v: z.literal(NATIVE_PROTOCOL_VERSION),
  type: z.literal("ack"),
  commandId: z.string().min(1),
  committed: z.boolean(),
  eventId: z.string().min(1).optional(),
  error: z.string().min(1).optional(),
}).strict().refine(
  (ack) => (ack.committed ? ack.eventId !== undefined : ack.error !== undefined),
  { message: "committed acks require eventId; rejected acks require error" },
);
export type NativeCommandAck = z.infer<typeof nativeCommandAckSchema>;

/** PK catalog events (api/services/pk.ts pkSocketEvents, source-verified). */
export const PK_REALTIME_EVENTS = [
  "pk:invite:received",
  "pk:invite:sent",
  "pk:invite:accepted",
  "pk:invite:rejected",
  "pk:invite:expired",
  "pk:started",
  "pk:state",
  "pk:score:update",
  "pk:lead:changed",
  "pk:gift:received",
  "pk:reaction:received",
  "pk:timer:tick",
  "pk:ended",
  "pk:force_ended",
  "pk:rematch:requested",
  "pk:error",
] as const;

/**
 * Emitted/listened names absent from both catalogs, plus three Android-only
 * listeners with no server emit found. Source-verified in realtime-event-inventory.md;
 * owner sign-off on their fate is still pending.
 */
export const OFF_CATALOG_REALTIME_EVENTS = [
  "sync:invalidate",
  "bonds:changed",
  "admin:room:lock",
  "admin:room:unlock",
  "admin:room:user:remove",
  "admin:room:user:mute",
  "admin:room:warning",
  "recording:started",
  "recording:stopped",
  "room:mode:set",
  "room:mode:state",
  "room:mode:answer",
  "room:mode:dare",
  "room:mode:scores",
  "room:mode:ended",
  "direct:conversation:read",
  "direct:reaction:new",
  "voice:room:presence:started",
  "voice:room:presence:updated",
  "voice:room:presence:ended",
] as const;

/** Deduplicated union of catalog values, PK events and off-catalog literals. */
export function requiredRealtimeEventNames(catalogEvents: readonly string[]): string[] {
  return [...new Set([...catalogEvents, ...PK_REALTIME_EVENTS, ...OFF_CATALOG_REALTIME_EVENTS])].sort();
}

/** Per-scope replay/dedupe state. Bounded so long-lived sockets cannot grow without limit. */
export type ReplayState = {
  seenIds: Set<string>;
  lastSeqByScope: Map<string, number>;
  order: string[];
  limit: number;
};

export function createReplayState(limit = 5000): ReplayState {
  return { seenIds: new Set(), lastSeqByScope: new Map(), order: [], limit };
}

type SequenceRef = Pick<NativeEnvelope, "id" | "seq" | "scope">;

/** True when an envelope must not be delivered to this state's scope. */
export function isStale(state: ReplayState, envelope: SequenceRef, expectedScope: string): boolean {
  if (envelope.scope !== expectedScope) return true;
  if (state.seenIds.has(envelope.id)) return true;
  const last = state.lastSeqByScope.get(envelope.scope);
  return last !== undefined && envelope.seq <= last;
}

/** Record an accepted envelope. Returns the evicted id, if the bound was exceeded. */
export function acceptEnvelope(state: ReplayState, envelope: SequenceRef): string | undefined {
  let evicted: string | undefined;
  if (!state.seenIds.has(envelope.id)) {
    state.seenIds.add(envelope.id);
    state.order.push(envelope.id);
    if (state.order.length > state.limit) {
      evicted = state.order.shift();
      if (evicted) state.seenIds.delete(evicted);
    }
  }
  const last = state.lastSeqByScope.get(envelope.scope);
  if (last === undefined || envelope.seq > last) state.lastSeqByScope.set(envelope.scope, envelope.seq);
  return evicted;
}

/** Combined guard for a single inbound envelope: false means drop, true means deliver and record. */
export function shouldDeliver(state: ReplayState, envelope: SequenceRef, expectedScope: string): boolean {
  if (isStale(state, envelope, expectedScope)) return false;
  acceptEnvelope(state, envelope);
  return true;
}

/** Coverage harness used by adapter parity tests; no protocol is assumed interchangeable. */
export type CoverageInput = {
  adapterEvents: readonly string[];
  catalogEvents: readonly string[];
  includeOffCatalog?: boolean;
};
export type CoverageReport = {
  requiredCount: number;
  missing: string[];
  extra: string[];
};

export function checkEventCoverage(input: CoverageInput): CoverageReport {
  const required = new Set(
    input.includeOffCatalog === false
      ? input.catalogEvents
      : requiredRealtimeEventNames(input.catalogEvents),
  );
  const provided = new Set(input.adapterEvents);
  return {
    requiredCount: required.size,
    missing: [...required].filter((event) => !provided.has(event)).sort(),
    extra: [...provided].filter((event) => !required.has(event)).sort(),
  };
}
