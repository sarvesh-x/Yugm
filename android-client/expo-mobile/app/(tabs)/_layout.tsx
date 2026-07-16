import { Text, View } from "react-native";
import { Tabs } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, Compass, Heart, MessageCircle, Radio, User } from "lucide-react-native";
import { notificationsApi } from "@/lib/api";
import { colors, radii } from "@/theme/colors";

function NotificationsTabIcon({ color }: { color: string }) {
  const { data } = useQuery({
    queryKey: ["notifications", "unread-count"],
    queryFn: () => notificationsApi.list(),
    staleTime: 15000,
    gcTime: 60000,
    select: (d) => d.unreadCount
  });
  const count = data ?? 0;
  return (
    <View>
      <Bell color={color} size={22} />
      {count > 0 && (
        <View style={{
          position: "absolute",
          top: -4,
          right: -8,
          backgroundColor: colors.pink,
          borderRadius: 10,
          minWidth: 18,
          height: 18,
          alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 4,
        }}>
          <Text style={{
            color: "#FFFFFF",
            fontSize: 10,
            fontWeight: "900",
            lineHeight: 14,
          }}>
            {count > 99 ? "99+" : count}
          </Text>
        </View>
      )}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: { backgroundColor: colors.surfaceElevated, borderTopColor: colors.line, borderTopWidth: 1, height: 68, paddingTop: 7, paddingBottom: 7, borderTopLeftRadius: radii.lg, borderTopRightRadius: radii.lg, elevation: 12 },
        tabBarActiveTintColor: colors.pink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800" }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: ({ color }) => <Compass color={color} size={22} /> }} />
      <Tabs.Screen name="match" options={{ title: "Match", tabBarIcon: ({ color }) => <Heart color={color} size={22} /> }} />
      <Tabs.Screen name="live" options={{ title: "Live", tabBarIcon: ({ color }) => <Radio color={color} size={22} /> }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ color }) => <MessageCircle color={color} size={22} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User color={color} size={22} /> }} />

      <Tabs.Screen name="voice" options={{ href: null }} />
      <Tabs.Screen name="video" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="hosts" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{
        title: "Notifications",
        tabBarIcon: (props) => <NotificationsTabIcon {...props} />,
      }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="clan" options={{ href: null }} />
      <Tabs.Screen name="store" options={{ href: null }} />
      <Tabs.Screen name="games" options={{ href: null }} />
      <Tabs.Screen name="grow" options={{ href: null }} />
      <Tabs.Screen name="create-story" options={{ href: null }} />
      <Tabs.Screen name="events" options={{ href: null }} />
    </Tabs>
  );
}
