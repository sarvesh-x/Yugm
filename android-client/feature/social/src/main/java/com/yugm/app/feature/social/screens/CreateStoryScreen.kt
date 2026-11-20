package com.yugm.app.feature.social.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.hilt.lifecycle.viewmodel.compose.hiltViewModel
import com.yugm.app.core.ui.components.GradientAction
import com.yugm.app.core.ui.components.LoadingState
import com.yugm.app.core.ui.components.YugmAmbientBackground
import com.yugm.app.core.ui.components.YugmPageHeader
import com.yugm.app.core.ui.components.YugmTextField
import com.yugm.app.core.ui.theme.TextPrimary
import com.yugm.app.feature.social.viewmodel.StoryViewModel

@Composable
fun CreateStoryScreen(
    token: String,
    onBack: () -> Unit
) {
    var mediaUrl by remember { mutableStateOf("") }
    var mediaType by remember { mutableStateOf("IMAGE") }
    var caption by remember { mutableStateOf("") }
    var backgroundColor by remember { mutableStateOf("") }
    var textColor by remember { mutableStateOf("") }
    val viewModel: StoryViewModel = hiltViewModel()

    YugmAmbientBackground {
        Column(Modifier.fillMaxSize()) {
            YugmPageHeader("Create Story", onBack = onBack)

            Column(
                modifier = Modifier
                    .fillMaxSize()
                    .verticalScroll(rememberScrollState())
                    .padding(horizontal = 20.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text("Story Details", color = TextPrimary, fontSize = 20.sp, fontWeight = FontWeight.Black)

                YugmTextField(value = mediaUrl, onValueChange = { mediaUrl = it }, label = "Media URL")

                YugmTextField(value = mediaType, onValueChange = { mediaType = it }, label = "Media Type (IMAGE / VIDEO)")

                YugmTextField(value = caption, onValueChange = { caption = it }, label = "Caption")

                YugmTextField(value = backgroundColor, onValueChange = { backgroundColor = it }, label = "Background Color (optional)")

                YugmTextField(value = textColor, onValueChange = { textColor = it }, label = "Text Color (optional)")

                Spacer(Modifier.height(8.dp))

                if (viewModel.isLoading) {
                    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.Center) {
                        LoadingState("Uploading story…")
                    }
                } else {
                    GradientAction(
                        label = "Create Story",
                        modifier = Modifier.fillMaxWidth(),
                        enabled = mediaUrl.isNotBlank() && mediaType.isNotBlank(),
                        onClick = {
                            viewModel.createStory(
                                token = token,
                                mediaUrl = mediaUrl,
                                mediaType = mediaType,
                                caption = caption.ifBlank { null },
                                backgroundColor = backgroundColor.ifBlank { null },
                                textColor = textColor.ifBlank { null },
                                font = null,
                                sticker = null,
                                linkUrl = null
                            )
                            onBack()
                        }
                    )
                }

                Spacer(Modifier.height(80.dp))
            }
        }
    }
}
