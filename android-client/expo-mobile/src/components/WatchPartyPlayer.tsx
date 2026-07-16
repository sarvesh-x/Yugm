import { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { Video, ResizeMode } from "expo-av";
import { colors } from "@/theme/colors";
import { Play, Pause, X } from "lucide-react-native";

interface Props {
  mediaUrl: string;
  title: string;
  position: number;
  isPlaying: boolean;
  isHost: boolean;
  onSync: (position: number, isPlaying: boolean) => void;
  onStop: () => void;
}

export function WatchPartyPlayer({ mediaUrl, title, position, isPlaying, isHost, onSync, onStop }: Props) {
  const videoRef = useRef<Video>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (loaded && videoRef.current) {
      videoRef.current.setPositionAsync(position * 1000);
    }
  }, [position, loaded]);

  useEffect(() => {
    if (loaded && videoRef.current) {
      if (isPlaying) videoRef.current.playAsync();
      else videoRef.current.pauseAsync();
    }
  }, [isPlaying, loaded]);

  const handlePlaybackStatus = (status: any) => {
    if (!status.isLoaded) return;
    if (isHost) {
      const pos = (status.positionMillis || 0) / 1000;
      onSync(pos, !status.didJustFinish);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {isHost && (
          <Pressable onPress={onStop} hitSlop={8}>
            <X color={colors.danger} size={18} />
          </Pressable>
        )}
      </View>
      <Video
        ref={videoRef}
        source={{ uri: mediaUrl }}
        style={styles.video}
        resizeMode={ResizeMode.CONTAIN}
        shouldPlay={isPlaying}
        isLooping={false}
        onPlaybackStatusUpdate={handlePlaybackStatus}
        onLoad={() => setLoaded(true)}
      />
      <View style={styles.controls}>
        <Pressable onPress={() => isHost && onSync(position, !isPlaying)} style={styles.playBtn}>
          {isPlaying ? <Pause color={colors.text} size={20} /> : <Play color={colors.text} size={20} />}
        </Pressable>
        <Text style={styles.status}>{isPlaying ? "Playing" : "Paused"}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 8,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    marginBottom: 14,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 10,
  },
  title: {
    color: colors.text,
    fontWeight: "900",
    fontSize: 14,
    flex: 1,
  },
  video: {
    width: "100%",
    height: 200,
    backgroundColor: "#000",
  },
  controls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  status: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "700",
  },
});
