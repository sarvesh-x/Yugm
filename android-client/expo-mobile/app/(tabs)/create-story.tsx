import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Image, ActivityIndicator } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { X, ImagePlus } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { uploadStoryMedia, storiesApi } from "@/lib/api";
import { colors } from "@/theme/colors";

const BG_COLORS = ["#050713", "#1a1a2e", "#16213e", "#0f3460", "#533483", "#e94560", "#f5a623", "#32d583"];

export default function CreateStory() {
  const [media, setMedia] = useState<{ uri: string; type: "IMAGE" | "VIDEO" } | null>(null);
  const [caption, setCaption] = useState("");
  const [bgColor, setBgColor] = useState(BG_COLORS[0]);
  const [uploading, setUploading] = useState(false);

  const pickMedia = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Gallery access is required to create a story.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setMedia({
        uri: asset.uri,
        type: asset.type === "video" ? "VIDEO" : "IMAGE",
      });
    }
  };

  const handleSubmit = async () => {
    if (!media) {
      Alert.alert("Select media", "Pick an image or video for your story.");
      return;
    }
    setUploading(true);
    try {
      const uploaded = await uploadStoryMedia({
        uri: media.uri,
        type: media.type === "VIDEO" ? "video/mp4" : "image/jpeg",
      });
      await storiesApi.create({
        mediaUrl: uploaded.url,
        mediaType: uploaded.type,
        caption: caption.trim() || undefined,
        backgroundColor: bgColor,
      });
      router.back();
    } catch (err: any) {
      Alert.alert("Error", err.message ?? "Failed to create story.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={12}>
            <X color={colors.text} size={24} />
          </Pressable>
          <Text style={styles.title}>Add Story</Text>
          <View style={{ width: 24 }} />
        </View>

        <Pressable style={[styles.mediaArea, { backgroundColor: bgColor }]} onPress={pickMedia}>
          {media ? (
            media.type === "VIDEO" ? (
              <View style={styles.videoPlaceholder}>
                <ImagePlus color={colors.text} size={40} />
                <Text style={styles.mediaHint}>Video selected</Text>
              </View>
            ) : (
              <Image source={{ uri: media.uri }} style={styles.preview} resizeMode="contain" />
            )
          ) : (
            <View style={styles.placeholder}>
              <ImagePlus color={colors.muted} size={48} />
              <Text style={styles.placeholderText}>Tap to pick an image or video</Text>
            </View>
          )}
        </Pressable>

        <TextInput
          style={styles.captionInput}
          placeholder="Write a caption..."
          placeholderTextColor={colors.muted}
          value={caption}
          onChangeText={setCaption}
          maxLength={150}
        />

        <Text style={styles.label}>Background Color</Text>
        <View style={styles.colorRow}>
          {BG_COLORS.map((c) => (
            <Pressable
              key={c}
              onPress={() => setBgColor(c)}
              style={[styles.colorSwatch, { backgroundColor: c }, bgColor === c && styles.colorSwatchActive]}
            />
          ))}
        </View>

        <Pressable
          style={[styles.submitBtn, (!media || uploading) && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={!media || uploading}
        >
          {uploading ? (
            <ActivityIndicator color={colors.text} />
          ) : (
            <Text style={styles.submitText}>Post Story</Text>
          )}
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingBottom: 48 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "900" },
  mediaArea: {
    width: "100%",
    height: 320,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.line,
  },
  placeholder: { alignItems: "center", gap: 12 },
  placeholderText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  videoPlaceholder: { alignItems: "center", gap: 12 },
  mediaHint: { color: colors.text, fontSize: 14, fontWeight: "700" },
  preview: { width: "100%", height: "100%" },
  captionInput: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: 14,
    color: colors.text,
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 16,
  },
  label: { color: colors.text, fontSize: 13, fontWeight: "800", marginBottom: 8 },
  colorRow: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 24 },
  colorSwatch: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
  },
  colorSwatchActive: { borderColor: colors.text },
  submitBtn: {
    backgroundColor: colors.pink,
    height: 50,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { color: colors.text, fontSize: 16, fontWeight: "900" },
});
