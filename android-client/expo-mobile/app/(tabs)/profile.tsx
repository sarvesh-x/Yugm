import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Settings, UserPlus, UserCheck, Wallet } from "lucide-react-native";
import { GlassCard } from "@/components/GlassCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Screen, Section } from "@/components/Screen";
import { usersApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function Profile() {
  const { userId } = useLocalSearchParams<{ userId?: string }>();
  const currentUser = useAuthStore((s) => s.user);
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
  const followed = Boolean(user?.isFollowing);

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

  if (profileLoading) return <Screen><LoadingState /></Screen>;
  if (profileError) return <Screen><ErrorState message={(profileError as any)?.message} onRetry={refetchProfile} /></Screen>;

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={profileLoading} onRefresh={refetchProfile} tintColor={colors.gold} />}>
        <Section>
          <View style={styles.top}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{user?.name?.[0] ?? ""}</Text></View>
            {isOwn && <Pressable onPress={() => router.push("/(tabs)/settings")}><Settings color={colors.text} /></Pressable>}
          </View>
          <Text style={styles.name}>{user?.name ?? ""}</Text>
          <Text style={styles.username}>@{user?.username ?? ""}</Text>
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

const styles = StyleSheet.create({
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 10 },
  avatar: { width: 92, height: 92, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  avatarText: { color: colors.gold, fontSize: 42, fontWeight: "900" },
  name: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 18 },
  username: { color: colors.gold, fontWeight: "800", marginTop: 2 },
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
