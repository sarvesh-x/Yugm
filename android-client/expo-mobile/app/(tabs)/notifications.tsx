import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Gift, UserPlus, Mic, ShieldAlert } from "lucide-react-native";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Screen, Section } from "@/components/Screen";
import { notificationsApi } from "@/lib/api";
import { colors } from "@/theme/colors";

const typeIcons: Record<string, any> = {
  FOLLOW: UserPlus,
  GIFT: Gift,
  SPEAKER_REQUEST: Mic,
  REPORT: ShieldAlert,
  SAFETY: ShieldAlert
};

export default function Notifications() {
  const queryClient = useQueryClient();
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

  const notifications = data?.notifications ?? [];

  const openNotification = (item: any) => {
    if (!item.read) markRead.mutate(item._id);
    const payload = item.data ?? {};
    if (payload.clanId) {
      router.push("/(tabs)/clan");
      return;
    }
    if (payload.partnerId) {
      router.push({ pathname: "/chat/[userId]", params: { userId: String(payload.partnerId) } });
      return;
    }
    if (payload.roomId) {
      router.push({ pathname: "/room/[id]", params: { id: String(payload.roomId) } });
      return;
    }
    if (item.type === "FOLLOW" && payload.userId) {
      router.push({ pathname: "/profile/[id]", params: { id: String(payload.userId) } });
    }
  };

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.gold} />}>
        <Section>
          <View style={styles.header}>
            <Text style={styles.title}>Notifications</Text>
            {notifications.some((n: any) => !n.read) && (
              <Pressable style={styles.markAll} onPress={() => markAll.mutate()} disabled={markAll.isPending}>
                <CheckCheck color={colors.gold} size={18} />
                <Text style={styles.markAllText}>{markAll.isPending ? "Marking..." : "Mark all read"}</Text>
              </Pressable>
            )}
          </View>
        </Section>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={(error as any)?.message} onRetry={refetch} />
        ) : notifications.length === 0 ? (
          <EmptyState icon="🔔" message="No notifications yet" />
        ) : (
          <Section>
            {notifications.map((item: any) => {
              const Icon = typeIcons[item.type] ?? Bell;
              return (
                <Pressable
                  key={item._id}
                  style={[styles.notif, !item.read && styles.unread]}
                  onPress={() => openNotification(item)}
                >
                  <Icon color={item.read ? colors.muted : colors.gold} size={20} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.notifTitle, !item.read && styles.unreadText]}>{item.title}</Text>
                    <Text style={styles.notifBody}>{item.body}</Text>
                    <Text style={styles.notifTime}>{item.createdAt ? new Date(item.createdAt).toLocaleDateString() : ""}</Text>
                  </View>
                  {!item.read && <View style={styles.dot} />}
                </Pressable>
              );
            })}
          </Section>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  markAll: { flexDirection: "row", alignItems: "center", gap: 6, height: 36, paddingHorizontal: 12, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  markAllText: { color: colors.gold, fontWeight: "800", fontSize: 12 },
  notif: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, borderBottomWidth: 1, borderColor: colors.line },
  unread: { backgroundColor: "rgba(246,180,75,0.06)" },
  unreadText: { fontWeight: "900" },
  notifTitle: { color: colors.text, fontWeight: "800" },
  notifBody: { color: colors.muted, fontSize: 13, marginTop: 2 },
  notifTime: { color: colors.muted, fontSize: 11, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.gold }
});
