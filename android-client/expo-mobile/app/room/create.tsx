import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { CalendarClock, Mic, Video, ArrowLeft, ShieldAlert } from "lucide-react-native";
import { roomsApi } from "@/lib/api";
import { Screen, Section } from "@/components/Screen";
import { colors, gradients } from "@/theme/colors";

const CATEGORIES = ["Music", "Gaming", "Chill", "Dating", "Friends", "Voice", "Video"];
const LANGUAGES = ["Hindi", "English", "Hinglish", "Tamil", "Telugu", "Kannada", "Marathi", "Bengali", "Urdu"];

export default function CreateRoom() {
  const [type, setType] = useState<"VOICE" | "VIDEO">("VOICE");
  const [allowMic, setAllowMic] = useState(true);
  const [visibility, setVisibility] = useState<"PUBLIC" | "PRIVATE">("PUBLIC");
  const [scheduleLater, setScheduleLater] = useState(false);
  const [loading, setLoading] = useState(false);

  // Form states
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [tags, setTags] = useState("");
  const [language, setLanguage] = useState("Hindi");
  const [category, setCategory] = useState("Chill");
  const [maxSpeakers, setMaxSpeakers] = useState("6");
  const [coverImage, setCoverImage] = useState("");

  const [error, setError] = useState("");

  async function create() {
    if (!title.trim()) {
      setError("Room title is required.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const { room } = await roomsApi.create({
        title,
        description,
        type,
        visibility,
        allowAudienceMicRequests: allowMic,
        scheduledFor: scheduleLater ? new Date(Date.now() + 60 * 60 * 1000).toISOString() : undefined,
        maxSpeakers: Number(maxSpeakers),
        category,
        language,
        coverImage: coverImage || undefined,
        tags: tags.split(",").map((t) => t.trim()).filter(Boolean)
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
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft color={colors.text} size={20} />
        </Pressable>
        <Text style={styles.headerTitle}>Launch Live Room</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollWrap} keyboardShouldPersistTaps="handled">
        <Section>
          {/* Type Selector */}
          <Text style={styles.label}>Select Room Type</Text>
          <View style={styles.segment}>
            <Pressable
              onPress={() => setType("VOICE")}
              style={[styles.segmentItem, type === "VOICE" && styles.selected]}
              disabled={loading}
            >
              <Mic color={type === "VOICE" ? colors.pink : colors.muted} size={20} />
              <Text style={[styles.segmentText, type === "VOICE" && styles.segmentTextActive]}>Voice Lounge</Text>
            </Pressable>
            
            <Pressable
              onPress={() => setType("VIDEO")}
              style={[styles.segmentItem, type === "VIDEO" && styles.selected]}
              disabled={loading}
            >
              <Video color={type === "VIDEO" ? colors.pink : colors.muted} size={20} />
              <Text style={[styles.segmentText, type === "VIDEO" && styles.segmentTextActive]}>Video Table</Text>
            </Pressable>
          </View>

          {/* Title Input */}
          <Text style={styles.label}>Room Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="What should we talk about tonight?"
            placeholderTextColor={colors.muted}
            style={styles.input}
            editable={!loading}
          />

          {/* Description Input */}
          <Text style={styles.label}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Add details, rules, or a room prompt..."
            placeholderTextColor={colors.muted}
            style={[styles.input, styles.description]}
            multiline
            numberOfLines={3}
            editable={!loading}
          />

          {/* Category Chips */}
          <Text style={styles.label}>Category</Text>
          <View style={styles.chipsWrap}>
            {CATEGORIES.map((cat) => {
              const active = category === cat;
              return (
                <Pressable
                  key={cat}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setCategory(cat)}
                  disabled={loading}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{cat}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Language Selection */}
          <Text style={styles.label}>Primary Language</Text>
          <View style={styles.chipsWrap}>
            {LANGUAGES.map((lang) => {
              const active = language === lang;
              return (
                <Pressable
                  key={lang}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setLanguage(lang)}
                  disabled={loading}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{lang}</Text>
                </Pressable>
              );
            })}
          </View>

          {/* Max Speakers & Cover Image */}
          <View style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>Max Speakers</Text>
              <TextInput
                value={maxSpeakers}
                onChangeText={setMaxSpeakers}
                placeholder="6"
                placeholderTextColor={colors.muted}
                style={styles.input}
                keyboardType="number-pad"
                editable={!loading}
              />
            </View>
            <View style={{ width: 16 }} />
            <View style={{ flex: 2 }}>
              <Text style={styles.label}>Cover Image URL (Optional)</Text>
              <TextInput
                value={coverImage}
                onChangeText={setCoverImage}
                placeholder="https://example.com/cover.jpg"
                placeholderTextColor={colors.muted}
                style={styles.input}
                editable={!loading}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Tags */}
          <Text style={styles.label}>Tags (comma separated)</Text>
          <TextInput
            value={tags}
            onChangeText={setTags}
            placeholder="bollywood, valorant, late-night"
            placeholderTextColor={colors.muted}
            style={styles.input}
            editable={!loading}
            autoCapitalize="none"
          />

          {/* Settings Switches */}
          <View style={styles.option}>
            <Text style={styles.optionText}>Public Room</Text>
            <Switch
              value={visibility === "PUBLIC"}
              onValueChange={(value) => setVisibility(value ? "PUBLIC" : "PRIVATE")}
              disabled={loading}
              thumbColor={visibility === "PUBLIC" ? colors.pink : colors.muted}
              trackColor={{ false: colors.line, true: "rgba(255,62,147,0.3)" }}
            />
          </View>

          <View style={styles.option}>
            <Text style={styles.optionText}>Audience Mic Requests</Text>
            <Switch
              value={allowMic}
              onValueChange={setAllowMic}
              disabled={loading}
              thumbColor={allowMic ? colors.pink : colors.muted}
              trackColor={{ false: colors.line, true: "rgba(255,62,147,0.3)" }}
            />
          </View>

          <View style={styles.option}>
            <View style={styles.optionLabel}>
              <CalendarClock color={colors.gold} size={18} />
              <Text style={styles.optionText}>Schedule in 1 Hour</Text>
            </View>
            <Switch
              value={scheduleLater}
              onValueChange={setScheduleLater}
              disabled={loading}
              thumbColor={scheduleLater ? colors.pink : colors.muted}
              trackColor={{ false: colors.line, true: "rgba(255,62,147,0.3)" }}
            />
          </View>

          {/* NSFW Banner */}
          <View style={styles.locked}>
            <ShieldAlert color={colors.danger} size={18} />
            <Text style={styles.lockedText}>Explicit or mature content is strictly moderated.</Text>
          </View>

          {/* Errors & CTA */}
          {!!error && <Text style={styles.error}>{error}</Text>}
          
          <Pressable onPress={create} disabled={loading || !title.trim()} style={styles.ctaPress}>
            <LinearGradient
              colors={gradients.fire}
              style={[styles.cta, (loading || !title.trim()) && styles.ctaDisabled]}
            >
              {loading ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Text style={styles.ctaText}>{scheduleLater ? "Schedule Lounge" : "Go Live Now"}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  scrollWrap: {
    paddingTop: 16,
    paddingBottom: 48
  },
  label: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    marginTop: 14,
    marginBottom: 6
  },
  segment: { flexDirection: "row", gap: 12, marginBottom: 8 },
  segmentItem: {
    flex: 1,
    height: 54,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  selected: { borderColor: colors.pink, backgroundColor: "rgba(255,62,147,0.12)" },
  segmentText: { color: colors.muted, fontWeight: "800" },
  segmentTextActive: { color: colors.text, fontWeight: "900" },
  input: {
    height: 52,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 15
  },
  description: { height: 80, paddingTop: 14, textAlignVertical: "top" },
  row: { flexDirection: "row", alignItems: "center" },
  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginVertical: 4 },
  chip: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.panel,
    paddingHorizontal: 14,
    paddingVertical: 9
  },
  chipActive: {
    backgroundColor: colors.pink,
    borderColor: colors.pink
  },
  chipText: {
    color: colors.muted,
    fontWeight: "700",
    fontSize: 13
  },
  chipTextActive: {
    color: colors.text,
    fontWeight: "800"
  },
  option: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: colors.line
  },
  optionLabel: { flexDirection: "row", alignItems: "center", gap: 8 },
  optionText: { color: colors.text, fontWeight: "800", fontSize: 14 },
  locked: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,91,110,0.08)",
    padding: 14,
    marginVertical: 18,
    borderWidth: 1,
    borderColor: "rgba(255,91,110,0.15)"
  },
  lockedText: { color: colors.danger, fontWeight: "700", fontSize: 13, flex: 1 },
  error: { color: colors.danger, fontWeight: "800", marginBottom: 12, textAlign: "center" },
  ctaPress: { marginTop: 14 },
  cta: { height: 56, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: colors.text, fontWeight: "900", fontSize: 16 }
});
