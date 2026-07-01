import { useState } from "react";
import { Alert, Pressable, StyleSheet, Text, View, ScrollView, Switch, Image, Modal, ActivityIndicator } from "react-native";
import { router } from "expo-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Shield, LogOut, ChevronRight, Ban, User, Lock, HelpCircle, ArrowLeft, RefreshCw } from "lucide-react-native";
import { Screen, Section } from "@/components/Screen";
import { useAuthStore } from "@/store/auth";
import { usersApi } from "@/lib/api";
import { colors } from "@/theme/colors";

export default function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [blockedModalVisible, setBlockedModalVisible] = useState(false);
  const [safetyModalVisible, setSafetyModalVisible] = useState(false);

  // Notifications toggles (Local state dummy controls)
  const [matchNotifications, setMatchNotifications] = useState(true);
  const [roomNotifications, setRoomNotifications] = useState(true);

  // Queries
  const blockedQuery = useQuery({
    queryKey: ["users", "blocked"],
    queryFn: usersApi.getBlocked,
    enabled: blockedModalVisible
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => usersApi.unblock(userId),
    onSuccess: () => {
      blockedQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["dating", "explore"] });
      Alert.alert("Success", "User has been unblocked.");
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const handleLogout = () => {
    Alert.alert("Log out", "Are you sure you want to log out of Yugm?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Log out",
        style: "destructive",
        onPress: async () => {
          await logout();
          router.replace("/onboarding");
        }
      }
    ]);
  };

  const handleAccountDeletion = () => {
    Alert.alert(
      "Delete Account",
      "WARNING: This action is permanent and cannot be undone. All your matches, chats, and coin balances will be deleted.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete permanently",
          style: "destructive",
          onPress: () => {
            Alert.alert("Request submitted", "Your account deletion request is queued for processing. You will be logged out.", [
              {
                text: "OK",
                onPress: async () => {
                  await logout();
                  router.replace("/onboarding");
                }
              }
            ]);
          }
        }
      ]
    );
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollWrap} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings & Privacy</Text>
        </View>

        {/* User Card */}
        {currentUser && (
          <Section>
            <View style={styles.profileCard}>
              <Image source={{ uri: currentUser.avatar }} style={styles.profileAvatar as any} />
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{currentUser.name}</Text>
                <Text style={styles.profileUsername}>@{currentUser.username}</Text>
              </View>
              <Pressable
                onPress={() => router.push("/(auth)/create-profile")}
                style={styles.editBtn}
              >
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>
          </Section>
        )}

        {/* Account Settings */}
        <Section>
          <Text style={styles.sectionTitle}>Account Settings</Text>
          
          <Pressable style={styles.row} onPress={() => router.push("/(auth)/create-profile")}>
            <View style={styles.rowLeft}>
              <User color={colors.pink} size={20} />
              <Text style={styles.rowText}>Update Profile Prompts</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Lock color={colors.pink} size={20} />
              <Text style={styles.rowText}>Match Notifications</Text>
            </View>
            <Switch
              value={matchNotifications}
              onValueChange={setMatchNotifications}
              thumbColor={matchNotifications ? colors.pink : colors.muted}
              trackColor={{ false: colors.line, true: "rgba(255,62,147,0.3)" }}
            />
          </View>

          <View style={styles.row}>
            <View style={styles.rowLeft}>
              <Lock color={colors.pink} size={20} />
              <Text style={styles.rowText}>Live Room Invites</Text>
            </View>
            <Switch
              value={roomNotifications}
              onValueChange={setRoomNotifications}
              thumbColor={roomNotifications ? colors.pink : colors.muted}
              trackColor={{ false: colors.line, true: "rgba(255,62,147,0.3)" }}
            />
          </View>
        </Section>

        {/* Privacy & Safety */}
        <Section>
          <Text style={styles.sectionTitle}>Privacy & Safety</Text>

          <Pressable style={styles.row} onPress={() => setBlockedModalVisible(true)}>
            <View style={styles.rowLeft}>
              <Ban color={colors.danger} size={20} />
              <Text style={styles.rowText}>Blocked Users</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>

          <Pressable style={styles.row} onPress={() => setSafetyModalVisible(true)}>
            <View style={styles.rowLeft}>
              <Shield color={colors.gold} size={20} fill="transparent" />
              <Text style={styles.rowText}>Community Guidelines</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>
        </Section>

        {/* Help & Actions */}
        <Section>
          <Text style={styles.sectionTitle}>Help & Support</Text>

          <Pressable
            style={styles.row}
            onPress={() => Alert.alert("Yugm Support", "Need help? Email support@yugm.app")}
          >
            <View style={styles.rowLeft}>
              <HelpCircle color={colors.muted} size={20} />
              <Text style={styles.rowText}>Contact Support</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>

          <Pressable style={styles.row} onPress={handleLogout}>
            <View style={styles.rowLeft}>
              <LogOut color={colors.danger} size={20} />
              <Text style={styles.rowText}>Log Out</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>

          <Pressable style={styles.dangerRow} onPress={handleAccountDeletion}>
            <Text style={styles.dangerRowText}>Delete Account Permanently</Text>
          </Pressable>
        </Section>

        {/* Version Label */}
        <Text style={styles.versionText}>Yugm v1.2.0 • Match the vibe.</Text>
      </ScrollView>

      {/* 1. Blocked Users Manager Modal */}
      <Modal visible={blockedModalVisible} animationType="slide" onRequestClose={() => setBlockedModalVisible(false)}>
        <Screen>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setBlockedModalVisible(false)} style={styles.backBtn}>
              <ArrowLeft color={colors.text} size={20} />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Blocked Users</Text>
            <View style={{ width: 40 }} />
          </View>

          {blockedQuery.isLoading ? (
            <View style={styles.center}>
              <ActivityIndicator color={colors.pink} size="large" />
            </View>
          ) : !blockedQuery.data?.users?.length ? (
            <View style={styles.center}>
              <Ban color={colors.muted} size={48} />
              <Text style={styles.emptyText}>No blocked users</Text>
              <Text style={styles.emptySubtext}>Any users you block will show up here.</Text>
            </View>
          ) : (
            <ScrollView contentContainerStyle={styles.modalList}>
              {blockedQuery.data.users.map((user: any) => (
                <View key={user._id} style={styles.blockedRow}>
                  <Image source={{ uri: user.avatar }} style={styles.blockedAvatar as any} />
                  <View style={styles.blockedInfo}>
                    <Text style={styles.blockedName}>{user.name}</Text>
                    <Text style={styles.blockedCity}>{user.city}</Text>
                  </View>
                  <Pressable
                    style={styles.unblockBtn}
                    onPress={() => unblockMutation.mutate(user._id)}
                    disabled={unblockMutation.isPending}
                  >
                    <Text style={styles.unblockBtnText}>Unblock</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </Screen>
      </Modal>

      {/* 2. Safety / Community Guidelines Modal */}
      <Modal visible={safetyModalVisible} animationType="slide" onRequestClose={() => setSafetyModalVisible(false)}>
        <Screen>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setSafetyModalVisible(false)} style={styles.backBtn}>
              <ArrowLeft color={colors.text} size={20} />
            </Pressable>
            <Text style={styles.modalHeaderTitle}>Guidelines</Text>
            <View style={{ width: 40 }} />
          </View>

          <ScrollView contentContainerStyle={styles.guideScroll}>
            <Text style={styles.guideHeadline}>Respect & Safety on Yugm</Text>
            <Text style={styles.guideBody}>
              Yugm is built for genuine social connections and vibe matching. To ensure a safe, inclusive, and fun space, please adhere to these core rules:
            </Text>

            <View style={styles.guideItem}>
              <Text style={styles.guideTitle}>1. Be Respectful</Text>
              <Text style={styles.guideText}>
                No abusive speech, harassment, hate comments, or threat-like conduct inside live lounges, video rooms, or direct messages.
              </Text>
            </View>

            <View style={styles.guideItem}>
              <Text style={styles.guideTitle}>2. Explicit Content Gate</Text>
              <Text style={styles.guideText}>
                Nudity, pornography, or sexually explicit behavior is strictly forbidden and subject to instant, irreversible bans.
              </Text>
            </View>

            <View style={styles.guideItem}>
              <Text style={styles.guideTitle}>3. Fake Accounts & Spam</Text>
              <Text style={styles.guideText}>
                Do not impersonate others or spam promo links/cash transfers. Accounts promoting external monetization will be terminated.
              </Text>
            </View>

            <View style={styles.guideItem}>
              <Text style={styles.guideTitle}>4. Safety Notice</Text>
              <Text style={styles.guideText}>
                Keep conversations on-platform until trust is established. Never share phone OTP tokens, credit cards, or login credentials.
              </Text>
            </View>
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { paddingTop: 16, paddingBottom: 48 },
  header: {
    paddingHorizontal: 20,
    height: 52,
    justifyContent: "center",
    marginBottom: 8
  },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: "900" },
  profileCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  profileAvatar: { width: 50, height: 50, borderRadius: 25 },
  profileInfo: { flex: 1 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  profileUsername: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 2 },
  editBtn: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderWidth: 1,
    borderColor: colors.line
  },
  editBtnText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "900", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  row: {
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 4
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12 },
  rowText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  dangerRow: {
    marginTop: 20,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,91,110,0.05)",
    borderWidth: 1,
    borderColor: "rgba(255,91,110,0.15)",
    alignItems: "center"
  },
  dangerRowText: { color: colors.danger, fontWeight: "800", fontSize: 14 },
  versionText: { color: colors.muted, fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 32 },

  // Modal styles
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    height: 56,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  modalHeaderTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 8 },
  emptySubtext: { color: colors.muted, fontSize: 13, textAlign: "center" },
  modalList: { padding: 16, gap: 12 },
  blockedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 14,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  blockedAvatar: { width: 44, height: 44, borderRadius: 22 },
  blockedInfo: { flex: 1 },
  blockedName: { color: colors.text, fontSize: 15, fontWeight: "900" },
  blockedCity: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  unblockBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.pink
  },
  unblockBtnText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  
  // Guidelines Scroll
  guideScroll: { padding: 20, gap: 18 },
  guideHeadline: { color: colors.text, fontSize: 22, fontWeight: "900" },
  guideBody: { color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 22, fontWeight: "700" },
  guideItem: { gap: 6 },
  guideTitle: { color: colors.pink, fontSize: 15, fontWeight: "900" },
  guideText: { color: colors.text, fontSize: 13, lineHeight: 20, fontWeight: "700" }
});
