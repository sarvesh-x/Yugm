import { Tabs } from "expo-router";
import { Bell, Radio, Search, User, Video, Wallet } from "lucide-react-native";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.ink2, borderTopColor: colors.line, height: 68 },
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "800" }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: ({ color }) => <Search color={color} size={20} /> }} />
      <Tabs.Screen name="voice" options={{ title: "Voice", tabBarIcon: ({ color }) => <Radio color={color} size={20} /> }} />
      <Tabs.Screen name="video" options={{ title: "Video", tabBarIcon: ({ color }) => <Video color={color} size={20} /> }} />
      <Tabs.Screen name="wallet" options={{ title: "Wallet", tabBarIcon: ({ color }) => <Wallet color={color} size={20} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User color={color} size={20} /> }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="hosts" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null, tabBarIcon: ({ color }) => <Bell color={color} size={20} /> }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
    </Tabs>
  );
}
