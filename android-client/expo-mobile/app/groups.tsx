import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { MessageSquare, Users, Plus } from "lucide-react-native";
import { groupsApi } from "@/lib/api";
import { Screen, Section } from "@/components/Screen";
import { colors } from "@/theme/colors";

export default function GroupList() {
  const groupsQuery = useQuery({
    queryKey: ["groups"],
    queryFn: groupsApi.list,
    staleTime: 10000,
    gcTime: 30000
  });

  useFocusEffect(
    useCallback(() => {
      groupsQuery.refetch();
    }, [])
  );

  const groups = groupsQuery.data?.groups ?? [];
  const isLoading = groupsQuery.isLoading;

  return (
    <Screen>
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Group Chats</Text>
          <Text style={styles.headerSubtitle}>Chat with multiple people at once</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollWrap}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={() => groupsQuery.refetch()} tintColor={colors.pink} />}
        >
          <Section>
            {isLoading && groups.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.pink} size="large" />
              </View>
            ) : groups.length === 0 ? (
              <View style={styles.emptyState}>
                <MessageSquare color={colors.muted} size={48} />
                <Text style={styles.emptyTitle}>No group chats</Text>
                <Text style={styles.emptySubtitle}>
                  Create a group to chat with multiple friends at once.
                </Text>
                <Pressable onPress={() => router.push("/group/create")} style={styles.createBtn}>
                  <Text style={styles.createBtnText}>Create Group</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.groupsList}>
                {groups.map((g: any) => (
                  <Pressable
                    key={g._id}
                    style={styles.groupRow}
                    onPress={() => router.push({ pathname: "/group/[id]", params: { id: g._id } })}
                  >
                    <View style={styles.groupAvatar}>
                      <Users color={colors.text} size={22} />
                    </View>
                    <View style={styles.groupInfo}>
                      <View style={styles.groupHeaderRow}>
                        <Text style={styles.groupName}>{g.name}</Text>
                        {g.lastMessageAt && (
                          <Text style={styles.groupTime}>
                            {new Date(g.lastMessageAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        )}
                      </View>
                      <View style={styles.groupBodyRow}>
                        <Text style={styles.groupLastMessage} numberOfLines={1}>
                          {g.lastMessage || "No messages yet"}
                        </Text>
                        <View style={styles.participantBadge}>
                          <Users color={colors.muted} size={10} />
                          <Text style={styles.participantBadgeText}>{g.participantIds?.length ?? 0}</Text>
                        </View>
                      </View>
                    </View>
                  </Pressable>
                ))}
              </View>
            )}
          </Section>
        </ScrollView>

        <Pressable style={styles.fab} onPress={() => router.push("/group/create")}>
          <Plus color={colors.text} size={24} />
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    minHeight: 66,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  headerSubtitle: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  scrollWrap: { paddingTop: 14, paddingBottom: 80 },
  center: { padding: 48, alignItems: "center" },
  emptyState: { padding: 40, alignItems: "center", gap: 8, marginTop: 20 },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 8 },
  emptySubtitle: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 10 },
  createBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.pink
  },
  createBtnText: { color: colors.text, fontWeight: "900", fontSize: 14 },
  groupsList: { gap: 4 },
  groupRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  groupAvatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: "center",
    justifyContent: "center"
  },
  groupInfo: { flex: 1, justifyContent: "center" },
  groupHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  groupName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  groupTime: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  groupBodyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  groupLastMessage: { color: colors.muted, fontSize: 13, flex: 1, marginRight: 10, fontWeight: "700" },
  participantBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.panel,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2
  },
  participantBadgeText: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  fab: {
    position: "absolute",
    bottom: 24,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4
  }
});
