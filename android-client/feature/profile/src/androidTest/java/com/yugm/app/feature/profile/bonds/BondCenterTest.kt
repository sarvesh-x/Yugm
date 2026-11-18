package com.yugm.app.feature.profile.bonds

import androidx.compose.material3.MaterialTheme
import androidx.compose.ui.test.junit4.createComposeRule
import androidx.compose.ui.test.onNodeWithText
import androidx.compose.ui.test.performClick
import androidx.test.ext.junit.runners.AndroidJUnit4
import org.junit.Assert.assertEquals
import org.junit.Rule
import org.junit.Test
import org.junit.runner.RunWith

@RunWith(AndroidJUnit4::class)
class BondCenterTest {
    @get:Rule val compose = createComposeRule()

    @Test fun pendingInvitationShowsConsentActionsAndDoesNotFillActiveTab() {
        val friend = BondPerson("friend", "Nia", "nia", "")
        val invitation = BondInvitation(
            "pending-1", "BESTIE", friend, 0, true, false, "Here's to more memories",
            "Friendship Bracelet", "🎀", 25, "2100-01-01T00:00:00Z"
        )
        val home = BondsHome(3, 100, true, true, 24, true, true, emptyList(), emptyList(), emptyList(), listOf(invitation))
        var accepted: Pair<String, String>? = null

        compose.setContent {
            MaterialTheme {
                BondCenter(home, false, {}, {}, {}) { request, action -> accepted = request.id to action }
            }
        }
        compose.onNodeWithText("Incoming request").assertExists()
        compose.onNodeWithText("Here's to more memories").assertExists()
        compose.onNodeWithText("Decline").assertExists()
        compose.onNodeWithText("Accept").performClick()
        compose.runOnIdle { assertEquals("pending-1" to "accept", accepted) }
        compose.onNodeWithText("Active bonds").performClick()
        compose.onNodeWithText("No active bonds").assertExists()
        compose.onNodeWithText("Ended").performClick()
        compose.onNodeWithText("No ended bonds").assertExists()
    }
}

