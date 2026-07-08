import { useEffect, useState } from "react";
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, MessageCircle, Search, Send, Shield, Users } from "lucide-react-native";
import { GlassCard } from "@/components/GlassCard";
import { Screen, Section } from "@/components/Screen";
import { clansApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

const clanReactionTypes = ["heart", "fire", "laugh", "clap", "wow"] as const;
const clanReactionLabels: Record<string, string> = { heart: "HEART", fire: "FIRE", laugh: "LAUGH", clap: "CLAP", wow: "WOW" };

export default function ClanScreen() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?._id || currentUser?.id || "";
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [clanMessage, setClanMessage] = useState("");
  const [clanTypingUser, setClanTypingUser] = useState("");

  const mine = useQuery({ queryKey: ["clans", "me"], queryFn: clansApi.mine, staleTime: 30000, gcTime: 60000 });
  const clans = useQuery({
    queryKey: ["clans", "list", search],
    queryFn: () => clansApi.list(search),
    staleTime: 30000,
    gcTime: 60000
  });

  const myClan = mine.data?.clan;

  const clanMessages = useQuery({
    queryKey: ["clans", myClan?._id, "messages"],
    queryFn: () => clansApi.messages(myClan._id),
    enabled: !!myClan?._id,
    refetchInterval: 3000,
    staleTime: 5000,
    gcTime: 60000
  });

  useEffect(() => {
    if (!myClan?._id) return;
    const socket = getSocket();
    socket.connect();
    const handleClanMessage = (payload: any) => {
      if (payload?.clanId === myClan._id) clanMessages.refetch();
    };
    const handleTyping = (payload: any) => {
      if (payload?.clanId !== myClan._id || payload?.userId === currentUserId) return;
      setClanTypingUser(payload.typing ? "Someone is typing..." : "");
    };
    socket.on("clan:message:new", handleClanMessage);
    socket.on("clan:typing:update", handleTyping);
    return () => {
      socket.off("clan:message:new", handleClanMessage);
      socket.off("clan:typing:update", handleTyping);
      socket.emit("clan:typing:stop", { clanId: myClan._id });
    };
  }, [myClan?._id, clanMessages.refetch, currentUserId]);

  const refresh = () => {
    mine.refetch();
    clans.refetch();
    clanMessages.refetch();
  };

  const createClan = useMutation({
    mutationFn: () => clansApi.create({ name: name.trim(), description: description.trim(), familyLabel: "Family" }),
    onSuccess: () => {
      setName("");
      setDescription("");
      queryClient.invalidateQueries({ queryKey: ["clans"] });
      Alert.alert("Family created", "Your clan is ready.");
    },
    onError: (err: any) => Alert.alert("Could not create clan", err?.message ?? "Please try again.")
  });

  const joinClan = useMutation({
    mutationFn: (clanId: string) => clansApi.join(clanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clans"] });
      Alert.alert("Joined", "You are now part of this family.");
    },
    onError: (err: any) => Alert.alert("Could not join", err?.message ?? "Please try again.")
  });

  const leaveClan = useMutation({
    mutationFn: (clanId: string) => clansApi.leave(clanId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["clans"] });
      Alert.alert("Left clan", "You have left this family.");
    },
    onError: (err: any) => Alert.alert("Could not leave", err?.message ?? "Please try again.")
  });

  const sendClanMessage = useMutation({
    mutationFn: () => clansApi.sendMessage(myClan._id, clanMessage.trim()),
    onSuccess: () => {
      getSocket().emit("clan:typing:stop", { clanId: myClan._id });
      setClanMessage("");
      clanMessages.refetch();
    },
    onError: (err: any) => Alert.alert("Message failed", err?.message ?? "Please try again.")
  });

  const reactClanMessage = useMutation({
    mutationFn: ({ messageId, type }: { messageId: string; type: typeof clanReactionTypes[number] }) => clansApi.reactToMessage(myClan._id, messageId, type),
    onSuccess: () => clanMessages.refetch(),
    onError: (err: any) => Alert.alert("Reaction failed", err?.message ?? "Please try again.")
  });

  const deleteClanMessage = useMutation({
    mutationFn: (messageId: string) => clansApi.deleteMessage(myClan._id, messageId),
    onSuccess: () => clanMessages.refetch(),
    onError: (err: any) => Alert.alert("Delete failed", err?.message ?? "Please try again.")
  });

  const reportClanMessage = useMutation({
    mutationFn: (messageId: string) => clansApi.reportMessage(myClan._id, messageId, "Clan message report", "Reported from family chat"),
    onSuccess: () => Alert.alert("Reported", "Thanks. The moderation team can review this message."),
    onError: (err: any) => Alert.alert("Report failed", err?.message ?? "Please try again.")
  });

  const handleClanMessageChange = (text: string) => {
    setClanMessage(text);
    if (!myClan?._id) return;
    const socket = getSocket();
    if (text.trim()) socket.emit("clan:typing:start", { clanId: myClan._id });
    setTimeout(() => socket.emit("clan:typing:stop", { clanId: myClan._id }), 1200);
  };

  const busy = createClan.isPending || joinClan.isPending || leaveClan.isPending;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollWrap}
        refreshControl={<RefreshControl refreshing={mine.isLoading || clans.isLoading} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <Section>
          <Text style={styles.title}>Clan & Family</Text>
          <Text style={styles.subtitle}>Build a close circle, discover active families, and keep your people together.</Text>
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>My Family</Text>
          {mine.isLoading ? (
            <ActivityIndicator color={colors.gold} />
          ) : myClan ? (
            <GlassCard style={styles.myClanCard}>
              <View style={styles.clanHeader}>
                {myClan.avatar ? <Image source={{ uri: myClan.avatar }} style={styles.clanAvatar as any} /> : <View style={styles.clanFallback}><Users color={colors.gold} /></View>}
                <View style={styles.clanInfo}>
                  <Text style={styles.clanName}>{myClan.name}</Text>
                  <Text style={styles.clanMeta}>{myClan.memberCount} members / {myClan.privacy.toLowerCase()}</Text>
                </View>
                {myClan.isOwner && <Crown color={colors.gold} size={20} />}
              </View>
              {!!myClan.description && <Text style={styles.clanDescription}>{myClan.description}</Text>}
              <View style={styles.memberPreview}>
                {(myClan.members ?? []).slice(0, 6).map((member: any) => (
                  <View key={member._id ?? member.id} style={styles.memberChip}>
                    <Text style={styles.memberName}>{member.name ?? "Member"}</Text>
                  </View>
                ))}
              </View>
              <Pressable style={[styles.secondaryButton, busy && styles.disabled]} onPress={() => leaveClan.mutate(myClan._id)} disabled={busy}>
                <Text style={styles.secondaryButtonText}>{leaveClan.isPending ? "Leaving..." : "Leave family"}</Text>
              </Pressable>
              <View style={styles.chatPanel}>
                <View style={styles.chatHeader}>
                  <MessageCircle color={colors.gold} size={18} />
                  <Text style={styles.chatTitle}>Family Chat</Text>
                </View>
                {clanMessages.isLoading ? (
                  <ActivityIndicator color={colors.gold} />
                ) : !(clanMessages.data?.messages ?? []).length ? (
                  <Text style={styles.emptyText}>No messages yet. Start the family vibe.</Text>
                ) : (
                  <View style={styles.messageList}>
                    {(clanMessages.data?.messages ?? []).slice(-12).map((message: any) => (
                      <View key={message._id} style={styles.messageCard}>
                        <Text style={styles.messageAuthor}>{message.senderId?.name ?? "Member"}</Text>
                        <Text style={styles.messageText}>{message.message}</Text>
                        {!!message.reactions?.length && (
                          <View style={styles.reactionSummary}>
                            {countClanReactions(message.reactions).map((reaction) => (
                              <Text key={reaction.type} style={styles.reactionText}>{clanReactionLabels[reaction.type] ?? reaction.type} {reaction.count}</Text>
                            ))}
                          </View>
                        )}
                        <View style={styles.reactionRow}>
                          {clanReactionTypes.map((type) => (
                            <Pressable key={type} style={styles.reactionBtn} onPress={() => reactClanMessage.mutate({ messageId: message._id, type })}>
                              <Text style={styles.reactionBtnText}>{clanReactionLabels[type]}</Text>
                            </Pressable>
                          ))}
                        </View>
                        <View style={styles.messageActions}>
                          {(message.senderId?._id === currentUserId || message.senderId?.id === currentUserId || myClan.isOwner) && (
                            <Pressable onPress={() => deleteClanMessage.mutate(message._id)}>
                              <Text style={styles.deleteText}>Delete</Text>
                            </Pressable>
                          )}
                          {message.senderId?._id !== currentUserId && message.senderId?.id !== currentUserId && (
                            <Pressable onPress={() => reportClanMessage.mutate(message._id)}>
                              <Text style={styles.reportText}>Report</Text>
                            </Pressable>
                          )}
                        </View>
                      </View>
                    ))}
                  </View>
                )}
                {!!clanTypingUser && <Text style={styles.typingText}>{clanTypingUser}</Text>}
                <View style={styles.composer}>
                  <TextInput
                    value={clanMessage}
                    onChangeText={handleClanMessageChange}
                    placeholder="Message your family"
                    placeholderTextColor={colors.muted}
                    style={styles.composerInput}
                  />
                  <Pressable
                    style={[styles.sendBtn, (!clanMessage.trim() || sendClanMessage.isPending) && styles.disabled]}
                    onPress={() => sendClanMessage.mutate()}
                    disabled={!clanMessage.trim() || sendClanMessage.isPending}
                  >
                    <Send color={colors.text} size={16} />
                  </Pressable>
                </View>
              </View>
            </GlassCard>
          ) : (
            <GlassCard style={styles.formCard}>
              <Text style={styles.formTitle}>Create your family</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Family name"
                placeholderTextColor={colors.muted}
                style={styles.input}
              />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="What brings everyone together?"
                placeholderTextColor={colors.muted}
                style={[styles.input, styles.textArea]}
                multiline
              />
              <Pressable
                style={[styles.primaryButton, (!name.trim() || createClan.isPending) && styles.disabled]}
                onPress={() => createClan.mutate()}
                disabled={!name.trim() || createClan.isPending}
              >
                <Text style={styles.primaryButtonText}>{createClan.isPending ? "Creating..." : "Create family"}</Text>
              </Pressable>
            </GlassCard>
          )}
        </Section>

        <Section>
          <View style={styles.searchBox}>
            <Search color={colors.muted} size={18} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search families"
              placeholderTextColor={colors.muted}
              style={styles.searchInput}
            />
          </View>
          <Text style={styles.sectionTitle}>Discover Families</Text>
          {clans.isLoading ? (
            <ActivityIndicator color={colors.gold} />
          ) : !(clans.data?.clans ?? []).length ? (
            <Text style={styles.emptyText}>No public families found yet.</Text>
          ) : (
            (clans.data?.clans ?? []).map((clan: any) => (
              <GlassCard key={clan._id} style={styles.clanCard}>
                <View style={styles.clanHeader}>
                  <View style={styles.clanFallbackSmall}><Shield color={colors.pink} size={18} /></View>
                  <View style={styles.clanInfo}>
                    <Text style={styles.clanName}>{clan.name}</Text>
                    <Text style={styles.clanMeta}>{clan.memberCount} members / @{clan.slug}</Text>
                  </View>
                </View>
                {!!clan.description && <Text style={styles.clanDescription}>{clan.description}</Text>}
                <Pressable
                  style={[styles.primaryButton, (busy || clan.isMember || !!myClan) && styles.disabled]}
                  onPress={() => joinClan.mutate(clan._id)}
                  disabled={busy || clan.isMember || !!myClan}
                >
                  <Text style={styles.primaryButtonText}>{clan.isMember ? "Joined" : myClan ? "Leave current family first" : "Join family"}</Text>
                </Pressable>
              </GlassCard>
            ))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

function countClanReactions(reactions: any[]) {
  const counts = new Map<string, number>();
  reactions.forEach((reaction) => counts.set(reaction.type, (counts.get(reaction.type) ?? 0) + 1));
  return Array.from(counts.entries()).map(([type, count]) => ({ type, count }));
}

const styles = StyleSheet.create({
  scrollWrap: { paddingBottom: 48 },
  title: { color: colors.text, fontSize: 28, fontWeight: "900" },
  subtitle: { color: colors.muted, marginTop: 8, lineHeight: 20, fontWeight: "700" },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 12 },
  myClanCard: { gap: 14 },
  formCard: { gap: 12 },
  formTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  clanHeader: { flexDirection: "row", alignItems: "center", gap: 12 },
  clanAvatar: { width: 54, height: 54, borderRadius: 8 },
  clanFallback: { width: 54, height: 54, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(246,180,75,0.12)", borderWidth: 1, borderColor: "rgba(246,180,75,0.3)" },
  clanFallbackSmall: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: "rgba(255,62,147,0.12)" },
  clanInfo: { flex: 1 },
  clanName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  clanMeta: { color: colors.muted, marginTop: 3, fontSize: 12, fontWeight: "800" },
  clanDescription: { color: colors.muted, lineHeight: 20, fontWeight: "700" },
  memberPreview: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memberChip: { borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  memberName: { color: colors.text, fontSize: 12, fontWeight: "800" },
  input: { minHeight: 46, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 12, fontWeight: "800" },
  textArea: { minHeight: 88, textAlignVertical: "top", paddingTop: 12 },
  primaryButton: { height: 44, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.pink },
  primaryButtonText: { color: colors.text, fontWeight: "900" },
  secondaryButton: { height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  secondaryButtonText: { color: colors.text, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  searchBox: { height: 46, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16 },
  searchInput: { flex: 1, color: colors.text, fontWeight: "800" },
  emptyText: { color: colors.muted, fontWeight: "800" },
  clanCard: { marginBottom: 12, gap: 12 },
  chatPanel: { gap: 10, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 14 },
  chatHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  chatTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  messageList: { gap: 10 },
  messageCard: { borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 10 },
  messageAuthor: { color: colors.gold, fontSize: 12, fontWeight: "900" },
  messageText: { color: colors.text, fontSize: 14, fontWeight: "800", marginTop: 4, lineHeight: 20 },
  reactionSummary: { flexDirection: "row", flexWrap: "wrap", gap: 5, marginTop: 8 },
  reactionText: { color: colors.gold, fontSize: 10, fontWeight: "900", borderRadius: 8, overflow: "hidden", backgroundColor: "rgba(246,180,75,0.1)", paddingHorizontal: 6, paddingVertical: 3 },
  reactionRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  reactionBtn: { borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line, paddingHorizontal: 7, paddingVertical: 5 },
  reactionBtnText: { color: colors.text, fontSize: 10, fontWeight: "900" },
  messageActions: { flexDirection: "row", gap: 14, marginTop: 8 },
  deleteText: { color: colors.danger, fontSize: 11, fontWeight: "900" },
  reportText: { color: colors.muted, fontSize: 11, fontWeight: "900" },
  typingText: { color: colors.cyan, fontSize: 12, fontWeight: "900" },
  composer: { flexDirection: "row", alignItems: "center", gap: 8 },
  composerInput: { flex: 1, minHeight: 42, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 12, fontWeight: "800" },
  sendBtn: { width: 42, height: 42, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.pink }
});
