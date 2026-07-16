import { useCallback, useState, useEffect } from "react";
import { Alert, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, Pressable, Image, ActivityIndicator } from "react-native";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Flame, Gamepad2, Heart, Mic, Plus, Radio, Search, Sparkles, Users, Video } from "lucide-react-native";
import { categories } from "@yugm/shared";
import { BrandMark } from "@/components/BrandMark";
import { RoomCard } from "@/components/RoomCard";
import { ErrorState } from "@/components/ErrorState";
import { Screen, Section } from "@/components/Screen";
import { roomsApi, usersApi, datingApi, storiesApi, feedApi } from "@/lib/api";
import { StoriesRing, type StoryGroup } from "@/components/StoriesRing";
import { useAuthStore } from "@/store/auth";
import { colors, gradients } from "@/theme/colors";
import { LinearGradient } from "expo-linear-gradient";

export default function Discover() {
  const user = useAuthStore((state) => state.user);
  const [selectedCategory, setSelectedCategory] = useState("Trending");
  const [greeting, setGreeting] = useState("Hey there");
  const queryClient = useQueryClient();

  // Set time-based greeting
  useEffect(() => {
    const hours = new Date().getHours();
    if (hours >= 5 && hours < 12) setGreeting("Good morning");
    else if (hours >= 12 && hours < 17) setGreeting("Good afternoon");
    else setGreeting("Good evening");
  }, []);

  const storiesQuery = useQuery({
    queryKey: ["stories", "feed"],
    queryFn: storiesApi.feed,
    staleTime: 15000,
    gcTime: 30000
  });

  const categoryFilter = selectedCategory === "Trending" ? undefined : selectedCategory;

  // React Query feeds
  const exploreQuery = useQuery({
    queryKey: ["dating", "explore"],
    queryFn: datingApi.explore,
    staleTime: 30000,
    gcTime: 60000
  });

  const trendingRooms = useQuery({
    queryKey: ["rooms", "trending", categoryFilter],
    queryFn: () => categoryFilter ? roomsApi.list({ category: categoryFilter }) : roomsApi.trending(),
    staleTime: 30000,
    gcTime: 60000
  });

  const hostsQuery = useQuery({
    queryKey: ["users", "suggestedHosts"],
    queryFn: usersApi.suggestedHosts,
    staleTime: 30000,
    gcTime: 60000
  });

  const feedQuery = useQuery({
    queryKey: ["feed"],
    queryFn: feedApi.get,
    staleTime: 15000,
    gcTime: 30000
  });

  useFocusEffect(
    useCallback(() => {
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["dating", "explore"] });
      queryClient.invalidateQueries({ queryKey: ["users", "suggestedHosts"] });
    }, [queryClient])
  );

  const isLoading = exploreQuery.isLoading || trendingRooms.isLoading || hostsQuery.isLoading;
  const isRefreshing = exploreQuery.isRefetching || trendingRooms.isRefetching || hostsQuery.isRefetching;
  const hasError = exploreQuery.isError && trendingRooms.isError && hostsQuery.isError;

  const handleRefetch = () => {
    exploreQuery.refetch();
    trendingRooms.refetch();
    hostsQuery.refetch();
  };

  const candidates = exploreQuery.data?.candidates ?? [];
  const featuredCandidate = candidates[0];
  const nearbyCandidates = candidates.slice(1, 8);
  const rooms = trendingRooms.data?.rooms ?? [];
  const popularHosts = hostsQuery.data?.users ?? [];

  // Swipe Action
  const handleLikeFeatured = async () => {
    if (!featuredCandidate) return;
    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const res = await datingApi.like(featuredCandidate.id, "LIKE");
      if (res.isMatch) {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert("It's a Yugm! 🎉", `You matched with ${featuredCandidate.name}! Go to chat to say hi.`);
      } else {
        Alert.alert("Vibe sent", `We let ${featuredCandidate.name} know you're interested.`);
      }
      queryClient.invalidateQueries({ queryKey: ["dating", "explore"] });
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
        refreshControl={<RefreshControl refreshing={isRefreshing} onRefresh={handleRefetch} tintColor={colors.pink} />}
      >
        <Section>
          {/* Header Row */}
          <View style={styles.header}>
            <View>
              <BrandMark compact />
              <Text style={styles.greeting}>
                {greeting}, {user?.name?.split(" ")[0] ?? "friend"}!
              </Text>
            </View>
            <View style={styles.headerActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Open notifications" style={styles.notificationsBtn} onPress={() => router.push("/(tabs)/notifications")}>
                <Bell color={colors.text} size={21} />
              </Pressable>
              <Pressable style={styles.createBtn} onPress={() => router.push("/room/create")}>
                <Plus color={colors.text} size={24} />
              </Pressable>
            </View>
          </View>

          {/* Stories Ring */}
          <StoriesRing
            groups={(storiesQuery.data?.stories ?? []) as StoryGroup[]}
            onAddPress={() => router.push("/(tabs)/create-story")}
          />

          {/* Premium Search Bar */}
          <Pressable accessibilityRole="search" style={styles.searchBar} onPress={() => router.push("/(tabs)/search")}>
            <Search color={colors.muted} size={18} />
            <TextInput
              placeholder="Find matches, vibes, live rooms..."
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
              editable={false}
            />
          </Pressable>

          {/* Quick Actions Grid */}
          <View style={styles.quickGrid}>
            <Pressable style={styles.quickCard} onPress={() => router.push("/(tabs)/match")}>
              <LinearGradient colors={gradients.fire} style={styles.quickGradient}>
                <Heart color={colors.text} size={24} fill={colors.text} />
                <Text style={styles.quickTitle}>Find Match</Text>
                <Text style={styles.quickSubtitle}>Match the vibe</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.quickCard} onPress={() => router.push("/room/create")}>
              <LinearGradient colors={["#8A5CFF", "#FF3E93"]} style={styles.quickGradient}>
                <Radio color={colors.text} size={24} />
                <Text style={styles.quickTitle}>Go Live</Text>
                <Text style={styles.quickSubtitle}>Host a lounge</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.quickCard} onPress={() => router.push("/(tabs)/games")}>
              <LinearGradient colors={["#27D3FF", "#8A5CFF"]} style={styles.quickGradient}>
                <Gamepad2 color={colors.text} size={24} />
                <Text style={styles.quickTitle}>Mini Games</Text>
                <Text style={styles.quickSubtitle}>Play quick rounds</Text>
              </LinearGradient>
            </Pressable>
          </View>

          {/* Quick Action Circle Buttons for Rooms */}
          <View style={styles.roomsFilterRow}>
            <Pressable
              style={styles.filterCircleBtn}
              onPress={() => router.push({ pathname: "/(tabs)/live", params: { type: "VOICE" } })}
            >
              <View style={[styles.filterIconCircle, { backgroundColor: "rgba(138,92,255,0.12)" }]}>
                <Mic color={colors.purple} size={20} />
              </View>
              <Text style={styles.filterText}>Voice Lounges</Text>
            </Pressable>

            <Pressable
              style={styles.filterCircleBtn}
              onPress={() => router.push({ pathname: "/(tabs)/live", params: { type: "VIDEO" } })}
            >
              <View style={[styles.filterIconCircle, { backgroundColor: "rgba(39,211,255,0.12)" }]}>
                <Video color={colors.cyan} size={20} />
              </View>
              <Text style={styles.filterText}>Video Tables</Text>
            </Pressable>
          </View>

          {/* Category Chips */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {categories.map((item) => {
              const selected = item === selectedCategory;
              return (
                <Pressable
                  key={item}
                  onPress={() => setSelectedCategory(item)}
                  style={[styles.chip, selected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </Section>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.pink} size="large" />
            <Text style={styles.loadingText}>Tuning into the vibe...</Text>
          </View>
        ) : hasError ? (
          <ErrorState message="We couldn't tune into Yugm right now. Check your connection and try again." onRetry={handleRefetch} />
        ) : (
          <>
            {/* 1. Featured Match Card */}
            {featuredCandidate && (
              <Section>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Featured Vibe Match</Text>
                  <View style={styles.vibeBadge}>
                    <Sparkles color={colors.gold} size={14} fill={colors.gold} />
                    <Text style={styles.vibeBadgeText}>Hot Vibe</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.featuredCard}
                  onPress={() => router.push({ pathname: "/profile/[id]", params: { id: featuredCandidate.id } })}
                >
                  <Image source={{ uri: featuredCandidate.avatar }} style={styles.featuredImg} />
                  <LinearGradient
                    colors={["transparent", "rgba(5,7,19,0.95)"]}
                    style={styles.featuredOverlay}
                  >
                    <View style={styles.featuredDetails}>
                      <View style={styles.featuredHeaderRow}>
                        <Text style={styles.featuredName}>
                          {featuredCandidate.name}, {featuredCandidate.age}
                        </Text>
                        <View style={styles.compatibilityBadge}>
                          <Text style={styles.compatibilityText}>
                            {featuredCandidate.vibeScore}% Vibe Match
                          </Text>
                        </View>
                      </View>

                      {featuredCandidate.vibeLine && (
                        <Text style={styles.featuredTagline}>“{featuredCandidate.vibeLine}”</Text>
                      )}

                      <View style={styles.tagsRow}>
                        {featuredCandidate.interests?.slice(0, 3).map((interest: string) => (
                          <View key={interest} style={styles.tag}>
                            <Text style={styles.tagText}>{interest}</Text>
                          </View>
                        ))}
                        <View style={styles.tag}>
                          <Text style={styles.tagText}>{featuredCandidate.city}</Text>
                        </View>
                      </View>

                      <View style={styles.featuredActions}>
                        <Pressable accessibilityRole="button" accessibilityLabel={`Send a vibe to ${featuredCandidate.name}`} style={styles.swipeVibesBtn} onPress={(event) => { event.stopPropagation(); handleLikeFeatured(); }}>
                          <LinearGradient colors={gradients.fire} style={styles.swipeGradient}>
                            <Heart color={colors.text} size={18} fill={colors.text} />
                            <Text style={styles.swipeText}>Swipe Vibes</Text>
                          </LinearGradient>
                        </Pressable>
                      </View>
                    </View>
                  </LinearGradient>
                </Pressable>
              </Section>
            )}

            {/* 2. Live Now Rooms */}
            {rooms.length > 0 && (
              <Section>
                <View style={styles.sectionHeader}>
                  <Text style={styles.sectionTitle}>Live Now Rooms</Text>
                  <View style={styles.livePulseRow}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>LIVE</Text>
                  </View>
                </View>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  {rooms.map((room: any) => (
                    <RoomCard
                      key={room._id}
                      room={room}
                      onPress={() =>
                        router.push({
                          pathname: "/room/[id]",
                          params: { id: room._id, type: room.type }
                        })
                      }
                    />
                  ))}
                </ScrollView>
              </Section>
            )}

            {/* 3. People Near You */}
            {nearbyCandidates.length > 0 && (
              <Section>
                <Text style={styles.sectionTitle}>People Near You</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.horizontalScroll}>
                  {nearbyCandidates.map((cand: any) => (
                    <Pressable
                      key={cand.id}
                      style={styles.candidateBubbleCard}
                      onPress={() => router.push({ pathname: "/profile/[id]", params: { id: cand.id } })}
                    >
                      <Image source={{ uri: cand.avatar }} style={styles.bubbleImg} />
                      <Text style={styles.bubbleName} numberOfLines={1}>
                        {cand.name.split(" ")[0]}
                      </Text>
                      <Text style={styles.bubbleVibeScore}>{cand.vibeScore}% vibe</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              </Section>
            )}

            {/* 4. Activity Feed */}
            {feedQuery.data?.feed && feedQuery.data.feed.length > 0 && (
              <Section>
                <Text style={styles.sectionTitle}>Activity Feed</Text>
                {(() => {
                  const friendRooms = feedQuery.data.feed.filter((item: any) => item.type === "FRIEND_LIVE").slice(0, 3);
                  const friendStories = feedQuery.data.feed.filter((item: any) => item.type === "FRIEND_STORY").slice(0, 3);
                  const activities = feedQuery.data.feed.filter((item: any) => item.type === "ACTIVITY").slice(0, 5);
                  return (
                    <>
                      {friendRooms.length > 0 && (
                        <View style={styles.feedSection}>
                          <View style={styles.feedSectionHeader}>
                            <View style={styles.feedLiveDot} />
                            <Text style={styles.feedSectionTitle}>Friends Live Now</Text>
                          </View>
                          {friendRooms.map((item: any, idx: number) => (
                            <Pressable
                              key={`friend-room-${item.room?._id ?? idx}`}
                              style={styles.feedItem}
                              onPress={() => router.push({ pathname: "/room/[id]", params: { id: item.room._id, type: item.room.type } })}
                            >
                              <Image source={{ uri: item.room.hostId?.avatar }} style={styles.feedAvatar} />
                              <View style={styles.feedItemContent}>
                                <Text style={styles.feedItemTitle}>{item.room.title}</Text>
                                <Text style={styles.feedItemMeta}>by {item.room.hostId?.name} · {item.room.participantCount} listening</Text>
                              </View>
                              <View style={styles.feedLiveTag}>
                                <Text style={styles.feedLiveTagText}>LIVE</Text>
                              </View>
                            </Pressable>
                          ))}
                        </View>
                      )}
                      {friendStories.length > 0 && (
                        <View style={styles.feedSection}>
                          <Text style={styles.feedSectionTitle}>Friend Stories</Text>
                          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                            {friendStories.map((item: any, idx: number) => (
                              <Pressable
                                key={`friend-story-${item.story?._id ?? idx}`}
                                style={styles.feedStoryCard}
                                onPress={() => router.push({ pathname: "/profile/[id]", params: { id: item.story.userId?._id } })}
                              >
                                <Image source={{ uri: item.story.userId?.avatar }} style={styles.feedStoryAvatar} />
                                <Text style={styles.feedStoryName} numberOfLines={1}>{item.story.userId?.name}</Text>
                              </Pressable>
                            ))}
                          </ScrollView>
                        </View>
                      )}
                      {activities.length > 0 && (
                        <View style={styles.feedSection}>
                          <Text style={styles.feedSectionTitle}>Recent Activity</Text>
                          {activities.map((item: any, idx: number) => (
                            <View key={`activity-${item.activity?._id ?? idx}`} style={styles.activityItem}>
                              <Image source={{ uri: item.activity.userId?.avatar }} style={styles.feedAvatar} />
                              <View style={styles.feedItemContent}>
                                <Text style={styles.activityText}>
                                  <Text style={styles.activityUserName}>{item.activity.userId?.name}</Text>
                                  {" "}{item.activity.label}
                                </Text>
                                <Text style={styles.activityRoom}>{item.activity.roomId?.title}</Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      )}
                    </>
                  );
                })()}
              </Section>
            )}

            {/* 5. Trending Hosts */}
            {popularHosts.length > 0 && (
              <Section>
                <Text style={styles.sectionTitle}>Trending Hosts</Text>
                {popularHosts.slice(0, 5).map((host: any) => (
                  <Pressable
                    key={host._id}
                    style={styles.hostRow}
                    onPress={() => router.push({ pathname: "/profile/[id]", params: { id: host._id } })}
                  >
                    <Image source={{ uri: host.avatar }} style={styles.hostRowAvatar} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.hostRowName}>{host.name}</Text>
                      <Text style={styles.hostRowMeta}>
                        {host.city} • {host.followersCount} followers
                      </Text>
                    </View>
                    <View style={styles.vibeScoreBox}>
                      <Flame color={colors.gold} size={16} fill={colors.gold} />
                      <Text style={styles.vibeScoreText}>Top Host</Text>
                    </View>
                  </Pressable>
                ))}
              </Section>
            )}

            {/* Empty states fallback */}
            {rooms.length === 0 && candidates.length === 0 && (
              <View style={styles.emptyState}>
                <Users color={colors.muted} size={48} />
                <Text style={styles.emptyTitle}>No vibe matches right now</Text>
                <Text style={styles.emptySubtitle}>Update your interests in your profile setup to fetch matching users.</Text>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: 96 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 8 },
  greeting: { color: colors.muted, marginTop: 4, fontSize: 14, fontWeight: "700" },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  notificationsBtn: {
    height: 46,
    width: 46,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  createBtn: {
    height: 46,
    width: 46,
    borderRadius: 12,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center"
  },
  searchBar: {
    marginTop: 18,
    height: 50,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    gap: 10
  },
  searchInput: { flex: 1, color: colors.text, fontWeight: "700" },
  quickGrid: { flexDirection: "row", gap: 12, marginTop: 18 },
  quickCard: { flex: 1, minHeight: 104, borderRadius: 16, overflow: "hidden" },
  quickGradient: { flex: 1, padding: 14, justifyContent: "flex-end", gap: 2 },
  quickTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  quickSubtitle: { color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: "700" },
  roomsFilterRow: { flexDirection: "row", justifyContent: "space-around", marginTop: 18, marginBottom: 8 },
  filterCircleBtn: { alignItems: "center", gap: 6 },
  filterIconCircle: { width: 52, height: 52, borderRadius: 26, alignItems: "center", justifyContent: "center" },
  filterText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  chipsRow: { marginTop: 16, marginHorizontal: -4 },
  chip: { backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginRight: 8 },
  chipActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  chipText: { color: colors.text, fontWeight: "800", fontSize: 13 },
  chipTextActive: { color: colors.text },
  loadingWrap: { padding: 48, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.muted, fontSize: 14, fontWeight: "700" },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 12 },
  vibeBadge: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(246,180,75,0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  vibeBadgeText: { color: colors.gold, fontSize: 11, fontWeight: "900" },
  livePulseRow: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(255,62,147,0.15)", paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 },
  liveDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.pink },
  liveText: { color: colors.pink, fontSize: 11, fontWeight: "900" },
  featuredCard: { height: 320, borderRadius: 18, overflow: "hidden", borderWidth: 1, borderColor: colors.line, position: "relative" },
  featuredImg: { width: "100%", height: "100%" },
  featuredOverlay: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "flex-end" },
  featuredDetails: { padding: 18 },
  featuredHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  featuredName: { color: colors.text, fontSize: 24, fontWeight: "900" },
  compatibilityBadge: { backgroundColor: "rgba(255,62,147,0.22)", borderWidth: 1, borderColor: colors.pink, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  compatibilityText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  featuredTagline: { color: colors.text, fontSize: 14, fontStyle: "italic", marginVertical: 8, fontWeight: "700" },
  tagsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 8 },
  tag: { backgroundColor: "rgba(255,255,255,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  tagText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  featuredActions: { marginTop: 12 },
  swipeVibesBtn: { height: 50, borderRadius: 12, overflow: "hidden" },
  swipeGradient: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  swipeText: { color: colors.text, fontWeight: "900", fontSize: 15 },
  horizontalScroll: { paddingVertical: 4 },
  candidateBubbleCard: { width: 90, alignItems: "center", gap: 4, marginRight: 14 },
  bubbleImg: { width: 68, height: 68, borderRadius: 34, borderWidth: 2, borderColor: colors.pink },
  bubbleName: { color: colors.text, fontWeight: "800", fontSize: 13, marginTop: 4 },
  bubbleVibeScore: { color: colors.pink, fontSize: 11, fontWeight: "800" },
  feedSection: { marginBottom: 20 },
  feedSectionHeader: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10 },
  feedLiveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink },
  feedSectionTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 10 },
  feedItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.line },
  feedAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.panelStrong },
  feedItemContent: { flex: 1 },
  feedItemTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  feedItemMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  feedLiveTag: { backgroundColor: colors.pink, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
  feedLiveTagText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  feedStoryCard: { alignItems: "center", gap: 4, marginRight: 14, width: 64 },
  feedStoryAvatar: { width: 56, height: 56, borderRadius: 28, borderWidth: 2, borderColor: colors.pink },
  feedStoryName: { color: colors.text, fontSize: 11, fontWeight: "800", textAlign: "center" },
  activityItem: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line },
  activityText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  activityUserName: { fontWeight: "900" },
  activityRoom: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  hostRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.line },
  hostRowAvatar: { height: 50, width: 50, borderRadius: 12 },
  hostRowName: { color: colors.text, fontWeight: "900", fontSize: 15 },
  hostRowMeta: { color: colors.muted, fontSize: 12, marginTop: 2, fontWeight: "700" },
  vibeScoreBox: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "rgba(246,180,75,0.1)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  vibeScoreText: { color: colors.gold, fontWeight: "900", fontSize: 11 },
  emptyState: { padding: 40, alignItems: "center", gap: 8 },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 8 },
  emptySubtitle: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 18 }
});
