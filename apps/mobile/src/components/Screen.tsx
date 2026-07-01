import type { PropsWithChildren } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";
import { gradients } from "@/theme/colors";

export function Screen({ children }: PropsWithChildren) {
  return (
    <LinearGradient colors={gradients.screen} style={styles.fill}>
      <SafeAreaView style={styles.safe}>{children}</SafeAreaView>
    </LinearGradient>
  );
}

export function Section({ children }: PropsWithChildren) {
  return <View style={styles.section}>{children}</View>;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  safe: { flex: 1 },
  section: { paddingHorizontal: 20, marginBottom: 22 }
});
