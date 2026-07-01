import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, DoorOpen, Gift, Mic, MicOff, Radio, RefreshCcw, Send, ShieldAlert, Sparkles, Smile, UserPlus, UserX, Video, VolumeX } from "lucide-react-native";
import { reactionTypes, socketEvents } from "@yugm/shared";
import { ChatComposer } from "@/components/ChatComposer";
import { ControlButton } from "@/components/ControlButton";
import { GiftPanel } from "@/components/GiftPanel";
import { GlassCard } from "@/components/GlassCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Screen } from "@/components/Screen";
import { createLiveKitSession, type MediaSession } from "@/lib/livekit";
import { getSocket } from "@/lib/socket";
import { roomsApi, walletApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

const reactionLabels: Record<string, string> = { heart: "HEART", fire: "FIRE", laugh: "LAUGH", clap: "CLAP", wow: "WOW" };

export default function ActiveRoom() {
  const { id, type } = useLocalSearchParams<{ id: string; type?: "VOICE" | "VIDEO" }>();
  if (!id) return <Redirect href="/(tabs)" />;
  const roomId = id;
  const queryClient = useQueryClient();
  const currentUserId = useAuthStore((s) => s.user?._id ?? s.user?.id ?? "");
  const [mic, setMic] = useState(true);
  const [camera, setCamera] = useState(true);
  const [showGifts, setShowGifts] = useState(false);
  const [giftBurst, setGiftBurst] = useState("");
  const [reactionBursts, setReactionBursts] = useState<{ id: string; label: string }[]>([]);
  const [beauty, setBeauty] = useState(false);
  const [voiceFx, setVoiceFx] = useState(false);
  const [blurBg, setBlurBg] = useState(false);
  const [mediaState, setMediaState] = useState("Connecting media...");
  const mediaSession = useRef<MediaSession | null>(null);
  const mounted = useRef(true);
  useEffect(() => { return () => { mounted.current = false; }; }, []);

  const detail = useQuery({ queryKey: ["room", roomId], queryFn: () => roomsApi.detail(roomId), enabled: !!roomId, staleTime: 30000, gcTime: 60000 });
  const messages = useQuery({ queryKey: ["room", roomId, "messages"], queryFn: () => roomsApi.messages(roomId), enabled: !!roomId, staleTime: 30000, gcTime: 60000 });
  const activity = useQuery({ queryKey: ["room", roomId, "activity"], queryFn: () => roomsApi.activity(roomId), enabled: !!roomId, staleTime: 10000, gcTime: 30000 });
  const polls = useQuery({ queryKey: ["room", roomId, "polls"], queryFn: () => roomsApi.polls(roomId), enabled: !!roomId, staleTime: 10000, gcTime: 30000 });
  const missions = useQuery({ queryKey: ["room", roomId, "missions"], queryFn: () => roomsApi.missions(roomId), enabled: !!roomId, staleTime: 10000, gcTime: 30000 });
  const roomType = (detail.data?.room?.type ?? type ?? "VOICE") as "VOICE" | "VIDEO";
  const room = detail.data?.room;
  const hostId = typeof room?.hostId === "object" ? (room?.hostId as any)?._id ?? (room?.hostId as any)?.id : room?.hostId;
  const isHost = hostId === currentUserId;

  const join = useMutation({
    mutationFn: () => roomsApi.join(roomId),
    onError: (err: any) => setMediaState(err?.message ?? "Failed to join")
  });
  const leave = useMutation({
    mutationFn: () => roomsApi.leave(roomId),
    onSuccess: () => router.canGoBack() ? router.back() : router.replace("/(tabs)"),
  });
  const sendMessage = useMutation({
    mutationFn: (message: string) => roomsApi.message(roomId, message),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["room", roomId, "messages"] })
  });
  const requestSpeaker = useMutation({
    mutationFn: () => roomsApi.requestSpeaker(roomId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["room", roomId] }),
    onError: (err: any) => setGiftBurst(err?.message ?? "Speaker request failed")
  });
  const endRoom = useMutation({
    mutationFn: () => roomsApi.endRoom(roomId),
    onSuccess: () => router.canGoBack() ? router.back() : router.replace("/(tabs)"),
    onError: (err: any) => setGiftBurst(err?.message ?? "Failed to end room")
  });
  const muteUser = useMutation({
    mutationFn: (userId: string) => roomsApi.muteUser(roomId, userId),
    onError: (err: any) => setGiftBurst(err?.message ?? "Failed to mute user")
  });
  const removeUser = useMutation({
    mutationFn: (userId: string) => roomsApi.removeUser(roomId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["room", roomId] }),
    onError: (err: any) => setGiftBurst(err?.message ?? "Failed to remove user")
  });
  const approveSpeaker = useMutation({
    mutationFn: (userId: string) => roomsApi.approveSpeaker(roomId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["room", roomId] }),
    onError: (err: any) => setGiftBurst(err?.message ?? "Failed to approve speaker")
  });
  const rejectSpeaker = useMutation({
    mutationFn: (userId: string) => roomsApi.rejectSpeaker(roomId, userId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["room", roomId] }),
    onError: (err: any) => setGiftBurst(err?.message ?? "Failed to reject speaker")
  });
  const reportUser = useMutation({
    mutationFn: ({ targetUserId, reason }: { targetUserId: string; reason: string }) => roomsApi.reportUser(roomId, targetUserId, reason),
    onSuccess: () => setGiftBurst("Report submitted"),
    onError: (err: any) => setGiftBurst(err?.message ?? "Report failed")
  });
  const react = useMutation({
    mutationFn: (reaction: "heart" | "fire" | "laugh" | "clap" | "wow") => roomsApi.react(roomId, reaction),
    onSuccess: (_data, reaction) => pushReaction(reactionLabels[reaction] ?? reaction)
  });
  const createPoll = useMutation({
    mutationFn: ({ question, options }: { question: string; options: string[] }) => roomsApi.createPoll(roomId, question, options),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["room", roomId, "polls"] }),
    onError: (err: any) => setGiftBurst(err?.message ?? "Poll failed")
  });
  const votePoll = useMutation({
    mutationFn: ({ pollId, optionIndex }: { pollId: string; optionIndex: number }) => roomsApi.votePoll(roomId, pollId, optionIndex),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["room", roomId, "polls"] }),
    onError: (err: any) => setGiftBurst(err?.message ?? "Vote failed")
  });
  const inviteFriend = useMutation({
    mutationFn: (userId: string) => roomsApi.invite(roomId, userId),
    onSuccess: () => setGiftBurst("Invite sent"),
    onError: (err: any) => setGiftBurst(err?.message ?? "Invite failed")
  });
  const dmHost = useMutation({
    mutationFn: (receiverId?: string) => roomsApi.directMessage(roomId, "Loved this room. Let's continue after the live.", receiverId),
    onSuccess: () => setGiftBurst("Message sent to host"),
    onError: (err: any) => setGiftBurst(err?.message ?? "Message failed")
  });

  function pushReaction(label: string) {
    const id = `${Date.now()}-${Math.random()}`;
    setReactionBursts((items) => [...items.slice(-5), { id, label }]);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setTimeout(() => setReactionBursts((items) => items.filter((item) => item.id !== id)), 1800);
  }

  useEffect(() => {
    if (!roomId) return;
    let didJoinSocketRoom = false;
    const socket = getSocket();
    socket.connect();
    const handleChatMessage = () => queryClient.invalidateQueries({ queryKey: ["room", roomId, "messages"] });
    const handleGiftSend = (payload: any) => {
      setGiftBurst(`${payload?.gift?.name ?? "Gift"} sent`);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      queryClient.invalidateQueries({ queryKey: ["room", roomId, "missions"] });
      queryClient.invalidateQueries({ queryKey: ["room", roomId, "activity"] });
    };
    const handleReaction = (payload: any) => {
      pushReaction(reactionLabels[payload?.type] ?? "VIBE");
      queryClient.invalidateQueries({ queryKey: ["room", roomId, "missions"] });
    };
    const handleActivity = () => queryClient.invalidateQueries({ queryKey: ["room", roomId, "activity"] });
    const handlePoll = () => queryClient.invalidateQueries({ queryKey: ["room", roomId, "polls"] });
    socket.on(socketEvents.roomChatMessage, handleChatMessage);
    socket.on(socketEvents.roomGiftSend, handleGiftSend);
    socket.on(socketEvents.roomReactionSend, handleReaction);
    socket.on(socketEvents.roomActivityNew, handleActivity);
    socket.on(socketEvents.roomPollNew, handlePoll);
    socket.on(socketEvents.roomPollVote, handlePoll);
    roomsApi.join(roomId).then(
      () => {
        if (!mounted.current) return;
        socket.emit(socketEvents.roomJoin, { roomId });
        didJoinSocketRoom = true;
        createLiveKitSession(roomId).then(
          (session) => {
            mediaSession.current = session;
            if (mounted.current) setMediaState(`LiveKit ready: ${session.role.toLowerCase()} in ${session.roomName}`);
          },
          (error) => { if (mounted.current) setMediaState(error.message); }
        );
      },
      (error) => { if (mounted.current) setMediaState(error?.message ?? "Failed to join room"); }
    );
    return () => {
      if (didJoinSocketRoom) socket.emit(socketEvents.roomLeave, { roomId });
      mediaSession.current?.disconnect();
      mediaSession.current = null;
      socket.off(socketEvents.roomChatMessage, handleChatMessage);
      socket.off(socketEvents.roomGiftSend, handleGiftSend);
      socket.off(socketEvents.roomReactionSend, handleReaction);
      socket.off(socketEvents.roomActivityNew, handleActivity);
      socket.off(socketEvents.roomPollNew, handlePoll);
      socket.off(socketEvents.roomPollVote, handlePoll);
    };
  }, [roomId]);

  const speakers = useMemo(() => detail.data?.participants?.filter((item: any) => ["HOST", "SPEAKER", "MODERATOR"].includes(item.role)) ?? [], [detail.data]);
  const audience = useMemo(() => detail.data?.participants?.filter((item: any) => item.role === "AUDIENCE") ?? [], [detail.data]);
  const speakerRequests = useMemo(() => detail.data?.speakerRequests ?? [], [detail.data]);
  const activePoll = polls.data?.polls?.[0];
  const missionItems = missions.data?.missions ?? [];

  const handleReport = useCallback(() => {
    if (!hostId) return;
    Alert.alert("Report user", "Report this user for inappropriate behavior?", [
      { text: "Cancel", style: "cancel" },
      { text: "Report", style: "destructive", onPress: () => reportUser.mutate({ targetUserId: hostId, reason: "Inappropriate behavior" }) }
    ]);
  }, [hostId, reportUser]);

  if (detail.isLoading) return <Screen><LoadingState message="Loading room..." /></Screen>;
  if (detail.error) return <Screen><ErrorState message={(detail.error as any)?.message} onRetry={() => detail.refetch()} /></Screen>;

  return (
    <Screen>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
        <View style={styles.top}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title} numberOfLines={1}>{room?.title ?? "Live room"}</Text>
            <Text style={styles.meta}>LIVE / {room?.participantCount ?? 0} people / {room?.language ?? "Hindi"}</Text>
          </View>
          {isHost && (
            <Pressable style={[styles.close, { backgroundColor: "rgba(255,91,110,0.2)" }]} onPress={() => Alert.alert("End room", "This will disconnect all participants and end the session.", [
              { text: "Cancel", style: "cancel" },
              { text: "End room", style: "destructive", onPress: () => endRoom.mutate() }
            ])}>
              <DoorOpen color={colors.danger} />
            </Pressable>
          )}
          <Pressable style={styles.close} onPress={() => leave.mutate()}>
            <DoorOpen color={colors.text} />
          </Pressable>
        </View>

        <FlatList
          style={styles.chat}
          ListHeaderComponent={
            roomType === "VOICE" ? (
              <View style={styles.main}>
                <HostCard room={room} />

                {isHost && speakerRequests.length > 0 && (
                  <View style={styles.requests}>
                    <Text style={styles.sectionTitle}>Speaker requests</Text>
                    {speakerRequests.map((item: any) => (
                      <View key={item._id} style={styles.requestRow}>
                        <Text style={styles.requestName}>{item.userId?.name ?? "User"} wants to speak</Text>
                        <View style={styles.requestActions}>
                          <Pressable style={styles.approveBtn} onPress={() => approveSpeaker.mutate(item.userId?._id ?? item.userId)}>
                            <Text style={styles.btnText}>Approve</Text>
                          </Pressable>
                          <Pressable style={styles.rejectBtn} onPress={() => rejectSpeaker.mutate(item.userId?._id ?? item.userId)}>
                            <Text style={styles.btnText}>Deny</Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}

                <Text style={styles.sectionTitle}>Speaker seats</Text>
                <View style={styles.seatGrid}>
                  {[...speakers, ...Array(Math.max((room?.maxSpeakers ?? 6) - speakers.length, 0)).fill(null)].slice(0, room?.maxSpeakers ?? 6).map((item: any, index) => (
                    <View key={item?._id ?? index} style={styles.seat}>
                      <View style={styles.seatAvatar}><Text style={styles.seatInitial}>{item?.userId?.name?.[0] ?? "+"}</Text></View>
                      <Text style={styles.seatName} numberOfLines={1}>{item?.userId?.name ?? "Open seat"}</Text>
                      {isHost && item && item.userId?._id !== currentUserId && (
                        <View style={styles.seatActions}>
                          <Pressable onPress={() => muteUser.mutate(item.userId._id)}><VolumeX color={colors.danger} size={14} /></Pressable>
                          <Pressable onPress={() => Alert.alert("Remove participant", "Remove this participant from the room? They won't be able to rejoin.", [
                            { text: "Cancel", style: "cancel" },
                            { text: "Remove", style: "destructive", onPress: () => removeUser.mutate(item.userId._id) }
                          ])}><UserX color={colors.danger} size={14} /></Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
                <Text style={styles.sectionTitle}>Audience {audience.length}</Text>
                <MissionStrip missions={missionItems} />
                <PollCard
                  poll={activePoll}
                  isHost={isHost}
                  onCreate={() => createPoll.mutate({ question: "What should we do next?", options: ["Music", "Games", "Q&A", "Chill"] })}
                  onBattle={() => createPoll.mutate({ question: "Who won this round?", options: ["Team host", "Team guest", "Audience wins"] })}
                  onVote={(pollId, optionIndex) => votePoll.mutate({ pollId, optionIndex })}
                />
                <ActivityFeed activity={activity.data?.activity ?? []} />
                <Text style={styles.mediaState}>{mediaState}</Text>
                {!!giftBurst && <Text style={styles.giftBurst}>{giftBurst}</Text>}
              </View>
            ) : (
              <View style={styles.videoMain}>
                <View style={styles.videoGrid}>
                  {[...speakers, ...Array(4).fill(null)].slice(0, 4).map((item: any, index) => (
                    <View key={item?._id ?? index} style={[styles.videoTile, index === 0 && styles.hostTile]}>
                      {item ? <Video color={colors.gold} size={32} /> : <CameraOff color={colors.muted} size={28} />}
                      <Text style={styles.videoName}>{item?.userId?.name ?? "Audience mode"}</Text>
                      {isHost && item && item.userId?._id !== currentUserId && (
                        <View style={styles.videoActions}>
                          <Pressable onPress={() => muteUser.mutate(item.userId._id)}><VolumeX color={colors.danger} size={14} /></Pressable>
                          <Pressable onPress={() => Alert.alert("Remove participant", "Remove this participant from the room? They won't be able to rejoin.", [
                            { text: "Cancel", style: "cancel" },
                            { text: "Remove", style: "destructive", onPress: () => removeUser.mutate(item.userId._id) }
                          ])}><UserX color={colors.danger} size={14} /></Pressable>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
                <MissionStrip missions={missionItems} />
                <PollCard
                  poll={activePoll}
                  isHost={isHost}
                  onCreate={() => createPoll.mutate({ question: "What should we do next?", options: ["Music", "Games", "Q&A", "Chill"] })}
                  onBattle={() => createPoll.mutate({ question: "Who won this round?", options: ["Team host", "Team guest", "Audience wins"] })}
                  onVote={(pollId, optionIndex) => votePoll.mutate({ pollId, optionIndex })}
                />
                <ActivityFeed activity={activity.data?.activity ?? []} />
                <Text style={styles.mediaState}>{mediaState} {beauty ? "/ beauty" : ""} {voiceFx ? "/ voice fx" : ""} {blurBg ? "/ blur" : ""}</Text>
                {!!giftBurst && <Text style={styles.giftBurst}>{giftBurst}</Text>}
              </View>
            )
          }
          data={messages.data?.messages ?? []}
          keyExtractor={(item, i) => item._id ?? `msg-${i}`}
          renderItem={({ item }) => <Text style={styles.chatLine}><Text style={styles.chatName}>{item.senderId?.name ?? "User"}: </Text>{item.message}</Text>}
        />
        <ChatComposer onSend={(message) => sendMessage.mutate(message)} />
        {showGifts && <GiftPanel onSend={async (gift) => {
          if (hostId) {
            try {
              await walletApi.sendGift(roomId, gift._id, hostId);
            } catch (err: any) {
              setGiftBurst(err?.message ?? "Gift send failed");
              return;
            }
          }
          setGiftBurst(`${gift.name} launched`);
          setShowGifts(false);
        }} />}
        <View style={styles.controls}>
          <ControlButton icon={mic ? <Mic color={colors.text} size={20} /> : <MicOff color={colors.text} size={20} />} label="Mic" active={mic} onPress={() => {
            const next = !mic;
            setMic(next);
            mediaSession.current?.setMicrophoneEnabled(next).catch((err) => setGiftBurst(err?.message ?? "Mic update failed"));
          }} />
          {roomType === "VIDEO" && <ControlButton icon={camera ? <Camera color={colors.text} size={20} /> : <CameraOff color={colors.text} size={20} />} label="Cam" active={camera} onPress={() => {
            const next = !camera;
            setCamera(next);
            mediaSession.current?.setCameraEnabled(next).catch((err) => setGiftBurst(err?.message ?? "Camera update failed"));
          }} />}
          {roomType === "VIDEO" && <ControlButton icon={<RefreshCcw color={colors.text} size={20} />} label="Flip" onPress={() => mediaSession.current?.flipCamera()} />}
          <ControlButton icon={<UserPlus color={colors.text} size={20} />} label="Speak" onPress={() => requestSpeaker.mutate()} />
          <ControlButton icon={<Send color={colors.text} size={20} />} label="Invite" onPress={() => {
            const candidate = audience.find((item: any) => item.userId?._id && item.userId._id !== currentUserId)?.userId?._id;
            if (candidate) inviteFriend.mutate(candidate);
            else setGiftBurst("Join with friends, then invite them back in");
          }} />
          <ControlButton icon={<Gift color={colors.text} size={20} />} label="Gift" onPress={() => setShowGifts((value) => !value)} />
          <ControlButton icon={<Smile color={colors.text} size={20} />} label="React" onPress={() => react.mutate(reactionTypes[Math.floor(Math.random() * reactionTypes.length)] as any)} />
          {roomType === "VIDEO" && <ControlButton icon={<Sparkles color={colors.text} size={20} />} label="FX" active={beauty || voiceFx || blurBg} onPress={() => { setBeauty((v) => !v); setVoiceFx((v) => !v); setBlurBg((v) => !v); setGiftBurst("FX preference saved for this room"); }} />}
          <ControlButton icon={<Send color={colors.text} size={20} />} label="DM" onPress={() => {
            const receiverId = isHost ? audience.find((item: any) => item.userId?._id && item.userId._id !== currentUserId)?.userId?._id : undefined;
            if (isHost && !receiverId) setGiftBurst("No audience member to message yet");
            else dmHost.mutate(receiverId);
          }} />
          <ControlButton icon={<ShieldAlert color={colors.text} size={20} />} label="Report" danger onPress={handleReport} />
        </View>
        <View pointerEvents="none" style={styles.reactionLayer}>
          {reactionBursts.map((item, index) => <Text key={item.id} style={[styles.reactionBurst, { bottom: 18 + index * 36, right: 16 + index * 8 }]}>{item.label}</Text>)}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function HostCard({ room }: { room: any }) {
  return (
    <GlassCard style={styles.hostCard}>
      <View style={styles.hostAvatar}><Text style={styles.hostInitial}>{room?.hostId?.name?.[0] ?? "Y"}</Text></View>
      <View style={{ flex: 1 }}>
        <Text style={styles.hostName}>{room?.hostId?.name ?? "Yugm Host"}</Text>
        <Text style={styles.hostMeta}>{room?.category ?? "Live"} host / {room?.tags?.join(", ")}</Text>
      </View>
      <Radio color={colors.gold} />
    </GlassCard>
  );
}

function MissionStrip({ missions }: { missions: any[] }) {
  if (!missions.length) return null;
  return (
    <View style={styles.missionStrip}>
      {missions.map((mission) => (
        <View key={mission.id} style={styles.mission}>
          <Text style={styles.missionTitle} numberOfLines={1}>{mission.title}</Text>
          <Text style={styles.missionMeta}>{mission.progress}/{mission.target} / {mission.reward} coins</Text>
        </View>
      ))}
    </View>
  );
}

function PollCard({ poll, isHost, onCreate, onBattle, onVote }: { poll: any; isHost: boolean; onCreate: () => void; onBattle: () => void; onVote: (pollId: string, optionIndex: number) => void }) {
  if (!poll) {
    if (!isHost) return null;
    return (
      <View style={styles.pollCard}>
        <Text style={styles.pollTitle}>Start room prompt</Text>
        <Text style={styles.pollMeta}>Give the audience a vote or turn the room into a battle round.</Text>
        <View style={styles.pollActions}>
          <Pressable style={styles.pollAction} onPress={onCreate}><Text style={styles.pollActionText}>Prompt</Text></Pressable>
          <Pressable style={styles.pollAction} onPress={onBattle}><Text style={styles.pollActionText}>Battle</Text></Pressable>
        </View>
      </View>
    );
  }
  const total = Math.max(poll.options?.reduce((sum: number, option: any) => sum + (option.votes ?? 0), 0) ?? 0, 1);
  return (
    <View style={styles.pollCard}>
      <Text style={styles.pollTitle}>{poll.question}</Text>
      {poll.options?.map((option: any, index: number) => {
        const pct = Math.round(((option.votes ?? 0) / total) * 100);
        return (
          <Pressable key={`${poll._id}-${index}`} style={styles.pollOption} onPress={() => onVote(poll._id, index)}>
            <View style={[styles.pollFill, { width: `${pct}%` }]} />
            <Text style={styles.pollOptionText}>{option.text}</Text>
            <Text style={styles.pollPct}>{pct}%</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ActivityFeed({ activity }: { activity: any[] }) {
  if (!activity.length) return null;
  return (
    <View style={styles.activityFeed}>
      <Text style={styles.activityTitle}>Live activity</Text>
      {activity.slice(-5).map((item) => (
        <Text key={item._id} style={styles.activityLine} numberOfLines={1}>{item.label}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 18, paddingTop: 8, paddingBottom: 12, flexDirection: "row", alignItems: "center", borderBottomWidth: 1, borderColor: colors.line, gap: 8 },
  title: { color: colors.text, fontSize: 20, fontWeight: "900" },
  meta: { color: colors.muted, fontSize: 12, marginTop: 3 },
  close: { width: 44, height: 44, borderRadius: 8, backgroundColor: "rgba(255,255,255,0.08)", alignItems: "center", justifyContent: "center" },
  main: { flex: 1, padding: 18 },
  hostCard: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 18 },
  hostAvatar: { width: 54, height: 54, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  hostInitial: { color: colors.gold, fontWeight: "900", fontSize: 24 },
  hostName: { color: colors.text, fontWeight: "900", fontSize: 16 },
  hostMeta: { color: colors.muted, marginTop: 3 },
  sectionTitle: { color: colors.text, fontWeight: "900", fontSize: 18, marginBottom: 12 },
  requests: { marginBottom: 18, padding: 12, borderRadius: 8, backgroundColor: "rgba(246,180,75,0.1)", borderWidth: 1, borderColor: colors.gold },
  requestRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 8 },
  requestName: { color: colors.text, fontWeight: "800", flex: 1 },
  requestActions: { flexDirection: "row", gap: 8 },
  approveBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.success },
  rejectBtn: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 6, backgroundColor: colors.danger },
  btnText: { color: colors.text, fontWeight: "900", fontSize: 12 },
  seatGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 20 },
  seat: { width: "30.8%", borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, alignItems: "center", padding: 8, paddingBottom: 4 },
  seatAvatar: { width: 42, height: 42, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center", marginBottom: 8 },
  seatInitial: { color: colors.gold, fontWeight: "900" },
  seatName: { color: colors.text, fontSize: 12, fontWeight: "800", marginBottom: 4 },
  seatActions: { flexDirection: "row", gap: 10, marginTop: 4 },
  videoMain: { flex: 1, padding: 14 },
  videoGrid: { flex: 1, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  videoTile: { width: "48%", minHeight: 190, borderRadius: 8, backgroundColor: "#11172C", borderWidth: 1, borderColor: colors.line, alignItems: "center", justifyContent: "center" },
  hostTile: { borderColor: colors.gold, backgroundColor: "#181B32" },
  videoName: { color: colors.text, fontWeight: "900", marginTop: 10 },
  videoActions: { flexDirection: "row", gap: 10, marginTop: 8 },
  mediaState: { color: colors.muted, fontSize: 12, marginTop: 8 },
  giftBurst: { color: colors.gold, fontWeight: "900", textAlign: "center", paddingVertical: 8 },
  missionStrip: { gap: 8, marginBottom: 14 },
  mission: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.06)", padding: 10 },
  missionTitle: { color: colors.text, fontWeight: "900" },
  missionMeta: { color: colors.gold, fontSize: 12, marginTop: 4, fontWeight: "800" },
  pollCard: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.panel, padding: 12, marginBottom: 14 },
  pollTitle: { color: colors.text, fontWeight: "900", marginBottom: 8 },
  pollMeta: { color: colors.muted },
  pollActions: { flexDirection: "row", gap: 8, marginTop: 10 },
  pollAction: { flex: 1, height: 36, borderRadius: 6, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  pollActionText: { color: colors.ink, fontWeight: "900" },
  pollOption: { height: 38, borderRadius: 6, backgroundColor: colors.panelStrong, marginTop: 8, overflow: "hidden", flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 10 },
  pollFill: { position: "absolute", left: 0, top: 0, bottom: 0, backgroundColor: "rgba(246,180,75,0.28)" },
  pollOptionText: { color: colors.text, fontWeight: "800" },
  pollPct: { color: colors.gold, fontWeight: "900", fontSize: 12 },
  activityFeed: { borderRadius: 8, borderWidth: 1, borderColor: colors.line, backgroundColor: "rgba(255,255,255,0.05)", padding: 12, marginBottom: 12 },
  activityTitle: { color: colors.text, fontWeight: "900", marginBottom: 6 },
  activityLine: { color: colors.muted, paddingVertical: 2 },
  reactionLayer: { position: "absolute", top: 0, left: 0, right: 0, bottom: 84 },
  reactionBurst: { position: "absolute", color: colors.gold, backgroundColor: "rgba(5,7,19,0.86)", borderColor: colors.gold, borderWidth: 1, overflow: "hidden", borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontWeight: "900" },
  chat: { maxHeight: 150, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  chatLine: { color: colors.text, paddingVertical: 5 },
  chatName: { color: colors.gold, fontWeight: "900" },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 10, borderTopWidth: 1, borderColor: colors.line }
});
