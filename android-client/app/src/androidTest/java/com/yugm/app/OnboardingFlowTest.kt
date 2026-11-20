package com.yugm.app

import androidx.compose.ui.test.assertIsDisplayed
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.hasStateDescription
import androidx.compose.ui.test.onAllNodesWithText
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.unit.Density
import androidx.compose.ui.unit.dp
import androidx.test.ext.junit.runners.AndroidJUnit4
import com.yugm.app.core.ui.theme.YugmTheme
import com.yugm.app.feature.auth.screens.OnboardingScreen
import org.junit.Assert.assertTrue
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class OnboardingFlowTest {
    @get:Rule
    val composeRule = createComposeRule()

    @Test
    fun pagerAnnouncesProgressAndCompletesAfterLastSlide() {
        var completed = false
        composeRule.setContent {
            YugmTheme(darkTheme = false) {
                OnboardingScreen(onStart = { completed = true })
            }
        }

        composeRule.onNodeWithText("Match the vibe").assertIsDisplayed()
        composeRule.onNode(hasStateDescription("Slide 1 of 4")).assertExists()

        listOf("Find your people", "Share every moment", "Build meaningful bonds")
            .forEachIndexed { index, title ->
                composeRule.onNodeWithText("Next").performClick()
                composeRule.waitUntil(timeoutMillis = 5_000) {
                    composeRule.onAllNodes(hasStateDescription("Slide ${index + 2} of 4"))
                        .fetchSemanticsNodes().isNotEmpty() &&
                        composeRule.onAllNodesWithText(title).fetchSemanticsNodes().isNotEmpty()
                }
            }

        composeRule.onNodeWithText("Get started").performClick()
        composeRule.waitUntil(timeoutMillis = 5_000) { completed }
        assertTrue(completed)
    }

    @Test
    fun compactLargeFontKeepsFirstSlideAndActionAvailable() {
        val density = composeRule.density
        composeRule.setContent {
            CompositionLocalProvider(LocalDensity provides Density(density.density, fontScale = 1.5f)) {
                YugmTheme(darkTheme = false) {
                    Box(Modifier.width(360.dp).height(480.dp)) {
                    OnboardingScreen(onStart = {})
                    }
                }
            }
        }

        composeRule.onNodeWithText("Match the vibe").assertIsDisplayed()
        composeRule.onNodeWithText("Next").assertIsDisplayed()
    }
}
