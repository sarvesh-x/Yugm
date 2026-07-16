import { useState } from "react";
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Brain, CheckCircle2, Crown, Flame, Gamepad2, MessageCircle, RotateCcw, Send, Sparkles, Swords, Timer, Trophy, Users, Zap } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";
import { ChallengeCard } from "@/components/ChallengeCard";
import { GlassCard } from "@/components/GlassCard";
import { Screen, Section } from "@/components/Screen";
import { clansApi, gamesApi, usersApi } from "@/lib/api";
import { colors, gradients } from "@/theme/colors";

type GameId = "vibe_tap" | "memory_match" | "reflex_ring";
type FinishedScore = { gameId: GameId; score: number; durationMs?: number; rounds?: number; metadata?: Record<string, unknown> };

const gameMeta: Record<GameId, { icon: any; accent: string; short: string }> = {
  vibe_tap: { icon: Flame, accent: colors.pink, short: "10 second tap streak" },
  memory_match: { icon: Brain, accent: colors.gold, short: "Clear paired cards" },
  reflex_ring: { icon: Zap, accent: colors.cyan, short: "Fast signal reaction" }
};

export default function GamesScreen() {
  const queryClient = useQueryClient();
  const [selectedGame, setSelectedGame] = useState<GameId>("vibe_tap");
  const [finishedScore, setFinishedScore] = useState<FinishedScore | null>(null);
  const [savedScore, setSavedScore] = useState<any | null>(null);

  const catalog = useQuery({ queryKey: ["games", "catalog"], queryFn: gamesApi.catalog, staleTime: 30000 });
  const missions = useQuery({ queryKey: ["games", "missions"], queryFn: gamesApi.missions, staleTime: 15000 });
  const challenges = useQuery({ queryKey: ["games", "challenges"], queryFn: gamesApi.challenges, staleTime: 15000 });
  const closeFriends = useQuery({ queryKey: ["users", "closeFriends"], queryFn: usersApi.closeFriends, staleTime: 30000 });
  const myClan = useQuery({ queryKey: ["clans", "me"], queryFn: clansApi.mine, staleTime: 30000 });
  const leaderboard = useQuery({
    queryKey: ["games", "leaderboard", selectedGame],
    queryFn: () => gamesApi.leaderboard(selectedGame),
    staleTime: 15000
  });

  const submitScore = useMutation({
    mutationFn: (payload: FinishedScore) => gamesApi.submitScore(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["games"] });
      queryClient.invalidateQueries({ queryKey: ["experience"] });
      setSavedScore(data.score);
      Alert.alert(
        data.isPersonalBest ? "New personal best" : "Score saved",
        `Score ${data.score.score}. +${data.reward?.xpAwarded ?? 0} XP`
      );
      setFinishedScore(null);
    },
    onError: (err: any) => Alert.alert("Score failed", err?.message ?? "Could not save your score.")
  });
  const challenge = useMutation({
    mutationFn: (payload: { targetUserId?: string; clanId?: string }) => {
      if (!savedScore) throw new Error("Save a score first");
      return gamesApi.challenge({
        gameId: savedScore.gameId,
        score: savedScore.score,
        scoreId: savedScore._id,
        ...payload
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", "challenges"] });
      queryClient.invalidateQueries({ queryKey: ["games", "missions"] });
      Alert.alert("Challenge sent", "Your arcade challenge is live.");
    },
    onError: (err: any) => Alert.alert("Challenge failed", err?.message ?? "Could not send challenge.")
  });
  const acceptChallenge = useMutation({
    mutationFn: (challengeId: string) => gamesApi.acceptChallenge(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", "challenges"] });
      Alert.alert("Challenge accepted", "A message has been sent to the challenger.");
    },
    onError: (err: any) => Alert.alert("Accept failed", err?.message ?? "Could not accept challenge.")
  });
  const declineChallenge = useMutation({
    mutationFn: (challengeId: string) => gamesApi.declineChallenge(challengeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["games", "challenges"] });
      Alert.alert("Declined", "The challenge has been removed.");
    },
    onError: (err: any) => Alert.alert("Decline failed", err?.message ?? "Could not decline challenge.")
  });

  const shareScore = useMutation({
    mutationFn: (targetUserId: string) => {
      if (!savedScore?._id) throw new Error("Save a score first");
      return gamesApi.shareScore(savedScore._id, targetUserId);
    },
    onSuccess: () => Alert.alert("Shared in chat", "Your score card was sent."),
    onError: (err: any) => Alert.alert("Share failed", err?.message ?? "Could not share this score.")
  });

  const games = catalog.data?.games ?? [];
  const selectedCatalogGame = games.find((game: any) => game.id === selectedGame);
  const refreshing = catalog.isFetching || leaderboard.isFetching;
  const refresh = () => {
    catalog.refetch();
    missions.refetch();
    challenges.refetch();
    closeFriends.refetch();
    myClan.refetch();
    leaderboard.refetch();
  };

  return (
    <Screen>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.gold} />}
      >
        <Section>
          <LinearGradient colors={gradients.fire} style={styles.hero}>
            <View style={styles.heroTop}>
              <View>
                <Text style={styles.eyebrow}>Yugm Arcade</Text>
                <Text style={styles.title}>Mini Games</Text>
              </View>
              <Gamepad2 color={colors.text} size={30} />
            </View>
            <Text style={styles.heroCopy}>Play quick games between chats, chase personal bests, and climb the community leaderboard.</Text>
            <View style={styles.heroStats}>
              <HeroStat label="Games" value={`${games.length || 3}`} />
              <HeroStat label="Best" value={`${selectedCatalogGame?.best?.score ?? 0}`} />
              <HeroStat label="Reward" value="XP" />
            </View>
          </LinearGradient>
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>Choose a Game</Text>
          {catalog.isLoading ? (
            <ActivityIndicator color={colors.gold} />
          ) : (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.gamePicker}>
              {games.map((game: any) => {
                const active = game.id === selectedGame;
                const meta = gameMeta[game.id as GameId];
                const Icon = meta?.icon ?? Sparkles;
                return (
                  <Pressable key={game.id} onPress={() => { setSelectedGame(game.id); setFinishedScore(null); setSavedScore(null); }} style={[styles.gameCard, active && styles.gameCardActive]}>
                    <Icon color={active ? colors.ink : meta?.accent ?? colors.gold} size={22} />
                    <Text style={[styles.gameTitle, active && styles.gameTitleActive]}>{game.title}</Text>
                    <Text style={[styles.gameSub, active && styles.gameSubActive]}>{meta?.short ?? game.description}</Text>
                    <Text style={[styles.bestText, active && styles.gameSubActive]}>Best: {game.best?.score ?? 0}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
        </Section>

        <Section>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Daily Missions</Text>
            <Sparkles color={colors.gold} size={18} />
          </View>
          <View style={styles.missionGrid}>
            {(missions.data?.missions ?? []).map((mission: any) => (
              <GlassCard key={mission.id} style={styles.missionCard}>
                <CheckCircle2 color={mission.complete ? colors.success : colors.muted} size={19} />
                <Text style={styles.missionTitle}>{mission.title}</Text>
                <Text style={styles.missionMeta}>{mission.progress}/{mission.target} / +{mission.rewardXp} XP</Text>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${Math.min(100, (mission.progress / mission.target) * 100)}%` }]} />
                </View>
              </GlassCard>
            ))}
          </View>
        </Section>

        <Section>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{selectedCatalogGame?.title ?? "Play"}</Text>
            <View style={styles.rulePill}>
              <Timer color={colors.gold} size={14} />
              <Text style={styles.ruleText}>{selectedCatalogGame?.scoring ?? "Higher score wins"}</Text>
            </View>
          </View>
          <GameStage gameId={selectedGame} onFinish={setFinishedScore} />
          {finishedScore && (
            <GlassCard style={styles.resultCard}>
              <View style={styles.resultTop}>
                <Trophy color={colors.gold} size={24} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>Score ready: {finishedScore.score}</Text>
                  <Text style={styles.resultMeta}>Save it to update your best and leaderboard rank.</Text>
                </View>
              </View>
              <Pressable style={[styles.submitBtn, submitScore.isPending && styles.disabled]} onPress={() => submitScore.mutate(finishedScore)} disabled={submitScore.isPending}>
                {submitScore.isPending ? <ActivityIndicator color={colors.text} /> : <Send color={colors.text} size={17} />}
                <Text style={styles.submitText}>{submitScore.isPending ? "Saving..." : "Save Score"}</Text>
              </Pressable>
            </GlassCard>
          )}
          {savedScore && (
            <SocialScoreActions
              score={savedScore}
              friends={closeFriends.data?.users ?? []}
              clan={myClan.data?.clan}
              busy={challenge.isPending || shareScore.isPending}
              onChallengeUser={(targetUserId) => challenge.mutate({ targetUserId })}
              onChallengeClan={(clanId) => challenge.mutate({ clanId })}
              onShare={(targetUserId) => shareScore.mutate(targetUserId)}
            />
          )}
        </Section>

        <Section>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Active Challenges</Text>
            <Swords color={colors.pink} size={18} />
          </View>
          <ChallengeSection title="For you" items={challenges.data?.incoming ?? []} isIncoming onAccept={(id) => acceptChallenge.mutate(id)} onDecline={(id) => declineChallenge.mutate(id)} onPlay={(gameId) => setSelectedGame(gameId)} />
          <ChallengeSection title="Family board" items={challenges.data?.clan ?? []} onPlay={(gameId) => setSelectedGame(gameId)} />
          <ChallengeSection title="Sent" items={challenges.data?.outgoing ?? []} onPlay={(gameId) => setSelectedGame(gameId)} />
        </Section>

        <Section>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Leaderboard</Text>
            <Crown color={colors.gold} size={18} />
          </View>
          {leaderboard.isLoading ? (
            <ActivityIndicator color={colors.gold} />
          ) : !(leaderboard.data?.leaderboard ?? []).length ? (
            <GlassCard><Text style={styles.muted}>No scores yet. Be the first name on this board.</Text></GlassCard>
          ) : (
            <View style={styles.leaderboard}>
              {(leaderboard.data?.leaderboard ?? []).slice(0, 10).map((row: any, index: number) => (
                <GlassCard key={`${row.userId}-${index}`} style={styles.rankRow}>
                  <Text style={styles.rank}>#{index + 1}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rankName}>{row.user?.name ?? "Player"}</Text>
                    <Text style={styles.rankMeta}>@{row.user?.username ?? "yugm"} / Level {row.user?.level ?? 1}</Text>
                  </View>
                  <Text style={styles.rankScore}>{row.score}</Text>
                </GlassCard>
              ))}
            </View>
          )}
        </Section>

        <Section>
          <Text style={styles.sectionTitle}>Recent Runs</Text>
          {!(catalog.data?.recent ?? []).length ? (
            <GlassCard><Text style={styles.muted}>Your latest scores will appear here.</Text></GlassCard>
          ) : (
            (catalog.data?.recent ?? []).slice(0, 5).map((item: any) => (
              <GlassCard key={item._id} style={styles.recentRow}>
                <Text style={styles.recentGame}>{(item.gameId ?? "").replaceAll("_", " ")}</Text>
                <Text style={styles.recentScore}>{item.score}</Text>
              </GlassCard>
            ))
          )}
        </Section>
      </ScrollView>
    </Screen>
  );
}

function SocialScoreActions({
  score,
  friends,
  clan,
  busy,
  onChallengeUser,
  onChallengeClan,
  onShare
}: {
  score: any;
  friends: any[];
  clan?: any;
  busy: boolean;
  onChallengeUser: (targetUserId: string) => void;
  onChallengeClan: (clanId: string) => void;
  onShare: (targetUserId: string) => void;
}) {
  return (
    <GlassCard style={styles.socialCard}>
      <View style={styles.resultTop}>
        <Swords color={colors.pink} size={22} />
        <View style={{ flex: 1 }}>
          <Text style={styles.resultTitle}>Turn {score.score} into a challenge</Text>
          <Text style={styles.resultMeta}>Challenge close friends, your family, or share it in a private chat.</Text>
        </View>
      </View>
      {!!friends.length && (
        <View style={styles.targetList}>
          {friends.slice(0, 4).map((friend: any) => {
            const id = friend._id ?? friend.id;
            return (
              <View key={id} style={styles.targetRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.targetName}>{friend.name ?? "Friend"}</Text>
                  <Text style={styles.targetMeta}>@{friend.username ?? "yugm"}</Text>
                </View>
                <Pressable disabled={busy} onPress={() => onShare(id)} style={styles.smallAction}>
                  <MessageCircle color={colors.text} size={14} />
                  <Text style={styles.smallActionText}>Share</Text>
                </Pressable>
                <Pressable disabled={busy} onPress={() => onChallengeUser(id)} style={[styles.smallAction, styles.challengeAction]}>
                  <Swords color={colors.ink} size={14} />
                  <Text style={[styles.smallActionText, styles.challengeActionText]}>Challenge</Text>
                </Pressable>
              </View>
            );
          })}
        </View>
      )}
      {!friends.length && <Text style={styles.muted}>Add close friends to share score cards and send direct challenges.</Text>}
      {clan?._id && (
        <Pressable disabled={busy} onPress={() => onChallengeClan(clan._id)} style={[styles.clanChallengeBtn, busy && styles.disabled]}>
          <Users color={colors.ink} size={17} />
          <Text style={styles.clanChallengeText}>Challenge {clan.name}</Text>
        </Pressable>
      )}
    </GlassCard>
  );
}

function ChallengeSection({ title, items, isIncoming, onAccept, onDecline, onPlay }: { title: string; items: any[]; isIncoming?: boolean; onAccept?: (id: string) => void; onDecline?: (id: string) => void; onPlay: (gameId: GameId) => void }) {
  return (
    <View style={styles.challengeBlock}>
      <Text style={styles.challengeTitle}>{title}</Text>
      {!items.length ? (
        <GlassCard><Text style={styles.muted}>No active challenges here yet.</Text></GlassCard>
      ) : (
        items.slice(0, 4).map((item) => (
          isIncoming ? (
            <ChallengeCard key={item._id} challenge={item} isIncoming onAccept={onAccept} onDecline={onDecline} />
          ) : (
            <Pressable key={item._id} onPress={() => onPlay(item.gameId as GameId)}>
              <GlassCard style={styles.challengeRow}>
                <Swords color={colors.gold} size={18} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rankName}>{item.challenger?.name ?? "Player"} scored {item.score}</Text>
                  <Text style={styles.rankMeta}>{String(item.gameId).replaceAll("_", " ")} / expires {new Date(item.expiresAt).toLocaleDateString()}</Text>
                </View>
              </GlassCard>
            </Pressable>
          )
        ))
      )}
    </View>
  );
}

function GameStage({ gameId, onFinish }: { gameId: GameId; onFinish: (score: FinishedScore) => void }) {
  if (gameId === "memory_match") return <MemoryMatch onFinish={onFinish} />;
  if (gameId === "reflex_ring") return <ReflexRing onFinish={onFinish} />;
  return <VibeTap onFinish={onFinish} />;
}

function VibeTap({ onFinish }: { onFinish: (score: FinishedScore) => void }) {
  const [running, setRunning] = useState(false);
  const [taps, setTaps] = useState(0);
  const [combo, setCombo] = useState(1);

  const start = () => {
    setRunning(true);
    setTaps(0);
    setCombo(1);
    setTimeout(() => {
      setRunning(false);
      setTaps((latest) => {
        onFinish({ gameId: "vibe_tap", score: latest * 10, durationMs: 10000, rounds: latest, metadata: { combo } });
        return latest;
      });
    }, 10000);
  };

  const tap = () => {
    if (!running) return;
    setTaps((value) => value + combo);
    setCombo((value) => Math.min(5, value + 1));
  };

  return (
    <GlassCard style={styles.stage}>
      <Text style={styles.stageTitle}>Tap the pulse</Text>
      <Text style={styles.stageScore}>{taps * 10}</Text>
      <Text style={styles.muted}>Combo x{combo}. The round lasts 10 seconds.</Text>
      <Pressable style={[styles.bigGameButton, running && styles.bigGameButtonActive]} onPress={running ? tap : start}>
        <Text style={styles.bigGameButtonText}>{running ? "TAP" : "Start"}</Text>
      </Pressable>
    </GlassCard>
  );
}

function MemoryMatch({ onFinish }: { onFinish: (score: FinishedScore) => void }) {
  const baseCards = ["PINK", "GOLD", "CYAN", "FIRE"];
  const [cards, setCards] = useState(() => shuffle([...baseCards, ...baseCards]));
  const [open, setOpen] = useState<number[]>([]);
  const [matched, setMatched] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [startedAt, setStartedAt] = useState(Date.now());

  const reset = () => {
    setCards(shuffle([...baseCards, ...baseCards]));
    setOpen([]);
    setMatched([]);
    setMoves(0);
    setStartedAt(Date.now());
  };

  const flip = (index: number) => {
    if (open.includes(index) || matched.includes(index) || open.length === 2) return;
    const nextOpen = [...open, index];
    setOpen(nextOpen);
    if (nextOpen.length === 2) {
      setMoves((value) => value + 1);
      const [a, b] = nextOpen;
      if (cards[a] === cards[b]) {
        const nextMatched = [...matched, a, b];
        setMatched(nextMatched);
        setOpen([]);
        if (nextMatched.length === cards.length) {
          const durationMs = Date.now() - startedAt;
          const score = Math.max(100, 1200 - (moves + 1) * 80 - Math.floor(durationMs / 250));
          onFinish({ gameId: "memory_match", score, durationMs, rounds: moves + 1, metadata: { pairs: baseCards.length } });
        }
      } else {
        setTimeout(() => setOpen([]), 700);
      }
    }
  };

  return (
    <GlassCard style={styles.stage}>
      <View style={styles.stageHeader}>
        <View>
          <Text style={styles.stageTitle}>Match all pairs</Text>
          <Text style={styles.muted}>Moves: {moves}</Text>
        </View>
        <Pressable onPress={reset} style={styles.resetBtn}><RotateCcw color={colors.text} size={16} /></Pressable>
      </View>
      <View style={styles.memoryGrid}>
        {cards.map((card, index) => {
          const visible = open.includes(index) || matched.includes(index);
          return (
            <Pressable key={`${card}-${index}`} style={[styles.memoryCard, visible && styles.memoryCardOpen]} onPress={() => flip(index)}>
              <Text style={[styles.memoryText, visible && styles.memoryTextOpen]}>{visible ? card : "?"}</Text>
            </Pressable>
          );
        })}
      </View>
    </GlassCard>
  );
}

function ReflexRing({ onFinish }: { onFinish: (score: FinishedScore) => void }) {
  const [state, setState] = useState<"idle" | "waiting" | "ready" | "done">("idle");
  const [readyAt, setReadyAt] = useState(0);
  const [lastMs, setLastMs] = useState<number | null>(null);

  const start = () => {
    setState("waiting");
    setLastMs(null);
    const delay = 900 + Math.floor(Math.random() * 2200);
    setTimeout(() => {
      setReadyAt(Date.now());
      setState("ready");
    }, delay);
  };

  const press = () => {
    if (state === "waiting") {
      setState("idle");
      setLastMs(null);
      Alert.alert("Too soon", "Wait for the cyan signal.");
      return;
    }
    if (state !== "ready") return;
    const reactionMs = Date.now() - readyAt;
    const score = Math.max(50, 1000 - reactionMs);
    setLastMs(reactionMs);
    setState("done");
    onFinish({ gameId: "reflex_ring", score, durationMs: reactionMs, rounds: 1, metadata: { reactionMs } });
  };

  return (
    <GlassCard style={styles.stage}>
      <Text style={styles.stageTitle}>Reflex Ring</Text>
      <Text style={styles.muted}>{state === "ready" ? "Tap now." : state === "waiting" ? "Wait for cyan." : "Start and react to the signal."}</Text>
      <Pressable style={[styles.reflexCircle, state === "ready" && styles.reflexReady]} onPress={state === "idle" || state === "done" ? start : press}>
        <Text style={styles.reflexText}>{state === "idle" ? "Start" : state === "waiting" ? "..." : state === "ready" ? "Tap" : "Again"}</Text>
      </Pressable>
      {lastMs !== null && <Text style={styles.stageScore}>{lastMs}ms</Text>}
    </GlassCard>
  );
}

function HeroStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatValue}>{value}</Text>
      <Text style={styles.heroStatLabel}>{label}</Text>
    </View>
  );
}

function shuffle<T>(items: T[]) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

const styles = StyleSheet.create({
  hero: { borderRadius: 8, padding: 18, marginTop: 8 },
  heroTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  eyebrow: { color: "rgba(255,255,255,0.75)", fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  title: { color: colors.text, fontSize: 32, fontWeight: "900", marginTop: 4 },
  heroCopy: { color: "rgba(255,255,255,0.78)", fontSize: 14, lineHeight: 20, marginTop: 12, fontWeight: "700" },
  heroStats: { flexDirection: "row", gap: 10, marginTop: 16 },
  heroStat: { flex: 1, backgroundColor: "rgba(255,255,255,0.16)", borderRadius: 8, padding: 10 },
  heroStatValue: { color: colors.text, fontSize: 20, fontWeight: "900" },
  heroStatLabel: { color: "rgba(255,255,255,0.74)", fontSize: 11, fontWeight: "800", marginTop: 2 },
  sectionTitle: { color: colors.text, fontSize: 20, fontWeight: "900", marginBottom: 10 },
  sectionHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  gamePicker: { gap: 10, paddingRight: 20 },
  gameCard: { width: 150, minHeight: 132, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, padding: 12, gap: 6 },
  gameCardActive: { backgroundColor: colors.gold, borderColor: colors.gold },
  gameTitle: { color: colors.text, fontSize: 15, fontWeight: "900" },
  gameTitleActive: { color: colors.ink },
  gameSub: { color: colors.muted, fontSize: 11, fontWeight: "800", lineHeight: 15 },
  gameSubActive: { color: "rgba(5,7,19,0.72)" },
  bestText: { color: colors.gold, fontSize: 12, fontWeight: "900", marginTop: "auto" },
  rulePill: { flexDirection: "row", alignItems: "center", gap: 5, borderRadius: 8, backgroundColor: "rgba(246,180,75,0.1)", borderWidth: 1, borderColor: "rgba(246,180,75,0.25)", paddingHorizontal: 8, paddingVertical: 6, flexShrink: 1 },
  ruleText: { color: colors.gold, fontSize: 11, fontWeight: "900" },
  stage: { gap: 12 },
  stageHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  stageTitle: { color: colors.text, fontSize: 18, fontWeight: "900" },
  stageScore: { color: colors.gold, fontSize: 44, fontWeight: "900", textAlign: "center" },
  muted: { color: colors.muted, fontSize: 13, fontWeight: "700", lineHeight: 19 },
  bigGameButton: { height: 132, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelStrong, borderWidth: 1, borderColor: colors.line },
  bigGameButtonActive: { backgroundColor: colors.pink, borderColor: colors.pink },
  bigGameButtonText: { color: colors.text, fontSize: 26, fontWeight: "900" },
  memoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  memoryCard: { width: "23%", aspectRatio: 1, borderRadius: 8, backgroundColor: colors.panelStrong, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: colors.line },
  memoryCardOpen: { backgroundColor: colors.gold, borderColor: colors.gold },
  memoryText: { color: colors.muted, fontSize: 16, fontWeight: "900" },
  memoryTextOpen: { color: colors.ink, fontSize: 11 },
  resetBtn: { width: 38, height: 38, borderRadius: 8, alignItems: "center", justifyContent: "center", backgroundColor: colors.panelStrong },
  reflexCircle: { width: 190, height: 190, borderRadius: 95, alignSelf: "center", alignItems: "center", justifyContent: "center", backgroundColor: colors.panelStrong, borderWidth: 2, borderColor: colors.line, marginVertical: 8 },
  reflexReady: { backgroundColor: colors.cyan, borderColor: colors.cyan },
  reflexText: { color: colors.text, fontSize: 28, fontWeight: "900" },
  resultCard: { marginTop: 12, gap: 12 },
  socialCard: { marginTop: 12, gap: 12 },
  resultTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  resultTitle: { color: colors.text, fontSize: 16, fontWeight: "900" },
  resultMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 3 },
  submitBtn: { height: 44, borderRadius: 8, backgroundColor: colors.pink, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  submitText: { color: colors.text, fontWeight: "900" },
  disabled: { opacity: 0.6 },
  leaderboard: { gap: 8 },
  rankRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  rank: { width: 34, color: colors.gold, fontSize: 16, fontWeight: "900" },
  rankName: { color: colors.text, fontWeight: "900", fontSize: 14 },
  rankMeta: { color: colors.muted, fontSize: 12, fontWeight: "700", marginTop: 2 },
  rankScore: { color: colors.gold, fontSize: 18, fontWeight: "900" },
  recentRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
  recentGame: { color: colors.text, fontWeight: "900", textTransform: "capitalize" },
  recentScore: { color: colors.gold, fontWeight: "900" },
  missionGrid: { gap: 8 },
  missionCard: { gap: 8 },
  missionTitle: { color: colors.text, fontWeight: "900", fontSize: 14 },
  missionMeta: { color: colors.muted, fontWeight: "800", fontSize: 12 },
  progressTrack: { height: 7, borderRadius: 8, backgroundColor: colors.line, overflow: "hidden" },
  progressFill: { height: 7, borderRadius: 8, backgroundColor: colors.gold },
  targetList: { gap: 8 },
  targetRow: { minHeight: 50, borderRadius: 8, backgroundColor: colors.panelStrong, padding: 10, flexDirection: "row", alignItems: "center", gap: 8 },
  targetName: { color: colors.text, fontSize: 13, fontWeight: "900" },
  targetMeta: { color: colors.muted, fontSize: 11, fontWeight: "700", marginTop: 2 },
  smallAction: { height: 32, borderRadius: 8, backgroundColor: colors.panel, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 8, flexDirection: "row", alignItems: "center", gap: 4 },
  smallActionText: { color: colors.text, fontSize: 11, fontWeight: "900" },
  challengeAction: { backgroundColor: colors.gold, borderColor: colors.gold },
  challengeActionText: { color: colors.ink },
  clanChallengeBtn: { minHeight: 42, borderRadius: 8, backgroundColor: colors.gold, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8 },
  clanChallengeText: { color: colors.ink, fontWeight: "900" },
  challengeBlock: { gap: 8, marginBottom: 12 },
  challengeTitle: { color: colors.muted, fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  challengeRow: { flexDirection: "row", alignItems: "center", gap: 10 }
});
