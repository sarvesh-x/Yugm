import { useState, useCallback, useRef } from "react";
import {
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
  Image,
  Pressable,
  ActivityIndicator
} from "react-native";
import { router, useLocalSearchParams, useFocusEffect } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Sparkles, AlertTriangle, ShieldOff, Gift, Info, Phone, Video } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { usersApi, walletApi } from "@/lib/api";
import { Screen } from "@/components/Screen";
import { GiftPanel } from "@/components/GiftPanel";
import { useAuthStore } from "@/store/auth";
import { colors, gradients } from "@/theme/colors";

export default function ChatRoom() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  if (!userId) return null;

  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?._id || currentUser?.id || "";

  const [message, setMessage] = useState("");
  const [giftPanelOpen, setGiftPanelOpen] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  // Queries
  const { data: partnerData, isLoading: loadingPartner } = useQuery({
    queryKey: ["users", userId],
    queryFn: () => usersApi.get(userId),
    enabled: !!userId
  });

  const { data: messagesData, isLoading: loadingMessages, refetch } = useQuery({
    queryKey: ["users", "conversation", userId],
    queryFn: () => usersApi.conversation(userId),
    enabled: !!userId,
    refetchInterval: 3000 // Poll every 3 seconds for new DMs
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [userId])
  );

  const partner = partnerData?.user;
  const messages = messagesData?.messages ?? [];
  const relationship = messagesData?.relationship;

  // Mutations
  const sendMutation = useMutation({
    mutationFn: (text: string) => usersApi.sendMessage(userId, text),
    onSuccess: () => {
      setMessage("");
      refetch();
      queryClient.invalidateQueries({ queryKey: ["dating", "matches"] });
      // Scroll to bottom
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const blockMutation = useMutation({
    mutationFn: () => usersApi.block(userId),
    onSuccess: () => {
      Alert.alert("Blocked", `${partner?.name} has been blocked.`);
      queryClient.invalidateQueries({ queryKey: ["dating", "explore"] });
      router.replace("/(tabs)/chat");
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const startCallMutation = useMutation({
    mutationFn: (type: "VOICE" | "VIDEO") => usersApi.startPrivateCall(userId, type),
    onSuccess: (res) => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["users", "messages"] });
      const roomId = res.room?._id || res.room?.id;
      if (roomId) {
        router.push({ pathname: "/room/[id]", params: { id: roomId, type: res.room.type } });
      }
    },
    onError: (err: any) => Alert.alert("Call failed", err.message || "Could not start private call")
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
  };

  const handleBlock = () => {
    Alert.alert("Block User", `Are you sure you want to block ${partner?.name}? You will no longer be matched.`, [
      { text: "Cancel", style: "cancel" },
      { text: "Block", style: "destructive", onPress: () => blockMutation.mutate() }
    ]);
  };

  const handleReport = () => {
    Alert.alert("Report Chat", "Report this user for harassment, safety risks, or guidelines violations?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: () => Alert.alert("Report Submitted", "Thank you, we are reviewing this chat room.")
      }
    ]);
  };

  const handleGiftSelected = async (giftId: string) => {
    try {
      setGiftPanelOpen(false);
      const res = await walletApi.sendGiftDirect(giftId, userId);
      Alert.alert("Gift Sent!", `Successfully sent gift to ${partner?.name}.`);
      refetch();
      // Invalidate wallet query so current balance updates
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["dating", "matches"] });
    } catch (err: any) {
      Alert.alert("Gifting Failed", err.message || "Make sure you have enough coins.");
    }
  };

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        {/* Custom Chat Header */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft color={colors.text} size={20} />
            </Pressable>
            {partner && (
              <Pressable
                onPress={() => router.push({ pathname: "/profile/[id]", params: { id: userId } })}
                style={styles.partnerInfo}
              >
                <Image source={{ uri: partner.avatar }} style={styles.headerAvatar as any} />
                <View>
                  <Text style={styles.partnerName}>{partner.name}</Text>
                  <Text style={styles.partnerStatus}>
                    {relationship ? `Bond L${relationship.level} / ${relationship.title}` : `Vibe Score: ${partner.vibeScore || 85}%`}
                  </Text>
                </View>
              </Pressable>
            )}
          </View>
          <View style={styles.headerRight}>
            <Pressable onPress={() => startCallMutation.mutate("VOICE")} style={styles.headerBtn} disabled={startCallMutation.isPending}>
              <Phone color={colors.success} size={19} />
            </Pressable>
            <Pressable onPress={() => startCallMutation.mutate("VIDEO")} style={styles.headerBtn} disabled={startCallMutation.isPending}>
              <Video color={colors.cyan} size={20} />
            </Pressable>
            <Pressable onPress={() => setGiftPanelOpen(true)} style={styles.headerBtn}>
              <Gift color={colors.gold} size={20} />
            </Pressable>
            <Pressable onPress={handleBlock} style={styles.headerBtn}>
              <ShieldOff color={colors.muted} size={20} />
            </Pressable>
            <Pressable onPress={handleReport} style={styles.headerBtn}>
              <AlertTriangle color={colors.danger} size={18} />
            </Pressable>
          </View>
        </View>

        {/* Safety Banner */}
        <View style={styles.safetyBanner}>
          <Info color={colors.muted} size={14} />
          <Text style={styles.safetyText}>
            Keep chats friendly. Do not share banking info, OTPs, or passwords.
          </Text>
        </View>

        {relationship && (
          <View style={styles.relationshipCard}>
            <View style={styles.relationshipTop}>
              <View style={styles.relationshipTitleRow}>
                <Sparkles color={colors.gold} size={15} />
                <Text style={styles.relationshipTitle}>Relationship Level {relationship.level}</Text>
              </View>
              <Text style={styles.relationshipName}>{relationship.title}</Text>
            </View>
            <View style={styles.relationshipTrack}>
              <View style={[styles.relationshipFill, { width: `${Math.round((relationship.progress ?? 0) * 100)}%` }]} />
            </View>
            <Text style={styles.relationshipMeta}>
              {relationship.requiredXp > 0
                ? `${relationship.progressXp}/${relationship.requiredXp} bond XP to level ${relationship.nextLevel}`
                : `${relationship.xp} bond XP total`}
            </Text>
            <Text style={styles.relationshipPerk}>
              {relationship.streakDays ? `${relationship.streakDays}-day streak` : "Start a streak"}{relationship.nextPerk ? ` / Next perk: ${relationship.nextPerk}` : " / All perks unlocked"}
            </Text>
          </View>
        )}

        {/* Message Thread */}
        {loadingMessages && messages.length === 0 ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.pink} size="large" />
          </View>
        ) : (
          <FlatList
            ref={flatListRef}
            data={messages}
            keyExtractor={(item) => item._id || item.id}
            contentContainerStyle={styles.messagesList}
            onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
            renderItem={({ item }) => {
              const isMe = item.senderId?._id === currentUserId || item.senderId?.id === currentUserId || item.senderId === currentUserId;
              const isGift = item.message.startsWith("🎁");
              return (
                <View style={[styles.bubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                  {isMe ? (
                    <LinearGradient
                      colors={isGift ? gradients.gold : gradients.fire}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 1 }}
                      style={styles.bubble}
                    >
                      <Text style={[styles.messageText, isGift && styles.giftText]}>{item.message}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.bubblePartner, isGift && styles.bubbleGiftReceived]}>
                      <Text style={[styles.messageText, isGift && styles.giftText]}>{item.message}</Text>
                    </View>
                  )}
                  <Text style={styles.timeText}>
                    {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </Text>
                </View>
              );
            }}
          />
        )}

        {/* Input Composer */}
        <View style={styles.composer}>
          <Pressable style={styles.giftIconBtn} onPress={() => setGiftPanelOpen(true)}>
            <Gift color={colors.gold} size={22} fill={colors.gold} />
          </Pressable>

          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder={`Message ${partner?.name || "partner"}...`}
            placeholderTextColor={colors.muted}
            style={styles.input}
            onSubmitEditing={handleSend}
            returnKeyType="send"
          />

          <Pressable
            style={[styles.sendBtn, !message.trim() && styles.sendBtnDisabled]}
            onPress={handleSend}
            disabled={!message.trim() || sendMutation.isPending}
          >
            {sendMutation.isPending ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Send color={colors.text} size={18} fill={message.trim() ? colors.text : "transparent"} />
            )}
          </Pressable>
        </View>

        {/* Direct Gifting Drawer */}
        {giftPanelOpen && (
          <GiftPanel
            onSend={(gift) => handleGiftSelected(gift._id)}
          />
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  backBtn: { padding: 6, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  partnerInfo: { flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: { width: 38, height: 38, borderRadius: 19 },
  partnerName: { color: colors.text, fontSize: 15, fontWeight: "900" },
  partnerStatus: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  headerRight: { flexDirection: "row", gap: 6 },
  headerBtn: { padding: 8, borderRadius: 8 },
  safetyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.03)",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  safetyText: { color: colors.muted, fontSize: 11, fontWeight: "700", flex: 1 },
  relationshipCard: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    backgroundColor: "rgba(246,180,75,0.06)"
  },
  relationshipTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  relationshipTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  relationshipTitle: { color: colors.text, fontSize: 12, fontWeight: "900" },
  relationshipName: { color: colors.gold, fontSize: 12, fontWeight: "900" },
  relationshipTrack: { height: 6, borderRadius: 6, overflow: "hidden", backgroundColor: "rgba(255,255,255,0.08)", marginTop: 8 },
  relationshipFill: { height: "100%", borderRadius: 6, backgroundColor: colors.gold },
  relationshipMeta: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 5 },
  relationshipPerk: { color: colors.gold, fontSize: 11, fontWeight: "800", marginTop: 3 },
  messagesList: { padding: 16, gap: 12 },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  bubbleWrap: { maxWidth: "80%", marginBottom: 4 },
  bubbleLeft: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubbleRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16
  },
  bubblePartner: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  bubbleGiftReceived: {
    backgroundColor: "rgba(246,180,75,0.12)",
    borderColor: colors.gold
  },
  messageText: { color: colors.text, fontSize: 15, fontWeight: "700", lineHeight: 20 },
  giftText: { color: colors.text, fontWeight: "800", fontStyle: "italic" },
  timeText: { color: colors.muted, fontSize: 10, fontWeight: "700", marginTop: 2, marginHorizontal: 4 },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.ink
  },
  giftIconBtn: { padding: 8 },
  input: {
    flex: 1,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    color: colors.text,
    paddingHorizontal: 16,
    fontSize: 14,
    marginHorizontal: 10
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.pink,
    alignItems: "center",
    justifyContent: "center"
  },
  sendBtnDisabled: {
    opacity: 0.5,
    backgroundColor: colors.panel
  }
});
