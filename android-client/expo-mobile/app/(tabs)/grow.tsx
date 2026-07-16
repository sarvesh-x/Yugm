import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Switch, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BadgeIndianRupee, Bell, CalendarClock, CheckCircle2, ChevronRight, Coins, Flame, Gift, Medal, Mic2, Radio, ShieldCheck, Sparkles, Star, Trophy, Users, Video } from "lucide-react-native";
import { GlassCard } from "@/components/GlassCard";
import { Screen, Section } from "@/components/Screen";
import { experienceApi } from "@/lib/api";
import { colors, gradients } from "@/theme/colors";
import { LinearGradient } from "expo-linear-gradient";
import { useAuthStore } from "@/store/auth";

const TIER_COLORS: Record<string, string> = {
  BRONZE: "#CD7F32",
  SILVER: "#C0C0C0",
  GOLD: "#FFD700",
  PLATINUM: "#E5E4E2"
};

const TIER_LABELS: Record<string, string> = { BRONZE: "I", SILVER: "II", GOLD: "III", PLATINUM: "IV" };

type AchievementTier = {
  tier: string;
  target: number;
  rewardCoins: number;
  rewardCosmetic?: string;
  reached: boolean;
  claimed: boolean;
};

type Achievement = {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: string;
  order: number;
  progress: number;
  total: number;
  currentTier: string | null;
  highestClaimedTier: string | null;
  tiers: AchievementTier[];
  nextTier: string | null;
  canClaim: boolean;
  canUpgrade: boolean;
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
  const role = useAuthStore((state) => state.user?.role);
  const isCreator = role === "HOST" || role === "MODERATOR" || role === "ADMIN";
  const [savingPreference, setSavingPreference] = useState("");

  const home = useQuery({ queryKey: ["experience", "home"], queryFn: experienceApi.home, staleTime: 30000 });
  const creator = useQuery({ queryKey: ["experience", "creator"], queryFn: experienceApi.creatorDashboard, staleTime: 30000 });
  const safety = useQuery({ queryKey: ["experience", "safety"], queryFn: experienceApi.safetyCenter, staleTime: 30000 });
  const preferences = useQuery({ queryKey: ["experience", "preferences"], queryFn: experienceApi.notificationPreferences, staleTime: 60000 });

  const loading = home.isLoading || creator.isLoading || safety.isLoading || preferences.isLoading;
  const refreshing = home.isFetching || creator.isFetching || safety.isFetching || preferences.isFetching;
  const queryError = home.error || creator.error || safety.error || preferences.error;
  const profileCompletion = home.data?.profileCompletion;
  const level = home.data?.level;
  const achievements: Achievement[] = home.data?.achievements ?? [];
  const creatorSummary = creator.data?.summary;
  const creatorRooms = creator.data?.rooms ?? [];
  const recentGifts = creator.data?.gifts ?? [];
  const safetyChecklist: SafetyChecklistItem[] = safety.data?.checklist ?? [];
  const feed: FeedItem[] = home.data?.feed ?? [];
  const scheduledRooms = isCreator ? (creator.data?.scheduledRooms ?? []) : (home.data?.rooms?.scheduled ?? []);
  const topSupporters = creator.data?.topSupporters ?? [];

  const completedAchievements = useMemo(() => achievements.filter((item) => item.complete).length, [achievements]);

  const claimMutation = useMutation({
    mutationFn: (achievementId: string) => experienceApi.claimAchievement(achievementId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["experience"] });
      Alert.alert("Achievement claimed!", data.tier ? `${data.tier} tier unlocked` : "Reward collected");
    },
    onError: (err: any) => Alert.alert("Claim failed", err?.message ?? "Could not claim achievement")
  });

  const shareMutation = useMutation({
    mutationFn: (achievementId: string) => experienceApi.shareAchievement(achievementId),
    onSuccess: async (data) => {
      try { await Share.share({ message: data.shareText }); } catch {}
    },
    onError: (err: any) => Alert.alert("Share failed", err?.message ?? "Could not share achievement")
  });

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

        {queryError ? (
          <Section>
            <GlassCard style={styles.errorCard}>
              <View style={styles.errorIcon}><ShieldCheck color={colors.warning} size={20} /></View>
              <View style={styles.rowBody}><Text style={styles.rowTitle}>Some creator data could not load</Text><Text style={styles.rowMeta}>{(queryError as Error).message || "Pull to refresh or try again."}</Text></View>
              <Pressable onPress={refresh}><Text style={styles.linkText}>Retry</Text></Pressable>
            </GlassCard>
          </Section>
        ) : null}

        <Section>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Next Best Actions</Text>
            <Text style={styles.subtle}>{completedAchievements}/{achievements.length} done</Text>
          </View>
          {achievements.length ? achievements.slice(0, 5).map((item) => {
            const tierColor = item.highestClaimedTier ? TIER_COLORS[item.highestClaimedTier] ?? colors.gold : colors.gold;
            return (
              <GlassCard key={item.id} style={styles.achieveCard}>
                <Pressable style={styles.achieveMain} onPress={() => {
                  if (item.canClaim) claimMutation.mutate(item.id);
                }}>
                  <View style={[styles.achieveIcon, { borderColor: tierColor }]}>
                    {item.complete ? <CheckCircle2 color={tierColor} size={22} /> : <Trophy color={colors.gold} size={22} />}
                  </View>
                  <View style={styles.rowBody}>
                    <View style={styles.achieveTitleRow}>
                      <Text style={styles.rowTitle}>{item.title}</Text>
                      {item.highestClaimedTier ? (
                        <View style={[styles.tierBadge, { backgroundColor: `${tierColor}22`, borderColor: tierColor }]}>
                          <Text style={[styles.tierBadgeText, { color: tierColor }]}>{TIER_LABELS[item.highestClaimedTier]}</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.rowMeta}>{item.description}</Text>
                    <View style={styles.progressTrack}>
                      <View style={[styles.progressFill, { width: `${item.total > 0 ? Math.min(100, (item.progress / item.total) * 100) : 0}%`, backgroundColor: tierColor }]} />
                    </View>
                    {item.canClaim ? (
                      <Pressable style={styles.claimBtn} onPress={() => claimMutation.mutate(item.id)}>
                        <Text style={styles.claimBtnText}>
                          {claimMutation.isPending ? "Claiming..." : `Claim ${item.tiers.find((t) => t.tier === item.nextTier)?.rewardCoins ?? 0}c`}
                        </Text>
                      </Pressable>
                    ) : null}
                  </View>
                </Pressable>
                {item.highestClaimedTier ? (
                  <Pressable style={styles.shareIconBtn} onPress={() => shareMutation.mutate(item.id)}>
                    <ShareIcon color={colors.muted} size={16} />
                  </Pressable>
                ) : null}
                {item.tiers.length > 1 ? (
                  <View style={styles.tierDots}>
                    {item.tiers.map((tier) => {
                      const dotColor = tier.claimed ? TIER_COLORS[tier.tier] ?? colors.gold : colors.line;
                      return <View key={tier.tier} style={[styles.tierDot, { backgroundColor: dotColor, opacity: tier.claimed ? 1 : 0.4 }]} />;
                    })}
                  </View>
                ) : null}
              </GlassCard>
            );
          }) : <GlassCard><Text style={styles.muted}>Your next missions will appear after you start hosting and connecting.</Text></GlassCard>}
        </Section>

        <Section>
          <View style={styles.sectionHeader}>
            <View><Text style={styles.sectionTitle}>30-day performance</Text><Text style={styles.subtle}>Your latest creator signals</Text></View>
            <View style={styles.periodPill}><Text style={styles.periodText}>Last 30 days</Text></View>
          </View>
          <View style={styles.metricsGrid}>
            <Metric icon={<Coins color={colors.gold} size={20} />} label="Gift coins" value={creatorSummary?.giftCoins ?? 0} />
            <Metric icon={<Radio color={colors.cyan} size={20} />} label="Hosted" value={creatorSummary?.hostedRooms ?? 0} />
            <Metric icon={<Users color={colors.purple} size={20} />} label="Participants" value={creatorSummary?.participants ?? 0} />
            <Metric icon={<Flame color={colors.pink} size={20} />} label="Est. INR" value={creatorSummary?.estimatedInr ?? 0} />
            <Metric icon={<Gift color={colors.gold} size={20} />} label="Supporters" value={creatorSummary?.uniqueSupporters ?? 0} />
            <Metric icon={<Users color={colors.cyan} size={20} />} label="Avg / room" value={creatorSummary?.averageParticipants ?? 0} />
          </View>
        </Section>

        {isCreator ? (
          <Section>
            <Pressable onPress={() => router.push("/creator/payouts")}>
              <GlassCard style={styles.payoutCard}>
                <View style={styles.payoutIcon}><BadgeIndianRupee color={colors.gold} size={24} /></View>
                <View style={styles.rowBody}>
                  <Text style={styles.rowTitle}>Creator earnings & payouts</Text>
                  <Text style={styles.rowMeta}>Verify payout details, view available gift earnings, and request settlement.</Text>
                </View>
                <ChevronRight color={colors.muted} size={20} />
              </GlassCard>
            </Pressable>
          </Section>
        ) : null}

        {topSupporters.length ? (
          <Section>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Top supporters</Text><Text style={styles.subtle}>People powering your last 30 days</Text></View></View>
            <GlassCard style={styles.supporterBoard}>
              {topSupporters.slice(0, 5).map((supporter: any, index: number) => (
                <View key={supporter._id ?? index} style={[styles.supporterRow, index > 0 && styles.giftBorder]}>
                  <View style={[styles.supporterRank, index === 0 && styles.supporterRankFirst]}><Text style={[styles.supporterRankText, index === 0 && styles.supporterRankTextFirst]}>{index + 1}</Text></View>
                  <View style={styles.rowBody}><Text style={styles.giftName}>{supporter.user?.name ?? "Supporter"}</Text><Text style={styles.rowMeta}>@{supporter.user?.username ?? "yugm"} · {supporter.gifts} gifts</Text></View>
                  <Text style={styles.giftCoins}>{Number(supporter.coins ?? 0).toLocaleString()}c</Text>
                </View>
              ))}
            </GlassCard>
          </Section>
        ) : null}

        {(creator.data?.nextSteps ?? []).length ? (
          <Section>
            <Text style={styles.sectionTitle}>Creator playbook</Text>
            <GlassCard>
              {(creator.data?.nextSteps ?? []).map((step: string, index: number) => (
                <View key={step} style={styles.playbookRow}>
                  <View style={styles.stepBadge}><Text style={styles.stepBadgeText}>{index + 1}</Text></View>
                  <Text style={styles.checkText}>{step}</Text>
                </View>
              ))}
            </GlassCard>
          </Section>
        ) : null}

        {creatorRooms.length || recentGifts.length ? (
          <Section>
            <View style={styles.sectionHeader}><View><Text style={styles.sectionTitle}>Recent momentum</Text><Text style={styles.subtle}>Rooms hosted and supporter activity</Text></View></View>
            {creatorRooms.slice(0, 3).map((room: any) => (
              <Pressable key={room._id} onPress={() => router.push({ pathname: "/room/[id]", params: { id: room._id } })}>
                <GlassCard style={styles.momentumCard}>
                  <View style={[styles.momentumIcon, room.type === "VIDEO" && styles.momentumVideo]}>{room.type === "VIDEO" ? <Video color={colors.pink} size={19} /> : <Mic2 color={colors.cyan} size={19} />}</View>
                  <View style={styles.rowBody}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{room.title}</Text>
                    <Text style={styles.rowMeta}>{room.category} · {room.participantCount ?? 0} participants</Text>
                  </View>
                  <View style={[styles.roomStatusPill, room.status === "LIVE" && styles.roomLivePill]}><Text style={[styles.roomStatusText, room.status === "LIVE" && styles.roomLiveText]}>{String(room.status ?? "ENDED").toLowerCase()}</Text></View>
                </GlassCard>
              </Pressable>
            ))}
            {recentGifts.length ? (
              <GlassCard style={styles.supportCard}>
                <View style={styles.supportHeader}><View style={styles.supportIcon}><Gift color={colors.gold} size={20} /></View><View style={styles.rowBody}><Text style={styles.rowTitle}>Recent supporter love</Text><Text style={styles.rowMeta}>{recentGifts.length} latest gift moments</Text></View></View>
                {recentGifts.slice(0, 4).map((gift: any, index: number) => (
                  <View key={gift._id ?? index} style={[styles.giftRow, index > 0 && styles.giftBorder]}>
                    <Text style={styles.giftEmoji}>{gift.giftId?.icon ?? "🎁"}</Text>
                    <View style={styles.rowBody}><Text style={styles.giftName}>{gift.senderId?.name ?? "A supporter"}</Text><Text style={styles.rowMeta}>{gift.giftId?.name ?? "Gift"} · {gift.createdAt ? new Date(gift.createdAt).toLocaleDateString() : "Recently"}</Text></View>
                    <Text style={styles.giftCoins}>+{gift.coinAmount ?? 0}c</Text>
                  </View>
                ))}
              </GlassCard>
            ) : null}
          </Section>
        ) : null}

        <Section>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{isCreator ? "My scheduled rooms" : "Upcoming rooms"}</Text>
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
          {!feed.length ? <GlassCard><Text style={styles.muted}>Follow hosts and join rooms to build your activity feed.</Text></GlassCard> : null}
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

function ShareIcon({ color, size }: { color: string; size: number }) {
  return (
    <View style={{ width: size, height: size }}>
      <View style={{ position: "absolute", top: 0, left: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <View style={{ position: "absolute", bottom: 2, right: 0, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
      <View style={{ position: "absolute", bottom: 2, left: 3, width: 6, height: 6, borderRadius: 3, backgroundColor: color }} />
    </View>
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
  errorCard: { flexDirection: "row", alignItems: "center", gap: 11, borderColor: "rgba(253,176,34,0.28)", backgroundColor: "rgba(253,176,34,0.07)" },
  errorIcon: { width: 38, height: 38, borderRadius: 11, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(253,176,34,0.1)" },
  achieveCard: { marginBottom: 10 },
  achieveMain: { flexDirection: "row", gap: 12, alignItems: "center" },
  achieveIcon: { height: 38, width: 38, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center", borderWidth: 1 },
  achieveTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  tierBadge: { borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1 },
  tierBadgeText: { fontSize: 9, fontWeight: "900" },
  tierDots: { flexDirection: "row", gap: 4, justifyContent: "center", paddingVertical: 6 },
  tierDot: { width: 8, height: 8, borderRadius: 4 },
  shareIconBtn: { position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: 14, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  claimBtn: { marginTop: 6, borderRadius: 6, backgroundColor: colors.pink, paddingHorizontal: 12, paddingVertical: 5, alignSelf: "flex-start" },
  claimBtnText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  rowCard: { flexDirection: "row", gap: 12, alignItems: "center", marginBottom: 10 },
  rowIcon: { height: 38, width: 38, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  rowBody: { flex: 1 },
  rowTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  rowMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  reward: { color: colors.gold, fontSize: 13, fontWeight: "900" },
  progressTrack: { height: 6, borderRadius: 8, backgroundColor: colors.line, overflow: "hidden", marginTop: 8 },
  progressFill: { height: 6, borderRadius: 8 },
  metricsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { width: "48%", gap: 7 },
  metricValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  metricLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  periodPill: { borderRadius: 999, paddingHorizontal: 9, paddingVertical: 6, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  periodText: { color: colors.muted, fontSize: 9, fontWeight: "900" },
  payoutCard: { flexDirection: "row", alignItems: "center", gap: 12, borderColor: "rgba(246,180,75,0.35)" },
  payoutIcon: { width: 44, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(246,180,75,0.12)" },
  playbookRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8 },
  stepBadge: { height: 24, width: 24, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelStrong },
  stepBadgeText: { color: colors.gold, fontSize: 11, fontWeight: "900" },
  momentumCard: { flexDirection: "row", alignItems: "center", gap: 11, marginBottom: 9 },
  momentumIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(39,211,255,0.1)" },
  momentumVideo: { backgroundColor: "rgba(255,62,147,0.1)" },
  roomStatusPill: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 5, backgroundColor: colors.surface },
  roomLivePill: { backgroundColor: "rgba(50,213,131,0.1)" },
  roomStatusText: { color: colors.muted, fontSize: 9, fontWeight: "900", textTransform: "capitalize" },
  roomLiveText: { color: colors.success },
  supportCard: { marginTop: 4 },
  supportHeader: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 10 },
  supportIcon: { width: 40, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(246,180,75,0.1)" },
  giftRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10 },
  giftBorder: { borderTopWidth: 1, borderTopColor: colors.line },
  giftEmoji: { fontSize: 22 },
  giftName: { color: colors.text, fontSize: 12, fontWeight: "900" },
  giftCoins: { color: colors.gold, fontSize: 12, fontWeight: "900" },
  supporterBoard: { paddingVertical: 4 },
  supporterRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 11 },
  supporterRank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: colors.surface },
  supporterRankFirst: { backgroundColor: "rgba(246,180,75,0.16)" },
  supporterRankText: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  supporterRankTextFirst: { color: colors.gold },
  linkText: { color: colors.pink, fontSize: 13, fontWeight: "900" },
  compactCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  feedCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  safetyHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  checkRow: { flexDirection: "row", alignItems: "center", gap: 9, paddingVertical: 7 },
  checkText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  preferenceRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 9 },
  preferenceText: { color: colors.text, fontSize: 14, fontWeight: "800" }
});
