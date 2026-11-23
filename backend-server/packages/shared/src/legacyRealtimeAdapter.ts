/**
 * Pure legacy Socket.IO compatibility adapter for DCR-3 Option C (ADR-0002).
 *
 * This is a translation surface for the 90-day support window after native GA.
 * It is deliberately NOT a trust surface: a legacy socket acknowledgement is a
 * transport-level signal and can never prove an authoritative commit. It is also
 * not wired to a Socket.IO server, Durable Object or any runtime path.
 *
 * Event classification is conservative: only unambiguous cases are classified,
 * and everything else is `unknown` pending the owner's source-verified sign-off.
 */
import {
  NATIVE_PROTOCOL_VERSION,
  checkEventCoverage,
  nativeEnvelopeSchema,
  type DeliveryClass,
  type NativeCommandAck,
  type NativeEnvelope,
} from "./realtimeProtocol.js";

export const SUPPORT_WINDOW_DAYS = 90;
const DAY_MS = 24 * 60 * 60 * 1000;

/** The GA date is owner-supplied; this module never invents or stores one. */
export function legacyCutoffFromGaDate(gaDateMs: number): number {
  if (!Number.isFinite(gaDateMs) || gaDateMs <= 0) {
    throw new Error("A valid native GA date is required to compute the legacy cutoff");
  }
  return gaDateMs + SUPPORT_WINDOW_DAYS * DAY_MS;
}

export function isLegacySupportActive(nowMs: number, cutoffMs: number): boolean {
  if (!Number.isFinite(nowMs) || !Number.isFinite(cutoffMs)) return false;
  return nowMs < cutoffMs;
}

/** Resource identifiers are validated before being placed into a native scope. */
export interface LegacyRouting {
  event: string;
  roomId?: string;
  clanId?: string;
  conversationId?: string;
  userId?: string;
}

const SAFE_ID = /^[A-Za-z0-9_:.-]{1,120}$/;

function scopePart(prefix: string, id: string | undefined): string | undefined {
  if (!id || !SAFE_ID.test(id)) return undefined;
  return `${prefix}:${id}`;
}

/**
 * Maps legacy routing data to a native scope. Room/clan/conversation scopes take
 * precedence over a user scope so a room event is never delivered on a user feed.
 */
export function legacyScopeFromRouting(routing: LegacyRouting): string {
  const scope = [
    scopePart("room", routing.roomId),
    scopePart("clan", routing.clanId),
    scopePart("dm", routing.conversationId),
    scopePart("user", routing.userId),
  ].find((part) => part !== undefined);
  if (!scope) throw new Error("Legacy routing must contain a valid resource id");
  return scope;
}

/** Only unambiguous event names are classified; the rest stay `unknown`. */
const INVALIDATION_EVENTS = new Set(["sync:invalidate"]);
const RTC_EVENT_PREFIXES = ["rtc:", "webrtc:"];
const EPHEMERAL_EVENTS = new Set([
  "direct:typing:start",
  "direct:typing:stop",
  "room:typing:start",
  "room:typing:stop",
  "room:activity:new",
  "presence:update",
]);
const DURABLE_EVENTS = new Set([
  "room:chat:message",
  "room:join",
  "room:leave",
  "direct:message:new",
  "room:gift:send",
  "pk:gift:received",
  "pk:score:update",
  "pk:state",
  "pk:invite:received",
  "pk:invite:sent",
  "pk:invite:accepted",
  "pk:invite:rejected",
  "pk:started",
  "pk:ended",
  "pk:force_ended",
  "clan:message:new",
  "wallet:changed",
  "bonds:changed",
]);

export function classifyLegacyEvent(event: string): DeliveryClass {
  if (INVALIDATION_EVENTS.has(event)) return "invalidation";
  if (RTC_EVENT_PREFIXES.some((prefix) => event.startsWith(prefix))) return "rtc-signaling";
  if (EPHEMERAL_EVENTS.has(event)) return "ephemeral";
  if (DURABLE_EVENTS.has(event)) return "durable";
  return "unknown";
}

export interface LegacyEmitFrame {
  event: string;
  data: unknown;
}

/**
 * Converts a native envelope into the payload a legacy Socket.IO client expects.
 * Internal envelope fields (id/seq/version) are stripped so a legacy client is
 * never handed protocol state it does not understand.
 */
export function toLegacyEmit(value: NativeEnvelope): LegacyEmitFrame {
  const envelope = nativeEnvelopeSchema.parse(value);
  return { event: envelope.event, data: envelope.data };
}

/**
 * Converts a legacy socket acknowledgement into a native ack. A legacy ack alone
 * never commits: `committed: true` is only possible when the caller supplies an
 * eventId that was produced by an authoritative write outside this module.
 */
export function legacyAckToNativeAck(
  commandId: string,
  legacyAck: unknown,
  committedEventId?: string
): NativeCommandAck {
  const accepted =
    legacyAck === true ||
    (typeof legacyAck === "object" &&
      legacyAck !== null &&
      (legacyAck as { ok?: unknown }).ok === true);
  if (accepted && committedEventId) {
    return {
      v: NATIVE_PROTOCOL_VERSION,
      type: "ack",
      commandId,
      committed: true,
      eventId: committedEventId,
    };
  }
  return {
    v: NATIVE_PROTOCOL_VERSION,
    type: "ack",
    commandId,
    committed: false,
    error: "Legacy socket acknowledgement is not proof of commit",
  };
}

/** Reports which inventory events a compatibility adapter still needs to cover. */
export function compatibilityCoverage(supportedEvents: readonly string[], catalogEvents: readonly string[]) {
  return checkEventCoverage({ adapterEvents: supportedEvents, catalogEvents });
}
