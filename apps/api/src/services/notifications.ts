import { Notification, INotification } from "../models/Notification.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { notifyUser } from "./firebase.js";

export async function createNotification(
  userId: string,
  type: INotification["type"],
  title: string,
  body: string,
  data?: Record<string, unknown>
) {
  const notification = await Notification.create({ userId, type, title, body, data });
  const tokens = await DeviceToken.find({ userId }).lean();
  if (tokens.length > 0) {
    await notifyUser(userId, title, body, { ...data as Record<string, string>, notificationId: notification.id });
  }
  return notification;
}
