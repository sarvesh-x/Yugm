import { Pressable, StyleSheet, Text, View } from "react-native";
import { Flame, Gift } from "lucide-react-native";
import { colors, spacing } from "@/theme/colors";

const streakBonuses: Record<number, number> = { 3: 10, 7: 25, 14: 50, 30: 100, 60: 200, 90: 500 };

interface Props {
  streak: number;
  canCheckIn: boolean;
  isPending: boolean;
  onCheckIn: () => void;
  checkInLabel: string;
}

export function StreakCard({ streak, canCheckIn, isPending, onCheckIn, checkInLabel }: Props) {
  const milestones = Object.keys(streakBonuses).map(Number).sort((a, b) => a - b);
  const nextMilestone = milestones.find((m) => m > streak) ?? null;
  const prevMilestone = [...milestones].reverse().find((m) => m <= streak) ?? 0;
  const nextMilestoneTarget = nextMilestone ?? prevMilestone + 30;
  const progress = nextMilestone ? streak / nextMilestone : 1;

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.streakRow}>
          <Flame color={colors.saffron} size={22} />
          <Text style={styles.streakCount}>{streak}</Text>
          <Text style={styles.streakLabel}>day streak</Text>
        </View>
        <Pressable
          style={[styles.checkInBtn, (!canCheckIn || isPending) && styles.checkInBtnDisabled]}
          onPress={onCheckIn}
          disabled={!canCheckIn || isPending}
        >
          <Text style={styles.checkInText}>{isPending ? "..." : checkInLabel}</Text>
        </Pressable>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.min(progress * 100, 100)}%` }]} />
      </View>

      <View style={styles.milestones}>
        {milestones.map((milestone) => {
          const isReached = streak >= milestone;
          const isNext = milestone === nextMilestone;
          return (
            <View key={milestone} style={[styles.milestone, isNext && styles.nextMilestone]}>
              <View style={[styles.milestoneDot, isReached && styles.milestoneReached, isNext && styles.milestoneNext]} />
              <Gift color={isReached ? colors.gold : colors.muted} size={12} />
              <Text style={[styles.milestoneDay, isReached && styles.milestoneDayReached]}>
                {milestone}d
              </Text>
              <Text style={[styles.milestoneCoins, isReached && styles.milestoneCoinsReached]}>
                +{streakBonuses[milestone]}
              </Text>
            </View>
          );
        })}
      </View>

      {nextMilestone && (
        <Text style={styles.nextText}>
          {streak >= nextMilestone ? "Milestone reached!" : `${nextMilestone - streak} more days for +${streakBonuses[nextMilestone]} coins`}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 14, marginBottom: 14 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  streakRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  streakCount: { color: colors.saffron, fontSize: 28, fontWeight: "900" },
  streakLabel: { color: colors.muted, fontWeight: "800", fontSize: 13 },
  checkInBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.gold },
  checkInBtnDisabled: { opacity: 0.55 },
  checkInText: { color: colors.ink, fontWeight: "900", fontSize: 12 },
  progressTrack: { height: 6, borderRadius: 6, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginBottom: 12 },
  progressFill: { height: "100%", borderRadius: 6, backgroundColor: colors.saffron },
  milestones: { flexDirection: "row", justifyContent: "space-between", marginBottom: 10 },
  milestone: { alignItems: "center", gap: 3, flex: 1 },
  nextMilestone: { opacity: 1 },
  milestoneDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.12)" },
  milestoneReached: { backgroundColor: colors.gold },
  milestoneNext: { backgroundColor: colors.saffron },
  milestoneDay: { color: colors.muted, fontSize: 10, fontWeight: "800" },
  milestoneDayReached: { color: colors.gold },
  milestoneCoins: { color: colors.muted, fontSize: 9, fontWeight: "700" },
  milestoneCoinsReached: { color: colors.success },
  nextText: { color: colors.muted, fontSize: 12, fontWeight: "700", textAlign: "center" },
});
