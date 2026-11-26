// Runtime-typecheck-only declarations for Durable Object WebSocket APIs that
// are absent from the DOM lib. The Worker typecheck uses @cloudflare/workers-types.
interface WebSocket {
  accept(): void;
  deserializeAttachment<T = unknown>(): T;
  serializeAttachment(value: unknown): void;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}

interface ResponseInit {
  webSocket?: WebSocket;
}
