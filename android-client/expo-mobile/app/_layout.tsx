import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Notifications from "expo-notifications";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { notificationsApi } from "@/lib/api";
import { openNotificationTarget } from "@/lib/notificationRouting";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, gcTime: 5 * 60_000, retry: 2, refetchOnReconnect: true },
    mutations: { retry: 0 }
  }
});

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true
  })
});

function OfflineBanner() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    async function init() {
      try {
        const state = await NetInfo.fetch();
        setIsOnline(state.isConnected ?? true);
        unsubscribe = NetInfo.addEventListener((s) => {
          setIsOnline(s.isConnected ?? true);
        });
      } catch {}
    }
    init();
    return () => unsubscribe?.();
  }, []);
  if (isOnline) return null;
  return (
    <View style={styles.banner}>
      <Text style={styles.bannerText}>No internet connection</Text>
    </View>
  );
}

function NotificationBridge() {
  const client = useQueryClient();
  const token = useAuthStore((state) => state.token);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (!hydrated || !token || Platform.OS === "web") return;
    let cancelled = false;
    async function register() {
      try {
        if (Platform.OS === "android") {
          await Notifications.setNotificationChannelAsync("default", {
            name: "Yugm",
            importance: Notifications.AndroidImportance.HIGH
          });
        }
        const permissions = await Notifications.getPermissionsAsync();
        const finalPermissions = permissions.granted ? permissions : await Notifications.requestPermissionsAsync();
        if (!finalPermissions.granted || cancelled) return;
        const deviceToken = await Notifications.getDevicePushTokenAsync();
        const value = typeof deviceToken.data === "string" ? deviceToken.data : String(deviceToken.data);
        await notificationsApi.registerDeviceToken(value, Platform.OS === "ios" ? "ios" : "android");
      } catch (error) {
        console.warn("Push notification registration failed", error);
      }
    }
    register();
    return () => {
      cancelled = true;
    };
  }, [hydrated, token]);

  useEffect(() => {
    const responseSub = Notifications.addNotificationResponseReceivedListener((response) => {
      const data = response.notification.request.content.data ?? {};
      const notificationId = typeof data.notificationId === "string" ? data.notificationId : undefined;
      if (notificationId) {
        notificationsApi.markRead(notificationId).finally(() => client.invalidateQueries({ queryKey: ["notifications"] }));
      }
      openNotificationTarget(data);
    });
    Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) openNotificationTarget(response.notification.request.content.data ?? {});
      })
      .catch(() => {});
    return () => responseSub.remove();
  }, [client]);

  useEffect(() => {
    if (!token) return;
    const socket = getSocket();
    socket.connect();
    const handleNotification = () => client.invalidateQueries({ queryKey: ["notifications"] });
    socket.on("notification:new", handleNotification);
    return () => {
      socket.off("notification:new", handleNotification);
    };
  }, [client, token]);

  return null;
}

export default function RootLayout() {
  const hydrate = useAuthStore((state) => state.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="light" />
        <OfflineBanner />
        <NotificationBridge />
        <Stack screenOptions={{ headerShown: false, animation: "fade_from_bottom" }} />
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "#FF4444",
    paddingVertical: 6,
    paddingHorizontal: 16,
    alignItems: "center",
    zIndex: 9999,
  },
  bannerText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
});
