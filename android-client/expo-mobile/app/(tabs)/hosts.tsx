import { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, UserCheck, UserPlus, Users } from "lucide-react-native";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Screen, Section } from "@/components/Screen";
import { usersApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function Hosts() {
  const [search, setSearch] = useState("");
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();
  const meId = currentUser?._id ?? currentUser?.id ?? "";
  const trimmedSearch = search.trim();

  const followingQuery = useQuery({
    queryKey: ["user", meId, "following"],
    queryFn: () => usersApi.getFollowing(meId),
    enabled: !!meId,
    staleTime: 30000,
    gcTime: 60000
  });

  const suggestedQuery = useQuery({
    queryKey: ["hosts", "suggested"],
    queryFn: () => usersApi.suggestedHosts(),
    enabled: !!meId && trimmedSearch.length === 0,
    staleTime: 30000,
    gcTime: 60000
  });

  const searchQuery = useQuery({
    queryKey: ["users", "search", trimmedSearch],
    queryFn: () => usersApi.search(trimmedSearch),
    enabled: trimmedSearch.length >= 2,
    staleTime: 15000,
    gcTime: 60000
  });

  const refresh = () => {
    followingQuery.refetch();
    suggestedQuery.refetch();
    if (trimmedSearch.length >= 2) searchQuery.refetch();
  };

  const follow = useMutation({
    mutationFn: (userId: string) => usersApi.follow(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", meId, "following"] });
      queryClient.invalidateQueries({ queryKey: ["hosts", "suggested"] });
      queryClient.invalidateQueries({ queryKey: ["users", "search"] });
    },
    onError: (err: any) => console.error(err)
  });

  const unfollow = useMutation({
    mutationFn: (userId: string) => usersApi.unfollow(userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["user", meId, "following"] });
      queryClient.invalidateQueries({ queryKey: ["hosts", "suggested"] });
      queryClient.invalidateQueries({ queryKey: ["users", "search"] });
    },
    onError: (err: any) => console.error(err)
  });

  const following = followingQuery.data?.users ?? [];
  const suggested = suggestedQuery.data?.users ?? [];
  const searchResults = searchQuery.data?.users ?? [];
  const followingIds = useMemo(() => new Set(following.map((u: any) => u._id)), [following]);

  const people = useMemo(() => {
    if (trimmedSearch.length >= 2) return searchResults.filter((u: any) => u._id !== meId);
    if (following.length > 0) return following;
    return suggested;
  }, [following, meId, searchResults, suggested, trimmedSearch]);

  const title = trimmedSearch.length >= 2 ? "People" : following.length > 0 ? "Following" : "Suggested hosts";
  const isLoading = followingQuery.isLoading || suggestedQuery.isLoading || searchQuery.isLoading;
  const error = followingQuery.error || suggestedQuery.error || searchQuery.error;

  return (
    <Screen>
      <Section>
        <Text style={styles.title}>Hosts</Text>
        <View style={styles.inputRow}>
          <Search color={colors.muted} size={18} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search people, hosts, cities"
            placeholderTextColor={colors.muted}
            style={styles.input}
            autoCapitalize="none"
          />
        </View>
      </Section>
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as any)?.message} onRetry={refresh} />
      ) : (
        <FlatList
          data={people}
          keyExtractor={(item: any) => item._id}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refresh} tintColor={colors.gold} />}
          contentContainerStyle={styles.list}
          ListHeaderComponent={<Text style={styles.sectionTitle}>{title}</Text>}
          ListEmptyComponent={
            <EmptyState
              icon={<Users color={colors.gold} size={28} />}
              message={trimmedSearch.length === 1 ? "Type at least 2 characters to search" : trimmedSearch ? "No people match your search" : "No host suggestions yet"}
            />
          }
          renderItem={({ item }: { item: any }) => {
            const followed = Boolean(item.isFollowing) || followingIds.has(item._id);
            const pending = follow.isPending || unfollow.isPending;
            return (
              <Pressable style={styles.row} onPress={() => router.push({ pathname: "/(tabs)/profile", params: { userId: item._id } })}>
                <View style={styles.avatar}><Text style={styles.avatarText}>{item.name?.[0] ?? ""}</Text></View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.name}>{item.name}</Text>
                  <Text style={styles.meta}>@{item.username}{item.city ? ` / ${item.city}` : ""}</Text>
                </View>
                <Pressable
                  style={[styles.followBtn, followed && styles.followingBtn]}
                  disabled={pending || item._id === meId}
                  onPress={() => (followed ? unfollow.mutate(item._id) : follow.mutate(item._id))}
                >
                  {followed ? <UserCheck color={colors.ink} size={16} /> : <UserPlus color={colors.text} size={16} />}
                  <Text style={[styles.followText, followed && styles.followingText]}>
                    {pending ? "..." : followed ? "Following" : "Follow"}
                  </Text>
                </Pressable>
              </Pressable>
            );
          }}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginVertical: 18 },
  inputRow: { height: 50, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10, marginBottom: 8 },
  input: { flex: 1, color: colors.text },
  list: { paddingHorizontal: 20, paddingBottom: 40 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line },
  avatar: { width: 44, height: 44, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.gold, fontWeight: "900", fontSize: 18 },
  name: { color: colors.text, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  followBtn: { height: 36, paddingHorizontal: 14, borderRadius: 8, backgroundColor: colors.purple, flexDirection: "row", alignItems: "center", gap: 6 },
  followingBtn: { backgroundColor: colors.gold },
  followText: { color: colors.text, fontWeight: "900", fontSize: 12 },
  followingText: { color: colors.ink }
});
