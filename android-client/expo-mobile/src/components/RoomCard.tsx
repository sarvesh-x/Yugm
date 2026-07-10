import { ImageBackground, Pressable, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Radio, Video } from "lucide-react-native";
import type { Room } from "@/lib/types";
import { cosmeticPreviewText, nameStyleColors, roomThemeColors } from "@/lib/cosmetics";
import { colors, radii } from "@/theme/colors";
import { CosmeticAvatar } from "@/components/CosmeticAvatar";

export function RoomCard({ room, onPress, wide = false }: { room: Room; onPress: () => void; wide?: boolean }) {
  const Icon = room.type === "VOICE" ? Radio : Video;
  const hostCosmetics = room.hostId?.activeCosmetics;
  const roomColors = roomThemeColors(hostCosmetics?.roomTheme ?? hostCosmetics?.seasonalEvent);
  const hostNameColors = nameStyleColors(hostCosmetics?.nameStyle);
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Join ${room.title}`} style={({ pressed }) => [styles.wrap, wide && styles.wide, pressed && styles.pressed]}>
      <ImageBackground source={{ uri: room.coverImage }} resizeMode="cover" style={styles.image} imageStyle={styles.imageRadius}>
        <LinearGradient colors={room.coverImage ? ["rgba(5,7,19,0.05)", "rgba(5,7,19,0.92)"] : roomColors} style={styles.overlay}>
          <View style={styles.top}>
            <View style={styles.live}><Text style={styles.liveText}>LIVE</Text></View>
            <View style={styles.type}><Icon color={colors.text} size={14} /><Text style={styles.typeText}>{room.type}</Text></View>
          </View>
          <Text style={styles.title} numberOfLines={2}>{room.title}</Text>
          <View style={styles.meta}>
            <CosmeticAvatar
              name={room.hostId?.name}
              imageUrl={room.hostId?.avatar}
              cosmetics={room.hostId?.activeCosmetics}
              size={34}
              isSpeaking={room.type === "VOICE"}
            />
            <View style={{ flex: 1 }}>
              {hostCosmetics?.nameStyle ? (
                <LinearGradient colors={hostNameColors} style={styles.hostPlate}>
                  <Text style={styles.hostStyled} numberOfLines={1}>{room.hostId?.name ?? "Yugm Host"}</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.host} numberOfLines={1}>{room.hostId?.name ?? "Yugm Host"}</Text>
              )}
              <Text style={styles.count}>{room.participantCount} listening</Text>
            </View>
          </View>
          <View style={styles.tags}>
            <Text style={styles.pill}>{room.language}</Text>
            <Text style={styles.pill}>{room.category}</Text>
            {hostCosmetics?.roomTheme && <Text style={styles.pill}>{cosmeticPreviewText(hostCosmetics.roomTheme)}</Text>}
          </View>
        </LinearGradient>
      </ImageBackground>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { width: 228, height: 220, marginRight: 14, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  pressed: { opacity: 0.88, transform: [{ scale: 0.985 }] },
  wide: { width: "100%", height: 176, marginRight: 0, marginBottom: 14 },
  image: { flex: 1 },
  imageRadius: { borderRadius: radii.lg },
  overlay: { flex: 1, padding: 14, justifyContent: "space-between" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  live: { backgroundColor: colors.pink, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  liveText: { color: colors.text, fontWeight: "900", fontSize: 11 },
  type: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(0,0,0,0.38)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 },
  typeText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  meta: { flexDirection: "row", alignItems: "center", gap: 8 },
  host: { color: colors.text, fontWeight: "800" },
  hostPlate: { alignSelf: "flex-start", maxWidth: "100%", borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  hostStyled: { color: colors.ink, fontWeight: "900", fontSize: 12 },
  count: { color: colors.muted, fontSize: 12 },
  tags: { flexDirection: "row", gap: 8 },
  pill: { color: colors.gold, fontSize: 11, fontWeight: "800", backgroundColor: "rgba(246,180,75,0.13)", paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6 }
});
