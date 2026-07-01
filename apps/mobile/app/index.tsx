import { useEffect } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { BrandMark } from "@/components/BrandMark";
import { Screen } from "@/components/Screen";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function Splash() {
  const { token, hydrated, setHydrated } = useAuthStore();

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!hydrated) setHydrated(true);
    }, 5000);
    return () => clearTimeout(timeout);
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated) return;
    router.replace(token ? "/(tabs)" : "/onboarding");
  }, [hydrated, token]);

  return (
    <Screen>
      <View style={styles.center}>
        <BrandMark />
        <Text style={styles.copy}>Live rooms, real people, clean energy.</Text>
        <ActivityIndicator color={colors.gold} style={{ marginTop: 28 }} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  copy: { color: colors.muted, marginTop: 18, textAlign: "center", fontSize: 15 }
});
