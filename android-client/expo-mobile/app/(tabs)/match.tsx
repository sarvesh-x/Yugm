import { useState, useCallback } from "react";
import { Alert, StyleSheet, Text, View, Image, Pressable, ActivityIndicator, Modal } from "react-native";
import * as Haptics from "expo-haptics";
import { router, useFocusEffect } from "expo-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LinearGradient } from "expo-linear-gradient";
import { Heart, X, Star, Sparkles, MessageCircle, Compass, ShieldAlert } from "lucide-react-native";
import { datingApi, usersApi } from "@/lib/api";
import { Screen, Section } from "@/components/Screen";
import { useAuthStore } from "@/store/auth";
import { colors, gradients } from "@/theme/colors";

export default function MatchSwipe() {
  const currentUser = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Modal Match States
  const [matchModalVisible, setMatchModalVisible] = useState(false);
  const [matchedPartner, setMatchedPartner] = useState<any>(null);
  const [actionPending, setActionPending] = useState(false);

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["dating", "explore"],
    queryFn: datingApi.explore,
    staleTime: 30000,
    gcTime: 60000
  });

  useFocusEffect(
    useCallback(() => {
      refetch();
    }, [])
  );

  const candidates = data?.candidates ?? [];
  const topCard = candidates[0];

  const handleSwipe = async (type: "LIKE" | "SUPER_LIKE" | "PASS") => {
    if (!topCard || actionPending) return;
    const candidate = topCard;
    setActionPending(true);
    queryClient.setQueryData(["dating", "explore"], (old: any) => ({
      ...old,
      candidates: (old?.candidates ?? []).filter((item: any) => item.id !== candidate.id)
    }));

    try {
      await Haptics.impactAsync(type === "SUPER_LIKE" ? Haptics.ImpactFeedbackStyle.Heavy : Haptics.ImpactFeedbackStyle.Light);
      if (type === "PASS") {
        await datingApi.pass(candidate.id);
      } else {
        const res = await datingApi.like(candidate.id, type);
        if (res.isMatch) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          setMatchedPartner(candidate);
          setMatchModalVisible(true);
        }
      }
    } catch (err: any) {
      queryClient.setQueryData(["dating", "explore"], (old: any) => ({
        ...old,
        candidates: [candidate, ...(old?.candidates ?? []).filter((item: any) => item.id !== candidate.id)]
      }));
      Alert.alert("Swipe Action Failed", err.message);
    } finally {
      setActionPending(false);
    }
  };

  const handleReport = () => {
    if (!topCard) return;
    Alert.alert("Report user", "Report this profile for community guidelines violations?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Report",
        style: "destructive",
        onPress: async () => {
          try {
            await usersApi.report(topCard.id, "INAPPROPRIATE_PROFILE");
            queryClient.setQueryData(["dating", "explore"], (old: any) => ({
              ...old,
              candidates: (old?.candidates ?? []).filter((item: any) => item.id !== topCard.id)
            }));
            Alert.alert("Report submitted", "Thank you. Our safety team will review this profile.");
          } catch (error: any) {
            Alert.alert("Report failed", error?.message ?? "Please try again.");
          }
        }
      }
    ]);
  };

  return (
    <Screen>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Vibe Discovery</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Report this profile" style={styles.reportBtn} onPress={handleReport} disabled={!topCard || actionPending}>
            <ShieldAlert color={topCard ? colors.danger : colors.muted} size={20} />
          </Pressable>
        </View>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={colors.pink} size="large" />
            <Text style={styles.loadingText}>Fetching nearby energies...</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.errorText}>Could not load matches.</Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Retry</Text>
            </Pressable>
          </View>
        ) : !topCard ? (
          <View style={styles.emptyWrap}>
            <View style={styles.emptyIconCircle}>
              <Compass color={colors.pink} size={48} />
            </View>
            <Text style={styles.emptyTitle}>End of the vibe feed</Text>
            <Text style={styles.emptySubtitle}>
              You've swiped on everyone nearby. Try updating your tags or broaden your settings!
            </Text>
            <Pressable onPress={() => refetch()} style={styles.retryBtn}>
              <Text style={styles.retryText}>Refresh Feed</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cardContainer}>
            {/* Vibe Card */}
            <Pressable
              style={styles.card}
              onPress={() => router.push({ pathname: "/profile/[id]", params: { id: topCard.id } })}
            >
              <Image source={{ uri: topCard.avatar }} style={styles.cardImg as any} />
              <LinearGradient
                colors={["transparent", "rgba(5,7,19,0.95)"]}
                style={styles.overlay}
              >
                <View style={styles.details}>
                  <View style={styles.nameRow}>
                    <Text style={styles.name}>{topCard.name}, {topCard.age}</Text>
                    <View style={styles.vibeBadge}>
                      <Text style={styles.vibeText}>{topCard.vibeScore}% Vibe</Text>
                    </View>
                  </View>

                  <Text style={styles.location}>{topCard.city}</Text>

                  {topCard.vibeLine && (
                    <Text style={styles.tagline}>“{topCard.vibeLine}”</Text>
                  )}

                  <View style={styles.interestsRow}>
                    {topCard.interests?.slice(0, 4).map((interest: string) => (
                      <View key={interest} style={styles.interestTag}>
                        <Text style={styles.interestTagText}>{interest}</Text>
                      </View>
                    ))}
                  </View>

                  <Text style={styles.bio} numberOfLines={2}>{topCard.bio}</Text>
                </View>
              </LinearGradient>
            </Pressable>

            {/* Action Row */}
            <View style={styles.actionRow}>
              <Pressable accessibilityRole="button" accessibilityLabel="Pass" disabled={actionPending} style={[styles.actionCircle, styles.passCircle, actionPending && styles.disabled]} onPress={() => handleSwipe("PASS")}>
                <X color={colors.danger} size={28} strokeWidth={3} />
              </Pressable>

              <Pressable accessibilityRole="button" accessibilityLabel="Send a super vibe" disabled={actionPending} style={[styles.actionCircle, styles.superCircle, actionPending && styles.disabled]} onPress={() => handleSwipe("SUPER_LIKE")}>
                <Star color={colors.gold} size={24} fill={colors.gold} />
              </Pressable>

              <Pressable accessibilityRole="button" accessibilityLabel="Like this profile" disabled={actionPending} style={[styles.actionCircle, styles.likeCircle, actionPending && styles.disabled]} onPress={() => handleSwipe("LIKE")}>
                <Heart color={colors.success} size={28} fill={colors.success} />
              </Pressable>
            </View>
          </View>
        )}

        {/* 6. Match Screen Overlay Modal */}
        <Modal
          visible={matchModalVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setMatchModalVisible(false)}
        >
          <View style={styles.modalBg}>
            <LinearGradient
              colors={[colors.ink, "#150D32", colors.ink]}
              style={styles.modalContent}
            >
              <Sparkles color={colors.gold} size={48} fill={colors.gold} />
              
              <Text style={styles.matchHeadline}>It's a Yugm!</Text>
              <Text style={styles.matchSubheadline}>Your vibrations match each other's frequency.</Text>

              {/* Avatar Frames */}
              <View style={styles.avatarMatchContainer}>
                <View style={[styles.matchAvatarFrame, styles.leftAvatar]}>
                  <Image source={{ uri: currentUser?.avatar || "https://images.unsplash.com/photo-1500648767791-00dcc994a43e" }} style={styles.matchAvatarImg as any} />
                </View>
                <View style={[styles.matchAvatarFrame, styles.rightAvatar]}>
                  <Image source={{ uri: matchedPartner?.avatar }} style={styles.matchAvatarImg as any} />
                </View>
              </View>

              <Text style={styles.matchName}>You and {matchedPartner?.name}</Text>

              {/* CTAs */}
              <View style={styles.modalActions}>
                <Pressable
                  style={styles.sayHiBtn}
                  onPress={() => {
                    setMatchModalVisible(false);
                    if (matchedPartner) {
                      router.push({ pathname: "/chat/[userId]", params: { userId: matchedPartner.id } });
                    }
                  }}
                >
                  <LinearGradient colors={gradients.fire} style={styles.sayHiGradient}>
                    <MessageCircle color={colors.text} size={20} fill={colors.text} />
                    <Text style={styles.sayHiText}>Say Hi</Text>
                  </LinearGradient>
                </Pressable>

                <Pressable
                  style={styles.keepExploringBtn}
                  onPress={() => setMatchModalVisible(false)}
                >
                  <Text style={styles.keepExploringText}>Keep Exploring</Text>
                </Pressable>
              </View>
            </LinearGradient>
          </View>
        </Modal>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingBottom: 16 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    height: 52,
    borderBottomWidth: 1,
    borderBottomColor: colors.line
  },
  headerTitle: { color: colors.text, fontSize: 20, fontWeight: "900" },
  reportBtn: { padding: 6 },
  loadingWrap: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  loadingText: { color: colors.muted, fontWeight: "700" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14 },
  errorText: { color: colors.danger, fontWeight: "800", fontSize: 16 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 20,
    backgroundColor: colors.panel,
    borderWidth: 1,
    borderColor: colors.line
  },
  retryText: { color: colors.text, fontWeight: "800" },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40, gap: 14 },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: "rgba(255,62,147,0.12)",
    alignItems: "center",
    justifyContent: "center"
  },
  emptyTitle: { color: colors.text, fontSize: 22, fontWeight: "900" },
  emptySubtitle: { color: colors.muted, fontSize: 14, textAlign: "center", lineHeight: 20, marginBottom: 10 },
  cardContainer: { flex: 1, paddingHorizontal: 20, marginTop: 14, justifyContent: "space-between" },
  card: { flex: 1, borderRadius: 20, overflow: "hidden", borderWidth: 1, borderColor: colors.line },
  cardImg: { width: "100%", height: "100%" },
  overlay: { position: "absolute", left: 0, right: 0, bottom: 0, top: 0, justifyContent: "flex-end" },
  details: { padding: 20 },
  nameRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  name: { color: colors.text, fontSize: 28, fontWeight: "900" },
  vibeBadge: { backgroundColor: "rgba(255,62,147,0.22)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12, borderWidth: 1, borderColor: colors.pink },
  vibeText: { color: colors.text, fontSize: 13, fontWeight: "900" },
  location: { color: colors.muted, fontSize: 15, fontWeight: "700", marginTop: 4 },
  tagline: { color: colors.text, fontSize: 15, fontStyle: "italic", marginVertical: 10, fontWeight: "800" },
  interestsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginVertical: 8 },
  interestTag: { backgroundColor: "rgba(255,255,255,0.08)", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 12 },
  interestTagText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  bio: { color: "rgba(255,255,255,0.8)", fontSize: 14, lineHeight: 20, marginTop: 4, fontWeight: "700" },
  actionRow: { flexDirection: "row", justifyContent: "center", gap: 20, marginVertical: 18, alignItems: "center" },
  actionCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.ink2,
    borderWidth: 1,
    borderColor: colors.line,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 6,
    elevation: 4
  },
  passCircle: { borderColor: "rgba(255,91,110,0.3)" },
  disabled: { opacity: 0.5 },
  superCircle: { width: 52, height: 52, borderRadius: 26, borderColor: "rgba(246,180,75,0.3)" },
  likeCircle: { borderColor: "rgba(50,213,131,0.3)" },
  
  // Modal Match Styles
  modalBg: { flex: 1, backgroundColor: "rgba(5,7,19,0.95)", alignItems: "center", justifyContent: "center" },
  modalContent: { width: "88%", borderRadius: 24, padding: 28, alignItems: "center", borderWidth: 1, borderColor: colors.line },
  matchHeadline: { color: colors.text, fontSize: 36, fontWeight: "900", marginTop: 14 },
  matchSubheadline: { color: colors.muted, fontSize: 14, textAlign: "center", marginVertical: 8, paddingHorizontal: 10, fontWeight: "700" },
  avatarMatchContainer: { flexDirection: "row", height: 130, width: "100%", justifyContent: "center", alignItems: "center", marginVertical: 20 },
  matchAvatarFrame: { width: 100, height: 100, borderRadius: 50, borderWidth: 3, borderColor: colors.pink, overflow: "hidden", position: "absolute" },
  matchAvatarImg: { width: "100%", height: "100%" },
  leftAvatar: { left: "20%", zIndex: 2 },
  rightAvatar: { right: "20%", zIndex: 1, borderColor: colors.purple },
  matchName: { color: colors.text, fontSize: 18, fontWeight: "900", marginBottom: 20 },
  modalActions: { width: "100%", gap: 12 },
  sayHiBtn: { height: 56, borderRadius: 12, overflow: "hidden" },
  sayHiGradient: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  sayHiText: { color: colors.text, fontWeight: "900", fontSize: 16 },
  keepExploringBtn: { height: 56, borderRadius: 12, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  keepExploringText: { color: colors.text, fontWeight: "800", fontSize: 16 }
});
