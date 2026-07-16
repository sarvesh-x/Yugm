import { useState } from "react";
import { FlatList, Pressable, StyleSheet, Text, View } from "react-native";
import { Calendar, Clock, MapPin } from "lucide-react-native";
import { colors } from "@/theme/colors";

interface ScheduledRoom {
  _id: string;
  title: string;
  type: "VOICE" | "VIDEO";
  scheduledFor: string;
  hostId: { name: string; avatar?: string; _id: string };
  participantCount: number;
  category: string;
}

interface Props {
  rooms: ScheduledRoom[];
  onRoomPress: (room: ScheduledRoom) => void;
  onSchedule: () => void;
}

export function RoomCalendar({ rooms, onRoomPress, onSchedule }: Props) {
  const today = new Date();
  const [selectedDate, setSelectedDate] = useState(today.toDateString());
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    return d;
  });

  const filtered = rooms.filter((r) => {
    const rd = new Date(r.scheduledFor);
    return rd.toDateString() === selectedDate;
  });

  return (
    <View>
      <FlatList
        horizontal
        data={days}
        renderItem={({ item }) => {
          const selected = item.toDateString() === selectedDate;
          return (
            <Pressable
              style={[styles.day, selected && styles.daySelected]}
              onPress={() => setSelectedDate(item.toDateString())}
            >
              <Text style={[styles.dayName, selected && styles.dayTextSelected]}>
                {item.toLocaleDateString("en", { weekday: "short" })}
              </Text>
              <Text style={[styles.dayNum, selected && styles.dayTextSelected]}>
                {item.getDate()}
              </Text>
            </Pressable>
          );
        }}
        keyExtractor={(_, i) => String(i)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.daysContainer}
      />
      <View style={styles.roomsList}>
        {filtered.length === 0 ? (
          <View style={styles.empty}>
            <Calendar color={colors.muted} size={32} />
            <Text style={styles.emptyText}>No rooms scheduled for this day</Text>
          </View>
        ) : (
          filtered.map((room) => (
            <Pressable key={room._id} style={styles.roomCard} onPress={() => onRoomPress(room)}>
              <View>
                <Text style={styles.roomTitle}>{room.title}</Text>
                <Text style={styles.roomMeta}>{room.hostId.name} · {room.category}</Text>
                <View style={styles.roomTime}>
                  <Clock color={colors.muted} size={12} />
                  <Text style={styles.timeText}>{new Date(room.scheduledFor).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</Text>
                </View>
              </View>
              <Text style={styles.roomType}>{room.type === "VOICE" ? "🎙️" : "📹"}</Text>
            </Pressable>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  daysContainer: { paddingHorizontal: 8, paddingVertical: 12, gap: 8 },
  day: { width: 50, height: 64, borderRadius: 12, backgroundColor: colors.panel, alignItems: "center", justifyContent: "center", marginRight: 6 },
  daySelected: { backgroundColor: colors.gold },
  dayName: { color: colors.muted, fontSize: 11, fontWeight: "800" },
  dayNum: { color: colors.text, fontSize: 18, fontWeight: "900", marginTop: 2 },
  dayTextSelected: { color: colors.ink },
  roomsList: { paddingHorizontal: 16, paddingBottom: 20 },
  empty: { alignItems: "center", paddingVertical: 40 },
  emptyText: { color: colors.muted, fontSize: 14, fontWeight: "700", marginTop: 8 },
  roomCard: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: colors.surface, borderRadius: 12, borderWidth: 1, borderColor: colors.line, padding: 14, marginBottom: 10 },
  roomTitle: { color: colors.text, fontWeight: "900", fontSize: 15 },
  roomMeta: { color: colors.muted, fontSize: 12, marginTop: 2 },
  roomTime: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  timeText: { color: colors.muted, fontSize: 11, fontWeight: "700" },
  roomType: { fontSize: 24 },
});
