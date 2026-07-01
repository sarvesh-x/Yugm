import { useState } from "react";
import { Pressable, StyleSheet, Text, View, Dimensions } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck, Video, Heart, Compass, Sparkles, MessageCircle } from "lucide-react-native";
import { BrandMark } from "@/components/BrandMark";
import { Screen } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

const { width } = Dimensions.get("window");

export default function Onboarding() {
  const [step, setStep] = useState(0);

  const screens = [
    {
      title: "Match the vibe.",
      subtitle: "Meet people through profiles, voice rooms, and live moments.",
      icon: <Compass color={colors.pink} size={80} />,
      bgGradient: gradients.calm
    },
    {
      title: "Go live, not lonely.",
      subtitle: "Join voice and video rooms where conversations actually happen.",
      icon: <Video color={colors.cyan} size={80} />,
      bgGradient: gradients.calm
    },
    {
      title: "Safe connections.",
      subtitle: "Verified profiles, report tools, and privacy controls built in.",
      icon: <ShieldCheck color={colors.success} size={80} />,
      bgGradient: gradients.calm
    },
    {
      title: "Start your Yugm.",
      subtitle: "Connect with people who share your energy tonight.",
      icon: <Sparkles color={colors.gold} size={80} />,
      bgGradient: gradients.calm
    }
  ];

  const current = screens[step];

  function handleNext() {
    if (step < 3) {
      setStep(step + 1);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.header}>
          <BrandMark compact />
          {step < 3 && (
            <Pressable onPress={() => setStep(3)}>
              <Text style={styles.skipText}>Skip</Text>
            </Pressable>
          )}
        </View>

        {/* Center Graphic */}
        <View style={styles.centerWrap}>
          <LinearGradient
            colors={["rgba(138,92,255,0.08)", "rgba(255,62,147,0.08)"]}
            style={styles.graphicCircle}
          >
            {current.icon}
          </LinearGradient>
          
          {/* Mock Floating Vibe Tags */}
          {step === 0 && (
            <>
              <View style={[styles.tag, { top: 20, left: 20, borderColor: colors.pink }]}><Text style={styles.tagText}>⚡ Vibe Match</Text></View>
              <View style={[styles.tag, { bottom: 30, right: 10, borderColor: colors.purple }]}><Text style={styles.tagText}>🎵 Late Night Chill</Text></View>
            </>
          )}
          {step === 1 && (
            <>
              <View style={[styles.tag, { top: 10, right: 30, borderColor: colors.cyan }]}><Text style={styles.tagText}>🎙️ Live Room</Text></View>
              <View style={[styles.tag, { bottom: 40, left: 10, borderColor: colors.gold }]}><Text style={styles.tagText}>📹 Video Chat</Text></View>
            </>
          )}
          {step === 2 && (
            <>
              <View style={[styles.tag, { top: 30, left: 10, borderColor: colors.success }]}><Text style={styles.tagText}>🛡️ Safe Space</Text></View>
              <View style={[styles.tag, { bottom: 20, right: 20, borderColor: colors.text }]}><Text style={styles.tagText}>✅ Verified</Text></View>
            </>
          )}
          {step === 3 && (
            <>
              <View style={[styles.tag, { top: 20, right: 20, borderColor: colors.gold }]}><Text style={styles.tagText}>🔥 Hinglish Jokes</Text></View>
              <View style={[styles.tag, { bottom: 30, left: 20, borderColor: colors.pink }]}><Text style={styles.tagText}>🤝 Friendship</Text></View>
            </>
          )}
        </View>

        {/* Bottom Copy & Navigation */}
        <View style={styles.footer}>
          <Text style={styles.title}>{current.title}</Text>
          <Text style={styles.subtitle}>{current.subtitle}</Text>

          {/* Dots Indicator */}
          <View style={styles.dotsRow}>
            {screens.map((_, i) => (
              <View
                key={i}
                style={[
                  styles.dot,
                  i === step ? styles.dotActive : null,
                  i === step && step === 3 ? { backgroundColor: colors.gold } : null
                ]}
              />
            ))}
          </View>

          {/* Action Buttons */}
          {step < 3 ? (
            <Pressable onPress={handleNext}>
              <LinearGradient colors={gradients.fire} style={styles.nextBtn}>
                <Text style={styles.nextBtnText}>Next</Text>
              </LinearGradient>
            </Pressable>
          ) : (
            <View style={styles.btnCol}>
              <Pressable onPress={() => router.push("/(auth)/login")}>
                <LinearGradient colors={gradients.fire} style={styles.loginBtn}>
                  <Text style={styles.loginBtnText}>Continue with Google / Email</Text>
                </LinearGradient>
              </Pressable>

              <Pressable
                onPress={() => router.push("/(auth)/phone")}
                style={styles.phoneBtn}
              >
                <Text style={styles.phoneBtnText}>Continue with Phone</Text>
              </Pressable>
            </View>
          )}
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: "space-between" },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10
  },
  skipText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "700"
  },
  centerWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    position: "relative"
  },
  graphicCircle: {
    width: 200,
    height: 200,
    borderRadius: 100,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.06)"
  },
  tag: {
    position: "absolute",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    backgroundColor: "rgba(5,7,19,0.85)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 5
  },
  tagText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "800"
  },
  footer: {
    minHeight: 280,
    justifyContent: "flex-end"
  },
  title: {
    color: colors.text,
    fontSize: 34,
    fontWeight: "900",
    textAlign: "center"
  },
  subtitle: {
    color: colors.muted,
    fontSize: 16,
    lineHeight: 24,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 24,
    paddingHorizontal: 10
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
    marginBottom: 28
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.line
  },
  dotActive: {
    width: 24,
    backgroundColor: colors.pink
  },
  nextBtn: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  nextBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  btnCol: {
    gap: 12
  },
  loginBtn: {
    height: 56,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center"
  },
  loginBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  },
  phoneBtn: {
    height: 56,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  phoneBtnText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900"
  }
});
