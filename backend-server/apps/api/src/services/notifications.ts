import { Notification, INotification } from "../models/Notification.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { emitUser } from "./socket.js";
import { socketEvents } from "@yugm/shared";
import { enqueuePushNotification } from "./jobs.js";

function stringifyNotificationData(data: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .filter((entry): entry is [string, NonNullable<unknown>] => entry[1] !== undefined && entry[1] !== null)
      .map(([key, value]) => [key, String(value)])
  );
}

export async function createNotification(
  userId: string,
  type: INotification["type"],
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const notification = await Notification.create({ userId, type, title, body, data });
  emitUser(userId, socketEvents.notificationNew, { notification });
  const tokens = await DeviceToken.find({ userId }).lean();
  if (tokens.length > 0) {
    try {
      await enqueuePushNotification({ userId, title, body, data: { ...stringifyNotificationData(data), notificationId: notification.id } });
    } catch (error) {
      console.warn("Push notification failed (non-fatal):", error instanceof Error ? error.message : String(error));
    }
  }
  return notification;
}
