import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarClock, Mic2, Video } from "lucide-react-native";
import { roomsApi } from "@/lib/api";
import { Screen, Section } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

export default function CreateRoom() {
  const [type, setType] = useState<"VOICE" | "VIDEO">("VOICE");
  const [allowMic, setAllowMic] = useState(true);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    tags: "",
    language: "",
    category: "",
    maxSpeakers: "6",
    coverImage: ""
  });

  const [error, setError] = useState("");

  async function create() {
    setLoading(true);
    setError("");
    try {
      const { room } = await roomsApi.create({
        ...form,
        type,
        visibility,
        allowAudienceMicRequests: allowMic,
        scheduledFor: scheduleLater ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : undefined,
        maxSpeakers: Number(form.maxSpeakers),
        tags: form.tags.split(",").map((tag) => tag.trim()).filter(Boolean)
      });
      if (room.status === "SCHEDULED") router.replace("/(tabs)");
      else router.replace({ pathname: "/room/[id]", params: { id: room._id, type: room.type } });
    } catch (err: any) {
      setError(err?.message ?? "Failed to create room");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Screen>
      <ScrollView>
        <Section>
          <Text style={styles.title}>Create room</Text>
          <View style={styles.segment}>
            <Pressable onPress={() => setType("VOICE")} style={[styles.segmentItem, type === "VOICE" && styles.selected]} disabled={loading}><Mic2 color={colors.text} /><Text style={styles.segmentText}>Voice</Text></Pressable>
            <Pressable onPress={() => setType("VIDEO")} style={[styles.segmentItem, type === "VIDEO" && styles.selected]} disabled={loading}><Video color={colors.text} /><Text style={styles.segmentText}>Video</Text></Pressable>
          </View>
          {Object.entries(form).map(([key, value]) => (
            <TextInput
              key={key}
              value={value}
              onChangeText={(text) => setForm((prev) => ({ ...prev, [key]: text }))}
              placeholder={key}
              placeholderTextColor={colors.muted}
              style={[styles.input, key === "description" && styles.description]}
              multiline={key === "description"}
              editable={!loading}
            />
          ))}
          <View style={styles.option}><Text style={styles.optionText}>Public room</Text><Switch value={visibility === "PUBLIC"} onValueChange={(value) => setVisibility(value ? "PUBLIC" : "PRIVATE")} disabled={loading} /></View>
          <View style={styles.option}><Text style={styles.optionText}>Audience mic requests</Text><Switch value={allowMic} onValueChange={setAllowMic} disabled={loading} /></View>
          <View style={styles.option}><View style={styles.optionLabel}><CalendarClock color={colors.gold} size={18} /><Text style={styles.optionText}>Schedule one hour later</Text></View><Switch value={scheduleLater} onValueChange={setScheduleLater} disabled={loading} /></View>
          <View style={styles.locked}><Text style={styles.lockedText}>NSFW is disabled for the MVP.</Text></View>
          {!!error && <Text style={styles.error}>{error}</Text>}
          <Pressable onPress={create} disabled={loading || !form.title.trim()}>
            <LinearGradient colors={gradients.fire} style={[styles.cta, (loading || !form.title.trim()) && styles.ctaDisabled]}>
              {loading ? <ActivityIndicator color={colors.text} /> : <Text style={styles.ctaText}>{scheduleLater ? "Schedule room" : "Go live"}</Text>}
            </LinearGradient>
          </Pressable>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginVertical: 16 },
  segment: { flexDirection: "row", gap: 10, marginBottom: 14 },
  segmentItem: { flex: 1, height: 58, borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  selected: { borderColor: colors.gold, backgroundColor: "rgba(246,180,75,0.16)" },
  segmentText: { color: colors.text, fontWeight: "900" },
  input: { minHeight: 52, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 14, marginBottom: 12 },
  description: { minHeight: 86, paddingTop: 14 },
  option: { height: 58, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: colors.line },
  optionLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionText: { color: colors.text, fontWeight: "800" },
  locked: { borderRadius: 8, backgroundColor: "rgba(255,91,110,0.12)", padding: 12, marginVertical: 14 },
  lockedText: { color: colors.danger, fontWeight: "800" },
  error: { color: colors.danger, fontWeight: "800", marginBottom: 12 },
  cta: { height: 56, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.text, fontWeight: "900", fontSize: 16 }
});
