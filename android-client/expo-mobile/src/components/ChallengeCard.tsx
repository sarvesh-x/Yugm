import { Pressable, StyleSheet, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { Swords } from "lucide-react-native";

interface Props {
  challenge: any;
  isIncoming: boolean;
  onAccept?: (id: string) => void;
  onDecline?: (id: string) => void;
}

export function ChallengeCard({ challenge, isIncoming, onAccept, onDecline }: Props) {
  const gameLabels: Record<string, string> = { vibe_tap: "Vibe Tap", memory_match: "Memory Match", reflex_ring: "Reflex Ring" };
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <Swords color={colors.gold} size={20} />
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>{gameLabels[challenge.gameId] || challenge.gameId} Challenge</Text>
          <Text style={styles.meta}>
            {isIncoming ? `${challenge.challenger?.name || "Someone"} challenged you` : `Challenged ${challenge.targetUser?.name || "someone"}`}
          </Text>
          <Text style={styles.score}>Beat: {challenge.score} pts</Text>
        </View>
      </View>
      {isIncoming && onAccept && (
        <View style={styles.actions}>
          <Pressable style={styles.acceptBtn} onPress={() => onAccept(challenge._id)}>
            <Text style={styles.btnText}>Accept</Text>
          </Pressable>
          <Pressable style={styles.declineBtn} onPress={() => onDecline?.(challenge._id)}>
            <Text style={styles.btnText}>Decline</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.surface,
    padding: 12,
    marginBottom: 10,
  },
  top: { flexDirection: "row", gap: 10 },
  title: { color: colors.text, fontWeight: "900", fontSize: 15 },
  meta: { color: colors.muted, fontSize: 13, marginTop: 2 },
  score: { color: colors.gold, fontWeight: "800", fontSize: 13, marginTop: 4 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  acceptBtn: { flex: 1, height: 36, borderRadius: 6, backgroundColor: colors.success, alignItems: "center", justifyContent: "center" },
  declineBtn: { flex: 1, height: 36, borderRadius: 6, backgroundColor: colors.danger, alignItems: "center", justifyContent: "center" },
  btnText: { color: colors.text, fontWeight: "900", fontSize: 13 },
});
