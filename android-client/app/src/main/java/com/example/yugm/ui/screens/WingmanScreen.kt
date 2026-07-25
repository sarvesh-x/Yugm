package com.example.yugm.ui.screens

import androidx.compose.animation.*
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.example.yugm.core.model.*
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.theme.*
import com.example.yugm.ui.viewmodel.WingmanAction
import com.example.yugm.ui.viewmodel.WingmanTab
import com.example.yugm.ui.viewmodel.WingmanViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun WingmanScreen(
    token: String,
    onBack: () -> Unit,
    viewModel: WingmanViewModel = hiltViewModel(),
) {
    val state by viewModel.state.collectAsState()
    viewModel.setToken(token)

    Scaffold(
        topBar = {
            TopAppBar(
                title = {
                    Text("AI Wingman", fontWeight = FontWeight.Bold)
                },
                navigationIcon = {
                    TextButton(onClick = onBack) {
                        Text("Back", color = TextPrimaryColor)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = Background,
                    titleContentColor = TextPrimaryColor,
                )
            )
        },
        containerColor = Background,
    ) { padding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
        ) {
            WingmanTabBar(
                activeTab = state.activeTab,
                onTabSelected = { viewModel.onAction(WingmanAction.SetActiveTab(it)) }
            )

            when (state.activeTab) {
                WingmanTab.BIO -> BioCoachTab(state, viewModel)
                WingmanTab.OPENERS -> OpenersTab(state, viewModel)
                WingmanTab.REPLIES -> RepliesTab(state, viewModel)
                WingmanTab.COACH -> ConversationCoachTab(state, viewModel)
                WingmanTab.GHOST -> GhostDetectTab(state, viewModel)
                WingmanTab.DATES -> DatePlannerTab(state, viewModel)
                WingmanTab.GIFTS -> GiftAdvisorTab(state, viewModel)
                WingmanTab.ANALYTICS -> AnalyticsTab(state, viewModel)
            }
        }
    }
}

@Composable
private fun WingmanTabBar(activeTab: WingmanTab, onTabSelected: (WingmanTab) -> Unit) {
    val tabs = WingmanTab.entries
    PrimaryScrollableTabRow(
        selectedTabIndex = tabs.indexOf(activeTab),
        containerColor = Background,
        contentColor = PrimaryPink,
        edgePadding = 0.dp,
        divider = {},
    ) {
        tabs.forEach { tab ->
            Tab(
                selected = activeTab == tab,
                onClick = { onTabSelected(tab) },
                text = {
                    Text(
                        text = tab.name.lowercase().replaceFirstChar { it.uppercase() },
                        fontSize = 12.sp,
                        maxLines = 1,
                    )
                },
                selectedContentColor = PrimaryPink,
                unselectedContentColor = TextSecondaryColor,
            )
        }
    }
}

@Composable
private fun LoadingOverlay(isLoading: Boolean, content: @Composable () -> Unit) {
    Box {
        content()
        if (isLoading) {
            Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center,
            ) {
                CircularProgressIndicator(color = PrimaryPink)
            }
        }
    }
}

@Composable
private fun ErrorBanner(error: String?, onDismiss: () -> Unit) {
    error?.let {
        Snackbar(
            modifier = Modifier.padding(16.dp),
            action = {
                TextButton(onClick = onDismiss) {
                    Text("Dismiss", color = Color.White)
                }
            },
            containerColor = DangerRed,
        ) {
            Text(it, color = Color.White)
        }
    }
}

@Composable
private fun BioCoachTab(state: com.example.yugm.ui.viewmodel.WingmanState, viewModel: WingmanViewModel) {
    var currentBio by remember { mutableStateOf("") }
    var style by remember { mutableStateOf("warm") }
    val scrollState = rememberScrollState()
    val styles = listOf("warm", "funny", "mysterious", "confident", "creative", "professional")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GlassCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Bio Generator", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Let AI craft the perfect bio for your profile", color = TextSecondaryColor, fontSize = 14.sp)

                OutlinedTextField(
                    value = currentBio,
                    onValueChange = { currentBio = it },
                    label = { Text("Current Bio (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPink,
                        unfocusedBorderColor = BorderColor,
                        focusedLabelColor = PrimaryPink,
                        cursorColor = PrimaryPink,
                    ),
                )

                Text("Style", color = TextSecondaryColor, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    styles.forEach { s ->
                        FilterChip(
                            selected = style == s,
                            onClick = { style = s },
                            label = { Text(s.replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PrimaryPink.copy(alpha = 0.2f),
                                selectedLabelColor = PrimaryPink,
                            ),
                        )
                    }
                }

                Button(
                    onClick = { viewModel.onAction(WingmanAction.GenerateBio(currentBio.ifBlank { null }, style)) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                    enabled = !state.isLoading,
                ) {
                    Text("Generate Bio ✨")
                }
            }
        }

        state.bioSuggestion?.let { suggestion ->
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("✨ Your AI Bio", color = PrimaryPink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Text(suggestion, color = TextPrimaryColor, fontSize = 15.sp)
                    state.bioTips.forEach { tip ->
                        Text("  $tip", color = TextSecondaryColor, fontSize = 12.sp)
                    }
                }
            }
        }

        GlassCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Bio Rating", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                var bioToRate by remember { mutableStateOf("") }
                OutlinedTextField(
                    value = bioToRate,
                    onValueChange = { bioToRate = it },
                    label = { Text("Paste a bio to rate") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 2,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPurple,
                        unfocusedBorderColor = BorderColor,
                        focusedLabelColor = PrimaryPurple,
                        cursorColor = PrimaryPurple,
                    ),
                )
                Button(
                    onClick = { viewModel.onAction(WingmanAction.RateBio(bioToRate)) },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                    enabled = !state.isLoading && bioToRate.isNotBlank(),
                ) {
                    Text("Rate Bio")
                }
            }
        }

        state.bioScore?.let { score ->
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(
                                    Brush.sweepGradient(listOf(
                                        if (score.score >= 70) SuccessGreen else if (score.score >= 50) SaffronGold else DangerRed,
                                        PrimaryPink,
                                    ))
                                ),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text("${score.score}", color = Color.White, fontWeight = FontWeight.Bold, fontSize = 20.sp)
                        }
                        Column {
                            Text(score.rating, color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                            Text("Bio Score", color = TextSecondaryColor, fontSize = 13.sp)
                        }
                    }
                    score.feedback.forEach { fb ->
                        Text("  $fb", color = TextSecondaryColor, fontSize = 12.sp)
                    }
                }
            }
        }

        ErrorBanner(state.error) { viewModel.onAction(WingmanAction.ClearError) }
    }
}

@Composable
private fun OpenersTab(state: com.example.yugm.ui.viewmodel.WingmanState, viewModel: WingmanViewModel) {
    var name by remember { mutableStateOf("") }
    var interests by remember { mutableStateOf("") }
    var style by remember { mutableStateOf("casual") }
    val scrollState = rememberScrollState()
    val styles = listOf("casual", "funny", "smooth", "direct", "thoughtful")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GlassCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Conversation Openers", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Never stare at a blank chat again", color = TextSecondaryColor, fontSize = 14.sp)

                OutlinedTextField(
                    value = name,
                    onValueChange = { name = it },
                    label = { Text("Their Name (optional)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPink,
                        unfocusedBorderColor = BorderColor,
                        focusedLabelColor = PrimaryPink,
                        cursorColor = PrimaryPink,
                    ),
                )

                OutlinedTextField(
                    value = interests,
                    onValueChange = { interests = it },
                    label = { Text("Their Interests (comma separated)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPink,
                        unfocusedBorderColor = BorderColor,
                        focusedLabelColor = PrimaryPink,
                        cursorColor = PrimaryPink,
                    ),
                )

                Text("Style", color = TextSecondaryColor, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    styles.forEach { s ->
                        FilterChip(
                            selected = style == s,
                            onClick = { style = s },
                            label = { Text(s.replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
                            colors = FilterChipDefaults.filterChipColors(
                                selectedContainerColor = PrimaryPink.copy(alpha = 0.2f),
                                selectedLabelColor = PrimaryPink,
                            ),
                        )
                    }
                }

                Button(
                    onClick = {
                        viewModel.onAction(WingmanAction.GenerateOpeners(
                            targetContext = WingmanTargetContext(
                                name = name.ifBlank { null },
                                interests = interests.split(",").map { it.trim() }.filter { it.isNotBlank() }.ifEmpty { null },
                            ),
                            style = style,
                        ))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                    enabled = !state.isLoading,
                ) {
                    Text("Generate Openers 🎯")
                }
            }
        }

        if (state.openers.isNotEmpty()) {
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Your Openers", color = PrimaryPink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    state.openers.forEachIndexed { idx, opener ->
                        Row(verticalAlignment = Alignment.Top, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                            Box(
                                modifier = Modifier
                                    .size(24.dp)
                                    .clip(CircleShape)
                                    .background(PrimaryPink),
                                contentAlignment = Alignment.Center,
                            ) {
                                Text("${idx + 1}", color = Color.White, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                            }
                            Text(opener, color = TextPrimaryColor, fontSize = 14.sp, modifier = Modifier.weight(1f))
                        }
                    }
                    if (state.openersTip.isNotBlank()) {
                        Text("  ${state.openersTip}", color = TextSecondaryColor, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun RepliesTab(state: com.example.yugm.ui.viewmodel.WingmanState, viewModel: WingmanViewModel) {
    var lastMessage by remember { mutableStateOf("") }
    var style by remember { mutableStateOf("friendly") }
    val scrollState = rememberScrollState()
    val styles = listOf("friendly", "flirty", "smooth", "direct", "funny")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GlassCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Reply Assistant", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Never be stuck on what to say next", color = TextSecondaryColor, fontSize = 14.sp)

                OutlinedTextField(
                    value = lastMessage,
                    onValueChange = { lastMessage = it },
                    label = { Text("Their last message") },
                    modifier = Modifier.fillMaxWidth(),
                    minLines = 3,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPink,
                        unfocusedBorderColor = BorderColor,
                    ),
                )

                Text("Vibe", color = TextSecondaryColor, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    styles.forEach { s ->
                        FilterChip(
                            selected = style == s,
                            onClick = { style = s },
                            label = { Text(s.replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
                        )
                    }
                }

                Button(
                    onClick = {
                        viewModel.onAction(WingmanAction.GenerateReplies(
                            conversation = listOf(WingmanMessage(role = "other", content = lastMessage)),
                            style = style,
                        ))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                    enabled = !state.isLoading && lastMessage.isNotBlank(),
                ) {
                    Text("Suggest Replies 💬")
                }
            }
        }

        if (state.replySuggestions.isNotEmpty()) {
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Suggested Replies", color = PrimaryPink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    state.replySuggestions.forEach { suggestion ->
                        Box(
                            modifier = Modifier
                                .fillMaxWidth()
                                .clip(RoundedCornerShape(12.dp))
                                .background(SurfaceElevated)
                                .padding(12.dp),
                        ) {
                            Text(suggestion, color = TextPrimaryColor, fontSize = 14.sp)
                        }
                    }
                    if (state.deliveryTip.isNotBlank()) {
                        Text("  ${state.deliveryTip}", color = TextSecondaryColor, fontSize = 12.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun ConversationCoachTab(state: com.example.yugm.ui.viewmodel.WingmanState, viewModel: WingmanViewModel) {
    var conversationText by remember { mutableStateOf("") }
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GlassCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Conversation Coach", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Get real-time analysis of your chat game", color = TextSecondaryColor, fontSize = 14.sp)

                OutlinedTextField(
                    value = conversationText,
                    onValueChange = { conversationText = it },
                    label = { Text("Paste your conversation") },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 150.dp),
                    minLines = 5,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPurple,
                        unfocusedBorderColor = BorderColor,
                    ),
                )

                Button(
                    onClick = {
                        val lines = conversationText.lines().filter { it.isNotBlank() }
                        val history = lines.mapIndexed { idx, line ->
                            WingmanCoachMessage(
                                role = if (idx % 2 == 0) "user" else "other",
                                content = line,
                            )
                        }
                        viewModel.onAction(WingmanAction.AnalyzeConversation(history))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPurple),
                    enabled = !state.isLoading && conversationText.isNotBlank(),
                ) {
                    Text("Analyze Conversation 📊")
                }
            }
        }

        state.conversationAnalysis?.let { analysis ->
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("Analysis", color = PrimaryPurple, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                        StatBox("Messages", "${analysis.totalMessages}")
                        StatBox("Engagement", "${analysis.engagement}%")
                        StatBox("Chemistry", analysis.chemistry)
                    }
                    if (analysis.yourAvgLength > 0) {
                        Spacer(Modifier.height(8.dp))
                        Text("You avg: ${analysis.yourAvgLength} chars  |  They avg: ${analysis.theirAvgLength} chars", color = TextSecondaryColor, fontSize = 12.sp)
                        Text("You: ${analysis.yourMessageCount} msgs  |  Them: ${analysis.theirMessageCount} msgs", color = TextSecondaryColor, fontSize = 12.sp)
                    }
                }
            }
            state.coachingTips.forEach { tip ->
                GlassCard {
                    Row(modifier = Modifier.padding(16.dp), horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("  ", color = PrimaryPurple, fontSize = 14.sp)
                        Text(tip, color = TextPrimaryColor, fontSize = 14.sp)
                    }
                }
            }
            state.redFlags?.let { flags ->
                GlassCard {
                    Column(modifier = Modifier.padding(16.dp)) {
                        Text("  Red Flags", color = DangerRed, fontWeight = FontWeight.Bold, fontSize = 14.sp)
                        flags.forEach { flag ->
                            Text("  $flag", color = DangerRed.copy(alpha = 0.8f), fontSize = 12.sp)
                        }
                    }
                }
            }
        }
    }
}

@Composable
private fun GhostDetectTab(state: com.example.yugm.ui.viewmodel.WingmanState, viewModel: WingmanViewModel) {
    var ghostConv by remember { mutableStateOf("") }
    val scrollState = rememberScrollState()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GlassCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Ghost Detector", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Worried you're being ghosted? Let's find out", color = TextSecondaryColor, fontSize = 14.sp)

                OutlinedTextField(
                    value = ghostConv,
                    onValueChange = { ghostConv = it },
                    label = { Text("Paste your recent conversation") },
                    modifier = Modifier.fillMaxWidth().heightIn(min = 150.dp),
                    minLines = 5,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = SaffronGold,
                        unfocusedBorderColor = BorderColor,
                    ),
                )

                Button(
                    onClick = {
                        val lines = ghostConv.lines().filter { it.isNotBlank() }
                        val history = lines.map {
                            WingmanCoachMessage(role = "user", content = it)
                        }
                        viewModel.onAction(WingmanAction.DetectGhosting(history))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = SaffronGold),
                    enabled = !state.isLoading && ghostConv.isNotBlank(),
                ) {
                    Text("Detect Ghosting 👻")
                }
            }
        }

        state.ghostDetection?.let { detection ->
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(12.dp)) {
                        Box(
                            modifier = Modifier
                                .size(64.dp)
                                .clip(CircleShape)
                                .background(if (detection.ghosting) DangerRed else SuccessGreen),
                            contentAlignment = Alignment.Center,
                        ) {
                            Text(if (detection.ghosting) "😔" else "😊", fontSize = 28.sp)
                        }
                        Column {
                            Text(
                                if (detection.ghosting) "Ghosting Detected" else "All Clear",
                                color = TextPrimaryColor,
                                fontWeight = FontWeight.Bold,
                                fontSize = 16.sp,
                            )
                            Text("Confidence: ${(detection.confidence * 100).toInt()}%", color = TextSecondaryColor, fontSize = 13.sp)
                        }
                    }
                    Text(detection.reason, color = TextSecondaryColor, fontSize = 13.sp)
                    detection.advice.forEach { advice ->
                        Text("  $advice", color = TextPrimaryColor, fontSize = 13.sp)
                    }
                }
            }
        }
    }
}

@Composable
private fun DatePlannerTab(state: com.example.yugm.ui.viewmodel.WingmanState, viewModel: WingmanViewModel) {
    var vibe by remember { mutableStateOf("romantic") }
    var budget by remember { mutableStateOf("medium") }
    val scrollState = rememberScrollState()
    val vibes = listOf("romantic", "adventurous", "relaxed", "creative", "foodie")
    val budgets = listOf("low", "medium", "high")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GlassCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Date Planner", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Get creative date ideas tailored to you", color = TextSecondaryColor, fontSize = 14.sp)

                Text("Vibe", color = TextSecondaryColor, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    vibes.forEach { v ->
                        FilterChip(
                            selected = vibe == v,
                            onClick = { vibe = v },
                            label = { Text(v.replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
                        )
                    }
                }

                Text("Budget", color = TextSecondaryColor, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    budgets.forEach { b ->
                        FilterChip(
                            selected = budget == b,
                            onClick = { budget = b },
                            label = { Text(b.replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
                        )
                    }
                }

                Button(
                    onClick = {
                        viewModel.onAction(WingmanAction.PlanDate(
                            preferences = WingmanDatePreferences(budget = budget, vibe = vibe),
                        ))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                    enabled = !state.isLoading,
                ) {
                    Text("Plan My Date 🌹")
                }
            }
        }

        state.datePlans.forEach { plan ->
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(plan.name, color = PrimaryPink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(plan.estimatedCost, color = SaffronGold, fontSize = 12.sp)
                    }
                    Text(plan.description, color = TextPrimaryColor, fontSize = 14.sp)
                    Text("Vibe: ${plan.vibe}", color = TextSecondaryColor, fontSize = 12.sp)
                }
            }
        }

        if (state.dateTip.isNotBlank()) {
            Text(state.dateTip, color = TextSecondaryColor, fontSize = 12.sp, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
        }
    }
}

@Composable
private fun GiftAdvisorTab(state: com.example.yugm.ui.viewmodel.WingmanState, viewModel: WingmanViewModel) {
    var relationship by remember { mutableStateOf("crush") }
    var budget by remember { mutableStateOf("medium") }
    var interests by remember { mutableStateOf("") }
    val scrollState = rememberScrollState()
    val relationships = listOf("crush", "date", "friend", "partner", "fan")
    val budgets = listOf("low", "medium", "high")

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        GlassCard {
            Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text("Gift Advisor", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                Text("Find the perfect gift for any occasion", color = TextSecondaryColor, fontSize = 14.sp)

                Text("Relationship", color = TextSecondaryColor, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    relationships.forEach { r ->
                        FilterChip(
                            selected = relationship == r,
                            onClick = { relationship = r },
                            label = { Text(r.replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
                        )
                    }
                }

                Text("Budget", color = TextSecondaryColor, fontSize = 14.sp)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    budgets.forEach { b ->
                        FilterChip(
                            selected = budget == b,
                            onClick = { budget = b },
                            label = { Text(b.replaceFirstChar { it.uppercase() }, fontSize = 12.sp) },
                        )
                    }
                }

                OutlinedTextField(
                    value = interests,
                    onValueChange = { interests = it },
                    label = { Text("Their Interests (comma separated)") },
                    modifier = Modifier.fillMaxWidth(),
                    singleLine = true,
                    colors = OutlinedTextFieldDefaults.colors(
                        focusedBorderColor = PrimaryPink,
                        unfocusedBorderColor = BorderColor,
                    ),
                )

                Button(
                    onClick = {
                        viewModel.onAction(WingmanAction.RecommendGift(
                            recipientContext = WingmanRecipientContext(
                                relationship = relationship,
                                interests = interests.split(",").map { it.trim() }.filter { it.isNotBlank() }.ifEmpty { null },
                            ),
                            budget = budget,
                        ))
                    },
                    modifier = Modifier.fillMaxWidth(),
                    colors = ButtonDefaults.buttonColors(containerColor = PrimaryPink),
                    enabled = !state.isLoading,
                ) {
                    Text("Get Gift Ideas 🎁")
                }
            }
        }

        state.giftRecommendations.forEach { rec ->
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Row(
                        modifier = Modifier.fillMaxWidth(),
                        horizontalArrangement = Arrangement.SpaceBetween,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Text(rec.name, color = PrimaryPink, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                        Text(rec.category, color = TextSecondaryColor, fontSize = 12.sp)
                    }
                    Text(rec.reason, color = TextPrimaryColor, fontSize = 14.sp)
                }
            }
        }
    }
}

@Composable
private fun AnalyticsTab(state: com.example.yugm.ui.viewmodel.WingmanState, viewModel: WingmanViewModel) {
    val scrollState = rememberScrollState()

    LaunchedEffect(Unit) {
        viewModel.onAction(WingmanAction.LoadAnalytics)
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(scrollState)
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        state.analytics?.let { analytics ->
            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
                    Text("Wingman Impact", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 18.sp)
                    Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
                        StatBox("Helped", formatNumber(analytics.totalHelped))
                        StatBox("Analyzed", formatNumber(analytics.conversationsAnalyzed))
                        StatBox("Improved", analytics.improvement)
                    }
                }
            }

            GlassCard {
                Column(modifier = Modifier.padding(16.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("Top Features", color = TextPrimaryColor, fontWeight = FontWeight.Bold, fontSize = 16.sp)
                    analytics.topFeatures.forEach { feature ->
                        Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                            Text("  ", color = PrimaryPink, fontSize = 16.sp)
                            Text(feature, color = TextPrimaryColor, fontSize = 14.sp)
                        }
                    }
                }
            }
        } ?: GlassCard {
            Box(modifier = Modifier.fillMaxWidth().padding(32.dp), contentAlignment = Alignment.Center) {
                Text("Loading analytics...", color = TextSecondaryColor)
            }
        }
    }
}

@Composable
private fun StatBox(label: String, value: String) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(value, color = PrimaryPink, fontWeight = FontWeight.Bold, fontSize = 22.sp)
        Text(label, color = TextSecondaryColor, fontSize = 12.sp)
    }
}

private fun formatNumber(n: Int): String {
    return when {
        n >= 1000000 -> "${n / 1000000}.${(n % 1000000) / 100000}M"
        n >= 1000 -> "${n / 1000}.${(n % 1000) / 100}K"
        else -> n.toString()
    }
}
