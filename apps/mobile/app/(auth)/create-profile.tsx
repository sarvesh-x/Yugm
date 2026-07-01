import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { categories } from "@yugm/shared";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { Screen } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

export default function CreateProfile() {
  const current = useAuthStore((state) => state.user);
  const updateUser = useAuthStore((state) => state.updateUser);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: current?.name ?? "",
    username: current?.username ?? "",
    age: "",
    gender: "",
    city: "",
    bio: "",
    interests: "",
    languages: ""
  });
  const [selectedInterests, setSelectedInterests] = useState<string[]>(current?.interests ?? []);
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(current?.languages ?? ["Hindi", "English"]);

  async function save() {
    try {
      const { user } = await authApi.updateProfile({
        ...form,
        age: Number(form.age),
        interests: [...new Set([...selectedInterests, ...form.interests.split(",").map((item) => item.trim()).filter(Boolean)])],
        languages: [...new Set([...selectedLanguages, ...form.languages.split(",").map((item) => item.trim()).filter(Boolean)])]
      });
      updateUser(user);
      router.replace("/(tabs)");
    } catch (err: any) {
      setError(err?.message ?? "Failed to save profile");
    }
  }

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}><ScrollView contentContainerStyle={styles.wrap}>
        <Text style={styles.title}>Create your vibe card</Text>
        {Object.entries(form).filter(([key]) => key !== "interests" && key !== "languages").map(([key, value]) => (
          <TextInput
            key={key}
            value={value}
            onChangeText={(text) => setForm((prev) => ({ ...prev, [key]: text }))}
            placeholder={key}
            placeholderTextColor={colors.muted}
            style={[styles.input, key === "bio" && styles.bio]}
            multiline={key === "bio"}
          />
        ))}
        <Text style={styles.label}>Interests</Text>
        <View style={styles.chips}>
          {categories.filter((item) => item !== "Trending").map((item) => {
            const selected = selectedInterests.includes(item);
            return (
              <Pressable key={item} style={[styles.chip, selected && styles.chipActive]} onPress={() => setSelectedInterests((prev) => selected ? prev.filter((value) => value !== item) : [...prev, item])}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={form.interests}
          onChangeText={(text) => setForm((prev) => ({ ...prev, interests: text }))}
          placeholder="extra interests, comma separated"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        <Text style={styles.label}>Languages</Text>
        <View style={styles.chips}>
          {["Hindi", "English", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali", "Urdu"].map((item) => {
            const selected = selectedLanguages.includes(item);
            return (
              <Pressable key={item} style={[styles.chip, selected && styles.chipActive]} onPress={() => setSelectedLanguages((prev) => selected ? prev.filter((value) => value !== item) : [...prev, item])}>
                <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={form.languages}
          onChangeText={(text) => setForm((prev) => ({ ...prev, languages: text }))}
          placeholder="extra languages, comma separated"
          placeholderTextColor={colors.muted}
          style={styles.input}
        />
        {!!error && <Text style={styles.error}>{error}</Text>}
        <Pressable onPress={save}>
          <LinearGradient colors={gradients.fire} style={styles.cta}>
            <Text style={styles.ctaText}>Enter Yugm</Text>
          </LinearGradient>
        </Pressable>
      </ScrollView></KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: 24, gap: 12 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginBottom: 8 },
  input: { minHeight: 52, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 14, fontSize: 15 },
  bio: { minHeight: 92, paddingTop: 14 },
  label: { color: colors.text, fontWeight: "900", marginTop: 4 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, paddingHorizontal: 12, paddingVertical: 9 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontWeight: "800" },
  chipTextActive: { color: colors.ink },
  error: { color: colors.danger, fontWeight: "800", marginBottom: 12 },
  cta: { height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center", marginTop: 12 },
  ctaText: { color: colors.text, fontWeight: "900", fontSize: 16 }
});
