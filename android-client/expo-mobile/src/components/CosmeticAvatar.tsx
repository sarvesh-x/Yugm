import { useEffect, useMemo, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { findCosmetic, type ActiveCosmetics } from "@/lib/cosmetics";
import { colors } from "@/theme/colors";

type Props = {
  name?: string;
  imageUrl?: string;
  cosmetics?: ActiveCosmetics;
  size?: number;
  isSpeaking?: boolean;
  showEntry?: boolean;
};

const framePalettes: Record<string, readonly [string, string, string]> = {
  frame_gold: ["#F6B44B", "#FFE8A3", "#FF8A22"],
  frame_neon: ["#FF3E93", "#7C2DFF", "#27D3FF"],
  frame_crystal: ["#B9F2FF", "#FFFFFF", "#8A3FFC"],
  frame_royal: ["#F6B44B", "#FF3E93", "#7C2DFF"]
};

const wavePalettes: Record<string, readonly [string, string]> = {
  wave_soft: ["rgba(246,180,75,0.55)", "rgba(255,255,255,0.18)"],
  wave_neon: ["rgba(255,62,147,0.65)", "rgba(39,211,255,0.24)"],
  wave_royal: ["rgba(246,180,75,0.7)", "rgba(124,45,255,0.28)"]
};

export function CosmeticAvatar({ name = "Y", imageUrl, cosmetics, size = 56, isSpeaking = false, showEntry = false }: Props) {
  const entryScale = useRef(new Animated.Value(0.86)).current;
  const entryOpacity = useRef(new Animated.Value(0)).current;
  const wave = useRef(new Animated.Value(0)).current;

  const avatarAsset = findCosmetic(cosmetics?.avatarAsset);
  const frame = findCosmetic(cosmetics?.avatarFrame);
  const speakingWave = findCosmetic(cosmetics?.speakingWave);
  const entrance = findCosmetic(cosmetics?.entranceEffect);
  const decoration = findCosmetic(cosmetics?.avatarDecoration);
  const voiceBadge = findCosmetic(cosmetics?.voiceBadge);
  const avatarAssetDetails = avatarAsset?.type === "AVATAR_ASSET" ? avatarAsset : undefined;
  const avatarUrl = avatarAssetDetails?.assetUrl;
  const displayUrl = avatarUrl || imageUrl;
  const initial = name.trim().charAt(0).toUpperCase() || "Y";
  const frameColors = framePalettes[frame?.id ?? ""] ?? ["#232A43", "#F6B44B", "#232A43"] as const;
  const waveColors = wavePalettes[speakingWave?.id ?? ""] ?? ["rgba(246,180,75,0.5)", "rgba(255,255,255,0.16)"] as const;
  const radius = Math.max(8, Math.round(size * 0.24));

  useEffect(() => {
    Animated.spring(entryScale, { toValue: 1, useNativeDriver: true, friction: 6, tension: 90 }).start();
    Animated.timing(entryOpacity, { toValue: 1, duration: 320, useNativeDriver: true }).start();
  }, [entryOpacity, entryScale]);

  useEffect(() => {
    if (!isSpeaking) {
      wave.stopAnimation();
      wave.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(wave, { toValue: 1, duration: 820, useNativeDriver: true }),
        Animated.timing(wave, { toValue: 0, duration: 0, useNativeDriver: true })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [isSpeaking, wave]);

  const waveStyle = useMemo(() => ({
    opacity: wave.interpolate({ inputRange: [0, 1], outputRange: [0.65, 0] }),
    transform: [{ scale: wave.interpolate({ inputRange: [0, 1], outputRange: [1, 1.34] }) }]
  }), [wave]);

  return (
    <Animated.View style={[styles.wrap, { width: size + 14, height: size + 14, transform: [{ scale: entryScale }], opacity: entryOpacity }]}>
      {isSpeaking && (
        <>
          <Animated.View style={[styles.wave, { borderRadius: radius + 12, borderColor: waveColors[0] }, waveStyle]} />
          <View style={[styles.wave, { borderRadius: radius + 12, borderColor: waveColors[1], transform: [{ scale: 1.15 }] }]} />
        </>
      )}
      <LinearGradient colors={frameColors as [string, string, string]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.frame, { width: size + 10, height: size + 10, borderRadius: radius + 5 }]}>
        <View style={[styles.inner, { width: size, height: size, borderRadius: radius }]}>
          {displayUrl ? (
            <Image source={{ uri: displayUrl }} style={[styles.image, { borderRadius: radius }]} />
          ) : (
            <LinearGradient colors={["#171B33", "#2A3155"]} style={[styles.fallback, { borderRadius: radius }]}>
              <Text style={[styles.initial, { fontSize: Math.round(size * 0.42) }]}>{initial}</Text>
            </LinearGradient>
          )}
        </View>
      </LinearGradient>
      {showEntry && entrance && (
        <View style={styles.entry}>
          <Text style={styles.entryText}>{entrance.preview === "crown" ? "ROYAL" : entrance.preview === "meteor" ? "METEOR" : "SPARK"}</Text>
        </View>
      )}
      {decoration && (
        <View style={styles.decor}>
          <Text style={styles.decorText}>{decoration.preview === "crown" ? "CROWN" : "STARS"}</Text>
        </View>
      )}
      {isSpeaking && voiceBadge && (
        <View style={styles.voiceBadge}>
          <Text style={styles.voiceBadgeText}>{voiceBadge.preview === "spotlight" ? "HOST" : "EQ"}</Text>
        </View>
      )}
      {avatarAssetDetails?.assetKind === "ANIMATED" && (
        <View style={styles.gifPill}><Text style={styles.gifText}>GIF</Text></View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", justifyContent: "center" },
  wave: { position: "absolute", left: 2, right: 2, top: 2, bottom: 2, borderWidth: 2 },
  frame: { alignItems: "center", justifyContent: "center", shadowColor: "#F6B44B", shadowOpacity: 0.28, shadowRadius: 10, elevation: 4 },
  inner: { overflow: "hidden", backgroundColor: colors.panelStrong, borderWidth: 2, borderColor: "rgba(5,7,19,0.82)" },
  image: { width: "100%", height: "100%" },
  fallback: { flex: 1, alignItems: "center", justifyContent: "center" },
  initial: { color: colors.gold, fontWeight: "900" },
  entry: { position: "absolute", left: -2, right: -2, bottom: -6, borderRadius: 7, backgroundColor: "rgba(5,7,19,0.9)", borderWidth: 1, borderColor: colors.gold, paddingVertical: 2 },
  entryText: { color: colors.gold, fontSize: 9, fontWeight: "900", textAlign: "center" },
  decor: { position: "absolute", left: -2, top: -5, borderRadius: 6, backgroundColor: "rgba(246,180,75,0.95)", paddingHorizontal: 5, paddingVertical: 1 },
  decorText: { color: colors.ink, fontSize: 8, fontWeight: "900" },
  voiceBadge: { position: "absolute", left: -2, bottom: 5, borderRadius: 6, backgroundColor: colors.cyan, paddingHorizontal: 5, paddingVertical: 1 },
  voiceBadgeText: { color: colors.ink, fontSize: 8, fontWeight: "900" },
  gifPill: { position: "absolute", right: 0, top: 0, borderRadius: 6, backgroundColor: colors.pink, paddingHorizontal: 4, paddingVertical: 1 },
  gifText: { color: colors.text, fontSize: 8, fontWeight: "900" }
});
