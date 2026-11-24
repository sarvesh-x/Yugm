// Type-only interface for the Worker entry point. The actual runtime is
// checked separately with the API's Node type environment.
import type { EngineBridge } from "./socketBridge.js";
import type { PushDeliveryResult, PushJobData, PushPayload } from "../../api/src/services/pushDelivery.js";
export declare function startApiRuntime(
  bindings: Record<string, unknown>,
  trackBackground: (work: Promise<unknown>) => void,
  pushDispatcher?: (payload: PushPayload) => Promise<void>
): Promise<void>;
export declare function sendQueuedPush(data: PushJobData): Promise<PushDeliveryResult>;
export declare function getSocketEngine(): Promise<EngineBridge>;
export declare function runScheduledMaintenance(): Promise<void>;
export declare function runPkDeadlines(): Promise<void>;
export declare function nextPkDeadline(): Promise<number | undefined>;
