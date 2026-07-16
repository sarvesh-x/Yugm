import { Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gift, Send } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { wishlistApi, usersApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function UserWishlist() {
  const { userId } = useLocalSearchParams<{ userId: string }>();
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?._id ?? s.user?.id ?? "");

  const user = useQuery({ queryKey: ["user", userId], queryFn: () => usersApi.get(userId!), enabled: !!userId, staleTime: 30000, gcTime: 60000 });
  const items = useQuery({ queryKey: ["wishlist", userId], queryFn: () => wishlistApi.userItems(userId!), enabled: !!userId, staleTime: 10000, gcTime: 30000 });

  const sendGift = useMutation({
    mutationFn: (itemId: string) => wishlistApi.sendGift(itemId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wishlist", userId] });
      Alert.alert("Gift Sent", `You sent ${data.giftName}!`);
    },
    onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to send gift"),
  });

  if (items.isLoading || user.isLoading) return <Screen><LoadingState message="Loading..." /></Screen>;
  if (items.error) return <Screen><ErrorState message={(items.error as any)?.message} onRetry={() => items.refetch()} /></Screen>;

  const userName = user.data?.user?.name ?? "User";

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft color={colors.text} size={22} />
        </Pressable>
        <Text style={styles.title}>{userName}'s Wishlist</Text>
      </View>

      <FlatList
        data={items.data?.items ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={items.isRefetching} onRefresh={() => items.refetch()} tintColor={colors.gold} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Gift color={colors.muted} size={48} />
            <Text style={styles.emptyText}>This wishlist is empty</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemIcon}>{item.giftId?.icon?.slice(0, 2)?.toUpperCase() ?? "🎁"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.giftId?.name ?? "Gift"}</Text>
                <Text style={styles.itemPrice}>{item.giftId?.coinPrice ?? 0} coins</Text>
                {item.message ? <Text style={styles.itemMessage}>"{item.message}"</Text> : null}
              </View>
            </View>
            {currentUserId !== userId && (
              <Pressable
                style={styles.sendBtn}
                onPress={() => Alert.alert("Send Gift", `Send ${item.giftId?.name ?? "this gift"} to ${userName}?`, [
                  { text: "Cancel", style: "cancel" },
                  { text: "Send", onPress: () => sendGift.mutate(item._id) }
                ])}
              >
                <Send color={colors.gold} size={16} />
              </Pressable>
            )}
          </View>
        )}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
  list: { padding: 18, flexGrow: 1 },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  itemIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 40, color: colors.gold, fontWeight: "900", fontSize: 18, overflow: "hidden" },
  itemName: { color: colors.text, fontWeight: "900", fontSize: 15 },
  itemPrice: { color: colors.gold, fontSize: 12, fontWeight: "800" },
  itemMessage: { color: colors.muted, fontSize: 12, marginTop: 2, fontStyle: "italic" },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: 12 },
  sendBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(246,180,75,0.15)", borderWidth: 1, borderColor: colors.gold, alignItems: "center", justifyContent: "center" },
});
