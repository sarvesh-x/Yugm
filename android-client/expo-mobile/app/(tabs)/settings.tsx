import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { Shield, LogOut } from "lucide-react-native";
import { Screen, Section } from "@/components/Screen";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

export default function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  return (
    <Screen>
      <Section>
        <Text style={styles.title}>Settings</Text>
        <View style={styles.row}><Shield color={colors.gold} /><Text style={styles.rowText}>Privacy, blocked users, reports</Text></View>
        <Pressable style={styles.row} onPress={() => Alert.alert("Log out", "Are you sure you want to log out? You'll need to log in again.", [
          { text: "Cancel", style: "cancel" },
          { text: "Log out", style: "destructive", onPress: async () => { await logout(); router.replace("/onboarding"); } }
        ])}>
          <LogOut color={colors.danger} />
          <Text style={styles.rowText}>Log out</Text>
        </Pressable>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.text, fontSize: 30, fontWeight: "900", marginVertical: 18 },
  row: { height: 58, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 12 },
  rowText: { color: colors.text, fontWeight: "800" }
});
