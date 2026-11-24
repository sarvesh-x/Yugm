import { DeviceToken } from "../models/DeviceToken.js";
import { getFirebaseMessaging } from "./firebase.js";
import { classifyPushResponses, type PushJobData } from "./pushDelivery.js";

export async function notifyUser({ userId, title, body, data, retryDeviceIds }: PushJobData) {
  const messaging = await getFirebaseMessaging();
  if (!messaging) return { retryDeviceIds: [], permanentFailures: 0 };
  const tokens = await DeviceToken.find({
    userId,
    ...(retryDeviceIds && { _id: { $in: retryDeviceIds } })
  }).select("token");
  if (!tokens.length) return { retryDeviceIds: [], permanentFailures: 0 };
  const response = await messaging.sendEachForMulticast({
    tokens: tokens.map((item) => item.token),
    notification: { title, body },
    data
  });
  const result = classifyPushResponses(tokens.map((item) => item._id.toString()), response.responses);
  if (result.unregisteredDeviceIds.length) {
    try {
      await DeviceToken.deleteMany({ userId, _id: { $in: result.unregisteredDeviceIds } });
    } catch {
      // Cleanup failure must not cause a repeat send to successful devices.
      console.warn("Could not remove unregistered push devices");
    }
  }
  return result;
}
