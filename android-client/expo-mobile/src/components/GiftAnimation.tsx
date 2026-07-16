import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Dimensions, Text } from "react-native";
import { colors } from "@/theme/colors";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

const GIFT_EMOJIS: Record<string, string> = {
  rose: "\u{1F339}", diya: "\u{1FA94}", lotus: "\u{1FAB7}", crown: "\u{1F451}", astra: "\u2B50"
};

interface Props {
  giftName: string;
  onComplete: () => void;
}

export function GiftAnimation({ giftName, onComplete }: Props) {
  const scale = useRef(new Animated.Value(0)).current;
  const opacity = useRef(new Animated.Value(1)).current;
  const translateY = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, friction: 4 }),
      Animated.timing(translateY, { toValue: -SCREEN_HEIGHT * 0.3, duration: 1200, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(1000),
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
    ]).start(() => onComplete());
  }, []);

  const emoji = GIFT_EMOJIS[giftName.toLowerCase()] || "\u{1F381}";

  return (
    <Animated.View style={[styles.container, { opacity, transform: [{ scale }, { translateY }] }]}>
      <Text style={styles.emoji}>{emoji}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: "40%",
    left: SCREEN_WIDTH / 2 - 50,
    width: 100,
    height: 100,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 100,
  },
  emoji: { fontSize: 72 },
});
