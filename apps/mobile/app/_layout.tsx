import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import NetInfo from "@react-native-community/netinfo";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { useAuthStore } from "@/store/auth";

const queryClient = new QueryClient();

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
