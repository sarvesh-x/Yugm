import { router } from "expo-router";

type NotificationLike = {
  type?: string;
  data?: Record<string, unknown>;
};

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

export function routeNotificationTarget(input: NotificationLike | Record<string, unknown>) {
  const data = ("data" in input ? input.data ?? {} : input) as Record<string, unknown>;
  const type = "type" in input ? input.type : undefined;
  const clanId = stringValue(data.clanId);
  const roomId = stringValue(data.roomId);
  const partnerId = stringValue(data.partnerId);
  const userId = stringValue(data.userId);

  if (clanId) return { pathname: "/(tabs)/clan" as const };
  if (roomId) return { pathname: "/room/[id]" as const, params: { id: roomId, type: stringValue(data.callType) } };
  if (partnerId) return { pathname: "/chat/[userId]" as const, params: { userId: partnerId } };
  if ((type === "FOLLOW" || userId) && userId) return { pathname: "/profile/[id]" as const, params: { id: userId } };
  return null;
}

export function openNotificationTarget(input: NotificationLike | Record<string, unknown>) {
  const target = routeNotificationTarget(input);
  if (target) router.push(target as any);
  return Boolean(target);
}
