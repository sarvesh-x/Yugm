import { useState, useCallback } from "react";
import { Alert, StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crown, MessageCircle, UserPlus, UserMinus, ShieldAlert, Ban, Sparkles, MapPin, Radio } from "lucide-react-native";
import { usersApi } from "@/lib/api";
import { Screen, Section } from "@/components/Screen";
import { CosmeticAvatar } from "@/components/CosmeticAvatar";
import { useAuthStore } from "@/store/auth";
import { cosmeticPreviewText, nameStyleColors, profileThemeColors } from "@/lib/cosmetics";
import { colors, gradients } from "@/theme/colors";
import { LinearGradient } from "expo-linear-gradient";

export default function UserProfileDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;
  
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["users", id],
    queryFn: () => usersApi.get(id),
    enabled: !!id
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [id])
  );

  const user = data?.user;
  const active = user?.activeCosmetics;
  const themeColors = profileThemeColors(active?.seasonalEvent ?? active?.profileTheme);
  const nameColors = nameStyleColors(active?.nameStyle);
  const isFollowing = user?.isFollowing ?? false;
  const level = user?.levelStatus ?? { level: user?.level ?? 1, title: user?.levelTitle ?? "New Vibe", xp: user?.xp ?? 0 };

  const followMutation = useMutation({
    mutationFn: () => isFollowing ? usersApi.unfollow(id) : usersApi.follow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", id] });
      Alert.alert(isFollowing ? "Unfollowed" : "Following", isFollowing ? `You unfollowed ${user?.name}.` : `You are now following ${user?.name}.`);
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const blockMutation = useMutation({
    mutationFn: () => usersApi.block(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dating", "explore"] });
      Alert.alert("Blocked", `${user?.name} has been blocked and hidden.`);
      router.replace("/(tabs)");
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const reportMutation = useMutation({
    mutationFn: (reason: string) => usersApi.report(id, reason),
    onSuccess: () => {
      Alert.alert("Report Submitted", "We will investigate this profile within 24 hours.");
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const handleBlock = () => {
    Alert.alert("Block user", `Are you sure you want to block ${user?.name}? You will no longer see their live rooms or profile.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => blockMutation.mutate() }
    ]);
  };

  const handleReport = () => {
    Alert.alert(
      "Report User",
      "Why are you reporting this user?",
      [
        { text: "Fake profile", onPress: () => reportMutation.mutate("Fake profile") },
        { text: "Harassment", onPress: () => reportMutation.mutate("Harassment") },
        { text: "Spam", onPress: () => reportMutation.mutate("Spam") },
        { text: "Cancel", style: "cancel" }
      ]
    );
  };

  const handleInviteToRoom = () => {
    Alert.alert("Invite to room", `Invite ${user?.name} to your active voice/video session?`, [
      { text: "Cancel", style: "cancel" },
      { text: "Invite", onPress: () => Alert.alert("Invite sent", `${user?.name} has been notified.`) }
    ]);
  };

  // Calculate mutual interests
  const mutualInterests = user?.interests?.filter((interest: string) => 
    currentUser?.interests?.includes(interest)
  ) ?? [];

  if (isLoading) return <Screen><View style={styles.center}><ActivityIndicator color={colors.pink} size="large" /></View></Screen>;
  if (error || !user) return <Screen><View style={styles.center}><Text style={styles.errorText}>User profile not found.</Text></View></Screen>;

  return (
    <Screen>
      <View style={styles.container}>
        {/* Absolute Header Overlay */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <ArrowLeft color={colors.text} size={20} />
          </Pressable>
          <View style={styles.headerActions}>
            <Pressable onPress={handleInviteToRoom} style={styles.headerIconBtn}>
              <Radio color={colors.text} size={20} />
            </Pressable>
            <Pressable onPress={handleReport} style={styles.headerIconBtn}>
              <ShieldAlert color={colors.danger} size={20} />
            </Pressable>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollWrap} showsVerticalScrollIndicator={false}>
          {/* Cover image / Large Avatar */}
          <View style={styles.heroSection}>
            <LinearGradient
              colors={["rgba(255,255,255,0.03)", "rgba(5,7,19,0.95)"]}
              style={styles.heroOverlay}
            />
            <CosmeticAvatar
              name={user.name}
              imageUrl={user.avatar}
              cosmetics={user.activeCosmetics}
              size={180}
              showEntry
            />
          </View>

          {/* Details Section */}
          <LinearGradient colors={themeColors} style={styles.detailsContent}>
            <View style={styles.nameRow}>
              {active?.nameStyle ? (
                <LinearGradient colors={nameColors} style={styles.namePlate}>
                  <Text style={styles.styledName}>{user.name}, {user.age || 22}</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.name}>{user.name}, {user.age || 22}</Text>
              )}
              {user.isVerified && (
                <View style={styles.verifiedBadge}>
                  <Text style={styles.verifiedBadgeText}>✓ Verified</Text>
                </View>
              )}
              {user.isVip && (
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

            <View style={styles.locRow}>
              <MapPin color={colors.muted} size={14} />
              <Text style={styles.locationText}>
                {user.city || "Mumbai"}{user.state ? `, ${user.state}` : ""}
              </Text>
            </View>

            <View style={styles.levelPill}>
              <Sparkles color={colors.gold} size={14} />
              <Text style={styles.levelPillText}>Level {level.level} / {level.title}</Text>
              <Text style={styles.levelXpText}>{level.xp} XP</Text>
            </View>

            <View style={styles.personalGrid}>
              {active?.introCard && <PersonalCard title="Intro" value={cosmeticPreviewText(active.introCard)} />}
              {active?.profileMusic && <PersonalCard title="Profile music" value={cosmeticPreviewText(active.profileMusic)} />}
              {active?.giftShelf && <PersonalCard title="Gift shelf" value={cosmeticPreviewText(active.giftShelf)} />}
              {active?.reactionPack && <PersonalCard title="Reactions" value={cosmeticPreviewText(active.reactionPack)} />}
              {active?.chatBubble && <PersonalCard title="Chat style" value={cosmeticPreviewText(active.chatBubble)} />}
              {active?.roomEntry && <PersonalCard title="Room entry" value={cosmeticPreviewText(active.roomEntry)} />}
            </View>

            {user.vibeLine && (
              <View style={styles.vibeBox}>
                <Text style={styles.vibeLabel}>Vibe Line</Text>
                <Text style={styles.vibeText}>“{user.vibeLine}”</Text>
              </View>
            )}

            {/* Interaction Action Row */}
            <View style={styles.actionRow}>
              <Pressable
                onPress={() => followMutation.mutate()}
                disabled={followMutation.isPending}
                style={[styles.actionBtn, isFollowing ? styles.followActive : styles.followInactive]}
              >
                {isFollowing ? (
                  <>
                    <UserMinus color={colors.text} size={18} />
                    <Text style={styles.actionBtnText}>Unfollow</Text>
                  </>
                ) : (
                  <>
                    <UserPlus color={colors.text} size={18} />
                    <Text style={styles.actionBtnText}>Follow</Text>
                  </>
                )}
              </Pressable>

              <Pressable
                onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: id } })}
                style={[styles.actionBtn, styles.msgBtn]}
              >
                <LinearGradient colors={gradients.fire} style={styles.msgGradient}>
                  <MessageCircle color={colors.text} size={18} fill={colors.text} />
                  <Text style={styles.actionBtnText}>Message</Text>
                </LinearGradient>
              </Pressable>
            </View>

            {/* Bio */}
            {user.bio && (
              <View style={styles.infoBlock}>
                <Text style={styles.blockTitle}>About Me</Text>
                <Text style={styles.bioText}>{user.bio}</Text>
              </View>
            )}

            {/* Mutual Interests */}
            {mutualInterests.length > 0 && (
              <View style={[styles.infoBlock, styles.mutualBlock]}>
                <View style={styles.mutualTitleRow}>
                  <Sparkles color={colors.gold} size={16} fill={colors.gold} />
                  <Text style={[styles.blockTitle, { color: colors.gold, marginBottom: 0 }]}>
                    Mutual Interests ({mutualInterests.length})
                  </Text>
                </View>
                <View style={styles.chipsRow}>
                  {mutualInterests.map((interest: string) => (
                    <View key={interest} style={[styles.chip, styles.mutualChip]}>
                      <Text style={[styles.chipText, { color: colors.ink }]}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* All Interests */}
            {user.interests && user.interests.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.blockTitle}>Interests</Text>
                <View style={styles.chipsRow}>
                  {user.interests.map((interest: string) => (
                    <View key={interest} style={styles.chip}>
                      <Text style={styles.chipText}>{interest}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Languages */}
            {user.languages && user.languages.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.blockTitle}>Preferred Languages</Text>
                <View style={styles.chipsRow}>
                  {user.languages.map((lang: string) => (
                    <View key={lang} style={styles.chip}>
                      <Text style={styles.chipText}>{lang}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {/* Safety Options */}
            <Pressable style={styles.blockUserBtn} onPress={handleBlock}>
              <Ban color={colors.danger} size={16} />
              <Text style={styles.blockUserText}>Block {user.name}</Text>
            </Pressable>
          </LinearGradient>
        </ScrollView>
      </View>
    </Screen>
  );
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
  container: { flex: 1 },
  header: {
    position: "absolute",
    top: 10,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 52,
    zIndex: 10
  },
  backBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(5,7,19,0.5)"
  },
  headerActions: { flexDirection: "row", gap: 8 },
  headerIconBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "rgba(5,7,19,0.5)"
  },
  scrollWrap: {
    paddingBottom: 48
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  errorText: { color: colors.danger, fontWeight: "800", fontSize: 16 },
  heroSection: {
    height: 380,
    position: "relative",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.panelStrong
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0
  },
  detailsContent: {
    paddingHorizontal: 20,
    marginTop: -20
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  name: {
    color: colors.text,
    fontSize: 30,
    fontWeight: "900"
  },
  namePlate: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5
  },
  styledName: {
    color: colors.ink,
    fontSize: 28,
    fontWeight: "900"
  },
  identityRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 10 },
  identityPill: { borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  identityPillText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  verifiedBadge: {
    backgroundColor: "rgba(50,213,131,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success
  },
  verifiedBadgeText: {
    color: colors.success,
    fontSize: 11,
    fontWeight: "800"
  },
  vipBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.gold,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  vipBadgeText: {
    color: colors.ink,
    fontSize: 11,
    fontWeight: "900"
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 6
  },
  locationText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  levelPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "rgba(246,180,75,0.08)",
    borderWidth: 1,
    borderColor: "rgba(246,180,75,0.24)"
  },
  levelPillText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "900"
  },
  levelXpText: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800"
  },
  personalGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 },
  personalCard: { width: "48%", minWidth: 130, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 10 },
  personalTitle: { color: colors.muted, fontSize: 10, fontWeight: "800", textTransform: "uppercase" },
  personalValue: { color: colors.text, fontSize: 12, fontWeight: "900", marginTop: 3 },
  vibeBox: {
    marginTop: 16,
    padding: 14,
    borderRadius: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  vibeLabel: {
    color: colors.pink,
    fontSize: 11,
    fontWeight: "900",
    textTransform: "uppercase",
    marginBottom: 4
  },
  vibeText: {
    color: colors.text,
    fontSize: 15,
    fontStyle: "italic",
    fontWeight: "800"
  },
  actionRow: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
    marginBottom: 10
  },
  actionBtn: {
    flex: 1,
    height: 52,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  followInactive: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  followActive: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.line
  },
  msgBtn: {
    overflow: "hidden"
  },
  msgGradient: {
    flex: 1,
    height: "100%",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%"
  },
  actionBtnText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900"
  },
  infoBlock: {
    marginTop: 20
  },
  blockTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "900",
    marginBottom: 8
  },
  bioText: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 14,
    lineHeight: 22,
    fontWeight: "700"
  },
  mutualBlock: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: "rgba(246,180,75,0.08)",
    borderWidth: 1,
    borderColor: "rgba(246,180,75,0.2)"
  },
  mutualTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 10
  },
  chipsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  mutualChip: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  chipText: {
    color: colors.text,
    fontSize: 12,
    fontWeight: "800"
  },
  blockUserBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 32,
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,59,79,0.15)",
    backgroundColor: "rgba(255,59,79,0.04)"
  },
  blockUserText: {
    color: colors.danger,
    fontWeight: "800",
    fontSize: 14
  }
});
