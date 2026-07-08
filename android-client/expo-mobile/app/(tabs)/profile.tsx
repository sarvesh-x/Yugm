import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Settings, Sparkles, UserPlus, UserCheck, Wallet } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { GlassCard } from "@/components/GlassCard";
import { CosmeticAvatar } from "@/components/CosmeticAvatar";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Screen, Section } from "@/components/Screen";
import { usersApi } from "@/lib/api";
import { cosmeticPreviewText, nameStyleColors, profileThemeColors } from "@/lib/cosmetics";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function Profile() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const profileId = userId ?? currentUser?._id ?? currentUser?.id ?? "";
  const isOwn = !userId || userId === currentUser?._id || userId === currentUser?.id;

  const { data: profile, isLoading: profileLoading, error: profileError, refetch: refetchProfile } = useQuery({
    queryKey: ["user", profileId],
    queryFn: () => usersApi.get(profileId),
    enabled: !!profileId,
    staleTime: 30000,
    gcTime: 60000
  });

  const { data: hostedRooms, isLoading: roomsLoading } = useQuery({
    queryKey: ["user", profileId, "rooms"],
    queryFn: () => usersApi.getUserRooms(profileId),
    enabled: !!profileId,
    staleTime: 30000,
    gcTime: 60000
  });

  const user = profile?.user;
  const active = user?.activeCosmetics;
  const themeColors = profileThemeColors(active?.seasonalEvent ?? active?.profileTheme);
  const nameColors = nameStyleColors(active?.nameStyle);
  const followed = Boolean(user?.isFollowing);
  const level = user?.levelStatus ?? {
    level: user?.level ?? 1,
    title: user?.levelTitle ?? "New Vibe",
    xp: user?.xp ?? 0,
    progress: 0,
    progressXp: 0,
    requiredXp: 100,
    canDailyCheckIn: true,
    dailyCheckInXp: 25
  };

  const follow = useMutation({
    mutationFn: () => usersApi.follow(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", profileId] });
      queryClient.invalidateQueries({ queryKey: ["user", currentUser?._id ?? currentUser?.id, "following"] });
    },
    onError: (err: any) => console.error(err)
  });

  const unfollow = useMutation({
    mutationFn: () => usersApi.unfollow(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", profileId] });
      queryClient.invalidateQueries({ queryKey: ["user", currentUser?._id ?? currentUser?.id, "following"] });
    },
    onError: (err: any) => console.error(err)
  });

  const checkIn = useMutation({
    mutationFn: usersApi.checkIn,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user", profileId] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      if (currentUser) {
        updateUser({
          ...currentUser,
          walletBalance: data.walletBalance ?? data.balance ?? currentUser.walletBalance,
          xp: data.level?.xp,
          level: data.level?.level,
          levelTitle: data.level?.title,
          levelStatus: data.level
        });
      }
      Alert.alert(
        data.alreadyClaimed ? "Already checked in" : "Check-in complete",
        data.alreadyClaimed ? "Come back tomorrow for more XP." : `+${data.xpAwarded ?? level.dailyCheckInXp} XP${data.levelUpReward ? ` and +${data.levelUpReward} coins` : ""}.`
      );
    },
    onError: (err: any) => Alert.alert("Check-in failed", err?.message ?? "Please try again.")
  });

  if (profileLoading) return <Screen><LoadingState /></Screen>;
  if (profileError) return <Screen><ErrorState message={(profileError as any)?.message} onRetry={refetchProfile} /></Screen>;

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={profileLoading} onRefresh={refetchProfile} tintColor={colors.gold} />}>
        <Section>
          <LinearGradient colors={themeColors} style={styles.themePanel}>
          <View style={styles.top}>
            <CosmeticAvatar
              name={user?.name}
              imageUrl={user?.avatar}
              cosmetics={user?.activeCosmetics}
              size={92}
              showEntry={isOwn}
            />
            {isOwn && <Pressable onPress={() => router.push("/(tabs)/settings")}><Settings color={colors.text} /></Pressable>}
          </View>
          <View style={styles.nameRow}>
            {active?.nameStyle ? (
              <LinearGradient colors={nameColors} style={styles.namePlate}>
                <Text style={styles.styledName}>{user?.name ?? ""}</Text>
              </LinearGradient>
            ) : (
              <Text style={styles.name}>{user?.name ?? ""}</Text>
            )}
            {user?.isVip && (
              <View style={styles.vipBadge}>
                <Crown color={colors.ink} size={13} />
                <Text style={styles.vipBadgeText}>VIP</Text>
              </View>
            )}
          </View>
          <View style={styles.identityRow}>
            {active?.collectibleTitle && <IdentityPill label={cosmeticPreviewText(active.collectibleTitle)} tone="gold" />}
            {active?.profileBadge && <IdentityPill label={cosmeticPreviewText(active.profileBadge)} tone="pink" />}
            {active?.moodStatus && <IdentityPill label={cosmeticPreviewText(active.moodStatus)} tone="cyan" />}
          </View>
          <Text style={styles.username}>@{user?.username ?? ""}</Text>
          <View style={styles.personalGrid}>
            {active?.introCard && <PersonalCard title="Intro" value={cosmeticPreviewText(active.introCard)} />}
            {active?.profileMusic && <PersonalCard title="Profile music" value={cosmeticPreviewText(active.profileMusic)} />}
            {active?.giftShelf && <PersonalCard title="Gift shelf" value={cosmeticPreviewText(active.giftShelf)} />}
            {active?.reactionPack && <PersonalCard title="Reactions" value={cosmeticPreviewText(active.reactionPack)} />}
            {active?.chatBubble && <PersonalCard title="Chat style" value={cosmeticPreviewText(active.chatBubble)} />}
            {active?.roomEntry && <PersonalCard title="Room entry" value={cosmeticPreviewText(active.roomEntry)} />}
          </View>
          <View style={styles.levelCard}>
            <View style={styles.levelHeader}>
              <View style={styles.levelTitleRow}>
                <Sparkles color={colors.gold} size={16} />
                <Text style={styles.levelTitle}>Level {level.level}</Text>
              </View>
              <Text style={styles.levelName}>{level.title}</Text>
            </View>
            <View style={styles.levelBarTrack}>
              <View style={[styles.levelBarFill, { width: `${Math.round((level.progress ?? 0) * 100)}%` }]} />
            </View>
            <Text style={styles.levelMeta}>
              {level.requiredXp > 0 ? `${level.progressXp}/${level.requiredXp} XP to level ${level.nextLevel ?? level.level}` : `${level.xp} XP total`}
            </Text>
            {isOwn && (
              <Pressable
                style={[styles.checkInBtn, (!level.canDailyCheckIn || checkIn.isPending) && styles.checkInBtnDisabled]}
                onPress={() => checkIn.mutate()}
                disabled={!level.canDailyCheckIn || checkIn.isPending}
              >
                <Text style={styles.checkInText}>
                  {checkIn.isPending ? "Checking in..." : level.canDailyCheckIn ? `Daily check-in +${level.dailyCheckInXp} XP` : "Checked in today"}
                </Text>
              </Pressable>
            )}
          </View>
          <Text style={styles.bio}>{user?.bio ?? ""}</Text>
          <View style={styles.stats}>
            <Stat label="Followers" value={user?.followersCount ?? 0} />
            <Stat label="Following" value={user?.followingCount ?? 0} />
            <Stat label="Hosted" value={hostedRooms?.rooms?.length ?? 0} />
          </View>
          {!isOwn && (
            <Pressable
              style={[styles.followBtn, followed && styles.followingBtn, (follow.isPending || unfollow.isPending) && styles.followBtnDisabled]}
              onPress={() => (follow.isPending || unfollow.isPending ? null : followed ? unfollow.mutate() : follow.mutate())}
            >
              {followed ? <UserCheck color={colors.ink} size={18} /> : <UserPlus color={colors.ink} size={18} />}
              <Text style={styles.followText}>
                {follow.isPending ? "Following..." : unfollow.isPending ? "Unfollowing..." : followed ? "Following" : "Follow"}
              </Text>
            </Pressable>
          )}
          {isOwn && (
            <Pressable style={styles.wallet} onPress={() => router.push("/(tabs)/wallet")}>
              <Wallet color={colors.gold} />
              <Text style={styles.walletText}>Wallet shortcut</Text>
            </Pressable>
          )}
          </LinearGradient>
        </Section>
        <Section>
          <Text style={styles.sectionTitle}>Hosted rooms</Text>
          {roomsLoading ? (
            <LoadingState message="Loading rooms..." />
          ) : !hostedRooms?.rooms?.length ? (
            <EmptyState icon="🎤" message="No hosted rooms yet" />
          ) : (
            hostedRooms.rooms.map((room: any) => (
              <Pressable key={room._id} onPress={() => router.push({ pathname: "/room/[id]", params: { id: room._id, type: room.type } })}>
                <GlassCard style={styles.roomCard}>
                  <Text style={styles.hosted}>{room.title}</Text>
                  <Text style={styles.hostedMeta}>{room.participantCount} listeners / {room.category} / {room.language}</Text>
                </GlassCard>
              </Pressable>
            ))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return <View style={styles.stat}><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></View>;
}

function IdentityPill({ label, tone }: { label?: string; tone: "gold" | "pink" | "cyan" }) {
  if (!label) return null;
  const backgroundColor = tone === "pink" ? colors.pink : tone === "cyan" ? colors.cyan : colors.gold;
  return <View style={[styles.identityPill, { backgroundColor }]}><Text style={styles.identityPillText}>{label}</Text></View>;
}

function PersonalCard({ title, value }: { title: string; value?: string }) {
  if (!value) return null;
  return (
    <View style={styles.personalCard}>
      <Text style={styles.personalTitle}>{title}</Text>
      <Text style={styles.personalValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  themePanel: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, padding: 14 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 18, flexWrap: "wrap" },
  name: { color: colors.text, fontSize: 30, fontWeight: "900" },
  namePlate: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5 },
  styledName: { color: colors.ink, fontSize: 28, fontWeight: "900" },
  vipBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  vipBadgeText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  identityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  identityPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  identityPillText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  username: { color: colors.gold, fontWeight: "800", marginTop: 2 },
  personalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  personalCard: { width: "48%", minWidth: 130, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 10 },
  personalTitle: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  personalValue: { color: colors.text, fontSize: 12, fontWeight: "900", marginTop: 3 },
  levelCard: { marginTop: 14, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 12 },
  levelHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  levelTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  levelTitle: { color: colors.text, fontWeight: "900" },
  levelName: { color: colors.gold, fontWeight: "900", fontSize: 12 },
  levelBarTrack: { height: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", overflow: "hidden", marginTop: 10 },
  levelBarFill: { height: "100%", borderRadius: 8, backgroundColor: colors.gold },
  levelMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 6 },
  checkInBtn: { height: 36, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginTop: 10 },
  checkInBtnDisabled: { opacity: 0.55 },
  checkInText: { color: colors.ink, fontWeight: "900", fontSize: 12 },
  bio: { color: colors.muted, marginTop: 14, lineHeight: 21 },
  stats: { flexDirection: "row", marginVertical: 20, gap: 10 },
  stat: { flex: 1, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, borderRadius: 8, padding: 12 },
  statValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  statLabel: { color: colors.muted, fontSize: 12, marginTop: 2 },
  followBtn: { height: 50, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", marginBottom: 10, flexDirection: "row", gap: 8 },
  followingBtn: { backgroundColor: colors.gold },
  followBtnDisabled: { opacity: 0.5 },
  followText: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  wallet: { height: 50, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  walletText: { color: colors.text, fontWeight: "900" },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 12 },
  roomCard: { marginBottom: 10 },
  hosted: { color: colors.text, fontWeight: "900", fontSize: 16 },
  hostedMeta: { color: colors.muted, marginTop: 4 }
});
