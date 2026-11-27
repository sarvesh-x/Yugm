package com.yugm.app.core.api

import com.yugm.app.core.api.parsers.toHost
import com.yugm.app.core.api.parsers.toUser
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileParserAlignmentTest {

    @Test
    fun authPayloadCarriesFullVipStatusIntoSessionUser() {
        val payload = JSONObject(
            """
            {
              "_id": "user-1", "name": "Aarav", "username": "aarav", "email": "aarav@example.test",
              "walletBalance": 120, "isVip": true, "vipTier": "VIP3", "vipLevel": 3,
              "vipExp": 1200, "vipExpRequired": 2500, "nextVipExpRequired": 4000,
              "daysRemaining": 45, "vipExpiresAt": "2026-12-31T00:00:00.000Z", "frozen": false,
              "level": 7, "levelTitle": "Gift Magnet", "xp": 2100,
              "levelStatus": {"level": 7, "title": "Gift Magnet", "xp": 2100, "progress": 0.5, "requiredXp": 900},
              "activeCosmetics": {"avatarFrame": "frame_gold", "nameStyle": "name_neon_glow"},
              "profileCompleted": true
            }
            """.trimIndent()
        )

        val user = payload.toUser()

        assertEquals("user-1", user.id)
        assertEquals(120, user.walletBalance)
        assertTrue(user.isVip)
        assertEquals("VIP3", user.vipTier)
        assertEquals(3, user.vip.vipLevel)
        assertEquals(45, user.vip.daysRemaining)
        assertEquals(2500, user.vip.vipExpRequired)
        assertEquals(7, user.levelStatus.level)
        assertEquals("frame_gold", user.activeCosmetics.avatarFrame)
    }

    @Test
    fun nestedWalletVipPayloadIsUsedWhenPresent() {
        val payload = JSONObject(
            """
            {
              "_id": "user-2", "name": "Meera", "isVip": false,
              "vip": {"isVip": true, "vipTier": "VIP2", "vipLevel": 2, "daysRemaining": 10,
                      "frozen": true, "vipExp": -5}
            }
            """.trimIndent()
        )

        val user = payload.toUser()

        assertTrue(user.isVip)
        assertTrue(user.vip.frozen)
        assertEquals("VIP2", user.vip.vipTier)
        assertEquals(2, user.vip.vipLevel)
        assertEquals(10, user.vip.daysRemaining)
    }

    @Test
    fun profilePayloadStillPopulatesHostVipAndCounters() {
        val payload = JSONObject(
            """
            {
              "_id": "user-3", "name": "Kabir", "username": "kabir",
              "isVip": true, "vipTier": "VIP4", "vipLevel": 4,
              "vipExp": 3200, "vipExpRequired": 4000, "daysRemaining": 61,
              "vipExpiresAt": "2027-01-26T00:00:00.000Z",
              "followersCount": 42, "followingCount": 13, "friendsCount": 5, "bondsCount": 2,
              "levelStatus": {"level": 9, "title": "Vibe Icon", "xp": 4200},
              "interests": ["Music"], "languages": ["Hindi"]
            }
            """.trimIndent()
        )

        val host = payload.toHost()

        assertEquals(4, host.vipLevel)
        assertEquals("VIP4", host.vipTier)
        assertEquals(61, host.vip.daysRemaining)
        assertEquals(3200, host.vip.vipExp)
        assertEquals(42, host.followers)
        assertEquals(2, host.bondsCount)
        assertEquals(9, host.levelStatus.level)
        assertEquals(listOf("Music"), host.interests)
    }
}
