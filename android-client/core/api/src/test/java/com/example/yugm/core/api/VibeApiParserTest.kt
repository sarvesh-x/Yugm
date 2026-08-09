package com.example.yugm.core.api

import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Test

class VibeApiParserTest {

    @Test
    fun testVibeMatchResponseParsing() {
        val jsonString = """
            {
                "status": "success",
                "data": {
                    "overallScore": 88,
                    "dimensionScores": {
                        "music": 90,
                        "humor": 85
                    },
                    "trend": "up",
                    "compatibility": {
                        "score": 88,
                        "label": "Soulmate Vibe",
                        "sharedInterests": ["Music", "Chill"],
                        "sharedLanguages": ["Hindi", "English"],
                        "sameCity": true
                    },
                    "targetUser": {
                        "_id": "60d5ec49f1b2c8118456789a",
                        "name": "Aarav",
                        "username": "aarav_vibe",
                        "level": 5,
                        "levelTitle": "Yugm Star"
                    }
                }
            }
        """.trimIndent()

        val data = JSONObject(jsonString).getJSONObject("data")
        val overallScore = data.optInt("overallScore", 0)
        val trend = data.optString("trend", "stable")

        assertEquals(88, overallScore)
        assertEquals("up", trend)

        val targetObj = data.optJSONObject("targetUser")
        assertNotNull(targetObj)
        assertEquals("Aarav", targetObj?.optString("name"))
        assertEquals("aarav_vibe", targetObj?.optString("username"))
    }
}
