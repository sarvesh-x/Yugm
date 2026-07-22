package com.example.yugm.core.api

import com.example.yugm.core.model.*
import org.json.JSONArray
import org.json.JSONObject

object SocialApi {

    // ─── Mood & Activity ───────────────────────────────────────

    suspend fun getMood(token: String): UserMood {
        val data = YugmHttpClient.get("/social/mood", token).getJSONObject("data")
        val moodObj = data.optJSONObject("mood") ?: return UserMood()
        return UserMood(
            userId = moodObj.optString("userId", ""),
            mood = moodObj.optString("mood", ""),
            emoji = moodObj.optString("emoji", ""),
            activity = moodObj.optString("activity", ""),
            activityRoomId = moodObj.optString("activityRoomId", "").ifBlank { null },
            isActive = moodObj.optBoolean("isActive", true)
        )
    }

    suspend fun setMood(token: String, mood: String, emoji: String? = null): UserMood {
        val body = JSONObject().put("mood", mood)
        if (emoji != null) body.put("emoji", emoji)
        val data = YugmHttpClient.post("/social/mood", token, body).getJSONObject("data")
        val moodObj = data.getJSONObject("mood")
        return UserMood(
            userId = moodObj.optString("userId", ""),
            mood = moodObj.optString("mood", ""),
            emoji = moodObj.optString("emoji", ""),
            activity = moodObj.optString("activity", ""),
            isActive = moodObj.optBoolean("isActive", true)
        )
    }

    suspend fun setActivity(token: String, activity: String, roomId: String? = null): UserMood {
        val body = JSONObject().put("activity", activity)
        if (roomId != null) body.put("roomId", roomId)
        val data = YugmHttpClient.post("/social/activity", token, body).getJSONObject("data")
        val moodObj = data.getJSONObject("mood")
        return UserMood(
            userId = moodObj.optString("userId", ""),
            activity = moodObj.optString("activity", ""),
            activityRoomId = moodObj.optString("activityRoomId", "").ifBlank { null },
            isActive = moodObj.optBoolean("isActive", true)
        )
    }

    suspend fun clearMood(token: String) {
        YugmHttpClient.delete("/social/mood", token)
    }

    // ─── Wave / Nudge / Vibe Ping ──────────────────────────────

    suspend fun sendWave(token: String, receiverId: String, type: String, roomId: String? = null): WaveNudge {
        val body = JSONObject().put("receiverId", receiverId).put("type", type)
        if (roomId != null) body.put("roomId", roomId)
        val data = YugmHttpClient.post("/social/wave", token, body).getJSONObject("data")
        val waveObj = data.getJSONObject("wave")
        return WaveNudge(
            id = waveObj.optString("_id", ""),
            receiverId = waveObj.optString("receiverId", ""),
            type = waveObj.optString("type", type),
            read = waveObj.optBoolean("read", false),
            roomId = waveObj.optString("roomId", "").ifBlank { null },
            createdAt = waveObj.optString("createdAt", "")
        )
    }

    suspend fun getWaves(token: String, unreadOnly: Boolean = false): List<WaveNudge> {
        val data = YugmHttpClient.get("/social/waves?unread=$unreadOnly", token).getJSONObject("data")
        val arr = data.getJSONArray("waves")
        return buildList {
            for (i in 0 until arr.length()) {
                val w = arr.getJSONObject(i)
                val senderObj = w.optJSONObject("senderId")
                add(WaveNudge(
                    id = w.optString("_id", ""),
                    senderId = senderObj?.let {
                        WaveSender(
                            _id = it.optString("_id", ""),
                            name = it.optString("name", ""),
                            username = it.optString("username", ""),
                            avatar = it.optString("avatar", "").ifBlank { null }
                        )
                    },
                    receiverId = w.optString("receiverId", ""),
                    type = w.optString("type", "wave"),
                    read = w.optBoolean("read", false),
                    roomId = w.optString("roomId", "").ifBlank { null },
                    createdAt = w.optString("createdAt", "")
                ))
            }
        }
    }

    suspend fun getUnreadWaveCount(token: String): Int {
        val data = YugmHttpClient.get("/social/waves/unread-count", token).getJSONObject("data")
        return data.optInt("count", 0)
    }

    suspend fun markWaveRead(token: String, waveId: String) {
        YugmHttpClient.post("/social/waves/$waveId/read", token, JSONObject())
    }

    // ─── Daily Question ────────────────────────────────────────

    suspend fun getDailyQuestion(token: String): DailyQuestion {
        val data = YugmHttpClient.get("/social/daily-question", token).getJSONObject("data")
        val q = data.getJSONObject("question")
        return DailyQuestion(
            id = q.optString("_id", ""),
            question = q.optString("question", ""),
            category = q.optString("category", "general"),
            date = q.optString("date", "")
        )
    }

    suspend fun answerDailyQuestion(token: String, questionId: String, answer: String, isPublic: Boolean = true): DailyQuestionAnswer {
        val body = JSONObject().put("questionId", questionId).put("answer", answer).put("isPublic", isPublic)
        val data = YugmHttpClient.post("/social/daily-question/answer", token, body).getJSONObject("data")
        val a = data.getJSONObject("answer")
        return parseAnswer(a)
    }

    suspend fun getQuestionAnswers(token: String, questionId: String): List<DailyQuestionAnswer> {
        val data = YugmHttpClient.get("/social/daily-question/answers/$questionId", token).getJSONObject("data")
        val arr = data.getJSONArray("answers")
        return buildList { for (i in 0 until arr.length()) add(parseAnswer(arr.getJSONObject(i))) }
    }

    suspend fun getMyAnswer(token: String, questionId: String): DailyQuestionAnswer? {
        val data = YugmHttpClient.get("/social/daily-question/my-answer/$questionId", token).getJSONObject("data")
        val a = data.optJSONObject("answer") ?: return null
        return parseAnswer(a)
    }

    private fun parseAnswer(obj: JSONObject): DailyQuestionAnswer {
        val userObj = obj.optJSONObject("userId")
        return DailyQuestionAnswer(
            id = obj.optString("_id", ""),
            userId = userObj?.optString("_id", "") ?: obj.optString("userId", ""),
            userName = userObj?.optString("name", "") ?: "",
            userAvatar = userObj?.optString("avatar", "")?.ifBlank { null },
            questionId = obj.optString("questionId", ""),
            answer = obj.optString("answer", ""),
            isPublic = obj.optBoolean("isPublic", true),
            createdAt = obj.optString("createdAt", "")
        )
    }

    // ─── Voice Polls ───────────────────────────────────────────

    suspend fun createVoicePoll(token: String, question: String, options: List<Pair<String, String?>>, audioUrl: String? = null, duration: Int? = null, expiresInHours: Int? = 24): VoicePoll {
        val body = JSONObject().put("question", question)
        val optsArr = JSONArray()
        for ((text, audio) in options) {
            val opt = JSONObject().put("text", text)
            if (audio != null) opt.put("audioUrl", audio)
            optsArr.put(opt)
        }
        body.put("options", optsArr)
        if (audioUrl != null) body.put("audioUrl", audioUrl)
        if (duration != null) body.put("duration", duration)
        if (expiresInHours != null) body.put("expiresInHours", expiresInHours)
        val data = YugmHttpClient.post("/social/voice-polls", token, body).getJSONObject("data")
        return parseVoicePoll(data.getJSONObject("poll"))
    }

    suspend fun getActiveVoicePolls(token: String, page: Int = 1, limit: Int = 20): VoicePollListResponse {
        val data = YugmHttpClient.get("/social/voice-polls?page=$page&limit=$limit", token).getJSONObject("data")
        val arr = data.getJSONArray("polls")
        val polls = buildList { for (i in 0 until arr.length()) add(parseVoicePoll(arr.getJSONObject(i))) }
        return VoicePollListResponse(
            polls = polls,
            total = data.optInt("total", 0),
            page = data.optInt("page", 1),
            limit = data.optInt("limit", 20)
        )
    }

    suspend fun voteVoicePoll(token: String, pollId: String, optionIndex: Int): VoicePoll {
        val body = JSONObject().put("optionIndex", optionIndex)
        val data = YugmHttpClient.post("/social/voice-polls/$pollId/vote", token, body).getJSONObject("data")
        return parseVoicePoll(data.getJSONObject("poll"))
    }

    suspend fun getMyVoicePolls(token: String): List<VoicePoll> {
        val data = YugmHttpClient.get("/social/voice-polls/mine", token).getJSONObject("data")
        val arr = data.getJSONArray("polls")
        return buildList { for (i in 0 until arr.length()) add(parseVoicePoll(arr.getJSONObject(i))) }
    }

    private fun parseVoicePoll(obj: JSONObject): VoicePoll {
        val userObj = obj.optJSONObject("userId")
        val optsArr = obj.optJSONArray("options") ?: JSONArray()
        val options = buildList {
            for (i in 0 until optsArr.length()) {
                val o = optsArr.getJSONObject(i)
                add(VoicePollOption(
                    text = o.optString("text", ""),
                    audioUrl = o.optString("audioUrl", "").ifBlank { null },
                    votes = o.optInt("votes", 0)
                ))
            }
        }
        val votersArr = obj.optJSONArray("voters") ?: JSONArray()
        val voters = buildList { for (i in 0 until votersArr.length()) add(votersArr.optString(i, "")) }
        return VoicePoll(
            id = obj.optString("_id", ""),
            userId = userObj?.optString("_id", "") ?: obj.optString("userId", ""),
            userName = userObj?.optString("name", "") ?: "",
            userAvatar = userObj?.optString("avatar", "")?.ifBlank { null },
            question = obj.optString("question", ""),
            audioUrl = obj.optString("audioUrl", ""),
            duration = obj.optInt("duration", 0),
            options = options,
            voters = voters,
            isActive = obj.optBoolean("isActive", true),
            expiresAt = obj.optString("expiresAt", ""),
            createdAt = obj.optString("createdAt", "")
        )
    }

    // ─── Countdown Events ──────────────────────────────────────

    suspend fun getCountdowns(token: String): List<CountdownEvent> {
        val data = YugmHttpClient.get("/social/countdowns", token).getJSONObject("data")
        val arr = data.getJSONArray("events")
        return buildList {
            for (i in 0 until arr.length()) {
                val e = arr.getJSONObject(i)
                add(CountdownEvent(
                    id = e.optString("_id", ""),
                    title = e.optString("title", ""),
                    description = e.optString("description", ""),
                    targetDate = e.optString("targetDate", ""),
                    type = e.optString("type", "event"),
                    coverImage = e.optString("coverImage", "").ifBlank { null },
                    color = e.optString("color", "#E91E63"),
                    isActive = e.optBoolean("isActive", true)
                ))
            }
        }
    }
}
