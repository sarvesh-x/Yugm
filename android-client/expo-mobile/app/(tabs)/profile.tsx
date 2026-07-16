import { useState } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, Image as ImageIcon, Medal, Settings, Sparkles, Star, Trash2, UserPlus, UserCheck, Wallet } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as ImagePicker from "expo-image-picker";
import { GlassCard } from "@/components/GlassCard";
import { CosmeticAvatar } from "@/components/CosmeticAvatar";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { ProfileMedia } from "@/components/ProfileMedia";
import { Screen, Section } from "@/components/Screen";
import { uploadProfileMedia, usersApi, experienceApi } from "@/lib/api";
import { cosmeticPreviewText, nameStyleColors, profileThemeColors } from "@/lib/cosmetics";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function Profile() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const queryClient = useQueryClient();
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaCaption, setMediaCaption] = useState("");
  const [mediaType, setMediaType] = useState<"IMAGE" | "VIDEO">("IMAGE");
  const [selectedMedia, setSelectedMedia] = useState<any | null>(null);
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
  const isCloseFriend = Boolean(user?.isCloseFriend);
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

  const addCloseFriend = useMutation({
    mutationFn: () => usersApi.addCloseFriend(profileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", profileId] }),
    onError: (err: any) => Alert.alert("Close friend failed", err?.message ?? "Please try again.")
  });

  const removeCloseFriend = useMutation({
    mutationFn: () => usersApi.removeCloseFriend(profileId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["user", profileId] }),
    onError: (err: any) => Alert.alert("Close friend failed", err?.message ?? "Please try again.")
  });

  const addMedia = useMutation({
    mutationFn: () => usersApi.addProfileMedia({ url: mediaUrl.trim(), caption: mediaCaption.trim() || undefined, type: mediaType }),
    onSuccess: (data) => {
      setMediaUrl("");
      setMediaCaption("");
      queryClient.invalidateQueries({ queryKey: ["user", profileId] });
      if (currentUser) updateUser({ ...currentUser, profileMedia: data.user.profileMedia });
    },
    onError: (err: any) => Alert.alert("Could not post media", err?.message ?? "Use a valid image or video URL.")
  });

  const removeMedia = useMutation({
    mutationFn: (mediaId: string) => usersApi.removeProfileMedia(mediaId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["user", profileId] });
      if (currentUser) updateUser({ ...currentUser, profileMedia: data.user.profileMedia });
    },
    onError: (err: any) => Alert.alert("Could not remove media", err?.message ?? "Please try again.")
  });

  const pickMedia = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow media access to upload profile photos or videos.");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
      quality: 0.9,
      videoMaxDuration: 60
    });
    if (result.canceled || !result.assets?.[0]) return;
    try {
      const asset = result.assets[0];
      const mime = asset.mimeType ?? (asset.type === "video" ? "video/mp4" : "image/jpeg");
      const extension = mime.includes("/") ? mime.split("/")[1].replace("quicktime", "mov") : "jpg";
      const uploaded = await uploadProfileMedia({ uri: asset.uri, type: mime, name: asset.fileName ?? `profile-media.${extension}` });
      setMediaUrl(uploaded.url);
      setMediaType(uploaded.type);
      Alert.alert("Media uploaded", "Add a caption and post it to your profile.");
    } catch (err: any) {
      Alert.alert("Upload failed", err?.message ?? "Please try another file.");
    }
  };

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
            <View style={styles.actionStack}>
              <Pressable
                style={[styles.followBtn, followed && styles.followingBtn, (follow.isPending || unfollow.isPending) && styles.followBtnDisabled]}
                onPress={() => (follow.isPending || unfollow.isPending ? null : followed ? unfollow.mutate() : follow.mutate())}
              >
                {followed ? <UserCheck color={colors.ink} size={18} /> : <UserPlus color={colors.ink} size={18} />}
                <Text style={styles.followText}>
                  {follow.isPending ? "Following..." : unfollow.isPending ? "Unfollowing..." : followed ? "Following" : "Follow"}
                </Text>
              </Pressable>
              <Pressable
                style={[styles.closeFriendBtn, isCloseFriend && styles.closeFriendActive, (addCloseFriend.isPending || removeCloseFriend.isPending) && styles.followBtnDisabled]}
                onPress={() => isCloseFriend ? removeCloseFriend.mutate() : addCloseFriend.mutate()}
                disabled={addCloseFriend.isPending || removeCloseFriend.isPending}
              >
                <Star color={isCloseFriend ? colors.ink : colors.gold} size={18} fill={isCloseFriend ? colors.ink : "transparent"} />
                <Text style={[styles.closeFriendText, isCloseFriend && styles.closeFriendActiveText]}>{isCloseFriend ? "Close friend" : "Add close friend"}</Text>
              </Pressable>
            </View>
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
          <Text style={styles.sectionTitle}>Detailed profile</Text>
          <View style={styles.detailBlock}>
            <ChipGroup title="Interests" items={user?.interests ?? []} />
            <ChipGroup title="Hobbies" items={user?.hobbies ?? []} />
            <ChipGroup title="Languages" items={user?.languages ?? []} />
          </View>
        </Section>
        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Profile media</Text>
            <ImageIcon color={colors.pink} size={18} />
          </View>
          {isOwn && (
            <View style={styles.mediaComposer}>
              <View style={styles.mediaTypeRow}>
                {(["IMAGE", "VIDEO"] as const).map((type) => (
                  <Pressable key={type} style={[styles.mediaTypeBtn, mediaType === type && styles.mediaTypeActive]} onPress={() => setMediaType(type)}>
                    <Text style={[styles.mediaTypeText, mediaType === type && styles.mediaTypeActiveText]}>{type === "IMAGE" ? "Image" : "Video"}</Text>
                  </Pressable>
                ))}
              </View>
              <Pressable style={styles.pickMediaBtn} onPress={pickMedia}>
                <ImageIcon color={colors.gold} size={17} />
                <Text style={styles.pickMediaText}>Choose from gallery</Text>
              </Pressable>
              <TextInput value={mediaUrl} onChangeText={setMediaUrl} placeholder="Paste media URL" placeholderTextColor={colors.muted} style={styles.input} />
              <TextInput value={mediaCaption} onChangeText={setMediaCaption} placeholder="Caption" placeholderTextColor={colors.muted} style={styles.input} />
              <Pressable style={[styles.postMediaBtn, (!mediaUrl.trim() || addMedia.isPending) && styles.followBtnDisabled]} onPress={() => addMedia.mutate()} disabled={!mediaUrl.trim() || addMedia.isPending}>
                <Text style={styles.postMediaText}>{addMedia.isPending ? "Posting..." : "Post to profile"}</Text>
              </Pressable>
            </View>
          )}
          {!(user?.profileMedia ?? []).length ? (
            <EmptyState icon="IMG" message="No profile media yet" />
          ) : (
            <View style={styles.mediaGrid}>
              {(user.profileMedia ?? []).map((item: any) => (
                <Pressable key={item._id ?? item.url} style={styles.mediaTile} onPress={() => setSelectedMedia(item)}>
                  <ProfileMedia item={item} />
                  {!!item.caption && <Text style={styles.mediaCaption}>{item.caption}</Text>}
                  {isOwn && (
                    <Pressable style={styles.removeMediaBtn} onPress={() => removeMedia.mutate(item._id)}>
                      <Trash2 color={colors.text} size={14} />
                    </Pressable>
                  )}
                </Pressable>
              ))}
            </View>
          )}
        </Section>
        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Badges</Text>
            <Sparkles color={colors.gold} size={16} />
          </View>
          <BadgeShowcase userId={profileId} isOwn={isOwn} />
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
    </Screen>
  );
}

const TIER_COLORS: Record<string, string> = {
  BRONZE: "#CD7F32", SILVER: "#C0C0C0", GOLD: "#FFD700", PLATINUM: "#E5E4E2"
};

function BadgeShowcase({ userId, isOwn }: { userId: string; isOwn: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["badges", userId],
    queryFn: () => experienceApi.getUserBadges(userId),
    enabled: !!userId,
    staleTime: 60000
  });

  if (isLoading) return <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 20 }}><ActivityIndicator color={colors.gold} size="small" /></View>;
  const badges = data?.badges ?? [];
  if (!badges.length) return <EmptyState icon="🏅" message={isOwn ? "Claim achievements to showcase badges here" : "No badges yet"} />;

  return (
    <View style={styles.badgeRow}>
      {badges.slice(0, 5).map((badge: any) => {
        const tierColor = TIER_COLORS[badge.tier] ?? colors.gold;
        return (
          <View key={badge.id} style={[styles.badgeCard, { borderColor: tierColor }]}>
            <Medal color={tierColor} size={22} />
            <Text style={styles.badgeTitle} numberOfLines={1}>{badge.title}</Text>
            <Text style={[styles.badgeTier, { color: tierColor }]}>{badge.tier}</Text>
          </View>
        );
      })}
    </View>
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

function ChipGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <View style={styles.chipGroup}>
      <Text style={styles.chipTitle}>{title}</Text>
      {!items.length ? (
        <Text style={styles.emptyInline}>Not added yet</Text>
      ) : (
        <View style={styles.chipRow}>
          {items.map((item) => <View key={item} style={styles.chip}><Text style={styles.chipText}>{item}</Text></View>)}
        </View>
      )}
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
  actionStack: { gap: 10, marginBottom: 10 },
  followingBtn: { backgroundColor: colors.gold },
  followBtnDisabled: { opacity: 0.5 },
  followText: { color: colors.ink, fontWeight: "900", fontSize: 16 },
  closeFriendBtn: { height: 46, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  closeFriendActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  closeFriendText: { color: colors.text, fontWeight: "900" },
  closeFriendActiveText: { color: colors.ink },
  wallet: { height: 50, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 10 },
  walletText: { color: colors.text, fontWeight: "900" },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 12 },
  detailBlock: { gap: 14 },
  chipGroup: { gap: 8 },
  chipTitle: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  chipText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  emptyInline: { color: colors.muted, fontSize: 13, fontWeight: "700" },
  mediaComposer: { gap: 10, marginBottom: 14 },
  mediaTypeRow: { flexDirection: "row", gap: 8 },
  mediaTypeBtn: { flex: 1, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  mediaTypeActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  mediaTypeText: { color: colors.text, fontWeight: "900" },
  mediaTypeActiveText: { color: colors.ink },
  input: { height: 44, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 12, fontWeight: "800" },
  postMediaBtn: { height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.pink },
  postMediaText: { color: colors.text, fontWeight: "900" },
  pickMediaBtn: { height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  pickMediaText: { color: colors.text, fontWeight: "900" },
  mediaGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  mediaTile: { width: "48%", minHeight: 150, borderRadius: 8, overflow: "hidden", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, position: "relative" },
  mediaImage: { width: "100%", height: 118, backgroundColor: colors.panelStrong },
  videoTile: { height: 118, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelStrong },
  videoText: { color: colors.gold, fontWeight: "900" },
  mediaCaption: { color: colors.text, fontSize: 12, fontWeight: "800", padding: 8 },
  removeMediaBtn: { position: "absolute", top: 8, right: 8, width: 30, height: 30, borderRadius: 8, backgroundColor: "rgba(5,7,19,0.74)", alignItems: "center", justifyContent: "center" },
  viewerBackdrop: { flex: 1, backgroundColor: "rgba(5,7,19,0.96)", alignItems: "center", justifyContent: "center", padding: 18 },
  viewerClose: { position: "absolute", top: 48, right: 18, zIndex: 2, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 8 },
  viewerCloseText: { color: colors.text, fontWeight: "900" },
  viewerImage: { width: "100%", height: "72%" },
  viewerVideo: { width: "100%", height: "60%", borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  viewerVideoText: { color: colors.gold, fontSize: 24, fontWeight: "900" },
  viewerCaption: { color: colors.text, marginTop: 16, textAlign: "center", fontWeight: "800", lineHeight: 22 },
  roomCard: { marginBottom: 10 },
  hosted: { color: colors.text, fontWeight: "900", fontSize: 16 },
  hostedMeta: { color: colors.muted, marginTop: 4 },
  badgeRow: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  badgeCard: { width: "30%", minWidth: 90, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, padding: 10, alignItems: "center", gap: 4 },
  badgeTitle: { color: colors.text, fontSize: 11, fontWeight: "900", textAlign: "center" },
  badgeTier: { fontSize: 9, fontWeight: "900" }
});
