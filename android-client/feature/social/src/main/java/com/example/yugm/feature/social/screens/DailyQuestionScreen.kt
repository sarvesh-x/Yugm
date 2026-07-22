package com.example.yugm.feature.social.screens

import android.widget.Toast
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import kotlinx.coroutines.launch
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.example.yugm.core.api.SocialApi
import com.example.yugm.core.model.DailyQuestion
import com.example.yugm.core.model.DailyQuestionAnswer
import com.example.yugm.core.ui.components.Avatar
import com.example.yugm.core.ui.components.GlassButton
import com.example.yugm.core.ui.components.GlassCard
import com.example.yugm.core.ui.components.GlassTextField
import com.example.yugm.core.ui.components.ToggleRow
import com.example.yugm.core.ui.components.YugmAmbientBackground
import com.example.yugm.core.ui.theme.*
import java.text.SimpleDateFormat
import java.util.Locale
import java.util.TimeZone

@Composable
fun DailyQuestionScreen(
    token: String,
    onBack: () -> Unit
) {
    val context = androidx.compose.ui.platform.LocalContext.current
    var question by remember { mutableStateOf<DailyQuestion?>(null) }
    var myAnswer by remember { mutableStateOf<DailyQuestionAnswer?>(null) }
    var allAnswers by remember { mutableStateOf<List<DailyQuestionAnswer>>(emptyList()) }
    var answerText by remember { mutableStateOf("") }
    var isPublic by remember { mutableStateOf(true) }
    var isLoading by remember { mutableStateOf(true) }
    var hasAnswered by remember { mutableStateOf(false) }
    val scope = rememberCoroutineScope()

    suspend fun load() {
        try {
            question = SocialApi.getDailyQuestion(token)
            question?.let { q ->
                myAnswer = SocialApi.getMyAnswer(token, q.id)
                if (myAnswer != null) hasAnswered = true
                allAnswers = SocialApi.getQuestionAnswers(token, q.id)
            }
        } catch (_: Exception) { }
        isLoading = false
    }

    LaunchedEffect(token) { load() }

    YugmAmbientBackground {
        Column(modifier = Modifier.fillMaxSize().padding(16.dp)) {
            Text("Daily Question", color = TextPrimary, fontSize = 24.sp, fontWeight = FontWeight.Black)
            Spacer(Modifier.height(16.dp))

            if (isLoading) {
                com.example.yugm.core.ui.components.LoadingState("Loading...")
            } else {
                question?.let { q ->
                    GlassCard {
                        Text("Today's Question", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                        Spacer(Modifier.height(8.dp))
                        Text(q.question, color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp, lineHeight = 24.sp)
                        Text(q.category.uppercase(), color = TextMuted, fontSize = 11.sp, modifier = Modifier.padding(top = 6.dp))
                    }

                    Spacer(Modifier.height(12.dp))

                    if (hasAnswered) {
                        GlassCard {
                            Text("Your answer", color = Gold, fontWeight = FontWeight.Bold, fontSize = 12.sp)
                            Spacer(Modifier.height(6.dp))
                            Text(myAnswer?.answer ?: "", color = TextPrimary, fontWeight = FontWeight.Medium, fontSize = 15.sp)
                        }
                    } else {
                        GlassCard {
                            Text("Write your answer", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 14.sp)
                            Spacer(Modifier.height(8.dp))
                            GlassTextField(
                                value = answerText,
                                onValueChange = { answerText = it },
                                label = "Your answer",
                                singleLine = false
                            )
                            Spacer(Modifier.height(8.dp))
                            ToggleRow("Show publicly", checked = isPublic, onCheckedChange = { isPublic = it })
                            Spacer(Modifier.height(12.dp))
                            GlassButton(
                                text = "Submit Answer",
                                enabled = answerText.isNotBlank(),
                                onClick = {
                                    scope.launch {
                                        try {
                                            SocialApi.answerDailyQuestion(token, q.id, answerText, isPublic)
                                            hasAnswered = true
                                            myAnswer = SocialApi.getMyAnswer(token, q.id)
                                            allAnswers = SocialApi.getQuestionAnswers(token, q.id)
                                            Toast.makeText(context, "Answer submitted!", Toast.LENGTH_SHORT).show()
                                        } catch (_: Exception) { }
                                    }
                                }
                            )
                        }
                    }

                    Spacer(Modifier.height(16.dp))

                    Text("Community Answers", color = TextPrimary, fontWeight = FontWeight.Black, fontSize = 18.sp)
                    Spacer(Modifier.height(8.dp))

                    if (allAnswers.isEmpty()) {
                        Text("No answers yet. Be the first!", color = TextMuted, fontSize = 14.sp)
                    } else {
                        LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp), modifier = Modifier.weight(1f)) {
                            items(allAnswers, key = { it.id }) { ans ->
                                val dateStr = try {
                                    val fmt = SimpleDateFormat("yyyy-MM-dd'T'HH:mm:ss", Locale.US)
                                    fmt.timeZone = TimeZone.getTimeZone("UTC")
                                    val out = SimpleDateFormat("MMM d, h:mm a", Locale.US)
                                    out.format(fmt.parse(ans.createdAt.take(19)) ?: return@items)
                                } catch (_: Exception) { ans.createdAt.take(10) }
                                GlassCard(modifier = Modifier.fillMaxWidth()) {
                                    Row(
                                        horizontalArrangement = Arrangement.spacedBy(10.dp),
                                        modifier = Modifier.fillMaxWidth()
                                    ) {
                                        Avatar(ans.userName.firstOrNull()?.toString() ?: "?", 34, imageUrl = ans.userAvatar)
                                        Column {
                                            Text(ans.userName, color = TextPrimary, fontWeight = FontWeight.Bold, fontSize = 13.sp)
                                            Text(ans.answer, color = TextMuted, fontSize = 14.sp)
                                            Text(dateStr, color = TextMuted, fontSize = 10.sp)
                                        }
                                    }
                                }
                            }
                        }
                    }
                } ?: com.example.yugm.core.ui.components.LoadingState("Loading question...")
            }

            Spacer(Modifier.height(12.dp))
            GlassButton(text = "Back", gradient = androidx.compose.ui.graphics.Brush.horizontalGradient(listOf(Purple, Pink)), onClick = onBack)
        }
    }
}
