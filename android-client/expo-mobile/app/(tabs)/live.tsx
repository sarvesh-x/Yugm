import { useState, useCallback } from "react";
import { RefreshControl, ScrollView, StyleSheet, Text, View, Pressable } from "react-native";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Mic, Video, Plus, Radio, Compass } from "lucide-react-native";
import { categories } from "@yugm/shared";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { EmptyState } from "@/components/EmptyState";
import { RoomCard } from "@/components/RoomCard";
import { Screen, Section } from "@/components/Screen";
import { roomsApi } from "@/lib/api";
import { colors } from "@/theme/colors";
import { LinearGradient } from "expo-linear-gradient";

export default function LiveRoomsCombined() {
  const params = useLocalSearchParams<{ type?: "VOICE" | "VIDEO" }>();
  const [roomType, setRoomType] = useState<"VOICE" | "VIDEO">(params.type === "VIDEO" ? "VIDEO" : "VOICE");
  const [selectedCategory, setSelectedCategory] = useState("Trending");
  const queryClient = useQueryClient();

  const categoryFilter = selectedCategory === "Trending" ? undefined : selectedCategory;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["rooms", roomType, categoryFilter],
    queryFn: () => roomsApi.list({ type: roomType, category: categoryFilter }),
    staleTime: 30000,
    gcTime: 60000
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [roomType, selectedCategory])
  );

  const rooms = data?.rooms ?? [];

  return (
    <Screen>
      <View style={styles.container}>
        {/* Toggle Header */}
        <View style={styles.toggleHeader}>
          <Pressable
            style={[styles.toggleBtn, roomType === "VOICE" && styles.toggleBtnActive]}
            onPress={() => setRoomType("VOICE")}
          >
            <Mic color={roomType === "VOICE" ? colors.pink : colors.muted} size={18} />
            <Text style={[styles.toggleText, roomType === "VOICE" && styles.toggleTextActive]}>
              Voice Lounges
            </Text>
          </Pressable>

          <Pressable
            style={[styles.toggleBtn, roomType === "VIDEO" && styles.toggleBtnActive]}
            onPress={() => setRoomType("VIDEO")}
          >
            <Video color={roomType === "VIDEO" ? colors.pink : colors.muted} size={18} />
            <Text style={[styles.toggleText, roomType === "VIDEO" && styles.toggleTextActive]}>
              Video Tables
            </Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollWrap}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} tintColor={colors.pink} />}
        >
          <Section>
            {/* Category Filter Chips */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
              {categories.map((item) => {
                const selected = item === selectedCategory;
                return (
                  <Pressable
                    key={item}
                    onPress={() => setSelectedCategory(item)}
                    style={[styles.chip, selected && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, selected && styles.chipTextActive]}>{item}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Section>

          <Section>
            {isLoading ? (
              <LoadingState message="Tuning frequencies..." />
            ) : error ? (
              <ErrorState message={(error as any)?.message} onRetry={refetch} />
            ) : rooms.length === 0 ? (
              <EmptyState
                icon={<Radio color={colors.muted} size={48} />}
                message={`No active ${roomType.toLowerCase()} rooms. Tap below to launch one!`}
              />
            ) : (
              <View style={styles.roomsList}>
                {rooms.map((room: any) => (
                  <RoomCard
                    wide
                    key={room._id}
                    room={room}
                    onPress={() =>
                      router.push({
                        pathname: "/room/[id]",
                        params: { id: room._id, type: room.type }
                      })
                    }
                  />
                ))}
              </View>
            )}
          </Section>
        </ScrollView>

        {/* Floating Action Button */}
        <Pressable style={styles.fab} onPress={() => router.push("/room/create")}>
          <LinearGradient
            colors={["#FF8A22", "#FF3E93", "#8A5CFF"]}
            style={styles.fabGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
          >
            <Plus color={colors.text} size={28} />
          </LinearGradient>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, position: "relative" },
  toggleHeader: {
    flexDirection: "row",
    backgroundColor: colors.ink2,
    marginHorizontal: 20,
    marginTop: 14,
    borderRadius: 14,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.line
  },
  toggleBtn: {
    flex: 1,
    flexDirection: "row",
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 10
  },
  toggleBtnActive: {
    backgroundColor: "rgba(255,255,255,0.06)"
  },
  toggleText: {
    color: colors.muted,
    fontSize: 14,
    fontWeight: "800"
  },
  toggleTextActive: {
    color: colors.text,
    fontWeight: "900"
  },
  scrollWrap: {
    paddingTop: 8,
    paddingBottom: 80
  },
  chipsRow: {
    marginHorizontal: -4
  },
  chip: {
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    marginRight: 8
  },
  chipActive: {
    backgroundColor: colors.pink,
    borderColor: colors.pink
  },
  chipText: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 13
  },
  chipTextActive: {
    color: colors.text
  },
  roomsList: {
    gap: 12
  },
  fab: {
    position: "absolute",
    right: 24,
    bottom: 24,
    width: 60,
    height: 60,
    borderRadius: 30,
    shadowColor: colors.pink,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 8
  },
  fabGradient: {
    flex: 1,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center"
  }
});
