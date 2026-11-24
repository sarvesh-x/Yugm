export const defaultNotificationPreferences = {
  roomInvites: true,
  messages: true,
  gifts: true,
  follows: true,
  hostGoingLive: true,
  wallet: true,
  safety: true,
  marketing: false
};

export function preferenceForNotification(type: string, title: string, body: string, data?: Record<string, unknown>) {
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

export function stringifyNotificationData(data: Record<string, unknown> = {}) {
  return Object.fromEntries(
    Object.entries(data)
      .filter((entry): entry is [string, NonNullable<unknown>] => entry[1] !== undefined && entry[1] !== null)
      .map(([key, value]) => [key, String(value)])
  );
}
