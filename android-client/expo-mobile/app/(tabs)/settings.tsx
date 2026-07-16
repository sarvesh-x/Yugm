import { useState } from "react";
import type { ReactNode } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, Share, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { router } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Ban, Bell, ChevronRight, Copy, FileText, Gift, HelpCircle, Info, Lock, LogOut, RefreshCw, Send, Share2, Shield, User, Users } from "lucide-react-native";
import { Screen, Section } from "@/components/Screen";
import { experienceApi, referralsApi, usersApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

const docs = {
  about: {
    title: "About Yugm",
    body: "Yugm is a social voice, video, chat, dating, and community app built around live connection, private conversations, creator growth, gifts, and families."
  },
  terms: {
    title: "Terms of Use",
    body: "Use Yugm respectfully. Do not harass, impersonate, exploit payment systems, share illegal content, or attempt to bypass safety controls. Accounts may be restricted when platform rules are violated."
  },
  privacy: {
    title: "Privacy Policy",
    body: "Yugm uses profile, room, chat, wallet, safety, and device data to run the service, protect users, process purchases, personalize recommendations, and respond to support requests."
  },
  guidelines: {
    title: "Community Guidelines",
    body: "Keep rooms and chats respectful. No hateful conduct, explicit abuse, spam, fake accounts, threats, or attempts to move unsafe activity off-platform. Report anything that feels wrong."
  }
};

export default function SettingsScreen() {
  const logout = useAuthStore((state) => state.logout);
  const currentUser = useAuthStore((state) => state.user);
  const queryClient = useQueryClient();

  const [blockedModalVisible, setBlockedModalVisible] = useState(false);
  const [notificationsVisible, setNotificationsVisible] = useState(false);
  const [feedbackVisible, setFeedbackVisible] = useState(false);
  const [docKey, setDocKey] = useState<keyof typeof docs | null>(null);
  const [feedbackSubject, setFeedbackSubject] = useState("");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [referralVisible, setReferralVisible] = useState(false);
  const [claimCode, setClaimCode] = useState("");

  const blockedQuery = useQuery({
    queryKey: ["users", "blocked"],
    queryFn: usersApi.getBlocked,
    enabled: blockedModalVisible
  });

  const notificationQuery = useQuery({
    queryKey: ["experience", "notification-preferences"],
    queryFn: experienceApi.notificationPreferences,
    staleTime: 60000,
    gcTime: 120000
  });

  const updateNotifications = useMutation({
    mutationFn: (preferences: Record<string, boolean>) => experienceApi.updateNotificationPreferences(preferences),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["experience", "notification-preferences"] }),
    onError: (err: any) => Alert.alert("Notification update failed", err?.message ?? "Please try again.")
  });

  const unblockMutation = useMutation({
    mutationFn: (userId: string) => usersApi.unblock(userId),
    onSuccess: () => {
      blockedQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ["dating", "explore"] });
      Alert.alert("Unblocked", "User has been removed from your blocked list.");
    },
    onError: (err: any) => Alert.alert("Error", err.message)
  });

  const feedbackMutation = useMutation({
    mutationFn: () => usersApi.sendFeedback({ category: "OTHER", subject: feedbackSubject.trim(), message: feedbackMessage.trim() }),
    onSuccess: () => {
      setFeedbackSubject("");
      setFeedbackMessage("");
      setFeedbackVisible(false);
      Alert.alert("Feedback sent", "Thanks. The support team can now review it.");
    },
    onError: (err: any) => Alert.alert("Could not send feedback", err?.message ?? "Please try again.")
  });

  const referralCodeQuery = useQuery({
    queryKey: ["referrals", "code"],
    queryFn: referralsApi.getCode,
    enabled: referralVisible
  });

  const referralStatsQuery = useQuery({
    queryKey: ["referrals", "stats"],
    queryFn: referralsApi.stats,
    enabled: referralVisible
  });

  const claimMutation = useMutation({
    mutationFn: () => referralsApi.claim({ code: claimCode.trim() }),
    onSuccess: (data) => {
      setClaimCode("");
      Alert.alert("Code claimed!", data.reward?.message ?? "You earned a reward.");
      referralStatsQuery.refetch();
    },
    onError: (err: any) => Alert.alert("Could not claim code", err?.message ?? "Please try again.")
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
    Alert.alert("Delete Account", "This request is permanent once processed. Support will review and queue deletion.", [
      { text: "Cancel", style: "cancel" },
      { text: "Request deletion", style: "destructive", onPress: () => Alert.alert("Request submitted", "Your account deletion request has been queued.") }
    ]);
  };

  const handlePreferenceToggle = (key: string, value: boolean) => {
    const current = notificationQuery.data?.preferences ?? {};
    updateNotifications.mutate({ ...current, [key]: value });
  };

  const doc = docKey ? docs[docKey] : null;
  const preferences = notificationQuery.data?.preferences ?? {};

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.scrollWrap} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings & Privacy</Text>
          <Text style={styles.headerSubtitle}>Account, safety, notifications, legal, and support controls.</Text>
        </View>

        {currentUser && (
          <Section>
            <View style={styles.profileCard}>
              {!!currentUser.avatar && <Image source={{ uri: currentUser.avatar }} style={styles.profileAvatar as any} />}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{currentUser.name}</Text>
                <Text style={styles.profileUsername}>@{currentUser.username}</Text>
              </View>
              <Pressable onPress={() => router.push("/(auth)/create-profile")} style={styles.editBtn}>
                <Text style={styles.editBtnText}>Edit</Text>
              </Pressable>
            </View>
          </Section>
        )}

        <SettingsGroup title="Account">
          <SettingsRow icon={<User color={colors.pink} size={20} />} title="Detailed profile" onPress={() => router.push("/(auth)/create-profile")} />
          <SettingsRow icon={<Users color={colors.gold} size={20} />} title="Clan & family" onPress={() => router.push("/(tabs)/clan")} />
          <SettingsRow icon={<Bell color={colors.pink} size={20} />} title="Notification settings" onPress={() => setNotificationsVisible(true)} />
          <SettingsRow icon={<Gift color={colors.saffron} size={20} />} title="Referral & Invite" onPress={() => setReferralVisible(true)} />
        </SettingsGroup>

        <SettingsGroup title="Privacy & Safety">
          <SettingsRow icon={<Ban color={colors.danger} size={20} />} title="Blocked list" onPress={() => setBlockedModalVisible(true)} />
          <SettingsRow icon={<Shield color={colors.gold} size={20} />} title="Community guidelines" onPress={() => setDocKey("guidelines")} />
          <SettingsRow icon={<Lock color={colors.pink} size={20} />} title="Privacy policy" onPress={() => setDocKey("privacy")} />
        </SettingsGroup>

        <SettingsGroup title="Help & Legal">
          <SettingsRow icon={<HelpCircle color={colors.muted} size={20} />} title="Help and feedback" onPress={() => setFeedbackVisible(true)} />
          <SettingsRow icon={<Info color={colors.gold} size={20} />} title="About" onPress={() => setDocKey("about")} />
          <SettingsRow icon={<FileText color={colors.pink} size={20} />} title="Terms of use" onPress={() => setDocKey("terms")} />
          <SettingsRow icon={<RefreshCw color={colors.muted} size={20} />} title="Check for update" onPress={() => Alert.alert("Yugm is up to date", "Version 1.2.0 is the latest version available for this build.")} />
        </SettingsGroup>

        <Section>
          <Pressable style={styles.row} onPress={handleLogout}>
            <View style={styles.rowLeft}>
              <LogOut color={colors.danger} size={20} />
              <Text style={styles.rowText}>Log out</Text>
            </View>
            <ChevronRight color={colors.muted} size={18} />
          </Pressable>
          <Pressable style={styles.dangerRow} onPress={handleAccountDeletion}>
            <Text style={styles.dangerRowText}>Delete Account Permanently</Text>
          </Pressable>
        </Section>

        <Text style={styles.versionText}>Yugm v1.2.0 / Match the vibe.</Text>
      </ScrollView>

      <Modal visible={referralVisible} animationType="slide" onRequestClose={() => setReferralVisible(false)}>
        <Screen>
          <ModalHeader title="Referral & Invite" onClose={() => setReferralVisible(false)} />
          <ScrollView contentContainerStyle={styles.referralBody}>
            {referralCodeQuery.isLoading ? (
              <View style={styles.center}><ActivityIndicator color={colors.gold} size="large" /></View>
            ) : (
              <>
                <View style={styles.referralCodeCard}>
                  <Text style={styles.referralSectionLabel}>Your referral code</Text>
                  <View style={styles.referralCodeRow}>
                    <Text style={styles.referralCodeText}>{referralCodeQuery.data?.code ?? "------"}</Text>
                    <Pressable
                      style={styles.referralIconBtn}
                      onPress={async () => {
                        if (!referralCodeQuery.data?.code) return;
                        await Clipboard.setStringAsync(referralCodeQuery.data.code);
                        Alert.alert("Copied", "Referral code copied to clipboard.");
                      }}
                    >
                      <Copy color={colors.gold} size={18} />
                    </Pressable>
                  </View>
                </View>

                <View style={styles.referralStatsRow}>
                  <View style={styles.referralStatCard}>
                    <Text style={styles.referralStatValue}>{referralStatsQuery.data?.totalReferred ?? 0}</Text>
                    <Text style={styles.referralStatLabel}>Referred</Text>
                  </View>
                  <View style={styles.referralStatCard}>
                    <Text style={styles.referralStatValue}>{referralStatsQuery.data?.coinsEarned ?? 0}</Text>
                    <Text style={styles.referralStatLabel}>Coins earned</Text>
                  </View>
                </View>

                <Pressable
                  style={styles.referralShareBtn}
                  onPress={async () => {
                    const code = referralCodeQuery.data?.code;
                    if (!code) return;
                    try {
                      await Share.share({ message: `Join Yugm and use my referral code ${code} to get started! 🎉` });
                    } catch {}
                  }}
                >
                  <Share2 color={colors.text} size={16} />
                  <Text style={styles.referralShareBtnText}>Share your code</Text>
                </Pressable>

                <View style={styles.claimSection}>
                  <Text style={styles.referralSectionLabel}>Have a code? Enter it below</Text>
                  <View style={styles.claimRow}>
                    <TextInput
                      value={claimCode}
                      onChangeText={setClaimCode}
                      placeholder="Enter referral code"
                      placeholderTextColor={colors.muted}
                      style={[styles.input, styles.claimInput]}
                      autoCapitalize="characters"
                    />
                    <Pressable
                      style={[styles.claimBtn, (!claimCode.trim() || claimMutation.isPending) && styles.disabled]}
                      onPress={() => claimMutation.mutate()}
                      disabled={!claimCode.trim() || claimMutation.isPending}
                    >
                      <Text style={styles.claimBtnText}>{claimMutation.isPending ? "..." : "Claim"}</Text>
                    </Pressable>
                  </View>
                </View>
              </>
            )}
          </ScrollView>
        </Screen>
      </Modal>

      <Modal visible={blockedModalVisible} animationType="slide" onRequestClose={() => setBlockedModalVisible(false)}>
        <Screen>
          <ModalHeader title="Blocked Users" onClose={() => setBlockedModalVisible(false)} />
          {blockedQuery.isLoading ? (
            <View style={styles.center}><ActivityIndicator color={colors.pink} size="large" /></View>
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
                  {!!user.avatar && <Image source={{ uri: user.avatar }} style={styles.blockedAvatar as any} />}
                  <View style={styles.blockedInfo}>
                    <Text style={styles.blockedName}>{user.name}</Text>
                    <Text style={styles.blockedCity}>{user.city ?? user.username}</Text>
                  </View>
                  <Pressable style={styles.unblockBtn} onPress={() => unblockMutation.mutate(user._id)} disabled={unblockMutation.isPending}>
                    <Text style={styles.unblockBtnText}>Unblock</Text>
                  </Pressable>
                </View>
              ))}
            </ScrollView>
          )}
        </Screen>
      </Modal>

      <Modal visible={notificationsVisible} animationType="slide" onRequestClose={() => setNotificationsVisible(false)}>
        <Screen>
          <ModalHeader title="Notifications" onClose={() => setNotificationsVisible(false)} />
          <ScrollView contentContainerStyle={styles.modalList}>
            {notificationQuery.isLoading ? (
              <ActivityIndicator color={colors.gold} />
            ) : (
              [
                ["messages", "Direct messages"],
                ["roomInvites", "Room invites"],
                ["gifts", "Gifts and wallet"],
                ["follows", "Followers"],
                ["hostGoingLive", "Hosts going live"],
                ["safety", "Safety alerts"],
                ["marketing", "Product updates"]
              ].map(([key, title]) => (
                <View key={key} style={styles.toggleRow}>
                  <View>
                    <Text style={styles.toggleTitle}>{title}</Text>
                    <Text style={styles.toggleSub}>{preferences[key] ? "Enabled" : "Muted"}</Text>
                  </View>
                  <Switch
                    value={Boolean(preferences[key])}
                    onValueChange={(value) => handlePreferenceToggle(key, value)}
                    disabled={updateNotifications.isPending}
                    thumbColor={preferences[key] ? colors.pink : colors.muted}
                    trackColor={{ false: colors.line, true: "rgba(255,62,147,0.3)" }}
                  />
                </View>
              ))
            )}
          </ScrollView>
        </Screen>
      </Modal>

      <Modal visible={feedbackVisible} animationType="slide" onRequestClose={() => setFeedbackVisible(false)}>
        <Screen>
          <ModalHeader title="Help & Feedback" onClose={() => setFeedbackVisible(false)} />
          <ScrollView contentContainerStyle={styles.feedbackBody}>
            <Text style={styles.feedbackIntro}>Tell us what broke, what is confusing, or what you want Yugm to improve next.</Text>
            <TextInput value={feedbackSubject} onChangeText={setFeedbackSubject} placeholder="Subject" placeholderTextColor={colors.muted} style={styles.input} />
            <TextInput
              value={feedbackMessage}
              onChangeText={setFeedbackMessage}
              placeholder="Write your feedback"
              placeholderTextColor={colors.muted}
              style={[styles.input, styles.textArea]}
              multiline
            />
            <Pressable
              style={[styles.sendBtn, (!feedbackSubject.trim() || !feedbackMessage.trim() || feedbackMutation.isPending) && styles.disabled]}
              onPress={() => feedbackMutation.mutate()}
              disabled={!feedbackSubject.trim() || !feedbackMessage.trim() || feedbackMutation.isPending}
            >
              <Send color={colors.text} size={16} />
              <Text style={styles.sendBtnText}>{feedbackMutation.isPending ? "Sending..." : "Send feedback"}</Text>
            </Pressable>
          </ScrollView>
        </Screen>
      </Modal>

      <Modal visible={!!doc} animationType="slide" onRequestClose={() => setDocKey(null)}>
        <Screen>
          <ModalHeader title={doc?.title ?? ""} onClose={() => setDocKey(null)} />
          <ScrollView contentContainerStyle={styles.docBody}>
            <Text style={styles.docTitle}>{doc?.title}</Text>
            <Text style={styles.docText}>{doc?.body}</Text>
          </ScrollView>
        </Screen>
      </Modal>
    </Screen>
  );
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Section>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </Section>
  );
}

function SettingsRow({ icon, title, onPress }: { icon: ReactNode; title: string; onPress: () => void }) {
  return (
    <Pressable style={styles.row} onPress={onPress}>
      <View style={styles.rowLeft}>
        {icon}
        <Text style={styles.rowText}>{title}</Text>
      </View>
      <ChevronRight color={colors.muted} size={18} />
    </Pressable>
  );
}

function ModalHeader({ title, onClose }: { title: string; onClose: () => void }) {
  return (
    <View style={styles.modalHeader}>
      <Pressable onPress={onClose} style={styles.backBtn}>
        <ArrowLeft color={colors.text} size={20} />
      </Pressable>
      <Text style={styles.modalHeaderTitle}>{title}</Text>
      <View style={{ width: 40 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  scrollWrap: { paddingTop: 16, paddingBottom: 48 },
  header: { paddingHorizontal: 20, marginBottom: 8 },
  headerTitle: { color: colors.text, fontSize: 24, fontWeight: "900" },
  headerSubtitle: { color: colors.muted, marginTop: 6, lineHeight: 20, fontWeight: "700" },
  profileCard: { flexDirection: "row", alignItems: "center", gap: 14, padding: 16, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  profileAvatar: { width: 50, height: 50, borderRadius: 25 },
  profileInfo: { flex: 1 },
  profileName: { color: colors.text, fontSize: 16, fontWeight: "900" },
  profileUsername: { color: colors.muted, fontSize: 13, fontWeight: "700", marginTop: 2 },
  editBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", borderWidth: 1, borderColor: colors.line },
  editBtnText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  sectionTitle: { color: colors.text, fontSize: 15, fontWeight: "900", marginBottom: 12, textTransform: "uppercase", letterSpacing: 0.5 },
  row: { minHeight: 54, flexDirection: "row", alignItems: "center", justifyContent: "space-between", borderBottomWidth: 1, borderColor: colors.line, paddingHorizontal: 4, gap: 12 },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  dangerRow: { marginTop: 20, paddingVertical: 14, borderRadius: 8, backgroundColor: "rgba(255,91,110,0.05)", borderWidth: 1, borderColor: "rgba(255,91,110,0.15)", alignItems: "center" },
  dangerRowText: { color: colors.danger, fontWeight: "800", fontSize: 14 },
  versionText: { color: colors.muted, fontSize: 12, fontWeight: "800", textAlign: "center", marginTop: 32 },
  modalHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, height: 56, borderBottomWidth: 1, borderBottomColor: colors.line },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)" },
  modalHeaderTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  emptyText: { color: colors.text, fontSize: 16, fontWeight: "900", marginTop: 8 },
  emptySubtext: { color: colors.muted, fontSize: 13, textAlign: "center" },
  modalList: { padding: 16, gap: 12 },
  blockedRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line },
  blockedAvatar: { width: 44, height: 44, borderRadius: 22 },
  blockedInfo: { flex: 1 },
  blockedName: { color: colors.text, fontSize: 15, fontWeight: "900" },
  blockedCity: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  unblockBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, backgroundColor: colors.pink },
  unblockBtnText: { color: colors.text, fontSize: 12, fontWeight: "900" },
  toggleRow: { minHeight: 62, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 12, flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  toggleTitle: { color: colors.text, fontWeight: "900" },
  toggleSub: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  feedbackBody: { padding: 20, gap: 12 },
  feedbackIntro: { color: colors.muted, lineHeight: 20, fontWeight: "700" },
  input: { minHeight: 46, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, color: colors.text, paddingHorizontal: 12, fontWeight: "800" },
  textArea: { minHeight: 120, paddingTop: 12, textAlignVertical: "top" },
  sendBtn: { height: 46, borderRadius: 8, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  sendBtnText: { color: colors.text, fontWeight: "900" },
  disabled: { opacity: 0.55 },
  docBody: { padding: 20 },
  docTitle: { color: colors.text, fontSize: 24, fontWeight: "900", marginBottom: 12 },
  docText: { color: colors.muted, fontSize: 15, lineHeight: 24, fontWeight: "700" },
  referralBody: { padding: 20, gap: 20 },
  referralCodeCard: { borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 16, gap: 10 },
  referralSectionLabel: { color: colors.muted, fontSize: 12, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  referralCodeRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  referralCodeText: { color: colors.text, fontSize: 28, fontWeight: "900", letterSpacing: 2, flex: 1 },
  referralIconBtn: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.06)", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  referralStatsRow: { flexDirection: "row", gap: 12 },
  referralStatCard: { flex: 1, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 16, alignItems: "center", gap: 4 },
  referralStatValue: { color: colors.gold, fontSize: 28, fontWeight: "900" },
  referralStatLabel: { color: colors.muted, fontSize: 12, fontWeight: "800" },
  referralShareBtn: { height: 46, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  referralShareBtnText: { color: colors.ink, fontWeight: "900" },
  claimSection: { gap: 10 },
  claimRow: { flexDirection: "row", gap: 10 },
  claimInput: { flex: 1 },
  claimBtn: { height: 46, paddingHorizontal: 20, borderRadius: 8, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center" },
  claimBtnText: { color: colors.text, fontWeight: "900" }
});
