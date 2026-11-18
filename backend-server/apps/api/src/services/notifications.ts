import { Notification, INotification } from "../models/Notification.js";
import { DeviceToken } from "../models/DeviceToken.js";
import { emitUser } from "./socket.js";
import { socketEvents } from "@yugm/shared";
import { enqueuePushNotification } from "./jobs.js";
import { User } from "../models/User.js";

const defaultNotificationPreferences = {
  roomInvites: true,
  messages: true,
  gifts: true,
  follows: true,
  hostGoingLive: true,
  wallet: true,
  safety: true,
  marketing: false
};

function preferenceForNotification(type: INotification["type"], title: string, body: string, data?: Record<string, unknown>) {
  if (data?.campaignId) return "marketing";
  switch (type) {
    case "ROOM_INVITE":
    case "SPEAKER_APPROVED": return "roomInvites";
    case "ROOM_LIVE": return "hostGoingLive";
    case "MESSAGE": return "messages";
    case "GIFT": return "gifts";
    case "FOLLOW":
    case "WAVE":
    case "FRIEND_REQUEST":
    case "FRIEND_ACCEPT":
    case "SUBSCRIPTION":
    case "MOMENT":
    case "COMMENT": return "follows";
    case "SYSTEM": {
      const kind = String(data?.type ?? "").toUpperCase();
      const message = `${kind} ${title} ${body}`.toUpperCase();
      if (message.includes("SAFETY") || message.includes("MODERATION") || message.includes("WARNING")) return "safety";
      if (message.includes("WALLET") || message.includes("PAYMENT") || message.includes("REWARD") || message.includes("COINS") || message.includes("PAYOUT")) return "wallet";
      return null;
    }
    default: return null;
  }
}

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
