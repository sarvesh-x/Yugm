import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthRequest } from "expo-auth-session/providers/google";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { BrandMark } from "@/components/BrandMark";
import { Screen } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

export default function Login() {
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const setSession = useAuthStore((state) => state.setSession);
  const mounted = useRef(true);
  useEffect(() => { return () => { mounted.current = false; }; }, []);

  const [_, googleResponse, googlePrompt] = useAuthRequest({
    iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
    webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  });

  useEffect(() => {
    if (!googleResponse) return;
    if (googleResponse.type === "success") {
      const idToken = googleResponse.params?.id_token;
      if (!idToken) {
        if (mounted.current) setError("Google Sign-In missing id_token");
        return;
      }
      handleGoogle(idToken);
    } else if (googleResponse.type === "error") {
      if (mounted.current) setError("Google Sign-In failed");
    } else if (googleResponse.type === "cancel" || googleResponse.type === "dismiss") {
      if (mounted.current) setError("");
    }
  }, [googleResponse]);

  async function handleGoogle(idToken: string) {
    if (!mounted.current) return;
    setLoading(true);
    setError("");
    try {
      const session = await authApi.google(idToken);
      if (!mounted.current) return;
      await setSession(session.token, session.user);
      if (!mounted.current) return;
      router.replace("/(auth)/create-profile");
    } catch (err: any) {
      if (mounted.current) setError(err.message);
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  async function requestOtp() {
    setError("");
    setLoading(true);
    try {
      const isEmail = identifier.includes("@");
      await authApi.requestOtp(isEmail ? { email: identifier } : { phone: identifier });
      router.push({ pathname: "/(auth)/otp", params: { identifier } });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <View style={styles.wrap}>
        <BrandMark compact />
        <View>
          <Text style={styles.title}>Login to live rooms</Text>
          <Text style={styles.subtitle}>Use email, phone, or Google.</Text>
          <TextInput value={identifier} onChangeText={setIdentifier} placeholder="Phone or email" placeholderTextColor={colors.muted} style={styles.input} autoCapitalize="none" keyboardType="email-address" />
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={requestOtp} disabled={loading}>
            <LinearGradient colors={gradients.fire} style={styles.cta}>
              {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.ctaText}>Send OTP</Text>}
            </LinearGradient>
          </Pressable>
          <View style={styles.divider}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>
          <Pressable onPress={() => googlePrompt()} disabled={loading}>
            <View style={styles.socialButton}>
              <Text style={styles.socialIcon}>G</Text>
              <Text style={styles.socialText}>Continue with Google</Text>
            </View>
          </Pressable>
          <Pressable onPress={() => router.push("/(auth)/phone")} disabled={loading}>
            <View style={styles.socialButton}>
              <Text style={styles.socialIcon}>📱</Text>
              <Text style={styles.socialText}>Continue with phone</Text>
            </View>
          </Pressable>
        </View>
      </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 32, fontWeight: "900" },
  subtitle: { color: colors.muted, marginTop: 8, marginBottom: 26 },
  input: { height: 56, borderRadius: 8, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, color: colors.text, fontSize: 16 },
  error: { color: colors.danger, marginTop: 10 },
  cta: { height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ctaText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  divider: { flexDirection: "row", alignItems: "center", marginVertical: 18 },
  dividerLine: { flex: 1, height: 1, backgroundColor: colors.line },
  dividerText: { color: colors.muted, marginHorizontal: 12, fontSize: 13 },
  socialButton: { height: 52, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, marginBottom: 10 },
  socialIcon: { fontSize: 18, fontWeight: "900" },
  socialText: { color: colors.text, fontWeight: "700", fontSize: 15 },
  hint: { color: colors.muted, textAlign: "center", fontSize: 12 },
});
