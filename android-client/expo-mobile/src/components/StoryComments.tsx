import { useState, useEffect, useCallback } from "react";
import {
  Modal, View, Text, TextInput, Pressable, FlatList, StyleSheet, KeyboardAvoidingView, Platform,
  Image, ActivityIndicator
} from "react-native";
import { X, Send, Trash2, ArrowLeft } from "lucide-react-native";
import { colors, spacing, radii } from "@/theme/colors";
import { absoluteMediaUrl, storiesApi } from "@/lib/api";

interface CommentUser {
  _id: string;
  name: string;
  username: string;
  avatar?: string;
}

interface Reply {
  _id: string;
  userId: CommentUser;
  text: string;
  createdAt: string;
}

interface Comment {
  _id: string;
  userId: CommentUser;
  text: string;
  createdAt: string;
  replies: Reply[];
}

interface Props {
  storyId: string;
  storyUserId?: string;
  visible: boolean;
  onClose: () => void;
}

export function StoryComments({ storyId, storyUserId, visible, onClose }: Props) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [input, setInput] = useState("");
  const [replyTo, setReplyTo] = useState<{ commentId: string; userName: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  const fetchComments = useCallback(async () => {
    try {
      const res = await storiesApi.comments(storyId);
      setComments(res.comments);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [storyId]);

  useEffect(() => {
    if (visible) {
      setLoading(true);
      setReplyTo(null);
      fetchComments();
    }
  }, [visible, fetchComments]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      if (replyTo) {
        await storiesApi.replyToComment(storyId, replyTo.commentId, text);
      } else {
        await storiesApi.addComment(storyId, text);
      }
      setInput("");
      setReplyTo(null);
      await fetchComments();
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  }, [input, sending, replyTo, storyId, fetchComments]);

  const handleDelete = useCallback(async (commentId: string) => {
    try {
      await storiesApi.deleteComment(commentId);
      await fetchComments();
    } catch {
      // ignore
    }
  }, [fetchComments]);

  const renderReply = ({ item }: { item: Reply }) => (
    <View style={styles.replyContainer}>
      <Image source={{ uri: absoluteMediaUrl(item.userId.avatar ?? "") }} style={styles.replyAvatar} />
      <View style={styles.replyContent}>
        <Text style={styles.replyName}>{item.userId.name}</Text>
        <Text style={styles.replyText}>{item.text}</Text>
      </View>
    </View>
  );

  const renderComment = ({ item }: { item: Comment }) => (
    <View style={styles.commentContainer}>
      <View style={styles.commentHeader}>
        <Image source={{ uri: absoluteMediaUrl(item.userId.avatar ?? "") }} style={styles.avatar} />
        <View style={styles.commentBody}>
          <View style={styles.commentTop}>
            <Text style={styles.name}>{item.userId.name}</Text>
            <Text style={styles.time}>{new Date(item.createdAt).toLocaleDateString()}</Text>
          </View>
          <Text style={styles.commentText}>{item.text}</Text>
          <Pressable onPress={() => setReplyTo({ commentId: item._id, userName: item.userId.name })}>
            <Text style={styles.replyBtn}>Reply</Text>
          </Pressable>
        </View>
        <Pressable onPress={() => handleDelete(item._id)} hitSlop={8}>
          <Trash2 color={colors.muted} size={16} />
        </Pressable>
      </View>
      {item.replies.length > 0 && (
        <FlatList
          data={item.replies}
          renderItem={renderReply}
          keyExtractor={(r) => r._id}
          scrollEnabled={false}
        />
      )}
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Comments</Text>
          <Pressable onPress={onClose} hitSlop={12}>
            <X color={colors.text} size={24} />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator color={colors.gold} />
          </View>
        ) : comments.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.emptyText}>No comments yet</Text>
          </View>
        ) : (
          <FlatList
            data={comments}
            renderItem={renderComment}
            keyExtractor={(c) => c._id}
            contentContainerStyle={styles.list}
          />
        )}

        {replyTo && (
          <View style={styles.replyBanner}>
            <ArrowLeft color={colors.gold} size={16} />
            <Text style={styles.replyBannerText}>Replying to {replyTo.userName}</Text>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={8}>
              <X color={colors.muted} size={16} />
            </Pressable>
          </View>
        )}

        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder={replyTo ? "Write a reply..." : "Write a comment..."}
            placeholderTextColor={colors.muted}
            value={input}
            onChangeText={setInput}
            multiline
            maxLength={500}
          />
          <Pressable onPress={handleSend} disabled={!input.trim() || sending} style={styles.sendBtn}>
            <Send color={input.trim() ? colors.gold : colors.muted} size={20} />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.ink,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "900",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: colors.muted,
    fontSize: 15,
    fontWeight: "600",
  },
  list: {
    padding: spacing.lg,
  },
  commentContainer: {
    marginBottom: spacing.lg,
  },
  commentHeader: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.panel,
  },
  commentBody: {
    flex: 1,
  },
  commentTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  name: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "900",
  },
  time: {
    color: colors.muted,
    fontSize: 11,
    fontWeight: "600",
  },
  commentText: {
    color: colors.text,
    fontSize: 14,
    fontWeight: "600",
    marginTop: 2,
  },
  replyBtn: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
    marginTop: 4,
  },
  replyContainer: {
    flexDirection: "row",
    gap: spacing.sm,
    marginLeft: 44,
    marginTop: spacing.sm,
  },
  replyAvatar: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.panel,
  },
  replyContent: {
    flex: 1,
  },
  replyName: {
    color: colors.gold,
    fontSize: 12,
    fontWeight: "800",
  },
  replyText: {
    color: colors.text,
    fontSize: 13,
    fontWeight: "600",
  },
  replyBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.surface,
  },
  replyBannerText: {
    flex: 1,
    color: colors.gold,
    fontSize: 13,
    fontWeight: "700",
  },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
    gap: spacing.sm,
  },
  input: {
    flex: 1,
    color: colors.text,
    fontSize: 15,
    fontWeight: "600",
    backgroundColor: colors.ink2,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    maxHeight: 100,
  },
  sendBtn: {
    padding: spacing.sm,
  },
});
