/**
 * Hibernation-compatible Durable Object adapter for the native realtime
 * protocol. WebSocket upgrade and publish endpoints are internal only: the D1
 * Worker uses a bound stub, and no public HTTP route forwards to this object.
 * Connection identity/scope live in WebSocket attachments; cursors, seen IDs,
 * sequences and bounded history live in Durable Object storage. No mutable
 * in-memory Map is required across hibernation.
 */
import { DurableObject } from "cloudflare:workers";
import {
  NATIVE_PROTOCOL_VERSION,
  deliveryClassSchema,
  nativeCommandAckSchema,
  nativeCommandSchema,
  nativeEnvelopeSchema,
  nativeResumeSchema,
  type NativeCommandAck,
  type NativeCommandFrame,
  type NativeEnvelope,
  type NativePublishInput,
  type NativeResume,
  SerializedOperations,
} from "@yugm/shared";

const MAX_HISTORY = 200;
const MAX_SEEN_IDS = 5000;
const PRESENCE_KEY = "native:presence";
const PRESENCE_TTL_MS = 5 * 60_000;
const SCOPE_PATTERN = /^[a-zA-Z][a-zA-Z0-9:_-]{1,120}$/;
const USER_ID_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9:_-]{1,120}$/;

type PresenceRecord = Record<string, number>;

interface NativeAttachment {
  connectionId: string;
  scope: string;
}

interface NativeConnectionState {
  scope: string;
  lastSeq: number;
  seenIds: string[];
}

interface NativeServerErrorFrame {
  v: typeof NATIVE_PROTOCOL_VERSION;
  type: "error";
  code: string;
  message: string;
}

export interface NativeRealtimeDoEnv {
  [name: string]: unknown;
}

function isAttachment(value: unknown): value is NativeAttachment {
  if (!value || typeof value !== "object") return false;
  const record = value as Record<string, unknown>;
  return typeof record.connectionId === "string" && typeof record.scope === "string";
}

function attachmentOf(ws: WebSocket): NativeAttachment | undefined {
  const value = ws.deserializeAttachment() as unknown;
  return isAttachment(value) ? value : undefined;
}

function errorFrame(code: string, message: string): string {
  const frame: NativeServerErrorFrame = { v: NATIVE_PROTOCOL_VERSION, type: "error", code, message };
  return JSON.stringify(frame);
}

function badRequest(message: string) {
  return Response.json({ ok: false, error: message }, { status: 400 });
}

function parsePublishInput(value: unknown): NativePublishInput {
  if (!value || typeof value !== "object") throw new Error("Publish body must be an object");
  const record = value as Record<string, unknown>;
  if (typeof record.event !== "string" || !record.event.trim()) throw new Error("event is required");
  if (typeof record.scope !== "string" || !SCOPE_PATTERN.test(record.scope)) throw new Error("Invalid scope");
  if (!("data" in record)) throw new Error("data is required");
  const delivery = deliveryClassSchema.safeParse(record.delivery);
  if (!delivery.success) throw new Error("Invalid delivery class");
  return { event: record.event, scope: record.scope, data: record.data, delivery: delivery.data };
}

function parseUserId(value: unknown): string {
  if (typeof value !== "string" || !USER_ID_PATTERN.test(value)) throw new Error("Invalid userId");
  return value;
}

function rememberSeenIds(seen: string[], ids: readonly string[]): string[] {
  const next = [...seen];
  for (const id of ids) {
    if (!id || next.includes(id)) continue;
    next.push(id);
    if (next.length > MAX_SEEN_IDS) next.shift();
  }
  return next;
}

export class NativeRealtimeDurableObject extends DurableObject<NativeRealtimeDoEnv> {
  /**
   * Sequence allocation, bounded history, presence changes and connection
   * cursors are read-modify-write operations. Serialising them prevents
   * concurrent publishers from allocating the same sequence or losing a write.
   */
  private readonly operations = new SerializedOperations();

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "POST" && url.pathname === "/publish") {
      let input: NativePublishInput;
      try {
        input = parsePublishInput(await request.json());
        const envelope = await this.publish(input);
        return Response.json({ ok: true, envelope });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid publish");
      }
    }
    if (request.method === "GET" && url.pathname === "/presence/count") {
      return Response.json({ count: Object.keys(await this.livePresence()).length });
    }
    if (request.method === "GET" && url.pathname === "/presence/online") {
      return Response.json({ userIds: Object.keys(await this.livePresence()).sort() });
    }
    if (request.method === "GET" && url.pathname === "/presence/is-online") {
      try {
        const userId = parseUserId(url.searchParams.get("userId"));
        return Response.json({ online: Boolean((await this.livePresence())[userId]) });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid userId");
      }
    }
    if (request.method === "POST" && (url.pathname === "/presence/online" || url.pathname === "/presence/offline")) {
      try {
        const body = await request.json() as { userId?: unknown };
        const userId = parseUserId(body.userId);
        if (url.pathname === "/presence/online") await this.markOnline(userId);
        else await this.markOffline(userId);
        return Response.json({ ok: true });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid presence request");
      }
    }
    if (request.method === "POST" && url.pathname === "/presence/emit-user") {
      try {
        const body = await request.json() as { userId?: unknown; event?: unknown; payload?: unknown };
        const userId = parseUserId(body.userId);
        if (typeof body.event !== "string" || !body.event.trim()) throw new Error("event is required");
        await this.emitUser(userId, body.event, body.payload ?? {});
        return Response.json({ ok: true });
      } catch (error) {
        return badRequest(error instanceof Error ? error.message : "Invalid user event");
      }
    }
    if (request.method === "GET" && url.pathname === "/history") {
      const scope = url.searchParams.get("scope") ?? "";
      if (!SCOPE_PATTERN.test(scope)) return badRequest("Invalid scope");
      return Response.json({ envelopes: await this.ctx.storage.get<NativeEnvelope[]>(this.historyKey(scope)) ?? [] });
    }
    if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket") {
      return new Response("WebSocket upgrade required", { status: 400 });
    }
    const scope = url.searchParams.get("scope") ?? "";
    if (!SCOPE_PATTERN.test(scope)) return new Response("Invalid scope", { status: 400 });

    // Authentication and resource membership must be enforced by the Worker
    // before it creates a stub for this object in a later wired slice.
    const connectionId = globalThis.crypto.randomUUID();
    const pair = new WebSocketPair();
    const client = pair[0];
    const server = pair[1];
    server.accept();
    server.serializeAttachment({ connectionId, scope } satisfies NativeAttachment);
    await this.ctx.storage.put<NativeConnectionState>(this.connectionKey(connectionId), {
      scope,
      lastSeq: 0,
      seenIds: [],
    });
    return new Response(null, { status: 101, webSocket: client });
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    const attachment = attachmentOf(ws);
    if (!attachment) {
      ws.close(1008, "Missing connection attachment");
      return;
    }
    if (typeof message !== "string") {
      ws.send(errorFrame("INVALID_FRAME", "Binary frames are not supported"));
      return;
    }

    let value: unknown;
    try {
      value = JSON.parse(message);
    } catch {
      ws.send(errorFrame("INVALID_JSON", "Frame is not valid JSON"));
      return;
    }

    const command = nativeCommandSchema.safeParse(value);
    if (command.success) {
      if (command.data.scope !== attachment.scope) {
        ws.send(errorFrame("SCOPE_MISMATCH", "Command scope does not match the connection"));
        return;
      }
      const candidate = await this.authorizeCommand(command.data, attachment.connectionId, ws);
      const ack = nativeCommandAckSchema.safeParse(candidate);
      if (!ack.success) {
        ws.send(errorFrame("INVALID_ACK", "Command handler returned an invalid ack"));
        return;
      }
      ws.send(JSON.stringify(ack.data));
      return;
    }

    const resume = nativeResumeSchema.safeParse(value);
    if (!resume.success || resume.data.scope !== attachment.scope) {
      ws.send(errorFrame("UNSUPPORTED_FRAME", "Only matching-scope resume and command frames are supported"));
      return;
    }

    await this.operations.run(() => this.resumeOnce(ws, attachment, resume.data));
  }

  async webSocketClose(ws: WebSocket): Promise<void> {
    const attachment = attachmentOf(ws);
    if (attachment) await this.ctx.storage.delete(this.connectionKey(attachment.connectionId));
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    await this.webSocketClose(ws);
  }

  /** Authoritative publishers call this after the source write commits. */
  async publish(input: NativePublishInput): Promise<NativeEnvelope> {
    return this.operations.run(() => this.publishOnce(input));
  }

  async markOnline(userId: string): Promise<void> {
    parseUserId(userId);
    await this.operations.run(async () => {
      const presence = await this.livePresence();
      presence[userId] = Date.now();
      await this.ctx.storage.put(PRESENCE_KEY, presence);
    });
    await this.publish({ event: "user:online", scope: "public", delivery: "ephemeral", data: { userId } });
  }

  async markOffline(userId: string): Promise<void> {
    parseUserId(userId);
    await this.operations.run(async () => {
      const presence = await this.livePresence();
      delete presence[userId];
      await this.ctx.storage.put(PRESENCE_KEY, presence);
    });
    await this.publish({ event: "user:offline", scope: "public", delivery: "ephemeral", data: { userId } });
  }

  async emitUser(userId: string, event: string, payload: unknown): Promise<void> {
    parseUserId(userId);
    await this.publish({ event, scope: `user:${userId}`, delivery: "invalidation", data: payload });
  }

  private async livePresence(): Promise<PresenceRecord> {
    const presence = await this.ctx.storage.get<PresenceRecord>(PRESENCE_KEY) ?? {};
    const now = Date.now();
    let expired = false;
    for (const [userId, seenAt] of Object.entries(presence)) {
      if (now - seenAt <= PRESENCE_TTL_MS) continue;
      delete presence[userId];
      expired = true;
    }
    if (expired) await this.ctx.storage.put(PRESENCE_KEY, presence);
    return presence;
  }

  private async publishOnce(input: NativePublishInput): Promise<NativeEnvelope> {
    const seqKey = this.sequenceKey(input.scope);
    const seq = (await this.ctx.storage.get<number>(seqKey)) ?? 0;
    const nextSeq = seq + 1;
    const envelope = nativeEnvelopeSchema.parse({
      v: NATIVE_PROTOCOL_VERSION,
      id: globalThis.crypto.randomUUID(),
      seq: nextSeq,
      event: input.event,
      scope: input.scope,
      delivery: input.delivery,
      at: Date.now(),
      ackRequired: false,
      data: input.data,
    });

    await Promise.all([
      this.ctx.storage.put(seqKey, nextSeq),
      this.appendHistory(input.scope, envelope),
    ]);

    for (const ws of this.ctx.getWebSockets()) {
      const attachment = attachmentOf(ws);
      if (!attachment || attachment.scope !== input.scope) continue;
      const state = await this.connectionState(attachment.connectionId, input.scope);
      if (state.seenIds.includes(envelope.id) || envelope.seq <= state.lastSeq) continue;
      state.seenIds = rememberSeenIds(state.seenIds, [envelope.id]);
      state.lastSeq = envelope.seq;
      await this.ctx.storage.put(this.connectionKey(attachment.connectionId), state);
      this.safeSend(ws, JSON.stringify(envelope));
    }
    return envelope;
  }

  /**
   * Override in a wired subclass after the authoritative write commits. The
   * default rejects commands so an unwired adapter cannot claim success.
   */
  protected async authorizeCommand(
    command: NativeCommandFrame,
    _connectionId: string,
    _ws: WebSocket
  ): Promise<NativeCommandAck> {
    return {
      v: NATIVE_PROTOCOL_VERSION,
      type: "ack",
      commandId: command.commandId,
      committed: false,
      error: "Command handling is not configured",
    };
  }

  private async resumeOnce(ws: WebSocket, attachment: NativeAttachment, frame: NativeResume): Promise<void> {
    const state = await this.connectionState(attachment.connectionId, attachment.scope);
    state.lastSeq = frame.afterSeq;
    state.seenIds = rememberSeenIds([], frame.seenIds);
    await this.ctx.storage.put(this.connectionKey(attachment.connectionId), state);

    const history = await this.ctx.storage.get<NativeEnvelope[]>(this.historyKey(attachment.scope)) ?? [];
    for (const envelope of history) {
      if (envelope.seq <= frame.afterSeq || state.seenIds.includes(envelope.id)) continue;
      state.seenIds = rememberSeenIds(state.seenIds, [envelope.id]);
      state.lastSeq = Math.max(state.lastSeq, envelope.seq);
      this.safeSend(ws, JSON.stringify(envelope));
    }
    await this.ctx.storage.put(this.connectionKey(attachment.connectionId), state);
  }

  private async connectionState(connectionId: string, scope: string): Promise<NativeConnectionState> {
    return (await this.ctx.storage.get<NativeConnectionState>(this.connectionKey(connectionId))) ?? {
      scope,
      lastSeq: 0,
      seenIds: [],
    };
  }

  private async appendHistory(scope: string, envelope: NativeEnvelope): Promise<void> {
    const history = await this.ctx.storage.get<NativeEnvelope[]>(this.historyKey(scope)) ?? [];
    history.push(envelope);
    if (history.length > MAX_HISTORY) history.splice(0, history.length - MAX_HISTORY);
    await this.ctx.storage.put(this.historyKey(scope), history);
  }

  private safeSend(ws: WebSocket, text: string): void {
    try {
      ws.send(text);
    } catch {
      // A closed socket is cleaned up by webSocketClose; do not fail the publish.
    }
  }

  private connectionKey(connectionId: string): string {
    return `native:conn:${connectionId}`;
  }

  private historyKey(scope: string): string {
    return `native:history:${scope}`;
  }

  private sequenceKey(scope: string): string {
    return `native:seq:${scope}`;
  }
}
