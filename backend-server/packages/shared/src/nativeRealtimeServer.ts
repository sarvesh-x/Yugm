/**
 * Pure server-side transport for the DCR-3 native protocol.
 *
 * This is a host-neutral foundation: it assigns per-scope sequences, fans out
 * envelopes, applies receiver dedupe/replay rules and handles resume frames.
 * It does not authenticate, persist to D1/DO SQLite, or get wired into the
 * running Socket.IO bridge. A later Durable Object adapter supplies those.
 */
import {
  NATIVE_PROTOCOL_VERSION,
  acceptEnvelope,
  createReplayState,
  nativeCommandAckSchema,
  nativeCommandSchema,
  nativeEnvelopeSchema,
  nativeResumeSchema,
  shouldDeliver,
  type NativeCommandAck,
  type NativeCommandFrame,
  type NativeEnvelope,
  type ReplayState,
} from "./realtimeProtocol.js";

export interface NativeServerFrame {
  to: string;
  text: string;
}

export interface NativePublishInput {
  event: string;
  scope: string;
  data: unknown;
  delivery: NativeEnvelope["delivery"];
}

interface NativeConnection {
  scope: string;
  state: ReplayState;
}

export interface NativeDeliveryResult {
  envelope: NativeEnvelope;
  frames: NativeServerFrame[];
}

/**
 * Supplies the authoritative result of a command. Implementations must commit
 * to the source of truth before returning `committed: true`.
 */
export type NativeCommandHandler = (
  command: NativeCommandFrame,
  connectionId: string
) => Promise<NativeCommandAck> | NativeCommandAck;

export interface NativeServerErrorFrame {
  v: typeof NATIVE_PROTOCOL_VERSION;
  type: "error";
  code: string;
  message: string;
}

function rememberSeenIds(state: ReplayState, ids: readonly string[]) {
  for (const id of ids) {
    if (state.seenIds.has(id)) continue;
    state.seenIds.add(id);
    state.order.push(id);
    if (state.order.length > state.limit) {
      const evicted = state.order.shift();
      if (evicted) state.seenIds.delete(evicted);
    }
  }
}

function errorFrame(code: string, message: string): NativeServerFrame {
  const frame: NativeServerErrorFrame = { v: NATIVE_PROTOCOL_VERSION, type: "error", code, message };
  return { to: "", text: JSON.stringify(frame) };
}

export class NativeRealtimeRoom {
  private readonly connections = new Map<string, NativeConnection>();
  private readonly history = new Map<string, NativeEnvelope[]>();
  private readonly lastSeq = new Map<string, number>();

  constructor(
    private readonly options: {
      maxHistory?: number;
      replayLimit?: number;
      commandHandler?: NativeCommandHandler;
    } = {}
  ) {}

  connect(connectionId: string, scope: string): void {
    if (!connectionId.trim() || !scope.trim()) throw new Error("connectionId and scope are required");
    this.connections.set(connectionId, {
      scope,
      state: createReplayState(this.options.replayLimit ?? 5000),
    });
  }

  disconnect(connectionId: string): void {
    this.connections.delete(connectionId);
  }

  /** Assigns an ID and per-scope sequence, then fans out the envelope. */
  publish(input: NativePublishInput): NativeDeliveryResult {
    const scope = input.scope;
    if (!scope.trim() || !input.event.trim()) throw new Error("scope and event are required");
    const nextSeq = (this.lastSeq.get(scope) ?? 0) + 1;
    this.lastSeq.set(scope, nextSeq);
    const envelope = nativeEnvelopeSchema.parse({
      v: NATIVE_PROTOCOL_VERSION,
      id: globalThis.crypto.randomUUID(),
      seq: nextSeq,
      event: input.event,
      scope,
      delivery: input.delivery,
      at: Date.now(),
      ackRequired: false,
      data: input.data,
    });
    return this.deliver(envelope);
  }

  /** Fans out an already sequenced envelope using receiver-side dedupe rules. */
  deliver(value: unknown): NativeDeliveryResult {
    const parsed = nativeEnvelopeSchema.safeParse(value);
    if (!parsed.success) throw new Error("invalid native envelope");
    const envelope = parsed.data;
    const log = this.history.get(envelope.scope) ?? [];
    log.push(envelope);
    const maxHistory = Math.max(1, this.options.maxHistory ?? 200);
    if (log.length > maxHistory) log.splice(0, log.length - maxHistory);
    this.history.set(envelope.scope, log);

    const frames: NativeServerFrame[] = [];
    for (const [connectionId, connection] of this.connections) {
      if (connection.scope !== envelope.scope) continue;
      if (!shouldDeliver(connection.state, envelope, envelope.scope)) continue;
      frames.push({ to: connectionId, text: JSON.stringify(envelope) });
    }
    return { envelope, frames };
  }

  /** Parses a client frame and returns bounded replay frames, an ack, or an error frame. */
  async handleFrame(connectionId: string, raw: string): Promise<NativeServerFrame[]> {
    const connection = this.connections.get(connectionId);
    if (!connection) return [{ ...errorFrame("UNKNOWN_CONNECTION", "Connection is not registered"), to: connectionId }];

    let value: unknown;
    try {
      value = JSON.parse(raw);
    } catch {
      return [{ ...errorFrame("INVALID_JSON", "Frame is not valid JSON"), to: connectionId }];
    }

    const command = nativeCommandSchema.safeParse(value);
    if (command.success) {
      if (command.data.scope !== connection.scope) {
        return [{ ...errorFrame("SCOPE_MISMATCH", "Command scope does not match the connection"), to: connectionId }];
      }
      const fallbackAck: NativeCommandAck = {
        v: NATIVE_PROTOCOL_VERSION,
        type: "ack",
        commandId: command.data.commandId,
        committed: false,
        error: "Command handling is not configured",
      };
      const candidate = this.options.commandHandler
        ? await this.options.commandHandler(command.data, connectionId)
        : fallbackAck;
      const ack = nativeCommandAckSchema.safeParse(candidate);
      if (!ack.success) {
        return [{ ...errorFrame("INVALID_ACK", "Command handler returned an invalid ack"), to: connectionId }];
      }
      return [{ to: connectionId, text: JSON.stringify(ack.data) }];
    }

    const resume = nativeResumeSchema.safeParse(value);
    if (!resume.success) {
      return [{ ...errorFrame("UNSUPPORTED_FRAME", "Only resume and command frames are supported"), to: connectionId }];
    }
    if (resume.data.scope !== connection.scope) {
      return [{ ...errorFrame("SCOPE_MISMATCH", "Resume scope does not match the connection"), to: connectionId }];
    }

    // A resume frame represents a fresh connection state. Discard receiver-side
    // state created by live deliveries before applying the client cursor and
    // seenIds, otherwise already delivered frames would be treated as seen.
    connection.state = createReplayState(this.options.replayLimit ?? 5000);
    connection.state.lastSeqByScope.set(resume.data.scope, resume.data.afterSeq);
    rememberSeenIds(connection.state, resume.data.seenIds);

    const frames: NativeServerFrame[] = [];
    for (const envelope of this.history.get(resume.data.scope) ?? []) {
      if (envelope.seq <= resume.data.afterSeq) continue;
      if (!shouldDeliver(connection.state, envelope, resume.data.scope)) continue;
      frames.push({ to: connectionId, text: JSON.stringify(envelope) });
    }
    return frames;
  }

  /** Test/debug helper: records an accepted envelope without fan-out. */
  recordDelivery(connectionId: string, envelope: NativeEnvelope): void {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    if (shouldDeliver(connection.state, envelope, connection.scope)) acceptEnvelope(connection.state, envelope);
  }
}
