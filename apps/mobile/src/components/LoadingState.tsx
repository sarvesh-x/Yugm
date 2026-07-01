import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";

export function LoadingState({ message = "Loading..." }: { message?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator size="large" color={colors.gold} />
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  text: { color: colors.muted, marginTop: 12, fontWeight: "800" }
});
