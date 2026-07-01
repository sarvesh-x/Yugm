import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Radio, Video } from "lucide-react-native";
import type { Room } from "@/lib/types";
import { colors } from "@/theme/colors";

export function RoomCard({ room, onPress, wide = false }: { room: Room; onPress: () => void; wide?: boolean }) {
  const Icon = room.type === "VOICE" ? Radio : Video;
  return (
    <Pressable onPress={onPress} style={[styles.wrap, wide && styles.wide]}>
      <ImageBackground source={{ uri: room.coverImage }} resizeMode="cover" style={styles.image} imageStyle={styles.imageRadius}>
        <LinearGradient colors={["rgba(5,7,19,0.05)", "rgba(5,7,19,0.92)"]} style={styles.overlay}>
          <View style={styles.top}>
            <View style={styles.live}><Text style={styles.liveText}>LIVE</Text></View>
            <View style={styles.type}><Icon color={colors.text} size={14} /><Text style={styles.typeText}>{room.type}</Text></View>
          </View>
          <Text style={styles.title} numberOfLines={2}>{room.title}</Text>
          <View style={styles.meta}>
            <Text style={styles.host} numberOfLines={1}>{room.hostId?.name ?? "Yugm Host"}</Text>
            <Text style={styles.count}>{room.participantCount} listening</Text>
          </View>
          <View style={styles.tags}>
            <Text style={styles.pill}>{room.language}</Text>
            <Text style={styles.pill}>{room.category}</Text>
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 220, height: 210, marginRight: 14, borderRadius: 8, overflow: "hidden", backgroundColor: colors.panel },
  wide: { width: "100%", height: 176, marginRight: 0, marginBottom: 14 },
  image: { flex: 1 },
  imageRadius: { borderRadius: 8 },
  overlay: { flex: 1, padding: 14, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  live: { backgroundColor: colors.pink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  liveText: { color: colors.text, fontWeight: "900", fontSize: 11 },
  type: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.38)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  typeText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  meta: { gap: 2 },
  host: { color: colors.text, fontWeight: "800" },
  count: { color: colors.muted, fontSize: 12 },
  tags: { flexDirection: "row", gap: 8 },
  pill: { color: colors.gold, fontSize: 11, fontWeight: "800", backgroundColor: "rgba(246,180,75,0.13)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }
});
