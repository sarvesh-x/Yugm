import { useMemo, useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, Crown, Gift, ShoppingBag, Sparkles, Tag, Zap } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Screen, Section } from "@/components/Screen";
import { CosmeticAvatar } from "@/components/CosmeticAvatar";
import { walletApi } from "@/lib/api";
import { cosmeticSlot, cosmeticTypeLabel, cosmeticBundles } from "@/lib/cosmetics";
import { colors, gradients } from "@/theme/colors";
import { useAuthStore } from "@/store/auth";

export default function StoreScreen() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [category, setCategory] = useState("bundles");
  const [error, setError] = useState("");

  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => walletApi.wallet(), staleTime: 30000, gcTime: 60000 });
  const cosmetics = useQuery({ queryKey: ["wallet", "cosmetics"], queryFn: () => walletApi.cosmetics(), staleTime: 300000, gcTime: 600000 });

  const purchaseCosmetic = useMutation({
    mutationFn: (cosmeticId: string) => walletApi.purchaseCosmetic(cosmeticId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "cosmetics"] });
      if (currentUser) updateUser({ ...currentUser, walletBalance: data.balance, ownedCosmeticIds: data.ownedCosmeticIds, activeCosmetics: data.activeCosmetics, xp: data.level?.xp, level: data.level?.level, levelTitle: data.level?.title, levelStatus: data.level });
      Alert.alert("Purchased!", `${data.cosmetic.name} is now yours.`);
    },
    onError: (err: any) => setError(err?.message ?? "Purchase failed")
  });

  const equipCosmetic = useMutation({
    mutationFn: ({ cosmeticId, type }: { cosmeticId: string | null; type: string }) => walletApi.equipCosmetic(cosmeticId, type),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "cosmetics"] });
      if (currentUser) updateUser({ ...currentUser, walletBalance: data.balance, ownedCosmeticIds: data.ownedCosmeticIds, activeCosmetics: data.activeCosmetics });
    },
    onError: (err: any) => setError(err?.message ?? "Could not equip")
  });

  const purchaseBundle = useMutation({
    mutationFn: (bundleId: string) => walletApi.purchaseBundle(bundleId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "cosmetics"] });
      if (currentUser && data.balance != null) updateUser({ ...currentUser, walletBalance: data.balance, ownedCosmeticIds: data.ownedCosmeticIds });
      Alert.alert("Bundle purchased!", "All cosmetics in the bundle have been added to your collection.");
    },
    onError: (err: any) => setError(err?.message ?? "Bundle purchase failed")
  });

  useFocusEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    queryClient.invalidateQueries({ queryKey: ["wallet", "cosmetics"] });
  });

  const ownedIds = cosmetics.data?.ownedCosmeticIds ?? [];
  const activeCosmetics = cosmetics.data?.activeCosmetics ?? {};

  const grouped = useMemo(() => {
    const items = cosmetics.data?.cosmetics ?? [];
    const map: Record<string, typeof items> = {};
    for (const item of items) {
      (map[item.type] ??= []).push(item);
    }
    return map;
  }, [cosmetics.data?.cosmetics]);

  const typeOrder = ["AVATAR_ASSET", "AVATAR_FRAME", "SPEAKING_WAVE", "PROFILE_THEME", "ENTRANCE_EFFECT", "ROOM_BADGE", "ROOM_AMBIENCE", "NAME_STYLE", "CALL_SCREEN", "CHAT_BUBBLE"];

  const tabs = [
    { key: "bundles", label: "Bundles", icon: <Tag color={colors.gold} size={16} /> },
    ...typeOrder.map((t) => ({ key: t, label: cosmeticTypeLabel(t).split(" ").slice(0, 2).join(" "), icon: null }))
  ];

  const filteredBundles = cosmeticBundles.filter((b) => b.cosmeticIds.some((id) => !ownedIds.includes(id))).slice(0, 6);

  const refreshing = wallet.isLoading || cosmetics.isLoading;

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollWrap}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { wallet.refetch(); cosmetics.refetch(); }} tintColor={colors.gold} />}
      >
        <Section>
          <View style={styles.heroRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.storeTitle}>Cosmetics Store</Text>
              <Text style={styles.storeSubtitle}>Avatars, frames, themes, waves, and more to style your profile.</Text>
            </View>
            <View style={styles.coinPill}>
              <Coins color={colors.gold} size={18} fill={colors.gold} />
              <Text style={styles.coinPillText}>{wallet.data?.balance ?? 0}</Text>
            </View>
          </View>
        </Section>

        <Section>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabRow}>
            {tabs.map((tab) => (
              <Pressable
                key={tab.key}
                style={[styles.tab, category === tab.key && styles.tabActive]}
                onPress={() => setCategory(tab.key)}
              >
                {tab.icon}
                <Text style={[styles.tabLabel, category === tab.key && styles.tabLabelActive]}>{tab.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Section>

        {category === "bundles" ? (
          <Section>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>Bundle Offers</Text>
              <Zap color={colors.gold} size={16} />
            </View>
            <Text style={styles.sectionSubtitle}>Curated packs at a discount — includes cosmetics you don't own yet.</Text>

            {filteredBundles.length === 0 ? (
              <View style={styles.emptyCard}>
                <Text style={styles.emptyText}>You own everything in every bundle!</Text>
              </View>
            ) : (
              <View style={styles.bundleGrid}>
                {filteredBundles.map((bundle) => {
                  const owned = bundle.cosmeticIds.filter((id) => ownedIds.includes(id)).length;
                  const total = bundle.cosmeticIds.length;
                  return (
                    <LinearGradient key={bundle.id} colors={["rgba(246,180,75,0.06)", "rgba(255,62,147,0.04)"]} style={styles.bundleCard}>
                      <View style={styles.bundleHeader}>
                        <Text style={styles.bundleName}>{bundle.name}</Text>
                        {bundle.discount && <View style={styles.discountPill}><Text style={styles.discountText}>{bundle.discount}</Text></View>}
                      </View>
                      <View style={styles.bundleItems}>
                        {bundle.cosmeticIds.slice(0, 5).map((cid) => {
                          const cos = cosmetics.data?.cosmetics?.find((c: any) => c.id === cid);
                          return (
                            <View key={cid} style={styles.bundleItemPreview}>
                              <CosmeticAvatar cosmetics={{ avatarFrame: cid }} size={28} />
                              <Text style={styles.bundleItemLabel} numberOfLines={1}>{cos?.name?.slice(0, 10) ?? cid.slice(0, 10)}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <View style={styles.bundleFooter}>
                        <View>
                          <Text style={styles.bundlePrice}>{bundle.coinPrice} coins</Text>
                          {owned > 0 && <Text style={styles.bundleOwned}>{owned}/{total} owned</Text>}
                        </View>
                        <Pressable
                          style={[styles.bundleBtn, purchaseBundle.isPending && styles.btnDisabled]}
                          disabled={purchaseBundle.isPending}
                          onPress={() => purchaseBundle.mutate(bundle.id)}
                        >
                          <ShoppingBag color={colors.ink} size={14} />
                          <Text style={styles.bundleBtnText}>{purchaseBundle.isPending ? "..." : "Buy Pack"}</Text>
                        </Pressable>
                      </View>
                    </LinearGradient>
                  );
                })}
              </View>
            )}
          </Section>
        ) : (
          <Section>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.sectionTitle}>{cosmeticTypeLabel(category)}</Text>
              <Sparkles color={colors.pink} size={16} />
            </View>
            <Text style={styles.sectionSubtitle}>Browse and buy {cosmeticTypeLabel(category).toLowerCase()} for your profile.</Text>

            {cosmetics.isLoading ? (
              <ActivityIndicator color={colors.gold} size="small" />
            ) : (
              <View style={styles.cosmeticGrid}>
                {(grouped[category] ?? []).map((item: any) => {
                  const owned = ownedIds.includes(item.id);
                  const key = cosmeticSlot(item.type);
                  const active = activeCosmetics[key] === item.id;
                  const previewCosmetics = { ...activeCosmetics, [key]: item.id };

                  return (
                    <View key={item.id} style={styles.cosmeticCard}>
                      <View style={styles.cosmeticPreview}>
                        <CosmeticAvatar
                          name={currentUser?.name}
                          imageUrl={currentUser?.avatar}
                          cosmetics={previewCosmetics}
                          size={58}
                          isSpeaking={item.type === "SPEAKING_WAVE"}
                          showEntry={item.type === "ENTRANCE_EFFECT"}
                        />
                      </View>
                      {item.assetKind === "ANIMATED" && <View style={styles.gifBadge}><Text style={styles.gifBadgeText}>GIF</Text></View>}
                      <Text style={styles.cosmeticRarity}>{item.rarity}</Text>
                      <Text style={styles.cosmeticName} numberOfLines={2}>{item.name}</Text>
                      <Text style={styles.cosmeticType}>{cosmeticTypeLabel(item.type)}</Text>
                      <Text style={styles.cosmeticPrice}>{item.coinPrice} coins</Text>
                      <Pressable
                        style={[styles.cosmeticBtn, active && styles.cosmeticBtnActive, (purchaseCosmetic.isPending || equipCosmetic.isPending) && styles.btnDisabled]}
                        disabled={purchaseCosmetic.isPending || equipCosmetic.isPending}
                        onPress={() => owned ? equipCosmetic.mutate({ cosmeticId: item.id, type: item.type }) : purchaseCosmetic.mutate(item.id)}
                      >
                        <Text style={[styles.cosmeticBtnText, active && styles.cosmeticBtnActiveText]}>{active ? "Active" : owned ? "Equip" : "Buy"}</Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            )}
          </Section>
        )}

        {!!error && <Text style={styles.errorText}>{error}</Text>}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { paddingBottom: 48 },
  storeTitle: { color: colors.text, fontSize: 26, fontWeight: "900" },
  storeSubtitle: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 6, lineHeight: 20 },
  heroRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  coinPill: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 12, paddingVertical: 8,
    borderRadius: 20, backgroundColor: colors.panel,
    borderWidth: 1, borderColor: "rgba(246,180,75,0.25)"
  },
  coinPillText: { color: colors.gold, fontWeight: "900", fontSize: 16 },
  tabRow: { gap: 8, paddingRight: 20 },
  tab: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 12, backgroundColor: colors.panel,
    borderWidth: 1, borderColor: colors.line
  },
  tabActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  tabLabel: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  tabLabelActive: { color: colors.ink },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  sectionSubtitle: { color: colors.muted, fontSize: 13, fontWeight: "700", marginBottom: 16 },
  bundleGrid: { gap: 14 },
  bundleCard: {
    borderRadius: 18, padding: 16,
    borderWidth: 1, borderColor: "rgba(246,180,75,0.2)"
  },
  bundleHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
  bundleName: { color: colors.text, fontSize: 16, fontWeight: "900", flex: 1 },
  discountPill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.success },
  discountText: { color: colors.ink, fontSize: 11, fontWeight: "900" },
  bundleItems: { flexDirection: "row", gap: 8, marginBottom: 14, flexWrap: "wrap" },
  bundleItemPreview: { alignItems: "center", gap: 2, width: "18%" },
  bundleItemLabel: { color: colors.muted, fontSize: 8, fontWeight: "700" },
  bundleFooter: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  bundlePrice: { color: colors.gold, fontSize: 18, fontWeight: "900" },
  bundleOwned: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  bundleBtn: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10,
    backgroundColor: colors.gold
  },
  bundleBtnText: { color: colors.ink, fontWeight: "900", fontSize: 13 },
  cosmeticGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  cosmeticCard: {
    width: "48%", borderRadius: 16,
    backgroundColor: colors.panel, borderWidth: 1,
    borderColor: "rgba(255,62,147,0.25)", padding: 14
  },
  cosmeticPreview: { alignItems: "center", minHeight: 76, justifyContent: "center", marginBottom: 8 },
  gifBadge: { alignSelf: "flex-start", marginBottom: 4, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, backgroundColor: colors.pink },
  gifBadgeText: { color: colors.text, fontSize: 9, fontWeight: "900" },
  cosmeticRarity: { color: colors.gold, fontSize: 10, fontWeight: "900" },
  cosmeticName: { color: colors.text, fontSize: 14, fontWeight: "900", marginTop: 4 },
  cosmeticType: { color: colors.muted, fontSize: 10, fontWeight: "800", marginTop: 3 },
  cosmeticPrice: { color: colors.pink, fontSize: 13, fontWeight: "900", marginTop: 6 },
  cosmeticBtn: { marginTop: 10, height: 34, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.pink },
  cosmeticBtnActive: { backgroundColor: colors.gold },
  cosmeticBtnText: { color: colors.text, fontWeight: "900", fontSize: 12 },
  cosmeticBtnActiveText: { color: colors.ink },
  btnDisabled: { opacity: 0.6 },
  emptyCard: { padding: 30, alignItems: "center", borderRadius: 16, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  emptyText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  errorText: { color: colors.danger, fontWeight: "800", marginTop: 12, textAlign: "center", marginBottom: 20 }
});
