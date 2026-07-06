import { useState } from "react";
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { CreditCard, Crown, Gift, Plus, ShoppingBag, Coins, TrendingUp } from "lucide-react-native";
import { Screen, Section } from "@/components/Screen";
import { walletApi } from "@/lib/api";
import { openRazorpayCheckout, startGooglePlayPurchase } from "@/lib/payments";
import { useAuthStore } from "@/store/auth";
import { colors, gradients } from "@/theme/colors";

export default function WalletScreen() {
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const updateUser = useAuthStore((s) => s.updateUser);
  const [error, setError] = useState("");

  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => walletApi.wallet(), staleTime: 30000, gcTime: 60000 });
  const vipPlans = useQuery({ queryKey: ["wallet", "vipPlans"], queryFn: () => walletApi.vipPlans(), staleTime: 300000, gcTime: 600000 });
  const transactions = useQuery({ queryKey: ["wallet", "transactions"], queryFn: () => walletApi.transactions(), staleTime: 30000, gcTime: 60000 });
  const packs = useQuery({ queryKey: ["wallet", "packs"], queryFn: () => walletApi.packs(), staleTime: 300000, gcTime: 600000 });
  const purchases = useQuery({ queryKey: ["wallet", "purchases"], queryFn: () => walletApi.purchases(), staleTime: 30000, gcTime: 60000 });

  const recharge = useMutation({
    mutationFn: (amount: number) => walletApi.recharge(amount ?? 500),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      Alert.alert("Dev Recharge Success", "Successfully added test coins to your wallet!");
    },
    onError: (err: any) => { setError(err?.message ?? "Recharge failed"); }
  });

  const razorpayOrder = useMutation({
    mutationFn: (packId: string) => walletApi.createRazorpayOrder(packId),
    onSuccess: async (data) => {
      try {
        const result = await openRazorpayCheckout(data.checkout);
        await walletApi.verifyRazorpay({
          purchaseId: data.purchase._id,
          razorpay_order_id: result.razorpay_order_id,
          razorpay_payment_id: result.razorpay_payment_id,
          razorpay_signature: result.razorpay_signature
        });
        queryClient.invalidateQueries({ queryKey: ["wallet"] });
        queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
        queryClient.invalidateQueries({ queryKey: ["wallet", "purchases"] });
      } catch (err: any) {
        queryClient.invalidateQueries({ queryKey: ["wallet", "purchases"] });
        Alert.alert("Checkout setup needed", err?.message ?? `Order ${data.order.id} is ready for Razorpay Checkout.`);
      }
    },
    onError: (err: any) => setError(err?.message ?? "Razorpay order failed")
  });

  const playStoreStart = useMutation({
    mutationFn: async (pack: any) => {
      const purchase = await startGooglePlayPurchase(pack.googleProductId);
      return { pack, purchase };
    },
    onSuccess: async ({ pack, purchase }) => {
      const result = Array.isArray(purchase) ? purchase[0] : purchase;
      const purchaseToken = result?.purchaseToken;
      if (!purchaseToken) {
        Alert.alert("Google Play purchase", `Product id: ${pack.googleProductId}. Send the purchase token to verify once the billing client returns it.`);
        return;
      }
      await walletApi.verifyGooglePlay({
        packId: pack.id,
        productId: pack.googleProductId,
        purchaseToken,
        orderId: result?.orderId
      });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "purchases"] });
    },
    onError: (err: any) => {
      Alert.alert("Play Billing setup needed", err?.message ?? "Google Play Billing is not available in this build.");
    }
  });

  const activateVip = useMutation({
    mutationFn: (planId: string) => walletApi.activateVip(planId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
      if (currentUser) updateUser({ ...currentUser, walletBalance: data.balance, ...data.vip });
      Alert.alert("VIP activated", `You are VIP until ${new Date(data.vip.vipExpiresAt).toLocaleDateString()}.`);
    },
    onError: (err: any) => setError(err?.message ?? "VIP activation failed")
  });

  useFocusEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
    queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
  });

  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.scrollWrap}
        refreshControl={
          <RefreshControl
            refreshing={wallet.isLoading}
            onRefresh={() => {
              wallet.refetch();
              transactions.refetch();
              packs.refetch();
              purchases.refetch();
              vipPlans.refetch();
            }}
            tintColor={colors.gold}
          />
        }
      >
        <Section>
          {/* Main Balance Card */}
          <LinearGradient colors={gradients.gold} style={styles.balanceCard}>
            <View style={styles.balanceHeader}>
              <View style={styles.coinBadgeIcon}>
                <Coins color={colors.gold} size={22} fill={colors.gold} />
              </View>
              <Text style={styles.balanceLabel}>Current Balances</Text>
            </View>
            
            <Text style={styles.balanceCoins}>
              {wallet.data?.balance ?? 0} <Text style={styles.coinSubtext}>Coins</Text>
            </Text>

            {__DEV__ && (
              <Pressable
                style={styles.devRechargeBtn}
                onPress={() => recharge.mutate(1000)}
                disabled={recharge.isPending}
              >
                <Plus color={colors.gold} size={16} />
                <Text style={styles.devRechargeText}>
                  {recharge.isPending ? "Adding..." : "Dev Recharge +1000 Coins"}
                </Text>
              </Pressable>
            )}
          </LinearGradient>

          {!!error && <Text style={styles.errorText}>{error}</Text>}
        </Section>

        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>VIP Membership</Text>
            <Crown color={colors.gold} size={18} />
          </View>
          <Text style={styles.sectionSubtitle}>
            {wallet.data?.vip?.isVip
              ? `Active until ${new Date(wallet.data.vip.vipExpiresAt).toLocaleDateString()}`
              : "Unlock a VIP badge, priority discovery, and a golden profile glow."}
          </Text>

          {vipPlans.isLoading ? (
            <ActivityIndicator color={colors.gold} size="small" />
          ) : (
            <View style={styles.vipGrid}>
              {(vipPlans.data?.plans ?? []).map((plan: any) => (
                <View key={plan.id} style={styles.vipCard}>
                  <View style={styles.vipTitleRow}>
                    <Crown color={colors.gold} size={18} />
                    <Text style={styles.vipName}>{plan.name}</Text>
                  </View>
                  <Text style={styles.vipMeta}>{plan.durationDays} days</Text>
                  <Text style={styles.vipPrice}>{plan.coinPrice} coins</Text>
                  <Text style={styles.vipBenefits}>{plan.benefits?.slice(0, 3).join(" / ")}</Text>
                  <Pressable
                    style={[styles.vipBtn, activateVip.isPending && styles.vipBtnDisabled]}
                    onPress={() => activateVip.mutate(plan.id)}
                    disabled={activateVip.isPending}
                  >
                    <Text style={styles.vipBtnText}>{activateVip.isPending ? "Activating..." : "Activate VIP"}</Text>
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Buying Packs section */}
        <Section>
          <Text style={styles.sectionTitle}>Recharge Packs</Text>
          <Text style={styles.sectionSubtitle}>Send gifts to hosts in live rooms or direct messages.</Text>

          {packs.isLoading ? (
            <ActivityIndicator color={colors.gold} size="large" style={{ marginVertical: 20 }} />
          ) : (
            <View style={styles.packGrid}>
              {(packs.data?.packs ?? []).map((pack: any) => (
                <View key={pack.id} style={styles.packCard}>
                  <View style={styles.packCoinsHeader}>
                    <Coins color={colors.gold} size={20} fill={colors.gold} />
                    <Text style={styles.packCoins}>{pack.coinAmount}</Text>
                  </View>
                  <Text style={styles.packPrice}>₹ {pack.priceInr}</Text>
                  
                  <View style={styles.payActions}>
                    <Pressable
                      style={styles.payBtn}
                      onPress={() => razorpayOrder.mutate(pack.id)}
                      disabled={razorpayOrder.isPending}
                    >
                      <CreditCard color={colors.text} size={12} />
                      <Text style={styles.payBtnText}>Razorpay</Text>
                    </Pressable>

                    <Pressable
                      style={[styles.payBtn, styles.payBtnAlt]}
                      onPress={() => playStoreStart.mutate(pack)}
                      disabled={playStoreStart.isPending}
                    >
                      <ShoppingBag color={colors.text} size={12} />
                      <Text style={styles.payBtnText}>Play Store</Text>
                    </Pressable>
                  </View>
                </View>
              ))}
            </View>
          )}
        </Section>

        {/* Ledger & Transactions History */}
        <Section>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <TrendingUp color={colors.muted} size={16} />
          </View>

          {transactions.isLoading ? (
            <ActivityIndicator color={colors.gold} size="small" />
          ) : !transactions.data?.transactions?.length ? (
            <View style={styles.emptyLedger}>
              <Text style={styles.emptyLedgerText}>No coin transactions logged yet.</Text>
            </View>
          ) : (
            <View style={styles.ledgerList}>
              {transactions.data.transactions.map((item: any) => {
                const isCredit = item.type === "CREDIT";
                return (
                  <View key={item._id} style={styles.ledgerRow}>
                    <View style={[styles.ledgerIconCircle, isCredit ? styles.iconCredit : styles.iconDebit]}>
                      <Gift color={isCredit ? colors.success : colors.danger} size={16} />
                    </View>
                    <View style={styles.ledgerInfo}>
                      <Text style={styles.ledgerTitle}>{item.source}</Text>
                      <Text style={styles.ledgerDate}>
                        {new Date(item.createdAt).toLocaleDateString([], { month: "short", day: "numeric" })} at{" "}
                        {new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </Text>
                    </View>
                    <Text style={[styles.ledgerAmount, isCredit ? styles.amountCredit : styles.amountDebit]}>
                      {isCredit ? "+" : "-"}{item.amount}
                    </Text>
                  </View>
                );
              })}
            </View>
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { paddingBottom: 48 },
  balanceCard: {
    borderRadius: 20,
    padding: 24,
    shadowColor: "#F6B44B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
    borderWidth: 1,
    borderColor: "rgba(246,180,75,0.25)"
  },
  balanceHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  coinBadgeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(5,7,19,0.3)",
    alignItems: "center",
    justifyContent: "center"
  },
  balanceLabel: { color: "rgba(255,255,255,0.85)", fontSize: 13, fontWeight: "900", textTransform: "uppercase", letterSpacing: 1 },
  balanceCoins: { color: colors.text, fontSize: 44, fontWeight: "900", marginVertical: 14 },
  coinSubtext: { fontSize: 18, fontWeight: "800", color: "rgba(255,255,255,0.75)" },
  devRechargeBtn: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.ink,
    borderWidth: 1,
    borderColor: "rgba(246,180,75,0.3)"
  },
  devRechargeText: { color: colors.gold, fontWeight: "900", fontSize: 13 },
  errorText: { color: colors.danger, fontWeight: "800", marginTop: 12, textAlign: "center" },
  sectionTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  sectionSubtitle: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 4, marginBottom: 16 },
  packGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  packCard: {
    width: "48%",
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 16,
    alignItems: "center",
    justifyContent: "space-between"
  },
  packCoinsHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  packCoins: { color: colors.text, fontSize: 18, fontWeight: "900" },
  packPrice: { color: colors.muted, fontSize: 14, fontWeight: "800", marginVertical: 8 },
  vipGrid: { gap: 12 },
  vipCard: {
    borderRadius: 16,
    backgroundColor: "rgba(246,180,75,0.08)",
    borderWidth: 1,
    borderColor: "rgba(246,180,75,0.28)",
    padding: 16
  },
  vipTitleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  vipName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  vipMeta: { color: colors.muted, fontSize: 12, fontWeight: "800", marginTop: 6 },
  vipPrice: { color: colors.gold, fontSize: 22, fontWeight: "900", marginTop: 6 },
  vipBenefits: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 8 },
  vipBtn: { marginTop: 12, height: 40, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.gold },
  vipBtnDisabled: { opacity: 0.6 },
  vipBtnText: { color: colors.ink, fontWeight: "900" },
  payActions: { width: "100%", gap: 6 },
  payBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    height: 32,
    borderRadius: 8,
    backgroundColor: colors.pink,
    width: "100%"
  },
  payBtnAlt: {
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.line
  },
  payBtnText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  sectionHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 14 },
  emptyLedger: {
    padding: 30,
    alignItems: "center",
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  emptyLedgerText: { color: colors.muted, fontWeight: "700", fontSize: 13 },
  ledgerList: { gap: 8 },
  ledgerRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 12,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  ledgerIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12
  },
  iconCredit: { backgroundColor: "rgba(50,213,131,0.08)" },
  iconDebit: { backgroundColor: "rgba(255,91,110,0.08)" },
  ledgerInfo: { flex: 1 },
  ledgerTitle: { color: colors.text, fontSize: 14, fontWeight: "900" },
  ledgerDate: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  ledgerAmount: { fontSize: 15, fontWeight: "900" },
  amountCredit: { color: colors.success },
  amountDebit: { color: colors.danger }
});
