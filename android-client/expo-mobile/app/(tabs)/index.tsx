import { useCallback, useState } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, Pressable } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Plus, Search, Trophy, Users } from "lucide-react-native";
import { categories } from "@yugm/shared";
import { BrandMark } from "@/components/BrandMark";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { RoomCard } from "@/components/RoomCard";
import { Screen, Section } from "@/components/Screen";
import { roomsApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function Discover() {
  const user = useAuthStore((state) => state.user);
  const [selectedCategory, setSelectedCategory] = useState("Trending");
  const queryClient = useQueryClient();
  const categoryFilter = selectedCategory === "Trending" ? undefined : selectedCategory;
  const trending = useQuery({ queryKey: ["rooms", "trending", categoryFilter], queryFn: () => categoryFilter ? roomsApi.list({ category: categoryFilter }) : roomsApi.trending(), staleTime: 30000, gcTime: 60000 });
  const voice = useQuery({ queryKey: ["rooms", "VOICE", categoryFilter], queryFn: () => roomsApi.list({ type: "VOICE", category: categoryFilter }), staleTime: 30000, gcTime: 60000 });
  const video = useQuery({ queryKey: ["rooms", "VIDEO", categoryFilter], queryFn: () => roomsApi.list({ type: "VIDEO", category: categoryFilter }), staleTime: 30000, gcTime: 60000 });
  const recommended = useQuery({ queryKey: ["rooms", "recommended"], queryFn: roomsApi.recommended, staleTime: 30000, gcTime: 60000 });
  const scheduled = useQuery({ queryKey: ["rooms", "scheduled"], queryFn: roomsApi.scheduled, staleTime: 30000, gcTime: 60000 });
  const leaderboard = useQuery({ queryKey: ["rooms", "leaderboard"], queryFn: roomsApi.leaderboard, staleTime: 30000, gcTime: 60000 });

  useFocusEffect(useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
  }, [queryClient]));

  const anyLoading = trending.isLoading || voice.isLoading || video.isLoading || recommended.isLoading || scheduled.isLoading || leaderboard.isLoading;
  const anyError = trending.error || voice.error || video.error;
  const refetchAll = () => { trending.refetch(); voice.refetch(); video.refetch(); recommended.refetch(); scheduled.refetch(); leaderboard.refetch(); };
  const hasAnyRooms = (trending.data?.rooms?.length ?? 0) > 0 || (voice.data?.rooms?.length ?? 0) > 0 || (video.data?.rooms?.length ?? 0) > 0 || (recommended.data?.rooms?.length ?? 0) > 0 || (scheduled.data?.rooms?.length ?? 0) > 0;

  const allRooms = [...(trending.data?.rooms ?? []), ...(voice.data?.rooms ?? []), ...(video.data?.rooms ?? [])];
  const uniqueHosts = allRooms.filter((r, i, a) => r.hostId?._id && a.findIndex((x) => x.hostId?._id === r.hostId?._id) === i).slice(0, 4);

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={anyLoading} onRefresh={refetchAll} tintColor={colors.gold} />}
      >
        <Section>
          <View style={styles.header}>
            <View>
              <BrandMark compact />
              <Text style={styles.greeting}>Hey {user?.name?.split(" ")[0] ?? ""}, find your room.</Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable style={styles.iconButton} onPress={() => router.push("/(tabs)/hosts")}>
                <Users color={colors.text} size={22} />
              </Pressable>
              <Pressable style={styles.create} onPress={() => router.push("/room/create")}>
                <Plus color={colors.text} size={24} />
              </Pressable>
            </View>
          </View>
          <Pressable style={styles.search} onPress={() => router.push("/(tabs)/search")}>
            <Search color={colors.muted} size={18} />
            <TextInput placeholder="Search rooms, hosts, tags" placeholderTextColor={colors.muted} style={styles.searchInput} keyboardType="default" editable={false} />
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips} nestedScrollEnabled>
            {categories.map((item) => {
              const selected = item === selectedCategory;
              return (
                <Pressable key={item} onPress={() => setSelectedCategory(item)} style={[styles.chip, selected && styles.chipActive]}>
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>
        {anyError ? (
          <ErrorState message={"Failed to load rooms"} onRetry={refetchAll} />
        ) : !hasAnyRooms && !anyLoading ? (
          <EmptyState icon={<Users color={colors.gold} size={32} />} message="No rooms yet. Be the first to go live!" />
        ) : (
          <>
            {recommended.data?.rooms?.length ? <RoomRail title="For you" rooms={recommended.data.rooms} /> : null}
            {trending.isLoading ? <LoadingState message="Loading featured rooms..." /> : trending.data?.rooms?.length ? <RoomRail title={categoryFilter ? `${categoryFilter} rooms` : "Featured live"} rooms={trending.data.rooms} /> : null}
            {voice.isLoading ? <LoadingState message="Loading voice rooms..." /> : voice.data?.rooms?.length ? <RoomRail title="Voice rooms" rooms={voice.data.rooms} /> : null}
            {video.isLoading ? <LoadingState message="Loading video rooms..." /> : video.data?.rooms?.length ? <RoomRail title="Video rooms" rooms={video.data.rooms} /> : null}
            {scheduled.data?.rooms?.length ? <ScheduledRail rooms={scheduled.data.rooms} /> : null}
            {leaderboard.data ? <Leaderboard topRooms={leaderboard.data.topRooms} topHosts={leaderboard.data.topHosts} /> : null}
            {uniqueHosts.length > 0 && (
              <Section>
                <Text style={styles.sectionTitle}>Popular hosts</Text>
                {uniqueHosts.map((room: any) => (
                  <Pressable key={room._id} style={styles.hostRow} onPress={() => router.push({ pathname: "/(tabs)/profile", params: { userId: room.hostId?._id } })}>
                    <View style={styles.avatar}><Text style={styles.avatarText}>{room.hostId?.name?.[0] ?? "Y"}</Text></View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hostName}>{room.hostId?.name ?? ""}</Text>
                      <Text style={styles.hostMeta}>{room.category} / {room.language}</Text>
                    </View>
                  </Pressable>
                ))}
              </Section>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function RoomRail({ title, rooms }: { title: string; rooms: any[] }) {
  return (
    <Section>
      <Text style={styles.sectionTitle}>{title}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        {rooms.map((room) => <RoomCard key={room._id} room={room} onPress={() => room.status === "SCHEDULED" ? Alert.alert("Reminder set", "We'll nudge you when this scheduled room starts.") : router.push({ pathname: "/room/[id]", params: { id: room._id, type: room.type } })} />)}
      </ScrollView>
    </Section>
  );
}

function ScheduledRail({ rooms }: { rooms: any[] }) {
  return (
    <Section>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Scheduled rooms</Text>
        <Bell color={colors.gold} size={18} />
      </View>
      {rooms.slice(0, 4).map((room) => (
        <Pressable key={room._id} style={styles.scheduleRow} onPress={() => Alert.alert("Reminder set", `${room.title} is on your watchlist.`)}>
          <View style={styles.scheduleIcon}><Bell color={colors.gold} size={18} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.hostName}>{room.title}</Text>
            <Text style={styles.hostMeta}>{room.hostId?.name ?? "Host"} / {room.scheduledFor ? new Date(room.scheduledFor).toLocaleString() : "Soon"}</Text>
          </View>
        </Pressable>
      ))}
    </Section>
  );
}

function Leaderboard({ topRooms, topHosts }: { topRooms: any[]; topHosts: any[] }) {
  if (!topRooms.length && !topHosts.length) return null;
  return (
    <Section>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Leaderboard</Text>
        <Trophy color={colors.gold} size={20} />
      </View>
      {topRooms.slice(0, 3).map((room, index) => (
        <Pressable key={room._id} style={styles.rankRow} onPress={() => router.push({ pathname: "/room/[id]", params: { id: room._id, type: room.type } })}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.hostName}>{room.title}</Text>
            <Text style={styles.hostMeta}>{room.participantCount} live / {room.hostId?.name ?? "Host"}</Text>
          </View>
        </Pressable>
      ))}
      {topHosts.slice(0, 3).map((host, index) => (
        <Pressable key={host._id} style={styles.rankRow} onPress={() => router.push({ pathname: "/(tabs)/profile", params: { userId: host._id } })}>
          <Text style={styles.rank}>{index + 1}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.hostName}>{host.name}</Text>
            <Text style={styles.hostMeta}>{host.followersCount ?? 0} followers / host score</Text>
          </View>
        </Pressable>
      ))}
    </Section>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  greeting: { color: colors.muted, marginTop: 8 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  iconButton: { height: 48, width: 48, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  create: { height: 48, width: 48, borderRadius: 8, backgroundColor: colors.purple, alignItems: "center", justifyContent: "center" },
  search: { marginTop: 20, height: 50, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10 },
  searchInput: { flex: 1, color: colors.text },
  chips: { marginTop: 14 },
  chip: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, paddingVertical: 9, borderRadius: 8, marginRight: 8 },
  chipActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  chipText: { color: colors.text, fontWeight: "800" },
  chipTextActive: { color: colors.ink },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 12 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  scheduleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  scheduleIcon: { width: 38, height: 38, borderRadius: 8, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10 },
  rank: { width: 32, height: 32, borderRadius: 8, overflow: "hidden", textAlign: "center", textAlignVertical: "center", color: colors.ink, backgroundColor: colors.gold, fontWeight: "900" },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  avatar: { height: 44, width: 44, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.gold, fontWeight: "900", fontSize: 18 },
  hostName: { color: colors.text, fontWeight: "900" },
  hostMeta: { color: colors.muted, fontSize: 12, marginTop: 2 }
});
