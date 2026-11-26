// Minimal declaration for the Node/runtime typecheck. The Worker typecheck uses
// @cloudflare/workers-types and does not include this file.
declare module "cloudflare:workers" {
  interface MinimalDurableObjectStorage {
    get<T = unknown>(key: string): Promise<T | undefined>;
    put<T = unknown>(key: string, value: T): Promise<void>;
    delete(key: string): Promise<boolean>;
    getAlarm(): Promise<number | null>;
    setAlarm(scheduledTime: number): Promise<void>;
    deleteAlarm(): Promise<void>;
  }
  export abstract class DurableObject<Env = unknown, Props = unknown> {
    protected ctx: {
      storage: MinimalDurableObjectStorage;
      getWebSockets(): WebSocket[];
      acceptWebSocket(ws: WebSocket): void;
      props?: Props;
    };
    protected env: Env;
    constructor(ctx: {
      storage: MinimalDurableObjectStorage;
      getWebSockets(): WebSocket[];
      acceptWebSocket(ws: WebSocket): void;
      props?: Props;
    }, env: Env);
  }
}
