import { Pressable, StyleSheet, Text, View } from "react-native";
import { AlertTriangle } from "lucide-react-native";
import { colors } from "@/theme/colors";

export function ErrorState({ message = "Something went wrong", onRetry }: { message?: string; onRetry?: () => void }) {
  return (
    <View style={styles.center}>
      <AlertTriangle color={colors.danger} size={32} />
      <Text style={styles.text}>{message}</Text>
      {onRetry && (
        <Pressable style={styles.retry} onPress={onRetry}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 },
  text: { color: colors.muted, marginTop: 12, fontWeight: "800", textAlign: "center" },
  retry: { marginTop: 16, height: 42, paddingHorizontal: 24, borderRadius: 8, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  retryText: { color: colors.text, fontWeight: "900" }
});
