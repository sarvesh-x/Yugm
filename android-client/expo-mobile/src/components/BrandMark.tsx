import { StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { colors, gradients } from "@/theme/colors";

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <View style={styles.row}>
      <LinearGradient colors={gradients.fire} style={[styles.mark, compact && styles.markSmall]}>
        <Text style={[styles.y, compact && styles.ySmall]}>Y</Text>
      </LinearGradient>
      <View>
        <Text style={[styles.name, compact && styles.nameSmall]}>Yugm</Text>
        {!compact && <Text style={styles.tagline}>Match the vibe.</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  mark: { height: 52, width: 52, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  markSmall: { height: 36, width: 36, borderRadius: 12 },
  y: { color: colors.text, fontSize: 28, fontWeight: "900" },
  ySmall: { fontSize: 20 },
  name: { color: colors.text, fontSize: 30, fontWeight: "900" },
  nameSmall: { fontSize: 22 },
  tagline: { color: colors.gold, fontSize: 13, fontWeight: "700", marginTop: -2 }
});
