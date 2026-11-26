/**
 * Host-neutral realtime publisher. Publishers are callbacks supplied by the
 * runtime; D1 state is committed before the port is called and delivery is
 * best effort. No Socket.IO, Redis or Durable Object type crosses this seam.
 */
import type { NativePublishInput } from "@yugm/shared";

export type D1RealtimePublish = NativePublishInput;

export interface D1RealtimePort {
  publish(input: D1RealtimePublish): Promise<void> | void;
}

export const noD1Realtime: D1RealtimePort = {
  publish: () => {}
};

export async function emitD1Realtime(port: D1RealtimePort, input: D1RealtimePublish) {
  try {
    await port.publish(input);
  } catch {
    // A failed socket delivery must not rewrite or invalidate an authoritative commit.
    console.warn("D1 realtime publish failed", input.event, input.scope);
  }
}
