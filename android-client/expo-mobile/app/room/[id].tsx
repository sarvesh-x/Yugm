import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, Animated, Dimensions, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import * as Haptics from "expo-haptics";
import { Redirect, router, useLocalSearchParams } from "expo-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Camera, CameraOff, DoorOpen, Gift, Mic, MicOff, Monitor, MonitorPlay, Radio, RefreshCcw, Send, ShieldAlert, Sparkles, Smile, UserPlus, UserX, Users, Volume, VolumeX } from "lucide-react-native";
import { reactionTypes, socketEvents } from "@yugm/shared";
import { ChatComposer } from "@/components/ChatComposer";
import { ControlButton } from "@/components/ControlButton";
import { GiftPanel } from "@/components/GiftPanel";
import { GiftAnimation } from "@/components/GiftAnimation";
import { WatchPartyPlayer } from "@/components/WatchPartyPlayer";
import { CosmeticAvatar } from "@/components/CosmeticAvatar";
import { GlassCard } from "@/components/GlassCard";
import { LoadingState } from "@/components/LoadingState";
import { ErrorState } from "@/components/ErrorState";
import { Screen } from "@/components/Screen";
import { createLiveKitSession, type MediaSession } from "@/lib/livekit";
import { getSocket } from "@/lib/socket";
import { roomsApi, walletApi, watchPartyApi } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { colors } from "@/theme/colors";

const reactionLabels: Record<string, string> = { heart: "HEART", fire: "FIRE", laugh: "LAUGH", clap: "CLAP", wow: "WOW" };
const EMOJI_MAP: Record<string, string> = {
  heart: "❤️",
  fire: "🔥",
  laugh: "😂",
  clap: "👏",
  wow: "😮",
};
const SCREEN_WIDTH = Dimensions.get("window").width;

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
  const [giftAnimation, setGiftAnimation] = useState<string | null>(null);
  const [reactionBursts, setReactionBursts] = useState<{ id: string; label: string }[]>([]);
  const [fallingEmojis, setFallingEmojis] = useState<{ id: string; emoji: string; x: number; anim: Animated.Value }[]>([]);
  const emojiCounter = useRef(0);
  const [watchParty, setWatchParty] = useState<any>(null);
  const [showWatchPartyStart, setShowWatchPartyStart] = useState(false);
  const [wpTitle, setWpTitle] = useState("");
  const [wpMediaUrl, setWpMediaUrl] = useState("");
  const [screenShare, setScreenShare] = useState(false);
  const [voiceIsolation, setVoiceIsolation] = useState(false);
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
  const isCoHost = room?.coHostIds?.some((id: any) => id === currentUserId) ?? false;
  const canModerate = isHost || isCoHost;

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
  const startWatchParty = useMutation({
    mutationFn: ({ title, mediaUrl }: { title: string; mediaUrl: string }) => watchPartyApi.start(roomId, title, mediaUrl),
    onSuccess: (data) => {
      setWatchParty(data.watchParty);
      setShowWatchPartyStart(false);
    },
    onError: (err: any) => setGiftBurst(err?.message ?? "Failed to start watch party")
  });
  const fetchWatchParty = useMutation({
    mutationFn: () => watchPartyApi.get(roomId),
    onSuccess: (data) => setWatchParty(data.watchParty),
    onError: () => setGiftBurst("No active watch party")
  });
  const syncWatchParty = useMutation({
    mutationFn: ({ position, isPlaying }: { position: number; isPlaying: boolean }) => watchPartyApi.sync(roomId, position, isPlaying),
  });
  const stopWatchParty = useMutation({
    mutationFn: () => watchPartyApi.stop(roomId),
    onSuccess: () => { setWatchParty(null); },
    onError: (err: any) => setGiftBurst(err?.message ?? "Failed to stop watch party")
  });

  const handleScreenShare = async () => {
    try {
      if (screenShare) {
        await mediaSession.current?.room.localParticipant?.setScreenShareEnabled(false);
      } else {
        await mediaSession.current?.room.localParticipant?.setScreenShareEnabled(true);
      }
      setScreenShare(!screenShare);
    } catch (err: any) {
      setGiftBurst(err?.message ?? "Screen share failed");
    }
  };

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
    const id = `${Date.now()}-${emojiCounter.current++}`;
    const emoji = EMOJI_MAP[label.toLowerCase()] || "❤️";
    const x = Math.random() * (SCREEN_WIDTH - 40);
    const anim = new Animated.Value(-60);

    setFallingEmojis((items) => [...items.slice(-10), { id, emoji, x, anim }]);

    Animated.timing(anim, {
      toValue: Dimensions.get("window").height,
      duration: 2500 + Math.random() * 1500,
      useNativeDriver: true,
    }).start(() => {
      setFallingEmojis((items) => items.filter((item) => item.id !== id));
    });

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }

  useEffect(() => {
    if (!roomId) return;
    let didJoinSocketRoom = false;
    const socket = getSocket();
    socket.connect();
    const handleChatMessage = () => queryClient.invalidateQueries({ queryKey: ["room", roomId, "messages"] });
    const handleGiftSend = (payload: any) => {
      setGiftBurst(`${payload?.gift?.name ?? "Gift"} sent`);
      if (payload?.animation) setGiftAnimation(payload.animation);
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
    const handleWatchPartyStarted = (payload: any) => {
      setWatchParty(payload?.watchParty ?? null);
    };
    const handleWatchPartySync = (payload: any) => {
      setWatchParty((prev: any) => prev ? { ...prev, position: payload.position, isPlaying: payload.isPlaying } : prev);
    };
    const handleWatchPartyStopped = () => {
      setWatchParty(null);
    };
    socket.on(socketEvents.roomChatMessage, handleChatMessage);
    socket.on(socketEvents.roomGiftSend, handleGiftSend);
    socket.on(socketEvents.roomReactionSend, handleReaction);
    socket.on(socketEvents.roomActivityNew, handleActivity);
    socket.on(socketEvents.roomPollNew, handlePoll);
    socket.on(socketEvents.roomPollVote, handlePoll);
    socket.on(socketEvents.watchPartyStarted, handleWatchPartyStarted);
    socket.on(socketEvents.watchPartySync, handleWatchPartySync);
    socket.on(socketEvents.watchPartyStopped, handleWatchPartyStopped);
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
      socket.off(socketEvents.watchPartyStarted, handleWatchPartyStarted);
      socket.off(socketEvents.watchPartySync, handleWatchPartySync);
      socket.off(socketEvents.watchPartyStopped, handleWatchPartyStopped);
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

                {watchParty && (
                  <WatchPartyPlayer
                    mediaUrl={watchParty.mediaUrl}
                    title={watchParty.title}
                    position={watchParty.position}
                    isPlaying={watchParty.isPlaying}
                    isHost={isHost}
                    onSync={(position, isPlaying) => syncWatchParty.mutate({ position, isPlaying })}
                    onStop={() => stopWatchParty.mutate()}
                  />
                )}

                {room?.coHostIds?.length > 0 && (
                  <View style={styles.coHostRow}>
                    <Text style={styles.coHostLabel}>Co-Hosts:</Text>
                    <View style={styles.coHostAvatars}>
                      {room.coHostIds.map((coHost: any, i: number) => (
                        <View key={coHost?._id ?? i} style={styles.coHostPill}>
                          <Text style={styles.coHostName}>{coHost?.name ?? `Co-Host ${i + 1}`}</Text>
                        </View>
                      ))}
                    </View>
                  </View>
                )}

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
                      {item ? (
                        <CosmeticAvatar
                          name={item.userId?.name}
                          imageUrl={item.userId?.avatar}
                          cosmetics={item.userId?.activeCosmetics}
                          size={42}
                          isSpeaking={item.micEnabled !== false}
                          showEntry
                        />
                      ) : (
                        <View style={styles.seatAvatar}><Text style={styles.seatInitial}>+</Text></View>
                      )}
                      <Text style={styles.seatName} numberOfLines={1}>{item?.userId?.name ?? "Open seat"}</Text>
                      {item && room?.coHostIds?.some((id: any) => (id === item.userId?._id || id === item.userId)) && (
                        <Text style={styles.coHostBadge}>Co-Host</Text>
                      )}
                      {canModerate && item && item.userId?._id !== currentUserId && (
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
                {watchParty && (
                  <WatchPartyPlayer
                    mediaUrl={watchParty.mediaUrl}
                    title={watchParty.title}
                    position={watchParty.position}
                    isPlaying={watchParty.isPlaying}
                    isHost={isHost}
                    onSync={(position, isPlaying) => syncWatchParty.mutate({ position, isPlaying })}
                    onStop={() => stopWatchParty.mutate()}
                  />
                )}
                <View style={styles.videoGrid}>
                  {[...speakers, ...Array(4).fill(null)].slice(0, 4).map((item: any, index) => (
                    <View key={item?._id ?? index} style={[styles.videoTile, index === 0 && styles.hostTile]}>
                      {item ? (
                        <CosmeticAvatar
                          name={item.userId?.name}
                          imageUrl={item.userId?.avatar}
                          cosmetics={item.userId?.activeCosmetics}
                          size={68}
                          isSpeaking={item.micEnabled !== false}
                          showEntry
                        />
                      ) : <CameraOff color={colors.muted} size={28} />}
                      <Text style={styles.videoName}>{item?.userId?.name ?? "Audience mode"}</Text>
                      {canModerate && item && item.userId?._id !== currentUserId && (
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
        {showWatchPartyStart && (
          <View style={styles.wpOverlay}>
            <Text style={styles.wpTitle}>Start Watch Party</Text>
            <View style={styles.wpInputs}>
              <View style={styles.wpField}>
                <Text style={styles.wpLabel}>Title</Text>
                <View style={{ flex: 1, backgroundColor: colors.panelStrong, borderRadius: 6, paddingHorizontal: 10, height: 36, justifyContent: "center" }}>
                  <TextInput
                    style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}
                    placeholder="Movie / show name"
                    placeholderTextColor={colors.muted}
                    value={wpTitle}
                    onChangeText={setWpTitle}
                  />
                </View>
              </View>
              <View style={styles.wpField}>
                <Text style={styles.wpLabel}>Media URL</Text>
                <View style={{ flex: 1, backgroundColor: colors.panelStrong, borderRadius: 6, paddingHorizontal: 10, height: 36, justifyContent: "center" }}>
                  <TextInput
                    style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}
                    placeholder="https://example.com/video.mp4"
                    placeholderTextColor={colors.muted}
                    value={wpMediaUrl}
                    onChangeText={setWpMediaUrl}
                    autoCapitalize="none"
                    autoCorrect={false}
                  />
                </View>
              </View>
            </View>
            <View style={styles.wpActions}>
              <Pressable style={styles.wpCancelBtn} onPress={() => setShowWatchPartyStart(false)}>
                <Text style={styles.wpBtnText}>Cancel</Text>
              </Pressable>
              <Pressable style={[styles.wpStartBtn, startWatchParty.isPending && styles.disabled]} onPress={() => {
                if (wpTitle.trim() && wpMediaUrl.trim()) startWatchParty.mutate({ title: wpTitle.trim(), mediaUrl: wpMediaUrl.trim() });
              }} disabled={startWatchParty.isPending}>
                <Text style={[styles.wpBtnText, { color: colors.ink }]}>{startWatchParty.isPending ? "Starting..." : "Start"}</Text>
              </Pressable>
            </View>
          </View>
        )}
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
          <ControlButton icon={<Volume color={colors.text} size={20} />} label="Noise" active={voiceIsolation} onPress={() => {
            const next = !voiceIsolation;
            setVoiceIsolation(next);
            mediaSession.current?.setVoiceIsolationEnabled(next).catch(() => {});
          }} />
          {roomType === "VIDEO" && <ControlButton icon={camera ? <Camera color={colors.text} size={20} /> : <CameraOff color={colors.text} size={20} />} label="Cam" active={camera} onPress={() => {
            const next = !camera;
            setCamera(next);
            mediaSession.current?.setCameraEnabled(next).catch((err) => setGiftBurst(err?.message ?? "Camera update failed"));
          }} />}
          {roomType === "VIDEO" && <ControlButton icon={<RefreshCcw color={colors.text} size={20} />} label="Flip" onPress={() => mediaSession.current?.flipCamera()} />}
          {roomType === "VIDEO" && <ControlButton icon={<Monitor color={colors.text} size={20} />} label="Share" active={screenShare} onPress={handleScreenShare} />}
          <ControlButton icon={<UserPlus color={colors.text} size={20} />} label="Speak" onPress={() => requestSpeaker.mutate()} />
          <ControlButton icon={<Send color={colors.text} size={20} />} label="Invite" onPress={() => {
            const candidate = audience.find((item: any) => item.userId?._id && item.userId._id !== currentUserId)?.userId?._id;
            if (candidate) inviteFriend.mutate(candidate);
            else setGiftBurst("Join with friends, then invite them back in");
          }} />
          {isHost && <ControlButton icon={<Users color={colors.text} size={20} />} label="Co-Host" onPress={() => {
            const speaker = speakers.find((s: any) => s.userId?._id && s.userId._id !== currentUserId && !room?.coHostIds?.some((id: any) => id === s.userId._id || id._id === s.userId._id));
            if (speaker) {
              Alert.alert("Add Co-Host", `Make ${speaker.userId.name ?? "this speaker"} a co-host?`, [
                { text: "Cancel", style: "cancel" },
                { text: "Add", onPress: () => {
                  roomsApi.addCoHost(roomId, speaker.userId._id).then(() => {
                    queryClient.invalidateQueries({ queryKey: ["room", roomId] });
                    setGiftBurst(`${speaker.userId.name} is now co-host`);
                  }).catch((err: any) => setGiftBurst(err?.message ?? "Failed to add co-host"));
                }}
              ]);
            } else {
              setGiftBurst("No speaker available to promote");
            }
          }} />}
          <ControlButton icon={<Gift color={colors.text} size={20} />} label="Gift" onPress={() => setShowGifts((value) => !value)} />
           <ControlButton icon={<MonitorPlay color={colors.text} size={20} />} label="Watch" onPress={() => {
             if (isHost && !watchParty) setShowWatchPartyStart(true);
             else if (!watchParty) fetchWatchParty.mutate();
             else setWatchParty(null);
           }} />
           <ControlButton icon={<Smile color={colors.text} size={20} />} label="React" onPress={() => react.mutate(reactionTypes[Math.floor(Math.random() * reactionTypes.length)] as any)} />
          {roomType === "VIDEO" && <ControlButton icon={<Sparkles color={colors.text} size={20} />} label="FX" active={beauty || voiceFx || blurBg} onPress={() => { setBeauty((v) => !v); setVoiceFx((v) => !v); setBlurBg((v) => !v); setGiftBurst("FX preference saved for this room"); }} />}
          <ControlButton icon={<Send color={colors.text} size={20} />} label="DM" onPress={() => {
            const receiverId = isHost ? audience.find((item: any) => item.userId?._id && item.userId._id !== currentUserId)?.userId?._id : undefined;
            if (isHost && !receiverId) setGiftBurst("No audience member to message yet");
            else dmHost.mutate(receiverId);
          }} />
          <ControlButton icon={<ShieldAlert color={colors.text} size={20} />} label="Report" danger onPress={handleReport} />
        </View>
        {giftAnimation && <GiftAnimation giftName={giftAnimation} onComplete={() => setGiftAnimation(null)} />}
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
          {fallingEmojis.map((item) => (
            <Animated.Text
              key={item.id}
              style={[styles.fallingEmoji, { left: item.x, transform: [{ translateY: item.anim }] }]}
            >
              {item.emoji}
            </Animated.Text>
          ))}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function HostCard({ room }: { room: any }) {
  const host = room?.hostId;
  return (
    <GlassCard style={styles.hostCard}>
      <CosmeticAvatar
        name={host?.name ?? "Yugm Host"}
        imageUrl={host?.avatar}
        cosmetics={host?.activeCosmetics}
        size={54}
        isSpeaking
        showEntry
      />
      <View style={{ flex: 1 }}>
        <Text style={styles.hostName}>{host?.name ?? "Yugm Host"}</Text>
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
  fallingEmoji: {
    position: "absolute",
    fontSize: 32,
    top: 0,
  },
  wpOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    backgroundColor: colors.scrim,
    zIndex: 100,
    padding: 20,
    justifyContent: "center",
  },
  wpTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 16, textAlign: "center" },
  wpInputs: { gap: 10, marginBottom: 16 },
  wpField: { flexDirection: "row", alignItems: "center", gap: 8 },
  wpLabel: { color: colors.muted, fontWeight: "800", fontSize: 13, width: 70 },
  wpActions: { flexDirection: "row", gap: 10 },
  wpCancelBtn: { flex: 1, height: 40, borderRadius: 6, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center" },
  wpStartBtn: { flex: 1, height: 40, borderRadius: 6, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center" },
  wpBtnText: { color: colors.text, fontWeight: "900", fontSize: 14 },
  disabled: { opacity: 0.6 },
  chat: { maxHeight: 150, borderTopWidth: 1, borderColor: colors.line, paddingHorizontal: 14 },
  chatLine: { color: colors.text, paddingVertical: 5 },
  chatName: { color: colors.gold, fontWeight: "900" },
  controls: { flexDirection: "row", flexWrap: "wrap", gap: 8, padding: 10, borderTopWidth: 1, borderColor: colors.line },
  coHostRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 18, padding: 10, borderRadius: 8, backgroundColor: "rgba(39,211,255,0.08)", borderWidth: 1, borderColor: colors.cyan },
  coHostLabel: { color: colors.cyan, fontWeight: "900", fontSize: 13 },
  coHostAvatars: { flexDirection: "row", flexWrap: "wrap", gap: 6, flex: 1 },
  coHostPill: { borderRadius: 6, backgroundColor: "rgba(39,211,255,0.15)", borderWidth: 1, borderColor: colors.cyan, paddingHorizontal: 10, paddingVertical: 4 },
  coHostName: { color: colors.cyan, fontWeight: "800", fontSize: 12 },
  coHostBadge: { color: colors.cyan, fontSize: 9, fontWeight: "900", marginTop: 2, backgroundColor: "rgba(39,211,255,0.15)", borderRadius: 4, paddingHorizontal: 6, paddingVertical: 1, overflow: "hidden" }
});
