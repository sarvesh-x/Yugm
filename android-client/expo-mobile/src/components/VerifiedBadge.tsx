import { View, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { CheckCircle, ShieldCheck } from "lucide-react-native";

interface Props {
  level?: "BASIC" | "ADVANCED" | "NONE";
  size?: number;
}

export function VerifiedBadge({ level = "BASIC", size = 16 }: Props) {
  if (level === "NONE") return null;
  return (
    <View style={[styles.badge, level === "ADVANCED" && styles.advanced]}>
      {level === "ADVANCED" ? (
        <ShieldCheck color={colors.gold} size={size} />
      ) : (
        <CheckCircle color={colors.cyan} size={size} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { marginLeft: 4 },
  advanced: { marginLeft: 4 },
});
