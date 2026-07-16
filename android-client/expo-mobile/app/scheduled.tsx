import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react-native";
import { RoomCalendar } from "@/components/RoomCalendar";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Screen, Section } from "@/components/Screen";
import { roomsApi } from "@/lib/api";
import { colors } from "@/theme/colors";

export default function ScheduledRooms() {
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["rooms", "scheduled"],
    queryFn: () => roomsApi.scheduled(),
    staleTime: 15000,
    gcTime: 60000
  });

  const rooms = data?.rooms ?? [];

  return (
    <Screen>
      <ScrollView refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.gold} />}>
        <Section>
          <View style={styles.header}>
            <Text style={styles.title}>Scheduled Rooms</Text>
            <Pressable style={styles.scheduleBtn} onPress={() => router.push("/room/create")}>
              <Plus color={colors.text} size={18} />
              <Text style={styles.scheduleBtnText}>Schedule a Room</Text>
            </Pressable>
          </View>
        </Section>
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState message={(error as any)?.message} onRetry={refetch} />
        ) : (
          <RoomCalendar
            rooms={rooms}
            onRoomPress={(room) => router.push({ pathname: "/room/[id]", params: { id: room._id } })}
            onSchedule={() => router.push("/room/create")}
          />
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 18 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  scheduleBtn: { flexDirection: "row", alignItems: "center", gap: 6, height: 40, paddingHorizontal: 16, borderRadius: 20, backgroundColor: colors.pink },
  scheduleBtnText: { color: colors.text, fontWeight: "900", fontSize: 13 },
});
