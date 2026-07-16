import { useState, useCallback } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Gift, UserPlus, Mic, ShieldAlert, Heart, MessageCircle, Crown, Award } from "lucide-react-native";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Screen, Section } from "@/components/Screen";
import { notificationsApi } from "@/lib/api";
import { openNotificationTarget } from "@/lib/notificationRouting";
import { colors } from "@/theme/colors";

const PAGE_SIZE = 30;

const typeIcons: Record<string, any> = {
  FOLLOW: UserPlus,
  GIFT: Gift,
  SPEAKER_REQUEST: Mic,
  REPORT: ShieldAlert,
  SAFETY: ShieldAlert,
  COMMENT: MessageCircle,
  FRIEND_REQUEST: UserPlus,
  FRIEND_ACCEPT: Heart,
  SUBSCRIPTION: Crown,
  STREAK_BONUS: Award,
  GIFT_LEADERBOARD: Award,
  ROOM_INVITE: Mic,
};

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function groupKey(dateStr: string): string {
  const d = new Date(dateStr);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (dayStart.getTime() === today.getTime()) return "Today";
  if (dayStart.getTime() === yesterday.getTime()) return "Yesterday";
  const weekAgo = new Date(today);
  weekAgo.setDate(weekAgo.getDate() - 7);
  if (dayStart.getTime() >= weekAgo.getTime()) return "This Week";
  return "Earlier";
}

export default function Notifications() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(0);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list(),
    staleTime: 15000,
    gcTime: 60000
  });

  const markRead = useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (err: any) => console.error(err)
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications"] }),
    onError: (err: any) => console.error(err)
  });

  const allNotifications = data?.notifications ?? [];
  const hasMore = allNotifications.length > (page + 1) * PAGE_SIZE;
  const paged = allNotifications.slice(0, (page + 1) * PAGE_SIZE);

  const grouped = (paged as any[]).reduce((acc: Record<string, any[]>, n: any) => {
    const key = groupKey(n.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(n);
    return acc;
  }, {} as Record<string, any[]>);

  const groupOrder = ["Today", "Yesterday", "This Week", "Earlier"];

  const openNotification = useCallback((item: any) => {
    if (!item.read) markRead.mutate(item._id);
    if (!openNotificationTarget(item)) router.push("/(tabs)");
  }, [markRead]);

  const renderItem = useCallback(({ item }: { item: any }) => {
    const Icon = typeIcons[item.type] ?? Bell;
    return (
      <Pressable
        style={[styles.notif, !item.read && styles.unread]}
        onPress={() => openNotification(item)}
      >
        <View style={[styles.iconWrap, !item.read && styles.iconWrapUnread]}>
          <Icon color={item.read ? colors.muted : colors.gold} size={18} />
        </View>
        <View style={styles.notifContent}>
          <Text style={[styles.notifTitle, !item.read && styles.unreadText]}>{item.title}</Text>
          {!!item.body && <Text style={styles.notifBody} numberOfLines={2}>{item.body}</Text>}
          <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
        </View>
        {!item.read && <View style={styles.dot} />}
      </Pressable>
    );
  }, [openNotification]);

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Text style={styles.title}>Notifications</Text>
        {allNotifications.some((n: any) => !n.read) && (
          <Pressable style={styles.markAll} onPress={() => markAll.mutate()} disabled={markAll.isPending}>
            <CheckCheck color={colors.gold} size={18} />
            <Text style={styles.markAllText}>{markAll.isPending ? "Marking..." : "Mark all read"}</Text>
          </Pressable>
        )}
      </View>
      {isLoading ? (
        <LoadingState />
      ) : error ? (
        <ErrorState message={(error as any)?.message} onRetry={refetch} />
      ) : allNotifications.length === 0 ? (
        <EmptyState icon="🔔" message="No notifications yet" />
      ) : (
        <FlatList
          data={groupOrder.flatMap((g) => grouped[g] ? [{ _group: g } as any, ...grouped[g]] : [])}
          keyExtractor={(item) => item._group ?? item._id}
          renderItem={({ item }) => {
            if (item._group) {
              return <Text style={styles.groupLabel}>{item._group}</Text>;
            }
            return renderItem({ item });
          }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.gold} />}
          contentContainerStyle={styles.list}
          onEndReached={() => { if (hasMore) setPage((p) => p + 1); }}
          onEndReachedThreshold={0.5}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 20, paddingTop: 18, paddingBottom: 8 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  markAll: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  markAllText: { color: colors.gold, fontWeight: "800", fontSize: 12 },
  list: { paddingHorizontal: 20, paddingBottom: 20 },
  groupLabel: { color: colors.muted, fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5, marginTop: 16, marginBottom: 4 },
  notif: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  unread: { backgroundColor: "rgba(246,180,75,0.06)" },
  unreadText: { fontWeight: "900" },
  iconWrap: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  iconWrapUnread: { backgroundColor: "rgba(246,180,75,0.15)" },
  notifContent: { flex: 1 },
  notifTitle: { color: colors.text, fontWeight: "800" },
  notifBody: { color: colors.muted, fontSize: 13, marginTop: 2 },
  notifTime: { color: colors.muted, fontSize: 11, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold }
});
