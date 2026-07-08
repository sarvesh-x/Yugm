import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CalendarClock, CheckCircle2, ChevronRight, Coins, Flame, Radio, ShieldCheck, Sparkles, Trophy, Users } from "lucide-react-native";
import { GlassCard } from "@/components/GlassCard";
import { Screen, Section } from "@/components/Screen";
import { experienceApi } from "@/lib/api";
import { colors, gradients } from "@/theme/colors";
import { LinearGradient } from "expo-linear-gradient";

type Achievement = {
  id: string;
  title: string;
  description: string;
  target: number;
  rewardCoins: number;
  progress: number;
  complete: boolean;
};

type FeedItem = {
  type: string;
  title: string;
  room?: any;
  user?: any;
};

type SafetyChecklistItem = {
  id: string;
  title: string;
  done: boolean;
};

const preferenceLabels: Record<string, string> = {
  roomInvites: "Room invites",
  messages: "Messages",
  gifts: "Gifts",
  follows: "Follows",
  hostGoingLive: "Hosts going live",
  wallet: "Wallet events",
  safety: "Safety alerts",
  marketing: "Campaigns"
};

export default function GrowScreen() {
  const queryClient = useQueryClient();
  const [savingPreference, setSavingPreference] = useState("");

  const home = useQuery({ queryKey: ["experience", "home"], queryFn: experienceApi.home, staleTime: 30000 });
  const creator = useQuery({ queryKey: ["experience", "creator"], queryFn: experienceApi.creatorDashboard, staleTime: 30000 });
  const safety = useQuery({ queryKey: ["experience", "safety"], queryFn: experienceApi.safetyCenter, staleTime: 30000 });
  const preferences = useQuery({ queryKey: ["experience", "preferences"], queryFn: experienceApi.notificationPreferences, staleTime: 60000 });

  const loading = home.isLoading || creator.isLoading || safety.isLoading || preferences.isLoading;
  const refreshing = home.isFetching || creator.isFetching || safety.isFetching || preferences.isFetching;
  const profileCompletion = home.data?.profileCompletion;
  const level = home.data?.level;
  const achievements: Achievement[] = home.data?.achievements ?? [];
  const creatorSummary = creator.data?.summary;
  const safetyChecklist: SafetyChecklistItem[] = safety.data?.checklist ?? [];
  const feed: FeedItem[] = home.data?.feed ?? [];
  const scheduledRooms = home.data?.rooms?.scheduled ?? [];

  const completedAchievements = useMemo(() => achievements.filter((item: Achievement) => item.complete).length, [achievements]);

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["experience"] });
  };

  const togglePreference = async (key: string, value: boolean) => {
    const current = preferences.data?.preferences ?? {};
    setSavingPreference(key);
    try {
      await experienceApi.updateNotificationPreferences({ ...current, [key]: value });
      queryClient.invalidateQueries({ queryKey: ["experience", "preferences"] });
    } catch (err: any) {
      Alert.alert("Could not save", err.message || "Preference update failed");
    } finally {
      setSavingPreference("");
    }
  };

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.pink} size="large" />
          <Text style={styles.muted}>Loading your growth cockpit...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.pink} />}
      >
        <Section>
          <LinearGradient colors={gradients.fire} style={styles.hero}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.eyebrow}>Creator OS</Text>
                <Text style={styles.title}>Grow your Yugm</Text>
              </View>
              <Sparkles color={colors.text} size={26} />
            </View>
            <Text style={styles.heroCopy}>Track missions, earnings, safety, room momentum, and the signals that bring people back.</Text>
            <View style={styles.heroStats}>
              <HeroStat label="Profile" value={`${profileCompletion?.percent ?? 0}%`} />
              <HeroStat label="Level" value={`${level?.level ?? 1}`} />
              <HeroStat label="Unread" value={`${home.data?.notifications?.unreadCount ?? 0}`} />
            </View>
          </LinearGradient>
        </Section>

        <Section>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Next Best Actions</Text>
            <Text style={styles.subtle}>{completedAchievements}/{achievements.length} done</Text>
          </View>
          {achievements.slice(0, 5).map((item: Achievement) => (
            <GlassCard key={item.id} style={styles.rowCard}>
              <View style={styles.rowIcon}>
                {item.complete ? <CheckCircle2 color={colors.success} size={22} /> : <Trophy color={colors.gold} size={22} />}
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>{item.description}</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (item.progress / item.target) * 100)}%` }]} />
                </View>
              </View>
              <Text style={styles.reward}>{item.rewardCoins}c</Text>
            </GlassCard>
          ))}
        </Section>

        <Section>
          <View style={styles.metricsGrid}>
            <Metric icon={<Coins color={colors.gold} size={20} />} label="Gift coins" value={creatorSummary?.giftCoins ?? 0} />
            <Metric icon={<Radio color={colors.cyan} size={20} />} label="Hosted" value={creatorSummary?.hostedRooms ?? 0} />
            <Metric icon={<Users color={colors.purple} size={20} />} label="Participants" value={creatorSummary?.participants ?? 0} />
            <Metric icon={<Flame color={colors.pink} size={20} />} label="Est. INR" value={creatorSummary?.estimatedInr ?? 0} />
          </View>
        </Section>

        <Section>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Scheduled Rooms</Text>
            <Pressable onPress={() => router.push("/room/create")}><Text style={styles.linkText}>Create</Text></Pressable>
          </View>
          {scheduledRooms.length ? scheduledRooms.slice(0, 4).map((room: any) => (
            <Pressable key={room._id} onPress={() => router.push({ pathname: "/room/[id]", params: { id: room._id } })}>
              <GlassCard style={styles.compactCard}>
                <CalendarClock color={colors.cyan} size={20} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowTitle}>{room.title}</Text>
                  <Text style={styles.rowMeta}>{room.scheduledFor ? new Date(room.scheduledFor).toLocaleString() : "Scheduled soon"}</Text>
                </View>
                <ChevronRight color={colors.muted} size={18} />
              </GlassCard>
            </Pressable>
          )) : (
            <GlassCard><Text style={styles.muted}>No scheduled rooms yet. Schedule one to give followers a reason to return.</Text></GlassCard>
          )}
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>Social Feed</Text>
          {feed.slice(0, 6).map((item: FeedItem, index: number) => (
            <GlassCard key={`${item.type}-${index}`} style={styles.feedCard}>
              <View style={styles.rowIcon}><Bell color={colors.pink} size={19} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowMeta}>{item.type.replaceAll("_", " ").toLowerCase()}</Text>
              </View>
            </GlassCard>
          ))}
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>Safety Center</Text>
          <GlassCard>
            <View style={styles.safetyHeader}>
              <ShieldCheck color={colors.success} size={24} />
              <View>
                <Text style={styles.rowTitle}>{safety.data?.trust?.label ?? "Good standing"}</Text>
                <Text style={styles.rowMeta}>{safety.data?.trust?.strikes ?? 0} moderation strikes</Text>
              </View>
            </View>
            {safetyChecklist.map((item: SafetyChecklistItem) => (
              <View key={item.id} style={styles.checkRow}>
                <CheckCircle2 color={item.done ? colors.success : colors.muted} size={17} />
                <Text style={styles.checkText}>{item.title}</Text>
              </View>
            ))}
          </GlassCard>
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>Notification Controls</Text>
          <GlassCard>
            {Object.entries(preferences.data?.preferences ?? {}).map(([key, value]) => (
              <View key={key} style={styles.preferenceRow}>
                <Text style={styles.preferenceText}>{preferenceLabels[key] ?? key}</Text>
                <Switch
                  value={Boolean(value)}
                  disabled={savingPreference === key}
                  thumbColor={value ? colors.pink : colors.muted}
                  trackColor={{ false: colors.line, true: "rgba(255,62,147,0.35)" }}
                  onValueChange={(next) => togglePreference(key, next)}
                />
              </View>
            ))}
          </GlassCard>
        </Section>
      </ScrollView>
    </Screen>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: number }) {
  return (
    <GlassCard style={styles.metric}>
      {icon}
      <Text style={styles.metricValue}>{value.toLocaleString()}</Text>
      <Text style={styles.metricLabel}>{label}</Text>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  hero: { borderRadius: 18, padding: 18, marginTop: 8 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 4 },
  heroCopy: { color: "rgba(255,255,255,0.78)", fontSize: 14, lineHeight: 20, marginTop: 12, fontWeight: "700" },
  heroStats: { flexDirection: "row", gap: 10, marginTop: 16 },
  heroStat: { flex: 1, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 8, padding: 10 },
  heroStatValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  heroStatLabel: { color: "rgba(255,255,255,0.74)", fontSize: 11, fontWeight: "800", marginTop: 2 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 10 },
  subtle: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  rowCard: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 10 },
  rowIcon: { height: 38, width: 38, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  rowMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  reward: { color: colors.gold, fontSize: 13, fontWeight: "900" },
  progressTrack: { height: 6, borderRadius: 8, backgroundColor: colors.line, overflow: "hidden", marginTop: 8 },
  progressFill: { height: 6, borderRadius: 8, backgroundColor: colors.pink },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", gap: 7 },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  linkText: { color: colors.pink, fontSize: 13, fontWeight: "900" },
  compactCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  feedCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  safetyHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7 },
  checkText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  preferenceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9 },
  preferenceText: { color: colors.text, fontSize: 14, fontWeight: "800" }
});
