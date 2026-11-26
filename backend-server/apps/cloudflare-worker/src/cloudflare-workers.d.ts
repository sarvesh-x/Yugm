// Minimal declaration for the Node/runtime typecheck. The Worker typecheck uses
// @cloudflare/workers-types and does not include this file.
declare module "cloudflare:workers" {
  export abstract class DurableObject<Env = unknown, Props = unknown> {
    protected ctx: {
      storage: {
        getAlarm(): Promise<number | null>;
        setAlarm(scheduledTime: number): Promise<void>;
        deleteAlarm(): Promise<void>;
      };
      props?: Props;
    };
    protected env: Env;
    constructor(ctx: {
      storage: {
        getAlarm(): Promise<number | null>;
        setAlarm(scheduledTime: number): Promise<void>;
        deleteAlarm(): Promise<void>;
      };
      props?: Props;
    }, env: Env);
  }
}
