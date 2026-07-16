import { useState, useCallback } from "react";
import { Alert, Image, Modal, StyleSheet, Text, View, Pressable, ScrollView, ActivityIndicator } from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Crown, MessageCircle, UserPlus, UserMinus, ShieldAlert, Ban, Sparkles, MapPin, Radio, Star, Users, Home, UserCheck, UserX, Clock } from "lucide-react-native";
import { usersApi, friendsApi } from "@/lib/api";
import { Screen, Section } from "@/components/Screen";
import { ProfileMedia } from "@/components/ProfileMedia";
import { CosmeticAvatar } from "@/components/CosmeticAvatar";
import { useAuthStore } from "@/store/auth";
import { VerifiedBadge } from "@/components/VerifiedBadge";
import { cosmeticPreviewText, nameStyleColors, profileThemeColors } from "@/lib/cosmetics";
import { colors, gradients } from "@/theme/colors";
import { LinearGradient } from "expo-linear-gradient";

export default function UserProfileDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;

  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["users", id],
    queryFn: () => usersApi.get(id),
    enabled: !!id
  });

  const { data: statsData } = useQuery({
    queryKey: ["users", id, "stats"],
    queryFn: () => usersApi.getUserStats(id),
    enabled: !!id
  });

  const { data: friendStatusData } = useQuery({
    queryKey: ["friends", "status", id],
    queryFn: () => friendsApi.status(id),
    enabled: !!id && id !== currentUser?._id
  });

  const { data: friendCountData } = useQuery({
    queryKey: ["friends", "count", id],
    queryFn: () => friendsApi.count(id),
    enabled: !!id
  });

  const { data: mutualData } = useQuery({
    queryKey: ["friends", "mutual", id],
    queryFn: () => friendsApi.mutual(id),
    enabled: !!id && id !== currentUser?._id
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
  const isCloseFriend = user?.isCloseFriend ?? false;
  const level = user?.levelStatus ?? { level: user?.level ?? 1, title: user?.levelTitle ?? "New Vibe", xp: user?.xp ?? 0 };
  const friendStatus = friendStatusData?.status ?? "NONE";
  const friendCount = friendCountData?.count ?? 0;
  const mutualCount = mutualData?.mutualCount ?? 0;
  const mutualFriends = mutualData?.mutual ?? [];
  const isOwnProfile = id === currentUser?._id;
  const roomsHosted = statsData?.roomsHosted ?? 0;
  const roomsLive = statsData?.roomsLive ?? 0;

  const followMutation = useMutation({
    mutationFn: () => isFollowing ? usersApi.unfollow(id) : usersApi.follow(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", id] });
      Alert.alert(isFollowing ? "Unfollowed" : "Following", isFollowing ? `You unfollowed ${user?.name}.` : `You are now following ${user?.name}.`);
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const friendRequestMutation = useMutation({
    mutationFn: () => friendsApi.request(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "status", id] });
      Alert.alert("Friend Request Sent", `Friend request sent to ${user?.name}.`);
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const friendAcceptMutation = useMutation({
    mutationFn: () => friendsApi.accept(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "status", id] });
      queryClient.invalidateQueries({ queryKey: ["friends", "count", id] });
      queryClient.invalidateQueries({ queryKey: ["friends", "mutual", id] });
      Alert.alert("Friend Request Accepted", `You are now friends with ${user?.name}.`);
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const friendDeclineMutation = useMutation({
    mutationFn: () => friendsApi.decline(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "status", id] });
      Alert.alert("Declined", `Friend request from ${user?.name} declined.`);
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const unfriendMutation = useMutation({
    mutationFn: () => friendsApi.unfriend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["friends", "status", id] });
      queryClient.invalidateQueries({ queryKey: ["friends", "count", id] });
      queryClient.invalidateQueries({ queryKey: ["friends", "mutual", id] });
      Alert.alert("Unfriended", `You are no longer friends with ${user?.name}.`);
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const blockMutation = useMutation({
    mutationFn: () => usersApi.block(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", id] });
      Alert.alert("Blocked", `${user?.name} has been blocked and hidden.`);
      router.replace("/(tabs)");
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const closeFriendMutation = useMutation({
    mutationFn: () => isCloseFriend ? usersApi.removeCloseFriend(id) : usersApi.addCloseFriend(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users", id] });
      Alert.alert(isCloseFriend ? "Removed" : "Close friend", isCloseFriend ? `${user?.name} was removed from close friends.` : `${user?.name} is now a close friend.`);
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

  const mutualInterests = user?.interests?.filter((interest: string) =>
    currentUser?.interests?.includes(interest)
  ) ?? [];

  if (isLoading) return <Screen><View style={styles.center}><ActivityIndicator color={colors.pink} size="large" /></View></Screen>;
  if (error || !user) return <Screen><View style={styles.center}><Text style={styles.errorText}>User profile not found.</Text></View></Screen>;

  const renderFriendButton = () => {
    if (isOwnProfile) return null;
    switch (friendStatus) {
      case "ACCEPTED":
        return (
          <Pressable
            onPress={() => unfriendMutation.mutate()}
            disabled={unfriendMutation.isPending}
            style={[styles.actionBtn, styles.friendActive]}
          >
            <UserCheck color={colors.text} size={18} />
            <Text style={styles.actionBtnText}>Friends</Text>
          </Pressable>
        );
      case "PENDING":
        return (
          <View style={styles.pendingRow}>
            <Pressable
              onPress={() => friendAcceptMutation.mutate()}
              disabled={friendAcceptMutation.isPending}
              style={[styles.actionBtn, styles.acceptBtn]}
            >
              <UserCheck color={colors.ink} size={18} />
              <Text style={[styles.actionBtnText, { color: colors.ink }]}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={() => friendDeclineMutation.mutate()}
              disabled={friendDeclineMutation.isPending}
              style={[styles.actionBtn, styles.declineBtn]}
            >
              <UserX color={colors.danger} size={18} />
              <Text style={[styles.actionBtnText, { color: colors.danger }]}>Decline</Text>
            </Pressable>
          </View>
        );
      case "SENT":
        return (
          <Pressable
            disabled
            style={[styles.actionBtn, styles.pendingSentBtn]}
          >
            <Clock color={colors.muted} size={18} />
            <Text style={[styles.actionBtnText, { color: colors.muted }]}>Request Sent</Text>
          </Pressable>
        );
      default:
        return (
          <Pressable
            onPress={() => friendRequestMutation.mutate()}
            disabled={friendRequestMutation.isPending}
            style={[styles.actionBtn, styles.addFriendBtn]}
          >
            <UserPlus color={colors.text} size={18} />
            <Text style={styles.actionBtnText}>Add Friend</Text>
          </Pressable>
        );
    }
  };

  return (
    <Screen>
      <View style={styles.container}>
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

          <LinearGradient colors={themeColors} style={styles.detailsContent}>
            <View style={styles.nameRow}>
              {active?.nameStyle ? (
                <LinearGradient colors={nameColors} style={styles.namePlate}>
                  <Text style={styles.styledName}>{user.name}, {user.age || 22}</Text>
                </LinearGradient>
              ) : (
                <Text style={styles.name}>{user.name}, {user.age || 22}</Text>
              )}
              {user.isVerified && <VerifiedBadge level={user.verificationLevel || "BASIC"} size={22} />}
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
              {user.isOnline && <Text style={styles.onlinePill}>Online</Text>}
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user.followersCount ?? 0}</Text>
                <Text style={styles.statLabel}>Followers</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{user.followingCount ?? 0}</Text>
                <Text style={styles.statLabel}>Following</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{friendCount}</Text>
                <Text style={styles.statLabel}>Friends</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <View style={styles.levelBadge}>
                  <Sparkles color={colors.gold} size={12} />
                  <Text style={styles.levelBadgeText}>{level.level}</Text>
                </View>
                <Text style={styles.statLabel}>{level.title}</Text>
              </View>
            </View>

            <View style={styles.statsRow}>
              <View style={styles.statItem}>
                <Home color={colors.cyan} size={16} />
                <Text style={styles.statValue}>{roomsHosted}</Text>
                <Text style={styles.statLabel}>Rooms Hosted</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Radio color={colors.pink} size={16} />
                <Text style={styles.statValue}>{roomsLive}</Text>
                <Text style={styles.statLabel}>Live Now</Text>
              </View>
            </View>

            <View style={styles.levelPill}>
              <Sparkles color={colors.gold} size={14} />
              <Text style={styles.levelPillText}>Level {level.level} / {level.title}</Text>
              <Text style={styles.levelXpText}>{level.xp} XP</Text>
            </View>

            {mutualCount > 0 && !isOwnProfile && (
              <View style={styles.mutualSection}>
                <View style={styles.mutualRow}>
                  <Users color={colors.cyan} size={14} />
                  <Text style={styles.mutualText}>{mutualCount} mutual friend{mutualCount !== 1 ? "s" : ""}</Text>
                </View>
                {mutualFriends.length > 0 && (
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {mutualFriends.map((mf: any) => (
                      <Pressable
                        key={mf._id}
                        onPress={() => router.push({ pathname: "/profile/[id]", params: { id: mf._id } })}
                        style={styles.mutualAvatarWrap}
                      >
                        <Image source={{ uri: mf.avatar }} style={styles.mutualAvatar} />
                      </Pressable>
                    ))}
                  </ScrollView>
                )}
              </View>
            )}

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
                <Text style={styles.vibeText}>"{user.vibeLine}"</Text>
              </View>
            )}

            <View style={styles.actionRow}>
              {renderFriendButton()}

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

            <Pressable
              onPress={() => closeFriendMutation.mutate()}
              disabled={closeFriendMutation.isPending}
              style={[styles.closeFriendBtn, isCloseFriend && styles.closeFriendActive]}
            >
              <Star color={isCloseFriend ? colors.ink : colors.gold} size={18} fill={isCloseFriend ? colors.ink : "transparent"} />
              <Text style={[styles.closeFriendText, isCloseFriend && styles.closeFriendActiveText]}>
                {closeFriendMutation.isPending ? "Updating..." : isCloseFriend ? "Close friend" : "Add to close friends"}
              </Text>
            </Pressable>

            {user.bio && (
              <View style={styles.infoBlock}>
                <Text style={styles.blockTitle}>About Me</Text>
                <Text style={styles.bioText}>{user.bio}</Text>
              </View>
            )}

            {user.profileMedia && user.profileMedia.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.blockTitle}>Profile Media</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.mediaGalleryContent}>
                  {user.profileMedia.map((item: any) => (
                    <Pressable key={item._id ?? item.url} style={styles.mediaTileH} onPress={() => setSelectedMedia(item)}>
                      <ProfileMedia item={item} />
                      {!!item.caption && <Text style={styles.mediaCaption} numberOfLines={1}>{item.caption}</Text>}
                    </Pressable>
                  ))}
                </ScrollView>
              </View>
            )}

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

            {user.hobbies && user.hobbies.length > 0 && (
              <View style={styles.infoBlock}>
                <Text style={styles.blockTitle}>Hobbies</Text>
                <View style={styles.chipsRow}>
                  {user.hobbies.map((hobby: string) => (
                    <View key={hobby} style={styles.chip}>
                      <Text style={styles.chipText}>{hobby}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

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

            {!isOwnProfile && (
              <Pressable style={styles.blockUserBtn} onPress={handleBlock}>
                <Ban color={colors.danger} size={16} />
                <Text style={styles.blockUserText}>Block {user.name}</Text>
              </Pressable>
            )}
          </LinearGradient>
        </ScrollView>
        <Modal visible={!!selectedMedia} transparent animationType="fade" onRequestClose={() => setSelectedMedia(null)}>
          <View style={styles.viewerBackdrop}>
            <Pressable style={styles.viewerClose} onPress={() => setSelectedMedia(null)}>
              <Text style={styles.viewerCloseText}>Close</Text>
            </Pressable>
            {selectedMedia?.type === "VIDEO" ? (
              <ProfileMedia item={selectedMedia} mode="viewer" />
            ) : (
              <ProfileMedia item={selectedMedia} mode="viewer" />
            )}
            {!!selectedMedia?.caption && <Text style={styles.viewerCaption}>{selectedMedia.caption}</Text>}
          </View>
        </Modal>
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
  onlinePill: { color: colors.ink, backgroundColor: colors.success, borderRadius: 8, overflow: "hidden", paddingHorizontal: 8, paddingVertical: 3, fontSize: 11, fontWeight: "900" },
  statsRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginTop: 14,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: colors.line
  },
  statItem: {
    alignItems: "center",
    gap: 2,
    flex: 1
  },
  statValue: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900"
  },
  statLabel: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "800",
    marginTop: 2
  },
  statDivider: {
    width: 1,
    height: 28,
    backgroundColor: colors.line
  },
  levelBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(246,180,75,0.15)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8
  },
  levelBadgeText: {
    color: colors.gold,
    fontSize: 14,
    fontWeight: "900"
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
  mutualSection: {
    marginTop: 12,
    backgroundColor: "rgba(39,211,255,0.06)",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "rgba(39,211,255,0.15)"
  },
  mutualRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 8
  },
  mutualText: {
    color: colors.cyan,
    fontSize: 13,
    fontWeight: "900"
  },
  mutualAvatarWrap: {
    marginRight: 8
  },
  mutualAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: colors.cyan
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
  friendActive: {
    backgroundColor: "rgba(50,213,131,0.12)",
    borderWidth: 1,
    borderColor: colors.success
  },
  addFriendBtn: {
    backgroundColor: "rgba(138,92,255,0.12)",
    borderWidth: 1,
    borderColor: colors.purple
  },
  pendingSentBtn: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: colors.line
  },
  pendingRow: {
    flexDirection: "row",
    gap: 8,
    flex: 1
  },
  acceptBtn: {
    backgroundColor: colors.success,
    flex: 1
  },
  declineBtn: {
    backgroundColor: "rgba(255,91,110,0.1)",
    borderWidth: 1,
    borderColor: colors.danger,
    flex: 1
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
  closeFriendBtn: {
    minHeight: 46,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "rgba(246,180,75,0.35)",
    backgroundColor: "rgba(246,180,75,0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8
  },
  closeFriendActive: {
    backgroundColor: colors.gold,
    borderColor: colors.gold
  },
  closeFriendText: {
    color: colors.gold,
    fontWeight: "900"
  },
  closeFriendActiveText: {
    color: colors.ink
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
  mediaGalleryContent: {
    gap: 10
  },
  mediaTileH: {
    width: 160,
    borderRadius: 8,
    overflow: "hidden",
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  mediaCaption: {
    color: colors.text,
    padding: 8,
    fontSize: 12,
    fontWeight: "800"
  },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(5,7,19,0.96)", alignItems: "center", justifyContent: "center", padding: 18 },
  viewerClose: { position: "absolute", top: 48, right: 18, zIndex: 2, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 8 },
  viewerCloseText: { color: colors.text, fontWeight: "900" },
  viewerCaption: { color: colors.text, marginTop: 16, textAlign: "center", fontWeight: "800", lineHeight: 22 },
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
