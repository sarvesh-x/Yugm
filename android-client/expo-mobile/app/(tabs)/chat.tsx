import { useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable, Image, ActivityIndicator } from "react-native";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageSquare, Heart, Compass } from "lucide-react-native";
import { datingApi, usersApi } from "@/lib/api";
import { Screen, Section } from "@/components/Screen";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function ChatList() {
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?._id || currentUser?.id || "";
  const queryClient = useQueryClient();

  // Queries
  const matchesQuery = useQuery({
    queryKey: ["dating", "matches"],
    queryFn: datingApi.matches,
    staleTime: 10000,
    gcTime: 30000
  });

  const messagesQuery = useQuery({
    queryKey: ["users", "messages"],
    queryFn: usersApi.messages,
    staleTime: 10000,
    gcTime: 30000
  });

  const handleRefetch = () => {
    matchesQuery.refetch();
    messagesQuery.refetch();
  };

  useFocusEffect(
    useCallback(() => {
      handleRefetch();
    }, [])
  );

  const isLoading = matchesQuery.isLoading || messagesQuery.isLoading;

  const matches = matchesQuery.data?.matches ?? [];
  const rawMessages = messagesQuery.data?.messages ?? [];

  // Group messages by conversation partner
  const conversationsMap = new Map<string, any>();
  rawMessages.forEach((msg: any) => {
    const isSenderMe = msg.senderId?._id === currentUserId || msg.senderId?.id === currentUserId;
    const partner = isSenderMe ? msg.receiverId : msg.senderId;
    if (!partner) return;
    const partnerId = partner._id || partner.id;

    if (!conversationsMap.has(partnerId)) {
      conversationsMap.set(partnerId, {
        partner,
        latestMessage: msg.message,
        timestamp: msg.createdAt,
        unread: !isSenderMe && !msg.read
      });
    }
  });

  const activeConversations = Array.from(conversationsMap.values());
  activeConversations.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  // Filter "New Matches" who do NOT have an active conversation
  const newMatches = matches.filter((match: any) => {
    const partnerId = match.partner?._id || match.partner?.id;
    return partnerId && !conversationsMap.has(partnerId);
  });

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Conversations</Text>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollWrap}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefetch} tintColor={colors.pink} />}
        >
          {/* New Matches Rail */}
          {newMatches.length > 0 && (
            <Section>
              <Text style={styles.sectionTitle}>New Matches</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.matchesRail}>
                {newMatches.map((match: any) => (
                  <Pressable
                    key={match.id}
                    style={styles.matchBubble}
                    onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: match.partner._id } })}
                  >
                    <View style={styles.avatarBorder}>
                      <Image source={{ uri: match.partner.avatar }} style={styles.matchAvatar as any} />
                    </View>
                    <Text style={styles.matchName} numberOfLines={1}>
                      {match.partner.name.split(" ")[0]}
                    </Text>
                  </Pressable>
                ))}
              </ScrollView>
            </Section>
          )}

          {/* Active Conversations List */}
          <Section>
            <Text style={styles.sectionTitle}>Recent Chats</Text>

            {isLoading && activeConversations.length === 0 ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.pink} size="large" />
              </View>
            ) : activeConversations.length === 0 ? (
              <View style={styles.emptyState}>
                <MessageSquare color={colors.muted} size={48} />
                <Text style={styles.emptyTitle}>No messages yet</Text>
                <Text style={styles.emptySubtitle}>
                  Select a match from the explore tab and start a connection tonight!
                </Text>
                <Pressable onPress={() => router.push("/(tabs)/match")} style={styles.exploreBtn}>
                  <Text style={styles.exploreBtnText}>Start Matching</Text>
                </Pressable>
              </View>
            ) : (
              <View style={styles.conversationsList}>
                {activeConversations.map((chat: any) => {
                  const partnerId = chat.partner._id || chat.partner.id;
                  return (
                    <Pressable
                      key={partnerId}
                      style={styles.chatRow}
                      onPress={() => router.push({ pathname: "/chat/[userId]", params: { userId: partnerId } })}
                    >
                      <Image source={{ uri: chat.partner.avatar }} style={styles.chatAvatar as any} />
                      
                      <View style={styles.chatInfo}>
                        <View style={styles.chatHeaderRow}>
                          <Text style={styles.chatPartnerName}>{chat.partner.name}</Text>
                          <Text style={styles.chatTime}>
                            {new Date(chat.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </Text>
                        </View>
                        
                        <View style={styles.chatBodyRow}>
                          <Text style={[styles.chatPreview, chat.unread && styles.unreadText]} numberOfLines={1}>
                            {chat.latestMessage}
                          </Text>
                          {chat.unread && <View style={styles.unreadBadge} />}
                        </View>
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Section>
        </ScrollView>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    paddingHorizontal: 20,
    height: 52,
    justifyContent: "center",
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  scrollWrap: { paddingTop: 14, paddingBottom: 48 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "900", marginBottom: 12 },
  matchesRail: { paddingVertical: 4 },
  matchBubble: { width: 78, alignItems: "center", gap: 4, marginRight: 12 },
  avatarBorder: {
    width: 66,
    height: 66,
    borderRadius: 33,
    borderWidth: 2,
    borderColor: colors.pink,
    padding: 2
  },
  matchAvatar: { width: "100%", height: "100%", borderRadius: 30 },
  matchName: { color: colors.text, fontSize: 13, fontWeight: "800", marginTop: 4 },
  center: { padding: 48, alignItems: "center" },
  emptyState: { padding: 40, alignItems: "center", gap: 8, marginTop: 20 },
  emptyTitle: { color: colors.text, fontWeight: "900", fontSize: 16, marginTop: 8 },
  emptySubtitle: { color: colors.muted, fontSize: 13, textAlign: "center", lineHeight: 18, marginBottom: 10 },
  exploreBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.pink
  },
  exploreBtnText: { color: colors.text, fontWeight: "900", fontSize: 14 },
  conversationsList: { gap: 4 },
  chatRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  chatAvatar: { width: 54, height: 54, borderRadius: 27 },
  chatInfo: { flex: 1, justifyContent: "center" },
  chatHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  chatPartnerName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  chatTime: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  chatBodyRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 4 },
  chatPreview: { color: colors.muted, fontSize: 13, flex: 1, marginRight: 10, fontWeight: "700" },
  unreadText: { color: colors.text, fontWeight: "900" },
  unreadBadge: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.pink }
});
