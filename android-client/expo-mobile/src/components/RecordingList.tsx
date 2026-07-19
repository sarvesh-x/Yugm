import { useState } from "react";
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Clock, Eye, Headphones, Music, Play, Trash2 } from "lucide-react-native";
import { recordingsApi } from "@/lib/api";
import { colors, radii, type } from "@/theme/colors";
import { EmptyState } from "./EmptyState";
import { GlassCard } from "./GlassCard";

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function timeAgo(date: string | Date) {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

export function RecordingList({ roomId, isHost }: { roomId: string; isHost: boolean }) {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["recordings", roomId, page],
    queryFn: () => recordingsApi.listByRoom(roomId, page),
    enabled: !!roomId,
  });

  const deleteRecording = useMutation({
    mutationFn: (id: string) => recordingsApi.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["recordings", roomId] }),
    onError: (err: any) => Alert.alert("Error", err?.message ?? "Failed to delete recording"),
  });

  const recordView = useMutation({
    mutationFn: (id: string) => recordingsApi.view(id),
  });

  const recordings = data?.recordings ?? [];
  const totalPages = data?.totalPages ?? 1;

  if (isLoading) {
    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Recordings</Text>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>Recordings ({data?.total ?? 0})</Text>
      {recordings.length === 0 ? (
        <EmptyState message="No recordings yet" />
      ) : (
        <FlatList
          data={recordings}
          keyExtractor={(item) => item._id ?? item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <GlassCard style={styles.card}>
              <Pressable
                style={styles.cardContent}
                onPress={() => recordView.mutate(item._id ?? item.id)}
              >
                <View style={styles.iconWrap}>
                  <Headphones color={colors.gold} size={20} />
                </View>
                <View style={styles.info}>
                  <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
                  <View style={styles.meta}>
                    <View style={styles.metaItem}>
                      <Clock color={colors.muted} size={12} />
                      <Text style={styles.metaText}>{formatDuration(item.duration)}</Text>
                    </View>
                    <View style={styles.metaItem}>
                      <Eye color={colors.muted} size={12} />
                      <Text style={styles.metaText}>{item.viewCount ?? 0}</Text>
                    </View>
                    <Text style={styles.metaText}>{timeAgo(item.createdAt)}</Text>
                  </View>
                </View>
                <Pressable style={styles.playBtn}>
                  <Play color={colors.ink} size={16} fill={colors.ink} />
                </Pressable>
              </Pressable>
              {isHost && (
                <Pressable
                  style={styles.deleteBtn}
                  onPress={() => {
                    Alert.alert("Delete Recording", "Are you sure?", [
                      { text: "Cancel", style: "cancel" },
                      { text: "Delete", style: "destructive", onPress: () => deleteRecording.mutate(item._id ?? item.id) },
                    ]);
                  }}
                >
                  <Trash2 color={colors.danger} size={16} />
                </Pressable>
              )}
            </GlassCard>
          )}
        />
      )}
      {totalPages > 1 && (
        <View style={styles.pagination}>
          <Pressable
            style={[styles.pageBtn, page <= 1 && styles.pageBtnDisabled]}
            onPress={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
          >
            <Text style={[styles.pageBtnText, page <= 1 && styles.pageBtnTextDisabled]}>Previous</Text>
          </Pressable>
          <Text style={styles.pageInfo}>{page} / {totalPages}</Text>
          <Pressable
            style={[styles.pageBtn, page >= totalPages && styles.pageBtnDisabled]}
            onPress={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
          >
            <Text style={[styles.pageBtnText, page >= totalPages && styles.pageBtnTextDisabled]}>Next</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    ...type.title,
    fontSize: 18,
    marginBottom: 12,
  },
  loading: {
    color: colors.muted,
    textAlign: "center",
    paddingVertical: 20,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  cardContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: radii.sm,
    backgroundColor: colors.panelStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  info: {
    flex: 1,
  },
  title: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 4,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    color: colors.muted,
    fontSize: 12,
    fontWeight: "600",
  },
  playBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.gold,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteBtn: {
    padding: 8,
    marginLeft: 4,
  },
  pagination: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
    marginTop: 12,
  },
  pageBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: radii.sm,
    backgroundColor: colors.panel,
  },
  pageBtnDisabled: {
    opacity: 0.4,
  },
  pageBtnText: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 13,
  },
  pageBtnTextDisabled: {
    color: colors.muted,
  },
  pageInfo: {
    color: colors.muted,
    fontWeight: "600",
    fontSize: 13,
  },
});
