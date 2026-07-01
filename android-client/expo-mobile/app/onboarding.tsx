import type { ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Mic2, Sparkles, Video } from "lucide-react-native";
import { BrandMark } from "@/components/BrandMark";
import { Screen } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

export default function Onboarding() {
  return (
    <Screen>
      <View style={styles.wrap}>
        <BrandMark />
        <Text style={styles.headline}>Find the rooms that match your mood tonight.</Text>
        <Text style={styles.body}>Voice lounges, creator video tables, gifts, reactions, and the kind of conversations that do not feel like a profile form.</Text>
        <View style={styles.grid}>
          <Feature icon={<Mic2 color={colors.gold} />} title="Voice rooms" />
          <Feature icon={<Video color={colors.cyan} />} title="Video tables" />
          <Feature icon={<Sparkles color={colors.pink} />} title="Live gifts" />
        </View>
        <Pressable onPress={() => router.push("/(auth)/login")}>
          <LinearGradient colors={gradients.fire} style={styles.cta}>
            <Text style={styles.ctaText}>Start matching the vibe</Text>
          </LinearGradient>
        </Pressable>
      </View>
    </Screen>
  );
}

function Feature({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <View style={styles.feature}>
      {icon}
      <Text style={styles.featureText}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "space-between" },
  headline: { color: colors.text, fontSize: 40, fontWeight: "900", lineHeight: 44, marginTop: 40 },
  body: { color: colors.muted, fontSize: 16, lineHeight: 24, marginTop: 16 },
  grid: { gap: 12 },
  feature: { height: 76, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, flexDirection: "row", alignItems: "center", gap: 14 },
  featureText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  cta: { height: 58, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ctaText: { color: colors.text, fontSize: 16, fontWeight: "900" }
});
