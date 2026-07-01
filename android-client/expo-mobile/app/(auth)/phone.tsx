import { useState, useRef } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import auth from "@react-native-firebase/auth";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Screen } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

export default function PhoneAuth() {
  const [phone, setPhone] = useState("+91");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const confirmationRef = useRef<any>(null);
  const setSession = useAuthStore((state) => state.setSession);

  async function sendOtp() {
    setError("");
    setLoading(true);
    try {
      const confirmation = await auth().signInWithPhoneNumber(phone);
      confirmationRef.current = confirmation;
      setStep("otp");
    } catch (err: any) {
      if (err.message?.includes("configuration_not_found")) {
        setError("Firebase not configured. Add google-services.json to app/ and enable Phone Auth in Firebase Console.");
      } else {
        setError(err.message ?? "Failed to send OTP");
      }
    } finally {
      setLoading(false);
    }
  }

  async function verifyOtp() {
    setError("");
    setLoading(true);
    try {
      if (!confirmationRef.current) throw new Error("No confirmation started. Please request OTP first.");
      const credential = await confirmationRef.current.confirm(otp);
      if (!credential?.user) throw new Error("Could not retrieve Firebase credential");
      const idToken = await credential.user.getIdToken();
      if (!idToken) throw new Error("Could not retrieve Firebase token");
      const session = await authApi.phone(idToken);
      await setSession(session.token, session.user); // WARNING: navigation happens even if setSession fails — ensure setSession throws on failure
      router.replace("/(auth)/create-profile");
    } catch (err: any) {
      const msg = typeof err === "object" && err !== null ? err.message : String(err);
      if (typeof msg === "string" && msg.includes("configuration_not_found")) {
        setError("Firebase not configured. Add google-services.json to app/ and enable Phone Auth in Firebase Console.");
      } else {
        setError(msg ?? "Verification failed");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}><View style={styles.wrap}>
        <Text style={styles.title}>{step === "phone" ? "Enter phone number" : "Verify OTP"}</Text>
        <Text style={styles.subtitle}>
          {step === "phone"
            ? "You will receive a one-time code via SMS."
            : `Code sent to ${phone}`}
        </Text>
        {step === "phone" ? (
          <>
            <TextInput
              value={phone}
              onChangeText={setPhone}
              placeholder="+911234567890"
              placeholderTextColor={colors.muted}
              style={styles.input}
              keyboardType="phone-pad"
              autoCapitalize="none"
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={sendOtp} disabled={loading}>
              <LinearGradient colors={gradients.fire} style={styles.cta}>
                {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.ctaText}>Send code</Text>}
              </LinearGradient>
            </Pressable>
          </>
        ) : (
          <>
            <TextInput
              value={otp}
              onChangeText={setOtp}
              placeholder="000000"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.otpInput]}
              keyboardType="number-pad"
              maxLength={6}
            />
            {!!error && <Text style={styles.error}>{error}</Text>}
            <Pressable onPress={verifyOtp} disabled={loading}>
              <LinearGradient colors={gradients.fire} style={styles.cta}>
                {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.ctaText}>Verify</Text>}
              </LinearGradient>
            </Pressable>
            <Pressable onPress={() => { setStep("phone"); setError(""); }} style={{ marginTop: 14 }}>
              <Text style={{ color: colors.gold, textAlign: "center", fontWeight: "700" }}>Change number</Text>
            </Pressable>
          </>
        )}
        <Pressable onPress={() => router.back()} style={{ marginTop: 12 }}>
          <Text style={{ color: colors.muted, textAlign: "center" }}>Back</Text>
        </Pressable>
      </View></KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, padding: 24, justifyContent: "center" },
  title: { color: colors.text, fontSize: 28, fontWeight: "900", marginBottom: 8 },
  subtitle: { color: colors.muted, marginBottom: 28 },
  input: { height: 56, borderRadius: 8, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, paddingHorizontal: 16, color: colors.text, fontSize: 16 },
  otpInput: { fontSize: 24, letterSpacing: 8, textAlign: "center" },
  error: { color: colors.danger, marginTop: 10 },
  cta: { height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 16 },
  ctaText: { color: colors.text, fontWeight: "900", fontSize: 16 },
});
