import { Tabs } from "expo-router";
import { Compass, Gamepad2, Heart, Radio, MessageCircle, ShoppingBag, Sparkles, User } from "lucide-react-native";
import { colors } from "@/theme/colors";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.ink2, borderTopColor: colors.line, height: 72, paddingBottom: 6 },
        tabBarActiveTintColor: colors.pink,
        tabBarInactiveTintColor: colors.muted,
        tabBarLabelStyle: { fontSize: 10, fontWeight: "800" }
      }}
    >
      <Tabs.Screen name="index" options={{ title: "Discover", tabBarIcon: ({ color }) => <Compass color={color} size={22} /> }} />
      <Tabs.Screen name="match" options={{ title: "Match", tabBarIcon: ({ color }) => <Heart color={color} size={22} /> }} />
      <Tabs.Screen name="live" options={{ title: "Live", tabBarIcon: ({ color }) => <Radio color={color} size={22} /> }} />
      <Tabs.Screen name="store" options={{ title: "Store", tabBarIcon: ({ color }) => <ShoppingBag color={color} size={22} /> }} />
      <Tabs.Screen name="games" options={{ title: "Games", tabBarIcon: ({ color }) => <Gamepad2 color={color} size={22} /> }} />
      <Tabs.Screen name="grow" options={{ title: "Grow", tabBarIcon: ({ color }) => <Sparkles color={color} size={22} /> }} />
      <Tabs.Screen name="chat" options={{ title: "Chat", tabBarIcon: ({ color }) => <MessageCircle color={color} size={22} /> }} />
      <Tabs.Screen name="profile" options={{ title: "Profile", tabBarIcon: ({ color }) => <User color={color} size={22} /> }} />
      
      <Tabs.Screen name="voice" options={{ href: null }} />
      <Tabs.Screen name="video" options={{ href: null }} />
      <Tabs.Screen name="wallet" options={{ href: null }} />
      <Tabs.Screen name="search" options={{ href: null }} />
      <Tabs.Screen name="hosts" options={{ href: null }} />
      <Tabs.Screen name="notifications" options={{ href: null }} />
      <Tabs.Screen name="settings" options={{ href: null }} />
      <Tabs.Screen name="clan" options={{ href: null }} />
    </Tabs>
  );
}
