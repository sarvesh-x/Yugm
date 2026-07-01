import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { Search, Users, Radio } from "lucide-react-native";
import { Screen, Section } from "@/components/Screen";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { roomsApi } from "@/lib/api";
import { colors } from "@/theme/colors";

export default function SearchScreen() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ rooms: any[]; users: any[] }>({ rooms: [], users: [] });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout>>();

  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setResults({ rooms: [], users: [] }); setLoading(false); return; }
    setLoading(true);
    setError("");
    try {
      const [roomRes, userRes] = await Promise.all([
        roomsApi.searchRooms(q.trim()),
        roomsApi.searchUsers(q.trim())
      ]);
      setResults({ rooms: roomRes?.rooms ?? [], users: userRes?.users ?? [] });
    } catch (err: any) {
      setError(err?.message ?? "Search failed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    clearTimeout(timer.current);
    if (!query.trim()) { setResults({ rooms: [], users: [] }); setLoading(false); return; }
    setLoading(true);
    timer.current = setTimeout(() => doSearch(query), 400);
    return () => clearTimeout(timer.current);
  }, [query, doSearch]);

  const hasResults = results.rooms.length > 0 || results.users.length > 0;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <Section>
          <Text style={styles.title}>Search</Text>
          <View style={styles.inputRow}>
            <Search color={colors.muted} size={18} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Rooms, hosts, interests"
              placeholderTextColor={colors.muted}
              style={styles.input}
              keyboardType="default"
              autoCapitalize="none"
            />
          </View>
        </Section>
        {loading ? (
          <LoadingState message="Searching..." />
        ) : error ? (
          <ErrorState message={error} onRetry={() => doSearch(query)} />
        ) : query.trim() && !hasResults ? (
          <EmptyState icon={<Search color={colors.gold} size={32} />} message={`No results found for "${query}"`} />
        ) : (
          <FlatList
            data={results.rooms}
            keyExtractor={(item) => item._id}
            ListHeaderComponent={
              results.users.length > 0 ? (
                <Section>
                  <Text style={styles.sectionTitle}>People</Text>
                  {results.users.map((user: any) => (
                    <Pressable key={user._id} style={styles.userRow} onPress={() => router.push({ pathname: "/(tabs)/profile", params: { userId: user._id } })}>
                      <View style={styles.avatar}><Text style={styles.avatarText}>{user.name?.[0] ?? ""}</Text></View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.userName}>{user.name}</Text>
                        <Text style={styles.userMeta}>@{user.username}</Text>
                      </View>
                    </Pressable>
                  ))}
                </Section>
              ) : null
            }
            ListFooterComponent={
              results.rooms.length > 0 ? (
                <Section>
                  <Text style={styles.sectionTitle}>Rooms</Text>
                  {results.rooms.map((room: any) => (
                    <Pressable key={room._id} style={styles.roomRow} onPress={() => router.push({ pathname: "/room/[id]", params: { id: room._id, type: room.type } })}>
                      <View style={styles.iconWrap}>{room.type === "VOICE" ? <Radio color={colors.gold} size={18} /> : <Users color={colors.cyan} size={18} />}</View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.roomTitle}>{room.title}</Text>
                        <Text style={styles.roomMeta}>{room.hostId?.name} / {room.participantCount} listening</Text>
                      </View>
                    </Pressable>
                  ))}
                </Section>
              ) : null
            }
            renderItem={() => null}
            ListEmptyComponent={!query.trim() ? <EmptyState icon={<Search color={colors.gold} size={32} />} message="Search for rooms, hosts, or interests" /> : null}
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginVertical: 18 },
  inputRow: { height: 54, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, flexDirection: "row", alignItems: "center", paddingHorizontal: 14, gap: 10 },
  input: { flex: 1, color: colors.text },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 12 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderColor: colors.line },
  avatar: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  avatarText: { color: colors.gold, fontWeight: "900", fontSize: 16 },
  userName: { color: colors.text, fontWeight: "900" },
  userMeta: { color: colors.muted, fontSize: 12 },
  roomRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line },
  iconWrap: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  roomTitle: { color: colors.text, fontWeight: "900" },
  roomMeta: { color: colors.muted, fontSize: 12, marginTop: 2 }
});
