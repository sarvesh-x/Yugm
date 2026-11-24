import { Notification, INotification } from "../models/Notification.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { emitUser } from "./socket.js";
import { socketEvents } from "@yugm/shared";
import { enqueuePushNotification } from "./jobs.js";
import { User } from "../models/User.js";
import { defaultNotificationPreferences, preferenceForNotification, stringifyNotificationData } from "./notificationPreferences.js";

export async function createNotification(
  userId: string,
  type: INotification["type"],
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const notification = await Notification.create({ userId, type, title, body, data });
  await dispatchNotification(notification);
  return notification;
}

export async function dispatchNotification(notification: INotification) {
  const { type, title, body, data } = notification;
  const userId = notification.userId.toString();
  const preferenceKey = preferenceForNotification(type, title, body, data);
  const user = preferenceKey
    ? await User.findById(userId).select("notificationPreferences").lean().catch(() => null)
    : null;
  const preferences = { ...defaultNotificationPreferences, ...(user?.notificationPreferences ?? {}) };
  if (preferenceKey && preferences[preferenceKey as keyof typeof preferences] === false) return notification;

  emitUser(userId, socketEvents.notificationNew, { notification });

  if (data?.type === "BONDS") {
    const bondUser = await User.findById(userId).select("bondNotifications").lean();
    if (bondUser?.bondNotifications === false) return notification;
  }
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
