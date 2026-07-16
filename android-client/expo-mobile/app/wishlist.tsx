import { useState } from "react";
import { Alert, FlatList, Modal, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from "react-native";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Gift, Plus, Trash2 } from "lucide-react-native";
import { Screen } from "@/components/Screen";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { wishlistApi, walletApi } from "@/lib/api";
import { colors } from "@/theme/colors";

export default function MyWishlist() {
  const queryClient = useQueryClient();
  const [showAdd, setShowAdd] = useState(false);
  const [selectedGiftId, setSelectedGiftId] = useState("");
  const [message, setMessage] = useState("");
  const [isPublic, setIsPublic] = useState(true);

  const items = useQuery({ queryKey: ["wishlist", "me"], queryFn: () => wishlistApi.myItems(), staleTime: 10000, gcTime: 30000 });
  const gifts = useQuery({ queryKey: ["gifts"], queryFn: () => walletApi.gifts(), staleTime: 30000, gcTime: 60000 });

  const addItem = useMutation({
    mutationFn: () => wishlistApi.add({ giftId: selectedGiftId, message: message || undefined, isPublic }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wishlist", "me"] });
      setShowAdd(false);
      setSelectedGiftId("");
      setMessage("");
      setIsPublic(true);
    },
    onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to add"),
  });

  const removeItem = useMutation({
    mutationFn: (itemId: string) => wishlistApi.remove(itemId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["wishlist", "me"] }),
    onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to remove"),
  });

  if (items.isLoading) return <Screen><LoadingState message="Loading wishlist..." /></Screen>;
  if (items.error) return <Screen><ErrorState message={(items.error as any)?.message} onRetry={() => items.refetch()} /></Screen>;

  return (
    <Screen>
      <View style={styles.header}>
        <Pressable style={styles.back} onPress={() => router.back()}>
          <ArrowLeft color={colors.text} size={22} />
        </Pressable>
        <Text style={styles.title}>My Wishlist</Text>
        <Pressable style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Plus color={colors.text} size={20} />
        </Pressable>
      </View>

      <FlatList
        data={items.data?.items ?? []}
        keyExtractor={(item) => item._id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={items.isRefetching} onRefresh={() => items.refetch()} tintColor={colors.gold} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Gift color={colors.muted} size={48} />
            <Text style={styles.emptyText}>Your wishlist is empty</Text>
            <Text style={styles.emptyHint}>Tap + to add gifts you'd love to receive</Text>
          </View>
        }
        renderItem={({ item }) => (
          <View style={styles.item}>
            <View style={styles.itemLeft}>
              <Text style={styles.itemIcon}>{item.giftId?.icon?.slice(0, 2)?.toUpperCase() ?? "🎁"}</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemName}>{item.giftId?.name ?? "Gift"}</Text>
                <Text style={styles.itemPrice}>{item.giftId?.coinPrice ?? 0} coins</Text>
                {item.message ? <Text style={styles.itemMessage}>{item.message}</Text> : null}
              </View>
            </View>
            <Pressable onPress={() => removeItem.mutate(item._id)}>
              <Trash2 color={colors.danger} size={18} />
            </Pressable>
          </View>
        )}
      />

      <Modal visible={showAdd} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>Add to Wishlist</Text>
            <Text style={styles.modalSubtitle}>Select a gift</Text>
            <FlatList
              data={gifts.data?.gifts ?? []}
              keyExtractor={(g) => g._id}
              style={styles.giftList}
              renderItem={({ item: g }) => (
                <Pressable
                  style={[styles.giftOption, selectedGiftId === g._id && styles.giftSelected]}
                  onPress={() => setSelectedGiftId(g._id)}
                >
                  <Text style={styles.giftOptionIcon}>{g.icon?.slice(0, 2)?.toUpperCase() ?? "🎁"}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.giftOptionName}>{g.name}</Text>
                    <Text style={styles.giftOptionPrice}>{g.coinPrice} coins</Text>
                  </View>
                </Pressable>
              )}
            />
            <TextInput
              style={styles.input}
              placeholder="Add a message (optional)"
              placeholderTextColor={colors.muted}
              value={message}
              onChangeText={setMessage}
              maxLength={200}
            />
            <Pressable style={styles.publicToggle} onPress={() => setIsPublic((v) => !v)}>
              <Text style={styles.publicToggleText}>{isPublic ? "Public" : "Private"}</Text>
            </Pressable>
            <View style={styles.modalActions}>
              <Pressable style={styles.cancelBtn} onPress={() => setShowAdd(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.saveBtn, !selectedGiftId && styles.saveBtnDisabled]} onPress={() => addItem.mutate()} disabled={!selectedGiftId}>
                <Text style={styles.saveText}>Add</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, borderBottomWidth: 1, borderColor: colors.line, gap: 12 },
  back: { width: 40, height: 40, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  title: { color: colors.text, fontSize: 20, fontWeight: "900", flex: 1 },
  addBtn: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  list: { padding: 18, flexGrow: 1 },
  item: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 14, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, marginBottom: 10 },
  itemLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  itemIcon: { width: 40, height: 40, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center", textAlign: "center", lineHeight: 40, color: colors.gold, fontWeight: "900", fontSize: 18, overflow: "hidden" },
  itemName: { color: colors.text, fontWeight: "900", fontSize: 15 },
  itemPrice: { color: colors.gold, fontSize: 12, fontWeight: "800" },
  itemMessage: { color: colors.muted, fontSize: 12, marginTop: 2 },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 60 },
  emptyText: { color: colors.text, fontWeight: "900", fontSize: 18, marginTop: 12 },
  emptyHint: { color: colors.muted, marginTop: 6, textAlign: "center" },
  modalOverlay: { flex: 1, backgroundColor: colors.scrim, justifyContent: "flex-end" },
  modal: { backgroundColor: colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: "80%" },
  modalTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  modalSubtitle: { color: colors.muted, marginTop: 4, marginBottom: 12 },
  giftList: { maxHeight: 200, marginBottom: 12 },
  giftOption: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 8, marginBottom: 6, backgroundColor: colors.panel, borderWidth: 1, borderColor: "transparent" },
  giftSelected: { borderColor: colors.gold, backgroundColor: "rgba(246,180,75,0.1)" },
  giftOptionIcon: { width: 36, height: 36, borderRadius: 6, backgroundColor: colors.panelStrong, textAlign: "center", lineHeight: 36, color: colors.gold, fontWeight: "900", fontSize: 16, overflow: "hidden" },
  giftOptionName: { color: colors.text, fontWeight: "800" },
  giftOptionPrice: { color: colors.muted, fontSize: 12 },
  input: { height: 44, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, color: colors.text, marginBottom: 12 },
  publicToggle: { height: 44, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center", marginBottom: 12 },
  publicToggleText: { color: colors.gold, fontWeight: "900" },
  modalActions: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center" },
  cancelText: { color: colors.muted, fontWeight: "900" },
  saveBtn: { flex: 1, height: 44, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  saveBtnDisabled: { opacity: 0.4 },
  saveText: { color: colors.ink, fontWeight: "900" },
});
