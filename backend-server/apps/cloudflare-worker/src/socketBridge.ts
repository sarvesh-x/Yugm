import { EventEmitter } from "node:events";
import { Buffer } from "node:buffer";

// The Socket.IO Node server already owns authentication, room membership,
// acknowledgements and event routing. Its Engine.IO websocket transport only
// needs the small `ws` interface implemented here. This compatibility bridge
// is experimental and depends on the locked Engine.IO implementation.
class WorkerWebSocket extends EventEmitter {
  constructor(private readonly socket: WebSocket, private readonly maxBytes: number) {
    super();
    socket.addEventListener("message", (event) => {
      const data = event.data;
      const size = typeof data === "string" ? Buffer.byteLength(data) : data instanceof ArrayBuffer ? data.byteLength : Infinity;
      if (size > this.maxBytes) {
        socket.close(1009, "Message too large");
        return;
      }
      this.emit("message", typeof data === "string" ? data : Buffer.from(data as ArrayBuffer), typeof data !== "string");
    });
    socket.addEventListener("close", () => this.emit("close"));
    socket.addEventListener("error", () => this.emit("error", new Error("WebSocket transport error")));
  }

  send(data: string | Buffer, callback?: (error?: Error) => void) {
    try {
      this.socket.send(typeof data === "string" ? data : new Uint8Array(data));
      callback?.();
    } catch (error) {
      callback?.(error instanceof Error ? error : new Error(String(error)));
    }
  }

  close() { this.socket.close(); }
}

export type EngineBridge = {
  opts: { maxHttpBufferSize: number };
  verify(request: object, upgrade: boolean, callback: (code?: number) => void): void;
  handshake(transport: string, request: object, close: (code?: number) => void): Promise<unknown>;
};

export async function handleSocketUpgrade(request: Request, engine: EngineBridge): Promise<Response> {
  const url = new URL(request.url);
  if (request.method !== "GET" || request.headers.get("Upgrade")?.toLowerCase() !== "websocket" ||
      url.searchParams.get("transport") !== "websocket" || url.searchParams.get("EIO") !== "4" ||
      url.searchParams.has("sid")) {
    return new Response("Unsupported Socket.IO connection", { status: 400 });
  }

  const headers = Object.fromEntries(request.headers.entries());
  const query = Object.fromEntries(url.searchParams.entries());
  const engineRequest: Record<string, unknown> = {
    method: request.method,
    url: `${url.pathname}${url.search}`,
    headers,
    _query: query,
    connection: { encrypted: url.protocol === "https:", remoteAddress: headers["cf-connecting-ip"] ?? "" }
  };
  const verification = await new Promise<number | undefined>((resolve) => engine.verify(engineRequest, true, resolve));
  if (verification !== undefined) return new Response("Invalid Socket.IO connection", { status: 400 });

  const pair = new WebSocketPair();
  const client = pair[0];
  const server = pair[1];
  server.accept();
  const bridge = new WorkerWebSocket(server, engine.opts.maxHttpBufferSize);
  // Attach a listener before Engine.IO owns the socket; EventEmitter treats an
  // unhandled error as an exception.
  bridge.on("error", () => {});
  engineRequest.websocket = bridge;
  const transport = await engine.handshake("websocket", engineRequest, () => server.close(1002, "Handshake failed"));
  if (!transport) return new Response("Socket.IO handshake failed", { status: 400 });
  return new Response(null, { status: 101, webSocket: client });
}
