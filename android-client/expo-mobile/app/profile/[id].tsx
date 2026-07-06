import { useState, useCallback } from "react";
import { Alert, StyleSheet, Text, View, Image, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crown, MessageCircle, UserPlus, UserMinus, ShieldAlert, Ban, Sparkles, MapPin, Radio } from "lucide-react-native";
import { usersApi } from "@/lib/api";
import { Screen, Section } from "@/components/Screen";
import { useAuthStore } from "@/store/auth";
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
  const isFollowing = user?.isFollowing ?? false;

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
    // Using simple mock report submission for dating profiles
    mutationFn: () => new Promise((resolve) => setTimeout(resolve, 800)),
    onSuccess: () => {
      Alert.alert("Report Submitted", "We will investigate this profile within 24 hours.");
    }
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
        { text: "Fake profile", onPress: () => reportMutation.mutate() },
        { text: "Harassment", onPress: () => reportMutation.mutate() },
        { text: "Spam", onPress: () => reportMutation.mutate() },
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
            <Image source={{ uri: user.avatar }} style={styles.avatarImg as any} />
            <LinearGradient
              colors={["transparent", "rgba(5,7,19,0.95)"]}
              style={styles.heroOverlay}
            />
          </View>

          {/* Details Section */}
          <View style={styles.detailsContent}>
            <View style={styles.nameRow}>
              <Text style={styles.name}>{user.name}, {user.age || 22}</Text>
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

            <View style={styles.locRow}>
              <MapPin color={colors.muted} size={14} />
              <Text style={styles.locationText}>
                {user.city || "Mumbai"}{user.state ? `, ${user.state}` : ""}
              </Text>
            </View>

            {!!user.activeCosmetics && Object.values(user.activeCosmetics).some(Boolean) && (
              <Text style={styles.cosmeticsText}>
                Cosmetics: {Object.values(user.activeCosmetics).filter(Boolean).join(" / ")}
              </Text>
            )}

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
          </View>
        </ScrollView>
      </View>
    </Screen>
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
    position: "relative"
  },
  avatarImg: {
    width: "100%",
    height: "100%"
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
  cosmeticsText: {
    color: colors.pink,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 8
  },
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
