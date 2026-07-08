import type { ReactNode } from "react";
import { Image, Pressable, StyleSheet, Text, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { ResizeMode, Video } from "expo-av";
import { Play } from "lucide-react-native";
import { absoluteMediaUrl } from "@/lib/api";
import { colors } from "@/theme/colors";

type MediaItem = { url?: string; type?: "IMAGE" | "VIDEO"; caption?: string };

type Props = {
  item: MediaItem;
  mode?: "tile" | "viewer";
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
};

export function ProfileMedia({ item, mode = "tile", style, imageStyle }: Props) {
  const uri = absoluteMediaUrl(item.url ?? "");
  if (!uri) return null;
  if (item.type === "VIDEO") {
    return (
      <View style={[mode === "viewer" ? styles.viewerVideoWrap : styles.videoWrap, style]}>
        <Video
          source={{ uri }}
          style={StyleSheet.absoluteFill}
          resizeMode={ResizeMode.COVER}
          useNativeControls={mode === "viewer"}
          shouldPlay={mode === "viewer"}
          isLooping={mode !== "viewer"}
          isMuted={mode !== "viewer"}
        />
        {mode === "tile" && (
          <View style={styles.videoOverlay}>
            <View style={styles.playBadge}>
              <Play color={colors.ink} size={16} fill={colors.ink} />
            </View>
            <Text style={styles.videoLabel}>Video</Text>
          </View>
        )}
      </View>
    );
  }
  return (
    <Image
      source={{ uri }}
      style={[mode === "viewer" ? styles.viewerImage : styles.mediaImage, imageStyle] as any}
      resizeMode={mode === "viewer" ? "contain" : "cover"}
    />
  );
}

export function ProfileMediaButton({ item, onPress, children, style }: Props & { onPress: () => void; children?: ReactNode }) {
  return (
    <Pressable style={style} onPress={onPress}>
      <ProfileMedia item={item} />
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  mediaImage: { width: "100%", height: 118, backgroundColor: colors.panelStrong },
  viewerImage: { width: "100%", height: "72%" },
  videoWrap: { width: "100%", height: 118, overflow: "hidden", backgroundColor: colors.panelStrong },
  viewerVideoWrap: { width: "100%", height: "62%", borderRadius: 8, overflow: "hidden", backgroundColor: colors.panelStrong },
  videoOverlay: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(5,7,19,0.18)", gap: 6 },
  playBadge: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold },
  videoLabel: { color: colors.text, fontSize: 12, fontWeight: "900", textTransform: "uppercase" }
});
