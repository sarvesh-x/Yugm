package com.yugm.app.feature.moderation.screens

import androidx.compose.animation.animateColorAsState
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val CLIENT_BLOCKED_KEYWORDS = setOf(
    "spam", "scam", "buy followers", "free coins", "hack", "cheat",
    "nude", "sex", "porn", "xxx", "escort", "casino", "betting",
    "drugs", "weapon", "violence", "hate speech", "racist",
)

data class ClientModerationResult(
    val isClean: Boolean,
    val flaggedWords: List<String>,
    val cleanText: String,
)

fun moderateClientSide(text: String): ClientModerationResult {
    val lower = text.lowercase()
    val flaggedWords = CLIENT_BLOCKED_KEYWORDS.filter { lower.contains(it) }
    return ClientModerationResult(
        isClean = flaggedWords.isEmpty(),
        flaggedWords = flaggedWords,
        cleanText = text,
    )
}

@Composable
fun FilteredOutlinedTextField(
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    label: @Composable (() -> Unit)? = null,
    placeholder: @Composable (() -> Unit)? = null,
    singleLine: Boolean = false,
    minLines: Int = 1,
    maxLines: Int = 5,
    onModerationResult: ((ClientModerationResult) -> Unit)? = null,
) {
    var moderationResult by remember(value) { mutableStateOf(moderateClientSide(value)) }

    val borderColor by animateColorAsState(
        targetValue = if (moderationResult.isClean) {
            MaterialTheme.colorScheme.outline
        } else {
            Color(0xFFFF4444)
        },
        label = "borderColor",
    )

    Column(modifier = modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = { newText ->
                val result = moderateClientSide(newText)
                moderationResult = result
                onModerationResult?.invoke(result)
                onValueChange(newText)
            },
            label = label,
            placeholder = placeholder,
            singleLine = singleLine,
            minLines = minLines,
            maxLines = maxLines,
            modifier = Modifier.fillMaxWidth(),
            shape = RoundedCornerShape(12.dp),
            isError = !moderationResult.isClean,
        )

        if (!moderationResult.isClean) {
            Row(modifier = Modifier.padding(top = 4.dp, start = 4.dp)) {
                Text(
                    "Flagged: ${moderationResult.flaggedWords.joinToString(", ")}",
                    color = Color(0xFFFF6666),
                    fontSize = 11.sp,
                )
            }
        }
    }
}
