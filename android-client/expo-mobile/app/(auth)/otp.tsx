import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Screen } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

export default function Otp() {
  const { identifier } = useLocalSearchParams<{ identifier: string }>();
  if (!identifier) { return <Screen><Text style={{ color: colors.danger, padding: 24 }}>Missing identifier param</Text></Screen>; }
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);

  async function verify() {
    if (!identifier) { setError("Missing identifier"); return; }
    setLoading(true);
    try {
      const isEmail = identifier?.includes("@");
      const payload = isEmail ? { email: identifier, otp } : { phone: identifier, otp };
      const session = await authApi.verifyOtp(payload);
      await setSession(session.token, session.user);
      router.replace("/(auth)/create-profile");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}><View style={styles.wrap}>
        <View>
          <Text style={styles.title}>Verify OTP</Text>
          <Text style={styles.subtitle}>Code sent to {identifier ?? "your contact"}</Text>
          <TextInput value={otp} onChangeText={setOtp} keyboardType="number-pad" style={styles.input} maxLength={6} />
          {!!error && <Text style={styles.error}>{error}</Text>}
        </View>
        <Pressable onPress={verify} disabled={loading}>
          <LinearGradient colors={gradients.fire} style={styles.cta}>
            <Text style={styles.ctaText}>Verify and continue</Text>
          </LinearGradient>
        </Pressable>
      </View></KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  subtitle: { color: colors.muted, marginTop: 8, marginBottom: 26 },
  input: { height: 62, borderRadius: 8, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, color: colors.text, fontSize: 24, letterSpacing: 0, fontWeight: "900" },
  error: { color: colors.danger, marginTop: 10 },
  cta: { height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ctaText: { color: colors.text, fontWeight: "900", fontSize: 16 }
});
