export type PushPayload = {
  userId: string;
  title: string;
  body: string;
  data: Record<string, string>;
};

export type PushJobData = PushPayload & { retryDeviceIds?: string[] };

export type PushDeliveryResult = {
  retryDeviceIds: string[];
  permanentFailures: number;
};

const retryableCodes = new Set([
  "messaging/server-unavailable",
  "messaging/internal-error",
  "messaging/message-rate-exceeded",
  "messaging/device-message-rate-exceeded",
  "messaging/quota-exceeded",
  "app/network-error",
  "app/network-timeout"
]);

export function classifyPushResponses(
  deviceIds: readonly string[],
  responses: readonly { success: boolean; error?: { code: string } }[]
) {
  if (deviceIds.length !== responses.length) {
    throw new Error("Push response count did not match the device count");
  }
  const retryDeviceIds: string[] = [];
  const unregisteredDeviceIds: string[] = [];
  let permanentFailures = 0;
  responses.forEach((response, index) => {
    if (response.success) return;
    const code = response.error?.code;
    if (code === "messaging/registration-token-not-registered") {
      unregisteredDeviceIds.push(deviceIds[index]);
    } else if (code && retryableCodes.has(code)) {
      retryDeviceIds.push(deviceIds[index]);
    } else {
      permanentFailures++;
    }
  });
  return { retryDeviceIds, unregisteredDeviceIds, permanentFailures };
}

export async function deliverPushJob(
  job: { data: PushJobData; updateData(data: PushJobData): Promise<void> },
  send: (data: PushJobData) => Promise<PushDeliveryResult>
) {
  let result: PushDeliveryResult;
  try {
    result = await send(job.data);
  } catch {
    throw new Error("Push delivery attempt failed");
  }
  if (result.permanentFailures) {
    console.warn("Push delivery reported permanent device failures", { count: result.permanentFailures });
  }
  if (result.retryDeviceIds.length === 0) return;

  // Store only device IDs. Each attempt resolves the active registrations for
  // this recipient again, so removed or reassigned tokens are excluded.
  try {
    await job.updateData({ ...job.data, retryDeviceIds: result.retryDeviceIds });
  } catch {
    throw new Error("Could not save push retry targets");
  }
  throw new Error("Push delivery has retryable device failures");
}
