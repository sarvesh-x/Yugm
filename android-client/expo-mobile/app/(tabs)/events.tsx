import { useState } from "react";
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { CalendarClock, MapPin, Plus, Users, X } from "lucide-react-native";
import { GlassCard } from "@/components/GlassCard";
import { Screen, Section } from "@/components/Screen";
import { eventsApi } from "@/lib/api";
import { colors, gradients } from "@/theme/colors";
import { LinearGradient } from "expo-linear-gradient";

type EventType = "MEETUP" | "WORKSHOP" | "CONCERT" | "GAME" | "OTHER";

const typeLabels: Record<EventType, string> = {
  MEETUP: "Meetup",
  WORKSHOP: "Workshop",
  CONCERT: "Concert",
  GAME: "Game",
  OTHER: "Other"
};

const typeColors: Record<EventType, string> = {
  MEETUP: colors.cyan,
  WORKSHOP: colors.purple,
  CONCERT: colors.pink,
  GAME: colors.gold,
  OTHER: colors.muted
};

const eventTypes: EventType[] = ["MEETUP", "WORKSHOP", "CONCERT", "GAME", "OTHER"];

const emptyForm = { title: "", description: "", type: "MEETUP" as EventType, date: "", category: "" };

export default function EventsScreen() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<"upcoming" | "my">("upcoming");
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const upcoming = useQuery({ queryKey: ["events", "upcoming"], queryFn: eventsApi.list, staleTime: 30000 });
  const my = useQuery({ queryKey: ["events", "my"], queryFn: eventsApi.myEvents, staleTime: 30000 });

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["events"] });
  };

  const joinMutation = useMutation({
    mutationFn: (eventId: string) => eventsApi.join(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      Alert.alert("Joined!", "You are now participating in this event.");
    },
    onError: (err: any) => Alert.alert("Could not join", err.message || "Something went wrong.")
  });

  const cancelMutation = useMutation({
    mutationFn: (eventId: string) => eventsApi.cancel(eventId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      Alert.alert("Cancelled", "Your event has been cancelled.");
    },
    onError: (err: any) => Alert.alert("Could not cancel", err.message || "Something went wrong.")
  });

  const createMutation = useMutation({
    mutationFn: () => eventsApi.create({
      title: form.title,
      description: form.description,
      type: form.type,
      date: form.date,
      category: form.category
    }),
    onSuccess: () => {
      setForm(emptyForm);
      setShowCreate(false);
      queryClient.invalidateQueries({ queryKey: ["events"] });
      Alert.alert("Created!", "Your event has been published.");
    },
    onError: (err: any) => Alert.alert("Could not create", err.message || "Something went wrong.")
  });

  const loading = upcoming.isLoading || my.isLoading;
  const refreshing = upcoming.isFetching || my.isFetching;
  const events: any[] = upcoming.data?.events ?? [];
  const hosted: any[] = my.data?.hosted ?? [];
  const joined: any[] = my.data?.joined ?? [];

  if (loading) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.pink} size="large" />
          <Text style={styles.muted}>Loading events...</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.pink} />}
        >
          <Section>
            <LinearGradient colors={gradients.fire} style={styles.hero}>
              <View style={styles.heroTop}>
                <View>
                  <Text style={styles.eyebrow}>Community</Text>
                  <Text style={styles.title}>Events</Text>
                </View>
                <CalendarClock color={colors.text} size={26} />
              </View>
              <Text style={styles.heroCopy}>Discover meetups, workshops, concerts, and game nights happening in your Yugm community.</Text>
            </LinearGradient>
          </Section>

          <View style={styles.tabBar}>
            <Pressable
              style={[styles.tab, activeTab === "upcoming" && styles.tabActive]}
              onPress={() => setActiveTab("upcoming")}
            >
              <Text style={[styles.tabText, activeTab === "upcoming" && styles.tabTextActive]}>Upcoming</Text>
            </Pressable>
            <Pressable
              style={[styles.tab, activeTab === "my" && styles.tabActive]}
              onPress={() => setActiveTab("my")}
            >
              <Text style={[styles.tabText, activeTab === "my" && styles.tabTextActive]}>My Events</Text>
            </Pressable>
          </View>

          {activeTab === "upcoming" ? (
            <Section>
              {events.length ? events.map((event: any) => (
                <EventCard
                  key={event._id}
                  event={event}
                  onJoin={() => joinMutation.mutate(event._id)}
                  joining={joinMutation.isPending && joinMutation.variables === event._id}
                />
              )) : (
                <GlassCard><Text style={styles.muted}>No upcoming events. Create one to get started!</Text></GlassCard>
              )}
            </Section>
          ) : (
            <Section>
              {hosted.length ? (
                <View style={{ marginBottom: 20 }}>
                  <Text style={styles.sectionTitle}>Hosting</Text>
                  {hosted.map((event: any) => (
                    <EventCard
                      key={event._id}
                      event={event}
                      host
                      onCancel={() => cancelMutation.mutate(event._id)}
                      cancelling={cancelMutation.isPending && cancelMutation.variables === event._id}
                    />
                  ))}
                </View>
              ) : null}
              {joined.length ? (
                <View>
                  <Text style={styles.sectionTitle}>Joined</Text>
                  {joined.map((event: any) => (
                    <EventCard
                      key={event._id}
                      event={event}
                      onJoin={() => joinMutation.mutate(event._id)}
                      joining={joinMutation.isPending && joinMutation.variables === event._id}
                    />
                  ))}
                </View>
              ) : null}
              {!hosted.length && !joined.length ? (
                <GlassCard><Text style={styles.muted}>You haven't joined any events yet. Browse upcoming events to find one!</Text></GlassCard>
              ) : null}
            </Section>
          )}

          <Section>
            {showCreate ? (
              <GlassCard style={styles.createCard}>
                <View style={styles.createHeader}>
                  <Text style={styles.rowTitle}>Create Event</Text>
                  <Pressable onPress={() => { setShowCreate(false); setForm(emptyForm); }}>
                    <X color={colors.muted} size={20} />
                  </Pressable>
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Title"
                  placeholderTextColor={colors.muted}
                  value={form.title}
                  onChangeText={(text) => setForm((f) => ({ ...f, title: text }))}
                />
                <TextInput
                  style={[styles.input, styles.inputMultiline]}
                  placeholder="Description"
                  placeholderTextColor={colors.muted}
                  value={form.description}
                  onChangeText={(text) => setForm((f) => ({ ...f, description: text }))}
                  multiline
                />
                <View style={styles.typeRow}>
                  {eventTypes.map((t) => (
                    <Pressable
                      key={t}
                      style={[styles.typeChip, form.type === t && { backgroundColor: typeColors[t] + "22", borderColor: typeColors[t] }]}
                      onPress={() => setForm((f) => ({ ...f, type: t }))}
                    >
                      <Text style={[styles.typeChipText, form.type === t && { color: typeColors[t] }]}>{typeLabels[t]}</Text>
                    </Pressable>
                  ))}
                </View>
                <TextInput
                  style={styles.input}
                  placeholder="Date (YYYY-MM-DD)"
                  placeholderTextColor={colors.muted}
                  value={form.date}
                  onChangeText={(text) => setForm((f) => ({ ...f, date: text }))}
                />
                <TextInput
                  style={styles.input}
                  placeholder="Category"
                  placeholderTextColor={colors.muted}
                  value={form.category}
                  onChangeText={(text) => setForm((f) => ({ ...f, category: text }))}
                />
                <Pressable
                  style={[styles.createButton, (!form.title || !form.date) && styles.createButtonDisabled]}
                  disabled={!form.title || !form.date || createMutation.isPending}
                  onPress={() => createMutation.mutate()}
                >
                  {createMutation.isPending ? (
                    <ActivityIndicator color={colors.text} size="small" />
                  ) : (
                    <Text style={styles.createButtonText}>Publish Event</Text>
                  )}
                </Pressable>
              </GlassCard>
            ) : (
              <Pressable style={styles.showCreateButton} onPress={() => setShowCreate(true)}>
                <Plus color={colors.pink} size={20} />
                <Text style={styles.showCreateText}>Create Event</Text>
              </Pressable>
            )}
          </Section>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function EventCard({
  event,
  onJoin,
  joining,
  host,
  onCancel,
  cancelling
}: {
  event: any;
  onJoin?: () => void;
  joining?: boolean;
  host?: boolean;
  onCancel?: () => void;
  cancelling?: boolean;
}) {
  const eventType = (event.type || "OTHER") as EventType;
  const badgeColor = typeColors[eventType] || colors.muted;

  return (
    <GlassCard style={styles.eventCard}>
      <View style={styles.eventTop}>
        <View style={[styles.typeBadge, { backgroundColor: badgeColor + "1A", borderColor: badgeColor + "44" }]}>
          <Text style={[styles.typeBadgeText, { color: badgeColor }]}>{typeLabels[eventType] || eventType}</Text>
        </View>
        {host ? (
          <Pressable onPress={onCancel} disabled={cancelling}>
            {cancelling ? (
              <ActivityIndicator color={colors.danger} size="small" />
            ) : (
              <Text style={styles.cancelText}>Cancel</Text>
            )}
          </Pressable>
        ) : (
          <Pressable style={[styles.joinButton, joining && styles.joinButtonDisabled]} onPress={onJoin} disabled={joining}>
            {joining ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <Text style={styles.joinButtonText}>Join</Text>
            )}
          </Pressable>
        )}
      </View>
      <Text style={styles.eventTitle}>{event.title}</Text>
      {event.description ? <Text style={styles.eventDesc} numberOfLines={2}>{event.description}</Text> : null}
      <View style={styles.eventMeta}>
        <View style={styles.eventMetaItem}>
          <CalendarClock color={colors.muted} size={14} />
          <Text style={styles.eventMetaText}>{event.date ? new Date(event.date).toLocaleDateString() : "TBA"}</Text>
        </View>
        <View style={styles.eventMetaItem}>
          <MapPin color={colors.muted} size={14} />
          <Text style={styles.eventMetaText}>{event.host?.name ?? event.host?.username ?? "Host"}</Text>
        </View>
        <View style={styles.eventMetaItem}>
          <Users color={colors.muted} size={14} />
          <Text style={styles.eventMetaText}>{event.participantCount ?? 0}</Text>
        </View>
      </View>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  muted: { color: colors.muted, fontSize: 13, lineHeight: 19, fontWeight: "700" },
  hero: { borderRadius: 18, padding: 18, marginTop: 8 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "rgba(255,255,255,0.72)", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginTop: 4 },
  heroCopy: { color: "rgba(255,255,255,0.78)", fontSize: 14, lineHeight: 20, marginTop: 12, fontWeight: "700" },
  tabBar: { flexDirection: "row", marginHorizontal: 20, marginBottom: 16, backgroundColor: colors.panel, borderRadius: 10, padding: 3 },
  tab: { flex: 1, paddingVertical: 10, alignItems: "center", borderRadius: 8 },
  tabActive: { backgroundColor: colors.panelStrong },
  tabText: { color: colors.muted, fontSize: 13, fontWeight: "800" },
  tabTextActive: { color: colors.text },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 10 },
  eventCard: { marginBottom: 12, gap: 10 },
  eventTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  typeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  typeBadgeText: { fontSize: 11, fontWeight: "900" },
  eventTitle: { color: colors.text, fontSize: 17, fontWeight: "900" },
  eventDesc: { color: colors.muted, fontSize: 13, fontWeight: "600", lineHeight: 18 },
  eventMeta: { flexDirection: "row", gap: 14, marginTop: 4 },
  eventMetaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  eventMetaText: { color: colors.muted, fontSize: 12, fontWeight: "700" },
  joinButton: { backgroundColor: colors.pink, paddingHorizontal: 16, paddingVertical: 7, borderRadius: 999 },
  joinButtonDisabled: { opacity: 0.6 },
  joinButtonText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  cancelText: { color: colors.danger, fontSize: 12, fontWeight: "900" },
  showCreateButton: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, backgroundColor: colors.panel, borderRadius: 10, borderWidth: 1, borderColor: colors.line, borderStyle: "dashed" },
  showCreateText: { color: colors.pink, fontSize: 14, fontWeight: "900" },
  createCard: { gap: 12 },
  createHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  input: { backgroundColor: colors.surface, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 12, color: colors.text, fontSize: 14, fontWeight: "700", borderWidth: 1, borderColor: colors.line },
  inputMultiline: { minHeight: 72, textAlignVertical: "top" },
  typeRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  typeChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel },
  typeChipText: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  createButton: { backgroundColor: colors.pink, paddingVertical: 14, borderRadius: 10, alignItems: "center" },
  createButtonDisabled: { opacity: 0.5 },
  createButtonText: { color: colors.text, fontSize: 15, fontWeight: "900" }
});
