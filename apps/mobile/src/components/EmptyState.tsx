import type { ReactNode } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Inbox } from "lucide-react-native";
import { colors } from "@/theme/colors";

export function EmptyState({ icon, message }: { icon?: ReactNode; message: string }) {
  return (
    <View style={styles.center}>
      {typeof icon === "string" ? <Text style={styles.iconText}>{icon}</Text> : <View style={styles.iconWrap}>{icon ?? <Inbox color={colors.gold} size={32} />}</View>}
      <Text style={styles.text}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 60, paddingHorizontal: 20 },
  iconText: { fontSize: 48, marginBottom: 12 },
  iconWrap: { marginBottom: 12 },
  text: { color: colors.muted, fontWeight: "800", textAlign: "center", lineHeight: 22 }
});
