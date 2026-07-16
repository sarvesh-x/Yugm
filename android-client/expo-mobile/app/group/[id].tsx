import { useState, useEffect, useRef } from "react";
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
import { router, useLocalSearchParams } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Send, Users } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { groupsApi } from "@/lib/api";
import { getSocket } from "@/lib/socket";
import { Screen } from "@/components/Screen";
import { VoiceRecorder } from "@/components/VoiceRecorder";
import { useAuthStore } from "@/store/auth";
import { Audio } from "expo-av";
import { colors, gradients } from "@/theme/colors";

export default function GroupChatRoom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  if (!id) return null;

  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const currentUserId = currentUser?._id || currentUser?.id || "";

  const [message, setMessage] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);

  const flatListRef = useRef<FlatList>(null);

  const { data: groupData, isLoading: loadingGroup } = useQuery({
    queryKey: ["groups", id],
    queryFn: () => groupsApi.detail(id),
    enabled: !!id
  });

  const { data: messagesData, isLoading: loadingMessages, refetch } = useQuery({
    queryKey: ["groups", id, "messages"],
    queryFn: () => groupsApi.messages(id),
    enabled: !!id,
    refetchInterval: 15000
  });

  const group = groupData?.group;
  const messages = messagesData?.messages ?? [];

  useEffect(() => {
    const socket = getSocket();
    socket.connect();
    const handleMessage = (payload: any) => {
      if (payload?.groupId !== id) return;
      const incoming = payload?.message;
      if (!incoming) return;
      queryClient.setQueryData(["groups", id, "messages"], (old: any) => {
        const previous = old?.messages ?? [];
        const messageId = incoming._id ?? incoming.id;
        if (messageId && previous.some((item: any) => (item._id ?? item.id) === messageId)) return old;
        return { ...(old ?? {}), messages: [...previous, incoming] };
      });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 80);
    };
    const handleParticipantChange = () => {
      refetch();
      queryClient.invalidateQueries({ queryKey: ["groups"] });
    };
    socket.on("group:message:new", handleMessage);
    socket.on("group:participant:add", handleParticipantChange);
    socket.on("group:participant:remove", handleParticipantChange);
    return () => {
      socket.off("group:message:new", handleMessage);
      socket.off("group:participant:add", handleParticipantChange);
      socket.off("group:participant:remove", handleParticipantChange);
    };
  }, [id, refetch]);

  const sendMutation = useMutation({
    mutationFn: (text: string) => groupsApi.sendMessage(id, text),
    onSuccess: () => {
      setMessage("");
      queryClient.invalidateQueries({ queryKey: ["groups", id, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["groups"] });
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMutation.mutate(message);
  };

  const participantCount = group?.participantIds?.length ?? 0;

  return (
    <Screen>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
      >
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <ArrowLeft color={colors.text} size={20} />
            </Pressable>
            {group && (
              <View style={styles.groupInfo}>
                <Text style={styles.groupName}>{group.name}</Text>
                <View style={styles.participantRow}>
                  <Users color={colors.muted} size={12} />
                  <Text style={styles.participantCount}>{participantCount} participants</Text>
                </View>
              </View>
            )}
          </View>
        </View>

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
              return (
                <View style={[styles.bubbleWrap, isMe ? styles.bubbleRight : styles.bubbleLeft]}>
                  {!isMe && item.senderId && (
                    <View style={styles.senderRow}>
                      <Image source={{ uri: item.senderId.avatar }} style={styles.senderAvatar as any} />
                      <Text style={styles.senderName}>{item.senderId.name}</Text>
                    </View>
                  )}
                  {isMe ? (
                    <LinearGradient colors={gradients.fire} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.bubble}>
                      <Text style={styles.messageText}>{item.message}</Text>
                    </LinearGradient>
                  ) : (
                    <View style={[styles.bubble, styles.bubblePartner]}>
                      <Text style={styles.messageText}>{item.message}</Text>
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

        <View style={styles.composer}>
          {voiceMode ? (
            <VoiceRecorder
              onComplete={(url, duration) => {
                groupsApi.sendMessage(id, "🎤 Voice note").then(() => {
                  setVoiceMode(false);
                  refetch();
                });
              }}
              onCancel={() => setVoiceMode(false)}
            />
          ) : (
            <>
              <TextInput
                value={message}
                onChangeText={setMessage}
                placeholder={`Message group...`}
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
            </>
          )}
        </View>
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
  groupInfo: {},
  groupName: { color: colors.text, fontSize: 15, fontWeight: "900" },
  participantRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  participantCount: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  messagesList: { padding: 16, gap: 12 },
  bubbleWrap: { maxWidth: "80%", marginBottom: 4 },
  bubbleLeft: { alignSelf: "flex-start", alignItems: "flex-start" },
  bubbleRight: { alignSelf: "flex-end", alignItems: "flex-end" },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 },
  senderAvatar: { width: 20, height: 20, borderRadius: 10 },
  senderName: { color: colors.muted, fontSize: 11, fontWeight: "800" },
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
  messageText: { color: colors.text, fontSize: 15, fontWeight: "700", lineHeight: 20 },
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
    marginRight: 10
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
