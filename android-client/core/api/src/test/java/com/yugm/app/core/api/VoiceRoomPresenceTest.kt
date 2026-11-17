package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toHost
import com.yugm.app.core.api.parsers.toVoiceRoomPresence
import com.yugm.app.core.model.VoiceRoomPresence
import org.json.JSONObject
import org.junit.Assert.*
import org.junit.Test

class VoiceRoomPresenceTest {

    @Test
    fun testVoiceRoomPresenceParsing() {
        val jsonString = """
            {
                "isLive": true,
                "roomId": "room_voice_101",
                "roomName": "Late Night Vibe Zone",
                "canJoin": true,
                "presenceVersion": 42,
                "expiresAt": "2026-12-31T23:59:59Z",
                "membershipId": "mem_99",
                "role": "LISTENER",
                "participantCount": 12,
                "privacySetting": "EVERYONE"
            }
        """.trimIndent()

        val presence = JSONObject(jsonString).toVoiceRoomPresence()

        assertTrue(presence.isLive)
        assertEquals("room_voice_101", presence.roomId)
        assertEquals("Late Night Vibe Zone", presence.roomName)
        assertTrue(presence.canJoin)
        assertEquals(42L, presence.presenceVersion)
        assertEquals("mem_99", presence.membershipId)
        assertEquals("LISTENER", presence.role)
        assertEquals(12, presence.participantCount)
        assertEquals("EVERYONE", presence.privacySetting)
    }

    @Test
    fun testHostParsingWithVoiceRoomPresence() {
        val hostJson = """
            {
                "_id": "user_sarvesh_1",
                "name": "Sarvesh",
                "username": "sarvesh_vibe",
                "isOnline": true,
                "voiceRoomPresence": {
                    "isLive": true,
                    "roomId": "room_456",
                    "roomName": "Party Lounge",
                    "canJoin": true,
                    "presenceVersion": 19
                }
            }
        """.trimIndent()

        val host = JSONObject(hostJson).toHost()

        assertEquals("user_sarvesh_1", host.id)
        assertEquals("Sarvesh", host.name)
        assertTrue(host.isOnline)
        assertNotNull(host.voiceRoomPresence)
        assertTrue(host.voiceRoomPresence?.isLive == true)
        assertEquals("room_456", host.voiceRoomPresence?.roomId)
        assertEquals("Party Lounge", host.voiceRoomPresence?.roomName)
        assertEquals(19L, host.voiceRoomPresence?.presenceVersion)
    }

    @Test
    fun testVoiceRoomJoinCoordinatorState() {
        assertFalse(VoiceRoomJoinCoordinator.isJoining.value)
        assertNull(VoiceRoomJoinCoordinator.currentActiveRoomId.value)

        VoiceRoomJoinCoordinator.setCurrentActiveRoomId("room_test_123")
        assertEquals("room_test_123", VoiceRoomJoinCoordinator.currentActiveRoomId.value)

        VoiceRoomJoinCoordinator.setCurrentActiveRoomId(null)
        assertNull(VoiceRoomJoinCoordinator.currentActiveRoomId.value)
    }
}
