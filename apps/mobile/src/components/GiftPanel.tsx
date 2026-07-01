import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { walletApi } from "@/lib/api";
import type { Gift } from "@/lib/types";
import { colors } from "@/theme/colors";

export function GiftPanel({ onSend }: { onSend: (gift: Gift) => void }) {
  const { data } = useQuery({ queryKey: ["gifts"], queryFn: () => walletApi.gifts(), staleTime: 30000, gcTime: 60000 });
  return (
    <View style={styles.panel}>
      <Text style={styles.title}>Gifts</Text>
      <FlatList
        horizontal
        data={data?.gifts ?? []}
        keyExtractor={(item) => item._id}
        renderItem={({ item }) => (
          <Pressable style={styles.gift} onPress={() => onSend(item)}>
            <Text style={styles.icon}>{item.icon?.slice(0, 2)?.toUpperCase() ?? "🎁"}</Text>
            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.price}>{item.coinPrice} coins</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { padding: 16, backgroundColor: colors.ink2, borderTopWidth: 1, borderColor: colors.line },
  title: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 12 },
  gift: { width: 92, marginRight: 10, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 10, alignItems: "center", gap: 5 },
  icon: { color: colors.gold, fontWeight: "900", fontSize: 20 },
  name: { color: colors.text, fontWeight: "800" },
  price: { color: colors.muted, fontSize: 11 }
});
