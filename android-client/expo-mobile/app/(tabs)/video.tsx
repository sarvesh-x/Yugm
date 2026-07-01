import { RefreshControl, ScrollView, StyleSheet, Text } from "react-native";
import { router } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { RoomCard } from "@/components/RoomCard";
import { Screen, Section } from "@/components/Screen";
import { roomsApi } from "@/lib/api";
import { colors } from "@/theme/colors";

export default function VideoRooms() {
  const { data, isLoading, error, refetch } = useQuery({ queryKey: ["rooms", "VIDEO"], queryFn: () => roomsApi.list("VIDEO"), staleTime: 30000, gcTime: 60000 });
  const rooms = data?.rooms ?? [];
  return (
    <Screen>
      <ScrollView
        contentContainerStyle={styles.wrap}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.gold} />}
      >
        <Section>
          <Text style={styles.title}>Video rooms</Text>
          <Text style={styles.subtitle}>Creator tables with audience mode and camera controls.</Text>
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={(error as any)?.message} onRetry={refetch} />
          ) : rooms.length === 0 ? (
            <EmptyState icon="📹" message="No video rooms right now. Start one!" />
          ) : (
            rooms.map((room: any) => <RoomCard wide key={room._id} room={room} onPress={() => router.push({ pathname: "/room/[id]", params: { id: room._id, type: "VIDEO" } })} />)
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 8 },
  title: { color: colors.text, fontSize: 30, fontWeight: "900" },
  subtitle: { color: colors.muted, marginBottom: 18, marginTop: 6 }
});
