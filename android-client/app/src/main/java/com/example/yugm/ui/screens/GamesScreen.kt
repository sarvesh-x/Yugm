package com.example.yugm.ui.screens

import android.widget.Toast
import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.api.YugmApi
import com.example.yugm.model.ClanSummary
import com.example.yugm.model.DailyGameMission
import com.example.yugm.model.GameCatalog
import com.example.yugm.model.GameChallenges
import com.example.yugm.model.GameLeaderboard
import com.example.yugm.model.Host
import com.example.yugm.model.MiniGame
import com.example.yugm.model.MiniGameChallenge
import com.example.yugm.model.MiniGameScore
import com.example.yugm.model.SavedGameScoreResult
import com.example.yugm.ui.components.Avatar
import com.example.yugm.ui.components.GlassCard
import com.example.yugm.ui.components.LoadingState
import com.example.yugm.ui.components.SectionTitle
import com.example.yugm.ui.theme.Background
import com.example.yugm.ui.theme.Cyan
import com.example.yugm.ui.theme.Danger
import com.example.yugm.ui.theme.Gold
import com.example.yugm.ui.theme.Line
import com.example.yugm.ui.theme.Panel
import com.example.yugm.ui.theme.PanelStrong
import com.example.yugm.ui.theme.Pink
import com.example.yugm.ui.theme.Purple
import com.example.yugm.ui.theme.Success
import com.example.yugm.ui.theme.TextMuted
import com.example.yugm.ui.theme.TextPrimary
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlin.math.max
import kotlin.random.Random

private data class FinishedGameScore(
    val gameId: String,
    val score: Int,
    val durationMs: Int? = null,
    val rounds: Int? = null
)

private val fallbackGames = listOf(
    MiniGame("vibe_tap", "Vibe Tap", "Tap fast, hold a streak, and climb the board.", 10, "Higher score wins"),
    MiniGame("memory_match", "Memory Match", "Flip pairs and clear the board with fewer moves.", 60, "Efficiency score wins"),
    MiniGame("reflex_ring", "Reflex Ring", "Wait for the signal and tap fast.", 15, "Fast reactions score higher")
)

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun GamesScreen(
    token: String,
    onBack: () -> Unit,
    onOpenChat: (String) -> Unit
) {
    val context = LocalContext.current
    val scope = rememberCoroutineScope()
    var selectedGame by remember { mutableStateOf("vibe_tap") }
    var catalog by remember { mutableStateOf<GameCatalog?>(null) }
    var missions by remember { mutableStateOf<List<DailyGameMission>>(emptyList()) }
    var challenges by remember { mutableStateOf(GameChallenges()) }
    var leaderboard by remember { mutableStateOf(GameLeaderboard()) }
    var closeFriends by remember { mutableStateOf<List<Host>>(emptyList()) }
    var myClan by remember { mutableStateOf<ClanSummary?>(null) }
    var finishedScore by remember { mutableStateOf<FinishedGameScore?>(null) }
    var savedResult by remember { mutableStateOf<SavedGameScoreResult?>(null) }
    var isLoading by remember { mutableStateOf(true) }
    var isSaving by remember { mutableStateOf(false) }
    var actionBusy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    fun loadLeaderboard(gameId: String) {
        scope.launch {
            runCatching { YugmApi.gameLeaderboard(token, gameId) }
                .onSuccess { leaderboard = it }
                .onFailure { error = it.message ?: "Failed to load leaderboard" }
        }
    }

    fun refreshAll() {
        isLoading = true
        error = null
        scope.launch {
            runCatching {
                val loadedCatalog = YugmApi.gameCatalog(token)
                catalog = loadedCatalog
                missions = YugmApi.gameMissions(token).missions
                challenges = YugmApi.gameChallenges(token)
                closeFriends = YugmApi.closeFriends(token)
                myClan = YugmApi.myClan(token)
                leaderboard = YugmApi.gameLeaderboard(token, selectedGame)
            }.onFailure {
                error = it.message ?: "Could not load arcade"
            }
            isLoading = false
        }
    }

    LaunchedEffect(token) {
        if (token.isNotBlank()) refreshAll()
    }

    LaunchedEffect(selectedGame) {
        if (token.isNotBlank()) loadLeaderboard(selectedGame)
    }

    fun saveScore(score: FinishedGameScore) {
        isSaving = true
        scope.launch {
            runCatching {
                YugmApi.submitGameScore(token, score.gameId, score.score, score.durationMs, score.rounds)
            }.onSuccess {
                savedResult = it
                finishedScore = null
                Toast.makeText(
                    context,
                    if (it.isPersonalBest) "New personal best: ${it.score.score}. +${it.reward.xpAwarded} XP" else "Score saved: ${it.score.score}",
                    Toast.LENGTH_SHORT
                ).show()
                refreshAll()
            }.onFailure {
                Toast.makeText(context, it.message ?: "Could not save score", Toast.LENGTH_SHORT).show()
            }
            isSaving = false
        }
    }

    fun sendChallenge(targetUserId: String? = null, clanId: String? = null) {
        val score = savedResult?.score ?: return
        actionBusy = true
        scope.launch {
            runCatching {
                YugmApi.sendGameChallenge(
                    token = token,
                    gameId = score.gameId,
                    score = score.score,
                    scoreId = score.id,
                    targetUserId = targetUserId,
                    clanId = clanId
                )
            }.onSuccess {
                Toast.makeText(context, "Challenge sent", Toast.LENGTH_SHORT).show()
                challenges = YugmApi.gameChallenges(token)
                missions = YugmApi.gameMissions(token).missions
            }.onFailure {
                Toast.makeText(context, it.message ?: "Could not send challenge", Toast.LENGTH_SHORT).show()
            }
            actionBusy = false
        }
    }

    fun shareScore(targetUserId: String) {
        val scoreId = savedResult?.score?.id ?: return
        actionBusy = true
        scope.launch {
            runCatching { YugmApi.shareGameScore(token, scoreId, targetUserId) }
                .onSuccess {
                    Toast.makeText(context, "Shared in chat", Toast.LENGTH_SHORT).show()
                    onOpenChat(targetUserId)
                }
                .onFailure { Toast.makeText(context, it.message ?: "Could not share score", Toast.LENGTH_SHORT).show() }
            actionBusy = false
        }
    }

    val games = catalog?.games?.ifEmpty { fallbackGames } ?: fallbackGames
    val selectedCatalogGame = games.find { it.id == selectedGame } ?: games.first()

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("Yugm Arcade", color = TextPrimary, fontWeight = FontWeight.Black) },
                navigationIcon = {
                    TextButton(onClick = onBack) { Text("Back", color = Gold, fontWeight = FontWeight.Bold) }
                },
                actions = {
                    TextButton(onClick = { refreshAll() }) { Text("Refresh", color = Gold, fontWeight = FontWeight.Bold) }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = Background)
            )
        },
        containerColor = Background
    ) { innerPadding ->
        if (isLoading && catalog == null) {
            Box(Modifier.fillMaxSize().padding(innerPadding), contentAlignment = Alignment.Center) {
                LoadingState("Loading arcade...")
            }
        } else {
            LazyColumn(
                modifier = Modifier.fillMaxSize().padding(innerPadding),
                contentPadding = PaddingValues(20.dp),
                verticalArrangement = Arrangement.spacedBy(16.dp)
            ) {
                item {
                    ArcadeHero(
                        gamesCount = games.size,
                        best = selectedCatalogGame.best?.score ?: 0,
                        error = error
                    )
                }
                item {
                    SectionTitle("Choose a Game")
                    Row(
                        modifier = Modifier.padding(top = 10.dp).horizontalScroll(rememberScrollState()),
                        horizontalArrangement = Arrangement.spacedBy(10.dp)
                    ) {
                        games.forEach { game ->
                            GamePickerCard(
                                game = game,
                                selected = game.id == selectedGame,
                                onClick = {
                                    selectedGame = game.id
                                    finishedScore = null
                                    savedResult = null
                                }
                            )
                        }
                    }
                }
                item {
                    SectionTitle("Daily Missions")
                    Column(Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        missions.ifEmpty {
                            listOf(DailyGameMission(title = "Play arcade rounds", target = 3, rewardXp = 12))
                        }.forEach { MissionCard(it) }
                    }
                }
                item {
                    Row(
                        Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically
                    ) {
                        SectionTitle(selectedCatalogGame.title)
                        Text(selectedCatalogGame.scoring, color = Gold, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    }
                    GameStage(
                        gameId = selectedGame,
                        modifier = Modifier.padding(top = 10.dp),
                        onFinish = {
                            finishedScore = it
                            savedResult = null
                        }
                    )
                }
                finishedScore?.let { score ->
                    item {
                        GlassCard {
                            Text("Score ready: ${score.score}", color = TextPrimary, fontSize = 18.sp, fontWeight = FontWeight.Black)
                            Text("Save it to update your best and leaderboard rank.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 4.dp, bottom = 12.dp))
                            Button(
                                onClick = { saveScore(score) },
                                enabled = !isSaving,
                                colors = ButtonDefaults.buttonColors(containerColor = Pink),
                                shape = RoundedCornerShape(8.dp),
                                modifier = Modifier.fillMaxWidth().height(46.dp)
                            ) {
                                if (isSaving) CircularProgressIndicator(color = TextPrimary, modifier = Modifier.size(18.dp), strokeWidth = 2.dp)
                                else Text("Save Score", color = TextPrimary, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                }
                savedResult?.score?.let { score ->
                    item {
                        SocialScoreActions(
                            score = score,
                            friends = closeFriends,
                            clan = myClan,
                            busy = actionBusy,
                            onChallengeUser = { sendChallenge(targetUserId = it) },
                            onChallengeClan = { sendChallenge(clanId = it) },
                            onShare = { shareScore(it) }
                        )
                    }
                }
                item {
                    SectionTitle("Active Challenges")
                    ChallengeList("For you", challenges.incoming, onPlay = { selectedGame = it })
                    ChallengeList("Family board", challenges.clan, onPlay = { selectedGame = it })
                }
                item {
                    SectionTitle("Leaderboard")
                }
                if (leaderboard.leaderboard.isEmpty()) {
                    item { GlassCard { Text("No scores yet. Be the first name on this board.", color = TextMuted) } }
                } else {
                    items(leaderboard.leaderboard.take(10), key = { "${it.userId}-${it.score}" }) { row ->
                        LeaderboardRow(rank = leaderboard.leaderboard.indexOf(row) + 1, name = row.user.name, username = row.user.username, level = row.user.level, score = row.score)
                    }
                }
                item {
                    SectionTitle("Recent Runs")
                    Column(Modifier.padding(top = 10.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                        val recent = catalog?.recent.orEmpty()
                        if (recent.isEmpty()) {
                            GlassCard { Text("Your latest scores will appear here.", color = TextMuted) }
                        } else {
                            recent.take(5).forEach { RecentScoreRow(it) }
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun ArcadeHero(gamesCount: Int, best: Int, error: String?) {
    Box(
        modifier = Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(Brush.linearGradient(listOf(Pink, Gold, Purple)))
            .padding(18.dp)
    ) {
        Column {
            Text("Mini Games", color = Color.White, fontSize = 32.sp, fontWeight = FontWeight.Black)
            Text(
                "Play quick games between chats, chase personal bests, and climb the community leaderboard.",
                color = Color.White.copy(alpha = 0.78f),
                fontSize = 14.sp,
                lineHeight = 20.sp,
                fontWeight = FontWeight.Bold,
                modifier = Modifier.padding(top = 8.dp)
            )
            Row(Modifier.padding(top = 16.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                HeroStat("Games", gamesCount.toString(), Modifier.weight(1f))
                HeroStat("Best", best.toString(), Modifier.weight(1f))
                HeroStat("Reward", "XP", Modifier.weight(1f))
            }
            if (!error.isNullOrBlank()) {
                Text(error, color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 10.dp))
            }
        }
    }
}

@Composable
private fun HeroStat(label: String, value: String, modifier: Modifier) {
    Column(
        modifier = modifier.clip(RoundedCornerShape(8.dp)).background(Color.White.copy(alpha = 0.16f)).padding(10.dp)
    ) {
        Text(value, color = Color.White, fontWeight = FontWeight.Black, fontSize = 19.sp)
        Text(label, color = Color.White.copy(alpha = 0.75f), fontWeight = FontWeight.Bold, fontSize = 11.sp)
    }
}

@Composable
private fun GamePickerCard(game: MiniGame, selected: Boolean, onClick: () -> Unit) {
    val accent = when (game.id) {
        "memory_match" -> Gold
        "reflex_ring" -> Cyan
        else -> Pink
    }
    Surface(
        color = if (selected) Gold else Panel,
        border = BorderStroke(1.dp, if (selected) Gold else Line),
        shape = RoundedCornerShape(8.dp),
        modifier = Modifier.width(154.dp).height(138.dp).clickable(onClick = onClick)
    ) {
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(game.title, color = if (selected) Background else TextPrimary, fontWeight = FontWeight.Black, fontSize = 15.sp)
            Text(game.description, color = if (selected) Background.copy(alpha = 0.72f) else TextMuted, fontWeight = FontWeight.Bold, fontSize = 11.sp, maxLines = 3, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.weight(1f))
            Text("Best: ${game.best?.score ?: 0}", color = if (selected) Background else accent, fontWeight = FontWeight.Black, fontSize = 12.sp)
        }
    }
}

@Composable
private fun MissionCard(mission: DailyGameMission) {
    val fraction = if (mission.target <= 0) 0f else (mission.progress.toFloat() / mission.target.toFloat()).coerceIn(0f, 1f)
    GlassCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(mission.title, color = TextPrimary, fontWeight = FontWeight.Black)
            Text(if (mission.complete) "Done" else "+${mission.rewardXp} XP", color = if (mission.complete) Success else Gold, fontWeight = FontWeight.Black, fontSize = 12.sp)
        }
        Text("${mission.progress}/${mission.target}", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold, modifier = Modifier.padding(top = 4.dp))
        Box(Modifier.fillMaxWidth().height(7.dp).padding(top = 4.dp).clip(RoundedCornerShape(8.dp)).background(Line)) {
            Box(Modifier.fillMaxWidth(fraction).height(7.dp).background(Gold))
        }
    }
}

@Composable
private fun GameStage(gameId: String, modifier: Modifier = Modifier, onFinish: (FinishedGameScore) -> Unit) {
    when (gameId) {
        "memory_match" -> MemoryMatch(modifier, onFinish)
        "reflex_ring" -> ReflexRing(modifier, onFinish)
        else -> VibeTap(modifier, onFinish)
    }
}

@Composable
private fun VibeTap(modifier: Modifier, onFinish: (FinishedGameScore) -> Unit) {
    var running by remember { mutableStateOf(false) }
    var taps by remember { mutableIntStateOf(0) }
    var combo by remember { mutableIntStateOf(1) }

    LaunchedEffect(running) {
        if (running) {
            delay(10_000)
            running = false
            onFinish(FinishedGameScore("vibe_tap", taps * 10, durationMs = 10_000, rounds = taps))
        }
    }

    GlassCard(modifier) {
        Text("Tap the pulse", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
        Text("${taps * 10}", color = Gold, fontSize = 44.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.CenterHorizontally))
        Text("Combo x$combo. The round lasts 10 seconds.", color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Bold)
        Box(
            modifier = Modifier
                .fillMaxWidth()
                .height(132.dp)
                .clip(RoundedCornerShape(8.dp))
                .background(if (running) Pink else PanelStrong)
                .clickable {
                    if (running) {
                        taps += combo
                        combo = (combo + 1).coerceAtMost(5)
                    } else {
                        taps = 0
                        combo = 1
                        running = true
                    }
                },
            contentAlignment = Alignment.Center
        ) {
            Text(if (running) "TAP" else "Start", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 26.sp)
        }
    }
}

@Composable
private fun MemoryMatch(modifier: Modifier, onFinish: (FinishedGameScore) -> Unit) {
    val scope = rememberCoroutineScope()
    var cards by remember { mutableStateOf(shuffledMemoryCards()) }
    var open by remember { mutableStateOf<List<Int>>(emptyList()) }
    var matched by remember { mutableStateOf<Set<Int>>(emptySet()) }
    var moves by remember { mutableIntStateOf(0) }
    var startedAt by remember { mutableLongStateOf(System.currentTimeMillis()) }

    fun reset() {
        cards = shuffledMemoryCards()
        open = emptyList()
        matched = emptySet()
        moves = 0
        startedAt = System.currentTimeMillis()
    }

    fun flip(index: Int) {
        if (open.contains(index) || matched.contains(index) || open.size == 2) return
        val nextOpen = open + index
        open = nextOpen
        if (nextOpen.size == 2) {
            val nextMoves = moves + 1
            moves = nextMoves
            val a = nextOpen[0]
            val b = nextOpen[1]
            if (cards[a] == cards[b]) {
                val nextMatched = matched + a + b
                matched = nextMatched
                open = emptyList()
                if (nextMatched.size == cards.size) {
                    val duration = (System.currentTimeMillis() - startedAt).toInt()
                    val score = max(100, 1200 - nextMoves * 80 - duration / 250)
                    onFinish(FinishedGameScore("memory_match", score, durationMs = duration, rounds = nextMoves))
                }
            } else {
                scope.launch {
                    delay(700)
                    open = emptyList()
                }
            }
        }
    }

    GlassCard(modifier) {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Column {
                Text("Match all pairs", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                Text("Moves: $moves", color = TextMuted, fontSize = 12.sp)
            }
            OutlinedButton(onClick = { reset() }, border = BorderStroke(1.dp, Line), shape = RoundedCornerShape(8.dp)) {
                Text("Reset", color = TextPrimary)
            }
        }
        cards.chunked(4).forEachIndexed { rowIndex, row ->
            Row(Modifier.fillMaxWidth().padding(top = 8.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                row.forEachIndexed { columnIndex, card ->
                    val index = rowIndex * 4 + columnIndex
                    val visible = open.contains(index) || matched.contains(index)
                    Box(
                        modifier = Modifier
                            .weight(1f)
                            .aspectRatio(1f)
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (visible) Gold else PanelStrong)
                            .clickable { flip(index) },
                        contentAlignment = Alignment.Center
                    ) {
                        Text(if (visible) card else "?", color = if (visible) Background else TextMuted, fontWeight = FontWeight.Black, fontSize = if (visible) 11.sp else 18.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ReflexRing(modifier: Modifier, onFinish: (FinishedGameScore) -> Unit) {
    val context = LocalContext.current
    var state by remember { mutableStateOf("idle") }
    var readyAt by remember { mutableLongStateOf(0L) }
    var lastMs by remember { mutableStateOf<Int?>(null) }

    LaunchedEffect(state) {
        if (state == "waiting") {
            delay((900 + Random.nextInt(2200)).toLong())
            readyAt = System.currentTimeMillis()
            state = "ready"
        }
    }

    fun press() {
        when (state) {
            "idle", "done" -> {
                lastMs = null
                state = "waiting"
            }
            "waiting" -> {
                state = "idle"
                Toast.makeText(context, "Too soon. Wait for cyan.", Toast.LENGTH_SHORT).show()
            }
            "ready" -> {
                val reaction = (System.currentTimeMillis() - readyAt).toInt()
                val score = max(50, 1000 - reaction)
                lastMs = reaction
                state = "done"
                onFinish(FinishedGameScore("reflex_ring", score, durationMs = reaction, rounds = 1))
            }
        }
    }

    GlassCard(modifier) {
        Text("Reflex Ring", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
        Text(
            when (state) {
                "ready" -> "Tap now."
                "waiting" -> "Wait for cyan."
                else -> "Start and react to the signal."
            },
            color = TextMuted,
            fontSize = 12.sp,
            fontWeight = FontWeight.Bold
        )
        Box(
            modifier = Modifier
                .size(190.dp)
                .align(Alignment.CenterHorizontally)
                .padding(vertical = 8.dp)
                .clip(CircleShape)
                .background(if (state == "ready") Cyan else PanelStrong)
                .clickable { press() },
            contentAlignment = Alignment.Center
        ) {
            Text(
                when (state) {
                    "waiting" -> "..."
                    "ready" -> "Tap"
                    "done" -> "Again"
                    else -> "Start"
                },
                color = TextPrimary,
                fontWeight = FontWeight.Black,
                fontSize = 28.sp
            )
        }
        lastMs?.let { Text("${it}ms", color = Gold, fontSize = 32.sp, fontWeight = FontWeight.Black, modifier = Modifier.align(Alignment.CenterHorizontally)) }
    }
}

@Composable
private fun SocialScoreActions(
    score: MiniGameScore,
    friends: List<Host>,
    clan: ClanSummary?,
    busy: Boolean,
    onChallengeUser: (String) -> Unit,
    onChallengeClan: (String) -> Unit,
    onShare: (String) -> Unit
) {
    GlassCard {
        Text("Turn ${score.score} into a challenge", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 17.sp)
        Text("Challenge close friends, your family, or share it in a private chat.", color = TextMuted, fontSize = 12.sp, modifier = Modifier.padding(top = 3.dp, bottom = 10.dp))
        if (friends.isEmpty()) {
            Text("Add close friends to share score cards and send direct challenges.", color = TextMuted, fontSize = 12.sp)
        } else {
            friends.take(4).forEach { friend ->
                Row(
                    Modifier.fillMaxWidth().padding(vertical = 5.dp).clip(RoundedCornerShape(8.dp)).background(PanelStrong).padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                    horizontalArrangement = Arrangement.spacedBy(8.dp)
                ) {
                    Avatar(friend.name.firstOrNull()?.toString() ?: "?", 38, imageUrl = friend.avatar, cosmetics = friend.activeCosmetics)
                    Column(Modifier.weight(1f)) {
                        Text(friend.name, color = TextPrimary, fontWeight = FontWeight.Black, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text("@${friend.username}", color = TextMuted, fontSize = 11.sp)
                    }
                    TextButton(onClick = { onShare(friend.id) }, enabled = !busy) { Text("Share", color = TextPrimary, fontWeight = FontWeight.Bold) }
                    Button(
                        onClick = { onChallengeUser(friend.id) },
                        enabled = !busy,
                        colors = ButtonDefaults.buttonColors(containerColor = Gold),
                        shape = RoundedCornerShape(8.dp)
                    ) { Text("Challenge", color = Background, fontSize = 12.sp, fontWeight = FontWeight.Black) }
                }
            }
        }
        if (clan?.id?.isNotBlank() == true) {
            Button(
                onClick = { onChallengeClan(clan.id) },
                enabled = !busy,
                colors = ButtonDefaults.buttonColors(containerColor = Gold),
                shape = RoundedCornerShape(8.dp),
                modifier = Modifier.fillMaxWidth().padding(top = 10.dp)
            ) { Text("Challenge ${clan.name}", color = Background, fontWeight = FontWeight.Black) }
        }
    }
}

@Composable
private fun ChallengeList(title: String, items: List<MiniGameChallenge>, onPlay: (String) -> Unit) {
    Text(title, color = TextMuted, fontSize = 12.sp, fontWeight = FontWeight.Black, modifier = Modifier.padding(top = 12.dp, bottom = 8.dp))
    if (items.isEmpty()) {
        GlassCard { Text("No active challenges here yet.", color = TextMuted) }
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
            items.take(4).forEach { item ->
                GlassCard(Modifier.fillMaxWidth().clickable { onPlay(item.gameId) }) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        Text("VS", color = Gold, fontWeight = FontWeight.Black)
                        Column(Modifier.weight(1f)) {
                            Text("${item.challenger?.name ?: "Player"} scored ${item.score}", color = TextPrimary, fontWeight = FontWeight.Black)
                            Text("${friendlyGameName(item.gameId)} / expires ${shortDate(item.expiresAt)}", color = TextMuted, fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun LeaderboardRow(rank: Int, name: String, username: String, level: Int, score: Int) {
    GlassCard {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            Text("#$rank", color = Gold, fontWeight = FontWeight.Black, fontSize = 16.sp, modifier = Modifier.width(42.dp))
            Column(Modifier.weight(1f)) {
                Text(name.ifBlank { "Player" }, color = TextPrimary, fontWeight = FontWeight.Black)
                Text("@${username.ifBlank { "yugm" }} / Level $level", color = TextMuted, fontSize = 12.sp)
            }
            Text("$score", color = Gold, fontWeight = FontWeight.Black, fontSize = 18.sp)
        }
    }
}

@Composable
private fun RecentScoreRow(score: MiniGameScore) {
    GlassCard {
        Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween, verticalAlignment = Alignment.CenterVertically) {
            Text(friendlyGameName(score.gameId), color = TextPrimary, fontWeight = FontWeight.Black)
            Text("${score.score}", color = Gold, fontWeight = FontWeight.Black)
        }
    }
}

private fun shuffledMemoryCards(): List<String> = listOf("PINK", "GOLD", "CYAN", "FIRE").let { (it + it).shuffled() }

private fun friendlyGameName(gameId: String): String = gameId.split("_").joinToString(" ") { part ->
    part.replaceFirstChar { if (it.isLowerCase()) it.titlecase() else it.toString() }
}

private fun shortDate(value: String): String = value.take(10).ifBlank { "soon" }
