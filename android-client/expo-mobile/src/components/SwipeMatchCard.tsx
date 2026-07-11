import { useMemo } from "react";
import { Image, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle2, MapPin, Sparkles } from "lucide-react-native";
import { colors, radii } from "@/theme/colors";

type SwipeAction = "LIKE" | "SUPER_LIKE" | "PASS";

export function SwipeMatchCard({
  candidate,
  onSwipe,
  onOpen,
  disabled = false
}: {
  candidate: any;
  onSwipe: (action: SwipeAction) => void;
  onOpen: () => void;
  disabled?: boolean;
}) {
  const { width } = useWindowDimensions();
  const x = useSharedValue(0);
  const y = useSharedValue(0);
  const threshold = Math.min(110, width * 0.27);

  const pan = useMemo(
    () => Gesture.Pan()
      .enabled(!disabled)
      .activeOffsetX([-12, 12])
      .onUpdate((event) => {
        x.value = event.translationX;
        y.value = event.translationY * 0.35;
      })
      .onEnd((event) => {
        const action: SwipeAction | undefined = Math.abs(event.translationX) > threshold
          ? event.translationX > 0 ? "LIKE" : "PASS"
          : event.translationY < -100 ? "SUPER_LIKE" : undefined;
        if (!action) {
          x.value = withSpring(0, { damping: 16, stiffness: 180 });
          y.value = withSpring(0, { damping: 16, stiffness: 180 });
          return;
        }
        const targetX = action === "SUPER_LIKE" ? 0 : action === "LIKE" ? width * 1.25 : -width * 1.25;
        const targetY = action === "SUPER_LIKE" ? -700 : y.value;
        x.value = withTiming(targetX, { duration: 220 });
        y.value = withTiming(targetY, { duration: 220 }, (finished) => {
          if (finished) runOnJS(onSwipe)(action);
        });
      }),
    [disabled, onSwipe, threshold, width, x, y]
  );

  const tap = useMemo(
    () => Gesture.Tap().enabled(!disabled).maxDuration(220).onEnd((_event, success) => {
      if (success) runOnJS(onOpen)();
    }),
    [disabled, onOpen]
  );

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: x.value },
      { translateY: y.value },
      { rotate: `${interpolate(x.value, [-width, 0, width], [-12, 0, 12], Extrapolation.CLAMP)}deg` },
      { scale: interpolate(Math.abs(x.value), [0, width], [1, 0.96], Extrapolation.CLAMP) }
    ]
  }));
  const likeStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [20, threshold], [0, 1], Extrapolation.CLAMP) }));
  const passStyle = useAnimatedStyle(() => ({ opacity: interpolate(x.value, [-threshold, -20], [1, 0], Extrapolation.CLAMP) }));
  const superStyle = useAnimatedStyle(() => ({ opacity: interpolate(y.value, [-42, -8], [1, 0], Extrapolation.CLAMP) }));

  return (
    <GestureDetector gesture={Gesture.Exclusive(pan, tap)}>
      <Animated.View
        accessible
        accessibilityRole="button"
        accessibilityLabel={`${candidate.name}, ${candidate.age}, ${candidate.vibeScore}% vibe match. Swipe right to like, left to pass, or up for a super vibe.`}
        style={[styles.card, cardStyle]}
      >
        <Image source={{ uri: candidate.avatar }} style={styles.image} />
        <LinearGradient colors={["rgba(5,7,19,0.02)", "rgba(5,7,19,0.2)", "rgba(5,7,19,0.98)"]} locations={[0, 0.45, 1]} style={styles.overlay}>
          <Animated.View style={[styles.decision, styles.like, likeStyle]}><Text style={[styles.decisionText, { color: colors.success }]}>VIBE</Text></Animated.View>
          <Animated.View style={[styles.decision, styles.pass, passStyle]}><Text style={[styles.decisionText, { color: colors.danger }]}>PASS</Text></Animated.View>
          <Animated.View style={[styles.decision, styles.super, superStyle]}><Text style={[styles.decisionText, { color: colors.gold }]}>SUPER VIBE</Text></Animated.View>

          <View style={styles.details}>
            <View style={styles.eyebrow}><Sparkles color={colors.gold} size={14} /><Text style={styles.eyebrowText}>CURATED FOR YOU</Text></View>
            <View style={styles.nameRow}>
              <Text style={styles.name} numberOfLines={1}>{candidate.name}, {candidate.age}</Text>
              <View style={styles.score}><Text style={styles.scoreText}>{candidate.vibeScore}%</Text></View>
            </View>
            <View style={styles.locationRow}><MapPin color={colors.muted} size={14} /><Text style={styles.location}>{candidate.city}</Text></View>
            {!!candidate.vibeLine && <Text style={styles.tagline}>“{candidate.vibeLine}”</Text>}
            {!!candidate.matchReasons?.length && <View style={styles.reasons}>{candidate.matchReasons.slice(0, 2).map((reason: any) => <View key={`${reason.type}-${reason.label}`} style={styles.reason}><CheckCircle2 color={colors.success} size={13} /><Text style={styles.reasonText}>{reason.label}</Text></View>)}</View>}
            <View style={styles.interests}>
              {candidate.interests?.slice(0, 4).map((interest: string) => <View key={interest} style={styles.pill}><Text style={styles.pillText}>{interest}</Text></View>)}
            </View>
            {!!candidate.bio && <Text style={styles.bio} numberOfLines={2}>{candidate.bio}</Text>}
          </View>
        </LinearGradient>
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, borderRadius: radii.xl, overflow: "hidden", borderWidth: 1, borderColor: "rgba(255,255,255,0.2)", backgroundColor: colors.surfaceElevated, shadowColor: colors.pink, shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.2, shadowRadius: 22, elevation: 12 },
  image: { width: "100%", height: "100%" },
  overlay: { ...StyleSheet.absoluteFillObject, justifyContent: "flex-end" },
  decision: { position: "absolute", top: 28, borderWidth: 3, borderRadius: radii.sm, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: "rgba(5,7,19,0.7)" },
  like: { left: 24, borderColor: colors.success, transform: [{ rotate: "-9deg" }] },
  pass: { right: 24, borderColor: colors.danger, transform: [{ rotate: "9deg" }] },
  super: { alignSelf: "center", borderColor: colors.gold },
  decisionText: { fontSize: 22, fontWeight: "900", letterSpacing: 1.5 },
  details: { padding: 20 },
  eyebrow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 9 },
  eyebrowText: { color: colors.gold, fontSize: 10, fontWeight: "900", letterSpacing: 1.2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  name: { flex: 1, color: colors.text, fontSize: 30, lineHeight: 36, fontWeight: "900" },
  score: { backgroundColor: colors.pink, minWidth: 50, height: 34, paddingHorizontal: 8, borderRadius: radii.pill, alignItems: "center", justifyContent: "center" },
  scoreText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 3 },
  location: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  tagline: { color: colors.text, fontSize: 15, lineHeight: 21, fontStyle: "italic", fontWeight: "700", marginTop: 10 },
  reasons: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 10 },
  reason: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(50,213,131,0.12)", borderRadius: radii.pill, paddingHorizontal: 9, paddingVertical: 6 },
  reasonText: { color: "#B9F6D4", fontSize: 10, fontWeight: "800" },
  interests: { flexDirection: "row", flexWrap: "wrap", gap: 7, marginTop: 11 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, backgroundColor: "rgba(255,255,255,0.12)", borderWidth: 1, borderColor: "rgba(255,255,255,0.14)" },
  pillText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  bio: { color: "rgba(255,255,255,0.76)", fontSize: 13, lineHeight: 18, marginTop: 10, fontWeight: "600" }
});
