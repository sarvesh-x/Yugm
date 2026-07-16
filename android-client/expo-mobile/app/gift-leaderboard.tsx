import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { router } from "expo-router";
import { giftLeaderboardApi } from "@/lib/api";
import { Screen } from "@/components/Screen";
import { CosmeticAvatar } from "@/components/CosmeticAvatar";
import { colors, spacing, radii } from "@/theme/colors";

const periods = ["daily", "weekly", "monthly", "all"] as const;

function PeriodTab({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable style={[styles.tab, active && styles.tabActive]} onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabTextActive]}>{label}</Text>
    </Pressable>
  );
}

function LeaderboardList({ data, title, emptyMessage }: { data: any[]; title: string; emptyMessage: string }) {
  if (!data?.length) {
    return <Text style={styles.empty}>{emptyMessage}</Text>;
  }
  return (
    <View style={styles.listSection}>
      <Text style={styles.listTitle}>{title}</Text>
      {data.map((item: any, index: number) => {
        const user = item.user || {};
        return (
          <Pressable key={item._id ?? index} style={styles.row} onPress={() => {
            if (user._id) router.push({ pathname: "/profile/[id]", params: { id: user._id } });
          }}>
            <Text style={[styles.rank, index < 3 && styles.topRank]}>{index + 1}</Text>
            <CosmeticAvatar name={user.name} imageUrl={user.avatar} size={36} />
            <View style={styles.rowInfo}>
              <Text style={styles.rowName} numberOfLines={1}>{user.name ?? "Unknown"}</Text>
              <Text style={styles.rowMeta}>@{user.username ?? "user"}</Text>
            </View>
            <View style={styles.rowStats}>
              <Text style={styles.coins}>{item.totalCoins} coins</Text>
              <Text style={styles.giftCount}>{item.giftCount} gifts</Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function GiftLeaderboard() {
  const [period, setPeriod] = useState<string>("all");
  const [tab, setTab] = useState<"senders" | "receivers">("senders");

  const { data, isLoading } = useQuery({
    queryKey: ["gift-leaderboard", period],
    queryFn: () => giftLeaderboardApi.get(period),
    staleTime: 15000,
    gcTime: 30000
  });

  return (
    <Screen>
      <View style={styles.header}>
        <Text style={styles.title}>Gift Leaderboard</Text>
      </View>
      <View style={styles.periodRow}>
        {periods.map((p) => (
          <PeriodTab key={p} label={p.charAt(0).toUpperCase() + p.slice(1)} active={period === p} onPress={() => setPeriod(p)} />
        ))}
      </View>
      <View style={styles.subTabRow}>
        <Pressable style={[styles.subTab, tab === "senders" && styles.subTabActive]} onPress={() => setTab("senders")}>
          <Text style={[styles.subTabText, tab === "senders" && styles.subTabTextActive]}>Top Senders</Text>
        </Pressable>
        <Pressable style={[styles.subTab, tab === "receivers" && styles.subTabActive]} onPress={() => setTab("receivers")}>
          <Text style={[styles.subTabText, tab === "receivers" && styles.subTabTextActive]}>Top Receivers</Text>
        </Pressable>
      </View>
      {isLoading ? (
        <ActivityIndicator color={colors.gold} style={{ marginTop: 40 }} />
      ) : tab === "senders" ? (
        <LeaderboardList data={data?.topSenders ?? []} title="Top Senders" emptyMessage="No gifts sent yet" />
      ) : (
        <LeaderboardList data={data?.topReceivers ?? []} title="Top Receivers" emptyMessage="No gifts received yet" />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 24, fontWeight: "900" },
  periodRow: { flexDirection: "row", paddingHorizontal: 18, gap: 8, marginBottom: 12 },
  tab: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabText: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  tabTextActive: { color: colors.ink },
  subTabRow: { flexDirection: "row", paddingHorizontal: 18, gap: 8, marginBottom: 12 },
  subTab: { flex: 1, height: 38, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  subTabActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  subTabText: { color: colors.muted, fontWeight: "900", fontSize: 13 },
  subTabTextActive: { color: colors.text },
  listSection: { paddingHorizontal: 18, paddingBottom: 20 },
  listTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginBottom: 12 },
  empty: { color: colors.muted, textAlign: "center", marginTop: 40, fontWeight: "800" },
  row: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, padding: 10, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  rank: { color: colors.muted, fontWeight: "900", fontSize: 16, width: 28 },
  topRank: { color: colors.gold },
  rowInfo: { flex: 1 },
  rowName: { color: colors.text, fontWeight: "900", fontSize: 14 },
  rowMeta: { color: colors.muted, fontSize: 11 },
  rowStats: { alignItems: "flex-end" },
  coins: { color: colors.gold, fontWeight: "900", fontSize: 13 },
  giftCount: { color: colors.muted, fontSize: 11 },
});
