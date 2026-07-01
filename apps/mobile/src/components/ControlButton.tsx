import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";

export function ControlButton({ icon, label, danger, active, onPress }: { icon: ReactNode; label: string; danger?: boolean; active?: boolean; onPress?: () => void }) {
  return (
    <Pressable onPress={onPress} style={[styles.button, active && styles.active, danger && styles.danger]}>
      {icon}
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: { height: 58, minWidth: 66, borderRadius: 8, alignItems: "center", justifyContent: "center", gap: 3, backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  active: { backgroundColor: "rgba(246,180,75,0.22)", borderColor: colors.gold },
  danger: { backgroundColor: "rgba(255,91,110,0.22)", borderColor: colors.danger },
  label: { color: colors.text, fontSize: 11, fontWeight: "800" }
});
