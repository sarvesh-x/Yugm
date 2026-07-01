import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { CreditCard, Gift, Plus, ShoppingBag } from "lucide-react-native";
import { GlassCard } from "@/components/GlassCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { Screen, Section } from "@/components/Screen";
import { walletApi } from "@/lib/api";
import { openRazorpayCheckout, startGooglePlayPurchase } from "@/lib/payments";
import { colors, gradients } from "@/theme/colors";
import { useState } from "react";

export default function WalletScreen() {
  const queryClient = useQueryClient();
  const [error, setError] = useState("");
  const wallet = useQuery({ queryKey: ["wallet"], queryFn: () => walletApi.wallet(), staleTime: 30000, gcTime: 60000 });
  const transactions = useQuery({ queryKey: ["wallet", "transactions"], queryFn: () => walletApi.transactions(), staleTime: 30000, gcTime: 60000 });
  const packs = useQuery({ queryKey: ["wallet", "packs"], queryFn: () => walletApi.packs(), staleTime: 300000, gcTime: 600000 });
  const purchases = useQuery({ queryKey: ["wallet", "purchases"], queryFn: () => walletApi.purchases(), staleTime: 30000, gcTime: 60000 });
  const recharge = useMutation({
    mutationFn: (amount: number) => walletApi.recharge(amount ?? 500),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet", "transactions"] });
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

  useFocusEffect(() => {
    queryClient.invalidateQueries({ queryKey: ["wallet"] });
  });

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={wallet.isLoading} onRefresh={() => { wallet.refetch(); transactions.refetch(); packs.refetch(); purchases.refetch(); }} tintColor={colors.gold} />}>
        <Section>
          <Text style={styles.title}>Wallet</Text>
          {wallet.isLoading ? (
            <LoadingState message="Loading balance..." />
          ) : wallet.error ? (
            <ErrorState message={(wallet.error as any)?.message} onRetry={() => wallet.refetch()} />
          ) : (
            <LinearGradient colors={gradients.fire} style={styles.balance}>
              <Text style={styles.label}>Coin balance</Text>
              <Text style={styles.coins}>{wallet.data?.balance ?? 0}</Text>
              {__DEV__ && (
                <Pressable style={styles.recharge} onPress={() => recharge.mutate(500)} disabled={recharge.isPending}>
                  <Plus color={colors.text} size={18} />
                  <Text style={styles.rechargeText}>{recharge.isPending ? "Recharging..." : "Dev recharge"}</Text>
                </Pressable>
              )}
            </LinearGradient>
          )}
          {!!error && <Text style={{ color: colors.danger, fontWeight: "800", marginTop: 8 }}>{error}</Text>}
        </Section>
        <Section>
          <Text style={styles.sectionTitle}>Buy coin packs</Text>
          {packs.isLoading ? <LoadingState message="Loading packs..." /> : (
            <View style={styles.packGrid}>
              {(packs.data?.packs ?? []).map((pack: any) => (
                <GlassCard key={pack.id} style={styles.pack}>
                  <Text style={styles.packCoins}>{pack.coinAmount}</Text>
                  <Text style={styles.packPrice}>INR {pack.priceInr}</Text>
                  <View style={styles.payRow}>
                    <Pressable style={styles.payButton} onPress={() => razorpayOrder.mutate(pack.id)} disabled={razorpayOrder.isPending}>
                      <CreditCard color={colors.text} size={15} />
                      <Text style={styles.payText}>Razorpay</Text>
                    </Pressable>
                    <Pressable style={styles.payButton} onPress={() => playStoreStart.mutate(pack)} disabled={playStoreStart.isPending}>
                      <ShoppingBag color={colors.text} size={15} />
                      <Text style={styles.payText}>Play</Text>
                    </Pressable>
                  </View>
                </GlassCard>
              ))}
            </View>
          )}
        </Section>
        <Section>
          <Text style={styles.sectionTitle}>Purchases</Text>
          {purchases.isLoading ? (
            <LoadingState message="Loading purchases..." />
          ) : !purchases.data?.purchases?.length ? (
            <EmptyState icon={<ShoppingBag color={colors.gold} size={28} />} message="No purchases yet" />
          ) : (
            purchases.data.purchases.map((item: any) => (
              <View key={item._id} style={styles.tx}>
                <CreditCard color={item.status === "CREDITED" ? colors.success : colors.gold} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>{item.provider} / {item.status}</Text>
                  <Text style={styles.txMeta}>{item.coinAmount} coins / INR {item.amountInr}</Text>
                </View>
                <Text style={styles.txAmount}>{item.packId}</Text>
              </View>
            ))
          )}
        </Section>
        <Section>
          <Text style={styles.sectionTitle}>Ledger</Text>
          {transactions.isLoading ? (
            <LoadingState message="Loading transactions..." />
          ) : transactions.error ? (
            <ErrorState message={(transactions.error as any)?.message} onRetry={() => transactions.refetch()} />
          ) : !transactions.data?.transactions?.length ? (
            <EmptyState icon="📒" message="No transactions yet" />
          ) : (
            transactions.data.transactions.map((item: any) => (
              <View key={item._id} style={styles.tx}>
                <Gift color={item.type === "CREDIT" ? colors.success : colors.danger} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.txTitle}>{item.source}</Text>
                  <Text style={styles.txMeta}>Balance {item.balanceBefore} to {item.balanceAfter}</Text>
                </View>
                <Text style={[styles.txAmount, { color: item.type === "CREDIT" ? colors.success : colors.danger }]}>{item.type === "CREDIT" ? "+" : "-"}{item.amount}</Text>
              </View>
            ))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginBottom: 14 },
  balance: { borderRadius: 8, padding: 20 },
  label: { color: "rgba(255,255,255,0.75)", fontWeight: "800" },
  coins: { color: colors.text, fontSize: 48, fontWeight: "900", marginVertical: 8 },
  recharge: { alignSelf: "flex-start", height: 42, borderRadius: 8, paddingHorizontal: 12, backgroundColor: "rgba(0,0,0,0.28)", flexDirection: "row", alignItems: "center", gap: 8 },
  rechargeText: { color: colors.text, fontWeight: "900" },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 20, marginBottom: 12 },
  packGrid: { gap: 10 },
  pack: { alignItems: "center" },
  packCoins: { color: colors.gold, fontSize: 18, fontWeight: "900" },
  packPrice: { color: colors.muted, marginTop: 4 },
  payRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  payButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, minWidth: 112, height: 38, borderRadius: 8, backgroundColor: colors.panelStrong },
  payText: { color: colors.text, fontWeight: "900", fontSize: 12 },
  tx: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, borderBottomWidth: 1, borderColor: colors.line },
  txTitle: { color: colors.text, fontWeight: "900" },
  txMeta: { color: colors.muted, fontSize: 12 },
  txAmount: { fontWeight: "900" }
});
